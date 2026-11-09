#!/usr/bin/env python3
"""阅读素材目录骨架与收集流水线。

子命令：
  scan <sourceId>   枚举来源列表页（支持翻页），把原件下载进 archive/，条目写 pending
  scan --local <目录>  递归扫描公众号导出目录（.html/.pdf/.txt/.md），归档并写 pending
  process --limit N 取 pending 条目，提取正文、跑 redline + gate.py 质检，合格写进阅读库
  report            输出总量、已入库、待处理、已拒、无答案、无题目、待核错字与各来源结账状态

状态语义：
  pending        已发现、还没处理
  imported       正文与题目都过了 redline + gate.py，已写入 src/data/chinese/readings/imported.ts
  no-answer      正文已提取且合格，但缺题目/答案（人工命题还没补），不算拒稿
  no-questions   本地导出正文里没找到题目形态（通知、招生、活动稿等），保留正文供以后人工命题
  needs-redline  红线错字待核（答案字词 / 生字词语题面 / 题干引用原句），须人工还原后再跑
  rejected       正文不合格（字数、段数、重复、题目不过闸），已写原因，不再占用人工

item 里 qa 字段区分两类问题：
  qa.mustFix  影响判分的错误（红线，必须修）
  qa.benign   不影响判分的瑕疵（放过，只计数）

只新增/修改 data/reading-catalog/ 与 tools/reading-intake/；不改 src/quiz、typst、src/app。
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from gate import check as gate_check
from gate import hints as gate_hints
from redline import inspect as redline_inspect

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CATALOG_DIR = ROOT / "data" / "reading-catalog"
SOURCES_FILE = CATALOG_DIR / "sources.json"
ITEMS_FILE = CATALOG_DIR / "items.jsonl"
ARCHIVE_DIR = CATALOG_DIR / "archive"
READING_CACHE = CATALOG_DIR / "imported-readings.json"
INBOX_FILE = CATALOG_DIR / "inbox.txt"
INBOX_DONE = CATALOG_DIR / "inbox.done.txt"
IMPORTED_TS = ROOT / "src" / "data" / "chinese" / "readings" / "imported.ts"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
HANZI = re.compile(r"[\u4e00-\u9fff]")
METADATA_LINE = re.compile(
    r"^(?:\d{4}年\d{1,2}月\d{1,2}日|版权归原作者|（完）|\(完\)|本文系[^。]*|来源：.*|信息来源：.*|编辑：.*|责编：.*)$"
)
CONTACT_LINE = re.compile(
    r"(手机[：:]\s*\d|电话\s*\d|微信[：:]?\s*[a-zA-Z0-9]|QQ[：:]|邮箱[：:]|地址[：:]|"
    r"^文/\s*|^作者[：:]|^刊于|^发表于|^作者简介|^本人是个|修改意见|欢迎指正|不吝赐教|"
    r"小区|号楼|单元|门牌|街道)"
)
PHONE_LIKE = re.compile(r"\d{10,}")


# ---------------------------------------------------------------- 存储

def today() -> str:
    return time.strftime("%Y-%m-%d", time.localtime())


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())


def load_sources() -> dict:
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def save_sources(data: dict) -> None:
    data["updatedAt"] = today()
    SOURCES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_items() -> list[dict]:
    raw = ITEMS_FILE.read_text(encoding="utf-8").strip()
    return [json.loads(line) for line in raw.splitlines()] if raw else []


def save_items(items: list[dict]) -> None:
    body = "\n".join(json.dumps(item, ensure_ascii=False) for item in items)
    ITEMS_FILE.write_text(body + "\n" if body else "", encoding="utf-8")


def load_cache() -> list[dict]:
    return json.loads(READING_CACHE.read_text(encoding="utf-8")) if READING_CACHE.exists() else []


def save_cache(readings: list[dict]) -> None:
    READING_CACHE.write_text(json.dumps(readings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_imported_ts(readings: list[dict]) -> None:
    header = (
        "// 由 tools/reading-intake/cli.py process 自动生成，请改源数据后重跑，不要手改。\n"
        "import type { ChineseReading } from '../types.ts'\n\n"
    )
    IMPORTED_TS.write_text(
        header + "export const IMPORTED_READINGS: ChineseReading[] = "
        + json.dumps(readings, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------- 文本与指纹

def hanzi_count(text: str) -> int:
    return len(HANZI.findall(text))


def normalize_for_fingerprint(text: str) -> str:
    text = text.lower()
    return "".join(ch for ch in text if ("\u4e00" <= ch <= "\u9fff") or ch.isascii() and ch.isalnum())


def fingerprint_of(text: str) -> str:
    return "sha256:" + hashlib.sha256(normalize_for_fingerprint(text).encode("utf-8")).hexdigest()


def hash64(value: str) -> int:
    return int.from_bytes(hashlib.sha256(value.encode("utf-8")).digest()[:8], "big")


def simhash_of(text: str) -> str:
    normalized = normalize_for_fingerprint(text)
    if len(normalized) < 3:
        return "0" * 16
    shingles: dict[str, int] = {}
    for index in range(len(normalized) - 2):
        gram = normalized[index:index + 3]
        shingles[gram] = shingles.get(gram, 0) + 1
    vector = [0] * 64
    for gram, weight in shingles.items():
        value = hash64(gram)
        for bit in range(64):
            vector[bit] += weight if (value >> bit) & 1 else -weight
    result = 0
    for bit in range(64):
        if vector[bit] > 0:
            result |= 1 << bit
    return format(result, "016x")


def hamming(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def decode_bytes(buffer: bytes) -> str:
    probe = buffer[:4096].decode("latin1")
    match = re.search(r'charset\s*=\s*["\']?([a-zA-Z0-9_-]+)', probe, re.I)
    charset = (match.group(1).lower() if match else "utf-8")
    if charset in {"gb2312", "gbk", "gb18030"}:
        return buffer.decode("gb18030", errors="ignore")
    try:
        return buffer.decode(charset, errors="ignore")
    except LookupError:
        return buffer.decode("utf-8", errors="ignore")


def plain_text(fragment: str) -> str:
    fragment = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    fragment = re.sub(r"<(script|style|noscript).*?</\1>", "", fragment, flags=re.S | re.I)
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"</?(?:p|div|li|h[1-6]|tr|section|article)[^>]*>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    lines = [re.sub(r"\s+", " ", line).strip() for line in html_lib.unescape(fragment).splitlines()]
    return "\n".join(line for line in lines if line)


def clean_paragraphs(paragraphs: list[str], title: str = "") -> list[str]:
    """去掉网页附带的作者联系方式、发表信息，以及重复的标题行。"""
    kept = []
    for line in paragraphs:
        if METADATA_LINE.match(line):
            continue
        if CONTACT_LINE.search(line) or PHONE_LIKE.search(line):
            continue
        previous = None
        while previous != line:
            previous, line = line, re.sub(r"(\u4e00-\u9fff)\s+(\u4e00-\u9fff)", r"\1\2", line)
        kept.append(line)
    while kept and kept[0].strip() == title.strip():
        kept.pop(0)
    if kept and kept[0].endswith(title.strip()) and len(kept[0]) <= len(title.strip()) + 8:
        kept.pop(0)  # 「艾思寓言：小岩羊与金鵰」这类作者前缀标题
    cleaned = []
    for index, line in enumerate(kept):
        following = kept[index + 1] if index + 1 < len(kept) else ""
        # 「高景轩」+「手机：…」这类落款
        if len(line) <= 5 and not re.search(r"[，。！？、,.!?]", line) and CONTACT_LINE.search(following):
            continue
        cleaned.append(line)

    # 网页按可视宽度硬换行，把没写句末标点的行接回上一段
    merged = []
    buffer = ""
    for line in cleaned:
        buffer += line
        if re.search(r"[。！？!?…”」』]$", line):
            merged.append(buffer)
            buffer = ""
    if buffer and not (len(buffer) <= 5 and not re.search(r"[，。！？、,.!?]", buffer)):
        merged.append(buffer)
    return merged


def slugify(title: str) -> str:
    slug = re.sub(r"[^\u4e00-\u9fffa-zA-Z0-9]+", "-", title)
    slug = re.sub(r"^-+|-+$", "", slug)
    return slug[:24]


def make_archive_path(source_id: str, seq: str, title: str, suffix: str) -> str:
    directory = ARCHIVE_DIR / source_id
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{seq}-{slugify(title)}.{suffix}" if slugify(title) else f"{seq}.{suffix}"
    return str((directory / name).relative_to(ROOT))


def next_seq(items: list[dict]) -> int:
    highest = 24  # 现有原创短文到 RD-024
    for item in items:
        match = re.match(r"RD-(\d+)$", item["seq"])
        if match:
            highest = max(highest, int(match.group(1)))
    return highest + 1


# ---------------------------------------------------------------- 抓取

def fetch(url: str, timeout: int = 25, headers: dict | None = None) -> tuple[int, bytes, str]:
    merged = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*"}
    merged.update(headers or {})
    request = urllib.request.Request(url, headers=merged)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), response.geturl()
    except urllib.error.HTTPError as error:
        return error.code, b"", url
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError(f"抓取失败：{url}（{error}）") from error


def fetch_with_retries(url: str, retries: int = 2) -> bytes:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            status, body, _ = fetch(url)
            if status == 200:
                return body
            last_error = RuntimeError(f"HTTP {status}：{url}")
        except RuntimeError as error:
            last_error = error
        if attempt < retries:
            time.sleep(attempt + 1)
    raise last_error or RuntimeError(f"抓取失败：{url}")


# ---------------------------------------------------------------- 适配器

class ChinaFable:
    id = "chinafable"
    suffix = "html"

    def list_url(self, source: dict, page: int) -> str:
        return f"http://www.chinafable.cn/search-1-0-0-{page}.html"

    def parse_list(self, text: str) -> tuple[list[dict], int | None]:
        start = text.find("<!--新闻列表S-->")
        end = text.find("<!--新闻列表E-->")
        region = text[start:end] if start >= 0 and end > start else text
        entries = []
        seen: set[str] = set()
        pattern = re.compile(
            r'<li><a href="(\./content-\d+\.html)" title="([^"]*)"[^>]*>([^<]*)</a><span>([^<]*)</span></li>'
        )
        for match in pattern.finditer(region):
            url = "http://www.chinafable.cn/" + match.group(1).removeprefix("./")
            if url in seen:
                continue
            seen.add(url)
            author = re.search(r"\[([^\]]+)\]", match.group(3))
            entries.append({
                "url": url,
                "title": html_lib.unescape(match.group(2)).strip(),
                "author": author.group(1) if author else None,
                "publishedAt": html_lib.unescape(match.group(4)).strip("()") or None,
            })
        pager = re.search(r"Tkl_PageListBar\(\d+,\s*(\d+),\s*\d+", text)
        return entries, int(pager.group(1)) if pager else None

    def fetch_original(self, entry: dict) -> bytes:
        return fetch_with_retries(entry["url"])

    def parse_original(self, buffer: bytes, entry: dict) -> dict:
        text = decode_bytes(buffer)
        article = re.search(r'<div id="article">(.*?)<div class="info">', text, re.S)
        region = article.group(1) if article else text
        heading = re.search(r"<h1>(.*?)</h1>", region, re.S)
        content = re.search(r'<div class="content">(.*?)</div>', region, re.S)
        body = content.group(1) if content else region
        paragraphs = []
        for match in re.finditer(r"<p>(.*?)</p>", body, re.S):
            line = plain_text(match.group(1)).replace("\n", " ").strip()
            if line and not METADATA_LINE.match(line):
                paragraphs.append(line)
        if len(paragraphs) > 1 and len(paragraphs[-1]) <= 2:
            paragraphs.pop()
        info = text[text.find('<div class="info">'):] if article else ""
        author = (re.search(r"作者：([^\]\s]+)", info) or [None, None])[1] or entry.get("author")
        published = (re.search(r"发布时间：(\d{4}年\d{1,2}月\d{1,2}日)", info) or [None, None])[1] \
            or entry.get("publishedAt")
        title = plain_text(heading.group(1)).strip() if heading else entry["title"]
        return {
            "title": title,
            "author": author,
            "publishedAt": published,
            "paragraphs": clean_paragraphs(paragraphs, title),
        }


class Gutenberg:
    id = "gutenberg"
    suffix = "txt"

    def list_url(self, source: dict, page: int) -> str:
        return "https://www.gutenberg.org/browse/languages/zh"

    def parse_list(self, text: str) -> tuple[list[dict], int | None]:
        entries = []
        seen: set[str] = set()
        for match in re.finditer(r'href="(/ebooks/\d+)"[^>]*>\s*([^<]{2,120})<', text):
            url = "https://www.gutenberg.org" + match.group(1)
            if url in seen:
                continue
            seen.add(url)
            entries.append({"url": url, "title": re.sub(r"\s+", " ", html_lib.unescape(match.group(2))).strip()})
        return entries, 1

    def fetch_original(self, entry: dict) -> bytes:
        book_id = re.search(r"/ebooks/(\d+)", entry["url"]).group(1)
        return fetch_with_retries(f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt")

    def parse_original(self, buffer: bytes, entry: dict) -> dict:
        text = buffer.decode("utf-8", errors="ignore")
        start = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG", text)
        end = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG", text)
        body = text[start.start():end.start()] if start and end else text
        paragraphs = []
        for block in re.split(r"\n\s*\n", body.replace("\r", "")):
            line = "".join(part.strip() for part in block.splitlines()).strip()
            if line and not line.startswith("The Project Gutenberg eBook"):
                paragraphs.append(line)
        return {"title": entry["title"], "paragraphs": paragraphs}


class LocalExport:
    """本地导出目录：归档件按后缀分流到 HTML / PDF / 纯文本解析。"""
    id = "local"
    suffix = "html"

    def list_url(self, source: dict, page: int) -> str:
        return source["listUrl"]

    def parse_list(self, text: str) -> tuple[list[dict], int | None]:
        return [], 1

    def parse_original(self, buffer: bytes, entry: dict) -> dict:
        path = ROOT / entry["archivePath"]
        suffix = path.suffix.lower()
        if suffix in {".html", ".htm"}:
            return parse_local_html(path)
        if suffix == ".pdf":
            return parse_local_pdf(path)
        return parse_local_text(path)


ADAPTERS = {adapter.id: adapter() for adapter in (ChinaFable, Gutenberg, LocalExport)}


def adapter_for(source: dict):
    if source.get("adapter") not in ADAPTERS:
        raise RuntimeError(f"来源 {source['id']} 没有可用的适配器（{source.get('adapter')}）")
    return ADAPTERS[source["adapter"]]


# ---------------------------------------------------------------- scan

def duplicate_reason(fingerprint: str, simhash: str, others: list[dict]) -> str | None:
    for other in others:
        if other["fingerprint"] == fingerprint:
            return f"正文指纹与 {other['seq']} 相同"
    for other in others:
        distance = hamming(other["simhash"], simhash)
        if distance <= 6:
            return f"正文与 {other['seq']} 高度近似（simhash 距离 {distance}）"
    return None


LOCAL_NOISE = re.compile(
    r"^(?:阅读原文|点赞|在看|分享|收藏|转发|投诉|预览|关注|长按|扫码|二维码|广告|"
    r"喜欢此内容的人还喜欢|作者简介|版权归|免责声明|本文来源|编辑[:：]|责编[:：]|"
    r"点击|进入|更多精彩|往期回顾|返回搜狐|微信扫一扫|识别二维码|"
    r"阅读下面的短文|阅读短文|阅读下文|阅读下面的).*$"
)
QUESTION_MARKERS = re.compile(
    r"(阅读下面的|阅读短文|阅读下文|回答问题|看拼音写词语|选择|填空|判断|"
    r"[（(]\s*[)）]|(?:^|\n)\s*\d+[.、]|[ABCD][.、．]|答案)"
)
WECHAT_URL = re.compile(r"https://mp\.weixin\.qq\.com/s\?[^\"'<>\s]+")
# 公众号小标题常整块加粗；切分合集时要靠它识别没有编号的标题
BOLD_FRAGMENT = re.compile(r"<strong[ >]|<b[ >]|font-weight\s*:\s*(?:bold|bolder|6\d\d|7\d\d)", re.I)


def _inline_text(fragment: str) -> str:
    """把一段 HTML 压成单行文本：去标签、反转义、合并空白。"""
    return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


# PDF 文字层常把汉字拆成 CJK 部首补充区字形，NFKC 不处理这一段，需要手工映射
RADICAL_MAP = {
    "⺰": "纟", "⻅": "见", "⻈": "讠", "⻉": "贝", "⻋": "车", "⻐": "钅",
    "⻓": "长", "⻔": "门", "⻙": "韦", "⻚": "页", "⻛": "风", "⻜": "飞",
    "⻢": "马", "⻥": "鱼", "⻦": "鸟", "⻧": "卤", "⻨": "麦", "⻩": "黄",
    "⻪": "黾", "⻬": "齐", "⻮": "齿", "⻰": "龙", "⻳": "龟",
}


def compatible_normalize(text: str) -> str:
    """只修 PDF 常见的康熙部首/兼容表意字，保留中文标点（整段 NFKC 会把，？！变成半角）。"""
    result = []
    for char in text:
        if char in RADICAL_MAP:
            result.append(RADICAL_MAP[char])
            continue
        code = ord(char)
        if 0x2F00 <= code <= 0x2FDF or 0xF900 <= code <= 0xFAFF or 0x2F800 <= code <= 0x2FA1F:
            result.append(unicodedata.normalize("NFKC", char))
        else:
            result.append(char)
    return "".join(result)


def local_paragraphs(raw: str) -> list[str]:
    text = compatible_normalize(raw).replace("\u200b", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    paragraphs = []
    buffer = ""
    for line in lines:
        if LOCAL_NOISE.match(line):
            continue
        if not line:
            if buffer:
                paragraphs.append(buffer)
                buffer = ""
            continue
        buffer = line if not buffer else buffer + line
        if line.endswith(("。", "！", "？", "…", "”")):
            paragraphs.append(buffer)
            buffer = ""
    if buffer:
        paragraphs.append(buffer)
    return clean_paragraphs(paragraphs)


def parse_local_html_text(text: str, fallback_title: str = "") -> dict:
    """解析公众号文章页 HTML：标题取 activity-name，正文取 #js_content。"""
    title_match = re.search(r'id="activity-name"[^>]*>(.*?)</', text, re.S)
    title = _inline_text(title_match.group(1)) if title_match else ""
    if not title:
        title_match = re.search(r"<title>(.*?)</title>", text, re.S)
        title = _inline_text(title_match.group(1)) if title_match else fallback_title
    container_match = re.search(r'id=["\']js_content["\']', text) \
        or re.search(r'class=["\'][^"\']*rich_media_content', text)
    container = text
    if container_match:
        start = text.find(">", container_match.end()) + 1
        end = len(text)
        # 公众号正文后面紧跟工具条/二维码/推荐位，截断避免把页脚当正文
        for tail in ('<div class="rich_media_tool', 'id="js_bottom', 'id="js_pc_qr_code',
                     '<div id="js_profile', '</body>'):
            position = text.find(tail, start)
            if 0 <= position < end:
                end = position
        container = text[start:end]
    fragments = re.findall(r"<(?:p|section)[^>]*>(.*?)</(?:p|section)>", container, re.S)
    blocks = []
    if fragments:
        for fragment in fragments:
            line = _inline_text(fragment)
            if line:
                blocks.append({"text": line, "bold": bool(BOLD_FRAGMENT.search(fragment))})
        raw = "\n".join(block["text"] for block in blocks)
    else:
        blocks = [{"text": line, "bold": False} for line in plain_text(container).splitlines() if line]
        raw = "\n".join(block["text"] for block in blocks)
    published = re.search(r'id="publish_time"[^>]*>(.*?)</', text, re.S)
    url = ""
    og = re.search(r'property="og:url"\s+content="([^"]+)"', text)
    if og:
        url = og.group(1)
    else:
        found = WECHAT_URL.findall(text)
        url = found[0] if found else ""
    return {
        "title": title,
        "paragraphs": local_paragraphs(raw),
        # 未合并的原始块：合集切分要靠块边界识别小标题，合并后的段落会把标题并进正文
        "blocks": blocks,
        "publishedAt": _inline_text(published.group(1)) if published else None,
        "url": url,
    }


