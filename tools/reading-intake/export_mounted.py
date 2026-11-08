#!/usr/bin/env python3
"""把 quiz-drafts（RD-301–RD-500）批量导出为前端可用的题库文件。

背景：199 份命题稿字段齐全，但应用题库（imported.ts 里的 20 篇）是另一批
试点稿。为让孩子能实际做题，这里按 `ChineseReading` 的 7 个字段生成
`src/data/chinese/readings/mounted.ts`，并在 `index.ts` 里与精选库合并成
`PRACTICE_READING_BANK` 供出卷使用。

只做字段白名单导出，不手改任何一题：
  - 命题稿里的 score / origin / skill / answerSource 等属于命题过程元数据，
    前端类型没有对应字段，丢弃；原件仍保留在 data/reading-catalog/quiz-drafts/。
  - 21 份主题越界（童话 17 / 记事 3 / 非连续 1）按既定映射改为六类主题，
    并在 review 末尾标注，便于抽查。

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

THEMES = {"写人", "写景", "写事", "状物", "寓言", "科普"}
THEME_MAP = {"童话": "寓言", "记事": "写事", "非连续": "科普"}
PLACEHOLDER = "（ ）"


def fail(msg):
    raise SystemExit(f"导出中止：{msg}")


def export_question(q, rid):
    qtype = q.get("type")
    stem = (q.get("stem") or "").strip()
    if not stem:
        fail(f"{rid} 题干为空")
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
                "answer": answer, "explain": explain}
    if qtype == "fill":
        blanks = q.get("blanks") or []
        if not blanks or any(not str(b).strip() for b in blanks):
            fail(f"{rid} 填空题答案为空：{stem}")
        if stem.count(PLACEHOLDER) != len(blanks):
            fail(f"{rid} 填空题占位与答案数量不符：{stem}")
        explain = (q.get("explain") or "").strip()
        if not explain:
            fail(f"{rid} 填空题缺答案说明：{stem}")
        return {"type": "fill", "stem": stem, "blanks": blanks, "explain": explain}
    if qtype == "short":
        scoring = [(s or "").strip() for s in (q.get("scoring") or [])]
        if not 2 <= len(scoring) <= 3 or any(not s for s in scoring):
            fail(f"{rid} 简答题评分点不是 2–3 条：{stem}")
        item = {"type": "short", "stem": stem, "scoring": scoring}
        answer = (q.get("answer") or "").strip()
        if answer:
            item["answer"] = answer
        return item
    fail(f"{rid} 未知题型：{qtype}")


def export_reading(draft):
    rid = draft.get("id") or ""
    if not re.match(r"^RD-\d{3}$", rid):
        fail(f"编号异常：{rid}")
    title = (draft.get("title") or "").strip()
    paragraphs = [str(p).strip() for p in (draft.get("paragraphs") or []) if str(p).strip()]
    if not title or not paragraphs:
        fail(f"{rid} 标题或正文为空")
    theme = draft.get("theme")
    if theme not in THEMES:
        if theme not in THEME_MAP:
            fail(f"{rid} 主题越界且未约定映射：{theme}")
        theme = THEME_MAP[theme]
    questions = [export_question(q, rid) for q in (draft.get("questions") or [])]
    if not 3 <= len(questions) <= 5:
        fail(f"{rid} 题量不是 3–5 题")
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
    if draft.get("theme") != theme:
        review += f"（题库挂载：主题 {draft['theme']} 映射为 {theme}，应用题库仅六类主题。）"
    return {
        "id": rid,
        "title": title,
        "theme": theme,
        "paragraphs": paragraphs,
        "status": draft.get("status") or "verified",
        "sources": sources,
        "questions": questions,
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
    if os.path.exists(GATE):
        with open(GATE, encoding="utf-8") as f:
            passed = {json.loads(line)["id"] for line in f if line.strip() and json.loads(line)["pass"]}

    readings, ids = [], set()
    skipped = pending = 0
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if draft.get("id") in downlisted:
            skipped += 1
            continue
        if passed is not None and draft.get("id") not in passed:
            pending += 1
            continue
        item = export_reading(draft)
        if item["id"] in ids:
            fail(f"编号重复：{item['id']}")
        ids.add(item["id"])
        readings.append(item)

    header = (
        "// 由 tools/reading-intake/export_mounted.py 自动生成，请改 quiz-drafts 后重跑，不要手改。\n"
        "import type { ChineseReading } from '../types.ts'\n\n"
    )
    body = ("export const MOUNTED_READINGS: ChineseReading[] = "
            + json.dumps(readings, ensure_ascii=False, indent=2) + "\n")

    if args.dry_run:
        print(f"待导出 {len(readings)} 篇（已下架 {skipped} 篇，未过闸待处理 {pending} 篇）")
    else:
        with open(TARGET, "w", encoding="utf-8") as f:
            f.write(header + body)
        print(f"已写入 {os.path.relpath(TARGET, ROOT)}：{len(readings)} 篇"
              f"（已下架 {skipped} 篇，未过闸待处理 {pending} 篇）")

    themes = Counter(r["theme"] for r in readings)
    qtypes = Counter(q["type"] for r in readings for q in r["questions"])
    chars = [len(re.findall(r"[\u4e00-\u9fff]", "".join(r["paragraphs"]))) for r in readings]
    print("主题：", " ".join(f"{k}{v}" for k, v in themes.items()))
    print("题量：", sum(qtypes.values()), "题", dict(qtypes))
    print(f"正文汉字：min {min(chars)} / median {sorted(chars)[len(chars) // 2]} / max {max(chars)}")
    print(f"编号：{min(ids)} – {max(ids)}；未挂载 {len([n for n in range(301, 501) if f'RD-{n}' not in ids])} 个（缺号 + 已下架）")


if __name__ == "__main__":
    main()
