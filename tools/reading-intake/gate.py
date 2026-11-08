#!/usr/bin/env python3
"""入库前质检闸门：把 tests/chinese-readings.test.ts 里能自动判的规则抽出来，
对一份待入库 JSON 先跑一遍，减少人工看稿范围。

用法：python3 gate.py draft.json [draft2.json ...]
输出：每条规则的 PASS/FAIL 与失败原因；主观题保留参考答案只报提示，不判失败。
      全部通过退出码 0，否则 1。

口径（2026-11 起）：
- 客观题答案必须保留（选择答案下标、填空答案、病句 fixed、关联词/标点 answers）。
- 主观题不设标准答案，必须有 2–3 条评分要点（rubric / scoring）；
  若仍带答案字段，只报提示，不报错。
- 题干与解析里用「“…”」明确引用的原句，必须逐字出现在原文。

只覆盖「不依赖题库上下文」的检查。来源真实性、答案是否正确不在此列，必须人看。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

THEMES = {"写人", "写景", "写事", "状物", "寓言", "科普"}
PLACEHOLDER = "（ ）"
HANZI = re.compile(r"[\u4e00-\u9fff]")
SENTENCE_KINDS = {"gaibing", "kuoxie", "guanlian", "biaodian", "fangxie"}


def reading_text(reading: dict) -> str:
    return "".join(reading.get("paragraphs", []))


def placeholders(text: str) -> int:
    return text.count(PLACEHOLDER)


def quotes(text: str) -> list[str]:
    return re.findall(r"“([^”]+)”", text)


QUOTE_MAP = str.maketrans({"‘": "“", "’": "”", "「": "“", "」": "”", "『": "“", "』": "”"})


def normalize_quotes(text: str) -> str:
    return text.translate(QUOTE_MAP)


def hanzi_count(text: str) -> int:
    return len(HANZI.findall(text))


def citation_parts(fragment: str) -> list[str]:
    """把引文按题干空格拆开；只把「原句」当硬检查对象，词/短语（<5 字）放过。"""
    parts = [part.strip() for part in fragment.split(PLACEHOLDER) if part.strip()]
    if sum(hanzi_count(part) for part in parts) < 5:
        return []
    return parts


# ---------------------------------------------------------------- 阅读短文

def check(reading: dict) -> list[tuple[str, bool, str]]:
    text = reading_text(reading)
    results: list[tuple[str, bool, str]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))

    add("字段齐全", all(key in reading for key in
                        ("id", "title", "theme", "status", "sources", "review", "paragraphs", "questions")),
        "缺 " + ",".join(k for k in ("id", "title", "theme", "status", "sources", "review", "paragraphs", "questions") if k not in reading))

    kind = reading.get("kind", "extracurricular")
    add("kind 合法", kind in {"in-text", "extracurricular"}, str(kind))
    # 试点稿的正文已剥离原题；字数闸按来源切分单元的实际字数判定，两者都记录
    count = int(reading.get("sourceCharCount") or hanzi_count(text))
    low, high = (150, 400) if kind == "in-text" else (150, 600)
    add(f"正文 ≥{low} 汉字（{kind}）", count >= low, f"实际 {count}")
    add("分段 ≥3", len(reading.get("paragraphs", [])) >= 3,
        f"实际 {len(reading.get('paragraphs', []))}")

    questions = reading.get("questions", [])
    types = {q.get("type") for q in questions}
    add("题量 3–5", 3 <= len(questions) <= 5, f"实际 {len(questions)}")
    add("题型 ≥2 种", len(types) >= 2, f"实际 {sorted(types)}")

    normalized = normalize_quotes(text)
    for index, question in enumerate(questions, start=1):
        kind = question.get("type")
        stem = question.get("stem", "")
        explain = question.get("explain", "")
        if kind == "choice":
            options = question.get("options") or []
            add(f"Q{index} 四选一", len(options) == 4 and len(set(options)) == 4,
                f"选项 {len(options)} 个")
            answer = question.get("answer", -1)
            add(f"Q{index} 答案下标", 0 <= answer < 4, f"answer={answer}")
            add(f"Q{index} 有解析", bool(explain), "")
            add(f"Q{index} 解析含原文引文", bool(quotes(explain)), "解析里没有“”引文")
        elif kind == "fill":
            add(f"Q{index} 空数=答案数", placeholders(stem) == len(question.get("blanks") or []),
                f"空 {placeholders(stem)} / 答案 {len(question.get('blanks') or [])}")
            for blank in question.get("blanks") or []:
                add(f"Q{index} 答案非空", bool(blank.strip()), "")
                add(f"Q{index} 答案在原文", blank.strip() in text, f"「{blank}」不在原文")
            add(f"Q{index} 有解析", bool(explain), "")
        elif kind == "short":
            scoring = question.get("scoring") or []
            add(f"Q{index} 评分点 2–3", 2 <= len(scoring) <= 3, f"实际 {len(scoring)}")
            for point in scoring:
                add(f"Q{index} 评分点非空", bool(point.strip()), "")
            if str(question.get("answer", "")).strip():
                # 主观题保留参考答案只作参考，不判失败（见 hints）
                pass
        else:
            add(f"Q{index} 题型合法", False, str(kind))

        # 题干/解析明确引用的原句必须逐字出现在原文（含空格的按空格分段核）
        for fragment in quotes(stem) + quotes(explain):
            for part in citation_parts(fragment):
                if normalize_quotes(part) not in normalized:
                    add(f"Q{index} 引文逐字一致", False, f"未在原文找到「{part[:20]}」")

    add("status=verified", reading.get("status") == "verified", str(reading.get("status")))
    add("有来源", bool(reading.get("sources")), "")
    add("有复核记录", bool(reading.get("review")), "")
    return results


def hints(reading: dict) -> list[str]:
    """不判失败、但需要记录的处理提示。"""
    out: list[str] = []
    kind = reading.get("kind", "extracurricular")
    low, high = (150, 400) if kind == "in-text" else (150, 600)
    count = int(reading.get("sourceCharCount") or hanzi_count(reading_text(reading)))
    body = hanzi_count(reading_text(reading))
    if reading.get("sourceCharCount"):
        out.append(f"正文本体 {body} 字；字数闸按源切分单元 {count} 字（原题已剥离）")
    if count > high:
        out.append(f"正文 {count} 字，超过 {kind} 上限 {high}，已标出但不拒收")
    for index, question in enumerate(reading.get("questions", []), start=1):
        if question.get("type") == "short" and str(question.get("answer", "")).strip():
            out.append(f"Q{index} 主观简答仍带参考答案，仅作批改参考，不作标准答案")
    return out


# ---------------------------------------------------------------- 句子题

def check_sentence(item: dict) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))

    kind = item.get("kind")
    judging = item.get("judging")
    add("题型合法", kind in SENTENCE_KINDS, str(kind))
    add("判分方式合法", judging in {"auto", "rubric"}, str(judging))

    if judging == "auto":
        if kind == "gaibing":
            add("客观题答案必填", bool(str(item.get("fixed", "")).strip()), "缺 fixed")
        elif kind in {"guanlian", "biaodian"}:
            answers = item.get("answers") or []
            add("客观题答案必填", len(answers) >= 1, "缺 answers")
            blanks = placeholders(item.get("text", ""))
            for combo in answers:
                add("答案组合长度=空数", len(combo) == blanks, f"{len(combo)} / {blanks}")
    elif judging == "rubric":
        rubric = item.get("rubric") or []
        add("主观题评分点 ≥2", len(rubric) >= 2, f"实际 {len(rubric)}")
        for point in rubric:
            add("评分点非空", bool(str(point).strip()), "")
    return results


def sentence_hints(item: dict) -> list[str]:
    if item.get("judging") != "rubric":
        return []
    leftover = []
    if str(item.get("fixed", "")).strip():
        leftover.append("fixed")
    if item.get("acceptable"):
        leftover.append("acceptable")
    if item.get("samples"):
        leftover.append("samples")
    if not leftover:
        return []
    return [f"主观题仍带参考答案字段（{','.join(leftover)}），仅作参考，不作标准答案"]


# ---------------------------------------------------------------- CLI

def main() -> None:
    failed = 0
    for path in sys.argv[1:]:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        docs = data if isinstance(data, list) else [data]
        for doc in docs:
            if doc.get("kind") in SENTENCE_KINDS:
                results = check_sentence(doc)
                notes = sentence_hints(doc)
            else:
                results = check(doc)
                notes = hints(doc)
            bad = [item for item in results if not item[1]]
            label = f"{Path(path).name} / {doc.get('id', '?')}"
            print(f"== {label}: {'PASS' if not bad else f'FAIL ({len(bad)})'}")
            for name, ok, detail in results:
                if not ok:
                    print(f"   ✗ {name} {detail}")
            for note in notes:
                print(f"   ! {note}")
            failed += bool(bad)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
