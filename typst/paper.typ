// Typst 试卷模板：GB 40070—2021（小学 3–4 年级：正文 14pt / 行空 ≥4mm）
// 数据由 typst/gen-data.mjs 从 src/data/questions.ts 导出
// 字体随包：typst/fonts/NotoSerifCJKsc-Regular.otf（OFL，GB2312 子集，4.6MB）
// 编译（Win/mac 通用；--font-path 不能省，否则会回退到系统字体）：
//   typst compile --root . --font-path typst/fonts \
//     --input data=data/questions.json --input body=14 --input compact=1 --input vert=26 \
//     typst/paper.typ samples/typst样张.pdf

#let data-path = sys.inputs.at("data", default: "data/questions.json")
#let cfg = json(data-path)

// ---------- 规格常量 ----------
// 默认值与既有样张一致；字号对比实验用 --input body=.. lead=.. compact=1 收紧间距
#let body-pt = float(sys.inputs.at("body", default: "14"))
#let body-size = body-pt * 1pt
#let line-gap = float(sys.inputs.at("lead", default: "5.6")) * 1mm
#let compact = sys.inputs.at("compact", default: "0") == "1"

#let qno-w = if compact { body-pt * 0.514 * 1mm } else { 7.2mm } // "(10)" 实测宽
#let qno-gap = if compact { body-pt * 0.186 * 1mm } else { 2.6mm }
#let indent = qno-w + qno-gap

#let vert-h = float(sys.inputs.at("vert", default: "26")) * 1mm // 竖式书写区高度
#let par-space = if compact { 2mm } else { 3mm }
#let row-gap = if compact { 1.6mm } else { 3.2mm }
#let sec-above = 4mm
#let sec-below = 2mm // 默认与 compact 统一为 pad 方案、统一上下间距
#let kpad = if compact { 1.95mm } else { 0.8mm } // 口算逐题块内边距，保证行间墨迹空隙 ≥4mm
// 比大小行内上下留白：紧凑版行距目标 10–11mm（原 5.8mm 过挤），非紧凑版同步保持 ~10mm
#let cmp-pad = if compact { 2.4mm } else { 1.4mm }
#let t-head = if compact { body-pt * 0.55 * 1mm } else { 8mm }
#let t-gap1 = if compact { 2.5mm } else { 3.5mm }
#let t-gap2 = if compact { 5mm } else { 6.5mm }
#let head-size = if compact { body-size + 3pt } else { 17pt }
#let foot-size = if compact { body-size - 4pt } else { 10pt }
#let sec-size = if compact { body-size + 1pt } else { 15pt }
#let note-size = if compact { body-size - 2pt } else { 12pt }

// 页面：左右 12.7mm（沿用原 48px ≈ 12.7mm，保证两栏每栏 89.3mm ≈ 原 337px）
// 上 19mm 留页眉，下 16mm 留页脚；国标只约束字号与行空，页边距沿用原版式
#set page(
  paper: "a4",
  margin: (x: 12.7mm, top: 19mm, bottom: 16mm),
  // 主标题只出现在第 1 页；第 2 页起页眉整块留空，只保留页脚页码
  header: context {
    if counter(page).get().first() == 1 {
      block(width: 100%, {
        set par(leading: 0pt, spacing: 0pt, justify: false)
        align(center, text(size: head-size, weight: "bold")[#cfg.title])
      })
    }
  },
  footer: context {
    align(center, text(size: foot-size, fill: luma(150))[
      第 #counter(page).display() 页 · 共 #counter(page).final().first() 页
    ])
  },
)

#set text(font: ("Noto Serif CJK SC", "New Computer Modern"), size: body-size, lang: "zh", region: "cn")
#set par(leading: line-gap, justify: true, spacing: par-space)

// 块级公式左对齐、去掉上下默认间距；行内公式保持原位
#show math.equation: it => if it.block {
  align(left, block(above: 0mm, below: 0mm, it))
} else { it }

// ---------- 构件 ----------
#let m(s) = eval(s, mode: "math")

// 行内公式无法撑开行高（含分数时会压到下一行），含分数一律改用块级公式
#let eq(s, display: false, pad: 0mm) = if display {
  [$ #m(s) #h(pad) $]
} else {
  [$#m(s)$#h(pad)]
}

#let blank(w, h: 4.6mm) = box(
  width: w,
  height: h,
  stroke: (bottom: (paint: luma(150), thickness: 0.5pt)),
)

#let dash-line(w) = line(
  length: w,
  stroke: (paint: luma(190), thickness: 0.5pt, dash: "dashed"),
)

