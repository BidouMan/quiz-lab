#import "chinese.typ": *

#set page(width: 210mm, height: 297mm, margin: (x: 12.7mm, top: 19mm, bottom: 16mm))
#set text(font: cn-font, size: 14pt, lang: "zh", region: "cn")
#set par(leading: 5.6mm)

#paper-title("语文卷面构件验证（第一批）", sub: "田字格 / 拼音标注 / 字词题骨架")

#qhead(1, "田字格（10mm，外框 0.7pt，十字虚线浅灰）")
#tian-row(n: 6, size: 10mm, letters: ("坡", "球", "招", "呼", "飘", "扬"))
#v(2mm)
#tian-block(rows: 2, cols: 8, size: 10mm)

#qhead(2, "字上注音（拼音 8pt / 汉字 14pt）")
#annotate-word(("pō", "qiú", "zhāo", "hū"), ("坡", "球", "招", "呼"), w: 12mm)

#qhead(3, "看拼音写词语")
#kanpinyin-line((("洁白", "jié bái"), ("飘扬", "piāo yáng"), ("粗壮", "cū zhuàng"), ("热闹", "rè nao")), size: 10mm)

#qhead(4, "给加点字注音")
#zhuyin-line(("绒", "昂", "凤", "墙", "晃", "荒", "假", "臂"))

#qhead(5, "形近字组词")
#xingjin-line((("坡", "波"), ("扬", "杨"), ("壮", "状")))

#qhead(6, "古诗默写")
#poem-blank("山行", "杜牧", "唐", lines: 2)

#v(4mm)
#text(size: 9pt, fill: luma(120))[说明：本轮不做四线三格，样张不含拼音书写专项题。]
