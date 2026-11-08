#!/usr/bin/env python3
"""21世纪教育网（www.21cnjy.com）三上课外阅读小批采集。

页面形态：/d-{id}.shtml 为静态详情页，含「内容预览」全文 + 「答案解析部分」，
可直接 curl 取到；列表页 /2/... 被 WAF 的 JS 挑战挡住，因此不做列表遍历，
只按人工/搜索得到的资源 id 串行取页。

准入（用户口径）：
  1) 标题 + 正文可干净解析（去导航/广告/答案尾注）
  2) 正文 >= 250 汉字
  3) 原题与答案可解析；解析不完整时标 needsQuiz=true，交由自命题接手
  去重：精确 sha256 + 20 字汉窗重合率 >= 0.9（对 191 课外 + 60 课内 + 199 命题稿）
  只取「课外阅读」，课内原文不入池；只做三上，标题/正文出现三下特征即拒收。

用法：
  python3 harvest_21cnjy.py run --ids 24851700,23856598 [--batch 20]
  python3 harvest_21cnjy.py report
"""
import argparse
import glob
import hashlib
import json
import os
import re
import sys
from collections import defaultdict, deque
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route_probe as rp  # noqa: E402

ROOT = rp.ROOT
OUT = os.path.join(ROOT, "data", "reading-catalog", "ns21cnjy-20261108")
WORK = os.path.join(ROOT, "tools", "reading-intake", "work", "ns21cnjy-20261108")
DOMAIN = "www.21cnjy.com"
MIN_CHARS = 250
MAX_CHARS = 700
SHINGLE = 20
DUP_RATE = 0.9
HAN = re.compile(r"[\u4e00-\u9fff]")

# 三下/其他年级特征：标题或正文出现即拒收
TERM_BAD = re.compile(r"(三年级下册|三年级下|三下|下册)")
NOISE = re.compile(
    r"(资料详情|需要\s*\d+\s*个学币|版本:?|地区:?|类型:?|文件:|日期:|作者:?|星级:?|"
    r"浏览次数|下载次数|地址:|电话:|版权归|会员上传|"
    r"举报|收藏|分享|相关推荐|热门推荐|上一篇|下一篇|查看完整|下载资源|"
    r"开通VIP|学币|立即下载|点击下载)")

