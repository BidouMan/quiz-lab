#!/usr/bin/env python3
"""把选择题的正确项位置按篇均衡，并去掉答案说明里的「第几项」位置依赖。

背景：全库选择题 84%（自命题）/57.5%（原题）的正确项都在 A 位，
出卷链路按存储顺序渲染选项，学生「都选 A」即可拿分。

做法（只动 options 顺序与 answer 下标，不改题干、不改选项文字）：
  1. --fix-explain：把 explain 里的「第一项」「C项」等位置指代替换成该选项原文，
     避免重排后说明指向错误（幂等，已替换过的不会重复处理）。
  2. --reorder：同一篇内的选择题按「页偏移 + 题序」分配 A/B/C/D，
     保证单篇内位置互不相同；页偏移取自编号，使全库整体均匀。
  3. 每处交换都校验：选项集合不变、正确项文字不变、四项非空互异。

用法：
  python3 tools/reading-intake/balance_options.py --dry-run
  python3 tools/reading-intake/balance_options.py --apply
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
LETTERS = "ABCD"
POS_REF = re.compile(r"第([一二三四])项")
LETTER_REF = re.compile(r"(?<![A-Za-z])([A-D])项")
CN_NUM = {"一": 0, "二": 1, "三": 2, "四": 3}


def load():
    downlisted = set()
    if os.path.exists(DOWNLIST):
        with open(DOWNLIST, encoding="utf-8") as f:
            downlisted = {r["id"] for r in json.load(f).get("readings", [])}
    passed = None
    if os.path.exists(GATE):
        with open(GATE, encoding="utf-8") as f:
            passed = {row["id"] for row in (json.loads(line) for line in f if line.strip()) if row["pass"]}
    drafts, paths = [], {}
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            draft = json.load(f)
        if draft["id"] in downlisted:
            continue
        if passed is not None and draft["id"] not in passed:
            continue
        drafts.append(draft)
        paths[draft["id"]] = path
    return drafts, paths


def fix_explains(drafts, apply):
    """把 explain 里的位置指代换成对应选项原文（幂等）。"""
    changed = []
    for draft in drafts:
        for idx, q in enumerate(draft["questions"], 1):
            if q.get("type") != "choice":
                continue
            explain = q.get("explain") or ""
            refs = [CN_NUM[m.group(1)] for m in POS_REF.finditer(explain)]
            refs += [LETTERS.index(m.group(1)) for m in LETTER_REF.finditer(explain)]
            if not refs:
                continue
            # 位置指代必须指向正确答案项，否则说明本身与答案不一致，交人工处理
            for ref in refs:
                if ref != q["answer"]:
                    raise SystemExit(
                        f"{draft['id']}#{idx} 的 explain 指代第 {LETTERS[ref]} 项，"
                        f"但答案是 {LETTERS[q['answer']]}，需人工核对：{explain}")
            text = q["options"][q["answer"]]
            new = POS_REF.sub(f"「{text}」", explain)
            new = LETTER_REF.sub(f"「{text}」", new)
            if new != explain:
                changed.append((f"{draft['id']}#{idx}", explain, new))
                q["explain"] = new
    return changed


def reorder(drafts, apply):
    swaps = []
    before = Counter()
    after = Counter()
    changed_ids = set()
    for draft in drafts:
        choices = [(i, q) for i, q in enumerate(draft["questions"]) if q.get("type") == "choice"]
        if not choices:
            continue
        page_no = int(draft["id"].split("-")[1])
        offset = page_no % 4
        used = []
        for seq, (_, q) in enumerate(choices):
            before[LETTERS[q["answer"]]] += 1
            target = (offset + seq) % 4
            # 单篇内不出现连续两个相同位置（更不可能三个）
            if used and target == used[-1]:
                target = (target + 1) % 4
            used.append(target)
            old = q["answer"]
            old_text = q["options"][old]
            if old != target:
                q["options"][old], q["options"][target] = q["options"][target], q["options"][old]
                q["answer"] = target
                swaps.append((f"{draft['id']}", old, target, old_text))
                changed_ids.add(draft["id"])
            # 校验：选项集合不变、正确项文字不变、四项非空互异
            assert q["options"][q["answer"]] == old_text, "正确项文字被破坏"
            assert len(q["options"]) == 4 and len(set(q["options"])) == 4
            assert all(str(o).strip() for o in q["options"])
            after[LETTERS[q["answer"]]] += 1
    return swaps, before, after, changed_ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-explain", action="store_true")
    args = ap.parse_args()
    apply = args.apply

    drafts, paths = load()
    explain_changed = [] if args.skip_explain else fix_explains(drafts, apply)
    swaps, before, after, changed_ids = reorder(drafts, apply)
    changed_ids |= {key.split("#")[0] for key, _, _ in explain_changed}

    total = sum(before.values())
    print(f"篇目 {len(drafts)}；选择题 {total}")
    print("重排前位置：", {k: f"{before[k]}({before[k] / total * 100:.1f}%)" for k in LETTERS})
    print("重排后位置：", {k: f"{after[k]}({after[k] / total * 100:.1f}%)" for k in LETTERS})
    print(f"改写答案说明位置指代：{len(explain_changed)} 处；交换选项：{len(swaps)} 题")
    if not apply:
        for key, old, new in explain_changed:
            print("  explain:", key)
        print("（dry-run，未写文件；加 --apply 生效）")
        return

    for draft in drafts:
        if draft["id"] not in changed_ids:
            continue
        with open(paths[draft["id"]], "w", encoding="utf-8") as f:
            json.dump(draft, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"已写回 {len(changed_ids)} 篇（未变化的篇目不重写）")


if __name__ == "__main__":
    main()
