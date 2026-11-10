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
// ============ 版式规则（全题型统一，新增题型必须沿用）============
// 页面：A4，左右边距 18mm，上 18mm、下 16mm；正文 11pt，leading 0.82em（约 1.55 倍），左对齐。
// 字号：卷面所有题目文字统一 11pt（题干、选项、材料正文、出处、字库、提示、要求），
//   不再按题型另设小一号；标题保持层级——题型标题 12pt 加粗、阅读文章标题 14pt 加粗、
//   材料小标题【】11.5pt 加粗；另有注音题词组 13pt、田字格上方拼音 8pt。
// 标题：12pt 加粗；上方距上一题固定 8mm（head-above），下方距第一行 6.2mm（head-below）。
// 小题行距：全卷统一 5.5mm（item-gap），字词、古诗、病句、标点、扩写、阅读各小题同值，
//   表格类（看拼音、注音、多音字、形近字）的行间距也用这个值；古诗句与其书写带固定 2mm。
//   若标题被包进首块防页底孤行，该块的 above 必须写 head-above；题型分支末尾不得留 v()。
// 填空横线宽度（gen-chinese-paper.mjs 统一计算，不在此处写死）：
//   宽 = 答案字数 × 7mm（三年级手写单字宽度），下限 14mm、上限 105mm；所有题型同字同宽。
//   空线前留白 1.5mm（否则横线紧贴左侧文字最后一笔），空线后 1.4mm。
// 诗句补全、古诗默写：诗名用《》加粗 11pt + 11pt 灰「朝代·作者」；每联一行，
//   分句各一条定宽横线，分句间打印全角逗号（5mm 格，逗号落在横线上）；书写带高 6.5mm。
// 给加点字注音：词组 13pt，被注音字下加点；横线按拼音长度取宽，与整个词组居中对齐
//   （格宽取词组与横线的较大者），线与词组 4mm。
// 看拼音写词语：10mm 田字格，拼音 8pt，拼音与格子 1.6mm，5 列，行距 6mm。
// 修改病句：「改为：」与横线同基线（grid align bottom，标签列 auto）。
// 扩写、仿写：各 1 行书写线。阅读简答：按参考答案长度给 2–6 行。
// ==============================================================
#let head-above = 8mm
#let head-below = 6.2mm
// 小题与小节之间的行距：全卷所有题型共用一个值，不再各分支各写一套
#let item-gap = 5.5mm
#let qhead(no, title) = block(sticky: true, above: head-above, below: head-below)[
  #text(size: 12pt, weight: "bold")[#no．#title]
]

/// 书写带：每个分句一条按字数定宽的横线，分句之间打印逗号，
/// 宽度由 gen-chinese-paper.mjs 按「字数 × 7mm」算好后传入。
#let write-band(widths, h: 6.5mm) = {
  let cells = ()
  for (i, w) in widths.enumerate() {
    if i > 0 {
      cells.push(box(width: 5mm, height: h, align(bottom + center, text(size: 11pt)[，])))
    }
    cells.push(box(
      width: w,
      height: h,
      stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
      inset: 0pt,
    )[])
  }
  grid(columns: (auto,) * cells.len(), align: bottom, ..cells)
}