def parse_local_html(path: Path) -> dict:
    return parse_local_html_text(decode_bytes(path.read_bytes()), fallback_title=path.stem)


def parse_local_pdf(path: Path) -> dict:
    try:
        import pypdf
        reader = pypdf.PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        text = ""
    if text.strip():
        return {"title": path.stem, "paragraphs": local_paragraphs(text), "url": "", "publishedAt": None}
    # 无文字层：走已有的 Vision -> clean 流程
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        subprocess.run([sys.executable, str(HERE / "intake.py"), "pages", str(path),
                        "--out", str(out / "pages"), "--dpi", "300"], check=True)
        subprocess.run([sys.executable, str(HERE / "intake.py"), "ocr", str(out / "pages"),
                        "--out", str(out / "vision")], check=True)
        visions = sorted((out / "vision").glob("*.vision.json"))
        if not visions:
            return {"title": path.stem, "paragraphs": [], "url": "", "publishedAt": None}
        cleaned = []
        for index, vision in enumerate(visions):
            target = out / f"clean-{index}.txt"
            subprocess.run([sys.executable, str(HERE / "intake.py"), "clean", str(vision),
                            "--out", str(target)], check=True)
            cleaned.append(target.read_text(encoding="utf-8"))
        raw = "\n\n".join(cleaned)
    return {"title": path.stem, "paragraphs": local_paragraphs(raw), "url": "", "publishedAt": None}


