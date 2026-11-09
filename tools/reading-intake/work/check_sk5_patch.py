#!/usr/bin/env python3
"""校验 SK5 补题补丁：把补丁题追加到内存中的草稿副本，按 quality_gate 规则复判。

用法：
  python3 tools/reading-intake/work/check_sk5_patch.py <patch.json>

补丁格式：[{"id": "RD-xxx", "stem": "...", "scoring": ["...", "..."], "score": 3, "origin": {...}}]
只允许 short 题；skill 固定为「主旨情感」。
"""
from __future__ import annotations

import copy
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "reading-intake"))
import quality_gate as qg  # noqa: E402

DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
BANNED_STEM = ("学到了什么", "明白了什么", "懂得什么", "有什么道理")
ABSTRACT_ONLY = ("要勇敢", "要善良", "要坚强", "要诚实", "要乐于助人")


def main() -> None:
    if len(sys.argv) != 2:
        print("用法：check_sk5_patch.py <patch.json>")
        raise SystemExit(2)
    patch_path = sys.argv[1]
    with open(patch_path, encoding="utf-8") as f:
        patch = json.load(f)

    failed = 0
    for item in patch:
        rid = item.get("id")
        draft_path = os.path.join(DRAFTS, f"{rid}.json")
        if not os.path.exists(draft_path):
            print(f"{rid} 缺少草稿")
            failed += 1
            continue
        with open(draft_path, encoding="utf-8") as f:
            draft = json.load(f)
        question = {
            "type": "short",
            "score": item.get("score", 3),
            "skill": "主旨情感",
            "answerSource": "new",
            "origin": item.get("origin")
            or {"action": "新命", "original": "原卷无主旨情感题", "note": "SK5 覆盖补强"},
            "stem": item["stem"],
            "scoring": item["scoring"],
        }
        problems = []
        if len(draft.get("questions", [])) >= 5:
            problems.append(f"题量已达 {len(draft.get('questions', []))}，不能再补")
        if any(word in item["stem"] for word in BANNED_STEM):
            problems.append("题干命中空泛问法")
        if not any(word in item["stem"] for word in ("主要", "表达", "情感", "体会", "感受", "感情")):
            problems.append("题干未指向主旨/情感/体会")
        for point in item["scoring"]:
            if any(word in point for word in ABSTRACT_ONLY) and len(qg.han_only(point)) < 20:
                problems.append(f"评分点过于抽象：{point[:20]}")
        patched = copy.deepcopy(draft)
        patched.setdefault("questions", []).append(question)
        record = qg.review_one(patched)
        if not record["pass"]:
            problems.extend(f"{x['rule']} {x['detail']}" for x in record["failures"])
        if problems:
            failed += 1
            print(f"FAIL {rid}")
            for problem in problems:
                print(f"  - {problem}")
        else:
            print(f"PASS {rid}（第 {len(patched['questions'])} 题）")
    print(f"合计 {len(patch)} 篇，通过 {len(patch) - failed} 篇，失败 {failed} 篇")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
