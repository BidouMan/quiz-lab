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
#let poem-fill(title, dynasty, author, first, blank: 42mm) = block(above: 1.4mm, below: 0.8mm)[
  #text(size: 11.5pt)[#title　#(dynasty)·#(author)]
  #h(4mm)
  #text(size: 13pt)[#first]
  #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
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
#poem-blank(p.dimo.title, p.dimo.author, p.dimo.dynasty, lines: 2, gap: 6mm)

#qhead(5, "句子运用", score: 10)

#text(size: 12.5pt, weight: "bold")[1．修改病句（每题 2 分，共 4 分；只改一处，保持原意）。]
#for (i, g) in p.sentences.gaibing.enumerate() {
  v(0.8mm)
  text(size: 13pt)[（#(i + 1)）#g.broken]
  v(0.3mm)
  grid(
    columns: (16mm, 1fr),
    [#text(size: 12pt)[改为：]],
    write-line(h: 7mm),
  )
}

#text(size: 12.5pt, weight: "bold")[2．填关联词（每题 1 分，共 2 分；同义说法都算对）。]
#for (i, g) in p.sentences.guanlian.enumerate() {
  v(1.2mm)
  text(size: 13pt)[（#(i + 1)）]
  fill-inline(g.text, (18mm,) * g.blanks.len(), size: 13pt)
}

#text(size: 12.5pt, weight: "bold")[3．加标点（2 分）。]
#v(1mm)
#text(size: 13pt)[（1）#p.sentences.biaodian.text]

#text(size: 12.5pt, weight: "bold")[4．扩写句子（2 分，按要点作答：至少补三处，不改变原意）。]
#v(0.8mm)
#text(size: 13pt)[#p.sentences.kuoxie.base]
#text(size: 10.5pt, fill: luma(105))[　提示：#p.sentences.kuoxie.hints.join("　/　")]
#write-line(h: 8.5mm)

#text(size: 12.5pt, weight: "bold")[5．仿写句子（2 分，按要点作答：把物当作人来写，写出人的动作或心情）。]
#v(0.8mm)
#text(size: 12pt)[例：#p.sentences.fangxie.example　#p.sentences.fangxie.prompt]
#write-line(h: 8.5mm)
#write-line(h: 8.5mm)

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
  inset: (x: 5mm, y: 2mm),
)[
  #set par(leading: 4.6mm, justify: false)
  #align(center, text(size: 12pt, weight: "bold")[#p.reading.title])
  #v(0.8mm)
  #for para in p.reading.paragraphs {
    [#text(size: 12pt)[#h(2em)#para]]
    parbreak()
  }
]

#v(0.5mm)
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

#v(0.8mm)
#align(center)[
  #grid(
    columns: (7.85mm,) * 20,
    rows: (7.85mm,) * 22,
    stroke: (thickness: 0.6pt, paint: luma(145)),
    inset: 0pt,
    ..range(20 * 22).map(i => tian-cell(size: 7.85mm, cross: false)),
  )
]

#qhead(9, "卷面书写", score: 3)
#text(size: 11.5pt)[根据全卷书写是否工整、卷面是否整洁评分。]

// ==================== 第 5 页：参考答案 ====================

#pagebreak()

#align(center, text(size: 16pt, weight: "bold")[参考答案与评分说明])
#v(1.5mm)
#text(size: 9pt, fill: luma(110))[答案页给判分依据；扩写、仿写与习作按评分点面批，不给范文。]
#set par(leading: 3.8mm)

