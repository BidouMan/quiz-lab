#!/usr/bin/env python3
"""默认结构切分：Vision 文字块 -> 模型只输出段号 -> 程序回填原文。

设计依据（locate_experiment.py 实测 3 篇）：模型只输出段号，原文由程序按段号
取回，因此「原文没有被模型改写」可以逐字证明。规则切分降级为兜底。

流程：
  intake.py clean -> clean.txt
  intake.py blocks clean.txt --out work/x      # 导出 work/x/blocks.json
  locate_with_llm.py work/x/blocks.json --out work/x/structured.json

输出：
  structured.json  {"title","passage","questions":[...], "structureSource", "fallbackReason"}
  blocks.json      {"blocks":[...]}（clean 后按空行切块，编号从 1 起）

模型失败（超时、空正文、非法 JSON、输出汉字、校验不过）时自动回退规则切分，
并在 structureSource/fallbackReason 里写明原因，不阻塞后续入库。

环境变量：MIMO_BASE_URL / MIMO_MODEL / MIMO_API_KEY（OpenAI 兼容接口）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARA_MARK = re.compile(r"^[①②③④⑤⑥⑦⑧⑨⑩]")
QUESTION_NO = re.compile(r"^(\d+)[.、]")

PROMPT = """下面是语文试卷的文字块序列，每块前面是编号。请只做「切分和定位」，不要抄写原文。

输出 JSON：
{"title": [段号...], "passage": [段号...], "questions": [{"no": 1, "stem": [段号...], "options": [段号...], "answer_from": null}]}

规则：
1. title 只放短文标题所在块；passage 只放短文正文段落；大题说明、题号、泡泡框提示、页眉都不要放。
2. stem 放题干所在块；options 放选项或小题所在块（没有就给 []）。
3. 一篇短文只对应它自己的题；如果开头有上一篇残留下来的题，不要收进来。
4. 所有值只能是段号、题号或 null，禁止出现任何原文汉字。
5. 只输出 JSON，不要解释，不要 markdown。

