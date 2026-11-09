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
#let qhead(no, title, score: none) = block(sticky: true, above: 5mm, below: 2mm)[
  #text(size: 14pt, weight: "bold")[#no．#title]
  #if score != none {
    h(1fr)
    text(size: 11pt, fill: luma(90))[(#score 分)]
  }
]

// 古诗默写：诗名与两条横线必须同页
#let poem-blank(title, author, dynasty, lines: 2, line-w: 100%, gap: 9mm) = block(breakable: false, above: 3mm, below: 3mm)[
  #text(size: 12pt)[#title　#(dynasty)·#(author)]
  #v(1mm)
  #for _ in range(lines) {
    block(width: line-w, stroke: (bottom: (thickness: 0.5pt, paint: luma(150))), inset: 0pt)[]
    v(gap)
  }
]

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 12.7mm, top: 19mm, bottom: 16mm),
  numbering: "第 1 页",
)
#set text(font: cn-font, size: 14pt, lang: "zh", region: "cn")
#set par(leading: 5.6mm, justify: false)

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

/// 古诗补全：题名行 + 提示句 + 书写空线（空线可在提示句前或后）
#let poem-fill(title, dynasty, author, first, blankFirst: false, blank: 42mm) = block(above: 1.4mm, below: 0.8mm)[
  #text(size: 11.5pt)[#title　#(dynasty)·#(author)]
  #h(4mm)
  #if blankFirst [
    #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
    #h(1.2mm)
    #text(size: 13pt)[#first]
  ] else [
    #text(size: 13pt)[#first]
    #h(4mm)
    #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
  ]
]

/// 注音题：字上方空线，字下方给语境词，便于多音字定音
#let zhuyin-item-with-context(ch, ctx, w: 14mm) = stack(
  dir: ttb,
  spacing: 0.6mm,
  zhuyin-item(ch, w: w),
  text(size: 8.5pt, fill: luma(110), ctx),
)

/// 按「（ ）」把题干拆成“文字 + 空线”
#let fill-inline(stem, widths, size: 13pt) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < parts.len() - 1 {
      box(
        width: widths.at(i),
        stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
        inset: 0pt,
      )[]
      h(1.2mm)
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