#anshead("一", "看拼音写词语（每词 1 分，共 10 分）")
#grid(
  columns: (1fr,) * 4,
  row-gutter: 1mm,
  ..p.words.map(w => box[#py(w.pinyin, size: 8pt)　#han(w.word, size: 10.5pt)]),
)

#anshead("二", "给加点字注音（每字 1 分，共 6 分）")
#annotate-word(p.zhuyin.map(z => z.pinyin), p.zhuyin.map(z => z.char), w: 14mm)
#v(0.5mm)
#text(size: 8.5pt, fill: luma(105))[“晃”读 huàng（晃动），“假”读 jià（放假）。]

#anshead("三", "形近字组词（每组 1 分，共 6 分；答案不唯一）")
#grid(
  columns: (1fr,) * 3,
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
#text(size: 10pt, weight: "bold")[1．修改病句（每题 2 分，共 4 分；只改一处）]
#for (i, g) in p.sentences.gaibing.enumerate() {
  text(size: 9.5pt)[（#(i + 1)）#g.broken → #g.fixed]
  if g.acceptable.len() > 0 {
    text(size: 9pt, fill: luma(105))[（也可改为：#g.acceptable.join("；")）]
  }
  linebreak()
}
#text(size: 10pt, weight: "bold")[2．关联词（每题 1 分，共 2 分；同义说法都算对）]
#for (i, g) in p.sentences.guanlian.enumerate() {
  text(size: 9.5pt)[（#(i + 1)）#g.answers.map(a => a.join("/")).join("；")]
  linebreak()
}
#text(size: 10pt, weight: "bold")[3．标点（2 分）]
#text(size: 9.5pt)[#apply-blanks(p.sentences.biaodian.text, p.sentences.biaodian.blanks)]
#if p.sentences.biaodian.answers.len() > 1 {
  linebreak()
  text(size: 9pt, fill: luma(105))[也可写作：#p.sentences.biaodian.answers.slice(1).map(a => apply-blanks(p.sentences.biaodian.text, a)).join("；")]
}
#text(size: 10pt, weight: "bold")[4．扩写（2 分，按评分点面批）]
#text(size: 9.5pt)[示例：#p.sentences.kuoxie.samples.join("；")]
#text(size: 8.8pt, fill: luma(105))[评分点（每条 0.5 分）：#p.sentences.kuoxie.rubric.join("；")]
#text(size: 10pt, weight: "bold")[5．仿写（2 分，按评分点面批）]
#text(size: 9.5pt)[示例：#p.sentences.fangxie.samples.join("；")]
#text(size: 8.8pt, fill: luma(105))[评分点（每条 0.5 分）：#p.sentences.fangxie.rubric.join("；")]

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

// ==================== 第 6 页：习作评分标准 ====================

#pagebreak()

#align(center, text(size: 13.5pt, weight: "bold")[习作评分标准（家长面批，30 分）])
#v(1mm)
#text(size: 9pt)[
  *八．习作（30 分）*：#p.writing.id《#p.writing.title》（#p.writing.unitName）。按“内容 10 + 条理 8 + 语言 9 + 标点与书写 3”四行评分，再对照 A/B/C 档。工具不自动判分，不给范文。
]
#v(0.8mm)
#block[
  #set text(size: 9pt)
  #grid(
    columns: (20mm, 12mm, 1fr),
    stroke: (thickness: 0.5pt, paint: luma(170)),
    inset: (x: 2.5mm, y: 1mm),
    align: (center + horizon, center + horizon, left + horizon),
    ..([*分项*], [*分值*], [*评分要点*]),
    ..p.writing.scoring.rows.map(r => ([#r.aspect], [#r.points], [#r.description])).flatten(),
  )
]
#v(1mm)
#for b in p.writing.scoring.bands {
  text(size: 9pt)[#text(weight: "bold")[#b.label]：#b.description]
  v(0.4mm)
}
#v(1mm)
#text(size: 9pt)[
  *九．卷面书写（3 分）*：按全卷书写工整、卷面整洁程度评分，无固定答案。习作格内字迹也算入卷面。
]

// ==================== 附录（与习作评分标准同页）====================

#v(2mm)

#align(center, text(size: 13.5pt, weight: "bold")[分值构成、素材来源与缺口])
#v(1mm)
#set par(leading: 3.4mm)

#text(size: 9pt)[
  本卷共 #p.meta.total 分。其中第六题“课内阅读”10 分因缺教材课文页留空，*可判分部分约 #p.meta.gradable 分*。
  全卷只使用 `verified` 素材，没有用 pending 条目或临时编题顶替。
]

#v(1mm)
#text(size: 10pt, weight: "bold")[一、各题型实际分值]
#v(0.5mm)
#block[
  #set text(size: 8.6pt)
  #grid(
    columns: (11mm, 31mm, 12mm, 38mm, 1fr),
    stroke: (thickness: 0.5pt, paint: luma(170)),
    inset: (x: 2mm, y: 0.6mm),
    align: (center + horizon, left + horizon, center + horizon, left + horizon, left + horizon),
    ..([*题号*], [*题型*], [*分值*], [*判分方式*], [*素材依据*]),
    ..p.composition.map(c => ([#c.no], [#c.title], [#c.score], [#c.judge], [#c.basis])).flatten(),
  )
]

#v(1.5mm)
#text(size: 9.2pt)[
  *配比调整说明*：建议配比合计 97 分（字词 22 + 古诗 13 + 句子 10 + 课外阅读 12 + 习作 30 + 课内阅读 10）。
  本卷补 3 分“卷面书写”达到 100 分，依据是题型表 §2.5 的卷面 2–3 分；其余分值未改。
  阅读 12 分按“选择 2 + 填空 2 + 填空 2 + 简答 6”分配；句子 10 分按“病句 2×2 + 关联词 2×1 + 标点 2 + 扩写 2 + 仿写 2”分配。
]