// 古诗默写：与古诗补全同一套结构（诗名行 + 按字数定宽的书写带），
// 每联一行，联内两个分句之间打印逗号。
#let poem-blank(no, title, author, dynasty, lineWidths, above: 0mm) = block(above: above, below: 0mm)[
  #text(size: 11pt, weight: "bold")[#(no)．《#title》]
  #h(3mm)
  #text(size: 11pt, fill: luma(115))[#(dynasty)·#(author)]
  #v(1.6mm)
  #for (i, widths) in lineWidths.enumerate() {
    if i > 0 { v(4.5mm) }
    block(above: 0pt, below: 0pt)[#write-band(widths)]
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

/// 古诗补全：题号 + 诗名（加粗，篇名加书名号）+ 朝代·作者（灰字），
/// 给出的诗句与待补的横线都排在同一行，一次只补整联；诗名行与诗句左对齐。
#let poem-fill(no, title, dynasty, author, verse, widths, blankFirst: false, above: 0mm) = block(above: above, below: 0mm)[
  // 诗名行：题号与诗名加粗，出处用灰字区分层次（字号与正文统一）
  #text(size: 11pt, weight: "bold")[#(no)．《#title》]
  #h(3mm)
  #text(size: 11pt, fill: luma(115))[#(dynasty)·#(author)]
  #v(1.6mm)
  // 书写带：每个分句一条横线，分句之间打印逗号；线距本方诗句比距下一题更近
  // 用 block 包住，去掉 grid 自带的段落间距，否则诗句与横线之间会多空出近 5mm
  #let band = block(above: 0pt, below: 0pt)[#write-band(widths)]
  #if blankFirst {
    band
    v(3mm)
    text(size: 11pt)[#verse]
  } else {
    text(size: 11pt)[#verse]
    v(2mm)
    band
  }
]

/// 注音题：整词一行排，被注音的字下方加点，字上方按拼音长度给横线
#let zhuyin-word(word, target, bw: 12mm, size: 13pt) = {
  let chars = word.clusters()
  let idx = if target in chars { chars.position(c => c == target) } else { 0 }
  let unit = size
  // 单元格宽度取「词组宽」与「横线宽」的较大者：横线按拼音长度定宽，
  // 词组与横线都以整格居中对齐，横线不再只对准被注音的单字。
  let wordWidth = chars.len() * unit
  let total = calc.max(wordWidth, bw)
  // 词组在整格里的左偏移，以及被注音字中心（相对整格左边缘）
  let wordLeft = (total - wordWidth) / 2
  let cx = wordLeft + idx * unit + unit / 2
  stack(
    dir: ttb,
    spacing: 4mm,
    // 拼音横线：与整个词组居中对齐，左右两端落在同一格内
    box(width: total, height: 2.4mm)[
      #place(top + left, dx: (total - bw) / 2, box(
        width: bw,
        height: 2.4mm,
        stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
        inset: 0pt,
      )[])
    ],
    // 词组：逐字等宽排（保证圆点对准字的中心）；被注音字下方加点
    box(width: total)[
      #pad(left: wordLeft, grid(
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
    row-gutter: item-gap,
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
    row-gutter: item-gap,
    ..cells,
  )
}

/// 多音字组词：每个读音后面给一条横线，两列排布
#let duoyin-line(items) = {
  let cells = items.map(i => block[
    #text(size: 11pt, weight: "bold")[#i.char]　
    #for (k, r) in i.readings.enumerate() {
      h(0.6mm)
      text(size: 11pt)[#r.pinyin]
      // 横线按组词答案字数取宽（同全卷规则），并留出与拼音的间距；
      // 定宽过大时「应 yīng＿ yìng＿」会在右列放不下，横线掉到下一行
      h(1.2mm)
      box(
        width: calc.min(calc.max(r.word.clusters().len() * 7mm, 14mm), 21mm),
        stroke: (bottom: (thickness: 0.5pt, paint: luma(140))),
        inset: 0pt,
      )[]
      if k < i.readings.len() - 1 { h(3.5mm) }
    }
  ])
  if calc.rem(cells.len(), 2) != 0 { cells.push(box()) }
  grid(
    columns: (1fr,) * 2,
    column-gutter: 10mm,
    row-gutter: item-gap,
    ..cells,
  )
}

/// 按「（ ）」把题干拆成“文字 + 空线”
#let fill-inline(stem, widths, size: 11pt) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < parts.len() - 1 {
      // 空线前留白：否则横线会紧贴左侧文字的最后一笔，看起来要重叠
      if part.trim() != "" { h(1.5mm) }
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

/// 阅读材料里的列表项/参数行标记：这些行不首行缩进
#let reading-list-marks = ("①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⊙", "●")

/// 阅读材料里的「｜」行排成带框表格，首行加粗；列数以表头为准，多出的单元格并入末列
#let reading-table(rows) = {
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

/// 阅读题：选择 / 填空 / 简答三种版式分开排；整题不可断页
#let reading-question(no, q) = block(
  above: item-gap,
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