// 图形（复用原 GeometryFigure 的尺寸比例：长方形 32×19mm、正方形 19×19mm）
// 竖向标注列 13mm，配 box 禁折行，避免 “5 cm” 在窄列里被拆成两行
#let fig-stroke(kind) = if kind == "dashed" {
  (paint: luma(140), thickness: 0.5pt, dash: "dashed")
} else if kind == "thin" {
  0.45pt
} else if kind == "bold" {
  1pt
} else {
  0.75pt
}

// 通用图形：spec 由题目数据给出，坐标单位 mm，原点在左上角
#let draw-fig(spec) = box(width: spec.w * 1mm, height: spec.h * 1mm)[
  #for s in spec.shapes {
    let pts = s.points
    let n = pts.len()
    let segments = if s.at("closed", default: false) { n } else { n - 1 }
    for i in range(segments) {
      let p1 = pts.at(i)
      let p2 = pts.at(if i + 1 < n { i + 1 } else { 0 })
      place(line(
        start: (p1.at(0) * 1mm, p1.at(1) * 1mm),
        end: (p2.at(0) * 1mm, p2.at(1) * 1mm),
        stroke: fig-stroke(s.at("stroke", default: "solid")),
      ))
    }
  }
  #for l in spec.at("labels", default: ()) {
    let anchor = l.at("anchor", default: "left")
    let pos = if anchor == "center" { top + center } else if anchor == "right" { top + right } else { top + left }
    let shift = if anchor == "center" { spec.w / 2 } else if anchor == "right" { spec.w } else { 0 }
    place(
      pos,
      dx: (l.x - shift) * 1mm,
      dy: l.y * 1mm,
      text(
        size: l.at("size", default: 9) * 1pt,
        weight: if l.at("bold", default: false) { "bold" } else { "regular" },
      )[#l.text],
    )
  }
]