#v(1mm)
#text(size: 9.2pt)[
  *版式说明*：习作用 20 列 × 22 行、7.85mm 方格（440 格），与三年级作文本常见格宽接近，便于把字写进格、控制字距和行距；440 格可容纳 300–400 字及标点。
  课外阅读短文放在浅底框内，正文 12pt、行距 4.6mm；题目在框外单独编号，短文与题目同页分区。
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
  *句子*：#p.sentences.gaibing.map(g => g.id).join("、")#("、")#p.sentences.guanlian.map(g => g.id).join("、")#("、")#p.sentences.biaodian.id#("、")#p.sentences.kuoxie.id#("、")#p.sentences.fangxie.id。
]
#text(size: 9.2pt)[
  *课外阅读*：#p.reading.id《#p.reading.title》，用完整 4 题；*习作*：#p.writing.id《#p.writing.title》（#p.writing.unitName）。
]

// ==================== 第 8 页：合并验证与新版说明 ====================

#pagebreak()

#align(center, text(size: 15pt, weight: "bold")[合并验证与新版说明])
#v(1mm)
#set par(leading: 4.2mm)

#block[#text(size: 10pt, weight: "bold")[一、合并状态]]
#text(size: 9pt)[
  句子/习作与阅读两条返修线合到同一工作区后，在 *966e0e1* 上跑全量 `node --test tests/*.test.ts`：238 通过、0 失败；`npx vue-tsc -b`：通过。
  抽查又发现句子答案集的漏列，补 *d4de8d2* 后两项仍全绿。没有出现两边互相踩的冲突。
]

#v(1mm)
#block[#text(size: 10pt, weight: "bold")[二、抽查发现的问题与修法（人读 19 条）]]
#text(size: 9pt)[
  *关联词 6 条*：GL-17、GL-24 单独成句时“不是……而是……”两个方向都成立，各加一句语境收窄为唯一方向；GL-18 漏“刚……就……”，补入；GL-05、GL-22、GL-29 的承接题补“接着”，承接词表同步。
]
#text(size: 9pt)[
  *标点 6 条*：BD-30“春天桃花开、夏天荷花开、秋天菊花开”还可每层各自成句，原答案只列逗号与分号两种，补入句号分层答案。
]
#text(size: 9pt)[
  *病句 3 条*：GB-16 “拂过微风”动宾搭配错误，改为“有微风拂过”；GB-18 原改法顺手加了“我看见”，像二次润色，改为只把“和”换成“，还有”。
]
#text(size: 9pt)[
  *扩写、仿写各 2 条*：逐条核对答案集与评分点，数据未改；本卷把评分点排进了卷面与答案页。
]

#v(1mm)
#block[#text(size: 10pt, weight: "bold")[三、阅读库抽查]]
#text(size: 9pt)[
  24 篇正文 *313–353 字*，全部落在 300–500 字，六个主题各 4 篇。三项新增自动检查都不是空断言：填空 34 空逐字命中原文；选择题说明 31 处引文逐字命中；简答 39 条与原文均有连续 5 字以上对应（最短恰为 5 字）。测试另要求每道选择题说明至少 1 处引文，避免“没有引文就跳过”。
]

#v(1mm)
#block[#text(size: 10pt, weight: "bold")[四、这份卷与返修前那份相比]]
#text(size: 9pt)[
  *句子*：病句 GB-11/GB-25 换为 GB-12/GB-24；关联词 GL-14/GL-21（两条同为“既……又……”）换为 GL-02 转折、GL-10 条件；标点 BD-16 换为 BD-19；仿写 FP-22（C 档比喻晚霞）换为 FP-14（B 档拟人秋叶）；*新增扩写 KX-08*。
]
#text(size: 9pt)[
  *卷面*：扩写、仿写题后标“按要点作答”，答案页给 4 条评分点（每条 0.5 分）与示例。病句只留 1 题、每题 2 分，给扩写、仿写各让出 2 分，句子总分仍为 10。
]
#text(size: 9pt)[
  *阅读*：仍用 RD-01《修鞋的爷爷》，但短文已由返修前的 252–272 字扩到 *353 字*；本页短文、4 题与答题线仍排在同一页，未撑破版面。
]
#text(size: 9pt)[
  *习作*：XZ-06《这儿真美》不变；答案页不再写“不提供评分标准”，改为在后页给出分项评分标准（内容 10 + 条理 8 + 语言 9 + 标点书写 3，附 A/B/C 档）。
]

#v(1mm)
#block[#text(size: 10pt, weight: "bold")[五、离真实三上卷还差什么（沿用原样张条目）]]
#for (i, gap) in p.gaps.enumerate() {
  text(size: 8.4pt)[#text(weight: "bold")[#(i + 1)）#gap.title：]#gap.need]
  v(0.4mm)
}
