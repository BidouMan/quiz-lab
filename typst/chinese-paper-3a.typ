// 三年级语文上册 完整卷样张（100 分制）
// 数据由 typst/gen-chinese-paper.mjs 从 src/data/chinese 的 verified 素材装配，
// 本文件只负责版式，不改 paper.typ 与数学版式。
//
// 卷面构成：字词 22 + 古诗 13 + 句子 10 + 课内阅读 10（留空）+ 课外阅读 12 + 习作 30 + 卷面 3 = 100
// 可判分约 90 分（课内阅读因缺教材课文页留空）。

#import "chinese.typ": *
#let p = json("data/chinese-3a-paper.json")

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 12.7mm, top: 19mm, bottom: 16mm),
  numbering: "第 1 页",
)
#set text(font: cn-font, size: 14pt, lang: "zh", region: "cn")
#set par(leading: 5.6mm, justify: false)

// ---------- 本卷局部构件 ----------

/// 古诗补全：题名行 + 前半句 + 书写空线（与既有样张一致）
#let poem-fill(title, dynasty, author, first, blank: 42mm) = block(above: 2.5mm, below: 1.5mm)[
  #text(size: 11.5pt)[#title　#(dynasty)·#(author)]
  #h(4mm)
  #text(size: 13pt)[#first]
  #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
  #text(size: 13pt)[。]
]

/// 按「（ ）」把题干拆成“文字 + 空线”，阅读填空和句子填空共用
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

/// 把题干里的「（ ）」按顺序替换成答案，用于标点题的完整句展示
#let apply-blanks(stem, values) = {
  let parts = stem.split("（ ）")
  for (i, part) in parts.enumerate() {
    [#part]
    if i < parts.len() - 1 {
      [#values.at(i)]
    }
  }
}

/// 选择题四选一：两列排，题号用 A–D
#let choice-options(options) = {
  let letters = ("A", "B", "C", "D")
  grid(
    columns: (1fr,) * 2,
    column-gutter: 6mm,
    row-gutter: 1.5mm,
    ..options.enumerate().map(((i, opt)) => box[#text(size: 12.5pt)[#letters.at(i)．#opt]]),
  )
}

/// 阅读题：选择 / 填空 / 简答三种版式分开排，简答按分数给书写行
#let reading-question(no, q) = block(above: 3mm, below: 0.5mm)[
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
      write-line(h: 9mm)
    }
  }
]

/// 答案页小节标题
#let anshead(no, title) = block(above: 3mm, below: 1mm)[
  #text(size: 12pt, weight: "bold")[#no．#title]
]

// ==================== 第 1 页：字词 ====================

#paper-title(
  p.meta.title + "（样张）",
  sub: p.meta.subtitle,
)
#info-row(fields: ("班级", "姓名", "学号", "得分"))

#qhead(1, "看拼音写词语", score: 10)
#hint("读拼音，把词语写在田字格里。")
#kanpinyin-line(
  p.words.slice(0, 5).map(w => (w.word, w.pinyin)),
  size: 10mm,
  gap: 5mm,
)
#kanpinyin-line(
  p.words.slice(5, 10).map(w => (w.word, w.pinyin)),
  size: 10mm,
  gap: 5mm,
)

#qhead(2, "给加点字注音", score: 6)
#hint("在横线上写出下面汉字的读音，注意多音字。")
#zhuyin-line(p.zhuyin.map(z => z.char), w: 15mm, gap: 6mm)
#v(0.5mm)
#text(size: 9.5pt, fill: luma(110))[
  提示：“晃”在“晃动”中读 huàng，“假”在“放假”中读 jià。
]

#qhead(3, "形近字组词", score: 6)
#hint("看清偏旁，给每个字组一个词语。")
#xingjin-line(p.xingjin.map(x => (x.a, x.b)))

// ==================== 第 2 页：古诗 + 句子 ====================

#pagebreak()

