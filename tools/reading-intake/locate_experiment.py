#!/usr/bin/env python3
"""实验：规则切分 vs「Vision 段落编号 -> 文本模型只输出段号 -> 程序回填」。

模型只允许输出段号/题号，不允许输出原文汉字；正文由程序按段号取回，
因此可以逐字证明「原文没有被模型改写」。

用法：
  export MIMO_BASE_URL=http://127.0.0.1:4099/v1
  export MIMO_MODEL=deepseek/deepseek-flash
  export MIMO_API_KEY=...        # `mimo llm-server issue` 签发
  python3 locate_experiment.py --out work/locate/result.json
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

# 人工标注的正确答案（块号从 1 开始）
SAMPLES = {
    "S1_秋的原野": {
        "file": "samples/text-szxuexiao-6924.txt",
        "title": [1],
        "passage": [2, 3, 4, 5, 6, 7],
        "questions": [
            {"no": 1, "blocks": [8, 9], "keyword": "近义词"},
            {"no": 2, "blocks": [10, 11, 12, 13], "keyword": "生气"},
            {"no": 3, "blocks": [14, 15], "keyword": "短语"},
            {"no": 4, "blocks": [16], "keyword": "景物"},
            {"no": 5, "blocks": [17], "keyword": "图画"},
        ],
    },
    "S2_七色花": {
        "file": "work/xicheng-2526/clean/xicheng-2025-2026-p3.txt",
        "title": [1, 2, 3],
        "passage": [4, 5, 6, 7, 8, 9, 11],   # 10 是泡泡框提示，不属于正文
        "questions": [
            {"no": 1, "blocks": [12, 13], "keyword": "表格"},
            {"no": 2, "blocks": [14], "keyword": "绚丽"},
            {"no": 3, "blocks": [15], "keyword": "小兔子"},
            {"no": 4, "blocks": [16, 17], "keyword": "猜想"},
        ],
    },
    "S3_中轴线": {
        "file": "work/xicheng-2526/clean/xicheng-2025-2026-p4.txt",
        "title": [2],                       # 1 是上一篇残留，应当丢弃
        "passage": [3, 4, 5, 6, 7],
        "questions": [
            {"no": 1, "blocks": [8, 9, 10], "keyword": "判断正误"},
            {"no": 2, "blocks": [11], "keyword": "围绕"},
            {"no": 3, "blocks": [12, 13], "keyword": "画卷"},
            {"no": 4, "blocks": [14], "keyword": "牡丹"},
        ],
    },
}

PROMPT = """下面是语文试卷的文字块序列，每块前面是编号。请只做「切分和定位」，不要抄写原文。

输出 JSON：
{"passage": [段号...], "questions": [{"no": 1, "stem": [段号...], "options": [段号...], "answer_from": null}]}

规则：
1. passage 只放短文正文段落；标题、大题说明、题号、泡泡框提示、页眉都不要放。
2. stem 放题干所在块；options 放选项或小题所在块（没有就给 []）。
3. 一篇短文只对应它自己的题；如果开头有上一篇残留下来的题，不要收进来。
4. 所有值只能是段号、题号或 null，禁止出现任何原文汉字。
5. 只输出 JSON，不要解释，不要 markdown。