/// 选择题四选一
#let choice-options(options) = {
  let letters = ("A", "B", "C", "D")
  grid(
    columns: (1fr,) * 2,
    column-gutter: 6mm,
    row-gutter: 1.5mm,
    ..options.enumerate().map(((i, opt)) => box[#text(size: 12.5pt)[#letters.at(i)．#opt]]),
  )
}

/// 阅读题：选择 / 填空 / 简答三种版式分开排
#let reading-question(no, q) = block(above: 1.8mm, below: 0.5mm)[
  #if q.type == "choice" {
    text(size: 13pt)[#text(weight: "bold")[#(no)．]#q.stem]
    h(2mm)
    text(size: 10.5pt, fill: luma(95))[（#q.score 分）]
    v(1mm)
    choice-options(q.options)
  } else if q.type == "fill" {
    text(size: 13pt)[#text(weight: "bold")[#(no)．]]
    fill-inline(q.stem, (26mm,) * q.blanks.len(), size: 13pt)
    h(2mm)
    text(size: 10.5pt, fill: luma(95))[（#q.score 分）]
  } else {
    text(size: 13pt)[#text(weight: "bold")[#(no)．]#q.stem]
    h(2mm)
    text(size: 10.5pt, fill: luma(95))[（#q.score 分）]
    v(0.5mm)
    for _ in range(if q.score >= 6 { 3 } else { 2 }) {
      write-line(h: 8.4mm)
    }
  }
]

/// 答案页判分标签：黑底=对错可判，空心=按要点看
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
    )[#text(size: 7.5pt, fill: luma(60))[按要点看]]
  } else {
    box(
      fill: luma(248),
      stroke: (paint: luma(130), thickness: 0.5pt),
      radius: 1mm,
      inset: (x: 1.6mm, y: 0.5mm),
    )[#text(size: 7.5pt, fill: luma(60))[选择题可判 · 简答按要点]]
  }
}

/// 答案页小节标题：主观题标「按要点看」，客观题标「对错可判」
#let anshead(no, title, mode: "objective") = block(sticky: true, above: 3mm, below: 1mm)[
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

/// 卷面题型正文
#let section-body(s) = {
  if s.typeId == "kanpinyin" {
    hint("读拼音，把词语写在田字格里。")
    for row in chunked(s.items, 5) {
      kanpinyin-line(row.map(i => (i.word, i.pinyin)), size: 10mm, gap: 5mm)
    }
  } else if s.typeId == "zhuyin" {
    hint("在横线上写出下面汉字的读音，注意多音字。")
    for row in chunked(s.items, 9) {
      grid(
        columns: (14mm,) * row.len(),
        column-gutter: 5mm,
        ..row.map(i => zhuyin-item-with-context(i.char, i.context, w: 14mm)),
      )
    }
    v(0.5mm)
    text(size: 9.5pt, fill: luma(110))[提示：多音字要结合下面的语境词定音。]
  } else if s.typeId == "xingjin" {
    hint("看清偏旁，给每个字组一个词语。")
    xingjin-line(s.items.map(i => (i.a, i.b)))
  } else if s.typeId == "gushi-fill" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 {
          hint("补全诗句。")
        }
        #poem-fill(i.title, i.dynasty, i.author, i.prompt, blankFirst: i.blankFirst)
      ]
    }
  } else if s.typeId == "gushi-dimo" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 {
          hint("默写古诗，注意标点和书写。")
        }
        #poem-blank(i.title, i.author, i.dynasty, lines: i.lines.len(), gap: 9mm)
      ]
    }
  } else if s.typeId == "gaibing" {
    hint("只改一处，保持原意。")
    for (j, g) in s.items.enumerate() {
      v(0.8mm)
      text(size: 13pt)[（#(j + 1)）#g.broken]
      v(0.3mm)
      grid(columns: (16mm, 1fr), text(size: 12pt)[改为：], write-line(h: 7mm))
    }
  } else if s.typeId == "guanlian" {
    hint("把关联词填在括号里；同义说法都算对。")
    for (j, g) in s.items.enumerate() {
      v(1.2mm)
      text(size: 13pt)[（#(j + 1)）]
      fill-inline(g.text, (18mm,) * g.answers.at(0).len(), size: 13pt)
    }
  } else if s.typeId == "biaodian" {
    hint("在括号里加上合适的标点。")
    for (j, g) in s.items.enumerate() {
      v(1mm)
      text(size: 13pt)[（#(j + 1)）#g.text]
    }
  } else if s.typeId == "kuoxie" {
    hint("把句子写具体，至少补三处，不改变原意。")
    for (j, g) in s.items.enumerate() {
      v(0.8mm)
      text(size: 13pt)[（#(j + 1)）#g.base]
      text(size: 10.5pt, fill: luma(105))[　提示：#g.hints.join("　/　")]
      write-line(h: 8.5mm)
    }
  } else if s.typeId == "fangxie" {
    hint("读例子，照样子写一句。")
    for (j, g) in s.items.enumerate() {
      v(0.8mm)
      text(size: 12pt)[（#(j + 1)）例：#g.example　#g.prompt]
      write-line(h: 8.5mm)
      write-line(h: 8.5mm)
    }
  } else if s.typeId == "reading" {
    for (k, r) in s.items.enumerate() {
      block(breakable: false)[
        #if k == 0 {
          hint("读短文，完成后面的题目。")
        }
        #block(
          width: 100%,
          fill: luma(250),
          stroke: (paint: luma(195), thickness: 0.6pt),
          radius: 1.5mm,
          inset: (x: 5mm, y: 2mm),
        )[
          #set par(leading: 4.6mm, justify: false)
          #align(center, text(size: 12pt, weight: "bold")[#r.title])
          #v(0.8mm)
          #for para in r.paragraphs {
            [#text(size: 12pt)[#h(2em)#para]]
            parbreak()
          }
        ]
        #v(0.5mm)
        #for (qi, q) in r.questions.enumerate() {
          reading-question(qi + 1, q)
        }
      ]
    }
  } else if s.typeId == "writing" {
    for w in s.items {
      block(breakable: false)[
        #text(size: 12.5pt, weight: "bold")[题目：#w.title]
        #v(1mm)
        #let opening = w.at("storyOpening", default: none)
        #if opening != none [
          #text(size: 11.5pt)[开头：#opening]
          #v(1mm)
        ]
        #text(size: 12pt)[提示：#w.prompt]
        #v(1mm)
        #text(size: 11.5pt)[要求：]
        #for (i, req) in w.requirements.enumerate() {
          text(size: 11.5pt)[#(i + 1)）#req]
          linebreak()
        }
        #text(size: 11.5pt)[字数：#w.wordCount.min～#w.wordCount.max 字。]
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
      text(size: 11.5pt)[#item.note]
    }
  }
}

/// 答案页题型正文
#let answer-body(s) = {
  if s.typeId == "kanpinyin" {
    grid(
      columns: (1fr,) * 4,
      row-gutter: 1mm,
      ..s.items.map(i => box[#py(i.pinyin, size: 8pt)　#han(i.word, size: 10.5pt)]),
    )
  } else if s.typeId == "zhuyin" {
    annotate-word(s.items.map(i => i.pinyin), s.items.map(i => i.char), w: 14mm)
    v(0.5mm)
    text(size: 8.5pt, fill: luma(105))[语境：#s.items.map(i => i.context).join("、")。多音字按语境定音。]
  } else if s.typeId == "xingjin" {
    grid(
      columns: (1fr,) * 3,
      row-gutter: 1mm,
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
          text(size: 9.5pt)[（#(j + 1)）#q.blanks.join("；")]
          linebreak()
        } else {
          text(size: 9.5pt, weight: "bold")[（#(j + 1)）评分要点]
          linebreak()
          scoring-points(q.at("scoring", default: none))
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
              columns: (25mm, 11mm, 1fr),
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

#paper-title(p.meta.title, sub: p.meta.subtitle)
#info-row(fields: ("班级", "姓名", "学号", "得分"))

#for s in p.sections {
  if s.selected > 0 {
    qhead(s.no, s.label, score: s.score)
  } else {
    qhead(s.no, s.label)
  }
  section-body(s)
  if s.gap != none {
    v(1mm)
    gap-block(s)
  }
  v(1.5mm)
}

// ==================== 答案页（可整页取舍）====================

#if p.meta.includeAnswers {
  pagebreak()

  align(center, text(size: 16pt, weight: "bold")[参考答案与评分要点])
  v(1.5mm)
  grid(
    columns: (auto, 1fr),
    column-gutter: 3mm,
    row-gutter: 1mm,
    [ #answer-tag("objective") ], [对错可判：给出答案，可直接核对。],
    [ #answer-tag("subjective") ], [按要点看：只列评分要点，不给标准答案或范文。],
    [ #answer-tag("mixed") ], [混合板块：选择、填空给答案；简答只给评分要点。],
  )
  v(1mm)
  set par(leading: 3.8mm)

  for s in p.sections {
    anshead(s.no, s.label + "（" + str(s.score) + " 分）", mode: s.answerMode)
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