#qhead(4, "古诗积累", score: 13)
#hint("补全诗句，并默写《鹿柴》。")
#for poem in p.poems {
  poem-fill(poem.title, poem.dynasty, poem.author, poem.prompt)
}
#poem-blank(p.dimo.title, p.dimo.author, p.dimo.dynasty, lines: 2, gap: 9mm)

#qhead(5, "句子运用", score: 10)
#hint("按要求完成下列各题。")

#text(size: 12.5pt, weight: "bold")[1．修改病句。]
#for (i, g) in p.sentences.gaibing.enumerate() {
  v(1.5mm)
  text(size: 13pt)[（#(i + 1)）#g.broken]
  v(0.5mm)
  grid(
    columns: (16mm, 1fr),
    [#text(size: 12pt)[改为：]],
    write-line(h: 8mm),
  )
}

#text(size: 12.5pt, weight: "bold")[2．填关联词。]
#for (i, g) in p.sentences.guanlian.enumerate() {
  v(2.5mm)
  text(size: 13pt)[（#(i + 1)）]
  fill-inline(g.text, (18mm,) * g.blanks.len(), size: 13pt)
}

#text(size: 12.5pt, weight: "bold")[3．加标点。]
#v(2.5mm)
#text(size: 13pt)[（1）#p.sentences.biaodian.text]

#text(size: 12.5pt, weight: "bold")[4．仿写句子。]
#v(1mm)
#text(size: 12pt)[例：#p.sentences.fangxie.example]
#v(1mm)
#text(size: 13pt)[#p.sentences.fangxie.prompt]
#write-line(h: 9mm)
#write-line(h: 9mm)

// ==================== 第 3 页：课内 + 课外阅读 ====================

#pagebreak()

#qhead(6, "课内阅读", score: 10)
#block(
  width: 100%,
  height: 40mm,
  fill: luma(249),
  stroke: (paint: luma(180), thickness: 0.6pt, dash: "dashed"),
  radius: 1.5mm,
  inset: (x: 4.5mm, y: 3mm),
)[
  #set text(size: 10.5pt)
  #text(weight: "bold")[缺什么：]教材第 1–4 课或第 20 课的课文原文段落、课后题与参考答案。当前数据层只有字词表和古诗，没有课文正文，因此本框留空，不用课外短文顶替。
  #v(1.5mm)
  #text(weight: "bold")[需要什么才能补：]上述课文的完整原文页（含段落与课后题），以及配套的参考答案与评分点。
]

#qhead(7, "课外阅读", score: 12)
#hint("读短文，完成后面的题目。")

#block(
  width: 100%,
  fill: luma(250),
  stroke: (paint: luma(195), thickness: 0.6pt),
  radius: 1.5mm,
  inset: (x: 5mm, y: 3.5mm),
)[
  #set par(leading: 5.2mm, justify: false)
  #align(center, text(size: 12pt, weight: "bold")[#p.reading.title])
  #v(1.5mm)
  #for para in p.reading.paragraphs {
    [#text(size: 12.5pt)[#h(2em)#para]]
    parbreak()
  }
]

#v(1mm)
#for (i, q) in p.reading.questions.enumerate() {
  reading-question(i + 1, q)
}

// ==================== 第 4 页：习作 ====================

#pagebreak()

#qhead(8, "习作", score: 30)
#text(size: 12.5pt, weight: "bold")[题目：#p.writing.title]
#v(1mm)
#text(size: 12pt)[提示：#p.writing.prompt]
#v(1mm)
#text(size: 11.5pt)[要求：]
#for (i, req) in p.writing.requirements.enumerate() {
  text(size: 11.5pt)[#(i + 1)）#req]
  linebreak()
}
#text(size: 11.5pt)[字数：#p.writing.wordCount.min～#p.writing.wordCount.max 字。]

#v(2mm)
#align(center)[
  #grid(
    columns: (8mm,) * 20,
    rows: (8mm,) * 22,
    stroke: (thickness: 0.6pt, paint: luma(145)),
    inset: 0pt,
    ..range(20 * 22).map(i => tian-cell(size: 8mm, cross: false)),
  )
]

