// 三年级语文上册 第一、二单元 字词与古诗练习（样张）
// 仅用于版式验证：素材全部来自 src/data/chinese/curriculum.ts 的 verified 条目
// （第 1–4 课写字 34 字、识字 15 字、词语 13 条 + 第 4/20 课 6 首古诗）。
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

// 写字题：每字一格示范 + 指定格数空格，按 cols 自动换行
#let xiezi-grid(chars, cols: 18, size: 10mm, blanks: 2) = {
  let cells = ()
  for ch in chars {
    cells.push(tian-cell(size: size, ch: ch))
    for _ in range(blanks) {
      cells.push(tian-cell(size: size))
    }
  }
  let pad = calc.rem(cols - calc.rem(cells.len(), cols), cols)
  for _ in range(pad) {
    cells.push(tian-cell(size: size))
  }
  grid(
    columns: (size,) * cols,
    stroke: (thickness: 0.7pt, paint: luma(110)),
    inset: 0pt,
    ..cells,
  )
}

// 古诗补全：题名行 + 前半句 + 书写空线
#let poem-fill(title, dynasty, author, first, blank: 42mm) = block(above: 2.5mm, below: 1.5mm)[
  #text(size: 11.5pt)[#title　#(dynasty)·#(author)]
  #h(4mm)
  #text(size: 13pt)[#first]
  #box(width: blank, stroke: (bottom: (thickness: 0.5pt, paint: luma(140))), inset: 0pt)[]
  #text(size: 13pt)[。]
]

// ---------- 第 1 页 ----------

#paper-title(
  "三年级语文上册 第一、二单元 字词与古诗练习",
  sub: "统编版·五四学制 2025 年秋修订版　｜　满分 100 分　时间 40 分钟",
)
#info-row(fields: ("班级", "姓名", "学号", "得分"))

#qhead(1, "看拼音写词语", score: 26)
#hint("读拼音，把词语写在田字格里。")
#kanpinyin-line((("洁白", "jié bái"), ("飘扬", "piāo yáng"), ("粗壮", "cū zhuàng"), ("热闹", "rè nao"), ("阵雨", "zhèn yǔ")), size: 10mm, gap: 4mm)
#kanpinyin-line((("湿润", "shī rùn"), ("风笛", "fēng dí"), ("功课", "gōng kè"), ("急忙", "jí máng"), ("狂欢", "kuáng huān")), size: 10mm, gap: 4mm)
#kanpinyin-line((("私塾", "sī shú"), ("戒尺", "jiè chǐ"), ("钥匙", "yào shi")), size: 10mm, gap: 4mm, cols: 5)

#qhead(2, "给加点字注音", score: 15)
#hint("在横线上写出加点字的读音。")
#zhuyin-line(("绒", "昂", "凤", "墙", "晃", "荒", "假", "臂"))
#zhuyin-line(("诵", "例", "糊", "戒", "厉", "详", "挨"))
#v(0.5mm)
#text(size: 9.5pt, fill: luma(110))[提示：“假”在“放假”中读 jià。]

#qhead(3, "形近字组词", score: 12)
#hint("看清偏旁，给每个字组一个词语。")
#xingjin-line((("坡", "波"), ("扬", "杨"), ("壮", "状"), ("飘", "漂"), ("粗", "组"), ("径", "经")))

// ---------- 第 2 页 ----------

#pagebreak()

#qhead(4, "写字", score: 34)
#hint("照样子把每个字写两遍，注意笔顺和间架结构。")
#xiezi-grid((
  "坡", "球", "招", "呼", "飘", "扬", "读", "热", "闹", "粗", "壮", "洁",
  "轰", "湿", "润", "笛", "狂", "功", "罚", "互", "碰", "黄", "急",
  "庭", "相", "未", "寒", "径", "斜", "枫", "霜", "挑", "深", "落",
), cols: 15, size: 12mm, blanks: 2)

