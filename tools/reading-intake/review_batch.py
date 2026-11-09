#!/usr/bin/env python3
"""按题库顺序列出下一批需要处理的篇目，供逐篇「改题＋补答案」使用。

只列正式题库（quality_gate 通过且未下架）的篇目；每篇输出正文和
需要处理的题目（缺参考答案 / 模板题干 / 含超纲术语），已完善的题目不打印。

用法：
  python3 tools/reading-intake/review_batch.py --start RD-311 --count 10
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

TERMS = ["总分总", "总分", "分总", "借景抒情", "托物言志", "承上启下", "首尾呼应",
         "过渡句", "点明中心", "动静结合", "详略", "象征", "铺垫", "伏笔",
         "侧面描写", "正面描写", "表达方式", "修辞手法", "段落作用", "环境描写"]
TEMPLATES = ["文中写“", "短文主要写", "短文最后", "短文第"]


def load():
    downlisted = set()
    with open(DOWNLIST, encoding="utf-8") as f:
        downlisted = {r["id"] for r in json.load(f).get("readings", [])}
    passed = {}
    with open(GATE, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                row = json.loads(line)
                passed[row["id"]] = row
    drafts = []
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if draft["id"] in downlisted or not passed.get(draft["id"], {}).get("pass"):
            continue
        drafts.append(draft)
    drafts.sort(key=lambda d: int(d["id"].split("-")[1]))
    return drafts


def needs_work(q):
    reasons = []
    if q.get("type") == "short" and not (q.get("answer") or "").strip():
        reasons.append("缺答案")
    text = q.get("stem", "") + "".join(q.get("options") or [])
    terms = [t for t in TERMS if t in text]
    if terms:
        reasons.append("术语：" + "、".join(terms))
    if any(q.get("stem", "").startswith(t) for t in TEMPLATES):
        reasons.append("模板题干")
    return reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="RD-301")
    ap.add_argument("--count", type=int, default=10)
    args = ap.parse_args()

    drafts = load()
    ids = [d["id"] for d in drafts]
    start = ids.index(args.start) if args.start in ids else 0
    batch = drafts[start:start + args.count]

    print(f"本批 {len(batch)} 篇：{batch[0]['id']} – {batch[-1]['id']}"
          f"（全库共 {len(drafts)} 篇，剩余 {len(drafts) - start} 篇）")
    work = 0
    for draft in batch:
        flags = [(i, q, needs_work(q)) for i, q in enumerate(draft["questions"], 1)]
        todo = [(i, q, r) for i, q, r in flags if r]
        print("\n" + "=" * 78)
        print(f"{draft['id']} {draft['title']} {draft['theme']} {draft['charCount']}字 "
              f"{len(draft['questions'])}题 待处理 {len(todo)} 题")
        if not todo:
            print("  无需改动")
            continue
        work += 1
        for p in draft["paragraphs"]:
            print("  " + p)
        for i, q, reasons in todo:
            action = (q.get("origin") or {}).get("action")
            print(f"  Q{i} [{q['type']}/{q['skill']}/{action}] {'；'.join(reasons)}")
            print(f"     {q['stem']}")
            if q["type"] == "choice":
                for j, o in enumerate(q["options"]):
                    print(f"       {'ABCD'[j]}. {o}")
                print(f"       ans={'ABCD'[q['answer']]} | {q.get('explain')}")
            elif q["type"] == "fill":
                print(f"       blanks={q['blanks']} | {q.get('explain')}")
            else:
                print(f"       answer={q.get('answer') or '（无）'}")
                print(f"       scoring={q.get('scoring')}")

    print(f"\n本批需要处理 {work}/{len(batch)} 篇；其余可跳过。")


if __name__ == "__main__":
    main()
