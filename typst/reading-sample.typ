// 阅读样张：正文 + 题目 + 参考答案（支持单篇/多篇）
// 版式与 chinese-paper-3a.typ 保持一致：A4 18/18/16，正文 11pt，行距 0.82em。
// 生成：
//   typst compile --root . --font-path typst/fonts --input id=RD-378 typst/reading-sample.typ samples/reading-sample-RD-378.pdf
//   typst compile --root . --font-path typst/fonts --input ids=RD-378,RD-647 typst/reading-sample.typ samples/reading-sample-multi.pdf

#import "chinese.typ": *

#let ids-input = sys.inputs.at("ids", default: "")
#let ids = if ids-input.trim() == "" {
  (sys.inputs.at("id", default: "RD-378"),)
} else {
  ids-input.split(",").map(s => s.trim()).filter(s => s != "")
}
#let papers = ids.map(rid => json("../data/reading-catalog/quiz-drafts/" + rid + ".json"))
#let letters = ("A", "B", "C", "D")

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 18mm, top: 18mm, bottom: 16mm),
  numbering: "第 1 页",
)
#set text(font: cn-font, size: 11pt, lang: "zh", region: "cn")
#set par(leading: 0.82em, justify: false)

/// 书写横线：行高即相邻两条线的间距
#let write-line(w: 100%, h: 8mm) = block(
  width: w,
  height: h,
  above: 0pt,
  below: 0pt,
  stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
  inset: 0pt,
)[]

/// 填空横线宽度：答案字数 × 7mm，下限 14mm、上限 105mm（与出卷脚本同口径）
#let blank-width(chars) = calc.min(calc.max(chars * 7mm, 14mm), 105mm)

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

/// 选择题选项：统一两列，避免串行
#let choice-options(options) = grid(
  columns: (1fr,) * 2,
  column-gutter: 10mm,
  row-gutter: 3.6mm,
  ..options.enumerate().map(((i, opt)) => box[#text(size: 11pt)[#letters.at(i)．#opt]]),
)

/// 只取学生实际要写的正文：去掉“示例：”和末尾“也可/即可”这类家长提示
#let core-answer(ans) = {
  let a = ans.trim()
  if a.starts-with("示例：") { a = a.slice(3) }
  if a.starts-with("示例:") { a = a.slice(3) }
  let parts = a.split("。").filter(p => p.trim() != "")
  if parts.len() > 1 {
    let last = parts.last().trim()
    let tails = ("摘抄其他", "预测另一种", "其他合理", "举自己", "举其他", "说清", "句子通顺", "意思通顺")
    if tails.any(t => last.starts-with(t)) {
      parts = parts.slice(0, parts.len() - 1)
    }
  }
  parts.join("。")
}

/// 简答书写行数：按学生实际作答字数给 2–6 行（每行约 25 字，与 7mm/字书写宽度同口径）
#let answer-lines(q) = {
  let ans = q.at("answer", default: "")
  if ans == "" { return 3 }
  let chars = core-answer(ans).clusters().len()
  calc.min(calc.max(calc.ceil(chars / 25), 2), 6)
}

/// 列表项/参数行标记：这些行不首行缩进
#let list-marks = ("①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⊙", "●")

/// 把连续的「｜」行排成带框表格，首行加粗；列数以表头为准，多出的单元格并入末列
#let table-block(rows) = {
  let n = rows.at(0).split("｜").len()
  let cells = ()
  for (ri, r) in rows.enumerate() {
    let raw = r.split("｜").map(s => s.trim())
    let cs = if raw.len() > n {
      let head = raw.slice(0, n - 1)
      head.push(raw.slice(n - 1).join("；"))
      head
    } else {
      raw
    }
    for c in cs {
      cells.push(if ri == 0 { text(weight: "bold")[#c] } else { [#c] })
    }
    for _ in range(n - cs.len()) { cells.push([]) }
  }
  grid(
    columns: (1fr,) * n,
    column-gutter: 0mm,
    row-gutter: 0mm,
    stroke: (x: 0.3pt + luma(215), y: 0.3pt + luma(215)),
    inset: (x: 2.4mm, y: 1.4mm),
    ..cells,
  )
}

#paper-title([三年级语文上册 课外阅读])

// ---------- 正文与题目 ----------
#for (k, p) in papers.enumerate() {
  if k > 0 { v(6mm) }
  block(breakable: false, sticky: true)[
    #align(center, text(size: 14pt, weight: "bold")[#p.title])
    #v(1.6mm)
    #let i = 0
    #while i < p.paragraphs.len() {
      let para = p.paragraphs.at(i)
      if i == 0 and para.trim() == p.title.trim() {
        i += 1
      } else if para.contains("｜") {
        let rows = ()
        while i < p.paragraphs.len() and p.paragraphs.at(i).contains("｜") {
          rows.push(p.paragraphs.at(i))
          i += 1
        }
        table-block(rows)
        v(2mm)
      } else if para.starts-with("【注") {
        text(size: 9.5pt, fill: luma(95))[#para]
        v(1mm)
        i += 1
      } else if para.starts-with("【") {
        v(1.6mm)
        text(size: 11.5pt, weight: "bold")[#para]
        v(0.8mm)
        i += 1
      } else if para.starts-with("（选自") or para.starts-with("(选自") {
        text(size: 9pt, fill: luma(105))[#para]
        v(1mm)
        i += 1
      } else if list-marks.any(m => para.starts-with(m)) or (para.split("：").len() > 1 and para.split("：").at(0).clusters().len() <= 8) {
        [#text(size: 11pt)[#para]]
        parbreak()
        i += 1
      } else {
        [#text(size: 11pt)[#h(2em)#para]]
        parbreak()
        i += 1
      }
    }
  ]

  v(1.4mm)

  for (i, q) in p.questions.enumerate() {
    block(above: 6.6mm, below: 0.6mm, breakable: false)[
      #if q.type == "choice" {
        text(size: 11pt)[#text(weight: "bold")[#(i + 1)．]#q.stem]
        v(0.8mm)
        choice-options(q.options)
      } else if q.type == "fill" {
        text(size: 11pt)[#text(weight: "bold")[#(i + 1)．]]
        fill-inline(q.stem, q.blanks.map(b => blank-width(b.clusters().len())), size: 11pt)
        v(0.4mm)
      } else {
        text(size: 11pt)[#text(weight: "bold")[#(i + 1)．]#q.stem]
        v(1.2mm)
        for _ in range(answer-lines(q)) {
          write-line(h: 8mm)
        }
      }
    ]
  }
}

// ---------- 答案页 ----------
#pagebreak()
#align(center, text(size: 16pt, weight: "bold")[参考答案与解析])
#v(1.5mm)
#set par(leading: 3.8mm)

#for (k, p) in papers.enumerate() {
  if k > 0 { v(7mm) }
  text(size: 10.5pt, weight: "bold")[《#p.title》]
  v(1.5mm)
  for (i, q) in p.questions.enumerate() {
    block(above: 2.4mm, below: 1mm)[
      #if q.type == "choice" {
        text(size: 9.5pt)[（#(i + 1)）答案 #letters.at(q.answer)。#q.explain]
      } else if q.type == "fill" {
        text(size: 9.5pt)[（#(i + 1)）答案：#q.blanks.join("；")]
      } else {
        text(size: 9.5pt)[（#(i + 1)）参考：#q.answer]
      }
    ]
  }
}
