#!/usr/bin/env python3
"""给三上素材池逐篇打考点标签（SK1–SK7，见 docs/reading-skills-3a.md）。

有原题的篇目按题干问法打标；没有原题的标 `待命题`，不臆测覆盖。
输出 data/reading-catalog/skills-tags.jsonl，并打印分布与偏少考点。

用法：python3 tag_skills.py
"""
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAT = os.path.join(ROOT, "data", "reading-catalog")
OUT = os.path.join(CAT, "skills-tags.jsonl")

RULES = [
    ("SK1", re.compile(r"哪些|什么|哪里|谁|什么时候|画出|找出|填一填|填空|照样子填")),
    ("SK2", re.compile(r"概括|主要|讲了|写了|几件事|段意|顺序|情节|先用.*再|填表|完成表格")),
    ("SK3", re.compile(r"加点|词语|句子|意思|赏析|比喻|拟人|排比|好在哪里|妙处|体会|想象")),
    ("SK4", re.compile(r"为什么|原因|因为|结果|如果|预测|接下来|说明|推断|从中可知")),
    ("SK5", re.compile(r"道理|启示|感受|情感|感情|喜欢|赞扬|品质|中心|告诉我们|心情")),
    ("SK6", re.compile(r"开头|结尾|过渡|结构|总起|分述|总写|照应|写法|详写|略写|写法上")),
    ("SK7", re.compile(r"材料|表格|通知|目录|说明书|海报|图表|示意图|清单|根据以上")),
]


def read(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_pool():
    pool = []
    for name in ("passages.jsonl", "passages-intext.jsonl"):
        for r in read(os.path.join(CAT, "szxuexiao-20261108", name)):
            pool.append({
                "id": r["id"], "title": r.get("lesson") or r.get("title") or "",
                "source": "szxuexiao", "scope": r.get("scope", ""),
                "chars": r.get("chars", 0), "questions": r.get("questions", 0),
                "questionText": r.get("questionText", ""),
            })
    for r in read(os.path.join(CAT, "ns21cnjy-20261108", "passages.jsonl")):
        pool.append({
            "id": r["id"], "title": r.get("title", ""), "source": "21cnjy",
            "scope": "extracurricular", "chars": r.get("chars", 0),
            "questions": r.get("questions", 0),
            "questionText": r.get("questionText", ""),
        })
    return pool


def tag(item):
    if item["questions"] <= 0 or not item["questionText"].strip():
        return [], "待命题"
    skills = []
    for code, pattern in RULES:
        if pattern.search(item["questionText"]):
            skills.append(code)
    basis = "按原题题干打标"
    if not skills:
        skills = ["SK1"]
        basis = "题干未命中关键词，按最低覆盖记 SK1"
    return skills, basis


def main():
    pool = load_pool()
    rows = []
    for item in pool:
        skills, basis = tag(item)
        rows.append({**item, "skills": skills, "basis": basis})
    with open(OUT, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    total = len(rows)
    pending = [r for r in rows if r["basis"] == "待命题"]
    covered = [r for r in rows if r["basis"] != "待命题"]
    counts = Counter(s for r in covered for s in r["skills"])
    print(f"素材池 {total} 篇：有原题 {len(covered)}，待命题 {len(pending)}")
    for code, _ in RULES:
        n = counts[code]
        pct = n / max(1, len(covered)) * 100
        print(f"{code}: {n:4d} 篇（占有原题篇目 {pct:4.1f}%）")
    thin = [c for c, _ in RULES if counts[c] / max(1, len(covered)) < 0.15]
    print("偏少考点（<15%）：", "、".join(thin) if thin else "无")
    print("每篇平均考点数：", round(sum(len(r["skills"]) for r in covered) / max(1, len(covered)), 2))
    print(f"明细：{os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
