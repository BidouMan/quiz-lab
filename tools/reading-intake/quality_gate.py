#!/usr/bin/env python3
"""三上阅读命题稿质检闸门（T3）。

把 docs/quality-plan-3a.md 第 2 节（T1）里可机械判定的条款固化成规则，
对 data/reading-catalog/quiz-drafts/*.json 逐篇输出 pass/fail 与命中明细。

规则编号（与 T1 / 淘汰规则对应）：
  R1  范围：来源标签或标题含「下册 / 三年级下」→ fail
  R2  正文汉字 < 250 → fail
  R3  题量不在 3–5 → fail
  R4  考点 < 3 类，或不含 SK2/SK4，或无 SK3/SK5 主观题 → fail
  R5  客观题 < 2 或主观题 < 1 → fail
  R6  纯抄写/纯记忆题 ≥ 2，或全部题目皆 SK1 → fail
  R7  填空占位与 blanks 数不符，或答案在正文找不到 → fail
  R8  选择题选项非 4 个互异项/答案越界，或 explain 无可回溯原文引句 → fail
  R9  简答评分点不在 2–3 条，或可回溯锚点 < 2 条 → fail
  R10 选项长度比 > 2.0、含「以上都对/无法判断」类选项、同篇正确项位置连续 3 题相同 → fail
  R11 skill 字段缺失或非法（无法归入 SK1–SK7）→ fail
  R12 难度分层（易/中/难，仅记录，不判 fail）

用法：
  python3 quality_gate.py                # 写 quality-gate.jsonl 并打印统计
  python3 quality_gate.py --dry-run      # 只打印统计
  python3 quality_gate.py --ids RD-306,RD-316
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import statistics
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
OUTPUT = os.path.join(ROOT, "data", "reading-catalog", "quality-gate.jsonl")
DOWNLIST = os.path.join(ROOT, "data", "reading-catalog", "downlisted.json")
REJECTED = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts-rejected.jsonl")
HUMAN_SAMPLES = os.path.join(ROOT, "data", "reading-catalog", "human-review-samples.jsonl")

HANZI = re.compile(r"[\u4e00-\u9fff]")
PLACEHOLDER = "（ ）"
QUOTE_RE = re.compile(r"[“「『\"]([^”」』\"]{2,})[”」』\"]")
SENTENCE_SPLIT = re.compile(r"[，。；：、！？,.;:!?\s]+")

# skill 字段 → SK 编号
SKILL_MAP = {
    "提取信息": "SK1",
    "梳理概括": "SK2",
    "词句理解": "SK3",
    "推断体会": "SK4",
    "主旨情感": "SK5",
    "写法结构": "SK6",
    "非连续性文本": "SK7",
}

# 无 skill 字段时按题干问法推断（顺序敏感：先概括，再推断，再词句，兜底提取）
SKILL_INFER = [
    ("SK2", re.compile(r"概括|主要|哪些|哪几|顺序|段意|写了.*(?:哪些|什么)|短文写了|先.*再|围绕|梳理")),
    ("SK4", re.compile(r"体会|感受|心情|为什么|原因|说明(?:了)?什么|预示|想象|你认为|你会|道理|启示")),
    ("SK3", re.compile(r"意思|含义|加点|词语|句子|比喻|描写|好在|表达|仿佛|像什么|作用|赏析|换(?:成|掉)")),
]

# 纯记忆/纯抄写：机械可识别的高置信问法
MEMORY_RE = re.compile(r"读音|字音|字形|错别字|默写|拼音|加点字|量词|作者是|文学常识|看拼音")
COPY_RE = re.compile(r"抄写|摘录|照抄|画(?:出|下)|用横线画出|原文中找出")
COPY_FOLLOW_RE = re.compile(r"为什么|体会|说明|意思|作用|表达|概括|比较|仿写|换(?:成|掉)")

BANNED_OPTION_RE = re.compile(r"以上都(?:对|不对|正确|错误)|无法判断|都不对|都正确|全部正确")

# SK4（推断体会）题干落在「体会/情感/品质」时，按 T1 的「SK3 或 SK5 主观题」口径计入
EMOTION_RE = re.compile(r"体会|感受|心情|品质|喜爱|喜欢|赞美|情感|感悟|领略")

# 脚本判不了、必须人工抽样复核的四类
HUMAN_REVIEW = {
    "R9": "简答锚点的语义支撑（脚本只看字符串是否命中）",
    "R6": "纯抄写/纯记忆判定（脚本只看问法关键词）",
    "R10": "干扰项同质同域（脚本只看长度比与凑数词）",
    "R12": "难度分层（脚本按字数与 SK 粗分）",
}

SCOPE_RE = re.compile(r"下册|三年级下")
PASS_SCORE = None  # 预留：综合分阈值（当前按规则一票否决）


def han_only(text: str) -> str:
    return "".join(HANZI.findall(str(text)))


def load_drafts(ids: set[str] | None = None) -> list[dict]:
    drafts = []
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if ids and draft.get("id") not in ids:
            continue
        drafts.append(draft)
    return drafts


def infer_skill(question: dict) -> tuple[str | None, str]:
    raw = (question.get("skill") or "").strip()
    if raw in SKILL_MAP:
        return SKILL_MAP[raw], "field"
    if raw:
        return None, "illegal"
    stem = question.get("stem") or ""
    for sk, pattern in SKILL_INFER:
        if pattern.search(stem):
            return sk, "inferred"
    return "SK1", "inferred"


def question_skill(question: dict) -> tuple[str | None, str]:
    return infer_skill(question)


def is_copy_or_memory(question: dict) -> tuple[bool, str]:
    stem = question.get("stem") or ""
    if MEMORY_RE.search(stem):
        return True, "memory"
    if COPY_RE.search(stem) and not COPY_FOLLOW_RE.search(stem):
        return True, "copy"
    return False, ""


def answer_anchored(phrase: str, text_han: str, min_len: int, text_raw: str = "") -> bool:
    cleaned = han_only(phrase)
    if cleaned:
        return len(cleaned) >= min_len and cleaned in text_han
    # 纯数字/字母答案（如「5」「27」「1.2」）按原样在正文里找
    raw = str(phrase).strip()
    return bool(raw) and raw in text_raw


def scoring_anchors(scoring: list[str], text_han: str) -> tuple[int, list[str]]:
    anchored = []
    for point in scoring:
        point = re.sub(r"^能?(?:答出|答到|说出|写出|找到|指出|用)\s*", "", (point or "").strip())
        hit = None
        for quote in QUOTE_RE.findall(point):
            if answer_anchored(quote, text_han, 4):
                hit = quote
                break
        if hit is None:
            for run in SENTENCE_SPLIT.split(point):
                if answer_anchored(run, text_han, 4):
                    hit = run
                    break
        if hit:
            anchored.append(hit)
    return len(anchored), anchored


def check_choice(question: dict) -> list[dict]:
    problems = []
    options = question.get("options") or []
    if len(options) != 4 or any(not str(o).strip() for o in options):
        problems.append({"rule": "R8", "detail": f"选项不是 4 个非空项（{len(options)}）"})
    elif len(set(options)) != 4:
        problems.append({"rule": "R8", "detail": "选项存在重复"})
    answer = question.get("answer")
    if not isinstance(answer, int) or not 0 <= answer < 4:
        problems.append({"rule": "R8", "detail": f"答案下标越界（{answer}）"})
    explain = (question.get("explain") or "").strip()
    if not explain:
        problems.append({"rule": "R8", "detail": "缺 explain"})
    else:
        quotes = QUOTE_RE.findall(explain)
        text_han = question.get("_text_han", "")
        if not any(answer_anchored(q, text_han, 6) for q in quotes):
            problems.append({"rule": "R8", "detail": "explain 无 ≥6 汉字可回溯原文引句"})
    # R10：长度比 / 荒谬项
    if len(options) == 4 and all(str(o).strip() for o in options):
        lengths = [len(str(o).strip()) for o in options]
        ratio = max(lengths) / min(lengths) if min(lengths) else 99
        if ratio > 2.0:
            problems.append({"rule": "R10", "detail": f"选项长度比 {ratio:.1f} > 2.0"})
        banned = [str(o) for o in options if BANNED_OPTION_RE.search(str(o))]
        if banned:
            problems.append({"rule": "R10", "detail": f"含凑数选项：{banned[0][:16]}"})
    return problems


def check_fill(question: dict, text_han: str, text_raw: str = "") -> list[dict]:
    problems = []
    stem = question.get("stem") or ""
    blanks = question.get("blanks") or []
    if not blanks or any(not str(b).strip() for b in blanks):
        problems.append({"rule": "R7", "detail": "blanks 为空"})
        return problems
    if stem.count(PLACEHOLDER) != len(blanks):
        problems.append({"rule": "R7", "detail": f"占位 {stem.count(PLACEHOLDER)} 个 ≠ 答案 {len(blanks)} 个"})
    missing = [b for b in blanks if not answer_anchored(b, text_han, 1, text_raw)]
    if missing:
        problems.append({"rule": "R7", "detail": f"答案不在正文：{missing}"})
    return problems


def check_short(question: dict, text_han: str) -> list[dict]:
    problems = []
    scoring = [(s or "").strip() for s in (question.get("scoring") or [])]
    if not 2 <= len(scoring) <= 3 or any(not s for s in scoring):
        problems.append({"rule": "R9", "detail": f"评分点不是 2–3 条（{len(scoring)}）"})
        return problems
    count, anchored = scoring_anchors(scoring, text_han)
    if count < 2:
        problems.append({"rule": "R9", "detail": f"可回溯锚点 {count}/2；已命中 {anchored}"})
    return problems


def difficulty_of(char_count: int, skills: set[str]) -> str:
    if char_count > 550 or skills & {"SK6", "SK7"}:
        return "难"
    if char_count >= 350:
        return "中"
    return "易"


def review_one(draft: dict) -> dict:
    rid = draft.get("id") or "?"
    title = (draft.get("title") or "").strip()
    paragraphs = [str(p) for p in (draft.get("paragraphs") or [])]
    text_raw = "".join(paragraphs)
    text_han = han_only(text_raw)
    char_count = len(text_han)
    failures: list[dict] = []

    # R1 范围
    scope_text = title + " " + " ".join(str(s.get("label") or "") for s in (draft.get("sources") or []))
    if SCOPE_RE.search(scope_text):
        failures.append({"rule": "R1", "detail": "来源/标题含下册"})

    # R2 字数
    if char_count < 250:
        failures.append({"rule": "R2", "detail": f"正文 {char_count} 汉字 < 250"})

    questions = draft.get("questions") or []

    # R3 题量
    if not 3 <= len(questions) <= 5:
        failures.append({"rule": "R3", "detail": f"题量 {len(questions)} 不在 3–5"})

    # R11 skill 字段
    skills_detail = []
    illegal = 0
    for index, question in enumerate(questions, start=1):
        sk, source = question_skill(question)
        if source != "field":
            illegal += 1
        skills_detail.append({"index": index, "skill": sk, "source": source})
    if illegal:
        failures.append({"rule": "R11", "detail": f"{illegal} 道题 skill 字段缺失/非法"})

    skills = {item["skill"] for item in skills_detail if item["skill"]}
    # SK4 简答若问「体会/感受/心情/品质」，按 SK5 口径视为达标
    subjective35 = any(
        item["skill"] in {"SK3", "SK5"}
        or (item["skill"] == "SK4" and EMOTION_RE.search(q.get("stem") or ""))
        for item, q in zip(skills_detail, questions)
        if q.get("type") == "short"
    )

    # R4 考点覆盖
    if len(skills) < 3:
        failures.append({"rule": "R4", "detail": f"考点仅 {len(skills)} 类：{sorted(skills)}"})
    if not skills & {"SK2", "SK4"}:
        failures.append({"rule": "R4", "detail": "缺 SK2/SK4（概括或推断）"})
    if not subjective35:
        failures.append({"rule": "R4", "detail": "无 SK3/SK5 类主观题（赏析/体会/情感/品质）"})

    # R5 题型配比
    objective = sum(1 for q in questions if q.get("type") in {"choice", "fill"})
    subjective = sum(1 for q in questions if q.get("type") == "short")
    if objective < 2:
        failures.append({"rule": "R5", "detail": f"客观题 {objective} < 2"})
    if subjective < 1:
        failures.append({"rule": "R5", "detail": "无主观题"})

    # 逐题检查
    answers_positions = []
    copy_memory = 0
    for index, (question, info) in enumerate(zip(questions, skills_detail), start=1):
        qtype = question.get("type")
        bad_copy, why = is_copy_or_memory(question)
        if bad_copy:
            copy_memory += 1
        if qtype == "choice":
            for problem in check_choice({**question, "_text_han": text_han}):
                failures.append({**problem, "detail": f"第 {index} 题：{problem['detail']}"})
            if isinstance(question.get("answer"), int):
                answers_positions.append(question["answer"])
        elif qtype == "fill":
            for problem in check_fill(question, text_han, text_raw):
                failures.append({**problem, "detail": f"第 {index} 题：{problem['detail']}"})
        elif qtype == "short":
            for problem in check_short(question, text_han):
                failures.append({**problem, "detail": f"第 {index} 题：{problem['detail']}"})
        else:
            failures.append({"rule": "R8", "detail": f"第 {index} 题未知题型 {qtype}"})

    # R6 纯抄写/纯记忆
    if copy_memory >= 2:
        failures.append({"rule": "R6", "detail": f"纯抄写/纯记忆题 {copy_memory} 道 ≥ 2"})
    if questions and all(item["skill"] == "SK1" for item in skills_detail):
        failures.append({"rule": "R6", "detail": "全部题目皆为 SK1（提取信息）"})

    # R10 正确项位置连续 3 题相同
    for start in range(len(answers_positions) - 2):
        if answers_positions[start:start + 3] == [answers_positions[start]] * 3:
            failures.append({"rule": "R10", "detail": f"正确项位置连续 3 题相同（{answers_positions[start]}）"})
            break

    difficulty = difficulty_of(char_count, skills)
    rule_names = sorted({item["rule"] for item in failures}, key=lambda r: int(r[1:]))

    flags = []
    if any(q.get("type") == "short" for q in questions):
        flags.append("R9")
    if copy_memory:
        flags.append("R6")
    if any(q.get("type") == "choice" for q in questions):
        flags.append("R10")
    flags.append("R12")

    return {
        "id": rid,
        "title": title,
        "pass": not failures,
        "failures": failures,
        "rules": rule_names,
        "difficulty": difficulty,
        "human_review_flags": flags,
        "needs_human_review": (not failures) and bool(flags),
        "details": {
            "charCount": char_count,
            "questionCount": len(questions),
            "types": dict(Counter(q.get("type") for q in questions)),
            "skills": sorted(skills),
            "objective": objective,
            "subjective": subjective,
            "copyMemory": copy_memory,
        },
    }


REASON_TEXT = {
    "R1": "三下来源（范围一票否决）",
    "R2": "正文不足 250 汉字",
}


def write_downlist(records: list[dict], drafts: dict[str, dict]) -> None:
    """R1/R2 命中的篇目移出挂载池：文件保留，只记录下架原因。"""
    readings = []
    for record in records:
        hit = [rule for rule in record["rules"] if rule in {"R1", "R2"}]
        if not hit:
            continue
        readings.append({
            "id": record["id"],
            "title": record["title"],
            "charCount": record["details"]["charCount"],
            "rules": hit,
            "reasons": [REASON_TEXT[rule] for rule in hit],
            "sources": [s.get("label", "") for s in (drafts[record["id"]].get("sources") or [])],
        })
    payload = {
        "generatedAt": __import__("time").strftime("%Y-%m-%d", __import__("time").localtime()),
        "policy": "正文 <250 汉字或三下来源：移出挂载池，文件保留，不删数据。",
        "count": len(readings),
        "readings": readings,
    }
    with open(DOWNLIST, "w", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    with open(REJECTED, "w", encoding="utf-8") as f:
        for item in readings:
            f.write(json.dumps({
                **item,
                "note": "文件保留在 quiz-drafts，仅移出挂载池",
            }, ensure_ascii=False) + "\n")


def write_human_samples(records: list[dict], drafts: dict[str, dict]) -> list[dict]:
    """四类脚本判不了的问题各留 3 条样例，供人工抽样复核。"""
    samples: list[dict] = []
    down_ids = {r["id"] for r in records if set(r["rules"]) & {"R1", "R2"}}

    def first_question(draft: dict, predicate):
        for index, question in enumerate(draft.get("questions") or [], start=1):
            if predicate(question):
                return index, question
        return None, None

    def push(record: dict, category: str, detail: str) -> None:
        samples.append({
            "category": category,
            "label": HUMAN_REVIEW[category],
            "id": record["id"],
            "title": record["title"],
            "detail": detail,
        })

    # R9：优先取锚点确实不足的篇目
    r9 = [
        r for r in records
        if r["id"] not in down_ids
        and ("R9" in r["rules"] or "R9" in r["human_review_flags"])
    ]
    for record in r9[:3]:
        index, question = first_question(drafts[record["id"]], lambda q: q.get("type") == "short")
        detail = f"第 {index} 题「{(question or {}).get('stem', '')[:36]}」评分点与原文的对应需人工确认"
        push(record, "R9", detail)

    # R6：有抄写/记忆嫌疑题的篇目
    r6 = [r for r in records if r["id"] not in down_ids and "R6" in r["human_review_flags"]]
    for record in r6[:3]:
        index, question = first_question(drafts[record["id"]], lambda q: is_copy_or_memory(q)[0])
        detail = f"第 {index} 题「{(question or {}).get('stem', '')[:36]}」是否属于纯抄写/纯记忆需人工判定"
        push(record, "R6", detail)

    # R10：长度比或凑数项被脚本命中的篇目
    r10 = [r for r in records if r["id"] not in down_ids and "R10" in r["rules"]]
    for record in r10[:3]:
        detail = next(f["detail"] for f in record["failures"] if f["rule"] == "R10")
        push(record, "R10", f"{detail}；四个选项是否同质同域需人工判定")

    # R12：易/中/难各取 1 篇
    for level in ("易", "中", "难"):
        record = next((r for r in records if r["id"] not in down_ids and r["difficulty"] == level), None)
        if record:
            push(record, "R12", f"脚本按正文 {record['details']['charCount']} 字与 SK {'/'.join(record['details']['skills'])} 判为「{level}」")

    with open(HUMAN_SAMPLES, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")
    return samples


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ids", help="逗号分隔的编号，只跑这些")
    parser.add_argument("--write-downlist", action="store_true", help="同时写出 downlisted.json / quiz-drafts-rejected.jsonl")
    args = parser.parse_args()

    ids = set(args.ids.split(",")) if args.ids else None
    drafts = load_drafts(ids)
    records = [review_one(draft) for draft in drafts]

    passes = [r for r in records if r["pass"]]
    rule_hits: Counter = Counter()
    for record in records:
        for rule in record["rules"]:
            rule_hits[rule] += 1

    payload = "\n".join(json.dumps(record, ensure_ascii=False) for record in records) + "\n"
    if not args.dry_run:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write(payload)
    draft_map = {draft["id"]: draft for draft in drafts}
    if args.write_downlist:
        write_downlist(records, draft_map)
        samples = write_human_samples(records, draft_map)
        print(f"下架清单：{os.path.relpath(DOWNLIST, ROOT)}；拒收记录：{os.path.relpath(REJECTED, ROOT)}")
        print(f"人工复核样例：{os.path.relpath(HUMAN_SAMPLES, ROOT)}（{len(samples)} 条）")

    order = [f"R{n}" for n in range(1, 12)]
    print(f"命题稿 {len(records)} 篇；pass {len(passes)} 篇；fail {len(records) - len(passes)} 篇")
    print("规则命中：")
    for rule in order:
        print(f"  {rule}: {rule_hits.get(rule, 0)} 篇")
    print("难度分布：", dict(Counter(r["difficulty"] for r in records)))
    flagged = [r for r in records if r["needs_human_review"]]
    print(f"pass 但需人工复核：{len(flagged)} 篇" + (f"（{', '.join(r['id'] for r in flagged)}）" if flagged else ""))
    print("失败规则组合 Top：")
    for combo, count in Counter("+".join(r["rules"]) for r in records if not r["pass"]).most_common(8):
        print(f"  {combo}: {count}")
    if passes:
        print("pass 篇：", ", ".join(r["id"] for r in passes))
    if not args.dry_run:
        print(f"已写入 {os.path.relpath(OUTPUT, ROOT)}")


if __name__ == "__main__":
    main()