文字块：
"""


def load_blocks(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]


def call_model(blocks: list[str], timeout: int) -> tuple[str, float]:
    base = os.environ.get("MIMO_BASE_URL", "http://127.0.0.1:4099/v1").rstrip("/")
    model = os.environ.get("MIMO_MODEL", "deepseek/deepseek-flash")
    key = os.environ["MIMO_API_KEY"]
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
    message = data["choices"][0]["message"]
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
    """递归检查模型输出里有没有中文：有就说明它没遵守“只输出段号”。"""
    if isinstance(value, str):
        return bool(re.search(r"[\u4e00-\u9fff]", value))
    if isinstance(value, list):
        return any(model_wrote_text(item) for item in value)
    if isinstance(value, dict):
        return any(model_wrote_text(item) for item in value.values())
    return False


def rule_split(blocks: list[str]) -> dict:
    """现方案：题号正则切分；正文取 ①–⑩ 开头的块，题内子块按顺序归入。"""
    question_start = re.compile(r"^(\d+)[.、]")
    title_end = 0
    for index, block in enumerate(blocks, start=1):
        if re.match(r"^（[一二三四]）|^【阅读", block):
            title_end = index
    boundary = len(blocks) + 1
    for index, block in enumerate(blocks, start=1):
        if question_start.match(block):
            boundary = index
            break
    passage = [
        index for index in range(title_end + 1, boundary)
        if re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩]", blocks[index - 1])
    ]
    questions = []
    current = None
    for index in range(boundary, len(blocks) + 1):
        block = blocks[index - 1]
        match = question_start.match(block)
        if match:
            current = {"no": int(match.group(1)), "stem": [index], "options": []}
            questions.append(current)
        elif current:
            current["options"].append(index)
    return {"passage": passage, "questions": questions}


def assemble(result: dict, blocks: list[str]) -> dict:
    def take(ids) -> str:
        # 同一块既做 stem 又做 options 时只取一次，避免正文重复
        unique = [i for i in dict.fromkeys(ids) if isinstance(i, int) and 1 <= i <= len(blocks)]
        return "".join(blocks[i - 1] for i in unique)

    passage = take(result.get("passage", []))
    questions = []
    for question in result.get("questions", []):
        stem = take(question.get("stem", []))
        text = stem + take([i for i in question.get("options", []) if i not in question.get("stem", [])])
        questions.append({
            "no": question.get("no"),
            "text": text,
            "stem": stem,
            "options": parse_options(text),
        })
    return {"passage": passage, "questions": questions}


def parse_options(text: str) -> list[str]:
    """从题目文本里切出选项：支持（1）（2）（3）与 A. B. C. D. 两种写法。"""
    marked = re.split(r"（[1-9]）", text)
    if len(marked) > 2:
        return [part.strip(" 。") for part in marked[1:] if part.strip()]
    marked = re.split(r"[（(]?[ABCD][.、．)）]", text)
    if len(marked) > 2:
        return [part.strip(" 。；") for part in marked[1:] if part.strip()]
    return []


def score(result: dict, expected: dict, blocks: list[str]) -> dict:
    assembled = assemble(result, blocks)
    got_passage = set(result.get("passage", []))
    want_passage = set(expected["passage"])
    overlap = len(got_passage & want_passage) / len(want_passage)
    extra = sorted(got_passage - want_passage)
    missing = sorted(want_passage - got_passage)

    question_rows = []
    for want in expected["questions"]:
        matched = next((q for q in assembled["questions"] if q["no"] == want["no"]), None)
        text = matched["text"] if matched else ""
        hit = sum(1 for block_id in want["blocks"] if blocks[block_id - 1] in text)
        question_rows.append({
            "no": want["no"],
            "blocks_ok": f"{hit}/{len(want['blocks'])}",
            "keyword_ok": want["keyword"] in text,
        })

    return {
        "passage_set_ok": got_passage == want_passage,
        "passage_recall": round(overlap, 3),
        "passage_extra_blocks": extra,
        "passage_missing_blocks": missing,
        "question_count": len(assembled["questions"]),
        "question_count_ok": len(assembled["questions"]) == len(expected["questions"]),
        "questions": question_rows,
        "questions_all_ok": all(row["keyword_ok"] and row["blocks_ok"].split("/")[0] == row["blocks_ok"].split("/")[1]
                                for row in question_rows),
        "locator": result,
        "assembled": assembled,
    }


def gate(assembled: dict, sample: str, out_path: Path) -> dict:
    """按 gate.py 的原文一致性规则直接跑：字数、填空空位、引文、答案依据。"""
    text = assembled["passage"]
    hanzi = len(re.findall(r"[\u4e00-\u9fff]", text))
    quotes = re.findall(r"“([^”]+)”", text)
    checks = {
        "字数 300–500": 300 <= hanzi <= 500,
        "段落 ≥3": len([p for p in re.split(r"(?<=。)", text) if p.strip()]) >= 3,
        "题干未混入正文": not re.search(r"\n?\d+[.、]", text),
        "正文无乱码/页眉": not re.search(r"装订线|第\s*\d+\s*页|共\s*\d+\s*页", text),
    }
    out_path.write_text(json.dumps({
        "sample": sample, "hanzi": hanzi, "quotes_in_passage": quotes, "checks": checks,
        "assembled": assembled,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return checks


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--rule-only", action="store_true")
    parser.add_argument("--reuse", action="store_true", help="复用已有 result.json 里的段号，不再调模型")
    args = parser.parse_args()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    report = []
    previous = {}
    if args.reuse and out_path.exists():
        previous = {row["sample"]: row for row in json.loads(out_path.read_text(encoding="utf-8"))}
    for name, expected in SAMPLES.items():
        blocks = load_blocks(HERE / expected["file"])
        row = {"sample": name, "blocks": len(blocks)}
        started = time.time()
        rule_result = rule_split(blocks)
        row["rule"] = score(rule_result, expected, blocks)
        row["rule"]["seconds"] = round(time.time() - started, 2)
        if args.rule_only:
            report.append(row)
            print(f"{name}: rule={row['rule']['passage_set_ok']}/{row['rule']['questions_all_ok']} "
                  f"extra={row['rule']['passage_extra_blocks']}")
            continue

        started = time.time()
        if args.reuse and name in previous:
            parsed = previous[name]["llm"]["locator"]
            seconds = previous[name]["llm"]["seconds"]
            raw = ""
            retried = False
        else:
            raw, seconds = call_model(blocks, args.timeout)
            parsed = parse_json(raw)
            retried = False
            if parsed is None:
                # 模型偶发只吐推理、正文为空；重试一次并累计耗时
                retried = True
                raw_retry, seconds_retry = call_model(blocks, args.timeout)
                seconds += seconds_retry
                parsed = parse_json(raw_retry)
                if parsed is not None:
                    raw = raw_retry
        row["llm"] = {
            "seconds": round(seconds, 2),
            "retried": retried,
            "json_ok": parsed is not None,
            "wrote_text": model_wrote_text(parsed) if parsed else None,
            "raw_head": raw[:80],
        }
        if parsed:
            row["llm"].update(score(parsed, expected, blocks))
            row["gate"] = gate(row["llm"]["assembled"], name, out_path.with_name(f"{name}.gate.json"))
        report.append(row)
        print(f"{name}: rule={row['rule']['passage_set_ok']}/{row['rule']['questions_all_ok']} "
              f"llm={row['llm'].get('passage_set_ok')}/{row['llm'].get('questions_all_ok')} "
              f"{row['llm']['seconds']}s wrote_text={row['llm']['wrote_text']}")

    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"written {out_path}")


if __name__ == "__main__":
    main()
