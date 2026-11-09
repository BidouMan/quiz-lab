// 三年级语文上册 按配置生成卷（100% 数据驱动）
// 数据由 typst/gen-chinese-paper.mjs 调用 src/chinese/build.ts 生成，
// 本文件只负责版式：题型、题量、分值、页数与答案页都跟着 JSON 配置走。
//
// 生成：
//   node typst/gen-chinese-paper.mjs --preset default
//   typst compile --root . --font-path typst/fonts typst/chinese-paper-3a.typ samples/chinese-paper-default.pdf

#import "chinese.typ": *
#let p = json(sys.inputs.at("data", default: "data/chinese-paper.json"))

// 覆盖共用构件：题号「粘」住后面的内容；默写块不可断页，
// 避免标题或诗名落在页脚、正文跑到下一页。
// 版式规则：所有题型标题与第一行（含横线/拼音/田字格）的基线距离统一约 8–9mm。
// 统一由 below 控制，题型内部首项不得再加 v() 或 above；新增题型沿用该值。
#let qhead(no, title) = block(sticky: true, above: 6mm, below: 6.2mm)[
  #text(size: 12pt, weight: "bold")[#no．#title]
]

// 古诗默写：诗名与两条横线必须同页
#let poem-blank(title, author, dynasty, lines: 2, line-w: 100%, gap: 9mm) = block(breakable: false, above: 3mm, below: 3mm)[
  #text(size: 11pt)[#title　#(dynasty)·#(author)]
  #v(1mm)
  #for _ in range(lines) {
    block(width: line-w, above: 0pt, below: 0pt, stroke: (bottom: (thickness: 0.5pt, paint: luma(150))), inset: 0pt)[]
    v(gap)
  }
]

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 18mm, top: 18mm, bottom: 16mm),
  numbering: "第 1 页",
)
// 正文 11pt；leading 0.82em 实测基线距约 1.55 倍字高
#set text(font: cn-font, size: 11pt, lang: "zh", region: "cn")
#set par(leading: 0.82em, justify: false)

// 书写横线：行高即相邻两条线的间距
#let write-line(w: 100%, h: 8mm) = block(
  width: w,
  height: h,
  above: 0pt,
  below: 0pt,
  stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
  inset: 0pt,
)[]

// ---------- 本卷局部构件 ----------

/// 把数组按每 n 个切成一组，避免一长串题目撑破行宽
#let chunked(arr, n) = {
  let out = ()
  let i = 0
  while i < arr.len() {
    out.push(arr.slice(i, calc.min(i + n, arr.len())))
    i += n
  }
  out
}

/// 古诗补全：题名行 + 提示句 + 按答案长度给的书写横线。
/// 答案是两个分句时用两行横线，每句一条，不拉一条横贯整行的长线。
#let poem-fill(title, dynasty, author, first, widths: (), blankFirst: false) = block(above: 2mm, below: 1mm)[
  #text(size: 11pt)[#title　#(dynasty)·#(author)]
  #v(1mm)
  #let blank-stack = {
    for (i, w) in widths.enumerate() {
      write-line(w: w, h: 7.5mm)
      if i < widths.len() - 1 { v(0.6mm) }
    }
  }
  #if widths.len() > 1 [
    #if blankFirst [
      #blank-stack
      #v(3.2mm)
      #text(size: 11pt)[#first]
    ] else [
      #text(size: 11pt)[#first]
      #v(0.8mm)
      #blank-stack
    ]
  ] else [
    #text(size: 11pt)[#first]
    #h(3mm)
    #write-line(w: widths.at(0), h: 6mm)
  ]
]

/// 注音题：整词一行排，被注音的字下方加点，字上方按拼音长度给横线
#let zhuyin-word(word, target, bw: 12mm, size: 13pt) = {
  let chars = word.clusters()
  let idx = if target in chars { chars.position(c => c == target) } else { 0 }
  let unit = size
  // 左右各留出横线超出字宽的部分，保证横线不越出本词边界
  let side = calc.max((bw - unit) / 2, 0mm)
  let total = chars.len() * unit + 2 * side
  // 被注音字的中心位置（相对整块左边缘）
  let cx = side + idx * unit + unit / 2
  stack(
    dir: ttb,
    spacing: 4mm,
    // 拼音横线：与整词居中对齐，上方 2.4mm 供书写
    box(width: total, height: 2.4mm)[
      #place(top + center, box(
        width: bw,
        height: 2.4mm,
        stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
        inset: 0pt,
      )[])
    ],
    // 词组：逐字等宽排（保证圆点对准字的中心）；被注音字下方加点
    box(width: total)[
      #pad(left: side, grid(
        columns: (unit,) * chars.len(),
        align: center,
        ..chars.map(c => text(size: size)[#c]),
      ))
      #place(bottom + left, dx: cx - 0.6mm, dy: 2.2mm, circle(radius: 0.6mm, fill: luma(40)))
    ],
  )
}

