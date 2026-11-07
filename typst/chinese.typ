// 语文卷面构件（第一批）
// 与 typst/paper.typ 共用字体目录，但版式逻辑独立：本文件不引用数学模板。
// 用法：在语文样张里 #import "chinese.typ": *

#let cn-font = ("Noto Serif", "Noto Serif CJK SC", "New Computer Modern")

// ---------- 基础 ----------

/// 带调拼音：整串走 Noto Serif，避免 CJK 子集缺字回退
#let py(str, size: 8pt) = text(font: ("Noto Serif", "Noto Serif CJK SC"), size: size)[#str]

/// 汉字：显式指定 CJK 字体，保证与正文一致
#let han(str, size: 14pt) = text(font: ("Noto Serif CJK SC", "Noto Serif"), size: size)[#str]

// ---------- 田字格 ----------

/// 单个田字格：外框由 grid 的 stroke 画，内部十字虚线用浅灰
#let tian-cell(size: 10mm, ch: "", cross: true) = box(width: size, height: size)[
  #if cross {
    place(start, line(
      start: (0mm, size / 2),
      end: (size, size / 2),
      stroke: (thickness: 0.35pt, paint: luma(190), dash: "dashed"),
    ))
    place(start, line(
      start: (size / 2, 0mm),
      end: (size / 2, size),
      stroke: (thickness: 0.35pt, paint: luma(190), dash: "dashed"),
    ))
  }
  #place(center + horizon, han(ch, size: size * 0.58))
]

/// 一行田字格；n 个格子，letters 为可选预填字
#let tian-row(n: 3, size: 10mm, letters: (), cross: true) = grid(
  columns: (size,) * n,
  rows: (size,),
  stroke: (thickness: 0.7pt, paint: luma(110)),
  inset: 0pt,
  ..range(n).map(i => tian-cell(size: size, ch: if i < letters.len() { letters.at(i) } else { "" }, cross: cross)),
)

/// 若干行田字格（写字练习用，可预填首行示范）
#let tian-block(rows: 2, cols: 4, size: 10mm, letters: ()) = grid(
  columns: (size,) * cols,
  rows: (size,) * rows,
  stroke: (thickness: 0.7pt, paint: luma(110)),
  inset: 0pt,
  ..range(rows * cols).map(i => tian-cell(size: size, ch: if i < letters.len() { letters.at(i) } else { "" })),
)

// ---------- 拼音标注 ----------

/// 字上方注音：拼音 8pt、汉字 14pt，整体按格子中线对齐
#let annotate(p, ch, w: 11mm, ch-size: 14pt, py-size: 8pt) = box(width: w)[
  #set align(center)
  #set par(leading: 4pt)
  #py(p, size: py-size)
  #linebreak()
  #han(ch, size: ch-size)
]

/// 一整串的字上注音（用于课内词语）
#let annotate-word(pinyins, chars, w: 11mm) = {
  grid(
    columns: (w,) * chars.len(),
    inset: 0pt,
    ..chars.enumerate().map(((i, ch)) => annotate(if i < pinyins.len() { pinyins.at(i) } else { "" }, ch, w: w)),
  )
}

// ---------- 题型骨架 ----------

/// 题号 + 题干（小节标题）
#let qhead(no, title, score: none) = block(above: 5mm, below: 2mm)[
  #text(size: 14pt, weight: "bold")[#no．#title]
  #if score != none {
    h(1fr)
    text(size: 11pt, fill: luma(90))[(#score 分)]
  }
]

/// 括号内小提示
#let hint(str) = text(size: 10.5pt, fill: luma(105))[（#str）]

/// 看拼音写词语：拼音在上，下方按字数给田字格
#let kanpinyin(word, p, size: 10mm, gap: 4mm) = block(breakable: false, above: 3mm, below: 3mm)[
  #set align(center)
  #py(p, size: 8pt)
  #linebreak()
  #tian-row(n: word.clusters().len(), size: size)
]
#let kanpinyin-line(items, size: 10mm, gap: 5mm) = {
  let blocks = items.map(((w, p)) => kanpinyin(w, p, size: size))
  grid(columns: (1fr,) * blocks.len(), column-gutter: gap, ..blocks)
}

/// 给加点字注音：上方书写空线 9mm，下方汉字带点
#let zhuyin-item(ch, w: 13mm, size: 14pt) = box(width: w)[
  #set align(center)
  #box(width: 9mm, height: 4.6mm, stroke: (bottom: (thickness: 0.5pt, paint: luma(150))), inset: 0pt)[]
  #v(-0.6mm)
  #han(ch, size: size)
  #place(bottom + center, dy: 1mm, circle(radius: 0.5mm, fill: luma(40)))
]

#let zhuyin-line(chars, w: 13mm, gap: 1.5mm) = grid(
  columns: (w,) * chars.len(),
  column-gutter: gap,
  ..chars.map(ch => zhuyin-item(ch, w: w)),
)

/// 形近字组词：字 + 括号书写区
#let xingjin-cell(ch, w: 78mm, blank: 28mm) = box(width: w)[
  #han(ch, size: 14pt)
  #h(1.2mm)
  （#box(width: blank, inset: 0pt)[]）
]
/// 一组形近字占一行，左侧原字、右侧形近字
#let xingjin-line(pairs, w: 78mm, gap: 10mm, row-gap: 5mm) = grid(
  columns: (w, w),
  column-gutter: gap,
  row-gutter: row-gap,
  ..pairs.map(((a, b)) => (xingjin-cell(a, w: w), xingjin-cell(b, w: w))).flatten(),
)

/// 古诗默写：题名行 + 两条书写横线
#let poem-blank(title, author, dynasty, lines: 2, line-w: 100%) = block(above: 3mm, below: 3mm)[
  #grid(columns: (1fr, auto), ..(
    text(size: 12pt)[#title　#(dynasty)·#(author)],
    text(size: 10pt, fill: luma(120))[#lines 句],
  ))
  #v(1mm)
  #for _ in range(lines) {
    block(width: line-w, stroke: (bottom: (thickness: 0.5pt, paint: luma(150))), inset: 0pt)[]
    v(7mm)
  }
]

/// 通用书写横线
#let write-line(w: 100%, h: 9mm) = block(width: w, height: h, stroke: (bottom: (thickness: 0.5pt, paint: luma(150))), inset: 0pt)[]

// ---------- 卷首 ----------

#let paper-title(main, sub: none) = block(width: 100%, above: 0mm, below: 4mm)[
  #set par(justify: false)
  #align(center, text(size: 18pt, weight: "bold")[#main])
  #if sub != none {
    v(1.5mm)
    align(center, text(size: 10.5pt, fill: luma(100))[#sub])
  }
]

#let info-row(fields: ("姓名", "班级", "日期")) = block(width: 100%, below: 3mm)[
  #set par(justify: false)
  #grid(
    columns: (1fr,) * fields.len(),
    ..fields.map(f => box[#text(size: 11.5pt)[#f：] #box(width: 1fr, stroke: (bottom: (thickness: 0.5pt, paint: luma(160))), inset: 0pt)[]]),
  )
]