#qhead(9, "卷面书写", score: 3)
#text(size: 11.5pt)[根据全卷书写是否工整、卷面是否整洁评分。]

// ==================== 第 5 页：参考答案 ====================

#pagebreak()

#align(center, text(size: 16pt, weight: "bold")[参考答案与评分说明])
#v(1.5mm)
#text(size: 9pt, fill: luma(110))[答案页只给判分依据；习作只出题，不提供评分标准或范文。]
#set par(leading: 4.2mm)

#anshead("一", "看拼音写词语（每词 1 分，共 10 分）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 1.5mm,
  ..p.words.map(w => box[#py(w.pinyin, size: 8.5pt)　#han(w.word, size: 11pt)]),
)

#anshead("二", "给加点字注音（每字 1 分，共 6 分）")
#annotate-word(p.zhuyin.map(z => z.pinyin), p.zhuyin.map(z => z.char), w: 14mm)
#v(0.5mm)
#text(size: 8.5pt, fill: luma(105))[“晃”读 huàng（晃动），“假”读 jià（放假）。]

#anshead("三", "形近字组词（每组 1 分，共 6 分；答案不唯一）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 1mm,
  ..p.xingjin.map(x => box[
    #han(x.a, size: 11pt)（#text(size: 10pt)[#x.aAnswer]）　#han(x.b, size: 11pt)（#text(size: 10pt)[#x.bAnswer]）
  ]),
)

#anshead("四", "古诗积累（补全每空 2 分，默写 3 分，共 13 分）")
#for poem in p.poems {
  text(size: 9.5pt)[《#poem.title》（#poem.dynasty#h(0.4mm)·#h(0.4mm)#poem.author）　#poem.prompt#poem.answer。]
  linebreak()
}
#text(size: 9.5pt)[《#p.dimo.title》（#p.dimo.dynasty#h(0.4mm)·#h(0.4mm)#p.dimo.author）　#p.dimo.lines.join("")]

