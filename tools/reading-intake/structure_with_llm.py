#!/usr/bin/env python3
"""用 OpenAI 兼容接口把已识别的文本整理成 ChineseReading 结构（路线 2/3 的结构化环节）。

用法：
  export MIMO_BASE_URL=http://127.0.0.1:4099/v1
  export MIMO_MODEL=deepseek/deepseek-v4-pro
  export MIMO_API_KEY=...            # 由 `mimo llm-server issue` 签发，勿写入仓库
  python3 structure_with_llm.py work/.../cleaned.txt --out work/.../structured.json

注意：本脚本不生成答案。原文没有答案时，answer/explain/scoring 一律留空并标 pending，
避免模型编造。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request
from pathlib import Path

SCHEMA = """{
  "id": "RD-xx",
  "title": "短文标题",
  "theme": "写人|写景|写事|状物|寓言|科普 之一",
  "paragraphs": ["逐段原文，不含段首序号"],
  "questions": [
    {"type":"choice","stem":"题干","options":["A项","B项","C项","D项"],"answer":0,"explain":"原文依据"},
    {"type":"fill","stem":"题干，空位统一写成（ ）","blanks":["答案1"],"explain":"原文依据"},
    {"type":"short","stem":"题干","answer":"参考答案","scoring":["评分点1","评分点2"]}
  ]
}"""

PROMPT = """你是语文教材编辑。下面是一篇小学三年级阅读短文的识别文本。
请只做结构整理，不做改写，不要补全原文，不要编造答案。

规则：
1. 正文按段落拆开，去掉段首的 ①②③ 序号；保留原文用字，包括括号里的拼音。
2. 题目单独放 questions，type 只能是 choice / fill / short。
3. 选择题 options 恰好 4 个，answer 为正确项下标（0 起）；没有答案时 answer 写 -1，explain 写 ""。
4. 填空题把空位统一写成（ ），blanks 按顺序列出；没有答案时 blanks 写 []。
5. 简答题 answer/scoring 没有答案时写 "" / []。
6. 如果原文里没有答案，不要猜。
7. 只输出 JSON，不要 markdown 代码块，不要解释。

输出结构：
""" + SCHEMA + """

识别文本：
"""


def call_api(text: str, timeout: int) -> tuple[str, float]:
    base = os.environ.get("MIMO_BASE_URL", "http://127.0.0.1:4099/v1").rstrip("/")
    model = os.environ.get("MIMO_MODEL", "deepseek/deepseek-v4-pro")
    key = os.environ["MIMO_API_KEY"]
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": PROMPT + text}],
        "temperature": 0,
        "max_tokens": 16000,
    }
    request = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    started = time.time()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = json.loads(response.read())
    elapsed = time.time() - started
    message = data["choices"][0]["message"]
    return (message.get("content") or ""), elapsed


def strip_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


def validate(obj: dict) -> list[str]:
    problems: list[str] = []
    for key in ("id", "title", "theme", "paragraphs", "questions"):
        if key not in obj:
            problems.append(f"缺字段 {key}")
    if not isinstance(obj.get("paragraphs"), list) or len(obj.get("paragraphs", [])) < 2:
        problems.append("段落少于 2 段")
    questions = obj.get("questions") or []
    if not (3 <= len(questions) <= 6):
        problems.append(f"题量 {len(questions)} 不在 3–6")
    for index, question in enumerate(questions, start=1):
        if question.get("type") == "choice":
            if len(question.get("options") or []) != 4:
                problems.append(f"第 {index} 题选项不是 4 个")
            if not (-1 <= question.get("answer", -1) < 4):
                problems.append(f"第 {index} 题 answer 越界")
        elif question.get("type") == "fill":
            blanks = question.get("blanks") or []
            holes = question.get("stem", "").count("（ ）")
            if blanks and holes != len(blanks):
                problems.append(f"第 {index} 题空位 {holes} 个但答案 {len(blanks)} 个")
        elif question.get("type") == "short":
            if not question.get("answer"):
                problems.append(f"第 {index} 题无参考答案（需人工补）")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    text = Path(args.input).read_text(encoding="utf-8")
    content, elapsed = call_api(text, args.timeout)
    cleaned = strip_fence(content)
    try:
        obj = json.loads(cleaned)
        problems = validate(obj)
    except json.JSONDecodeError as error:
        obj = None
        problems = [f"不是合法 JSON：{error}"]

    result = {
        "model": os.environ.get("MIMO_MODEL", "deepseek/deepseek-v4-pro"),
        "machine_seconds": round(elapsed, 2),
        "valid_json": obj is not None,
        "problems": problems,
        "data": obj,
        "raw": content,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "machine_seconds": result["machine_seconds"],
        "valid_json": result["valid_json"],
        "problems": problems,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
