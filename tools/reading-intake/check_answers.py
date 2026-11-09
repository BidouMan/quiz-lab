#!/usr/bin/env python3
"""检查阅读主观题参考答案：覆盖率、待补清单、答案质量粗检。

背景：答案页改为直接给家长核对，主观题必须有成句的参考答案；
缺答案时答案页只能回退到评分要点，家长无法直接判断对错。

检查项（全部机械判定，不代替人工定稿）：
  1. 覆盖率：A/B/C 三组各有多少主观题、多少有非空 answer；
  2. 待补清单：按篇列出缺答案的题号与题干；
  3. 答案粗检：长度、禁用词（略/见解析/言之有理即可）、
     是否含 ≥8 字原文片段或引号原文（便于家长回原文核对）；
  4. 多问复合题是否分点作答（用“；”“①”或换行判断，仅提示）。

用法：
  python3 tools/reading-intake/check_answers.py
  python3 tools/reading-intake/check_answers.py --group B --limit 20
  python3 tools/reading-intake/check_answers.py --csv work/answers-todo.csv
"""
import argparse
import csv
import glob
import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
DOWNLIST = os.path.join(ROOT, "data", "reading-catalog", "downlisted.json")
GATE = os.path.join(ROOT, "data", "reading-catalog", "quality-gate.jsonl")

CJK = re.compile(r"[\u4e00-\u9fff]")
QUOTE = re.compile(r"[“「]([^”」]{2,})[”」]")
BANNED = ["略", "见解析", "言之有理即可", "答案不唯一", "自由发挥"]
GROUP_NAME = {"A": "原题原样", "B": "自命题", "C": "原题修补"}


def cjk_only(text):
    return "".join(CJK.findall(text or ""))


def group_of(q):
    action = (q.get("origin") or {}).get("action")
    if action == "新命" or action is None:
        return "B"
    if action in ("修补", "修正"):
        return "C"
    return "A"


def max_run(text, body, floor=8, cap=40):
    q = cjk_only(text)
    if len(q) < floor:
        return 0
    for k in range(min(len(q), cap), floor - 1, -1):
        for i in range(len(q) - k + 1):
            if q[i:i + k] in body:
                return k
    return 0


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
    return drafts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", choices=["A", "B", "C"], help="只看某一组")
    ap.add_argument("--limit", type=int, default=0, help="待补清单最多打印几条")
    ap.add_argument("--csv", help="把待补清单写到 CSV（相对仓库根目录）")
    args = ap.parse_args()

    drafts = load()
    total = Counter()
    with_answer = Counter()
    missing = []
    issues = []

    for draft in drafts:
        body = cjk_only("".join(draft.get("paragraphs") or []))
        raw = "".join(draft.get("paragraphs") or [])
        for idx, q in enumerate(draft["questions"], 1):
            if q.get("type") != "short":
                continue
            group = group_of(q)
            total[group] += 1
            answer = (q.get("answer") or "").strip()
            key = f"{draft['id']}#{idx}"
            if not answer:
                missing.append({
                    "group": group, "key": key, "id": draft["id"], "index": idx,
                    "skill": q.get("skill", ""), "stem": q["stem"],
                    "scoring": "；".join(q.get("scoring") or []),
                })
                continue
            with_answer[group] += 1

            problems = []
            if len(answer) > 120:
                problems.append(f"答案过长（{len(answer)} 字）")
            hit = [w for w in BANNED if w in answer]
            if hit:
                problems.append(f"含禁用词：{'、'.join(hit)}")
            quoted = [t for t in QUOTE.findall(answer) if cjk_only(t) in body]
            if not quoted and max_run(answer, body) < 8:
                problems.append("答案无 ≥8 字原文依据，家长难以回文核对")
            if q["stem"].count("？") >= 2 and not re.search(r"[；;①②③]|\n", answer):
                problems.append("题干多问，答案未分点")
            if problems:
                issues.append({"group": group, "key": key, "title": draft["title"],
                               "problems": problems, "answer": answer})

    order = [g for g in ("A", "B", "C") if not args.group or g == args.group]
    print("主观题参考答案覆盖：")
    for g in order:
        n = total[g]
        k = with_answer[g]
        pct = k / n * 100 if n else 0
        print(f"  {g} {GROUP_NAME[g]}：{k}/{n}（{pct:.1f}%）")
    overall_n = sum(total[g] for g in order)
    overall_k = sum(with_answer[g] for g in order)
    print(f"  合计：{overall_k}/{overall_n}"
          f"（{overall_k / overall_n * 100:.1f}%）")

    missing = [m for m in missing if m["group"] in order]
    print(f"\n待补答案：{len(missing)} 道")
    per_page = Counter(m["id"] for m in missing)
    print("涉及篇目：", len(per_page), "篇；单篇最多", max(per_page.values()) if per_page else 0, "道")

    show = missing[:args.limit] if args.limit else missing
    if args.limit:
        print(f"（仅显示前 {len(show)} 道）")
    for m in show:
        print(f"  {m['key']} [{m['group']}/{m['skill']}] {m['stem'][:46]}")

    print(f"\n已有答案的质量提示：{len(issues)} 道")
    for item in issues[:20]:
        print(f"  {item['key']}《{item['title']}》：" + "；".join(item["problems"]))

    if args.csv:
        path = os.path.join(ROOT, args.csv)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["组", "题号", "篇目", "题号序", "考点", "题干", "现有评分点"])
            for m in missing:
                writer.writerow([m["group"], m["key"], m["id"], m["index"],
                                 m["skill"], m["stem"], m["scoring"]])
        print(f"\n待补清单已写入 {args.csv}")


if __name__ == "__main__":
    main()
