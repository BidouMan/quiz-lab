#!/usr/bin/env python3
"""把 quiz-drafts 批量导出为前端可用的题库文件。

只做字段白名单导出，不手改任何一题：
  - 命题稿里的 score / origin / answerSource 仍属于命题过程元数据，前端不需要，丢弃。
  - 保留 skill（逐题考点 + 每篇考点集合）、原始 theme（九类不再合并）、difficulty（易/中/难 → A/B/C）。
  - 原件仍保留在 data/reading-catalog/quiz-drafts/。

用法：
  python3 export_mounted.py [--dry-run]
"""
import argparse
import glob
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
DOWNLIST = os.path.join(ROOT, "data", "reading-catalog", "downlisted.json")
GATE = os.path.join(ROOT, "data", "reading-catalog", "quality-gate.jsonl")
TARGET = os.path.join(ROOT, "src", "data", "chinese", "readings", "mounted.ts")

THEMES = {"写人", "写景", "写事", "状物", "寓言", "科普", "非连续", "童话", "记事"}
SKILL_MAP = {
    "提取信息": "SK1", "梳理概括": "SK2", "词句理解": "SK3",
    "推断体会": "SK4", "主旨情感": "SK5", "写法结构": "SK6",
    "非连续性文本": "SK7",
}
SKILL_ORDER = [f"SK{i}" for i in range(1, 8)]
DIFFICULTY_MAP = {"易": "A", "中": "B", "难": "C"}
PLACEHOLDER = "（ ）"


def fail(msg):
    raise SystemExit(f"导出中止：{msg}")


def export_question(q, rid):
    qtype = q.get("type")
    stem = (q.get("stem") or "").strip()
    if not stem:
        fail(f"{rid} 题干为空")
    skill = (q.get("skill") or "").strip()
    if skill not in SKILL_MAP:
        fail(f"{rid} 考点缺失或非法：{skill!r}（{stem[:18]}）")
    skill_code = SKILL_MAP[skill]
    if qtype == "choice":
        options = q.get("options") or []
        if len(options) != 4 or any(not str(o).strip() for o in options):
            fail(f"{rid} 选择题选项不是 4 个非空项")
        if len(set(options)) != 4:
            fail(f"{rid} 选择题选项重复：{stem}")
        answer = q.get("answer")
        if not isinstance(answer, int) or not 0 <= answer < 4:
            fail(f"{rid} 选择题答案下标越界：{stem}")
        explain = (q.get("explain") or "").strip()
        if not explain:
            fail(f"{rid} 选择题缺答案说明：{stem}")
        return {"type": "choice", "stem": stem, "options": options,
                "answer": answer, "explain": explain, "skill": skill_code}
    if qtype == "fill":
        blanks = q.get("blanks") or []
        if not blanks or any(not str(b).strip() for b in blanks):
            fail(f"{rid} 填空题答案为空：{stem}")
        if stem.count(PLACEHOLDER) != len(blanks):
            fail(f"{rid} 填空题占位与答案数量不符：{stem}")
        explain = (q.get("explain") or "").strip()
        if not explain:
            fail(f"{rid} 填空题缺答案说明：{stem}")
        return {"type": "fill", "stem": stem, "blanks": blanks,
                "explain": explain, "skill": skill_code}
    if qtype == "short":
        scoring = [(s or "").strip() for s in (q.get("scoring") or [])]
        if not 2 <= len(scoring) <= 3 or any(not s for s in scoring):
            fail(f"{rid} 简答题评分点不是 2–3 条：{stem}")
        item = {"type": "short", "stem": stem, "scoring": scoring, "skill": skill_code}
        answer = (q.get("answer") or "").strip()
        if answer:
            item["answer"] = answer
        return item
    fail(f"{rid} 未知题型：{qtype}")