/// 答案页小节标题
#let anshead(no, title, mode: "objective") = block(sticky: true, above: 3mm, below: 2mm)[
  #text(size: 12pt, weight: "bold")[#no．#title]
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
  #set text(size: 11pt)
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
  } else if s.typeId == "duoyin" {
    duoyin-line(s.items)
  } else if s.typeId in ("cipu", "jinayi", "xuanzi", "riji") {
    for (j, g) in s.items.enumerate() {
      // 同一题型内的小节：量词 / 四字词语 / 课文原句中的搭配，各段独立起头
      let gname = g.at("group", default: none)
      let new-group = gname != none and (j == 0 or s.items.at(j - 1).at("group", default: none) != gname)
      if new-group {
        block(sticky: true, above: if j == 0 { 0mm } else { item-gap }, below: 2.2mm)[
          #text(size: 11pt, weight: "bold")[#gname]
        ]
      }
      block(breakable: false, above: if new-group { 0mm } else { item-gap })[
        #text(size: 11pt)[（#(j + 1)）]
        #if g.at("bank", default: none) != none {
          text(size: 11pt, fill: luma(95))[字库：#g.bank.join("　")]　
        }
        #fill-inline(g.text, g.blankWidthsMm.map(w => w * 1mm), size: 11pt)
      ]
    }
  } else if s.typeId == "xingjin" {
    block(breakable: false)[
      #xingjin-line(s.items.map(i => (i.a, i.b)), row-gap: item-gap)
    ]
  } else if s.typeId == "gushi-fill" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false, above: if k == 0 { head-above } else { item-gap })[
        #if k == 0 {
          head
        }
        #poem-fill(
          k + 1,
          i.title,
          i.dynasty,
          i.author,
          i.prompt,
          i.clauseWidthsMm.map(w => w * 1mm),
          blankFirst: i.blankFirst,
        )
      ]
    }
  } else if s.typeId == "gushi-dimo" {
    for (k, i) in s.items.enumerate() {
      block(breakable: false, above: if k == 0 { head-above } else { item-gap })[
        #if k == 0 {
          head
        }
        #poem-blank(
          k + 1,
          i.title,
          i.author,
          i.dynasty,
          i.blankWidthsPerLineMm.map(row => row.map(w => w * 1mm)),
        )
      ]
    }
  } else if s.typeId == "gaibing" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: if j == 0 { 0mm } else { item-gap })[
        #text(size: 11pt)[（#(j + 1)）#g.broken]
        #v(0.3mm)
        #grid(
          columns: (auto, 1fr),
          align: bottom,
          column-gutter: 2mm,
          text(size: 11pt)[改为：],
          write-line(h: 6.5mm),
        )
      ]
    }
  } else if s.typeId == "guanlian" {
    for (j, g) in s.items.enumerate() {
      if j > 0 { v(item-gap) }
      text(size: 11pt)[（#(j + 1)）]
      fill-inline(g.text, g.blankWidthsMm.map(w => w * 1mm), size: 11pt)
    }
  } else if s.typeId == "biaodian" {
    for (j, g) in s.items.enumerate() {
      if j > 0 { v(item-gap) }
      text(size: 11pt)[（#(j + 1)）#g.text]
    }
  } else if s.typeId == "kuoxie" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: item-gap)[
        #text(size: 11pt)[（#(j + 1)）#g.base]
        #text(size: 11pt, fill: luma(105))[　提示：#g.hints.join("　/　")]
        #for _ in range(g.blankLines) { write-line(h: 8mm) }
      ]
    }
  } else if s.typeId == "fangxie" {
    for (j, g) in s.items.enumerate() {
      block(breakable: false, above: item-gap)[
        #text(size: 11pt)[（#(j + 1)）例：#g.example　#g.prompt]
        #for _ in range(g.blankLines) { write-line(h: 8mm) }
      ]
    }
  } else if s.typeId == "reading" {
    for (k, r) in s.items.enumerate() {
      block(breakable: false, sticky: true, above: if k == 0 { head-above } else { 0mm })[
        #if k == 0 {
          head
        }
        #align(center, text(size: 14pt, weight: "bold")[#r.title])
        #v(1.6mm)
        #let pi = 0
        #while pi < r.paragraphs.len() {
          let para = r.paragraphs.at(pi)
          if pi == 0 and para.trim() == r.title.trim() {
            pi += 1
          } else if para.contains("｜") {
            let rows = ()
            while pi < r.paragraphs.len() and r.paragraphs.at(pi).contains("｜") {
              rows.push(r.paragraphs.at(pi))
              pi += 1
            }
            reading-table(rows)
            v(2mm)
          } else if para.starts-with("【材料") {
            v(1.6mm)
            text(size: 11.5pt, weight: "bold")[#para]
            v(0.8mm)
            pi += 1
          } else if para.starts-with("【注") {
            text(size: 11pt, fill: luma(95))[#para]
            v(1mm)
            pi += 1
          } else if para.starts-with("【") {
            v(1.6mm)
            text(size: 11.5pt, weight: "bold")[#para]
            v(0.8mm)
            pi += 1
          } else if para.starts-with("（选自") or para.starts-with("(选自") {
            text(size: 11pt, fill: luma(105))[#para]
            v(1mm)
            pi += 1
          } else if reading-list-marks.any(m => para.starts-with(m)) or (para.split("：").len() > 1 and para.split("：").at(0).clusters().len() <= 8) {
            [#text(size: 11pt)[#para]]
            parbreak()
            pi += 1
          } else {
            [#text(size: 11pt)[#h(2em)#para]]
            parbreak()
            pi += 1
          }
        }
      ]
      v(1.4mm)
      for (qi, q) in r.questions.enumerate() {
        reading-question(qi + 1, q)
      }
      if k < s.items.len() - 1 { v(2mm) }
    }
  } else if s.typeId == "writing" {
    for (k, w) in s.items.enumerate() {
      block(breakable: false, above: if k == 0 { head-above } else { item-gap })[
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
  } else if s.typeId == "duoyin" {
    grid(
      columns: (1fr,) * 2,
      row-gutter: 2.6mm,
      ..s.items.map(i => box[
        #han(i.char, size: 11pt)　#i.readings.map(r => [#r.pinyin： #r.word]).join("　")
      ]),
    )
    v(0.5mm)
    text(size: 8.5pt, fill: luma(105))[组词答案不唯一，读音正确、词语成立都算对。]
  } else if s.typeId in ("cipu", "jinayi", "xuanzi", "riji") {
    for (j, g) in s.items.enumerate() {
      text(size: 9.5pt)[（#(j + 1)）#apply-blanks(g.text, g.answers)]
      if g.at("bank", default: none) != none {
        text(size: 8.5pt, fill: luma(105))[（字库：#g.bank.join("、")）]
      }
      linebreak()
    }
    if s.typeId == "cipu" {
      text(size: 8.5pt, fill: luma(105))[量词、四字词语按教材词语表核对，课文原句搭配按原文核对；错字、漏字需订正。]
    } else if s.typeId == "jinayi" {
      text(size: 8.5pt, fill: luma(105))[近义词、反义词答案不唯一，意思相近或相反即可。]
    } else if s.typeId == "riji" {
      text(size: 8.5pt, fill: luma(105))[日积月累按教材原文核对，错字、漏字需订正。]
    } else if s.typeId == "xuanzi" {
      text(size: 8.5pt, fill: luma(105))[选字填空按字库选字，每个字都要用上。]
    }
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
    for (k, r) in s.items.enumerate() {
      if k > 0 { v(7mm) }
      text(size: 10.5pt, weight: "bold")[《#r.title》]
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
  if s.selected > 0 {
    section-body(s, qhead(s.no, s.label))
  } else {
    // 空题型也要有题号与标题，避免学生看到无标题的缺口框
    qhead(s.no, s.label)
  }
  if s.gap != none {
    v(1mm)
    gap-block(s)
  }
}

// ==================== 答案页（可整页取舍）====================

#if p.meta.includeAnswers {
  pagebreak()

  align(center, text(size: 16pt, weight: "bold")[参考答案与解析])
  v(1.5mm)
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