#let geom-fig(kind) = {
  let side-label(s) = pad(right: 1mm, align(right + horizon)[#box(text(size: 9pt)[#s])])
  if kind == "rect" {
    grid(
      columns: (13mm, 32mm),
      rows: (6mm, 19mm),
      align: (right, center),
      [],
      align(center + bottom)[#text(size: 9pt)[8 cm]],
      side-label([5 cm]),
      align(center + horizon, rect(width: 32mm, height: 19mm, stroke: 0.75pt)),
    )
  } else {
    grid(
      columns: (13mm, 19mm),
      rows: (6mm, 19mm),
      align: (right, center),
      [],
      align(center + bottom)[#text(size: 9pt)[6 cm]],
      side-label([6 cm]),
      align(center + horizon, rect(width: 19mm, height: 19mm, stroke: 0.75pt)),
    )
  }
}

// ---------- 单题 ----------
// 题号做成行内前导：与题干首行天然同基线（不再用 grid 顶对齐，避免空位框撑高首行后题号抬高 1mm）
#let qno-mark(no) = box(width: qno-w)[#text(fill: luma(85))[(#no)]]

#let item-body(it, lead: []) = block(breakable: false, {
  let disp = it.at("display", default: false)
  if it.kind == "kousuan" {
    let inner = eq(it.expr, display: disp, pad: 9mm)
    // 统一用 pad：grid 单元格会吞掉 block 的外边距，默认与 compact 都不再依赖 block(above/below)
    pad(y: kpad)[#inner]
  } else if it.kind == "chushi" {
    [
      #eq(it.expr)
      #v(1.5mm)
      #block(height: vert-h)
    ]
  } else if it.kind == "tuoshi" {
    [
      // 固定题干行高，避免含括号的行比同行另一题高出 1–2mm，虚线错位
      #block(height: t-head)[#align(horizon)[#eq(it.expr)]]
      #v(t-gap1)
      #dash-line(59mm)
      #v(t-gap2)
      #dash-line(59mm)
      #v(t-gap2)
      #dash-line(59mm)
    ]
  } else if it.kind == "fill" {
    // 填空恒定通栏：不参与半栏配对；左对齐按内容自然延伸，不拉伸行内空白
    let body = [
      #lead
      #for p in it.parts {
        if "t" in p {
          p.t
        } else if "m" in p {
          [$#m(p.m)$]
        } else {
          blank(p.b * 1mm)
        }
      }
    ]
    // 图形题：文字在左、图在右
    if it.at("fig", default: none) != none {
      grid(
        columns: (1fr, auto),
        column-gutter: 4mm,
        align: horizon,
        body,
        draw-fig(it.fig),
      )
    } else {
      body
    }
  } else if it.kind == "word" {
    // 应用题恒定通栏：题干自然折行，下方纯留白作答（不画横线）
    let body = [
      #par(justify: true)[#lead #it.text]
      #v(1.5mm)
      #block(height: it.workLines * 8.5mm)
    ]
    // 图形题：题干与作答区在左，图形靠右
    if it.at("fig", default: none) != none {
      grid(
        columns: (1fr, auto),
        column-gutter: 4mm,
        align: (left + top, right + top),
        body,
        draw-fig(it.fig),
      )
    } else {
      body
    }
  } else if it.kind == "compare" {
    pad(y: cmp-pad)[
      #grid(
        columns: (auto, auto, auto),
        column-gutter: 2.4mm,
        align: horizon,
        [#eq(it.pre, display: disp)],
        box(width: 4.2mm, height: 4.2mm, radius: 50%, stroke: 0.5pt),
        eq(it.post, display: disp),
      )
    ]
  } else if it.kind == "geom" {
    [
      #grid(
        columns: (1fr, auto),
        column-gutter: 4mm,
        align: horizon,
        [#lead #it.text],
        [#if type(it.fig) == str { geom-fig(it.fig) } else { draw-fig(it.fig) }],
      )
      #v(1mm)
      #block(height: it.blank * 1mm)
    ]
  }
})

// 有题号的题型：题号作为行内前导，靠悬挂缩进让折行回到题干起点
// 比大小首格是块级公式，行内前导会自成一段，仍用二列布局
#let numbered-kind(kind) = kind in ("fill", "word", "geom")

#let item-cell(sec, it, no) = {
  let lead = if no == none { [] } else { qno-mark(no) + h(qno-gap) }
  if no == none {
    item-body(it)
  } else if numbered-kind(it.kind) {
    block(breakable: false, {
      set par(hanging-indent: indent)
      item-body(it, lead: lead)
    })
  } else {
    // 计算类正常不编号；万一将来被编号，退回二列布局，避免破坏固定书写区高度
    grid(
      columns: (qno-w, 1fr),
      column-gutter: qno-gap,
      align: (left + top, left + top),
      text(fill: luma(85))[(#no)],
      item-body(it),
    )
  }
}

#let section-head(sec) = block(breakable: false, {
  pad(top: sec-above, bottom: sec-below, {
    text(size: sec-size, weight: "bold")[#sec.title]
    if "note" in sec {
      linebreak()
      pad(left: indent, text(size: note-size, fill: luma(102))[#sec.note])
    }
  })
})

// ---------- 组版：按节、按视觉行排；节标题与本节首行锁在同一块内 ----------
// 行内两栏用 grid(1fr, 1fr) 保持左右栏宽与列间距；图形题、填空题、通栏题单格。
#let row-body(row) = if row.full {
  row.cells.at(0)
} else {
  grid(columns: (1fr, 1fr), column-gutter: 6mm, ..row.cells)
}

// 恒定通栏的题型：填空整行一题；应用题与图形题占满整行
#let full-width-kind(kind) = kind in ("fill", "geom", "word")

#let section-rows(sec) = {
  let rows = ()
  let pending = none
  let n = 0
  for it in sec.items {
    if sec.numbered { n = n + 1 }
    let no = if sec.numbered { n } else { none }
    if full-width-kind(it.kind) {
      if pending != none {
        rows.push((full: false, gap: row-gap, cells: (pending,)))
        pending = none
      }
      rows.push((full: true, gap: if it.kind == "fill" { line-gap } else { row-gap }, cells: (item-cell(sec, it, no),)))
    } else if pending == none {
      pending = item-cell(sec, it, no)
    } else {
      rows.push((full: false, gap: row-gap, cells: (pending, item-cell(sec, it, no))))
      pending = none
    }
  }
  if pending != none {
    rows.push((full: false, gap: row-gap, cells: (pending,)))
  }
  rows
}

#let first-section = true
#for sec in cfg.sections {
  if not first-section { v(row-gap, weak: true) }
  first-section = false
  let rows = section-rows(sec)
  if rows.len() > 0 {
    // 节标题 + 首行不可分开：避免节标题落在页底成为孤行
    block(breakable: false, {
      section-head(sec)
      v(row-gap, weak: true)
      row-body(rows.at(0))
    })
    for i in range(1, rows.len()) {
      v(rows.at(i).gap, weak: true)
      block(breakable: false, {
        row-body(rows.at(i))
      })
    }
  }
}
