#!/usr/bin/env python3
"""路线① szxuexiao 放量：列表页 → 三年级语文正文页 → 带题篇入池。

可断点续跑。每 50 篇入池打一次进度；撞验证码/限流立刻停手，不重试、不绕反爬。

用法：
  python3 bulk_harvest.py init                  # 建目录 + 抓 24 页「三年级上」分类
  python3 bulk_harvest.py run --minutes 8       # 续跑：补列表页 + 抓正文，最多 8 分钟
  python3 bulk_harvest.py report                # 打当前进度
  python3 bulk_harvest.py review                # 抽 20 篇进人工校准稿
  python3 bulk_harvest.py clear-halt            # 解除 halt 标记后继续

入池门槛（用户口径）：
  正文完整可读（非壳页、非引流片段）；
  题目 ≥3 道、题型 ≥2 种；
  有答案的收并标 answerScope（section=能对回本题 / full-paper=卷末全卷答案）；
  无答案也收，标 none；
  只挡 >1500 字巨篇、多篇粘连、课内阅读（教材原文）、正文 <60 字残片。
"""

import argparse
import csv
import hashlib
import json
import os
import random
import re
import sys
import time
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route_probe as rp  # noqa: E402

ROOT = rp.ROOT
OUT = os.path.join(ROOT, "data", "reading-catalog", "szxuexiao-20261108")
WORK = os.path.join(ROOT, "tools", "reading-intake", "work", "bulk-20261108")
CATEGORY = "https://appsj.szxuexiao.com/shannianji_s/index{}.html"
MIXED = "https://www.szxuexiao.com/examination/index{}.html"
CATEGORY_PAGES = 24
MIXED_PAGES = 719
TARGET = 300
REPORT_EVERY = 50

F_TITLE = re.compile(r"<title>(.*?)</title>", re.S)
ANCHOR = re.compile(
    r'<a[^>]+href="(?:https?://appsj\.szxuexiao\.com)?(/html/(\d+)\.html)"[^>]*>'
    r'(?:[^<]*|(.*?)</a>)', re.S)
ANCHOR_TITLE = re.compile(
    r'<a[^>]+href="(?:https?://appsj\.szxuexiao\.com)?/html/(\d+)\.html"[^>]*title="([^"]*)"',
    re.S)
ANSWER_TAIL = re.compile(r"(微信扫码|扫描二维码|声明[:：]|三年级上试卷|其它试卷|"
                         r"小学试卷网|关注公众号|下载APP)")


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def paths():
    return {
        "state": os.path.join(OUT, "state.json"),
        "cand": os.path.join(OUT, "candidates.jsonl"),
        "attempts": os.path.join(OUT, "attempts.jsonl"),
        "passages": os.path.join(OUT, "passages.jsonl"),
        "rejected": os.path.join(OUT, "rejected.jsonl"),
        "bodyonly": os.path.join(OUT, "bodyonly.jsonl"),
        "progress": os.path.join(OUT, "progress.md"),
        "review": os.path.join(OUT, "review-20.md"),
    }


def read_jsonl(path):
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return out


def append_jsonl(path, rec):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def load_state():
    p = paths()["state"]
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    return {
        "category_page": 1, "mixed_page": 1,
        "category_done": False,
        "halt": None, "haltAt": None,
        "accepted": 0, "rejected": {}, "bodyonly": 0,
        "pagesAttempted": 0, "pagesBlocked": 0,
        "candidates": 0, "dupes": 0,
        "lastReportAt": 0, "startedAt": now(),
    }


