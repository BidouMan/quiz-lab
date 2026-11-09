import json, os, re, glob

ROOT = '/Users/amixc/MyWorkSpace/CodeStaction/QuizLab'
WORK = os.path.join(ROOT, 'tools/reading-intake/work')

# 收集全量原始记录（含完整 questionText / answerText）
raw = {}
for pat in ['data/reading-catalog/ns21cnjy-20261108/*.jsonl',
            'data/reading-catalog/szxuexiao-20261108/*.jsonl',
            'data/reading-catalog/probe-20261108/*.jsonl']:
    for f in glob.glob(os.path.join(ROOT, pat)):
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            rid = r.get('id')
            if rid and rid not in raw:
                raw[rid] = r


def clean(t):
    t = t.replace('\ufeff', '').replace('\u3000', ' ')
    t = re.sub(r'\?\?+', '', t)
    t = re.sub(r'\s+', '', t)
    t = re.sub(r'注[:：][\u4e00-\u9fff].{0,400}$', '', t)
    return t


CHOSEN = [
    ('ns21-17774687-02', '茶壶（节选）'),
    ('ns21-17197192-03', '友谊的色彩'),
    ('ns21-24206399-02', '一幅壮锦（节选）'),
    ('ns21-23856606-01', '夏天（节选）'),
    ('ns21-24206389-03', '童年的回忆（节选）'),
    ('ns21-24073760-02', '管鲍之交（节选）'),
    ('ns21-24206389-01', '父亲的救援（节选）'),
    ('ns21-24073760-06', '打树花（节选）'),
    ('ns21-24851700-01', '秋的色彩'),
    ('ns21-26609708-03', '水母的“顺风耳”'),
    ('ns21-24073760-05', '母亲架设的桥（节选）'),
    ('ns21-17804181-02', '小黄牛找食吃'),
    ('ns21-26609708-04', '壳斗村的帽子店'),
    ('ns21-24073760-03', '和氏璧'),
    ('ns21-24851700-02', '小蜜蜂与蝉'),
    ('ns21-24073756-07', '蜻蜓与电子蛙眼'),
    ('ns21-17197192-02', '一个有魔力的字眼'),
    ('ns21-23856608-02', '少数民族的节日'),
    ('ns21-24206399-01', '小英雄王二小'),
    ('ns21-24073451-05', '善用玩具促进孩子成长'),
]

out = []
for sid, title in CHOSEN:
    r = raw[sid]
    text = clean(r.get('text') or '')
    n = len(re.findall(r'[\u4e00-\u9fff]', text))
    out.append({
        'sourceId': sid,
        'title': title,
        'rawChars': n,
        'text': text,
        'originalQuestions': (r.get('questionText') or '').strip(),
        'originalAnswers': (r.get('answerText') or '').strip(),
        'url': r.get('url') or '',
    })
    print(sid, n, title)

json.dump(out, open(os.path.join(WORK, 'batch4-input.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