/// 看拼音写词语：拼音贴近田字格，多行之间留出足够行距
#let kanpinyin-cell(word, p, size: 10mm) = stack(
  dir: ttb,
  spacing: 1.6mm,
  box(py(p, size: 8pt)),
  tian-row(n: word.clusters().len(), size: size),
)

#let kanpinyin-line(items, size: 10mm, gap: 5mm, cols: none) = {
  let blocks = items.map(((w, p)) => kanpinyin-cell(w, p, size: size))
  let n = if cols == none { blocks.len() } else { cols }
  if n > blocks.len() {
    for _ in range(n - blocks.len()) {
      blocks.push(box())
    }
  }
  grid(
    columns: (1fr,) * n,
    align: center,
    column-gutter: gap,
    row-gutter: 6mm,
    ..blocks,
  )
}

/// 注音题整节排布：每行 6 个词，多行之间用统一的 row-gutter
#let zhuyin-line(items, cols: 6) = {
  let cells = items.map(i => zhuyin-word(i.context, i.char, bw: i.blankWidthMm * 1mm))
  if calc.rem(cells.len(), cols) != 0 {
    for _ in range(cols - calc.rem(cells.len(), cols)) {
      cells.push(box())
    }
  }
  grid(
    columns: (auto,) * cols,
    column-gutter: 8mm,
    row-gutter: 6mm,
    ..cells,
  )
}

/// 按「（ ）」把题干拆成“文字 + 空线”
#let fill-inline(stem, widths, size: 11pt) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < parts.len() - 1 {
      box(
        width: widths.at(i),
        stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
        inset: 0pt,
      )[]
      h(1.4mm)
    }
  }
}

/// 把题干里的「（ ）」按顺序替换成答案，用于标点题答案展示
#let apply-blanks(stem, values) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < parts.len() - 1 {
      [#values.at(i)]
    }
  }
}