def parse_local_text(path: Path) -> dict:
    text = decode_bytes(path.read_bytes())
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0].lstrip("#").strip() if lines else path.stem
    body = "\n\n".join(lines[1:]) if len(lines) > 1 else text
    return {"title": title, "paragraphs": local_paragraphs(body), "url": "", "publishedAt": None}


def cmd_scan_local(args: argparse.Namespace) -> None:
    data = load_sources()
    source_id = args.source_id or "local-export"
    source = next((entry for entry in data["sources"] if entry["id"] == source_id), None)
    if source is None:
        raise SystemExit(f"来源不存在：{source_id}")
    if source.get("adapter") != "local":
        raise SystemExit(f"来源 {source_id} 不是本地导出目录（adapter={source.get('adapter')}）")
    location = getattr(args, "local", None) or source.get("listUrl")
    if not location:
        raise SystemExit("缺少本地目录：scan --local <路径>")
    root = Path(location).expanduser()
    if not root.is_absolute():
        root = ROOT / root
    if not root.exists():
        raise SystemExit(f"本地目录不存在：{root}")
    exporter = getattr(args, "exporter", None) or "公众号导出"

    items = load_items()
    known_urls = {item["sourceUrl"] for item in items}
    known = [{"seq": item["seq"], "fingerprint": item["fingerprint"], "simhash": item["simhash"]} for item in items]
    seq_number = next_seq(items)
    created = repeated = skipped = failed = 0
    suffix_map = {".html": "html", ".htm": "html", ".pdf": "pdf", ".txt": "txt", ".md": "md"}

    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        suffix = path.suffix.lower()
        if suffix not in suffix_map:
            continue
        try:
            if suffix in {".html", ".htm"}:
                article = parse_local_html(path)
            elif suffix == ".pdf":
                article = parse_local_pdf(path)
            else:
                article = parse_local_text(path)
            text = "".join(article["paragraphs"])
            if not text.strip():
                failed += 1
                print(f"  ! {path.name} 没有可用正文")
                continue
            relative = str(path.relative_to(root))
            source_url = article["url"] or f"local:{relative}#{exporter}"
            if source_url in known_urls:
                skipped += 1
                print(f"  = {path.name} 已收过（{source_url}）")
                continue
            seq = f"RD-{seq_number:03d}"
            archive_path = make_archive_path(source["id"], seq, article["title"] or path.stem, suffix_map[suffix])
            (ROOT / archive_path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, ROOT / archive_path)
            seq_number += 1
            created += 1
            fingerprint = fingerprint_of(text)
            simhash = simhash_of(text)
            duplicate = duplicate_reason(fingerprint, simhash, known)
            item = {
                "seq": seq,
                "sourceId": source["id"],
                "sourceUrl": source_url,
                "title": article["title"] or path.stem,
                "author": None,
                "archivePath": archive_path,
                "charCount": hanzi_count(text),
                "fingerprint": fingerprint,
                "simhash": simhash,
                "status": "rejected" if duplicate else "pending",
                "rejectReason": duplicate,
                "dataId": None,
                "scannedAt": today(),
                "publishedAt": article.get("publishedAt"),
            }
            items.append(item)
            known.append({"seq": seq, "fingerprint": fingerprint, "simhash": simhash})
            known_urls.add(source_url)
            save_items(items)
            if duplicate:
                repeated += 1
            print(f"  + {seq} {item['title']}（{item['charCount']} 字，{suffix_map[suffix]}）"
                  + (f" 跳过：{duplicate}" if duplicate else ""))
        except Exception as error:
            failed += 1
            print(f"  ! {path.name} 解析失败：{error}")

    source["lastScanAt"] = today()
    source["status"] = "exhausted"
    source["remainingPages"] = 0
    source["note"] = (f"本地导出目录 {root}（导出工具：{exporter}）。可重复扫描，目录内新文件会自动收录；"
                      f"最近一次：新增 {created}，已收跳过 {skipped}，重复 {repeated}，失败 {failed}。")
    save_sources(data)
    print(f"本地扫描完成：新增 {created}，重复 {repeated}，已收跳过 {skipped}，失败 {failed}")


def cmd_scan(args: argparse.Namespace) -> None:
    if getattr(args, "local", None):
        cmd_scan_local(args)
        return
    if not args.source_id:
        raise SystemExit("缺少来源：scan <sourceId> 或 scan --local <目录>")
    data = load_sources()
    source = next((entry for entry in data["sources"] if entry["id"] == args.source_id), None)
    if source is None:
        raise SystemExit(f"来源不存在：{args.source_id}")
    if source.get("adapter") == "local":
        cmd_scan_local(args)
        return
    if source.get("adapter") == "none" or source["status"] == "unavailable":
        print(f"来源 {args.source_id} 不可扫描：{source['note']}")
        return

    adapter = adapter_for(source)
    items = load_items()
    known_urls = {item["sourceUrl"] for item in items}
    known = [{"seq": item["seq"], "fingerprint": item["fingerprint"], "simhash": item["simhash"]} for item in items]

    single_page = source.get("pagination", {}).get("kind") == "single-page"
    if single_page and source.get("pagination", {}).get("lastPage", 0) >= 1:
        print(f"来源 {args.source_id} 是单页列表，已扫描过，跳过。")
        return
    start_page = 1 if single_page else source.get("pagination", {}).get("lastPage", 0) + 1
    total_pages = source.get("pagination", {}).get("totalPages")
    seq_number = next_seq(items)
    created = repeated = skipped = failed = 0
    last_page_done = start_page - 1
    stopped = False

    for offset in range(args.pages):
        page = start_page + offset
        list_url = adapter.list_url(source, page)
        try:
            status, body, _ = fetch(list_url)
        except RuntimeError as error:
            print(f"第 {page} 页打不开，停止：{error}")
            failed += 1
            break
        if status != 200:
            print(f"第 {page} 页打不开（HTTP {status}），停止。")
            failed += 1
            break
        entries, found_total = adapter.parse_list(decode_bytes(body))
        if found_total is not None:
            total_pages = found_total
        if not entries:
            print(f"第 {page} 页没有条目，视为已翻完。")
            last_page_done = page
            break

        page_created = page_repeated = page_skipped = 0
        for entry in entries:
            if created >= args.max_items:
                stopped = True
                break
            if entry["url"] in known_urls:
                skipped += 1
                page_skipped += 1
                continue
            try:
                time.sleep(args.delay / 1000)
                buffer = adapter.fetch_original(entry)
                article = adapter.parse_original(buffer, entry)
                text = "".join(article["paragraphs"])
                seq = f"RD-{seq_number:03d}"
                archive_path = make_archive_path(source["id"], seq, article["title"], adapter.suffix)
                (ROOT / archive_path).write_bytes(buffer)
                seq_number += 1
                created += 1
                page_created += 1

                fingerprint = fingerprint_of(text)
                simhash = simhash_of(text)
                duplicate = duplicate_reason(fingerprint, simhash, known)
                item = {
                    "seq": seq,
                    "sourceId": source["id"],
                    "sourceUrl": entry["url"],
                    "title": article["title"],
                    "author": article.get("author"),
                    "archivePath": archive_path,
                    "charCount": hanzi_count(text),
                    "fingerprint": fingerprint,
                    "simhash": simhash,
                    "status": "rejected" if duplicate else "pending",
                    "rejectReason": duplicate,
                    "dataId": None,
                    "scannedAt": today(),
                    "publishedAt": article.get("publishedAt"),
                }
                items.append(item)
                known.append({"seq": seq, "fingerprint": fingerprint, "simhash": simhash})
                known_urls.add(entry["url"])
                save_items(items)
                if duplicate:
                    page_repeated += 1
                    repeated += 1
                print(f"  + {seq} {article['title']}（{item['charCount']} 字）"
                      + (f" 跳过：{duplicate}" if duplicate else ""))
            except Exception as error:  # 单条失败不影响整页
                failed += 1
                print(f"  ! {entry['url']} 抓取失败：{error}")

        if stopped:
            # 本页只处理了一部分：lastPage 不前移，下轮重取本页、跳过已收条目继续
            break
        last_page_done = page
        remaining = None if total_pages is None else max(0, total_pages - page)
        source["pagination"] = {
            "kind": source.get("pagination", {}).get("kind", "page-path"),
            "prefix": source.get("pagination", {}).get("prefix"),
            "lastPage": page,
            "totalPages": total_pages,
        }
        source["remainingPages"] = remaining
        source["status"] = "exhausted" if remaining == 0 else "pending"
        source["lastScanAt"] = today()
        save_sources(data)
        print(f"第 {page} 页：条目 {len(entries)}，新增 {page_created}，重复 {page_repeated}，已收跳过 {page_skipped}")

    if not stopped:
        remaining = None if total_pages is None else max(0, total_pages - last_page_done)
        source["remainingPages"] = remaining
        source["status"] = "exhausted" if remaining == 0 else "pending"
        source["lastScanAt"] = today()
        save_sources(data)
    print(f"scan {args.source_id} 完成：新增 {created}（其中重复 {repeated}），"
          f"已收跳过 {skipped}，失败 {failed}。")