#anshead("五", "句子运用（共 10 分）")
#text(size: 10pt, weight: "bold")[1．修改病句（每题 2 分）]
#for (i, g) in p.sentences.gaibing.enumerate() {
  text(size: 9.5pt)[（#(i + 1)）#g.broken → #g.fixed]
  if g.acceptable.len() > 0 {
    text(size: 9pt, fill: luma(105))[（也可改为：#g.acceptable.join("；")）]
  }
  linebreak()
}
#text(size: 10pt, weight: "bold")[2．关联词（每题 1 分）]
#for (i, g) in p.sentences.guanlian.enumerate() {
  text(size: 9.5pt)[（#(i + 1)）依次填：#g.blanks.map(b => b.join("/")).join("，")]
  linebreak()
}
#text(size: 10pt, weight: "bold")[3．标点（2 分）]
#text(size: 9.5pt)[#apply-blanks(p.sentences.biaodian.text, p.sentences.biaodian.blanks)]
#v(0.5mm)
#text(size: 10pt, weight: "bold")[4．仿写（2 分）]
#text(size: 9.5pt)[示例：#p.sentences.fangxie.samples.join("；")]
#text(size: 8.8pt, fill: luma(105))[（用拟人写书包，写出人的动作即可）]

#anshead("六", "课内阅读（10 分）")
#text(size: 9.5pt)[本卷未排此题：缺教材课文页，无答案。]

#anshead("七", "课外阅读（12 分）")
#for (i, q) in p.reading.questions.enumerate() {
  if q.type == "choice" {
    text(size: 9.5pt)[（#(i + 1)）答案 #("A", "B", "C", "D").at(q.answer)。#q.explain]
  } else if q.type == "fill" {
    text(size: 9.5pt)[（#(i + 1)）#q.blanks.join("；")]
  } else {
    text(size: 9.5pt)[（#(i + 1)）#q.answer]
    text(size: 9pt, fill: luma(105))[评分点：#q.scoring.join("；")。]
  }
  linebreak()
}

#anshead("八", "习作（30 分）")
#text(size: 9.5pt)[只出题，不判分：由教师按教材习作要求评阅，本卷不提供评分标准或范文。]

#anshead("九", "卷面书写（3 分）")
#text(size: 9.5pt)[按全卷书写工整、卷面整洁程度评分，无固定答案。]

// ==================== 第 6 页：附录 ====================

#pagebreak()

#align(center, text(size: 15pt, weight: "bold")[分值构成、素材来源与缺口])
#v(1.5mm)
#set par(leading: 3.8mm)

#text(size: 9.5pt)[
  本卷共 #p.meta.total 分。其中第六题“课内阅读”10 分因缺教材课文页留空，*可判分部分约 #p.meta.gradable 分*。
  全卷只使用 `verified` 素材，没有用 pending 条目或临时编题顶替。
]

#v(1.5mm)
#text(size: 10.5pt, weight: "bold")[一、各题型实际分值]
#v(0.5mm)
#block[
  #set text(size: 9pt)
  #grid(
    columns: (11mm, 31mm, 12mm, 38mm, 1fr),
    stroke: (thickness: 0.5pt, paint: luma(170)),
    inset: (x: 2mm, y: 1mm),
    align: (center + horizon, left + horizon, center + horizon, left + horizon, left + horizon),
    ..([*题号*], [*题型*], [*分值*], [*判分方式*], [*素材依据*]),
    ..p.composition.map(c => ([#c.no], [#c.title], [#c.score], [#c.judge], [#c.basis])).flatten(),
  )
]

#v(1.5mm)
#text(size: 9.2pt)[
  *配比调整说明*：建议配比合计 97 分（字词 22 + 古诗 13 + 句子 10 + 课外阅读 12 + 习作 30 + 课内阅读 10）。
  本卷补 3 分“卷面书写”达到 100 分，依据是题型表 §2.5 的卷面 2–3 分；其余分值未改。
  阅读 12 分按“选择 2 + 填空 2 + 填空 2 + 简答 6”分配；句子 10 分按“病句 2×2 + 关联词 2×1 + 标点 2 + 仿写 2”分配。
]

#v(1mm)
#text(size: 9.2pt)[
  *版式说明*：习作用 20 列 × 22 行、8mm 方格（440 格），与三年级作文本常见格宽一致，便于把字写进格、控制字距和行距；440 格可容纳 300–400 字及标点。
  课外阅读短文放在浅底框内，正文 12.5pt、行距 5.2mm；题目在框外单独编号，短文与题目分区。
  题序按“字词—古诗—句子—课内阅读—课外阅读—习作”排列，先课内后课外；建议配比中的分值不变。
]

#v(1.5mm)
#text(size: 10.5pt, weight: "bold")[二、用到的具体素材（均可按编号回溯）]
#v(0.5mm)
#text(size: 9.2pt)[
  *字词*：第 1 课词语 4 条、第 2 课词语 6 条；注音取第 1 课识字 5 字 + 第 2 课多音字“假”；形近字题面字取第 1–4 课写字表。
]
#text(size: 9.2pt)[
  *古诗*：《山行》《望洞庭》《夜书所见》来自第 4 课；《望天门山》《饮湖上初晴后雨》《鹿柴》来自第 20 课。
]
#text(size: 9.2pt)[
  *句子*：#p.sentences.gaibing.map(g => g.id).join("、")#("、")#p.sentences.guanlian.map(g => g.id).join("、")#("、")#p.sentences.biaodian.id#("、")#p.sentences.fangxie.id。
]
#text(size: 9.2pt)[
  *课外阅读*：#p.reading.id《#p.reading.title》，用完整 4 题；*习作*：#p.writing.id《#p.writing.title》（#p.writing.unitName）。
]

#v(1.5mm)
#text(size: 10.5pt, weight: "bold")[三、离真实三上卷还差什么]
#v(0.5mm)
#for (i, gap) in p.gaps.enumerate() {
  text(size: 9.2pt)[#text(weight: "bold")[#(i + 1)）#gap.title：]#gap.need]
  v(0.6mm)
}