def export_reading(draft, difficulty="中", pending=False):
    rid = draft.get("id") or ""
    if not re.match(r"^RD-\d{3}$", rid):
        fail(f"编号异常：{rid}")
    title = (draft.get("title") or "").strip()
    paragraphs = [str(p).strip() for p in (draft.get("paragraphs") or []) if str(p).strip()]
    if not title or not paragraphs:
        fail(f"{rid} 标题或正文为空")
    theme = draft.get("theme")
    if theme not in THEMES:
        fail(f"{rid} 主题越界：{theme}（需先在题型/主题枚举中登记）")
    questions = [export_question(q, rid) for q in (draft.get("questions") or [])]
    if not 3 <= len(questions) <= 5:
        fail(f"{rid} 题量不是 3–5 题")
    skills = sorted({q["skill"] for q in questions}, key=SKILL_ORDER.index)
    sources = []
    for src in draft.get("sources") or []:
        label = (src.get("label") or "").strip()
        locator = (src.get("locator") or "").strip()
        if not label or not locator:
            fail(f"{rid} 来源缺 label/locator")
        item = {"label": label, "locator": locator}
        if (src.get("url") or "").startswith("http"):
            item["url"] = src["url"]
        sources.append(item)
    if not sources:
        fail(f"{rid} 缺来源")
    review = (draft.get("review") or "").strip()
    if not review:
        fail(f"{rid} 缺复核记录")
    if pending:
        review += "（待修区：quality_gate 未通过，题目待修补；仅供练习，不计入合格挂载，不参与精选/考试模式。）"
    return {
        "id": rid,
        "title": title,
        "theme": theme,
        "paragraphs": paragraphs,
        "status": "pending" if pending else (draft.get("status") or "verified"),
        "sources": sources,
        "questions": questions,
        "skills": skills,
        "difficulty": DIFFICULTY_MAP.get(difficulty, "B"),
        "review": review,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    downlisted = set()
    if os.path.exists(DOWNLIST):
        with open(DOWNLIST, encoding="utf-8") as f:
            downlisted = {item["id"] for item in json.load(f).get("readings", [])}

    passed = None
    difficulties = {}
    if os.path.exists(GATE):
        with open(GATE, encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        passed = {row["id"] for row in rows if row["pass"]}
        difficulties = {row["id"]: row.get("difficulty", "中") for row in rows}

    official, pending = [], []
    ids = set()
    skipped = 0
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if draft.get("id") in downlisted:
            skipped += 1
            continue
        is_official = passed is None or draft.get("id") in passed
        item = export_reading(draft, difficulty=difficulties.get(draft.get("id"), "中"),
                              pending=not is_official)
        if item["id"] in ids:
            fail(f"编号重复：{item['id']}")
        ids.add(item["id"])
        (official if is_official else pending).append(item)

    header = (
        "// 由 tools/reading-intake/export_mounted.py 自动生成，请改 quiz-drafts 后重跑，不要手改。\n"
        "// MOUNTED_READINGS 为正式题库（quality_gate 通过）；PENDING_READINGS 为待修区（可练习，不计入合格数）。\n"
        "// 保留逐题 skill（SK1–SK7）、每篇 skills/difficulty 与原始九类 theme，供出卷按主题/考点/难度筛选。\n"
        "import type { ChineseReading } from '../types.ts'\n\n"
    )
    body = (
        "export const MOUNTED_READINGS: ChineseReading[] = "
        + json.dumps(official, ensure_ascii=False, indent=2) + "\n\n"
        + "export const PENDING_READINGS: ChineseReading[] = "
        + json.dumps(pending, ensure_ascii=False, indent=2) + "\n"
    )

    if args.dry_run:
        print(f"正式题库 {len(official)} 篇；待修区 {len(pending)} 篇；已下架 {skipped} 篇")
    else:
        with open(TARGET, "w", encoding="utf-8") as f:
            f.write(header + body)
        print(f"已写入 {os.path.relpath(TARGET, ROOT)}：正式 {len(official)} 篇，待修 {len(pending)} 篇，已下架 {skipped} 篇")

    readings = official + pending
    themes = Counter(r["theme"] for r in readings)
    qtypes = Counter(q["type"] for r in readings for q in r["questions"])
    skills_pages = Counter(code for r in readings for code in r["skills"])
    skills_questions = Counter(q.get("skill") for r in readings for q in r["questions"])
    chars = [len(re.findall(r"[\u4e00-\u9fff]", "".join(r["paragraphs"]))) for r in readings]
    print("主题：", " ".join(f"{k}{v}" for k, v in themes.items()))
    print("考点覆盖（篇/题）：", " ".join(f"{k} {skills_pages[k]}/{skills_questions[k]}"
                                     for k in sorted(skills_questions)))
    print("难度：", dict(Counter(r["difficulty"] for r in readings)))
    print("题量：", sum(qtypes.values()), "题", dict(qtypes))
    print(f"正文汉字：min {min(chars)} / median {sorted(chars)[len(chars) // 2]} / max {max(chars)}")
    numeric = sorted(int(i.split("-")[1]) for i in ids)
    print(f"编号：RD-{numeric[0]} – RD-{numeric[-1]}；共 {len(numeric)} 篇")


if __name__ == "__main__":
    main()
