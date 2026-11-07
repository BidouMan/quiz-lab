// 三年级语文上册 字词与古诗练习（样张 · 按三上题型表重排）
// 素材全部来自 src/data/chinese/curriculum.ts 的 verified 条目：
// 第 1–4 课写字 34 字、识字 15 字、词语 12 条 + 第 4/20 课 6 首古诗。
// 句子、课内阅读、课外阅读、习作四块因无题库/教材页/短文库，留空并注明缺口。
// 版式构件见 chinese.typ；本文件不引用 paper.typ，也不改数学卷版式。

#import "chinese.typ": *

#set page(
  width: 210mm,
  height: 297mm,
  margin: (x: 12.7mm, top: 19mm, bottom: 16mm),
  numbering: "第 1 页",
)
#set text(font: cn-font, size: 14pt, lang: "zh", region: "cn")
#set par(leading: 5.6mm, justify: false)

// 古诗补全：题名行 + 前半句 + 书写空线
#let poem-fill(title, dynasty, author, first, blank: 42mm) = block(above: 2.5mm, below: 1.5mm)[
  #text(size: 11.5pt)[#title　#(dynasty)·#(author)]
  #h(4mm)
  #text(size: 13pt)[#first]
  #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
  #text(size: 13pt)[。]
]

// 缺口占位：明确写出缺什么，不用简单题顶替
#let gap-section(no, title, score, need) = block(above: 4mm, below: 1mm)[
  #qhead(no, title, score: score)
  #block(
    width: 100%,
    height: 13mm,
    fill: luma(249),
    stroke: (paint: luma(180), thickness: 0.6pt, dash: "dashed"),
    radius: 1.5mm,
    inset: (x: 4mm, y: 0mm),
  )[
    #set align(center + horizon)
    #set text(size: 9.5pt, fill: luma(100))
    本样张未排此题：缺 #need
  ]
]

// ---------- 第 1 页：字词 ----------

#paper-title(
  "三年级语文上册 字词与古诗练习",
  sub: "统编版·五四学制 2025 年秋修订版　｜　满分 100 分　时间 90 分钟",
)
#info-row(fields: ("班级", "姓名", "学号", "得分"))

#qhead(1, "看拼音写词语", score: 10)
#hint("读拼音，把词语写在田字格里。")
#kanpinyin-line((("洁白", "jié bái"), ("飘扬", "piāo yáng"), ("粗壮", "cū zhuàng"), ("热闹", "rè nao"), ("阵雨", "zhèn yǔ")), size: 11mm, gap: 5mm)
#kanpinyin-line((("湿润", "shī rùn"), ("风笛", "fēng dí"), ("功课", "gōng kè"), ("急忙", "jí máng"), ("狂欢", "kuáng huān")), size: 11mm, gap: 5mm)

#qhead(2, "给加点字注音", score: 6)
#hint("在横线上写出加点字的读音。")
#zhuyin-line(("绒", "昂", "凤", "墙", "晃", "假"), w: 15mm, gap: 6mm)
#v(0.5mm)
#text(size: 9.5pt, fill: luma(110))[提示：“假”在“放假”中读 jià。]

#qhead(3, "形近字组词", score: 6)
#hint("看清偏旁，给每个字组一个词语。")
#xingjin-line((("坡", "波"), ("扬", "杨"), ("壮", "状"), ("飘", "漂"), ("粗", "组"), ("径", "经")))

// ---------- 第 2 页：古诗 + 缺口 ----------

#pagebreak()

#qhead(4, "古诗积累", score: 13)
#hint("补全诗句，并默写《鹿柴》。")
#poem-fill("山行", "唐", "杜牧", "停车坐爱枫林晚，")
#poem-fill("望洞庭", "唐", "刘禹锡", "湖光秋月两相和，")
#poem-fill("夜书所见", "宋", "叶绍翁", "知有儿童挑促织，")
#poem-fill("望天门山", "唐", "李白", "两岸青山相对出，")
#poem-fill("饮湖上初晴后雨", "宋", "苏轼", "欲把西湖比西子，")
#poem-blank("鹿柴", "王维", "唐", lines: 2, gap: 9mm)

#qhead(5, "卷面书写", score: 3)
#text(size: 10.5pt)[根据卷面整洁、书写规范程度评分。]

#gap-section(6, "句子运用", 10, "句子题库（仿写/扩写/关联词/修改病句，含参考答案与评分点）")
#gap-section(7, "课内阅读", 10, "教材课文页（原文段落 + 课后题 + 答案）")
#gap-section(8, "课外阅读", 12, "短文库（300–500 字/篇，20–30 篇起步，含题目与答案）")
#gap-section(9, "习作", 30, "作文题库（题目 + 提示 + 评分标准）")

