#!/usr/bin/env python3
"""公众号搜索引擎索引：候选链接枚举与命中率实测。

路线：搜狗微信搜索（按关键词 + 分页）拿 /link?url=... 包装链接，
解析包装页里的 JS 片段还原 mp.weixin.qq.com 文章地址，再按正常浏览器
UA + Referer 抓正文。只读取公开页面，不登录、不伪造凭证、不绕验证。

用法：
  python3 wechat_probe.py --limit 50 --out data/reading-catalog/wechat-probe.json
  python3 wechat_probe.py --limit 50 --dry-run          # 只枚举，不抓正文

失败分类：
  success   正文容器非空
  verify    环境异常/验证码/访问过于频繁
  hard403   硬 403
  notfound  404
  empty     #js_content 存在但没有可用段落
  network   超时/连接失败等
"""
from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar
from pathlib import Path

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
REFERER = "https://mp.weixin.qq.com/"
SEARCH_BASE = "https://weixin.sogou.com/weixin"
KEYWORDS = [
    "三年级 阅读理解",
    "三年级 课外阅读",
    "小学语文 阅读短文 答案",
    "三年级上册 阅读训练",
    "三年级 语文 阅读题",
]
VERIFY_MARKS = ("环境异常", "请输入验证码", "访问过于频繁", "antispider", "请在微信客户端打开")


def make_opener() -> urllib.request.OpenerDirector:
    # macOS 自带 Python 没有可用的根证书；这里只读取公开文章，使用不校验证书上下文。
    context = ssl._create_unverified_context()
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=context),
        urllib.request.HTTPCookieProcessor(jar),
    )


def get(opener, url: str, referer: str, timeout: int = 25) -> tuple[int, bytes, str]:
    request = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": referer,
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })
    with opener.open(request, timeout=timeout) as response:
        return response.status, response.read(), response.geturl()


def search_page(opener, keyword: str, page: int) -> tuple[str, list[tuple[str, str]]]:
    query = urllib.parse.urlencode({"type": 2, "query": keyword, "page": page})
    url = f"{SEARCH_BASE}?{query}"
    _, data, _ = get(opener, url, "https://weixin.sogou.com/")
    text = data.decode("utf-8", "ignore")
    links = [html.unescape(link) for link in re.findall(r'href="(/link\?url=[^"]+)"', text)]
    titles = re.findall(r'<h3>\s*<a[^>]*>(.*?)</a>', text, re.S)
    titles = [re.sub(r"<[^>]+>", "", html.unescape(title)).strip() for title in titles]
    entries = []
    for index, link in enumerate(dict.fromkeys(links)):
        title = titles[index] if index < len(titles) else ""
        entries.append((f"https://weixin.sogou.com{link}", title))
    return text, entries


def resolve(opener, wrapped: str) -> tuple[str | None, str]:
    """还原 /link 包装页里的 mp.weixin.qq.com 地址；返回 (url, 失败原因)。"""
    safe = wrapped.replace(" ", "%20")
    try:
        _, data, final = get(opener, safe, "https://weixin.sogou.com/")
    except urllib.error.HTTPError as error:
        return None, f"http-{error.code}"
    except Exception as error:
        return None, f"network:{type(error).__name__}"
    text = data.decode("utf-8", "ignore")
    if "antispider" in final:
        return None, "verify"
    parts = re.findall(r"url \+= '([^']*)';", text)
    if not parts:
        return None, "verify" if any(mark in text for mark in VERIFY_MARKS) else "no-redirect"
    return "".join(parts).replace("@", ""), ""


