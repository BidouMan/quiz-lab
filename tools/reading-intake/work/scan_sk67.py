#!/usr/bin/env python3
"""扫描素材池，找未命题的 SK7（非连续/多材料）与 SK6（写法结构）候选（中间产物，不提交）。"""
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
HANZI = re.compile(r"[\u4e00-\u9fff]")
PLACEHOLDER = "（ ）"

pool = {}
for path in ["data/reading-catalog/szxuexiao-20261108/passages.jsonl",
             "data/reading-catalog/ns21cnjy-20261108/passages.jsonl"]:
    for line in open(os.path.join(ROOT, path), encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            pool.setdefault(rec["id"], rec)
for path in sorted(glob.glob(os.path.join(ROOT, "data/reading-catalog/ns21cnjy-20261108/batch-0*.jsonl"))):
    for line in open(path, encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            pool.setdefault(rec["id"], rec)

used = set()
for path in glob.glob(os.path.join(ROOT, "data/reading-catalog/quiz-drafts", "*.json")):
    draft = json.load(open(path, encoding="utf-8"))
    if draft.get("sourceId"):
        used.add(draft["sourceId"])

SK7_HINT = re.compile(r"材料[一二三四]|【材料|阅读材料|通知|公告|启事|海报|目录|说明书|使用说明|注意事项|"
                      r"作息时间|课程表|车票|门票|导览|流程图|步骤|表格|图表|示意图|平面图|"
                      r"温馨提示|告知书|招募|广告|清单|记录表|调查表|申请表")
SK6_HINT = re.compile(r"总分|分总|总分总|先总|结构|动静|详略|借景抒情|首尾呼应|过渡|"
                      r"由远及近|由近及远|从上到下|移步换景|观察顺序|游览顺序")

rows = []
for rid, rec in pool.items():
    if rid in used:
        continue
    text = rec.get("text") or ""
    han = len(HANZI.findall(text))
    if han < 250:
        continue
    title = rec.get("pageTitle") or ""
    questions = rec.get("questions") or []
    qt = rec.get("questionText") or ""
    sk7 = bool(SK7_HINT.search(text) or SK7_HINT.search(title) or SK7_HINT.search(qt[:400]))
    sk6 = bool(SK6_HINT.search(qt))
    rows.append({
        "id": rid, "title": title, "han": han,
        "qs": rec.get("questions") if isinstance(rec.get("questions"), int) else len(questions), "ans": bool(rec.get("hasAnswer")),
        "sk7": sk7, "sk6": sk6,
        "head": text[:120].replace("\n", " "),
    })

rows.sort(key=lambda r: (-r["sk7"], -r["sk6"], r["han"]))
print(f"未命题且正文≥250：{len(rows)} 篇；SK7 疑似 {sum(r['sk7'] for r in rows)}；SK6 疑似 {sum(r['sk6'] for r in rows)}")
for r in rows:
    tag = ("SK7" if r["sk7"] else "") + ("+SK6" if r["sk6"] else "")
    print(f"{r['id']:>22} {r['han']:>4}字 q{r['qs']} ans{int(r['ans'])} {tag:<8} {r['title'][:22]} | {r['head'][:70]}")
json.dump(rows, open(os.path.join(ROOT, "tools/reading-intake/work/sk67-scan.json"), "w"),
          ensure_ascii=False, indent=1)