/// 选择题四选一：两列排布，选项之间等距
#let choice-options(options) = {
  let letters = ("A", "B", "C", "D")
  grid(
    columns: (1fr,) * 2,
    column-gutter: 10mm,
    row-gutter: 3.6mm,
    ..options.enumerate().map(((i, opt)) => box[#text(size: 11pt)[#letters.at(i)．#opt]]),
  )
}

/// 阅读题：选择 / 填空 / 简答三种版式分开排；整题不可断页
#let reading-question(no, q) = block(
  above: 6.6mm,
  below: 0.6mm,
  breakable: false,
)[
  #if q.type == "choice" {
    text(size: 11pt)[#text(weight: "bold")[#(no)．]#q.stem]
    v(0.8mm)
    choice-options(q.options)
  } else if q.type == "fill" {
    text(size: 11pt)[#text(weight: "bold")[#(no)．]]
    fill-inline(q.stem, q.blankWidthsMm.map(w => w * 1mm), size: 11pt)
    v(0.4mm)
  } else {
    text(size: 11pt)[#text(weight: "bold")[#(no)．]#q.stem]
    v(1.2mm)
    for _ in range(q.blankLines) {
      write-line(h: 8mm)
    }
  }
]

/// 答案页标签：黑底=对错可判，空心=给参考答案
#let answer-tag(mode) = {
  if mode == "objective" {
    box(
      fill: luma(45),
      radius: 1mm,
      inset: (x: 1.6mm, y: 0.5mm),
    )[#text(size: 7.5pt, fill: white)[对错可判]]
  } else if mode == "subjective" {
    box(
      fill: luma(248),
      stroke: (paint: luma(130), thickness: 0.5pt),
      radius: 1mm,
      inset: (x: 1.6mm, y: 0.5mm),
    )[#text(size: 7.5pt, fill: luma(60))[参考答案]]
  } else {
    box(
      fill: luma(248),
      stroke: (paint: luma(130), thickness: 0.5pt),
      radius: 1mm,
      inset: (x: 1.6mm, y: 0.5mm),
    )[#text(size: 7.5pt, fill: luma(60))[客观题可判 · 简答给参考]]
  }
}

/// 答案页小节标题：主观题标「参考答案」，客观题标「对错可判」
#let anshead(no, title, mode: "objective") = block(sticky: true, above: 3mm, below: 2mm)[
  #text(size: 12pt, weight: "bold")[#no．#title]
  #h(2mm)
  #answer-tag(mode)
]

/// 取评分要点；字段缺失或为空时统一回退，避免答案页留空
#let scoring-points(value) = {
  let points = if value == none { () } else { value }
  if points.len() > 0 {
    for (i, point) in points.slice(0, calc.min(3, points.len())).enumerate() {
      text(size: 9pt)[#(i + 1)）#point]
      linebreak()
    }
  } else {
    text(size: 9pt, fill: luma(105))[本题未提供评分要点。]
    linebreak()
  }
}

/// 素材缺口占位块：写清需要多少、现有多少
#let gap-block(s) = block(
  width: 100%,
  fill: luma(249),
  stroke: (paint: luma(180), thickness: 0.6pt, dash: "dashed"),
  radius: 1.5mm,
  inset: (x: 4.5mm, y: 3mm),
)[
  #set text(size: 10.5pt)
  #text(weight: "bold")[素材缺口：]#s.gap.message
]

/// 卷面题型正文；head 为节标题，大块题型把标题并入首块，避免标题落在页底
#let section-body(s, head) = {
  let head-inline = if s.typeId in ("gushi-fill", "gushi-dimo", "reading", "writing") { none } else { head }
  if head-inline != none { head-inline }
  if s.typeId == "kanpinyin" {
    kanpinyin-line(s.items.map(i => (i.word, i.pinyin)), size: 10mm, gap: 5mm, cols: 5)
  } else if s.typeId == "zhuyin" {
    zhuyin-line(s.items)
  } else if s.typeId == "xingjin" {
    block(breakable: false)[
      #xingjin-line(s.items.map(i => (i.a, i.b)))
    ]
  } else if s.typeId == "gushi-fill" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 {
          head
        }
        #poem-fill(
          i.title,
          i.dynasty,
          i.author,
          i.prompt,
          widths: i.blankWidthsMm.map(w => w * 1mm),
          blankFirst: i.blankFirst,
        )
      ]
    }
  } else if s.typeId == "gushi-dimo" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 {
          head
        }
        #poem-blank(i.title, i.author, i.dynasty, lines: i.lines.len(), gap: 9mm)
      ]
    }
  } else if s.typeId == "gaibing" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: 2.4mm)[
        #text(size: 11pt)[（#(j + 1)）#g.broken]
        #v(0.3mm)
        #grid(columns: (16mm, 1fr), text(size: 11pt)[改为：], write-line(h: 8mm))
      ]
    }
  } else if s.typeId == "guanlian" {
    for (j, g) in s.items.enumerate() {
      if j > 0 { v(2.6mm) }
      text(size: 11pt)[（#(j + 1)）]
      fill-inline(g.text, g.blankWidthsMm.map(w => w * 1mm), size: 11pt)
    }
  } else if s.typeId == "biaodian" {
    for (j, g) in s.items.enumerate() {
      if j > 0 { v(2.6mm) }
      text(size: 11pt)[（#(j + 1)）#g.text]
    }
  } else if s.typeId == "kuoxie" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: 2.4mm)[
        #text(size: 11pt)[（#(j + 1)）#g.base]
        #text(size: 10.5pt, fill: luma(105))[　提示：#g.hints.join("　/　")]
        #for _ in range(g.blankLines) { write-line(h: 8mm) }
      ]
    }
  } else if s.typeId == "fangxie" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: 2.4mm)[
        #text(size: 11pt)[（#(j + 1)）例：#g.example　#g.prompt]
        #for _ in range(g.blankLines) { write-line(h: 8mm) }
      ]
    }
  } else if s.typeId == "reading" {
    for (k, r) in s.items.enumerate() {
      block(breakable: false, sticky: true)[
        #if k == 0 {
          head
        }
        #align(center, text(size: 12pt, weight: "bold")[#r.title])
        #v(1.2mm)
        #for para in r.paragraphs {
          [#text(size: 11pt)[#h(2em)#para]]
          parbreak()
        }
      ]
      v(1.4mm)
      for (qi, q) in r.questions.enumerate() {
        reading-question(qi + 1, q)
      }
      v(2mm)
    }
  } else if s.typeId == "writing" {
    for (k, w) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 { head }
        #text(size: 11pt, weight: "bold")[题目：#w.title]
        #v(1mm)
        #let opening = w.at("storyOpening", default: none)
        #if opening != none [
          #text(size: 11pt)[开头：#opening]
          #v(1mm)
        ]
        #text(size: 11pt)[提示：#w.prompt]
        #v(1mm)
        #text(size: 11pt)[要求：]
        #for (i, req) in w.requirements.enumerate() {
          text(size: 11pt)[#(i + 1)）#req]
          linebreak()
        }
        #text(size: 11pt)[字数：#w.wordCount.min～#w.wordCount.max 字。]
        #v(0.8mm)
        #align(center)[
          #grid(
            columns: (7.85mm,) * 20,
            rows: (7.85mm,) * 20,
            stroke: (thickness: 0.6pt, paint: luma(145)),
            inset: 0pt,
            ..range(20 * 20).map(i => tian-cell(size: 7.85mm, cross: false)),
          )
        ]
      ]
    }
  } else if s.typeId == "lianmian" {
    for item in s.items {
      text(size: 11pt)[#item.note]
    }
  }
}

