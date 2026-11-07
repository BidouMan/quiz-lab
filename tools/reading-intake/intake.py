#!/usr/bin/env python3
"""阅读短文素材录入试跑流水线。

子命令：
  pages   PDF/图片 -> 逐页 PNG（可选裁掉左侧装订栏）
  ocr     调用 macOS Vision 批处理（需先 swiftc 编译 vision_ocr）
  clean   从 Vision JSON 去掉页眉/竖排装订栏，合并断行，按 ①②… 分段
  eval    与人工校对的 reference 文本比对，输出字符准确率与错误清单
  batch   对一个目录跑 pages + ocr + clean，并记录机器耗时

依赖：pymupdf、Pillow、numpy；编译好的 ./vision_ocr（见 README）。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import pymupdf
from PIL import Image

HERE = Path(__file__).resolve().parent
VISION_BIN = HERE / "vision_ocr"

FURNITURE = re.compile(
    r"(装订线|第\s*\d+\s*页|共\s*\d+\s*页|三年级语文|期末试卷|期末|学年第一学期|"
    r"注意事项|答题|学生要写清|不读题|答卷时间|用铅笔|成绩|学号|姓名|班级|学校|"
    r"扫码|二维码|水印|^[★☆\-—_\s]+$)"
)
PARA_MARK = re.compile(r"^[①②③④⑤⑥⑦⑧⑨⑩]")


def cmd_pages(args: argparse.Namespace) -> None:
    src = Path(args.input)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    targets = [src] if src.is_file() else sorted(
        p for p in src.iterdir() if p.suffix.lower() in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
    )
    for target in targets:
        stem = target.stem
        if target.suffix.lower() == ".pdf":
            doc = pymupdf.open(target)
            for index, page in enumerate(doc, start=1):
                pix = page.get_pixmap(dpi=args.dpi)
                path = out / f"{stem}-p{index}.png"
                pix.save(path)
                print(f"{path}\t{pix.width}x{pix.height}")
        else:
            image = Image.open(target)
            if args.crop_left > 0:
                image = image.crop((int(image.width * args.crop_left), 0, image.width, image.height))
            path = out / f"{stem}.png"
            image.save(path)
            print(f"{path}\t{image.width}x{image.height}")


def run_vision(images: list[Path], out_dir: Path, scale: float) -> float:
    out_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()
    subprocess.run(
        [str(VISION_BIN), "--out", str(out_dir), "--scale", str(scale), "--no-rotate",
         *map(str, images)],
        check=True,
    )
    return time.time() - started


def cmd_ocr(args: argparse.Namespace) -> None:
    src = Path(args.input)
    images = [src] if src.is_file() else sorted(src.glob("*.png"))
    elapsed = run_vision(images, Path(args.out), args.scale)
    (Path(args.out) / "timing.json").write_text(
        json.dumps({"files": len(images), "machine_seconds": round(elapsed, 2)}, ensure_ascii=False, indent=2)
    )
    print(f"machine_seconds={elapsed:.2f}")


def cmd_clean(args: argparse.Namespace) -> None:
    payload = json.loads(Path(args.input).read_text())
    lines = payload["lines"]

    long_lines = [line for line in lines if line["w"] >= 0.28]
    body_left = min((line["x"] for line in long_lines), default=0.0)

    kept = []
    for line in lines:
        text = line["text"].strip()
        if not text:
            continue
        # 竖排装订栏：宽高比很小且有一定高度
        if line["h"] > 0.02 and line["w"] / max(line["h"], 1e-6) < 2.0:
            continue
        # 主栏左侧的页眉/装订区
        if line["x"] < body_left - 0.02 and line["w"] < 0.25:
            continue
        if len(text) <= 2 and not text.isalnum():
            continue
        if FURNITURE.search(text) and len(text) <= 18:
            continue
        kept.append({"page": line["page"], "y": line["y"], "x": line["x"], "text": text})

    kept.sort(key=lambda item: (item["page"], -item["y"], item["x"]))

    paragraphs: list[str] = []
    for item in kept:
        text = normalize(item["text"])
        if not paragraphs:
            paragraphs.append(text)
            continue
        prev = paragraphs[-1]
        if PARA_MARK.match(text) or re.match(r"^[一二三四五六七八九十]、|^（[一二三四]）|^\d+[.、]", text):
            paragraphs.append(text)
            continue
        # 引号未闭合时不换段：对话常跨行且句末是 ！/？
        if quote_depth(prev) > 0:
            paragraphs[-1] = prev + text
            continue
        if ends_sentence(prev):
            paragraphs.append(text)
        else:
            paragraphs[-1] = prev + text

    text = "\n\n".join(paragraphs)
    Path(args.out).write_text(text, encoding="utf-8")
    print(text)


def cmd_eval(args: argparse.Namespace) -> None:
    import difflib

    ref = Path(args.ref).read_text(encoding="utf-8")
    hyp = Path(args.hyp).read_text(encoding="utf-8")
    ref_clean = only_keep(ref)
    hyp_clean = only_keep(hyp)

    distance, ops = levenshtein_ops(ref_clean, hyp_clean)
    accuracy = max(0.0, 1 - distance / max(len(ref_clean), 1))

    errors = []
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            continue
        errors.append({
            "type": classify(ref_clean[i1:i2], hyp_clean[j1:j2]),
            "ref": ref_clean[i1:i2],
            "hyp": hyp_clean[j1:j2],
            "pos": i1,
        })

    result = {
        "ref_chars": len(ref_clean),
        "hyp_chars": len(hyp_clean),
        "edits": distance,
        "accuracy": round(accuracy, 4),
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.out:
        Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_batch(args: argparse.Namespace) -> None:
    src = Path(args.input)
    work = Path(args.work)
    pages = work / "pages"
    vision = work / "vision"
    clean_dir = work / "clean"
    for folder in (pages, vision, clean_dir):
        folder.mkdir(parents=True, exist_ok=True)

    started = time.time()
    if args.dpi:
        cmd_pages(argparse.Namespace(input=str(src), out=str(pages), dpi=args.dpi, crop_left=0))
    else:
        images = sorted(src.glob("*.png"))
        for image in images:
            (pages / image.name).write_bytes(image.read_bytes())

    image_paths = sorted(pages.glob("*.png"))
    elapsed = run_vision(image_paths, vision, args.scale)
    for js in sorted(vision.glob("*.vision.json")):
        stem = js.name.replace(".vision.json", "")
        out = clean_dir / f"{stem}.txt"
        cmd_clean(argparse.Namespace(input=str(js), out=str(out)))

    manifest = {
        "source": str(src),
        "pages": len(image_paths),
        "machine_seconds": round(time.time() - started, 2),
        "ocr_seconds": round(elapsed, 2),
    }
    (work / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


def normalize(text: str) -> str:
    text = text.replace("…•", "……").replace("..", "……").replace("，。", "。")
    text = re.sub(r"[ \t]+", "", text)
    text = text.replace("(", "（").replace(")", "）")
    text = text.replace(":", "：").replace(";", "；").replace(",", "，")
    text = text.replace("?", "？").replace("!", "！")
    return text.strip()


def ends_sentence(text: str) -> bool:
    # 分号不算段落结束：中文段落内部常用分号连接并列分句
    return text.endswith(("。", "！", "？", "”", "…"))


def quote_depth(text: str) -> int:
    return text.count("“") - text.count("”")


def only_keep(text: str) -> str:
    """评估只比较汉字、数字和常用标点，忽略空白/换行/杂符号。"""
    return "".join(ch for ch in text if ch in "，。！？、；：“”‘’（）《》…—0123456789"
                   or "\u4e00" <= ch <= "\u9fff")


def levenshtein_ops(a: str, b: str):
    import difflib

    return sum(
        max(i2 - i1, j2 - j1)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b).get_opcodes()
        if tag != "equal"
    ), [
        op for op in difflib.SequenceMatcher(a=a, b=b).get_opcodes() if op[0] != "equal"
    ]


def classify(ref: str, hyp: str) -> str:
    if not ref:
        return "漏字/漏行"
    if not hyp:
        return "多字/串行"
    if ref and hyp and ref[0] in "，。！？、；：“”‘’（）" or (hyp and hyp[0] in "，。！？、；：“”‘’（）"):
        return "标点"
    if re.match(r"^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$", ref + hyp):
        return "拼音注音"
    if len(ref) >= 6 or len(hyp) >= 6:
        return "漏行/串行"
    return "形近字/错字"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("pages")
    p.add_argument("input")
    p.add_argument("--out", required=True)
    p.add_argument("--dpi", type=int, default=300)
    p.add_argument("--crop-left", type=float, default=0.0)
    p.set_defaults(func=cmd_pages)

    p = sub.add_parser("ocr")
    p.add_argument("input")
    p.add_argument("--out", required=True)
    p.add_argument("--scale", type=float, default=4.0)
    p.set_defaults(func=cmd_ocr)

    p = sub.add_parser("clean")
    p.add_argument("input")
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_clean)

    p = sub.add_parser("eval")
    p.add_argument("ref")
    p.add_argument("hyp")
    p.add_argument("--out")
    p.set_defaults(func=cmd_eval)

    p = sub.add_parser("batch")
    p.add_argument("input")
    p.add_argument("--work", required=True)
    p.add_argument("--dpi", type=int)
    p.add_argument("--scale", type=float, default=4.0)
    p.set_defaults(func=cmd_batch)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