def save_state(st):
    os.makedirs(OUT, exist_ok=True)
    json.dump(st, open(paths()["state"], "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- 列表页
def semester(title):
    if re.search(r"(下册|下学期|第二学期)", title):
        return "下"
    if re.search(r"(上册|上学期|第一学期)", title):
        return "上"
    return "未知"


def title_ok(title):
    if "三年级" not in title or "语文" not in title:
        return False
    if re.search(r"(数学|英语|科学|道法|道德与法治|美术|音乐|体育|信息技术)", title):
        return False
    if re.search(r"(升四|二升三|三升四)", title):
        return False
    if semester(title) == "下":
        return False
    return True


def parse_items(html):
    items = {}
    for m in ANCHOR_TITLE.finditer(html):
        pid, title = m.group(1), m.group(2).strip()
        if pid not in items:
            items[pid] = title
    for m in ANCHOR.finditer(html):
        pid, inner = m.group(1), m.group(3)
        if pid in items:
            continue
        txt = re.sub(r"<[^>]+>", "", inner or "").strip()
        if txt and "阅读全文" not in txt:
            items[pid] = txt
    return items


def record_candidates(items, list_url, st, seen_ids):
    added = 0
    for pid, title in items.items():
        if pid in seen_ids:
            continue
        if not title_ok(title):
            continue
        seen_ids.add(pid)
        append_jsonl(paths()["cand"], {
            "id": pid, "url": f"https://appsj.szxuexiao.com/html/{pid}.html",
            "title": title, "semester": semester(title),
            "listUrl": list_url, "discoveredAt": now(),
        })
        added += 1
    st["candidates"] += added
    return added


def discover_category(st, max_pages=8, seen_ids=None):
    """抓「三年级上」分类的剩余列表页（目标密度最高）。"""
    got = 0
    while st["category_page"] <= CATEGORY_PAGES and got < max_pages:
        page = st["category_page"]
        url = CATEGORY.format("" if page == 1 else f"_{page}")
        raw = os.path.join(WORK, "list", f"cat-{page}.html")
        status, secs, size = rp.fetch(url, raw)
        if status != 200:
            if status == 404:
                st["category_done"] = True
                st["category_page"] = CATEGORY_PAGES + 1
                print(f"分类页 {page} 404，视为到底")
                break
            st["halt"] = f"分类页 {page} HTTP {status}"
            st["haltAt"] = now()
            save_state(st)
            print(f"! 停手：{st['halt']}")
            return got
        html = rp.decode(open(raw, "rb").read())
        added = record_candidates(parse_items(html), url, st, seen_ids)
        st["category_page"] = page + 1
        got += 1
        print(f"分类页 {page}/{CATEGORY_PAGES} 新增候选 {added}", flush=True)
    if st["category_page"] > CATEGORY_PAGES:
        st["category_done"] = True
    save_state(st)
    return got


def discover_mixed(st, max_pages=8, seen_ids=None):
    """扫全站混排列表页，补分类页覆盖不到的老卷。"""
    got = 0
    while st["mixed_page"] <= MIXED_PAGES and got < max_pages:
        page = st["mixed_page"]
        url = MIXED.format("" if page == 1 else f"_{page}")
        raw = os.path.join(WORK, "list", f"mix-{page}.html")
        status, secs, size = rp.fetch(url, raw)
        if status != 200:
            st["halt"] = f"混排列表页 {page} HTTP {status}"
            st["haltAt"] = now()
            save_state(st)
            print(f"! 停手：{st['halt']}")
            return got
        html = rp.decode(open(raw, "rb").read())
        added = record_candidates(parse_items(html), url, st, seen_ids)
        st["mixed_page"] = page + 1
        got += 1
        if added:
            print(f"混排页 {page} 新增候选 {added}", flush=True)
    save_state(st)
    return got


# ---------------------------------------------------------------- 正文页
def trim_answer(s):
    m = ANSWER_TAIL.search(s)
    if m:
        s = s[:m.start()]
    return s.strip()


def body_sha(body):
    return hashlib.sha256(re.sub(r"\s+", "", body).encode()).hexdigest()


def existing_shas():
    shas = set()
    p = os.path.join(ROOT, "data", "reading-catalog", "link-candidates", "passages.csv")
    if os.path.exists(p):
        with open(p, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("sha256"):
                    shas.add(row["sha256"])
    return shas


def judge(piece, seen_sha, pre_sha):
    """返回 (accept, reason)。reason 为空表示入池。"""
    body = piece["body"]
    sha = body_sha(body)
    if sha in pre_sha:
        return False, "与现有 118 篇重复"
    if sha in seen_sha:
        return False, "批内重复"
    if piece.get("textbook"):
        return False, "课内阅读（教材原文，不可内置）"
    if piece["chars"] > rp.TOO_LONG:
        return False, "超 1500 字巨篇"
    if piece.get("merged"):
        return False, "多篇粘连，切不开"
    if piece.get("boilerplate"):
        return False, "站点导航/假正文"
    if piece["chars"] < 60:
        return False, "正文残片（<60 字）"
    if piece["questions"] < 3:
        return False, f"题量不足（{piece['questions']} 道）"
    if len(piece["qTypes"]) < 2:
        return False, f"题型单一（{'/'.join(piece['qTypes']) or '未识别'}）"
    return True, ""


def harvest_page(c, st, seen_sha, pre_sha, accepted_count):
    """抓一个正文页并落地。返回 (accepted, rejected, bodyonly, blocked)。"""
    pid = c["id"]
    raw = os.path.join(WORK, "pages", f"{pid}.html")
    status, secs, size = rp.fetch(c["url"], raw)
    acc = rej = bo = 0
    rec = {"id": pid, "url": c["url"], "title": c["title"], "status": status,
           "seconds": round(secs, 2), "fetchedAt": now()}
    if status != 200:
        reason = f"HTTP {status}"
        rec.update({"blocked": reason, "accepted": 0, "rejected": 0})
        append_jsonl(paths()["attempts"], rec)
        st["pagesAttempted"] += 1
        st["pagesBlocked"] += 1
        return 0, 0, 0, reason
    html = rp.decode(open(raw, "rb").read())
    blocked = rp.block_reason(status, html)
    if blocked:
        rec.update({"blocked": blocked, "accepted": 0, "rejected": 0})
        append_jsonl(paths()["attempts"], rec)
        st["pagesAttempted"] += 1
        st["pagesBlocked"] += 1
        return 0, 0, 0, blocked
    title = c["title"] or (F_TITLE.findall(html) or [""])[0]
    title = re.split(r"\s[-_|]\s", re.sub(r"<[^>]+>", "", title))[0].strip()
    pieces = rp.extract_pieces(rp.html_to_text(html), title)
    if not pieces:
        rec.update({"blocked": "无阅读板块", "accepted": 0, "rejected": 0})
        append_jsonl(paths()["attempts"], rec)
        st["pagesAttempted"] += 1
        return 0, 0, 0, None

    acc, rej, bo = write_pieces(c, title, pieces, st, seen_sha, pre_sha, accepted_count)
    rec.update({"accepted": acc, "rejected": rej, "pieces": len(pieces),
                "chars": [p["chars"] for p in pieces]})
    append_jsonl(paths()["attempts"], rec)
    st["pagesAttempted"] += 1
    return acc, rej, bo, None


def write_pieces(c, title, pieces, st, seen_sha, pre_sha, accepted_count):
    acc = rej = bo = 0
    pid = c["id"]
    for piece in pieces:
        accept, reason = judge(piece, seen_sha, pre_sha)
        sha = body_sha(piece["body"])
        answer_text = trim_answer(piece["answerText"])
        base = {
            "source": "szxuexiao",
            "url": c["url"],
            "pageTitle": title,
            "pageId": pid,
            "semester": c.get("semester"),
            "listUrl": c.get("listUrl"),
            "chars": piece["chars"],
            "questions": piece["questions"],
            "qTypes": piece["qTypes"],
            "locate": piece["locate"],
            "hasAnswer": bool(answer_text),
            "answerScope": piece["answerScope"],
            "answerMatched": piece["answerScope"] == "section",
            "header": piece["header"],
            "sha256": sha,
            "fetchedAt": now(),
        }
        if accept:
            seen_sha.add(sha)
            accepted_count[0] += 1
            append_jsonl(paths()["passages"], {
                "id": f"szx-{accepted_count[0]:04d}", **base,
                "text": piece["body"], "questionText": piece["questionText"],
                "answerText": answer_text,
            })
            acc += 1
        else:
            if piece["questions"] == 0 and piece["chars"] >= 60:
                append_jsonl(paths()["bodyonly"], {**base, "text": piece["body"]})
                bo += 1
            append_jsonl(paths()["rejected"], {**base, "reason": reason,
                                               "text": piece["body"],
                                               "questionText": piece["questionText"]})
            st["rejected"][reason] = st["rejected"].get(reason, 0) + 1
            rej += 1
    return acc, rej, bo


# ---------------------------------------------------------------- 进度
def build_progress(st):
    p = paths()
    passes = read_jsonl(p["passages"])
    rej = read_jsonl(p["rejected"])
    bodyonly = read_jsonl(p["bodyonly"])
    with_ans = [x for x in passes if x.get("hasAnswer")]
    matched = [x for x in passes if x.get("answerMatched")]
    reasons = Counter(x.get("reason", "?") for x in rej)
    lines = [
        "# szxuexiao 放量进度",
        "",
        f"更新：{now()}　启动：{st.get('startedAt')}",
        "",
        f"- **带题入池：{len(passes)} / {TARGET}**（{len(passes)/TARGET:.1%}）",
        f"- 带答案：{len(with_ans)}（{len(with_ans)/len(passes):.0%} of 入池）"
        if passes else "- 带答案：0",
        f"- 答案能对回本题（section）：{len(matched)}",
        f"- 纯正文暂存（无题）：{len(bodyonly)}",
        f"- 已抓正文页：{st['pagesAttempted']}，其中阻断/无板块：{st['pagesBlocked']}",
        f"- 候选：{st['candidates']}，分类页 {min(st['category_page']-1, CATEGORY_PAGES)}/{CATEGORY_PAGES}，"
        f"混排页 {min(st['mixed_page']-1, MIXED_PAGES)}/{MIXED_PAGES}",
        "",
        "## 筛除原因分布",
        "",
        "| 原因 | 篇数 |",
        "|---|---:|",
    ]
    for k, v in reasons.most_common():
        lines.append(f"| {k} | {v} |")
    if not reasons:
        lines.append("| — | 0 |")
    if st.get("halt"):
        lines += ["", f"**已停手：{st['halt']}（{st.get('haltAt')}）**"]
    md = "\n".join(lines) + "\n"
    os.makedirs(OUT, exist_ok=True)
    open(p["progress"], "w", encoding="utf-8").write(md)
    return md


def maybe_report(st, force=False):
    if force or st["accepted"] - st.get("lastReportAt", 0) >= REPORT_EVERY:
        md = build_progress(st)
        st["lastReportAt"] = st["accepted"]
        save_state(st)
        print("\n" + md, flush=True)


# ---------------------------------------------------------------- 人工校准样本
def make_review(n=20):
    passes = read_jsonl(paths()["passages"])
    if len(passes) < n:
        print(f"入池只有 {len(passes)} 篇，先跑够 {n} 篇再抽样")
        return None
    rnd = random.Random(42)
    sample = rnd.sample(passes, n)
    sample.sort(key=lambda x: x["chars"])
    lines = [
        "# 人工校准样本（20 篇）",
        "",
        f"生成：{now()}　从 {len(passes)} 篇入池里随机抽 {n} 篇，按字数升序。",
        "看什么：① 正文是否完整成篇；② 题目是否真的 ≥3 道且题型不一；"
        "③ 答案是否对得上本题；④ 有没有把课内原文/多篇粘连放进来。",
        "结论请直接改动本文件末尾「校准结论」一节。",
        "",
        "| # | id | 字数 | 题量 | 题型 | 答案 | 答案对位 |",
        "|---:|---|---:|---:|---|---|---|",
    ]
    for i, x in enumerate(sample, 1):
        lines.append(f"| {i} | {x['id']} | {x['chars']} | {x['questions']} | "
                     f"{'/'.join(x['qTypes'])} | {'有' if x['hasAnswer'] else '无'} | "
                     f"{x['answerScope']} |")
    for i, x in enumerate(sample, 1):
        lines += ["", f"## {i}. {x['id']}（{x['chars']} 字，{x['questions']} 题）", "",
                  f"来源：{x['url']}", "", "**正文**", "", x["text"], "",
                  "**题目**", "", x["questionText"] or "（无）", "",
                  f"**答案**（{x['answerScope']}）", "",
                  (x["answerText"][:400] + ("…" if len(x["answerText"]) > 400 else ""))
                  if x["answerText"] else "（无答案）"]
    lines += ["", "## 校准结论", "",
              "- 判定阈值是否需要调整：", "- 需要返修的篇目 id：", ""]
    open(paths()["review"], "w", encoding="utf-8").write("\n".join(lines))
    print(f"-> {paths()['review']}")
    return paths()["review"]


# ---------------------------------------------------------------- 主流程
def init_cmd():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    st = load_state()
    seen = load_seen_ids()
    discover_category(st, max_pages=CATEGORY_PAGES, seen_ids=seen)
    save_state(st)
    print(f"候选文件 -> {paths()['cand']}")


def load_seen_ids():
    ids = {c["id"] for c in read_jsonl(paths()["cand"])}
    ids |= {c["id"] for c in read_jsonl(paths()["attempts"])}
    return ids


def run_cmd(minutes):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    st = load_state()
    if st.get("halt"):
        print(f"已停手：{st['halt']}（{st.get('haltAt')}）。处理后再跑，或 clear-halt。")
        return
    pre_sha = existing_shas()
    seen_sha = {x["sha256"] for x in read_jsonl(paths()["passages"])}
    st["accepted"] = len(read_jsonl(paths()["passages"]))  # 以文件为准，防中断后计数漂移
    accepted = [st["accepted"]]
    seen_ids = load_seen_ids()
    t0 = time.time()
    deadline = t0 + minutes * 60
    total_pages = 0

    def drain():
        pending = [c for c in read_jsonl(paths()["cand"]) if c["id"] not in
                   {a["id"] for a in read_jsonl(paths()["attempts"])}]
        nonlocal total_pages
        for c in pending:
            if time.time() > deadline:
                print(f"到时间上限（{minutes} 分钟），本次停。", flush=True)
                return False
            acc, rej, bo, blocked = harvest_page(c, st, seen_sha, pre_sha, accepted)
            total_pages += 1
            if blocked and ("验证码" in blocked or "限流" in blocked or "拒绝" in blocked):
                st["halt"] = blocked
                st["haltAt"] = now()
                save_state(st)
                print(f"\n! 撞墙停手：{blocked}  {c['url']}", flush=True)
                return False
            if acc or rej:
                print(f"[{accepted[0]} 入池] {c['id']} +{acc}/-{rej}  {c['title'][:40]}",
                      flush=True)
            elif blocked:
                print(f"[跳过] {c['id']} {blocked}", flush=True)
            maybe_report(st)
        return True

    if not drain():
        maybe_report(st, force=True)
        return
    # 队列清空后再补列表页；分批，避免一次扫太多
    while time.time() < deadline:
        if not st.get("category_done"):
            got = discover_category(st, max_pages=4, seen_ids=seen_ids)
        else:
            got = discover_mixed(st, max_pages=12, seen_ids=seen_ids)
        if st.get("halt"):
            print(f"! 停手：{st['halt']}")
            break
        if got == 0:
            break
        if not drain():
            break
    maybe_report(st, force=True)
    print(f"本次共抓正文页 {total_pages}，用时 {time.time()-t0:.0f}s")
    if accepted[0] >= 20:
        make_review()


def reclassify_cmd():
    """用已落盘的原始 HTML 重跑判定（改了启发式，不用重新联网）。"""
    st = load_state()
    for key in ("passages", "rejected", "bodyonly", "attempts"):
        open(paths()[key], "w", encoding="utf-8").close()
    st.update({"accepted": 0, "rejected": {}, "bodyonly": 0,
               "pagesAttempted": 0, "pagesBlocked": 0, "lastReportAt": 0})
    pre_sha = existing_shas()
    seen_sha = set()
    accepted = [0]
    cands = read_jsonl(paths()["cand"])
    for c in cands:
        raw = os.path.join(WORK, "pages", f"{c['id']}.html")
        if not os.path.exists(raw):
            continue
        html = rp.decode(open(raw, "rb").read())
        if rp.block_reason(200, html):
            st["pagesBlocked"] += 1
            continue
        pieces = rp.extract_pieces(rp.html_to_text(html), c["title"])
        if not pieces:
            continue
        acc, rej, bo = write_pieces(c, c["title"], pieces, st, seen_sha, pre_sha, accepted)
        append_jsonl(paths()["attempts"], {
            "id": c["id"], "url": c["url"], "title": c["title"], "status": 200,
            "accepted": acc, "rejected": rej, "pieces": len(pieces),
            "chars": [p["chars"] for p in pieces], "fetchedAt": now()})
        st["pagesAttempted"] += 1
    st["accepted"] = len(read_jsonl(paths()["passages"]))
    save_state(st)
    print(build_progress(st))


def clear_halt():
    st = load_state()
    st["halt"] = None
    st["haltAt"] = None
    save_state(st)
    print("halt 已清除")


def report_cmd():
    st = load_state()
    print(build_progress(st))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init")
    r = sub.add_parser("run")
    r.add_argument("--minutes", type=float, default=8)
    sub.add_parser("report")
    sub.add_parser("review")
    sub.add_parser("reclassify")
    sub.add_parser("clear-halt")
    a = ap.parse_args()
    if a.cmd == "init":
        init_cmd()
    elif a.cmd == "run":
        run_cmd(a.minutes)
    elif a.cmd == "report":
        report_cmd()
    elif a.cmd == "review":
        make_review()
    elif a.cmd == "reclassify":
        reclassify_cmd()
    else:
        clear_halt()


if __name__ == "__main__":
    main()
