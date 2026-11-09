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

ids = ['ns21-24073457-04', 'ns21-17774691-02', 'ns21-17197195-01', 'ns21-24178507-02',
       'szx-0016', 'szx-0059', 'ns21-17804187-04', 'ns21-17774700-03',
       'ns21-24206399-04', 'ns21-24073752-04', 'ns21-24073760-01', 'ns21-23856595-04',
       'ns21-24073451-02']
for i in ids:
    r = raw.get(i)
    if not r:
        print(i, 'MISSING')
        continue
    t = re.sub(r'\s+', '', r['text'])
    print('=' * 90)
    print(i, len(re.findall(r'[\u4e00-\u9fff]', t)), '|', r.get('title'))
    print(t[:420])