// ---------- 第 3 页：答案 ----------

#pagebreak()

#align(center, text(size: 16pt, weight: "bold")[参考答案与评分说明])
#v(3mm)

#qhead(1, "看拼音写词语（每题 1 分）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 3mm,
  ..(
    ("jié bái", "洁白"), ("piāo yáng", "飘扬"), ("cū zhuàng", "粗壮"), ("rè nao", "热闹"),
    ("zhèn yǔ", "阵雨"), ("shī rùn", "湿润"), ("fēng dí", "风笛"), ("gōng kè", "功课"),
    ("jí máng", "急忙"), ("kuáng huān", "狂欢"),
  ).map(((p, w)) => box[#py(p, size: 9pt)　#han(w, size: 12pt)]),
)

#qhead(2, "给加点字注音（每题 1 分）")
#annotate-word(("róng", "áng", "fèng", "qiáng", "huàng", "jià"), ("绒", "昂", "凤", "墙", "晃", "假"), w: 15mm)

#qhead(3, "形近字组词（每组 1 分）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 3mm,
  ..(
    ("坡", "山坡"), ("波", "波浪"), ("扬", "飞扬"), ("杨", "杨树"),
    ("壮", "雄壮"), ("状", "形状"), ("飘", "飘动"), ("漂", "漂浮"),
    ("粗", "粗心"), ("组", "小组"), ("径", "小径"), ("经", "经过"),
  ).map(((ch, w)) => box[#han(ch, size: 12pt)（#text(size: 12pt)[#w]）]),
)

#qhead(4, "古诗积累（共 13 分）")
#grid(
  columns: (1fr,),
  row-gutter: 2mm,
  ..(
    ("山行", "霜叶红于二月花"), ("望洞庭", "潭面无风镜未磨"),
    ("夜书所见", "夜深篱落一灯明"), ("望天门山", "孤帆一片日边来"),
    ("饮湖上初晴后雨", "淡妆浓抹总相宜"),
  ).map(((t, a)) => box[#text(size: 11.5pt)[《#t》]　#text(size: 12pt)[#a]]),
)
#text(size: 12pt)[《鹿柴》（唐·王维）　空山不见人，但闻人语响。返景入深林，复照青苔上。]

#qhead(5, "卷面书写（3 分）")
#text(size: 10.5pt)[按卷面整洁、书写规范评分，无固定答案。]

#v(4mm)
#text(size: 9.5pt, fill: luma(110))[第 6–9 题本样张未排，无答案；补齐题库后再补答案页。]

// ---------- 第 4 页：缺口说明 ----------

#pagebreak()

#align(center, text(size: 16pt, weight: "bold")[这份样张离真实三上卷还差什么])
#v(5mm)

#text(size: 11.5pt)[
  本卷按三上常见配比只排了能判分的部分：*字词 22 分 + 古诗 13 分 + 卷面 3 分 = 38 分*。
  其余 62 分不是“省略”，而是当前素材做不出来，下面逐块写明缺口。
]
#v(4mm)

#let gap-line(no, title, score, need) = block(above: 2.5mm, below: 2.5mm)[
  #grid(
    columns: (58mm, 1fr),
    column-gutter: 4mm,
    [#text(size: 11.5pt, weight: "bold")[#no　#title]　#text(size: 10pt, fill: luma(110))[#score 分]],
    [#text(size: 10.5pt)[缺：#need]],
  )
]

#gap-line("六", "句子运用", 10, "句子题库：仿写、扩写、关联词、修改病句，每题带参考答案与评分点；按 4–6 题、8–10 分准备。")
#gap-line("七", "课内阅读", 10, "教材课文页：第 1–4 课或第 20 课的原文段落、课后题与答案；当前只有字词表，没有课文段落。")
#gap-line("八", "课外阅读", 12, "短文库：300–500 字/篇，含 4–6 道题与答案，起步 20–30 篇，按文体和难度分档。")
#gap-line("九", "习作", 30, "作文题库：题目、提示语与评分标准（三上约 300 字）；写话可只给题目与提示、不判对错。")

#v(4mm)
#text(size: 10.5pt)[
  *硬凑的上限*：把 12 条词语、15 个注音、6 组形近字、6 首古诗全部塞进卷面，理论上可到约 66 分；
  但字词占比会超过 60%，形态退回“字词卷”，不建议。
]

#v(3mm)
#text(size: 9.5pt, fill: luma(115))[
  素材范围：第 1–4 课写字 34 字、识字 15 字、词语 12 条，第 4/20 课 6 首古诗。
  第 5–7 课字词按本批口径不出题；本卷未使用任何未核实或推测素材。
]