SECTION = re.compile(r"^\s*([一二三四五六七八九十]{1,3})\s*[、.．]\s*(.*)$")
Q_START = re.compile(r"^\s*(\d{1,2})\s*[.、．]\s*(\S.*)$")
ANS_NUM = re.compile(r"^\s*(?:【答案】)?\s*(\d{1,2})\s*[.、．]\s*(.*)$")
TITLE_OK = re.compile(r"^[^。！？；，、：:,.!?;\d]{2,28}$")
DIVIDER = re.compile(
    r"(回答下列|完成练习|完成下面|完成小题|读文章|阅读短文|阅读下文|阅读下面|"
    r"根据短文|按要求完成|阅读并完成)")


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def paths():
    return {
        "passages": os.path.join(OUT, "passages.jsonl"),
        "attempts": os.path.join(OUT, "attempts.jsonl"),
        "rejects": os.path.join(OUT, "rejected.jsonl"),
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


def han(s):
    return "".join(HAN.findall(s))


def sha(text):
    return hashlib.sha256(re.sub(r"\s+", "", text).encode()).hexdigest()


def shingles(text, n=SHINGLE):
    s = han(text)
    return {s[i:i + n] for i in range(max(0, len(s) - n + 1))}


# ---------------------------------------------------------------- 去重语料
def corpus_texts():
    texts = []
    base = os.path.join(ROOT, "data", "reading-catalog", "szxuexiao-20261108")
    for name in ("passages.jsonl", "passages-intext.jsonl"):
        for r in read_jsonl(os.path.join(base, name)):
            if r.get("text"):
                texts.append(r["text"])
    # 本站在之前批次已入池的正文也要进语料，否则跨批次异文会漏判
    for r in read_jsonl(os.path.join(OUT, "passages.jsonl")):
        if r.get("text"):
            texts.append(r["text"])
    for f in glob.glob(os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts", "*.json")):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        body = "".join(d.get("paragraphs", []))
        if body:
            texts.append(body)
    return texts


CORPUS = None


def check_dup(text):
    global CORPUS
    if CORPUS is None:
        CORPUS = [shingles(t) for t in corpus_texts()]
    cand = shingles(text)
    if not cand:
        return 1.0
    best = 0.0
    for other in CORPUS:
        if not other:
            continue
        best = max(best, len(cand & other) / len(cand))
    return best


# ---------------------------------------------------------------- 解析
def load_lines(html):
    lines = [ln.strip() for ln in rp.html_to_text(html).split("\n") if ln.strip()]
    return [ln for ln in lines if not NOISE.match(ln)]


def is_section(ln):
    m = SECTION.match(ln)
    if not m:
        return None
    return m.group(2) or ""


SKIP_HEAD = re.compile(
    r"^(阅读理解|课内阅读|课外阅读|现代文阅读|阅读短文|阅读练习|阅读材料|"
    r"阅读课外短文|阅读完成|短文阅读|读文章|阅读下文|阅读下面|阅读与理解|"
    r"非连续性文本阅读)[，,。.、：:；;\s]*(完成.*)?$")


def is_title(ln, nxt=None):
    if SKIP_HEAD.match(ln):
        return False
    m = re.match(r"^阅读[一二三四五六七八九十]+\s*[、.．]?\s*《?([^》]+)》?", ln)
    if m:
        return True
    if not TITLE_OK.match(ln):
        return False
    if is_section(ln) or Q_START.match(ln) or ANS_NUM.match(ln):
        return False
    if re.match(r"^[A-D][.、．]", ln):
        return False
    if re.search(r"[—→]|\d", ln):
        return False
    # 标题后面紧跟的必须是正文（长行），否则更像题内小标签
    if nxt is not None and (Q_START.match(nxt) or len(han(nxt)) < 8):
        return False
    return len(han(ln)) >= 2 and len(ln) <= 22


def clean_title(ln):
    m = re.match(r"^阅读[一二三四五六七八九十]+\s*[、.．]?\s*《?([^》]+)》?", ln)
    title = m.group(1).strip() if m else ln.strip()
    return re.sub(r"^[(（][一二三四五六七八九十][)）]\s*", "", title)


def parse_answers(lines, start):
    """从「答案解析部分/参考答案」起顺序收集 (题号, 文本)。

    站点有两种编号：整卷连续（1..N）与每篇重置（1..k 重复出现）。按文档顺序
    保留所有条目，后续按题号顺序对位即可兼容两种写法。
    """
    entries, cur = [], None
    for ln in lines[start + 1:]:
        m = ANS_NUM.match(ln)
        if m:
            cur = [int(m.group(1)), [m.group(2)]]
            entries.append(cur)
            continue
        if cur is not None:
            cur[1].append(ln)
    return [(num, "\n".join(v).strip()) for num, v in entries]


def parse_doc(html, rid):
    lines = load_lines(html)
    body_start = next((i for i, ln in enumerate(lines)
                       if ln in ("内容预览", "文档简介")), None)
    ans_start = next((i for i, ln in enumerate(lines)
                      if "答案解析部分" in ln or re.match(r"^参考答案\s*[:：]?$", ln)), len(lines))
    if body_start is None:
        return [], []
    body = lines[body_start + 1:ans_start]
    answers = parse_answers(lines, ans_start)

    # 题号多为整卷连续（1..N），少数每篇重置；统一按连续推进，遇到 1 且已
    # 走过 3 题以上时允许回退到 1（兼容每篇重置的卷子）。
    pieces, cur = [], None
    scope = "extracurricular"
    expected_q, global_last = 1, 0
    for idx, ln in enumerate(body):
        nxt = body[idx + 1] if idx + 1 < len(body) else ""
        sec = is_section(ln)
        if sec is not None:
            if "课内" in sec:
                scope = "in-text"
            elif "课外" in sec or "现代文" in sec:
                scope = "extracurricular"
            continue
        qm = Q_START.match(ln)
        if qm:
            num = int(qm.group(1))
            if cur is None:
                # 无标题的篇目（如整卷开头直接给「阅读短文」）不入池，但题号
                # 要照常推进，否则后面每篇的题号都对不上答案。
                expected_q = num + 1
                global_last = max(global_last, num)
                continue
            if cur is not None and (num == expected_q or
                                    (num == 1 and expected_q > 3)):
                cur["question"].append(ln.lstrip("0123456789.、． "))
                cur["qnums"].append(num)
                cur["state"] = "q"
                expected_q = num + 1
                global_last = num
                continue
        if SKIP_HEAD.match(ln):
            continue
        # 「阅读短文，回答问题。」这类分篇说明行：只关闭当前篇，不新建，
        # 让紧随其后的真标题另起一篇。
        if (cur is not None and cur["state"] == "q" and len(ln) <= 22
                and ("阅读" in ln or DIVIDER.search(ln)) and not Q_START.match(ln)):
            cur = None
            continue
        if is_title(ln, nxt) and (cur is None or cur["state"] == "q"
                                  or len(han("".join(cur["text"]))) >= 60):
            cur = {"title": clean_title(ln), "text": [], "question": [], "qnums": [],
                   "scope": scope, "state": "body"}
            pieces.append(cur)
            expected_q = global_last + 1
            continue
        if cur is None:
            continue
        if cur["state"] == "body":
            cur["text"].append(ln)
        else:
            cur["question"].append(ln)

    out = []
    amap = defaultdict(deque)
    for num, txt in answers:
        amap[num].append(txt)
    for p in pieces:
        text = "\n".join(p["text"]).strip()
        ans = []
        for n in p["qnums"]:
            if amap.get(n):
                ans.append(f"{n}.{amap[n].popleft()}")
        answer_text = "\n".join(ans)
        if p["scope"] == "in-text":
            continue
        if TERM_BAD.search(p["title"]) or TERM_BAD.search(text[:80]):
            continue
        chars = len(han(text))
        qtext = "\n".join(p["question"]).strip()
        out.append({
            "id": f"ns21-{rid}-{len(out) + 1:02d}",
            "source": "21cnjy",
            "domain": DOMAIN,
            "url": f"https://{DOMAIN}/d-{rid}.shtml",
            "docId": rid,
            "title": p["title"],
            "text": text,
            "chars": chars,
            "questionText": qtext,
            "answerText": answer_text,
            "questions": len(p["qnums"]),
            "hasAnswer": bool(answer_text),
            "qTypes": rp.q_types([qtext]) if qtext else [],
            "scope": p["scope"],
            "fetchedAt": now(),
        })
    return out, answers


# ---------------------------------------------------------------- 主流程
def fetch_page(rid, suffix="", force=False):
    os.makedirs(os.path.join(WORK, "pages"), exist_ok=True)
    p = os.path.join(WORK, "pages", f"{rid}{suffix}.html")
    if os.path.exists(p) and not force:
        return 200, open(p, "rb").read(), True
    url = (f"https://{DOMAIN}/d-{rid}.shtml" if not suffix
           else f"https://mip.21cnjy.com/P/{rid}.html")
    st, secs, size = rp.fetch(url, p, timeout=30)
    if st != 200 or size < 5000:
        return st, b"", False
    return st, open(p, "rb").read(), False


def run(ids, force=False):
    os.makedirs(OUT, exist_ok=True)
    existing = {r["docId"] for r in read_jsonl(paths()["attempts"])}
    for rid in ids:
        if rid in existing and not force:
            print(f"skip {rid} 已处理")
            continue
        st, raw, cached = fetch_page(rid)
        if st != 200 or not raw:
            append_jsonl(paths()["attempts"], {"docId": rid, "status": st,
                                               "reason": "页面不可取", "at": now()})
            print(f"! {rid} HTTP {st}")
            continue
        html = rp.decode(raw)
        pieces, answers = parse_doc(html, rid)
        if not pieces:
            # 部分资源详情页只有标题，正文预览在移动版 P 页
            st2, raw2, _ = fetch_page(rid, suffix="-p")
            if st2 == 200 and raw2:
                pieces, answers = parse_doc(rp.decode(raw2), rid)
        kept, rejected = [], []
        for p in pieces:
            if p["chars"] < MIN_CHARS:
                rejected.append({**p, "reason": f"正文 {p['chars']} 字 < {MIN_CHARS}"})
                continue
            if p["chars"] > MAX_CHARS:
                rejected.append({**p, "reason": f"正文 {p['chars']} 字 > {MAX_CHARS}"})
                continue
            if (not p["title"].strip() or re.match(r"^阅读|^非连续性|^短文", p["title"])
                    or "回答问题" in p["title"] or re.search(r"\s", p["title"])
                    or re.search(r"(评分标准|参考答案|作文|习作|题目要求|听力材料)", p["title"])):
                rejected.append({**p, "reason": "无有效标题（板块名/词库/评分页残片）"})
                continue
            rate = check_dup(p["text"])
            if rate >= DUP_RATE:
                rejected.append({**p, "reason": f"与全库重复 {rate:.0%}"})
                continue
            suspect = p["questions"] > 8   # 题数异常多，多半混入了下一篇
            kept.append({**p, "dupRate": round(rate, 3), "qaSuspect": suspect,
                         "needsQuiz": suspect or not (p["questions"] >= 3 and p["hasAnswer"])})
        for r in rejected:
            r["at"] = now()
            append_jsonl(paths()["rejects"], r)
        for k in kept:
            append_jsonl(paths()["passages"], k)
        append_jsonl(paths()["attempts"], {
            "docId": rid, "status": 200, "cached": cached,
            "pieces": len(pieces), "kept": len(kept),
            "rejected": len(rejected), "answerGroups": len(answers), "at": now(),
        })
        print(f"{rid}: 切出 {len(pieces)} 篇，入池 {len(kept)}，淘汰 {len(rejected)}，"
              f"答案组 {len(answers)}", flush=True)


def report():
    ps = read_jsonl(paths()["passages"])
    att = read_jsonl(paths()["attempts"])
    bad = read_jsonl(paths()["rejects"])
    ok = [a for a in att if a.get("status") == 200]
    print(f"资源页 {len(att)}，可取 {len(ok)}，入池 {len(ps)} 篇，淘汰 {len(bad)} 篇")
    for p in ps:
        print(f"  {p['id']} {p['chars']:>3}字 题{p['questions']} "
              f"答{'有' if p['hasAnswer'] else '无'} | {p['title'][:20]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["run", "report"])
    ap.add_argument("--ids", default="")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    if args.cmd == "report":
        report()
        return
    ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    if not ids:
        print("需要 --ids")
        return
    run(ids, force=args.force)


if __name__ == "__main__":
    main()