# ---------------------------------------------------------------- 批量链接（公众号正文）

LINK_BATCH_DIR = CATALOG_DIR / "link-batch"
LINK_SOURCE_ID = "wechat-links"
LINK_CURL_LIMIT = 5 * 1024 * 1024
LINK_CURL_TIMEOUT = 20
LINK_REPORT_MARK = "__QUIZLAB_REPORT__"
# 页面明确拒绝/失效时给可读原因；顺序即优先级（先命中先返回）
LINK_BLOCK_RULES: tuple[tuple[str, str, str], ...] = (
    ("该内容已被发布者删除", "删除", "该文章已被发布者删除"),
    ("此内容因违规无法查看", "违规", "该文章因违规无法查看"),
    ("该内容已被屏蔽", "违规", "该文章已被屏蔽"),
    ("该公众号已迁移", "失效", "该公众号已迁移，链接已失效"),
    ("已停止访问该网页", "失效", "该链接已被停止访问"),
    ("链接已过期", "过期", "该链接已过期，请重新分享获取新链接"),
    ("参数错误", "过期", "链接参数无效，可能已过期"),
    ("请在微信客户端打开链接", "需客户端", "页面要求“请在微信客户端打开链接”"),
    ("完成验证", "需验证", "微信要求人机验证，请稍后在浏览器打开该链接再复制"),
    ("环境异常", "需验证", "微信返回“环境异常”，请稍后再试"),
    ("访问过于频繁", "限流", "访问过于频繁，请稍后再试"),
)


class LinkFetchError(RuntimeError):
    """单条链接抓取失败：分类写进报告，明确到能直接看懂原因。"""

    def __init__(self, category: str, detail: str) -> None:
        super().__init__(detail)
        self.category = category


def normalize_link(raw: str) -> str:
    text = raw.strip()
    if not text or text.startswith("#"):
        return ""
    if not text.lower().startswith(("http://", "https://")):
        text = "https://" + text
    return text


def link_problem(link: str) -> str | None:
    """只接受 mp.weixin.qq.com 的 http(s) 链接；返回原因或 None。"""
    try:
        parts = urllib.parse.urlsplit(link)
    except ValueError:
        return "链接格式不正确"
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return "链接格式不正确"
    if parts.hostname != "mp.weixin.qq.com":
        return "只接受 mp.weixin.qq.com 的公众号文章链接"
    return None


def fetch_with_curl(url: str) -> tuple[str, str]:
    """系统 curl 取页面：浏览器 UA、跟随跳转、超时与体积上限，不带任何登录凭证。"""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "page.html"
        args = [
            "curl", "-sS", "-L", "--compressed",
            "--max-time", str(LINK_CURL_TIMEOUT),
            "--max-filesize", str(LINK_CURL_LIMIT),
            "-A", UA,
            "-H", "Accept-Language: zh-CN,zh;q=0.9",
            "-o", str(out),
            "-w", "%{http_code}\n%{url_effective}",
            url,
        ]
        try:
            result = subprocess.run(args, capture_output=True, text=True,
                                    timeout=LINK_CURL_TIMEOUT + 10)
        except FileNotFoundError:
            raise LinkFetchError("网络失败", "未找到系统 curl") from None
        except subprocess.TimeoutExpired:
            raise LinkFetchError("超时", f"请求超时（{LINK_CURL_TIMEOUT + 10} 秒）") from None

        stderr = (result.stderr or "").strip()
        if result.returncode != 0:
            code = result.returncode
            if code == 63 or "maximum file size" in stderr.lower():
                raise LinkFetchError("体积超限", "页面体积超出 5 MB，可能不是文章页")
            if code == 28:
                raise LinkFetchError("超时", f"请求超时（{LINK_CURL_TIMEOUT} 秒）")
            if code in (6, 7):
                raise LinkFetchError("网络失败", "无法连接 mp.weixin.qq.com，请检查网络")
            raise LinkFetchError("网络失败", f"curl 退出码 {code}：{stderr[:120]}")

        head = (result.stdout or "").strip().splitlines()
        status = head[0].strip() if head else ""
        final_url = head[1].strip() if len(head) > 1 else url
        if status != "200":
            raise LinkFetchError("网络失败", f"HTTP {status or '未知'}：{final_url[:120]}")
        if not out.is_file():
            raise LinkFetchError("无正文", "页面返回为空")
        return out.read_text(encoding="utf-8", errors="ignore"), final_url


def wechat_link_block_reason(html: str) -> tuple[str, str] | None:
    for marker, category, reason in LINK_BLOCK_RULES:
        if marker in html:
            return category, reason
    return None


def link_batch_done_links() -> set[str]:
    """断点续跑依据：历史批次里 status=ok 的链接不再重复抓。"""
    done: set[str] = set()
    if not LINK_BATCH_DIR.is_dir():
        return done
    for report_path in sorted(LINK_BATCH_DIR.glob("*/report.json")):
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for entry in report.get("entries", []):
            if isinstance(entry, dict) and entry.get("status") == "ok" and entry.get("link"):
                done.add(entry["link"])
    return done


def link_batch_stats(entries: list[dict]) -> tuple[dict, dict[str, int]]:
    stats = {
        "success": 0, "skipped": 0, "failed": 0, "imported": 0, "pendingQuestions": 0,
        # 「单篇不合格」与「合集已切分」分开展示
        "splitArticles": 0, "splitUnits": 0, "splitPassed": 0, "splitWordPassed": 0,
        "needsSplit": 0,
    }
    fail_reasons: dict[str, int] = {}
    for entry in entries:
        status = entry.get("status")
        if status == "ok":
            stats["success"] += 1
            split = entry.get("split") or {}
            if split.get("reliable"):
                stats["splitArticles"] += 1
                for unit in split.get("units", []):
                    stats["splitUnits"] += 1
                    state = unit.get("status")
                    if state == "imported":
                        stats["imported"] += 1
                        stats["splitPassed"] += 1
                        stats["splitWordPassed"] += 1
                    elif state in {"no-answer", "needs-redline", "pending"}:
                        stats["pendingQuestions"] += 1
                        stats["splitWordPassed"] += 1
                    elif state == "no-questions":
                        # 无题目形态的本地稿会跳过字数闸，只能算待命题，不算字数合格
                        stats["pendingQuestions"] += 1
            elif split.get("attempted"):
                stats["needsSplit"] += 1
            else:
                intake = entry.get("intakeStatus")
                if intake == "imported":
                    stats["imported"] += 1
                elif intake in {"no-answer", "no-questions", "needs-redline"}:
                    stats["pendingQuestions"] += 1
        elif status == "skipped":
            stats["skipped"] += 1
        else:
            stats["failed"] += 1
            key = entry.get("reasonCategory") or "其他"
            fail_reasons[key] = fail_reasons.get(key, 0) + 1
    return stats, fail_reasons


def save_link_report(path: Path, report: dict) -> None:
    stats, fail_reasons = link_batch_stats(report["entries"])
    report["stats"] = stats
    report["failReasons"] = dict(sorted(fail_reasons.items(), key=lambda pair: -pair[1]))
    report["updatedAt"] = now()
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_link_source(data: dict) -> None:
    source = next((entry for entry in data["sources"] if entry["id"] == LINK_SOURCE_ID), None)
    if source is None:
        data["sources"].append({
            "id": LINK_SOURCE_ID,
            "name": "公众号 · 批量链接",
            "type": "公众号/博客",
            "listUrl": "",
            "adapter": "local",
            "status": "manual",
            "remainingPages": None,
            "lastScanAt": None,
            "note": ("面板「批量链接」逐条抓取：系统 curl 取文章页 HTML（浏览器 UA、无登录凭证），"
                     "正文按本地导出适配器解析后走 clean → gate 入库。"
                     "历史文章列表接口只有微信客户端能取，桌面端已停止尝试。"),
        })
        return
    source["note"] = ("面板「批量链接」逐条抓取：系统 curl 取文章页 HTML（浏览器 UA、无登录凭证），"
                      "正文按本地导出适配器解析后走 clean → gate 入库。"
                      "历史文章列表接口只有微信客户端能取，桌面端已停止尝试。")