文字块：
"""


def load_blocks(path: Path) -> list[str]:
    """兼容 blocks.json 或 clean.txt。"""
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        payload = json.loads(text)
        return [str(block).strip() for block in payload["blocks"] if str(block).strip()]
    return [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]


def export_blocks(clean_path: Path, out_dir: Path) -> Path:
    blocks = load_blocks(clean_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "blocks.json"
    path.write_text(json.dumps({"blocks": blocks}, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def call_model(blocks: list[str], timeout: int) -> tuple[str, float]:
    base = os.environ.get("MIMO_BASE_URL", "http://127.0.0.1:4099/v1").rstrip("/")
    model = os.environ.get("MIMO_MODEL", "deepseek/deepseek-flash")
    key = os.environ.get("MIMO_API_KEY")
    if not key:
        raise RuntimeError("未设置 MIMO_API_KEY")
    numbered = "\n".join(f"[{index}] {text}" for index, text in enumerate(blocks, start=1))
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": PROMPT + numbered}],
        "temperature": 0,
        "max_tokens": 8000,
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
    message = (data.get("choices") or [{}])[0].get("message") or {}
    return (message.get("content") or ""), elapsed


def parse_json(text: str) -> dict | None:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip()).strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def model_wrote_text(value) -> bool:
    """递归检查模型输出里有没有汉字：有就说明它没遵守“只输出段号”。"""
    if isinstance(value, str):
        return bool(re.search(r"[\u4e00-\u9fff]", value))
    if isinstance(value, list):
        return any(model_wrote_text(item) for item in value)
    if isinstance(value, dict):
        return any(model_wrote_text(item) for item in value.values())
    return False


def model_segments(blocks: list[str], timeout: int, retries: int) -> tuple[dict | None, dict]:
    """调用模型并重试；返回 (locator, meta)。空正文/非法 JSON 都算失败。"""
    meta = {"seconds": 0.0, "attempts": 0, "wroteText": None}
    for attempt in range(1, retries + 1):
        meta["attempts"] = attempt
        try:
            raw, elapsed = call_model(blocks, timeout)
        except Exception as error:  # 网络/鉴权/接口异常都回退，不静默
            meta["error"] = f"{type(error).__name__}: {error}"
            continue
        meta["seconds"] = round(meta["seconds"] + elapsed, 2)
        parsed = parse_json(raw)
        meta["rawHead"] = raw[:80]
        if parsed is None:
            continue
        meta["wroteText"] = model_wrote_text(parsed)
        if meta["wroteText"]:
            continue
        return parsed, meta
    return None, meta


def validate(locator: dict, blocks: list[str]) -> list[str]:
    """回填前的硬校验；只认段号，不认模型写的原文。"""
    problems: list[str] = []
    total = len(blocks)
    if model_wrote_text(locator):
        problems.append("模型输出包含汉字，不是纯段号")
        return problems

    def bad_ids(value) -> bool:
        return not isinstance(value, int) or not (1 <= value <= total)

    segments: dict[int, int] = {}   # 段号 -> 出现次数
    question_blocks: dict[int, int] = {}  # 段号 -> 题号（查跨题重复）

    def collect(ids, question_no: int | None) -> None:
        for block_id in ids if isinstance(ids, list) else []:
            if bad_ids(block_id):
                problems.append(f"段号越界：{block_id}")
                continue
            segments[block_id] = segments.get(block_id, 0) + 1
            if question_no is not None:
                owner = question_blocks.get(block_id)
                if owner is not None and owner != question_no:
                    problems.append(f"段号 {block_id} 同时出现在第 {owner} 题和第 {question_no} 题")
                question_blocks[block_id] = question_no

    if not isinstance(locator.get("title"), list):
        problems.append("缺少 title 段号")
    collect(locator.get("title", []), None)
    collect(locator.get("passage", []), None)
    questions = locator.get("questions")
    if not isinstance(questions, list) or not questions:
        problems.append("questions 为空")
        questions = []
    for index, question in enumerate(questions, start=1):
        no = question.get("no")
        if no != index:
            problems.append(f"题号不连续：第 {index} 个题号是 {no}")
        collect(question.get("stem", []), index)
        collect(question.get("options", []), index)

    # ①–⑥ 段号标记必须全覆盖且只出现一次
    markers = [i for i, block in enumerate(blocks, start=1) if PARA_MARK.match(block)]
    missing = [i for i in markers if segments.get(i, 0) == 0]
    duplicated = sorted(i for i in markers if segments.get(i, 0) > 1)
    if missing:
        problems.append(f"题号标记未覆盖：{missing}")
    if duplicated:
        problems.append(f"题号标记重复：{duplicated}")

    # 除合法的 stem/options 同块外，段号不应在同一题内重复
    for question in questions:
        stem = set(question.get("stem", []))
        options = [i for i in question.get("options", []) if i not in stem]
        if len(set(question.get("stem", []))) != len(question.get("stem", [])):
            problems.append(f"第 {question.get('no')} 题题干重复引用同一段")
        if len(set(options)) != len(options):
            problems.append(f"第 {question.get('no')} 题选项重复引用同一段")
    return problems


def rule_split(blocks: list[str]) -> dict:
    """兜底：题号正则切分；正文取 ①–⑩ 开头的块，题内子块按顺序归入。"""
    first_marker = next((i for i, block in enumerate(blocks) if PARA_MARK.match(block)), None)
    title = [first_marker - 1] if first_marker and first_marker >= 2 else []

    boundary = len(blocks) + 1
    for index, block in enumerate(blocks, start=1):
        if QUESTION_NO.match(block):
            boundary = index
            break
    passage = [
        index for index in range(1, boundary)
        if PARA_MARK.match(blocks[index - 1])
    ]
    questions = []
    current = None
    for index in range(boundary, len(blocks) + 1):
        block = blocks[index - 1]
        match = QUESTION_NO.match(block)
        if match:
            current = {"no": len(questions) + 1, "stem": [index], "options": []}
            questions.append(current)
        elif current:
            current["options"].append(index)
    return {"title": title, "passage": passage, "questions": questions}


def assemble(locator: dict, blocks: list[str]) -> dict:
    def take(ids) -> str:
        unique = [i for i in dict.fromkeys(ids) if isinstance(i, int) and 1 <= i <= len(blocks)]
        return "".join(blocks[i - 1] for i in unique)

    questions = []
    for question in locator.get("questions", []):
        stem_ids = question.get("stem", [])
        option_ids = [i for i in question.get("options", []) if i not in stem_ids]
        stem = take(stem_ids)
        text = stem + take(option_ids)
        questions.append({
            "no": question.get("no"),
            "stem": stem,
            "options": parse_options(text),
            "text": text,
        })
    return {
        "title": take(locator.get("title", [])),
        "passage": take(locator.get("passage", [])),
        "questions": questions,
    }


def parse_options(text: str) -> list[str]:
    """从题目文本里切出选项：支持（1）（2）（3）与 A. B. C. D. 两种写法。"""
    marked = re.split(r"（[1-9]）", text)
    if len(marked) > 2:
        return [part.strip(" 。") for part in marked[1:] if part.strip()]
    marked = re.split(r"[（(]?[ABCD][.、．)）]", text)
    if len(marked) > 2:
        return [part.strip(" 。；") for part in marked[1:] if part.strip()]
    return []


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="blocks.json 或 clean.txt")
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--rule-only", action="store_true")
    args = parser.parse_args()

    blocks = load_blocks(Path(args.input))
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    locator = None
    meta = {"seconds": 0.0, "attempts": 0, "wroteText": None}
    if not args.rule_only:
        locator, meta = model_segments(blocks, args.timeout, args.retries)

    problems = validate(locator, blocks) if locator else ["模型未返回可用段号"]
    source = "llm"
    fallback_reason = None
    if problems:
        llm_reason = "；".join(problems)
        if meta.get("error"):
            llm_reason += f"（{meta['error']}）"
        locator = rule_split(blocks)
        source = "rule"
        rule_problems = validate(locator, blocks)
        fallback_reason = f"模型段号不可用：{llm_reason}"
        if rule_problems:
            fallback_reason += "；规则兜底仍有问题：" + "；".join(rule_problems)

    result = {
        "structureSource": source,
        "fallbackReason": fallback_reason,
        "model": os.environ.get("MIMO_MODEL", "deepseek/deepseek-flash"),
        "machineSeconds": meta["seconds"],
        "attempts": meta["attempts"],
        "modelWroteText": meta.get("wroteText"),
        "locator": locator,
        **assemble(locator, blocks),
    }
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: result[key] for key in (
        "structureSource", "fallbackReason", "machineSeconds", "attempts"
    )}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
