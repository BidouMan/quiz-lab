#!/usr/bin/env python3
"""把已校验的 SK5 补题补丁写回 quiz-drafts。

用法：
  python3 tools/reading-intake/work/apply_sk5_patch.py <patch.json>

只追加 1 道 short/主旨情感题；同步 strategyNote 的新命与主观计数，并在 review 追加补强说明。
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
NOTE = "2026-11-08 SK5 覆盖补强：补 1 道主旨情感简答题（题干与评分点均回原文定位）。"


def bump_strategy(note: str) -> str:
    note = re.sub(r"新命 (\d+)", lambda m: f"新命 {int(m.group(1)) + 1}", note)
    return re.sub(r"主观 (\d+)", lambda m: f"主观 {int(m.group(1)) + 1}", note)


def main() -> None:
    if len(sys.argv) != 2:
        print("用法：apply_sk5_patch.py <patch.json>")
        raise SystemExit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        patch = json.load(f)
    for item in patch:
        rid = item["id"]
        path = os.path.join(DRAFTS, f"{rid}.json")
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if any(q.get("skill") == "主旨情感" for q in draft.get("questions", [])):
            print(f"{rid} 已有主旨情感题，跳过")
            continue
        draft.setdefault("questions", []).append({
            "type": "short",
            "score": item.get("score", 3),
            "skill": "主旨情感",
            "answerSource": "new",
            "origin": item.get("origin")
            or {"action": "新命", "original": "原卷无主旨情感题", "note": "SK5 覆盖补强"},
            "stem": item["stem"],
            "scoring": item["scoring"],
        })
        if "strategyNote" in draft:
            draft["strategyNote"] = bump_strategy(draft["strategyNote"])
        review = (draft.get("review") or "").rstrip()
        if NOTE not in review:
            draft["review"] = review + NOTE
        with open(path, "w", encoding="utf-8") as f:
            json.dump(draft, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{rid} 已补第 {len(draft['questions'])} 题")


if __name__ == "__main__":
    main()
