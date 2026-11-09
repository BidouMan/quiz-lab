// 单篇阅读样张：正文 + 题目 + 答案页（含原题留痕）
// 数据直接读取命题稿，版式沿用语文卷面构件。
// 生成：
//   typst compile --root . --font-path typst/fonts typst/reading-sample.typ samples/reading-sample-RD-378.pdf

#import "chinese.typ": *

#let p = json("../data/reading-catalog/quiz-drafts/RD-378.json")
#let letters = ("A", "B", "C", "D")
#let total = p.questions.fold(0, (acc, q) => acc + q.score)

/// 原题处理方式标签
#let action-tag(action) = {
  let body = text(size: 7.5pt, fill: if action == "保留" { white } else { luma(35) })[#action]
  if action == "保留" {
    box(fill: luma(45), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#body]
  } else if action == "修正" {
    box(stroke: (paint: luma(110), thickness: 0.5pt), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#body]
  } else {
    box(fill: luma(232), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#body]
  }
}

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 16mm, top: 18mm, bottom: 16mm),
  numbering: "第 1 页",
)
#set text(font: cn-font, size: 12.5pt, lang: "zh", region: "cn")
#set par(leading: 5.2mm, justify: false)

/// 题干里的「（ ）」按空数画横线
#let fill-inline(stem, n, w: 26mm) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < n {
      box(width: w, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
      h(1.2mm)
    }
  }
}

/// 答案页：把「（ ）」直接换成答案
#let filled-stem(stem, blanks) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < blanks.len() {
      [（#text(weight: "bold")[#blanks.at(i)])]
    }
  }
}

/// 选择题选项：短选项两列，长选项单列，避免串行
#let choice-options(options) = {
  let wide = options.fold(0, (acc, o) => calc.max(acc, o.len())) > 14
  if wide {
    grid(
      columns: (1fr,),
      row-gutter: 1.2mm,
      ..options.enumerate().map(((i, opt)) => box[#text(size: 12pt)[#letters.at(i)．#opt]]),
    )
  } else {
    grid(
      columns: (1fr,) * 2,
      column-gutter: 6mm,
      row-gutter: 1.5mm,
      ..options.enumerate().map(((i, opt)) => box[#text(size: 12pt)[#letters.at(i)．#opt]]),
    )
  }
}

#paper-title(
  [单篇阅读样张],
  sub: [统编版三年级上册　｜　课外阅读　｜　体裁：#p.theme　｜　#p.questions.len() 题 #total 分],
)
#info-row(fields: ("班级", "姓名", "得分"))

// ---------- 正文 ----------

#block(
  width: 100%,
  fill: luma(250),
  stroke: (paint: luma(195), thickness: 0.6pt),
  radius: 1.5mm,
  inset: (x: 5mm, y: 3mm),
)[
  #set par(leading: 4.8mm)
  #align(center, text(size: 13pt, weight: "bold")[#p.title])
  #v(1mm)
  #for para in p.paragraphs {
    [#text(size: 11.5pt)[#h(2em)#para]]
    parbreak()
  }
]

#v(1mm)
#hint("读短文，完成后面的题目。")

// ---------- 题目 ----------

#for (i, q) in p.questions.enumerate() {
  block(breakable: false, above: 3mm, below: 1mm)[
    #if q.type == "choice" {
      text(size: 12pt)[#text(weight: "bold")[#(i + 1)．]#q.stem]
      h(2mm)
      text(size: 10pt, fill: luma(95))[（#q.score 分）]
      v(1mm)
      choice-options(q.options)
    } else if q.type == "fill" {
      text(size: 12pt)[#text(weight: "bold")[#(i + 1)．]]
      fill-inline(q.stem, q.blanks.len(), w: if q.blanks.at(0).len() > 15 { 130mm } else { 26mm })
      h(2mm)
      text(size: 10pt, fill: luma(95))[（#q.score 分）]
    } else {
      text(size: 12pt)[#text(weight: "bold")[#(i + 1)．]#q.stem]
      h(2mm)
      text(size: 10pt, fill: luma(95))[（#q.score 分）]
      v(0.5mm)
      let n = if q.score >= 4 { 8 } else { 5 }
      for _ in range(n) {
        write-line(h: 8.5mm)
      }
    }
  ]
}

// ---------- 答案页 ----------

#pagebreak()
#align(center, text(size: 16pt, weight: "bold")[参考答案与评分要点])
#v(1.5mm)
#grid(
  columns: (auto, 1fr),
  column-gutter: 4mm,
  row-gutter: 1mm,
  [#box(fill: luma(45), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#text(size: 7.5pt, fill: white)[对错可判]]],
  [客观题：给出答案，可直接核对。],
  [#box(fill: luma(248), stroke: (paint: luma(130), thickness: 0.5pt), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#text(size: 7.5pt, fill: luma(60))[家长可核]]],
  [主观题：先给参考答案，括号内为可接受范围；评分要点供对照。],
)
#v(1mm)
#text(size: 9pt, fill: luma(70))[#p.at("strategyNote", default: "")]
#v(2mm)
#set par(leading: 4mm)

#for (i, q) in p.questions.enumerate() {
  block(above: 3mm, below: 1mm)[
    #if q.type == "fill" {
      text(size: 11pt, weight: "bold")[#(i + 1)．#filled-stem(q.stem, q.blanks)]
    } else {
      text(size: 11pt, weight: "bold")[#(i + 1)．#q.stem]
    }
    #h(2mm)
    #if q.type != "short" {
      box(fill: luma(45), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#text(size: 7.5pt, fill: white)[对错可判]]
    } else {
      box(fill: luma(248), stroke: (paint: luma(130), thickness: 0.5pt), radius: 1mm, inset: (x: 1.6mm, y: 0.5mm))[#text(size: 7.5pt, fill: luma(60))[家长可核]]
    }
    #v(1mm)
    #if q.type == "choice" {
      text(size: 10.5pt)[答案 #letters.at(q.answer)。#q.explain]
    } else if q.type == "fill" {
      text(size: 9.5pt, fill: luma(95))[#q.explain]
    } else {
      let ans = q.at("answer", default: none)
      if ans != none and ans != "" {
        text(size: 9.5pt, weight: "bold")[参考答案]
        linebreak()
        text(size: 10.5pt)[#ans]
        v(1mm)
      }
      text(size: 9.5pt, weight: "bold")[评分要点]
      linebreak()
      for (j, point) in q.scoring.enumerate() {
        text(size: 9.5pt)[#(j + 1)）#point]
        linebreak()
      }
    }
    #let o = q.at("origin", default: none)
    #if o != none {
      v(1.5mm)
      action-tag(o.action)
      h(2mm)
      text(size: 8.5pt, fill: luma(80))[原题：#o.at("original", default: "（新增题）")]
      if o.at("note", default: none) != none {
        linebreak()
        text(size: 8pt, fill: luma(115))[#o.at("note")]
      }
    }
  ]
}

#v(3mm)
#text(size: 8.5pt, fill: luma(100))[
  正文来源：#p.sources.at(0).label（#p.sources.at(0).locator）。
  正文已修正 OCR 错字；原题逐题验判，保留/修正/新命见上方标注。
]
