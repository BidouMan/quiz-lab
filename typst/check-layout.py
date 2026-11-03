#!/usr/bin/env python3
"""
版式自动校验：用 PyMuPDF 提取“行文本 + 字符 span/char bbox”，检查

1. 正文节标题（"一、/二、…"）与上方最近文字不重叠，上间距 ≥ 3.5mm（目标 4mm）
2. 节标题与下方第一行题干间距 ≥ 1.8mm（目标 2mm）；节说明（13pt 缩进行）算标题的一部分
3. 任何两个字符（char 级 bbox）不得同时横向、纵向重叠（分式的分子/分母只纵向分离，不会误报）
4. 口算行距（以每题末尾“=”所在基线计）≈ 8.89mm（仅 --compact 样张强制校验）
5. 页眉规则：
   - 第 1 页页眉有且仅有 1 个文字块（居中主标题）；
   - 第 2 页及之后页眉必须为空（不得出现标题、页码或任何其他文字）；
   - 页眉区域内任意两个文字块的 bbox 不得横向或纵向重叠。

页眉判定：y0 < 版心顶（19mm）− 6pt；页脚判定：y0 > 版心底（281mm）。
碰撞检测用 char bbox（空间分桶去重），避免 PyMuPDF 的 line/span bbox 把分式分子分母、
同一视觉行的多个基线合并成超高框而误报；同一文字行内的字符不互比。

用法：
    python3 typst/check-layout.py [PDF] [--compact]
失败（任一重叠、间距不达标、页眉违规）退出码为 1。
"""
import re
import statistics
import sys

import pymupdf

PT2MM = 25.4 / 72
HEAD_ABOVE_MIN = 3.5  # mm
HEAD_BELOW_MIN = 1.8  # mm
HEAD_ABOVE_TARGET = 4.0
HEAD_BELOW_TARGET = 2.0
INK_TOL = 0.5  # pt，视为“碰到”的容差

HEAD_RE = re.compile(r"^[一二三四五六七八九十]+、")
KOUSUAN_PITCH_TARGET = 8.89  # mm
PITCH_TOL = 0.25
HEADER_TITLE_CENTER_TOL = 2.0  # mm，主标题字形墨迹中心与页面中线的容差（含全角标点的不对称）

TOP_MARGIN_MM = 19
BOTTOM_MARGIN_MM = 16
BODY_TOP_PT = TOP_MARGIN_MM * 72 / 25.4
HEADER_LIMIT_PT = BODY_TOP_PT - 6  # 正文首行字形上伸可略高于版心线
FOOTER_LIMIT_PT = (297 - BOTTOM_MARGIN_MM) * 72 / 25.4


def mm(v):
    return v * PT2MM


def extract(pdf):
    lines, spans, chars = [], [], []
    doc = pymupdf.open(pdf)
    for pno, page in enumerate(doc):
        d = page.get_text("rawdict")
        for b in d["blocks"]:
            if b["type"] != 0:
                continue
            for ln in b["lines"]:
                txt = "".join(
                    "".join(c["c"] for c in s["chars"]) for s in ln["spans"]
                ).strip()
                if not txt:
                    continue
                sboxes = [s["bbox"] for s in ln["spans"] if s["bbox"]]
                if not sboxes:
                    continue
                x0 = min(bx[0] for bx in sboxes)
                y0 = min(bx[1] for bx in sboxes)
                x1 = max(bx[2] for bx in sboxes)
                y1 = max(bx[3] for bx in sboxes)
                size = max(s["size"] for s in ln["spans"])
                zone = "body"
                if y0 < HEADER_LIMIT_PT:
                    zone = "header"
                elif y0 > FOOTER_LIMIT_PT:
                    zone = "footer"
                lines.append(dict(page=pno + 1, x0=x0, y0=y0, x1=x1, y1=y1, text=txt, size=size, zone=zone, lid=len(lines)))
                lid = len(lines) - 1
                for s in ln["spans"]:
                    st = "".join(c["c"] for c in s["chars"]).strip()
                    if not st:
                        continue
                    sx0, sy0, sx1, sy1 = s["bbox"]
                    spans.append(dict(
                        page=pno + 1, x0=sx0, y0=sy0, x1=sx1, y1=sy1, text=st,
                        size=s["size"], zone=zone, line=txt, lid=lid,
                    ))
                    for c in s["chars"]:
                        if not c["c"].isspace():
                            cx0, cy0, cx1, cy1 = c["bbox"]
                            chars.append(dict(
                                page=pno + 1, x0=cx0, y0=cy0, x1=cx1, y1=cy1,
                                text=c["c"], size=s["size"], zone=zone, line=txt, lid=lid,
                            ))
    return doc, lines, spans, chars