# ---------------------------------------------------------------- 合集切分

# 「参考答案」之后是答案页，再往后常跟营销尾巴；切分到答案页就停
SPLIT_STOP = re.compile(
    r"^(?:参考答案|答案[：:]|【答案|篇幅有限|完整版|声明[：:]|"
    r"[^。]{0,12}(?:加.{0,4}微信|长按.{0,4}二维码|扫码.{0,4}(?:关注|领取)|免费领取))"
)
SPLIT_HEADING_CN = re.compile(
    r"^(?:[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\))"
)
SPLIT_HEADING_MATERIAL = re.compile(r"^(?:阅读材料|阅读短文|材料)[一二三四五六七八九十\d]+(?:[：:、.．]|\s)*")
SPLIT_HEADING_BRACKET = re.compile(r"^【([^】]{2,16})】")
SPLIT_DIGIT_HEADING = re.compile(r"^\d{1,2}[、.．]\s*")
# 题号/分值/空括号等特征：带这些的短行是题目，不是小标题
SPLIT_QUESTIONISH = re.compile(r"（\d+\s*分）|（\s*）|[（(]\s*[)）]|\d+\s*分")
QUESTION_BLOCK = re.compile(
    r"^(?:\d{1,2}[、.．]|（\d+）|\([A-D]\)|[A-D][.、．])|（\d+\s*分）|（\s*）|[（(]\s*[)）]|\d+\s*分"
)
SENTENCE_TAIL = ("。", "！", "？", "…", "”")
# 三年级上册课内篇目（统编版，含 2025 修订版在用的课文与旧版保留篇目）：
# 命中这些标题的切分单元按 in-text 收，字数单独按 150–400 判定，不混进课外 250–600
IN_TEXT_TITLES = (
    "大青树下的小学", "花的学校", "不懂就要问", "古诗三首", "铺满金色巴掌的水泥道",
    "秋天的雨", "听听，秋的声音", "总也倒不了的老屋", "犟龟", "小狗学叫",
    "宝葫芦的秘密", "在牛肚子里旅行", "一块奶酪", "搭船的鸟", "金色的草地",
    "富饶的西沙群岛", "海滨小城", "美丽的小兴安岭", "香港，璀璨的明珠",
    "大自然的声音", "读不完的大书", "司马光", "一定要争气", "手术台就是阵地",
    "一个粗瓷大碗", "灰雀", "掌声", "去年的树", "父亲、树林和鸟", "带刺的朋友",
    "山行", "望洞庭", "夜书所见", "望天门山", "饮湖上初晴后雨", "鹿柴",
)


def reading_kind(title: str, parent_title: str = "") -> str:
    """课内片段（in-text）与课外短文（extracurricular）分类。"""
    if "课内" in parent_title or "课文" in parent_title:
        return "in-text"
    cleaned = title.strip("《》 ")
    if any(name and name in cleaned for name in IN_TEXT_TITLES):
        return "in-text"
    return "extracurricular"


def word_range_for(kind: str, args: argparse.Namespace) -> tuple[int, int]:
    if kind == "in-text":
        return getattr(args, "intext_min", 150), getattr(args, "intext_max", 400)
    return getattr(args, "extra_min", 250), getattr(args, "extra_max", 600)
# 小标题不会是半句话：以这些标点收尾的行排除（诗句「远上寒山石径斜，」也会被排除）
HEADING_TAIL_BAN = SENTENCE_TAIL + ("，", "；", "：", "、")
# 题号行里的常见题干词：带这些的短行是题目，不能当小标题
QUESTION_WORDS = re.compile(
    r"写出|找出|文中|短文|为什么|请|说说|填空|选择|判断|解释|回答|修改|改写|"
    r"加上|补充|给|把|联系|理解|体会|关系|意思|作用|注音|组词|造句|仿写|题目|自然段"
)
EMPTY_BRACKET = re.compile(r"^[（(]\s*[)）]$")


def split_heading_title(block: dict, next_text: str = "", index: int = 0) -> tuple[str, str] | None:
    """识别合集里的小标题；返回 (标题, 同一块里标题后的正文)，不是标题返回 None。"""
    value = block["text"].strip()
    if not value:
        return None
    match = SPLIT_HEADING_CN.match(value)
    if match:
        rest = value[match.end():].strip(" 　:：、.．")
        if not rest or EMPTY_BRACKET.match(rest):
            return ("", "")
        if len(value) <= 28 and not SPLIT_QUESTIONISH.search(value):
            return (rest, "")
        # 「（一）葡萄园里葡萄架一个接一个……」这类是行内子材料，整块留给正文
        return None
    match = SPLIT_HEADING_MATERIAL.match(value)
    if match and len(value) <= 28 and not SPLIT_QUESTIONISH.search(value):
        rest = value[match.end():].strip(" 　:：、.．")
        return (rest or match.group(0).strip(" 　:：、.．"), "")
    match = SPLIT_HEADING_BRACKET.match(value)
    if match and len(value) <= 40 and not SPLIT_QUESTIONISH.search(value):
        return (match.group(1), value[match.end():].strip(" 　:：、.．"))
    match = SPLIT_DIGIT_HEADING.match(value)
    if match and len(value) <= 24 and not SPLIT_QUESTIONISH.search(value) \
            and not QUESTION_WORDS.search(value) and not value.endswith(HEADING_TAIL_BAN):
        rest = value[match.end():].strip(" 　:：、.．")
        # 编号标题下面必须紧跟一段正文；紧跟题号的是题目分组，不是新素材
        if rest and hanzi_count(next_text) >= 30 and len(next_text) >= 40 \
                and not QUESTION_BLOCK.search(next_text):
            return (rest, "")
        return None
    # 首块整块加粗通常是文章大标题，不是合集里的小标题
    if index > 0 and block.get("bold") and len(value) <= 20 \
            and not SPLIT_QUESTIONISH.search(value) and not value.endswith(HEADING_TAIL_BAN):
        return (value, "")
    return None


def main_blocks(blocks: list[dict]) -> list[dict]:
    for index, block in enumerate(blocks):
        if SPLIT_STOP.match(block["text"]):
            return blocks[:index]
    return blocks


def clean_unit_title(title: str) -> str:
    """把「阅读《X》片段，回答问题。」这类题干式标题压成素材名。"""
    value = re.sub(r"[，,]\s*回答问题[。.]?$", "", title).strip()
    value = re.sub(r"^阅读(?=[《【])", "", value).strip()
    value = re.sub(r"《\s+", "《", value)
    return value or title.strip()


def _unit_of_blocks(title: str, texts: list[str]) -> dict:
    paragraphs = local_paragraphs("\n".join(texts))
    return {
        "title": clean_unit_title(title),
        "paragraphs": paragraphs,
        "charCount": hanzi_count("".join(paragraphs)),
        "questionCount": sum(1 for line in paragraphs if QUESTION_BLOCK.search(line)),
    }


def heading_split_units(blocks: list[dict], parent_title: str) -> list[dict]:
    """按小标题切：每个标题到下一个标题之间是一个切分单元（标题下第一块算正文）。"""
    headings = []
    for index, block in enumerate(blocks):
        next_text = blocks[index + 1]["text"] if index + 1 < len(blocks) else ""
        heading = split_heading_title(block, next_text, index)
        if heading:
            headings.append((index, heading[0], heading[1]))
    # 外层分区标题（如「一、阅读古诗」）后面紧跟下一级标题、中间没有正文时，保留更细的一级
    headings = [entry for position, entry in enumerate(headings)
                if not (position + 1 < len(headings) and headings[position + 1][0] == entry[0] + 1)]
    units = []
    for position, (index, title, inline) in enumerate(headings):
        end = headings[position + 1][0] if position + 1 < len(headings) else len(blocks)
        texts = [block["text"] for block in blocks[index + 1:end]]
        if inline:
            texts.insert(0, inline)
        if position == 0 and index > 0:
            # 第一个标题之前的导语并入第一单元，避免丢正文
            texts = [block["text"] for block in blocks[:index]] + texts
        units.append(_unit_of_blocks(title or f"{parent_title}-{position + 1}", texts))
    return units


def question_group_units(blocks: list[dict], parent_title: str) -> list[dict]:
    """没有可靠小标题时，退回「题目组之前的连续正文块」：正文段 + 紧随其后的题组算一单元。"""
    prompt = re.compile(r"^(?:阅读下面的|阅读短文|阅读下文|阅读材料|【.{1,16}】)")
    indexes = [index for index, block in enumerate(blocks) if prompt.match(block["text"])]
    if len(indexes) >= 2:
        units = []
        for position, index in enumerate(indexes):
            end = indexes[position + 1] if position + 1 < len(indexes) else len(blocks)
            units.append(_unit_of_blocks(f"{parent_title}-{position + 1}",
                                         [block["text"] for block in blocks[index:end]]))
        return units

    units = []
    start = None
    in_questions = False
    for index, block in enumerate(blocks):
        text = block["text"]
        if QUESTION_BLOCK.search(text):
            if start is not None:
                in_questions = True
            continue
        if hanzi_count(text) >= 30 and len(text) >= 40:
            if start is None:
                start = index
            elif in_questions:
                units.append(_unit_of_blocks(f"{parent_title}-{len(units) + 1}",
                                             [item["text"] for item in blocks[start:index]]))
                start = index
                in_questions = False
    if start is not None:
        units.append(_unit_of_blocks(f"{parent_title}-{len(units) + 1}",
                                     [block["text"] for block in blocks[start:]]))
    return units