def extract_article(text: str) -> tuple[str, list[str]]:
    title_match = re.search(r'id="activity-name"[^>]*>(.*?)</', text, re.S)
    title = re.sub(r"<[^>]+>", "", html.unescape(title_match.group(1))).strip() if title_match else ""
    block = re.search(r'id="js_content"[^>]*>(.*?)</div>', text, re.S)
    if not block:
        return title, []
    container = block.group(1)
    fragments = re.findall(r"<(?:p|section)[^>]*>(.*?)</(?:p|section)>", container, re.S)
    paragraphs = []
    for fragment in fragments:
        plain = re.sub(r"<[^>]+>", "", html.unescape(fragment)).replace("\u200b", "").strip()
        if plain:
            paragraphs.append(re.sub(r"\s+", "", plain))
    if not paragraphs:
        plain = re.sub(r"<[^>]+>", "", html.unescape(container)).replace("\u200b", "").strip()
        if plain:
            paragraphs = [re.sub(r"\s+", "", plain)]
    return title, paragraphs


def fetch_article(opener, url: str) -> tuple[str, dict]:
    try:
        status, data, final = get(opener, url, REFERER)
    except urllib.error.HTTPError as error:
        kind = "notfound" if error.code == 404 else "hard403" if error.code == 403 else f"http-{error.code}"
        return kind, {"httpStatus": error.code, "url": url}
    except Exception as error:
        return "network", {"error": f"{type(error).__name__}: {error}", "url": url}
    text = data.decode("utf-8", "ignore")
    if status == 404:
        return "notfound", {"httpStatus": status, "url": final}
    if status == 403:
        return "hard403", {"httpStatus": status, "url": final}
    if any(mark in text for mark in VERIFY_MARKS):
        return "verify", {"httpStatus": status, "url": final}
    title, paragraphs = extract_article(text)
    if not paragraphs:
        return "empty", {"httpStatus": status, "title": title, "url": final}
    return "success", {"httpStatus": status, "title": title, "paragraphs": len(paragraphs),
                       "chars": sum(len(re.findall(r"[\u4e00-\u9fff]", p)) for p in paragraphs),
                       "url": final}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--out", default="data/reading-catalog/wechat-probe.json")
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    opener = make_opener()
    candidates: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    stop = False
    for keyword in KEYWORDS:
        for page in (1, 2, 3):
            if stop or len(candidates) >= args.limit:
                break
            try:
                _, entries = search_page(opener, keyword, page)
            except Exception as error:
                print(f"搜索失败 {keyword} p{page}: {type(error).__name__}", file=sys.stderr)
                continue
            if not entries:
                break
            for wrapped, title in entries:
                if len(candidates) >= args.limit:
                    break
                key = re.sub(r"token=[^&]+", "", wrapped)
                if key in seen:
                    continue
                seen.add(key)
                candidates.append((wrapped, title, keyword))
            time.sleep(args.delay)
        if stop or len(candidates) >= args.limit:
            break

    print(f"候选 {len(candidates)} 条（目标 {args.limit}）")
    if args.dry_run:
        for wrapped, title, keyword in candidates[:10]:
            print(f"  [{keyword}] {title[:30]} {wrapped[:70]}")
        return

    results = []
    counts = {kind: 0 for kind in ("success", "verify", "hard403", "notfound", "empty", "network")}
    consecutive_verify = 0
    for index, (wrapped, title, keyword) in enumerate(candidates, start=1):
        url, reason = resolve(opener, wrapped)
        if not url:
            kind = "verify" if reason == "verify" else "network"
            counts[kind] += 1
            results.append({"index": index, "kind": kind, "reason": reason, "title": title, "keyword": keyword})
            consecutive_verify = consecutive_verify + 1 if kind == "verify" else 0
        else:
            kind, detail = fetch_article(opener, url)
            counts[kind] += 1
            results.append({"index": index, "kind": kind, "keyword": keyword, "title": title, **detail})
            consecutive_verify = consecutive_verify + 1 if kind == "verify" else 0
        print(f"{index:>2}/{len(candidates)} {kind:<8} {title[:28]}")
        if consecutive_verify >= 3:
            print("连续 3 条撞验证，按约定停止，不硬闯。")
            break
        time.sleep(args.delay)

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "limit": args.limit,
        "attempted": len(results),
        "counts": counts,
        "results": results,
        "keywords": KEYWORDS,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("分布：" + "，".join(f"{kind} {count}" for kind, count in counts.items()))


if __name__ == "__main__":
    main()