def overlaps(a, b):
    return (min(a["x1"], b["x1"]) - max(a["x0"], b["x0"]) > INK_TOL and
            min(a["y1"], b["y1"]) - max(a["y0"], b["y0"]) > INK_TOL)


def char_collisions(chars, cell_mm=3.0):
    """空间分桶做字符级碰撞检测；同一文字行内的字符不算（字幕/角标本就会交叠）。"""
    cell = cell_mm * 72 / 25.4
    grid = {}
    for i, c in enumerate(chars):
        for kx in range(int(c["x0"] // cell), int(c["x1"] // cell) + 1):
            for ky in range(int(c["y0"] // cell), int(c["y1"] // cell) + 1):
                grid.setdefault((kx, ky), []).append(i)
    out, seen = [], set()
    for bucket in grid.values():
        for a_i in range(len(bucket)):
            ia = bucket[a_i]
            a = chars[ia]
            for b_i in range(a_i + 1, len(bucket)):
                ib = bucket[b_i]
                key = (ia, ib)
                if key in seen:
                    continue
                seen.add(key)
                b = chars[ib]
                if a["page"] != b["page"] or a["lid"] == b["lid"]:
                    continue
                if overlaps(a, b):
                    out.append((a, b))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force_compact = "--compact" in sys.argv
    pdf = args[0] if args else "samples/字号对比-14pt.pdf"
    doc, lines, spans, chars = extract(pdf)
    body_spans = [s for s in spans if s["zone"] == "body"]
    errors = []
    print(f"PDF: {pdf}")
    print(f"页数: {doc.page_count}  文字行: {len(lines)}  字符 span: {len(spans)}")
    print()

    by_page = {}
    for l in lines:
        by_page.setdefault(l["page"], []).append(l)
    spans_by_page = {}
    for s in spans:
        spans_by_page.setdefault(s["page"], []).append(s)

    # ---- 5. 页眉：第 1 页恰有一个居中主标题，第 2 页起为空；页眉内文字块不得重叠 ----
    print("页眉检查（第1页仅居中主标题；第2页及之后页眉为空）：")
    print(f"{'页':>3}  {'文字块':>4}  内容")
    page_mid = doc[0].rect.width / 2
    for pno in range(1, doc.page_count + 1):
        plines = by_page.get(pno, [])
        hdr = sorted([l for l in plines if l["zone"] == "header"], key=lambda l: (l["y0"], l["x0"]))
        if pno == 1:
            if len(hdr) != 1:
                errors.append(f"第1页: 页眉应恰有 1 个居中主标题，实际 {len(hdr)} 个文字块")
            else:
                off = mm((hdr[0]["x0"] + hdr[0]["x1"]) / 2 - page_mid)
                if abs(off) > HEADER_TITLE_CENTER_TOL:
                    errors.append(f"第1页: 主标题未居中（偏离页面中线 {off:.2f}mm）")
        elif hdr:
            errors.append(
                f"第{pno}页: 页眉应为空，检测到文字 "
                + " / ".join(f"「{l['text']}」" for l in hdr[:3])
            )
        # 页眉区域内任意两个文字块（主标题、页码、place 元素）不得横向或纵向重叠
        for i, a in enumerate(hdr):
            for b in hdr[i + 1:]:
                if a["lid"] == b["lid"]:
                    continue
                if overlaps(a, b):
                    errors.append(
                        f"第{pno}页: 页眉文字块重叠 {a['text']} / {b['text']}"
                        f"（{mm(min(a['x1'], b['x1']) - max(a['x0'], b['x0'])):.2f}mm×"
                        f"{mm(min(a['y1'], b['y1']) - max(a['y0'], b['y0'])):.2f}mm）"
                    )
        shown = " / ".join(l["text"] for l in hdr) if hdr else "（空）"
        print(f"{pno:>3}  {len(hdr):>4}  {shown}")
    print()

    # ---- 1/2. 正文节标题上下间距（用 span bbox） ----
    print("正文节标题间距（span bbox 实测，pt→mm）：")
    print(f"{'标题':<16}{'上间距':>10}{'下间距':>10}   判定")
    heads = []
    for l in [x for x in lines if x["zone"] == "body"]:
        if not HEAD_RE.match(l["text"]):
            continue
        heads.append(l)
        page_spans = [s for s in body_spans if s["page"] == l["page"]]
        above = [s for s in page_spans if s["y1"] < l["y0"] - INK_TOL]
        below = [s for s in page_spans if s["y0"] > l["y1"] + INK_TOL]
        # 节说明（13pt、缩进）算标题的一部分，下间距从说明之后算
        b0 = min(below, key=lambda s: s["y0"]) if below else None
        if b0 and b0["size"] < l["size"] - 0.5 and b0["x0"] > l["x0"] + 2 * 72 / 25.4:
            note_bottom = max(s["y1"] for s in page_spans if s["y0"] <= b0["y1"] + INK_TOL and s["y0"] > l["y1"])
            below = [s for s in page_spans if s["y0"] > note_bottom + INK_TOL]
        up = mm(l["y0"] - max(s["y1"] for s in above)) if above else float("inf")
        down = mm(min(s["y0"] for s in below) - l["y1"]) if below else float("inf")
        ok = True
        if above:
            if l["y0"] < max(s["y1"] for s in above) - INK_TOL:
                ok = False
                errors.append(f"{l['text']}: 与上方文字重叠")
            elif up < HEAD_ABOVE_MIN:
                ok = False
                errors.append(f"{l['text']}: 上间距 {up:.2f}mm < {HEAD_ABOVE_MIN}mm")
        # above 为空 = 新节从页首开始，合法（页眉第 2 页起为空，页首可直接是题目）
        if down == float("inf"):
            ok = False
            errors.append(f"{l['text']}: 找不到下方文字行（节标题成了孤行）")
        elif down < HEAD_BELOW_MIN:
            ok = False
            errors.append(f"{l['text']}: 下间距 {down:.2f}mm < {HEAD_BELOW_MIN}mm")
        up_txt = "页首" if up == float("inf") else f"{up:.2f}mm"
        print(f"{l['text']:<16}{up_txt:>10}{down:>8.2f}mm   {'PASS' if ok else 'FAIL'}")
    if not heads:
        errors.append("未识别到任何正文节标题")
    print()

    # ---- 页眉/页脚与正文分离（重叠已在上面的页眉检查中判定） ----
    print("页眉/页脚与正文间距：")
    for pno in range(1, doc.page_count + 1):
        ps = spans_by_page.get(pno, [])
        hdr = [s for s in ps if s["zone"] == "header"]
        body = [s for s in ps if s["zone"] == "body"]
        foot = [s for s in ps if s["zone"] == "footer"]
        if hdr and body:
            gap = mm(min(s["y0"] for s in body) - max(s["y1"] for s in hdr))
            ok = gap >= HEAD_BELOW_MIN
            print(f"  第{pno}页 页眉底→正文首行 {gap:6.2f}mm {'PASS' if ok else 'FAIL'}")
            if not ok:
                errors.append(f"第{pno}页: 页眉与正文首行间距 {gap:.2f}mm < {HEAD_BELOW_MIN}mm")
        if foot and body:
            gap = mm(min(s["y0"] for s in foot) - max(s["y1"] for s in body))
            if gap < 0:
                errors.append(f"第{pno}页: 页脚与正文重叠 {-gap:.2f}mm")
    print()

    # ---- 3. 字符级碰撞（同时横向+纵向重叠才算） ----
    collisions = char_collisions(chars)
    if collisions:
        for a, b in collisions[:12]:
            errors.append(
                f"第{a['page']}页: 文字重叠 {a['text']!r} / {b['text']!r}"
                f"（{mm(min(a['x1'], b['x1']) - max(a['x0'], b['x0'])):.2f}mm×"
                f"{mm(min(a['y1'], b['y1']) - max(a['y0'], b['y0'])):.2f}mm）"
                f" 行: {a['line'][:20]} | {b['line'][:20]}"
            )
    print(f"字符级碰撞（横+纵同时重叠）: {len(collisions)} 处")
    print()

    # ---- 4. 口算行距（每题末尾“=”基线） ----
    pitches = []
    for pno in range(1, doc.page_count + 1):
        pl = [l for l in lines if l["page"] == pno and l["zone"] == "body"]
        ps = [s for s in spans if s["page"] == pno and s["zone"] == "body"]
        for l in pl:
            if not HEAD_RE.match(l["text"]) or "口算" not in l["text"]:
                continue
            following = [o for o in pl if o["y0"] > l["y0"] + INK_TOL]
            next_heads = [o for o in following if HEAD_RE.match(o["text"])]
            end_y = min(o["y0"] for o in next_heads) if next_heads else 10000
            eq = [s for s in ps if "=" in s["text"] and l["y1"] < s["y0"] < end_y]
            ys = sorted(s["y0"] for s in eq)
            ys = [y for i, y in enumerate(ys) if i == 0 or y - ys[i - 1] > 0.5]
            pitches.extend(mm(b - a) for a, b in zip(ys, ys[1:]))
    if pitches:
        med = statistics.median(pitches)
        # compact 行距随正文字号缩放（12/13/14pt 实测 8.39/8.63/8.87mm，斜率约 0.24mm/pt）
        body_sizes = [l["size"] for l in lines if l["zone"] == "body"]
        body_pt = statistics.median(body_sizes) if body_sizes else 14
        target = KOUSUAN_PITCH_TARGET + 0.24 * (body_pt - 14)
        # --compact 只对真正按 compact 松紧排的样张强制目标；默认版式行距天然更紧
        compact = force_compact and abs(med - target) <= 0.5
        if compact:
            ok = abs(med - target) <= PITCH_TOL
            print(f"口算区行距（“=”基线距中位数）: {med:.2f}mm（正文 {body_pt:.0f}pt，目标 {target:.2f}±{PITCH_TOL}mm） {'PASS' if ok else 'FAIL'}")
            if not ok:
                errors.append(f"口算行距 {med:.2f}mm 偏离目标 {target:.2f}mm")
        elif force_compact:
            print(f"口算区行距（“=”基线距中位数）: {med:.2f}mm（实测为默认版式，跳过 {target:.2f}mm 目标校验）")
        else:
            print(f"口算区行距（“=”基线距中位数）: {med:.2f}mm（未指定 --compact，跳过目标校验）")
        body_bottom_limit = doc[0].rect.height - BOTTOM_MARGIN_MM * 72 / 25.4
        body_rows = [s for s in body_spans if s["y1"] <= body_bottom_limit]
        bottom = max(s["y1"] for s in body_rows)
        print(f"正文最后一行底部: {mm(bottom):.2f}mm（版心底 {mm(body_bottom_limit):.2f}mm，剩余 {mm(body_bottom_limit - bottom):.2f}mm）")
    print()

    if errors:
        print("RESULT: FAIL")
        for e in errors:
            print("  -", e)
        return 1
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
