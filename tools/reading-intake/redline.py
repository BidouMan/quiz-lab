#!/usr/bin/env python3
"""红线错字检查：只报会影响判分的三处，其它错字不拦入库。

三类必须核：
  1. 答案所在的字/词（填空答案、正确答案里的关键词）
  2. 生字/词语题的题面字（题目里用 focus 标出考的那几个字词）
  3. 题目明确引用的原句（题干或解析里用“”引起来的句子）

规则：
  - 原文找不到完全一致的写法时，先在原文里找只差一两个字的近似片段，报出「题面写法 / 原文写法」；
  - 只允许改回原文可查证的字，不做润色；
  - 不影响判分的重复“的”、标点差异等只计数，不阻断。

用法（供 cli.py process 调用）：
    from redline import inspect
    result = inspect(reading)   # {"blocking": [...], "benign": [...]}
"""
from __future__ import annotations

import re

CJK = re.compile(r"[\u4e00-\u9fff]")
QUOTE = re.compile(r"“([^”]+)”")
PLACEHOLDER = "（ ）"
QUOTE_MAP = str.maketrans({"‘": "“", "’": "”", "「": "“", "」": "”", "『": "“", "』": "”"})


def normalize_quotes(text: str) -> str:
    return text.translate(QUOTE_MAP)


def citation_parts(fragment: str) -> list[str]:
    """引文按空格拆开；只有成句（汉字 ≥5）才核对，词/短语与纯空格放过。"""
    parts = [part.strip() for part in fragment.split(PLACEHOLDER) if part.strip()]
    hanzi = sum(len(CJK.findall(part)) for part in parts)
    return parts if hanzi >= 5 else []


def reading_text(reading: dict) -> str:
    return "".join(reading.get("paragraphs", []))


def near_fragments(text: str, target: str, limit: int = 3) -> list[tuple[str, int]]:
    """在 text 中找与 target 等长、逐字差不超过 10%（至少 1 字）的片段。"""
    target = target.strip()
    if not target or len(target) > 200:
        return []
    length = len(target)
    allowed = max(1, length // 10)
    found: list[tuple[str, int]] = []
    for start in range(0, max(0, len(text) - length + 1)):
        window = text[start:start + length]
        if window == target:
            return [(window, start)]
        differences = sum(1 for left, right in zip(target, window) if left != right)
        if differences <= allowed:
            if all(existing != window for existing, _ in found):
                found.append((window, start))
            if len(found) >= limit:
                break
    return found


def locate(paragraphs: list[str], fragment: str) -> int | None:
    for index, paragraph in enumerate(paragraphs, start=1):
        if fragment in paragraph:
            return index
    return None


def check_target(text: str, paragraphs: list[str], target: str, kind: str, source: str) -> dict | None:
    target = target.strip()
    if not target:
        return None
    if target in text:
        return None
    candidates = near_fragments(text, target)
    entry = {
        "kind": kind,
        "source": source,
        "target": target,
        "candidates": [candidate for candidate, _ in candidates],
        "paragraph": locate(paragraphs, candidates[0][0]) if candidates else None,
        "fixable": bool(candidates),
    }
    return entry


def count_benign(text: str) -> list[dict]:
    rules = [
        ("重复虚词", re.compile(r"(的的|了了|地地|得得|是是|在在)")),
        ("连续标点", re.compile(r"[，。！？；：]{2,}")),
        ("汉字间空格", re.compile(r"[\u4e00-\u9fff]\s+[\u4e00-\u9fff]")),
        ("半角标点", re.compile(r"[\u4e00-\u9fff][,;?!]")),
    ]
    found = []
    for name, pattern in rules:
        matches = pattern.findall(text)
        if matches:
            found.append({"name": name, "count": len(matches)})
    return found


def inspect(reading: dict) -> dict:
    paragraphs = reading.get("paragraphs", [])
    text = reading_text(reading)
    blocking: list[dict] = []

    for index, question in enumerate(reading.get("questions", []), start=1):
        stem = question.get("stem", "")
        kind = question.get("type")
        label = f"Q{index}"

        # 1) 答案所在的字/词
        if kind == "fill":
            for blank in question.get("blanks") or []:
                entry = check_target(text, paragraphs, blank, "答案用字", f"{label} 填空")
                if entry:
                    blocking.append(entry)
        # 2) 生字/词语题的题面字
        for focus in question.get("focus") or []:
            entry = check_target(text, paragraphs, focus, "题面用字", f"{label} focus")
            if entry:
                blocking.append(entry)

        # 3) 题目明确引用的原句（只核成句，跳过填空占位和词/短语）
        for fragment in QUOTE.findall(stem) + QUOTE.findall(question.get("explain", "")):
            for part in citation_parts(fragment):
                entry = check_target(normalize_quotes(text), [normalize_quotes(p) for p in paragraphs],
                                      normalize_quotes(part), "引用原句", f"{label} 引文")
                if entry:
                    blocking.append(entry)

    return {"blocking": blocking, "benign": count_benign(text)}


if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    print(json.dumps(inspect(payload), ensure_ascii=False, indent=2))