/// 答案页题型正文
#let answer-body(s) = {
  if s.typeId == "kanpinyin" {
    grid(
      columns: (1fr,) * 4,
      row-gutter: 2.6mm,
      ..s.items.map(i => box[#py(i.pinyin, size: 8pt)　#han(i.word, size: 10.5pt)]),
    )
  } else if s.typeId == "zhuyin" {
    for row in chunked(s.items, 9) {
      annotate-word(row.map(i => i.pinyin), row.map(i => i.char), w: 14mm)
      v(1mm)
    }
    text(size: 8.5pt, fill: luma(105))[语境：#s.items.map(i => i.context).join("、")。多音字按语境定音。]
  } else if s.typeId == "xingjin" {
    grid(
      columns: (1fr,) * 3,
      row-gutter: 2.6mm,
      ..s.items.map(i => box[
        #han(i.a, size: 11pt)（#text(size: 10pt)[#i.aAnswer]）　#han(i.b, size: 11pt)（#text(size: 10pt)[#i.bAnswer]）
      ]),
    )
    v(0.5mm)
    text(size: 8.5pt, fill: luma(105))[组词答案不唯一，意思通顺、词语成立都算对。]
  } else if s.typeId == "gushi-fill" {
    for i in s.items {
      text(size: 9.5pt)[《#i.title》（#i.dynasty#h(0.4mm)·#h(0.4mm)#i.author）　#i.prompt#i.answer]
      linebreak()
    }
  } else if s.typeId == "gushi-dimo" {
    for i in s.items {
      text(size: 9.5pt)[《#i.title》（#i.dynasty#h(0.4mm)·#h(0.4mm)#i.author）　#i.lines.join("")]
      linebreak()
    }
  } else if s.typeId == "gaibing" {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt)[（#(j + 1)）#g.broken → #g.fixed]
      if g.acceptable.len() > 0 {
        text(size: 9pt, fill: luma(105))[（也可改为：#g.acceptable.join("；")）]
      }
      linebreak()
    }
  } else if s.typeId == "guanlian" {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt)[（#(j + 1)）主答案：#g.pair]
      linebreak()
      text(size: 9pt, fill: luma(105))[可填组合：#g.answers.map(a => a.join("／")).join("；")]
      linebreak()
    }
    text(size: 8.5pt, fill: luma(105))[同义关联词都算对；先把句子读通，再判断关系。]
  } else if s.typeId == "biaodian" {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt)[（#(j + 1)）#apply-blanks(g.text, g.answers.at(0))]
      linebreak()
      if g.answers.len() > 1 {
        text(size: 9pt, fill: luma(105))[也可写作：#g.answers.slice(1).map(a => apply-blanks(g.text, a)).join("；")]
        linebreak()
      }
    }
    text(size: 8.5pt, fill: luma(105))[规则：#s.items.map(g => g.rule).join("；")。]
  } else if s.typeId == "kuoxie" {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt, weight: "bold")[（#(j + 1)）评分要点]
      linebreak()
      scoring-points(g.at("rubric", default: none))
      v(0.8mm)
    }
  } else if s.typeId == "fangxie" {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt, weight: "bold")[（#(j + 1)）评分要点]
      linebreak()
      scoring-points(g.at("rubric", default: none))
      v(0.8mm)
    }
  } else if s.typeId == "reading" {
    for r in s.items {
      text(size: 10pt, weight: "bold")[#r.id《#r.title》]
      linebreak()
      for (j, q) in r.questions.enumerate() {
        if q.type == "choice" {
          text(size: 9.5pt)[（#(j + 1)）答案 #("A", "B", "C", "D").at(q.answer)。#q.explain]
          linebreak()
        } else if q.type == "fill" {
          text(size: 9.5pt)[（#(j + 1)）答案：#q.blanks.join("；")]
          linebreak()
        } else {
          let ref = q.at("answer", default: none)
          if ref != none and ref.trim() != "" {
            text(size: 9.5pt)[（#(j + 1)）参考：#ref]
            linebreak()
          } else {
            text(size: 9.5pt, weight: "bold")[（#(j + 1)）评分要点（暂无参考答案）]
            linebreak()
            scoring-points(q.at("scoring", default: none))
          }
        }
      }
      v(1mm)
    }
  } else if s.typeId == "writing" {
    for w in s.items {
      let scoring = w.at("scoring", default: none)
      if scoring == none {
        text(size: 9.5pt)[*#w.id《#w.title》*（#w.unitName）。本题未提供评分要点。]
      } else {
        let rows = scoring.at("rows", default: ())
        let bands = scoring.at("bands", default: ())
        if rows.len() == 0 {
          text(size: 9.5pt)[*#w.id《#w.title》*（#w.unitName）。本题未提供评分要点。]
        } else {
          text(size: 9pt)[*#w.id《#w.title》*（#w.unitName）。按下列分项评分，不给范文。]
          v(0.8mm)
          block[
            #set text(size: 9pt)
            #grid(
              columns: (25mm, 14mm, 1fr),
              stroke: (thickness: 0.5pt, paint: luma(170)),
              inset: (x: 2.5mm, y: 1mm),
              align: (center + horizon, center + horizon, left + horizon),
              ..([*分项*], [*分值*], [*评分要点*]),
              ..rows.map(r => ([#r.aspect], [#r.points], [#r.description])).flatten(),
            )
          ]
          v(1mm)
          for b in bands {
            text(size: 9pt)[#text(weight: "bold")[#b.label]：#b.description]
            v(0.4mm)
          }
        }
      }
    }
  } else if s.typeId == "lianmian" {
    for item in s.items {
      text(size: 9.5pt)[#item.note 无固定答案，按书写工整、卷面整洁程度评分。]
    }
  }
}

// ==================== 卷面 ====================

#paper-title(p.meta.title)

#for s in p.sections {
  section-body(s, qhead(s.no, s.label))
  if s.gap != none {
    v(1mm)
    gap-block(s)
  }
  v(1.5mm)
}

// ==================== 答案页（可整页取舍）====================

#if p.meta.includeAnswers {
  pagebreak()

  align(center, text(size: 16pt, weight: "bold")[参考答案与解析])
  v(1.5mm)
  grid(
    columns: (auto, 1fr),
    column-gutter: 3mm,
    row-gutter: 1mm,
    [ #answer-tag("objective") ], [对错可判：给出答案和简析，可直接核对。],
    [ #answer-tag("subjective") ], [参考答案：简答题给出参考答案，意思对即可。],
    [ #answer-tag("mixed") ], [混合板块：客观题给答案和简析，简答题给参考答案。],
  )
  v(1mm)
  set par(leading: 3.8mm)

  for s in p.sections {
    anshead(s.no, s.label, mode: s.answerMode)
    if s.selected > 0 {
      answer-body(s)
    } else {
      text(size: 9.5pt)[本卷未排此题：#s.gap.message]
      linebreak()
    }
  }

  if p.notes.len() > 0 {
    v(2mm)
    text(size: 10pt, weight: "bold")[生成说明]
    v(0.5mm)
    for note in p.notes {
      text(size: 8.5pt, fill: luma(90))[· #note]
      linebreak()
    }
  }

  if p.gaps.len() > 0 {
    v(2mm)
    text(size: 10pt, weight: "bold")[素材缺口汇总]
    v(0.5mm)
    for gap in p.gaps {
      text(size: 8.5pt)[· #text(weight: "bold")[#gap.label：]需 #gap.needed，现有 #gap.available，缺 #gap.missing。]
      linebreak()
    }
  }
}