def split_wechat_collection(blocks: list[dict], parent_title: str, word_max: int = 500) -> dict:
    """尝试把一篇合集切成多个独立素材；边界不可靠时返回 reliable=False，由调用方标 needs-split。"""
    body = main_blocks(blocks)
    # 单元素材明显超过上限，多半是边界没找准，宁可保留整篇也不硬切
    unit_limit = max(word_max * 2, 1000)
    for method, build in (("heading", heading_split_units), ("question-group", question_group_units)):
        units = build(body, parent_title)
        if len(units) < 2:
            continue
        if method == "heading":
            reliable = all(unit["charCount"] >= 50 and len(unit["paragraphs"]) >= 2
                           and unit["charCount"] <= unit_limit for unit in units)
        else:
            reliable = all(unit["charCount"] >= 100 and len(unit["paragraphs"]) >= 2
                           and unit["charCount"] <= unit_limit and unit["questionCount"] > 0
                           for unit in units)
        if reliable:
            return {"reliable": True, "method": method, "units": units}
    return {"reliable": False, "method": None, "units": []}


def unit_html(title: str, paragraphs: list[str]) -> str:
    """把切分单元写成可被本地导出适配器重新解析的 HTML（标题 + js_content）。"""
    body = "".join(f"<p>{html_lib.escape(line)}</p>\n" for line in paragraphs)
    return ("<!doctype html><html><head><meta charset=\"utf-8\">"
            f"<title>{html_lib.escape(title)}</title></head><body>"
            f"<h1 id=\"activity-name\">{html_lib.escape(title)}</h1>"
            f"<div id=\"js_content\">\n{body}</div></body></html>")


def cmd_links(args: argparse.Namespace) -> None:
    raw = Path(args.file).read_text(encoding="utf-8", errors="ignore") if args.file else sys.stdin.read()
    links: list[str] = []
    seen: set[str] = set()
    for line in raw.splitlines():
        link = normalize_link(line)
        if link and link not in seen:
            seen.add(link)
            links.append(link)
    if not links:
        raise SystemExit("没有可用链接：请一行粘贴一条 mp.weixin.qq.com 文章链接")

    batch = args.batch or time.strftime("%Y%m%d-%H%M%S")
    batch_dir = LINK_BATCH_DIR / batch
    suffix = 1
    while not args.batch and batch_dir.exists():
        suffix += 1
        batch_dir = LINK_BATCH_DIR / f"{batch}-{suffix}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    (batch_dir / "links.txt").write_text("\n".join(links) + "\n", encoding="utf-8")
    report_path = batch_dir / "report.json"

    report: dict = {
        "version": 1,
        "batch": batch_dir.name,
        "createdAt": now(),
        "wordRange": [args.word_min, args.word_max],
        "intervalSeconds": [3, 5],
        "stats": {},
        "failReasons": {},
        "entries": [],
    }
    previous: dict[str, dict] = {}
    if report_path.is_file():
        try:
            old = json.loads(report_path.read_text(encoding="utf-8"))
            previous = {
                entry["link"]: entry
                for entry in old.get("entries", [])
                if isinstance(entry, dict) and entry.get("link")
            }
        except Exception:
            previous = {}

    data = load_sources()
    ensure_link_source(data)
    save_sources(data)

    items = load_items()
    known_urls = {item["sourceUrl"] for item in items}
    known = [{"seq": item["seq"], "fingerprint": item["fingerprint"], "simhash": item["simhash"]}
             for item in items]
    known_success = link_batch_done_links()
    seq_number = next_seq(items)

    attempts = 0
    for index, link in enumerate(links):
        entry = previous.get(link)
        if entry is not None and entry.get("status") == "ok":
            # 同一批次重跑：保留上次成功结果，不重复抓
            report["entries"].append(entry)
            continue
        if link in known_success or link in known_urls:
            report["entries"].append({
                "link": link,
                "status": "skipped",
                "reasonCategory": "已抓成功",
                "reason": "上次批次已抓成功，跳过",
                "intakeStatus": None,
                "seq": entry.get("seq") if entry else None,
            })
            continue

        base = {
            "link": link,
            "finalUrl": None,
            "title": None,
            "seq": None,
            "status": None,
            "reasonCategory": None,
            "reason": None,
            "intakeStatus": None,
            "charCount": None,
        }
        problem = link_problem(link)
        attempted = False
        try:
            if problem:
                report["entries"].append(base | {"status": "failed", "reasonCategory": "格式错误",
                                                 "reason": problem})
                continue

            try:
                html, final_url = fetch_with_curl(link)
            except LinkFetchError as error:
                attempted = True
                report["entries"].append(base | {"status": "failed", "reasonCategory": error.category,
                                                 "reason": str(error)})
                continue
            attempted = True
            base["finalUrl"] = final_url
            block = wechat_link_block_reason(html)
            if block:
                category, reason = block
                report["entries"].append(base | {"status": "failed", "reasonCategory": category,
                                                 "reason": reason})
                continue

            article = parse_local_html_text(html, fallback_title="")
            title = (article["title"] or "").strip()
            paragraphs = article["paragraphs"]
            if not paragraphs:
                report["entries"].append(base | {"status": "failed", "reasonCategory": "无正文",
                                                 "reason": "页面里没有取到 #js_content 正文"})
                continue

            text = "".join(paragraphs)
            count = hanzi_count(text)
            base["title"] = title
            base["charCount"] = count
            kind = reading_kind(title)
            word_min, word_max = word_range_for(kind, args)
            base["kind"] = kind
            fingerprint = fingerprint_of(text)
            simhash = simhash_of(text)
            duplicate = duplicate_reason(fingerprint, simhash, known)
            if duplicate:
                report["entries"].append(base | {"status": "skipped", "reasonCategory": "重复",
                                                 "reason": duplicate})
                continue

            if count < word_min:
                report["entries"].append(base | {
                    "status": "failed", "reasonCategory": "字数不符",
                    "reason": f"字数 {count}，低于 {kind} 下限 {word_min}",
                })
                continue
            if count <= word_max and len(paragraphs) < 3:
                report["entries"].append(base | {
                    "status": "failed", "reasonCategory": "分段不足",
                    "reason": f"分段 {len(paragraphs)}，少于 3 段",
                })
                continue

            parent_seq = f"RD-{seq_number:03d}"
            seq_number += 1
            archive_path = make_archive_path(LINK_SOURCE_ID, parent_seq, title or final_url, "html")
            (ROOT / archive_path).write_bytes(html.encode("utf-8"))
            item = {
                "seq": parent_seq,
                "sourceId": LINK_SOURCE_ID,
                "sourceUrl": link,
                "title": title or final_url,
                "author": None,
                "kind": kind,
                "archivePath": archive_path,
                "charCount": count,
                "fingerprint": fingerprint,
                "simhash": simhash,
                "status": "pending",
                "rejectReason": None,
                "dataId": None,
                "scannedAt": today(),
                "publishedAt": article.get("publishedAt"),
            }

            if count > word_max:
                # 超过该类上限按合集处理：切分，或整篇标 needs-split，不做字数放宽
                plan = split_wechat_collection(article.get("blocks") or [], title or final_url,
                                               word_max)
                if not plan["reliable"]:
                    item["status"] = "needs-split"
                    item["note"] = (f"正文 {count} 字，未识别出可靠的合集边界；"
                                    "保留整篇，待人工切分或补题目")
                    items.append(item)
                    known.append({"seq": parent_seq, "fingerprint": fingerprint, "simhash": simhash})
                    known_urls.add(link)
                    save_items(items)
                    report["entries"].append(base | {
                        "status": "ok", "seq": parent_seq, "intakeStatus": "needs-split",
                        "split": {"reliable": False, "attempted": True, "method": None, "units": []},
                    })
                    print(f"  ~ {parent_seq}《{title}》{count} 字 → 合集边界不可靠，标 needs-split")
                    continue

                children = []
                for unit in plan["units"]:
                    child_seq = f"RD-{seq_number:03d}"
                    seq_number += 1
                    unit_text = "".join(unit["paragraphs"])
                    child_archive = make_archive_path(LINK_SOURCE_ID, child_seq, unit["title"], "html")
                    (ROOT / child_archive).write_bytes(
                        unit_html(unit["title"], unit["paragraphs"]).encode("utf-8"))
                    child = {
                        "seq": child_seq,
                        "parentSeq": parent_seq,
                        "sourceId": LINK_SOURCE_ID,
                        "sourceUrl": link,
                        "title": unit["title"],
                        "author": None,
                        "kind": reading_kind(unit["title"], title or final_url),
                        "archivePath": child_archive,
                        "charCount": unit["charCount"],
                        "fingerprint": fingerprint_of(unit_text),
                        "simhash": simhash_of(unit_text),
                        "status": "pending",
                        "rejectReason": None,
                        "dataId": None,
                        "scannedAt": today(),
                        "publishedAt": article.get("publishedAt"),
                    }
                    children.append(child)
                item["status"] = "split"
                item["children"] = [child["seq"] for child in children]
                item["note"] = (f"合集按{'小标题' if plan['method'] == 'heading' else '题目组'}边界切出 "
                                f"{len(children)} 篇，每篇独立走 gate")
                items.extend([item] + children)
                known.append({"seq": parent_seq, "fingerprint": fingerprint, "simhash": simhash})
                for child in children:
                    known.append({"seq": child["seq"], "fingerprint": child["fingerprint"],
                                  "simhash": child["simhash"]})
                known_urls.add(link)
                save_items(items)
                report["entries"].append(base | {
                    "status": "ok", "seq": parent_seq, "intakeStatus": "split",
                    "split": {
                        "reliable": True, "attempted": True, "method": plan["method"],
                        "units": [{"seq": child["seq"], "title": child["title"],
                                   "charCount": child["charCount"], "status": "pending",
                                   "passed": None} for child in children],
                    },
                })
                print(f"  + {parent_seq}《{title}》{count} 字 → 合集切出 {len(children)} 篇："
                      + "、".join(f"{child['seq']}《{child['title']}》{child['charCount']}"
                                  for child in children))
                continue

            items.append(item)
            known.append({"seq": parent_seq, "fingerprint": fingerprint, "simhash": simhash})
            known_urls.add(link)
            save_items(items)
            report["entries"].append(base | {"status": "ok", "seq": parent_seq, "intakeStatus": "pending"})
            print(f"  + {parent_seq}《{title}》{count} 字 → 已归档，待 process")
        finally:
            if attempted:
                attempts += 1
            if attempted and index + 1 < len(links):
                # 串行，每次请求之间 3–5 秒，不并发
                time.sleep(3 + (attempts % 3))
            save_link_report(report_path, report)

    created = [entry["seq"] for entry in report["entries"] if entry.get("seq")]
    created += [unit["seq"] for entry in report["entries"]
                for unit in (entry.get("split") or {}).get("units", []) if unit.get("seq")]
    if created:
        cmd_process(argparse.Namespace(
            limit=max(len(created) + 20, 50), source=LINK_SOURCE_ID, require_answer=False,
            intext_min=args.intext_min, intext_max=args.intext_max,
            extra_min=args.extra_min, extra_max=args.extra_max,
        ))
        items_by_seq = {item["seq"]: item for item in load_items()}
        for entry in report["entries"]:
            if entry.get("status") != "ok":
                continue
            # 合集：父条目只留切分关系，入库/待命题按每个切分单元分别统计
            for unit in (entry.get("split") or {}).get("units", []):
                child = items_by_seq.get(unit.get("seq"))
                if child is None:
                    continue
                unit["status"] = child["status"]
                unit["charCount"] = child.get("charCount", unit.get("charCount"))
                unit["passed"] = child["status"] == "imported"
                unit["wordPassed"] = child["status"] in {
                    "imported", "no-answer", "needs-redline"}
                reason = child.get("rejectReason") or child.get("note")
                if reason:
                    unit["reason"] = reason
            seq = entry.get("seq")
            if not seq:
                continue
            item = items_by_seq.get(seq)
            if item is None:
                continue
            entry["intakeStatus"] = item["status"]
            entry["charCount"] = item.get("charCount", entry.get("charCount"))
            if item["status"] == "rejected":
                entry["status"] = "failed"
                entry["reasonCategory"] = "入库被拒"
                entry["reason"] = item.get("rejectReason") or "入库被拒"

    data = load_sources()
    ensure_link_source(data)
    next(entry for entry in data["sources"] if entry["id"] == LINK_SOURCE_ID)["lastScanAt"] = today()
    save_sources(data)

    save_link_report(report_path, report)
    stats = report["stats"]
    print(f"batch {batch_dir.name}：成功 {stats['success']}（入库 {stats['imported']}，"
          f"待命题 {stats['pendingQuestions']}），跳过 {stats['skipped']}，失败 {stats['failed']}")
    if stats.get("splitArticles") or stats.get("needsSplit"):
        print(f"  合集：已切分 {stats['splitArticles']} 篇 → {stats['splitUnits']} 段；"
              f"字数/分段合格 {stats['splitWordPassed']} 段，完整过 gate {stats['splitPassed']} 段；"
              f"待切分 {stats['needsSplit']} 篇")
    for reason, amount in report["failReasons"].items():
        print(f"  失败原因 {reason}：{amount}")
    print(f"{LINK_REPORT_MARK}{report_path}")


