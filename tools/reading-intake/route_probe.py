#!/usr/bin/env python3
"""四条素材路线小样试跑（限速、撞墙即停，不绕反爬）。

路线：
  r1 教育站点转载/试卷全文页（szxuexiao、21cnjy、zxxk）
  r2 公开试卷 PDF（本地已存的北京西城期末卷；图片型走 Vision OCR）
  r3 公版/现代寓言与儿童文学（chinafable、Gutenberg）
  r4 课本配套读物与同步阅读书目（只取正文）

用法：
  python3 route_probe.py discover --route r1
  python3 route_probe.py run --route r1 --limit 20
  python3 route_probe.py report

口径（字数已放宽，只挡明显不合理的）：
  入池下限 60 汉字（低于此多为导航残渣，不是文章）；
  >1500 汉字标 tooLong，单列不入池（巨篇后期再切）；
  一篇里出现 ≥2 个篇目标记的标 merged（多篇粘成一块，切不开）；
  带题篇 = 正文后面跟着题目（题量≥2）；
  带题合格 = 题量≥3、题型≥2、且有定位词或答案（启发式，不是人工判定）；
  纯正文篇 = 无题目且 ≥150 汉字，作为“题量不足篇目”的配对补充。
  成本：machineSeconds 为实测网络+抽取+OCR 秒数；humanMinutes 是估算（沿用
  2026-11-07 试跑实测的校对工时），报告里会标注为估算。
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROBE = os.path.join(ROOT, "data", "reading-catalog", "probe-20261108")
WORK = os.path.join(ROOT, "tools", "reading-intake", "work", "probe-20261108")
RATE_PER_HOST = 1.8          # 秒；同域请求间隔
HOST_LAST = {}


# ---------------------------------------------------------------- 抓取
def _throttle(host):
    last = HOST_LAST.get(host)
    if last is not None:
        wait = RATE_PER_HOST - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
    HOST_LAST[host] = time.time()


def fetch(url, out_path, referer=None, timeout=30):
    """curl 取一个 URL，返回 (status, secs, byte_len)。"""
    host = re.sub(r"^https?://", "", url).split("/")[0]
    _throttle(host)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = ["curl", "-sL", "--compressed", "--max-time", str(timeout),
           "-A", UA, "-o", out_path, "-w", "%{http_code} %{time_total} %{size_download}"]
    if referer:
        cmd += ["-e", referer]
    cmd.append(url)
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    secs = time.time() - t0
    parts = (r.stdout or "").split()
    status = int(parts[0]) if parts and parts[0].isdigit() else 0
    size = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
    return status, secs, size


def decode(raw):
    for enc in ("utf-8", "gb18030", "big5"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", "ignore")


# ---------------------------------------------------------------- HTML → 文本
BLOCK_TAGS = re.compile(r"</?(?:p|div|br|li|ul|ol|tr|td|h[1-6]|section|article|table|"
                        r"header|footer|nav|main|dd|dt|blockquote)\b[^>]*>", re.I)
NOISE_LINE = re.compile(
    r"(登录|注册|扫码|二维码|微信|公众号|客户端|APP|下载|附件|网盘|广告|版权|"
    r"免责声明|ICP|备案|Copyright|相关推荐|热门推荐|上一篇|下一篇|返回顶部|"
    r"设为首页|加入收藏|分享到|点赞|在看|评论区|验证码|请先登录|开通会员|付费|"
    r"站内搜索|当前位置|网站首页|联系电话|投稿邮箱)")
HARD_NOISE = re.compile(r"(站内搜索|当前位置|网站首页|版权所有|技术支持)")
# 只有题号的答案行（"1.C"、"2.3421"、"（3）"），汉字数常为 0–3，需保留
ANSWER_NUM_LINE = re.compile(
    r"^\s*(?:[（(]\s*\d{1,3}\s*[)）]|\d{1,3}\s*[.、．:：]"
    r"|[一二三四五六七八九十]{1,3}\s*[、.．])")


def html_to_text(html):
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    html = re.sub(r"<(script|style|noscript|svg|iframe)\b.*?</\1>", " ", html,
                  flags=re.S | re.I)
    # 导航/列表链接文字整段丢弃，避免把菜单当正文
    html = re.sub(r"<a\b[^>]*>.*?</a>", " ", html, flags=re.S | re.I)
    html = BLOCK_TAGS.sub("\n", html)
    html = re.sub(r"<[^>]+>", "", html)
    html = (html.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
                .replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'"))
    html = re.sub(r"&[a-zA-Z#0-9]{1,8};", "", html)
    lines = []
    for ln in html.split("\n"):
        ln = unicodedata.normalize("NFKC", ln)
        ln = re.sub(r"[ \t\u3000]+", " ", ln).strip()
        if not ln:
            continue
        han = len(re.findall(r"[\u4e00-\u9fff]", ln))
        if han < 4 and not ANSWER_NUM_LINE.match(ln):
            # 答案块里 "1.C"、"2.3421"、"4." 这类行汉字很少甚至没有，
            # 早期按汉字数一刀切会把答案题号丢掉，导致后续无法对位。
            continue
        if han < 20 and NOISE_LINE.search(ln):
            continue
        if HARD_NOISE.search(ln) and len(ln) < 120:
            continue
        lines.append(ln)
    return "\n".join(lines)


# ---------------------------------------------------------------- 正文切分
Q_START = re.compile(r"^\s*(?:[（(]\s*)?(\d{1,2})\s*[)）]?\s*[.、．:：]\s*\S")
SECTION_START = re.compile(r"^\s*[一二三四五六七八九十]{1,3}\s*[、.．]")
READ_HEADER = re.compile(r"(阅读理解|阅读短文|阅读[^。\n]{0,6}短文|阅读下面|开心阅读|"
                         r"课外阅读|课内阅读|阅读材料|阅读《|阅读[（(][一二三四][)）]|"
                         r"阅读[一二三四][、.]|短文阅读|阅读练习|阅读天地|"
                         r"阅读[^。\n]{0,4}篇短文)")
SUB_HEADER = re.compile(r"^\s*[（(]\s*[一二三四]\s*[)）]")
TITLE_LINE = re.compile(r"《[^》]{2,25}》")
# 独立成行的文章标题（《…》一行，最多带个“节选/选段”后缀），用来判多篇粘连
TITLE_LINE_STANDALONE = re.compile(r"^\s*《[^》]{2,25}》\s*[（(]?[选节摘][）)]?\s*$")


def is_passage_header(ln):
    if len(ln) > 60:
        return False
    if READ_HEADER.search(ln):
        return True
    # “六、阅读材料，完成练习。”这类大题头
    if SECTION_START.match(ln) and "阅读" in ln:
        return True
    if SUB_HEADER.match(ln) and len(ln) <= 20 and not is_question_line(ln):
        return True
    return False


def is_question_line(ln):
    if Q_START.match(ln):
        return True
    if re.match(r"^\s*[（(]\s*\d{1,2}\s*[)）]", ln) and len(ln) < 60:
        return True
    if re.match(r"^\s*(选择题|填空题|判断题|简答题|问答题)", ln):
        return True
    return False


def q_types(block):
    types = set()
    text = "\n".join(block)
    if re.search(r"[ABCD][.、．]", text) or re.search(r"[ABCD]\s*[.、．]?\s*[^\n]{2,}", text):
        types.add("choice")
    if re.search(r"(判断|画“?√”?|打“?√”?|对的画|错的画|画“?×”?)", text):
        types.add("judge")
    if re.search(r"(_{2,}|＿{2,}|（\s*）|\(\s*\)|补充完整|填写|填入|填在|填一填|"
                 r"、\s*、\s*、)", text):
        types.add("fill")
    if re.search(r"(为什么|说说|写出|写一写|想一想|你认为|体会|感受|情感|道理|"
                 r"概括|解释|意思|表达|怎样|哪些|哪个|有何|发挥想象|想象|"
                 r"写两句|写一句|写几句话|想什么|做什么|说什么|会想|会说|会做|"
                 r"画出|用“\s*”画)", text):
        types.add("short")
    return sorted(types)


ANSWER_HEAD = re.compile(r"^\s*(参考答案|答案与解析|答案|解析)\s*[:：]?\s*$")
# 站点常把答案标题写成「…期末测试卷答案」「…参考答案」等整行标题
ANSWER_HEAD_WIDE = re.compile(r"^\s*[^。\n]{1,30}?(?:参考答案|答案与解析|答案)\s*[:：]?\s*$")
ANSWER_HEAD_NOISE = re.compile(r"(试卷|试题|真题|下载)")
SECTION_KEY = re.compile(r"^\s*([一二三四五六七八九十]{1,3})\s*[、.．]")
CN_NUM = "一二三四五六七八九十"
TOP_NUM = re.compile(
    r"^\s*(?:(?P<ar>\d{1,3})\s*[.、．]\s*|(?P<cn>[一二三四五六七八九十]{1,3})\s*[、.．]\s*)")
SUB_NUM = re.compile(r"^\s*[（(]\s*(\d{1,2})\s*[)）]")


def is_answer_head(line):
    if ANSWER_HEAD.match(line):
        return True
    return bool(len(line) <= 34 and ANSWER_HEAD_WIDE.match(line)
                and not ANSWER_HEAD_NOISE.search(line))


def cn_to_int(s):
    if not s or s[0] not in CN_NUM:
        return None
    if len(s) == 1:
        return CN_NUM.index(s) + 1
    if s[0] == "十":
        return 10 + (CN_NUM.index(s[1]) + 1 if s[1] in CN_NUM else 0)
    if len(s) >= 2 and s[1] == "十":
        return CN_NUM.index(s[0]) + 1
    return None


def line_num(line):
    """行首大题号：阿拉伯数字或中文数字，统一成整数。"""
    m = TOP_NUM.match(line)
    if not m:
        return None
    return int(m.group("ar")) if m.group("ar") else cn_to_int(m.group("cn"))


def header_num(header):
    return line_num(header) if header else None


def section_key(line):
    m = SECTION_KEY.match(line)
    return m.group(1) if m else None


def answer_groups(lines):
    """按大题号把答案块分组：{大题号(int): 答案文本}。

    原实现只认「一、二、」中文小节，阿拉伯编号（本批试卷答案的主流写法）全部
    落到同一个 "_" 组，等于没分组；这里把两种编号统一成整数，按首次出现归组。
    """
    start = next((i for i, ln in enumerate(lines) if is_answer_head(ln)), None)
    if start is None:
        return {}
    groups, cur = {}, None
    for ln in lines[start + 1:]:
        k = line_num(ln)
        if k is not None:
            cur = k
            groups.setdefault(cur, [])
        if cur is not None:
            groups[cur].append(ln)
    return {k: "\n".join(v) for k, v in groups.items()}


def split_subsections(text):
    """把一个大题的答案按 (一)(二) 子篇拆开，返回 [(序号, 文本)]。"""
    parts = re.split(r"[（(]\s*([一二三四五六七八九十])\s*[)）]", text)
    if len(parts) < 3:
        return []
    out = []
    for i in range(1, len(parts) - 1, 2):
        out.append((cn_to_int(parts[i]), parts[i + 1]))
    return out


def take_sub_items(text, n):
    """取答案段前 n 个子题的答案（"（1）…（2）…"）。子题不足则返回 None。"""
    body = TOP_NUM.sub("", text, count=1)
    items, cur = [], None
    for ln in body.split("\n"):
        if SUB_NUM.match(ln):
            if cur is not None:
                items.append(cur)
            cur = [ln]
        elif cur is not None:
            cur.append(ln)
    if cur is not None:
        items.append(cur)
    if not items:
        return text.strip() if n <= 1 and text.strip() else None
    if len(items) < n:
        return None
    return "\n".join("\n".join(x) for x in items[:n])


def split_pieces(lines, allow_whole_page=False):
    """把页面文本切成 (正文, 其题目块, 段头)。只保留“阅读”板块。"""
    marks = [i for i, ln in enumerate(lines) if is_passage_header(ln)]
    # 相邻的板块头（“九、开心阅读” + “（一）课内阅读”）合并成一个起点
    merged_marks = []
    for i in marks:
        if merged_marks and i - merged_marks[-1] <= 2:
            continue
        merged_marks.append(i)
    if not merged_marks:
        # 纯文学作品页没有“阅读”板块头，整页当一篇
        return [("".join(lines), [], "", 0)] if allow_whole_page else []
    pieces = []
    for k, start in enumerate(merged_marks):
        end = merged_marks[k + 1] if k + 1 < len(merged_marks) else len(lines)
        header = lines[start]
        body, qs = [], []
        state = "body"
        for ln in lines[start + 1:end]:
            if state == "body" and is_question_line(ln):
                state = "q"
            if state == "q" and (is_answer_head(ln) or
                                 (SECTION_START.match(ln) and not Q_START.match(ln))):
                break          # 本题题目到此为止，后面是别的大题/全卷答案
            (qs if state == "q" else body).append(ln)
        title_hint = len([ln for ln in body if TITLE_LINE_STANDALONE.match(ln)])
        pieces.append(("".join(body), qs, header, title_hint))
    return pieces


def split_unanchored(lines):
    """没有“阅读”板块头时，按问句块倒推正文（用于《阅读理解》专项这类页面）。"""
    cut = next((i for i, ln in enumerate(lines) if is_answer_head(ln)), len(lines))
    body_lines = lines[:cut]
    q = [i for i, ln in enumerate(body_lines) if is_question_line(ln)]
    if not q:
        return []
    blocks, cur = [], [q[0]]
    for i in q[1:]:
        if i - cur[-1] <= 3:
            cur.append(i)
        else:
            blocks.append((cur[0], cur[-1]))
            cur = [i]
    blocks.append((cur[0], cur[-1]))
    pieces, prev_end = [], -1
    for b, e in blocks:
        raw_body, body = body_lines[prev_end + 1:b], []
        for ln in raw_body:
            if is_question_line(ln) or re.match(r"^\s*[A-E][、.．]", ln):
                break
            body.append(ln)
        text = "".join(body)
        # 倒推出来的正文必须像一段成篇文字：够长、有句读、不是选项/导航
        if char_count(text) >= 150 and len(re.findall(r"[。！？!?…]", text)) >= 3:
            pieces.append((text, body_lines[b:e + 1], (body[0][:40] if body else ""), 0))
        prev_end = e
    return pieces


def char_count(s):
    return len(re.findall(r"[\u4e00-\u9fff]", s))


POOL_MIN = 60
TOO_LONG = 1500


def analyse_piece(body, qs, ans=(), header="", title_hint=0):
    chars = char_count(body)
    n_all = len([1 for ln in qs if is_question_line(ln)])
    n_top = len([1 for ln in qs if re.match(r"^\s*\d{1,2}\s*[.、．]", ln)])
    n_q = n_top if n_top >= 2 else n_all   # 小题 (1)(2) 不重复计入大题数
    types = q_types(qs)
    locate = bool(re.search(r"(文中|第[一二三四五六七八]段|画线|波浪线|横线|"
                            r"短文中|从文中)", "\n".join(list(body[-200:].split("\n"))[-2:] + list(qs))))
    has_answer = len(list(ans)) > 0 or bool(re.search(r"(参考答案|答案|解析)", "\n".join(qs)))
    sent = len(re.findall(r"[。！？!?…]", body))
    body_ok = chars >= 150 and sent >= 3
    merged = title_hint >= 2 or len(SUB_HEADER.findall(body)) >= 2
    nav = len(re.findall(r"(登录|注册|版权|声明|权利|筛选|加载更多|网站|首页|版本|"
                         r"联系我们|投稿|教材版本|共找到)", body))
    boilerplate = sent < 2 or (nav >= 4 and chars < 600)
    return {
        "chars": chars,
        "questions": n_q,
        "qTypes": types,
        "locate": locate,
        "hasAnswer": has_answer,
        "bodyOk": body_ok,
        "tooLong": chars > TOO_LONG,
        "merged": merged,
        "boilerplate": boilerplate,
        "textbook": "课内" in header or "课内" in body[:30],
        "header": header[:40],
        "withQuestions": n_q >= 2,
        "questionsQualified": n_q >= 3 and len(types) >= 2 and (locate or has_answer),
        "sha256": hashlib.sha256(re.sub(r"\s+", "", body).encode()).hexdigest(),
    }


def extract_pieces(text, page_title="", min_chars=POOL_MIN, allow_whole_page=False):
    lines = [ln for ln in text.split("\n") if ln]
    if page_title:
        key = re.sub(r"\s+", "", page_title)[:12]
        lines = [ln for ln in lines if key not in re.sub(r"\s+", "", ln) or len(ln) > 80]
    out = []
    groups = answer_groups(lines)
    pieces = split_pieces(lines, allow_whole_page)
    if not pieces and not allow_whole_page:
        pieces = split_unanchored(lines)   # 无板块头时按问句块倒推，宁收不漏
    # 同一大题号下可能挂着多篇短文（(一)(二)），先按出现顺序登记
    keys = [header_num(h) for (_, _, h, _) in pieces]
    answers = assign_answers(pieces, groups, keys)
    for (body, qs, header, title_hint), (ans, scope) in zip(pieces, answers):
        # 去掉“标题 - 站名标题”这种页头重复
        body = re.sub(r"^(?P<t>[\u4e00-\u9fff][\u4e00-\u9fff：“”‘’《》、·\w]{4,40}?)\s*[-–]\s*"
                      r"[\u4e00-\u9fff]{2,20}(?P=t)", "", body)
        info = analyse_piece(body, qs, [ans] if ans else [], header, title_hint)
        info["answerScope"] = scope
        info["questionText"] = "\n".join(qs)
        info["answerText"] = ans
        info["answerMatched"] = bool(ans)
        if info["chars"] >= min_chars and info["questions"] <= 60:
            out.append({"body": body.strip(), **info})
    return out


def assign_answers(pieces, groups, keys):
    """给每篇短文配答案：按大题号取该大题的答案，再按子题号截取。

    约定：
      - 题头带大题号且答案块有同号大题 → 取该大题；
      - 该大题答案里含 (一)(二) 子篇，且相邻多篇共用同一大题号 → 按顺序分给孩子篇；
      - 取不到或子题数量不够 → 留空（answerScope=none），绝不把整卷答案塞给单篇。
    """
    ans = [("", "none")] * len(pieces)
    i = 0
    while i < len(pieces):
        k = keys[i]
        if k is None or k not in groups:
            i += 1
            continue
        # 本篇及紧随其后的无编号篇，视为同一大题下的连续短文
        j = i + 1
        while j < len(pieces) and keys[j] in (None, k):
            j += 1
        span = j - i
        seg = groups[k]
        subs = split_subsections(seg)
        if subs and len(subs) >= 2:
            for r in range(span):
                if r >= len(subs):
                    break
                n = pieces[i + r][1]
                n = len([1 for ln in n if is_question_line(ln)]) if n else 1
                txt = take_sub_items(subs[r][1], max(n, 1)) or subs[r][1].strip()
                ans[i + r] = (txt, "subsection")
            i = j
            continue
        n = pieces[i][1]
        n = len([1 for ln in n if is_question_line(ln)]) if n else 1
        txt = take_sub_items(seg, max(n, 1))
        ans[i] = (txt or "", "by-number" if txt else "none")
        i += 1
    # 只有题号、没有实际内容的答案段（"五、""8、"）一律视为没取到
    return [(t, s) if answer_content(t) else ("", "none") for t, s in ans]


def answer_content(text):
    """答案是否真有内容：去掉题号/标点后至少 10 个字。"""
    if not text:
        return False
    core = re.sub(r"[（(]?\s*\d{1,3}\s*[)）.、．:：]?", "", text)
    core = re.sub(r"[\s,，。;；:：、．.！!？?“”‘’\"'《》—\-]+", "", core)
    return len(core) >= 10


# ---------------------------------------------------------------- PDF
def pdf_pieces(pdf_path, work_dir):
    """返回 (pieces, meta)。有文字层直接抽；图片型走 intake.py 的 Vision 流程。"""
    import pymupdf
    t0 = time.time()
    doc = pymupdf.open(pdf_path)
    layer = "\n".join(p.get_text("text") for p in doc)
    layer_han = char_count(layer)
    meta = {"pages": len(doc), "textLayerChars": layer_han}
    if layer_han >= 200:
        meta["extractor"] = "text-layer"
        meta["ocrSeconds"] = 0.0
        return extract_pieces(layer), meta
    doc.close()
    os.makedirs(work_dir, exist_ok=True)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "intake.py"),
                    "batch", pdf_path, "--work", work_dir, "--dpi", "300"],
                   capture_output=True, text=True)
    clean_dir = os.path.join(work_dir, "clean")
    text = ""
    if os.path.isdir(clean_dir):
        for name in sorted(os.listdir(clean_dir)):
            if name.endswith(".txt"):
                text += open(os.path.join(clean_dir, name), encoding="utf-8").read() + "\n"
    meta["extractor"] = "vision-ocr"
    meta["ocrSeconds"] = round(time.time() - t0, 2)
    # OCR 会把教材注音一起识别出来（如“鸣（mu）鸣”），去掉拉丁字母注音括号，
    # 只影响排版噪声，不删除汉字
    text = re.sub(r"[（(]\s*[a-zA-Z0-9üÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]{1,6}\s*[)）]", "", text)
    meta["stripPinyin"] = True
    return extract_pieces(text), meta


# ---------------------------------------------------------------- 阻断判定
BLOCK_PAT = [
    (r"(antispider|访问过于频繁|请输入验证码|人机验证|安全验证|滑动验证)", "验证码/反爬"),
    (r"(请先登录|登录后查看|登录后下载|会员专享|开通VIP|付费下载|购买后可见)", "登录墙/付费墙"),
    (r"(该资源已下架|页面不存在|404 Not Found)", "资源不存在"),
]


def block_reason(status, html):
    if status == 0:
        return "连接失败/超时"
    if status in (301, 302) and len(html) < 2000:
        return "跳转拦截"
    if status in (401, 402, 403, 405, 429):
        return f"HTTP {status}（拒绝/限流）"
    body = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", body)
    if len(text.strip()) < 300:
        return "页面正文为空（疑似壳页/JS 渲染）"
    for pat, label in BLOCK_PAT:
        if re.search(pat, text):
            return label
    return None


# ---------------------------------------------------------------- 路线
def discover(route):
    cands = []
    if route == "r1":
        # szxuexiao 试卷列表（公开列表页，逐页限速）
        base = "https://www.szxuexiao.com/examination/"
        listing = {}
        for page in range(1, 13):
            url = base if page == 1 else f"https://www.szxuexiao.com/examination/index_{page}.html"
            out = os.path.join(WORK, "list", f"exam-{page}.html")
            st, secs, size = fetch(url, out)
            listing[url] = {"status": st, "secs": round(secs, 2), "bytes": size}
            if st != 200:
                break
            html = decode(open(out, "rb").read())
            for u, t in re.findall(r'href="(https://appsj\.szxuexiao\.com/html/\d+\.html)"[^>]*>([^<]{4,80})</a>', html):
                if "三年级" in t and "语文" in t and not re.search(r"(数学|英语|道法|科学)", t):
                    if u not in [c["url"] for c in cands]:
                        cands.append({"url": u, "title": t.strip(), "source": "szxuexiao"})
            time.sleep(0.3)
            if len(cands) >= 18:
                break
        # 学科网：正文页（预期被反爬挡住，留 2 条验证）
        for u in ("https://www.zxxk.com/soft/56057164.html",
                  "https://www.zxxk.com/soft/56043016.html"):
            cands.append({"url": u, "title": "学科网三上期末卷正文页", "source": "zxxk"})
        # 21世纪教育网：教材版本栏目（找可直连的资源页）
        cands.append({"url": "https://www.21cnjy.com/2/141760/", "title": "21cnjy 统编版教材栏目",
                      "source": "21cnjy"})
        cands.append({"url": "https://zujuan.21cnjy.com/", "title": "21cnjy 组卷首页",
                      "source": "21cnjy"})
    elif route == "r2":
        # 本地已存的真实三上期末卷（此前从 cdn.xschu.com 下载，直链未保留）
        cands = [
            {"url": os.path.join(ROOT, "tools/reading-intake/samples/xicheng-2025-2026.pdf"),
             "title": "北京西城 2025-2026 三上期末（PDF，图片型）", "source": "local-pdf"},
            {"url": os.path.join(ROOT, "tools/reading-intake/samples/xicheng-2024-2025.pdf"),
             "title": "北京西城 2024-2025 三上期末（PDF，图片型）", "source": "local-pdf"},
        ]
    elif route == "r3":
        base = "http://www.chinafable.cn/"
        seen = set()
        for page in range(1, 4):
            url = f"http://www.chinafable.cn/search-1-0-0-{page}.html"
            out = os.path.join(WORK, "list", f"fable-{page}.html")
            st, secs, size = fetch(url, out)
            if st != 200:
                break
            html = decode(open(out, "rb").read())
            for u, t in re.findall(r'href="[\./]*(content-\d+\.html)"[^>]*>([^<]{4,60})</a>', html):
                full = "http://www.chinafable.cn/" + u.lstrip("./")
                if full in seen:
                    continue
                seen.add(full)
                cands.append({"url": full, "title": t.strip(), "source": "chinafable"})
            if len(cands) >= 14:
                break
        # Project Gutenberg 中文书（公版，语言多为文言/旧白话，作对照）
        for eid in ("23950", "25328"):
            cands.append({"url": f"https://www.gutenberg.org/cache/epub/{eid}/pg{eid}.txt",
                          "title": f"Gutenberg #{eid} 中文公版书", "source": "gutenberg"})
    elif route == "r4":
        cands = [
            {"url": "https://basic.smartedu.cn/", "title": "国家中小学智慧教育平台（电子教材）", "source": "smartedu"},
            {"url": "https://www.pep.com.cn/products/", "title": "人教社 产品/样章", "source": "pep"},
            {"url": "https://keben.szxuexiao.com/", "title": "szxuexiao 电子课本", "source": "keben"},
            {"url": "https://book.douban.com/subject/1805363/", "title": "豆瓣读书《稻草人》条目", "source": "douban"},
            {"url": "https://weread.qq.com/web/search/books?keyword=%E7%A8%BB%E8%8D%89%E4%BA%BA", "title": "微信读书 稻草人 搜索页", "source": "weread"},
            {"url": "https://www.qidian.com/search?kw=%E5%B0%8F%E5%B7%B4%E6%8E%8C%E7%AB%A5%E8%AF%9D", "title": "起点 小巴掌童话 搜索页", "source": "qidian"},
            {"url": "https://www.zxxk.com/soft/59411636.html", "title": "学科网 快乐读书吧 资料页", "source": "zxxk"},
            {"url": "https://www.21cnjy.com/2/141760/", "title": "21cnjy 统编版栏目", "source": "21cnjy"},
        ]
    else:
        raise SystemExit("unknown route")
    path = os.path.join(PROBE, f"candidates-{route}.json")
    os.makedirs(PROBE, exist_ok=True)
    json.dump(cands, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{route}: {len(cands)} 条候选 -> {path}")


def run(route, limit):
    cand_path = os.path.join(PROBE, f"candidates-{route}.json")
    cands = json.load(open(cand_path, encoding="utf-8"))[:limit]
    existing_sha = set()
    csv_path = os.path.join(ROOT, "data", "reading-catalog", "link-candidates", "passages.csv")
    if os.path.exists(csv_path):
        import csv
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("sha256"):
                    existing_sha.add(row["sha256"])
    seen_sha = set()
    results = []
    for i, c in enumerate(cands, 1):
        rec = {"route": route, **c, "raw": "", "status": 0, "blocked": None,
               "pieces": [], "dupe": [], "machineSeconds": 0}
        url = c["url"]
        if url.startswith(os.sep) or url.startswith(ROOT):        # 本地 PDF
            raw = url
            rec["status"] = 200
            t0 = time.time()
            pieces, meta = pdf_pieces(raw, os.path.join(WORK, os.path.basename(raw).replace(".pdf", "")))
            rec.update(meta)
            rec["machineSeconds"] = round(time.time() - t0 + meta.get("ocrSeconds", 0), 2)
        else:
            ext = ".pdf" if url.lower().endswith(".pdf") else ".html"
            raw = os.path.join(WORK, route, f"{i:02d}" + ext)
            st, secs, size = fetch(url, raw)
            rec["status"], rec["bytes"] = st, size
            rec["machineSeconds"] = round(secs, 2)
            rec["raw"] = os.path.relpath(raw, ROOT)
            if ext == ".pdf":
                pieces, meta = pdf_pieces(raw, os.path.join(WORK, route, f"{i:02d}-pdf"))
                rec.update(meta)
                rec["machineSeconds"] = round(secs + meta.get("ocrSeconds", 0), 2)
            else:
                html = decode(open(raw, "rb").read())
                rec["title"] = rec.get("title") or (re.findall(r"<title>(.*?)</title>", html, re.S)[:1] or [""])[0].strip()
                rec["title"] = re.split(r"\s[-_|]\s", rec["title"])[0].strip()
                rec["blocked"] = block_reason(st, html)
                rec["htmlChars"] = len(re.sub(r"<[^>]+>", "", html))
                pieces = [] if rec["blocked"] else extract_pieces(
                    html_to_text(html), rec["title"], allow_whole_page=(route in ("r3", "r4")))
                if not pieces and not rec["blocked"]:
                    rec["blocked"] = "未找到可切分的阅读正文"
        for p in pieces:
            sha = p["sha256"]
            p["dupeOfExisting"] = sha in existing_sha
            p["dupeInBatch"] = sha in seen_sha
            seen_sha.add(sha)
            p.pop("sha256", None)
        rec["pieces"] = [{k: v for k, v in p.items() if k != "body"} for p in pieces]
        rec["passageText"] = [p["body"] for p in pieces]
        results.append(rec)
        tag = "BLOCK:" + rec["blocked"] if rec["blocked"] else f"{len(pieces)} 篇"
        print(f"[{i}/{len(cands)}] {rec['status']} {tag}  {url[:90]}", flush=True)
    path = os.path.join(PROBE, f"results-{route}.jsonl")
    with open(path, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("->", path)


def report():
    routes = {"r1": "教育站点转载/试卷全文页", "r2": "公开试卷 PDF",
              "r3": "公版/现代寓言与儿童文学", "r4": "课本配套读物与同步阅读"}
    lines = ["| 路线 | 尝试条数 | 取到正文 | 入池篇 | 带题篇 | 带题合格 | 纯正文篇 | 课内/巨篇/粘连 | 机器秒/篇 | 典型来源 | 卡点 |",
             "|---|---:|---:|---:|---:|---:|---:|---|---:|---|---|"]
    total = {}
    for r, name in routes.items():
        path = os.path.join(PROBE, f"results-{r}.jsonl")
        if not os.path.exists(path):
            continue
        recs = [json.loads(l) for l in open(path, encoding="utf-8")]
        ok = [x for x in recs if x.get("pieces")]
        allp = [p for x in ok for p in x["pieces"]]
        pool = [p for p in allp if not p["tooLong"] and not p["merged"]
                and not p.get("textbook") and not p.get("boilerplate")]
        wq = [p for p in pool if p["withQuestions"]]
        qq = [p for p in pool if p["questionsQualified"]]
        bo = [p for p in pool if not p["withQuestions"] and p["bodyOk"]]
        trash = len([p for p in allp if not p["withQuestions"] and not p["bodyOk"]])
        tb = len([p for p in allp if p.get("textbook")])
        big = len([p for p in allp if p["tooLong"] or p["merged"]])
        machine = sum(x.get("machineSeconds", 0) for x in recs)
        per = machine / len(pool) if pool else 0
        blocks = [(x.get("blocked") or f"HTTP {x['status']}") for x in recs if not x.get("pieces")]
        from collections import Counter
        bl = "；".join(f"{k}×{v}" for k, v in Counter(blocks).most_common(4)) or "—"
        srcs = sorted({x["source"] for x in ok})
        lines.append(f"| {name} | {len(recs)} | {len(ok)}（{len(ok)/len(recs):.0%}） | {len(pool)} | "
                     f"{len(wq)} | {len(qq)} | {len(bo)} | {tb}/{big}/{trash} | {per:.1f} | "
                     f"{', '.join(srcs)} | {bl} |")
        total[r] = {"attempted": len(recs), "body": len(ok), "pool": len(pool),
                    "withQ": len(wq), "qualified": len(qq), "bodyOnly": len(bo),
                    "textbook": tb, "tooLongOrMerged": big, "fragments": trash,
                    "machineSeconds": round(machine, 1)}
    md = "\n".join(lines)
    print(md)
    json.dump(total, open(os.path.join(PROBE, "summary.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


def export():
    """把各路线入池篇目导出成 pool.jsonl（正文+标签，供后续筛选用）。"""
    out = open(os.path.join(PROBE, "pool.jsonl"), "w", encoding="utf-8")
    n = 0
    for r in ("r1", "r2", "r3", "r4"):
        path = os.path.join(PROBE, f"results-{r}.jsonl")
        if not os.path.exists(path):
            continue
        for line in open(path, encoding="utf-8"):
            rec = json.loads(line)
            for text, meta in zip(rec.get("passageText", []), rec.get("pieces", [])):
                if meta["tooLong"] or meta["merged"] or meta.get("textbook") or meta.get("boilerplate"):
                    continue
                n += 1
                out.write(json.dumps({"id": f"{r}-{n:03d}", "route": r, "source": rec["source"],
                                      "url": rec["url"], "title": rec.get("title"),
                                      **meta, "text": text}, ensure_ascii=False) + "\n")
    out.close()
    print(f"pool.jsonl: {n} 篇")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("discover")
    d.add_argument("--route", required=True)
    r = sub.add_parser("run")
    r.add_argument("--route", required=True)
    r.add_argument("--limit", type=int, default=20)
    sub.add_parser("report")
    sub.add_parser("export")
    a = ap.parse_args()
    os.makedirs(PROBE, exist_ok=True)
    if a.cmd == "discover":
        discover(a.route)
    elif a.cmd == "run":
        run(a.route, a.limit)
    elif a.cmd == "export":
        export()
    else:
        report()


if __name__ == "__main__":
    main()