#qhead(5, "古诗补全", score: 10)
#hint("根据课文内容，把诗句补充完整。")
#poem-fill("山行", "唐", "杜牧", "停车坐爱枫林晚，")
#poem-fill("望洞庭", "唐", "刘禹锡", "湖光秋月两相和，")
#poem-fill("夜书所见", "宋", "叶绍翁", "知有儿童挑促织，")
#poem-fill("望天门山", "唐", "李白", "两岸青山相对出，")
#poem-fill("饮湖上初晴后雨", "宋", "苏轼", "欲把西湖比西子，")

#qhead(6, "古诗默写", score: 3)
#hint("默写《鹿柴》中的诗句。")
#poem-blank("鹿柴", "王维", "唐", lines: 2, gap: 10mm)

// ---------- 第 3 页：答案 ----------

#pagebreak()

#align(center, text(size: 16pt, weight: "bold")[参考答案与评分说明])
#v(3mm)

#qhead(1, "看拼音写词语（每题 2 分）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 3mm,
  ..(
    ("jié bái", "洁白"), ("piāo yáng", "飘扬"), ("cū zhuàng", "粗壮"), ("rè nao", "热闹"),
    ("zhèn yǔ", "阵雨"), ("shī rùn", "湿润"), ("fēng dí", "风笛"), ("gōng kè", "功课"),
    ("jí máng", "急忙"), ("kuáng huān", "狂欢"), ("sī shú", "私塾"), ("jiè chǐ", "戒尺"),
    ("yào shi", "钥匙"),
  ).map(((p, w)) => box[#py(p, size: 9pt)　#han(w, size: 12pt)]),
)

#qhead(2, "给加点字注音（每题 1 分）")
#annotate-word(("róng", "áng", "fèng", "qiáng", "huàng", "huāng", "jià", "bì"), ("绒", "昂", "凤", "墙", "晃", "荒", "假", "臂"), w: 15mm)
#annotate-word(("sòng", "lì", "hú", "jiè", "lì", "xiáng", "ái"), ("诵", "例", "糊", "戒", "厉", "详", "挨"), w: 15mm)

#qhead(3, "形近字组词（每组 2 分）")
#grid(
  columns: (1fr, 1fr),
  row-gutter: 3mm,
  ..(
    ("坡", "山坡"), ("波", "波浪"), ("扬", "飞扬"), ("杨", "杨树"),
    ("壮", "雄壮"), ("状", "形状"), ("飘", "飘动"), ("漂", "漂浮"),
    ("粗", "粗心"), ("组", "小组"), ("径", "小径"), ("经", "经过"),
  ).map(((ch, w)) => box[#han(ch, size: 12pt)（#text(size: 12pt)[#w]）]),
)

#qhead(4, "写字（每字 1 分）")
#text(size: 11pt)[写字题按笔画、笔顺和间架结构评分，无固定答案。]

#qhead(5, "古诗补全（每题 2 分）")
#grid(
  columns: (1fr,),
  row-gutter: 2mm,
  ..(
    ("山行", "霜叶红于二月花"), ("望洞庭", "潭面无风镜未磨"),
    ("夜书所见", "夜深篱落一灯明"), ("望天门山", "孤帆一片日边来"),
    ("饮湖上初晴后雨", "淡妆浓抹总相宜"),
  ).map(((t, a)) => box[#text(size: 11.5pt)[《#t》]　#text(size: 12pt)[#a]]),
)

#qhead(6, "古诗默写（3 分）")
#text(size: 12pt)[《鹿柴》（唐·王维）　空山不见人，但闻人语响。返景入深林，复照青苔上。]

#v(6mm)
#text(size: 9pt, fill: luma(120))[
  样张说明：本卷仅用于版式验证。素材取自第 1–4 课写字表 34 字、识字表 15 字、词语 13 条（其中“钥匙”出自第 6 课），
  以及第 4 课与第 20 课共 6 首古诗（5 首补全 + 1 首默写）；第 5–7 课字词因教材字表未核到，未收入本卷。
]
