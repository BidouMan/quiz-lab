import json, os, re, glob

ROOT = '/Users/amixc/MyWorkSpace/CodeStaction/QuizLab'
WORK = os.path.join(ROOT, 'tools/reading-intake/work')

raw = {}
for pat in ['data/reading-catalog/szxuexiao-20261108/passages.jsonl',
            'data/reading-catalog/ns21cnjy-20261108/*.jsonl',
            'data/reading-catalog/probe-20261108/*.jsonl']:
    for f in glob.glob(os.path.join(ROOT, pat)):
        for line in open(f, encoding='utf-8'):
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get('id') and r['id'] not in raw:
                raw[r['id']] = r


def clean(t):
    t = t.replace('\ufeff', '').replace('\u3000', ' ')
    t = re.sub(r'\?\?+', '？', t)
    t = re.sub(r'\s+', '', t)
    t = re.sub(r'注[:：][\u4e00-\u9fff].{0,400}$', '', t)
    return t


CHOSEN = [
    ('ns21-24206391-02', '枯萎的蒲公英'),
    ('ns21-23856604-01', '香甜莫过槐花饼'),
    ('ns21-23856604-02', '奶奶的粽子（节选）'),
    ('ns21-23856602-02', '海蚀奇观（节选）'),
    ('ns21-17774691-02', '猫捉老鼠'),
    ('ns21-24178507-02', '小斑马'),
    ('szx-0059', '秋天的工作日程表'),
    ('ns21-17804187-04', '小猫咪穿鞋子'),
    ('ns21-17774700-03', '一只想飞的猫（节选）'),
    ('ns21-24206399-04', '用风洞“捕风捉影”'),
    ('ns21-24073760-01', '中国空间站'),
    ('ns21-23856595-04', '乐唱童谣'),
    ('ns21-24073451-02', '无名英雄（节选）'),
    ('ns21-24851692-05', '蝉在树梢唤夏来（节选）'),
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

json.dump(out, open(os.path.join(WORK, 'batch5-input.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