# ---------------------------------------------------------------- process

def cmd_process(args: argparse.Namespace) -> None:
    items = load_items()
    cache = load_cache()
    pending = sorted(
        (item for item in items if item["status"] in {"pending", "no-answer", "no-questions", "needs-redline"}),
        key=lambda item: item["seq"],
    )
    if getattr(args, "source", None):
        pending = [item for item in pending if item["sourceId"] == args.source]
    pending = pending[:args.limit]
    if not pending:
        print("没有待处理素材。")
        return

    data = load_sources()
    sources = {source["id"]: source for source in data["sources"]}
    imported_titles = {reading["title"] for reading in cache}
    imported_ids = {reading["id"] for reading in cache}
    imported_count = rejected_count = no_answer_count = no_questions_count = redline_count = 0

    for item in pending:
        source = sources.get(item["sourceId"])
        archive_file = ROOT / item["archivePath"]
        if source is None or not archive_file.exists():
            item["status"] = "rejected"
            item["rejectReason"] = "归档缺失或来源不存在"
            save_items(items)
            rejected_count += 1
            print(f"  × {item['seq']}《{item['title']}》—— 归档缺失或来源不存在")
            continue

        article = adapter_for(source).parse_original(archive_file.read_bytes(), {
            "url": item["sourceUrl"], "title": item["title"], "archivePath": item["archivePath"],
        })
        text = "".join(article["paragraphs"])
        count = hanzi_count(text)
        item["charCount"] = count

        def reject(reason: str) -> None:
            nonlocal rejected_count
            item["status"] = "rejected"
            item["rejectReason"] = reason
            item["dataId"] = None
            item.pop("note", None)
            item["qa"] = {"mustFix": 0, "benign": 0}
            save_items(items)
            rejected_count += 1
            print(f"  × {item['seq']}《{item['title']}》—— {reason}")

        if not article["paragraphs"]:
            reject("正文提取失败")
            continue
        sidecar = CATALOG_DIR / "archive" / item["sourceId"] / "questions" / f"{item['seq']}.json"
        # 本地导出常混入招生、活动通知等非阅读稿：没有题目形态就留正文，不判拒稿
        if source.get("adapter") == "local" and not sidecar.exists() \
                and not QUESTION_MARKERS.search("\n".join(article["paragraphs"])):
            item["status"] = "no-questions"
            item["rejectReason"] = None
            item["dataId"] = None
            item["note"] = "正文未发现题目形态，保留正文供以后人工命题"
            save_items(items)
            no_questions_count += 1
            print(f"  ? {item['seq']}《{item['title']}》无题目形态（no-questions），正文保留")
            continue
        word_min = getattr(args, "word_min", 300)
        word_max = getattr(args, "word_max", 500)
        parent = next((other for other in items if other["seq"] == item.get("parentSeq")), None)
        kind = item.get("kind") or reading_kind(item["title"], parent["title"] if parent else "")
        item["kind"] = kind
        word_min, word_max = word_range_for(kind, args)
        if count < word_min:
            reject(f"字数 {count}，低于 {kind} 下限 {word_min}")
            continue
        if count > word_max:
            # 超出上限只标出，不拒收；实际字数保留在 charCount
            item["wordFlag"] = "over"
            item["note"] = f"字数 {count}，超过 {kind} 上限 {word_max}，已标出但保留"
        else:
            item.pop("wordFlag", None)
        if len(article["paragraphs"]) < 3:
            reject(f"分段 {len(article['paragraphs'])}，少于 3 段")
            continue
        if item["title"] in imported_titles:
            reject("标题与已入库短文重复")
            continue
        duplicate = duplicate_reason(item["fingerprint"], item["simhash"],
                                     [other for other in items if other["seq"] != item["seq"]])
        if duplicate:
            reject(duplicate)
            continue

        if not sidecar.exists():
            item["status"] = "no-answer"
            item["rejectReason"] = None
            item["dataId"] = None
            item["note"] = "正文已提取且合格，缺题目/答案；补 questions/<seq>.json 后重跑"
            save_items(items)
            no_answer_count += 1
            print(f"  … {item['seq']}《{item['title']}》正文合格，缺题目/答案（no-answer）")
            continue

        questions = json.loads(sidecar.read_text(encoding="utf-8"))["questions"]
        reading = {
            "id": item["seq"],
            "title": item["title"],
            "kind": kind,
            "theme": "寓言",
            "paragraphs": article["paragraphs"],
            "status": "verified",
            "sources": [{
                "label": "中国寓言网·现代寓言（转载，版权归原作者）"
                if source["id"] == "chinafable" else f"{source['name']}（本地导出）",
                "url": item["sourceUrl"],
                "locator": item["seq"],
            }],
            "questions": questions,
            "review": (
                f"gate.py 机械复核通过：正文 {count} 字；指纹 {item['fingerprint'][:18]}…；"
                f"题目答案与引文逐字回原文核对。来源页：{item['sourceUrl']}"
            ),
        }
        redline = redline_inspect(reading)
        benign = sum(entry["count"] for entry in redline["benign"])
        item["qa"] = {"mustFix": len(redline["blocking"]), "benign": benign}
        if redline["blocking"]:
            def describe(entry: dict) -> str:
                if entry["candidates"]:
                    where = f"（第 {entry['paragraph']} 段）" if entry.get("paragraph") else ""
                    return f"{entry['source']}“{entry['target']}”原文作“{entry['candidates'][0]}”{where}"
                return f"{entry['source']}“{entry['target']}”在原文找不到，也没有近似片段"

            item["status"] = "needs-redline"
            item["rejectReason"] = None
            item["dataId"] = None
            item["note"] = "红线待核 " + "；".join(describe(entry) for entry in redline["blocking"][:4])
            save_items(items)
            redline_count += 1
            print(f"  ! {item['seq']}《{item['title']}》{item['note']}")
            continue

        failures = [f"{name} {detail}".strip() for name, ok, detail in gate_check(reading) if not ok]
        if failures:
            reject("gate.py 未通过：" + "；".join(failures[:6]))
            continue
        notes = gate_hints(reading)
        reading["review"] += f" 红线错字 0 处；非红线瑕疵 {benign} 处，放过并计数。"
        if notes:
            reading["review"] += " 提示：" + "；".join(notes) + "。"

        cache.append(reading)
        imported_titles.add(reading["title"])
        imported_ids.add(reading["id"])
        save_cache(cache)
        write_imported_ts(cache)
        item["status"] = "imported"
        item["rejectReason"] = None
        item["dataId"] = item["seq"]
        item.pop("note", None)
        save_items(items)
        imported_count += 1
        print(f"  √ {item['seq']}《{item['title']}》{count} 字 {len(questions)} 题")

    print(f"process 完成：入库 {imported_count}，缺答案 {no_answer_count}，无题目 {no_questions_count}，"
          f"待核错字 {redline_count}，拒收 {rejected_count}，累计入库 {len(cache)} 篇。")


