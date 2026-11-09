import json, os, re, glob

ROOT = '/Users/amixc/MyWorkSpace/CodeStaction/QuizLab'
raw = {}
for pat in ['data/reading-catalog/szxuexiao-20261108/passages.jsonl',
            'data/reading-catalog/ns21cnjy-20261108/*.jsonl']:
    for f in glob.glob(os.path.join(ROOT, pat)):
        for line in open(f, encoding='utf-8'):
            try:
                r = json.loads(line)
            except Exception:
                continue
            raw.setdefault(r.get('id'), r)

ids = ['ns21-24206391-02', 'ns21-23856604-01', 'ns21-23856604-02', 'ns21-23856602-02',
       'ns21-17774691-02', 'ns21-24178507-02', 'szx-0059']
for i in ids:
    r = raw.get(i)
    if not r:
        print(i, 'MISSING')
        continue
    t = re.sub(r'\s+', '', r['text'])
    print('=' * 90)
    print(i, len(re.findall(r'[\u4e00-\u9fff]', t)), '|', r.get('title'))
    print('HEAD:', t[:120])
    print('TAIL:', t[-160:])
    print('Q:', (r.get('questionText') or '')[:100])
