#!/usr/bin/env python3
"""清洗 SK6/SK7 专项候选正文（中间产物，不提交）。"""
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
HAN = re.compile(r"[\u4e00-\u9fff]")
PINYIN = re.compile(r"[（(][a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+[）)]")
JUNK = ["Xk b1.com", "(有删改)", "(选入时有删改)", "(根据相关材料编写)"]

pool = {}
for p in ["data/reading-catalog/szxuexiao-20261108/passages.jsonl",
          "data/reading-catalog/ns21cnjy-20261108/passages.jsonl"]:
    for line in open(os.path.join(ROOT, p), encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            pool.setdefault(rec["id"], rec)
for p in sorted(glob.glob(os.path.join(ROOT, "data/reading-catalog/ns21cnjy-20261108/batch-0*.jsonl"))):
    for line in open(p, encoding="utf-8"):
        if line.strip():
            rec = json.loads(line)
            pool.setdefault(rec["id"], rec)

# (素材id, 新rd, 标题, 主题, 体裁标签, 截断标记)
SK7 = [
    ("ns21-23900315-01", "RD-550", "法布尔与《昆虫记》", "非连续", "SK7", None),
    ("ns21-24851696-01", "RD-551", "中国诗词大会", "非连续", "SK7", None),
    ("ns21-24851696-04", "RD-552", "手机使用情况调查", "非连续", "SK7", None),
    ("ns21-24206399-03", "RD-553", "故宫博物院参观指南", "非连续", "SK7", None),
    ("ns21-24073753-02", "RD-554", "秋游通知与注意事项", "非连续", "SK7", "5.学校开展秋游活动"),
]
SK6 = [
    ("ns21-17197197-02", "RD-555", "我爱秋天", "写景", "SK6", None),
    ("ns21-17197197-01", "RD-556", "秋天的雨", "写景", "SK6", None),
    ("ns21-17774696-03", "RD-557", "秋天的香山公园", "写景", "SK6", None),
    ("ns21-24851700-03", "RD-558", "西藏高原", "写景", "SK6", None),
    ("ns21-23856606-02", "RD-559", "锡林郭勒草原", "写景", "SK6", None),
    ("ns21-24073457-03", "RD-560", "故乡的炊烟", "写景", "SK6", None),
    ("ns21-23856604-01", "RD-561", "故乡的槐树", "状物", "SK6", None),
    ("ns21-23856602-03", "RD-562", "华山的险", "写景", "SK6", None),
    ("ns21-24206391-02", "RD-563", "蒲公英", "状物", "SK6", None),
    ("ns21-24073756-05", "RD-564", "疣鼻天鹅", "状物", "SK6", None),
    ("ns21-17774696-02", "RD-565", "北大荒的秋天", "写景", "SK6", None),
    ("ns21-23856602-02", "RD-566", "宝岛台湾", "写景", "SK6", None),
    ("ns21-24851700-06", "RD-567", "大斑龟下蛋", "状物", "SK6", None),
    ("szx-0162", "RD-568", "我爱花城", "写景", "SK6", None),
    ("szx-0082", "RD-569", "海底世界", "写景", "SK6", None),
]

SPECIAL = {
    "ns21-23900315-01": [("【材料一】1法布尔", "【材料一】法布尔"), ("普遒", "普通")],
    "ns21-24851696-01": [],
    "ns21-24851696-04": [("再次制作竹蜻蜓失败", ""), ("阅读非连续性文本。", "")],
    "ns21-24073753-02": [],
    "ns21-24206399-03": [],
    "ns21-17774696-02": [("红的像 ,", "红的")],
    "ns21-24073457-03": [("故乡的炊烟\n", "")],
    "ns21-23856602-03": [("华 山 的 险\n", "")],
    "szx-0162": [("我爱花城我刚到花城", "我刚到花城")],
    "szx-0082": [("海底世界1你可知道", "海底世界\n1你可知道"), ("2当海面上", "\n2当海面上"),
                 ("3海底动物", "\n3海底动物"), ("4海底植物的差异", "\n4海底植物的差异"),
                 ("5海底蕴", "\n5海底蕴"), ("6海底真是", "\n6海底真是")],
}


def clean(text, cut=None, repl=None):
    text = text.replace("\r", "")
    for old, new in (repl or []):
        text = text.replace(old, new)
    if cut and cut in text:
        text = text[:text.index(cut)]
    text = PINYIN.sub("", text)
    for junk in JUNK:
        text = text.replace(junk, "")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    out = []
    for line in lines:
        stripped = re.sub(r"^([1-9])(?=[^0-9])", "", line) if len(HAN.findall(line)) > 6 else line
        line = stripped
        out.append(line)
    # 材料四中的词牌（原卷挖空）无法还原，删去残缺诗行
    cleaned = []
    for line in out:
        if line.startswith("西江月") or line.startswith("[宋]辛弃疾") or line.startswith("明月别枝") \
                or line.startswith("七八个星"):
            continue
        cleaned.append(line)
    return cleaned


records = []
for src, rid, title, theme, tag, cut in SK7 + SK6:
    rec = pool[src]
    paragraphs = clean(rec["text"], cut, SPECIAL.get(src, []))
    if src == "ns21-24073753-02":
        paragraphs.append("（根据相关材料编写）")
    chars = len(HAN.findall("".join(paragraphs)))
    records.append({
        "id": rid, "sourceId": src, "title": title, "theme": theme, "tag": tag,
        "paragraphs": paragraphs, "charCount": chars,
        "origQ": rec.get("questions"), "hasAnswer": rec.get("hasAnswer"),
        "origQuestionText": rec.get("questionText") or "",
    })

out_path = os.path.join(ROOT, "tools/reading-intake/work/sk67-candidates.jsonl")
with open(out_path, "w", encoding="utf-8") as f:
    for rec in records:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

for rec in records:
    print(f"{rec['id']} {rec['sourceId']:>22} {rec['charCount']:>4}字 {rec['tag']} {rec['title']}")
    print("  " + " / ".join(rec["paragraphs"])[:150])