# ---------------------------------------------------------------- job

def read_job(path: Path, data: dict) -> dict:
    """读取面板任务单，并把 camelCase/snake_case 统一成执行器字段。"""
    raw = json.loads(path.read_text(encoding="utf-8"))
    sources = raw.get("sources", raw.get("sourceIds", []))
    source_ids = [entry["id"] if isinstance(entry, dict) else entry for entry in sources]
    known = {source["id"] for source in data["sources"]}
    unknown = [source_id for source_id in source_ids if source_id not in known]
    return {
        "id": raw.get("id") or path.stem,
        "targetCount": int(raw.get("targetCount", raw.get("target_count", 20))),
        "wordMin": int(raw.get("wordMin", raw.get("word_min", 300))),
        "wordMax": int(raw.get("wordMax", raw.get("word_max", 500))),
        "requireAnswer": bool(raw.get("requireAnswer", raw.get("require_answer", False))),
        "sourceIds": source_ids,
        "unknownSources": unknown,
        "raw": raw,
    }


def cmd_job(args: argparse.Namespace) -> None:
    path = Path(args.job_file)
    data = load_sources()
    job = read_job(path, data)
    before = sum(1 for item in load_items() if item["status"] == "imported")

    if not args.no_scan:
        for source_id in job["sourceIds"]:
            source = next(entry for entry in data["sources"] if entry["id"] == source_id)
            if source.get("adapter") == "none" or source["status"] == "unavailable":
                print(f"来源 {source_id} 不可扫描：{source['note']}")
                continue
            cmd_scan(argparse.Namespace(
                source_id=source_id, pages=args.pages, max_items=args.max_items, delay=args.delay,
            ))

    cmd_process(argparse.Namespace(
        limit=job["targetCount"], word_min=job["wordMin"], word_max=job["wordMax"],
        require_answer=job["requireAnswer"],
    ))
    after = sum(1 for item in load_items() if item["status"] == "imported")
    added = after - before
    gap = max(0, job["targetCount"] - added)

    reasons = []
    if job["unknownSources"]:
        reasons.append("未知来源 id：" + ",".join(job["unknownSources"]))
    if gap:
        reasons.append(f"目标 {job['targetCount']} 篇，本轮新增 {added} 篇，缺口 {gap} 篇")
        unavailable = [source["id"] for source in data["sources"]
                       if source["id"] in job["sourceIds"] and source["status"] == "unavailable"]
        if unavailable:
            reasons.append("不可用来源：" + ",".join(unavailable))
    job["raw"]["status"] = "done" if gap == 0 else "partial"
    job["raw"]["result"] = {
        "added": added,
        "gap": gap,
        "inventory": after,
        "reasons": reasons,
        "updatedAt": now(),
    }
    path.write_text(json.dumps(job["raw"], ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"job {job['id']}：新增 {added}，库存 {after}，状态 {job['raw']['status']}")
    for reason in reasons:
        print(f"  原因：{reason}")


# ---------------------------------------------------------------- report

def cmd_report(_args: argparse.Namespace) -> None:
    data = load_sources()
    items = load_items()
    counts = {key: 0 for key in ("pending", "imported", "rejected", "no-answer", "no-questions", "needs-redline")}
    per_source: dict[str, dict[str, int]] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
        bucket = per_source.setdefault(item["sourceId"], {key: 0 for key in counts})
        bucket[item["status"]] = bucket.get(item["status"], 0) + 1
    must_fix = sum(item.get("qa", {}).get("mustFix", 0) for item in items)
    benign = sum(item.get("qa", {}).get("benign", 0) for item in items)

    print(f"素材目录：{CATALOG_DIR}")
    print(f"总量 {len(items)}｜已入库 {counts['imported']}｜待处理 {counts['pending']}"
          f"｜缺答案 {counts['no-answer']}｜无题目 {counts['no-questions']}"
          f"｜待核错字 {counts['needs-redline']}｜已拒 {counts['rejected']}")
    print(f"质量：影响判分（必须修）{must_fix} 处｜不影响判分（放过）{benign} 处")
    print("来源：")
    for source in data["sources"]:
        bucket = per_source.get(source["id"], {key: 0 for key in counts})
        remaining = source.get("remainingPages")
        if remaining is None and source.get("pagination", {}).get("totalPages") is not None:
            remaining = max(0, source["pagination"]["totalPages"] - source["pagination"].get("lastPage", 0))
        state = "本地目录" if source.get("adapter") == "local" else {
            "exhausted": "已穷尽",
            "unavailable": "不可用",
            "not-applicable": "不适合",
            "manual": "人工投递",
        }.get(source["status"], f"待翻 {remaining if remaining is not None else '?'} 页")
        total = sum(bucket.get(key, 0) for key in counts)
        print(f"  {source['id']:<14} {state:<10} 条目 {total:>3}｜入库 {bucket['imported']}"
              f"｜待处理 {bucket['pending']}｜缺答案 {bucket['no-answer']}"
              f"｜无题目 {bucket['no-questions']}｜待核错字 {bucket['needs-redline']}"
              f"｜已拒 {bucket['rejected']}"
              f"｜最近扫描 {source.get('lastScanAt') or '未扫描'}")
        if source["status"] in {"unavailable", "not-applicable"}:
            print(f"    原因：{source['note']}")

    reasons: dict[str, int] = {}
    for item in items:
        if item["status"] == "rejected" and item.get("rejectReason"):
            key = re.sub(r"与 .*?高度近似（simhash 距离 \d+）", "与已有素材近似", item["rejectReason"])
            key = re.sub(r"字数 \d+，", "字数", key)
            reasons[key] = reasons.get(key, 0) + 1
    if reasons:
        print("拒收原因：")
        for reason, amount in sorted(reasons.items(), key=lambda pair: -pair[1]):
            print(f"  {amount} 篇：{reason}")


def main() -> None:
    parser = argparse.ArgumentParser(description="阅读素材目录与收集流水线")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan = subparsers.add_parser("scan", help="枚举来源列表页并归档原件；--local 扫描本地导出目录")
    scan.add_argument("source_id", nargs="?", default=None)
    scan.add_argument("--local", metavar="目录", help="公众号导出目录，递归识别 .html/.pdf/.txt/.md")
    scan.add_argument("--exporter", default="公众号导出", help="导出工具名，没有原文链接时写进 sourceUrl 便于追溯")
    scan.add_argument("--pages", type=int, default=1)
    scan.add_argument("--max-items", type=int, default=40)
    scan.add_argument("--delay", type=int, default=800, help="每条之间的等待毫秒数")
    scan.set_defaults(func=cmd_scan)

    links = subparsers.add_parser("links", help="批量链接：逐条 curl 取公众号正文并走入库流水线")
    links.add_argument("--file", help="链接清单（一行一条）；缺省从标准输入读")
    links.add_argument("--batch", help="批次目录名，默认按当前时间新建")
    links.add_argument("--intext-min", type=int, default=150, help="课内片段字数下限")
    links.add_argument("--intext-max", type=int, default=400, help="课内片段字数上限")
    links.add_argument("--extra-min", type=int, default=250, help="课外短文段字数下限")
    links.add_argument("--extra-max", type=int, default=600, help="课外短文段字数上限")
    links.set_defaults(func=cmd_links)

    process = subparsers.add_parser("process", help="提取正文并跑 gate.py 质检入库")
    process.add_argument("--limit", type=int, default=5)
    process.add_argument("--source", help="只处理指定来源（如 local-export）")
    process.add_argument("--intext-min", type=int, default=150)
    process.add_argument("--intext-max", type=int, default=400)
    process.add_argument("--extra-min", type=int, default=250)
    process.add_argument("--extra-max", type=int, default=600)
    process.add_argument("--require-answer", action="store_true")
    process.set_defaults(func=cmd_process)

    job = subparsers.add_parser("job", help="读取界面任务单并执行一轮收集")
    job.add_argument("job_file")
    job.add_argument("--pages", type=int, default=2, help="每个可扫描来源本轮翻页数")
    job.add_argument("--max-items", type=int, default=20, help="每个来源本轮最多新增条目")
    job.add_argument("--delay", type=int, default=800)
    job.add_argument("--no-scan", action="store_true", help="跳过扫描，只处理已有待办")
    job.set_defaults(func=cmd_job)

    report = subparsers.add_parser("report", help="输出库存与来源状态")
    report.set_defaults(func=cmd_report)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
