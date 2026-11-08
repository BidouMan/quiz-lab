#!/usr/bin/env python3
"""离线重解析 szxuexiao 缓存页，回填答案对位结果。

只读缓存 work/bulk-20261108/pages/*.html，不重抓网络，不改 passages.jsonl；
结果另存 data/reading-catalog/szxuexiao-20261108/answers-reparsed.jsonl。

用法：python3 reparse_answers.py [--write]
"""

import argparse
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route_probe as rp  # noqa: E402

OUT = os.path.join(rp.ROOT, "data", "reading-catalog", "szxuexiao-20261108")
PAGES = os.path.join(rp.ROOT, "tools", "reading-intake", "work", "bulk-20261108", "pages")
DRAFTS = os.path.join(rp.ROOT, "data", "reading-catalog", "quiz-drafts")


def read_jsonl(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def body_sha(body):
    return hashlib.sha256(re.sub(r"\s+", "", body).encode()).hexdigest()


def draft_source_ids():
    ids = set()
    for fn in os.listdir(DRAFTS) if os.path.isdir(DRAFTS) else []:
        if not (fn.startswith("RD-") and fn.endswith(".json")):
            continue
        d = json.load(open(os.path.join(DRAFTS, fn), encoding="utf-8"))
        if d.get("sourceId"):
            ids.add(d["sourceId"])
    return ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="写出 answers-reparsed.jsonl")
    a = ap.parse_args()

    pools = (read_jsonl(os.path.join(OUT, "passages.jsonl"))
             + read_jsonl(os.path.join(OUT, "passages-intext.jsonl")))
    pools = [r for r in pools if r.get("term") != "3B"]
    dids = draft_source_ids()
    unlifted = {r["id"] for r in pools if r["id"] not in dids}
    by_sha = {r["sha256"]: r for r in pools}

    pages = {}
    for r in pools:
        pages.setdefault(r["pageId"], []).append(r)

    filled = []
    for pid, recs in sorted(pages.items()):
        raw = os.path.join(PAGES, f"{pid}.html")
        if not os.path.exists(raw):
            continue
        html = rp.decode(open(raw, "rb").read())
        title = recs[0].get("pageTitle") or ""
        pieces = rp.extract_pieces(rp.html_to_text(html), title)
        for p in pieces:
            r = by_sha.get(p["sha256"])
            if not r or r["pageId"] != pid:
                continue
            if not p.get("answerText"):
                continue
            if r.get("answerText"):
                continue
            filled.append({
                "id": r["id"], "pageId": pid, "unlifted": r["id"] in unlifted,
                "chars": r.get("chars"), "questions": r.get("questions"),
                "answerScope": p.get("answerScope"),
                "oldScope": r.get("answerScope"),
                "oldAnswerChars": len(r.get("answerText") or ""),
                "answerText": p["answerText"],
            })

    empty_before = [r for r in pools if not (r.get("answerText") or "")]
    unl = [r for r in empty_before if r.get("scope") == "extra-curricular" and r["id"] in unlifted]
    unl_filled = [x for x in filled if x["unlifted"]]
    print(f"三上入池 {len(pools)} 篇（课外+课内，排除三下）")
    print(f"答案原本为空：{len(empty_before)} 篇；其中未出稿 {len([r for r in empty_before if r['id'] in unlifted])} 篇"
          f"（三上课外未出稿 76 篇里空答案 {len(unl)} 篇）")
    print(f"重解析后补回答案：{len(filled)} 篇（其中未出稿 {len(unl_filled)} 篇）")
    if empty_before:
        print(f"空答案补回率：{len(filled) / len(empty_before):.1%}")
    print("仍无答案的三上课外未出稿：",
          sorted(r["id"] for r in unl if r["id"] not in {x["id"] for x in unl_filled}))
    for x in filled:
        head = x["answerText"].replace("\n", " / ")[:60]
        print(f"  +{x['id']} p{x['pageId']} scope={x['answerScope']} "
              f"{x['oldAnswerChars']}->{len(x['answerText'])}字 | {head}")

    if a.write:
        path = os.path.join(OUT, "answers-reparsed.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for x in filled:
                f.write(json.dumps(x, ensure_ascii=False) + "\n")
        print("->", path)


if __name__ == "__main__":
    main()
