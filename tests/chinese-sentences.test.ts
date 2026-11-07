import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BIAODIAN_ITEMS,
  BIAODIAN_MARKS,
  BIYU_MARKERS,
  FANGXIE_ITEMS,
  GAIBING_ITEMS,
  GUANLIAN_ITEMS,
  GUANLIAN_WORDS,
  KUOXIE_ITEMS,
  SENTENCE_BANK,
  SENTENCE_BANK_META,
  pickSentences,
  sentenceCounts,
} from '../src/data/chinese/sentences/index.ts'

const PLACEHOLDER = '（ ）'

const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1

const sortedChars = (text: string): string => [...text].sort().join('')

/** fixed 是否恰为 broken 插入了 replacement（成分残缺的判定） */
const isInsertion = (broken: string, fixed: string, replacement: string): boolean => {
  if (fixed.length !== broken.length + replacement.length) return false
  for (let i = 0; i <= broken.length; i += 1) {
    if (fixed === broken.slice(0, i) + replacement + broken.slice(i)) return true
  }
  return false
}

test('句子题库：五类题量均在 30–50 条，总数与分项统计一致', () => {
  const counts = sentenceCounts()
  for (const [kind, count] of Object.entries(counts)) {
    assert.ok(count >= 30 && count <= 50, `${kind} 题量 ${count} 不在 30–50`)
  }
  assert.equal(
    counts.gaibing + counts.kuoxie + counts.guanlian + counts.biaodian + counts.fangxie,
    SENTENCE_BANK.length,
  )
})

test('句子题库：编号唯一，来源定位到编号，全部 verified', () => {
  const ids = new Set<string>()
  for (const item of SENTENCE_BANK) {
    assert.ok(!ids.has(item.id), `重复编号：${item.id}`)
    ids.add(item.id)
    assert.equal(item.status, 'verified', `${item.id} 仍为 pending`)
    assert.ok(item.sources.length > 0, `${item.id} 缺来源`)
    assert.equal(item.sources[0].locator, item.id, `${item.id} 来源未定位到条目`)
    assert.ok(item.explain.length > 0, `${item.id} 缺少说明`)
  }
})

test('句子题库：每类都覆盖 A/B/C 三档', () => {
  for (const kind of ['gaibing', 'kuoxie', 'guanlian', 'biaodian', 'fangxie'] as const) {
    const levels = new Set(
      SENTENCE_BANK.filter((item) => item.kind === kind).map((item) => item.level),
    )
    assert.deepEqual([...levels].sort(), ['A', 'B', 'C'], `${kind} 难度档位不全`)
  }
})

test('修改病句：四类各 10 条，答案可按病因机械复核', () => {
  const subtypes = ['成分残缺', '搭配不当', '语序颠倒', '重复啰嗦'] as const
  for (const sub of subtypes) {
    assert.equal(GAIBING_ITEMS.filter((item) => item.subkind === sub).length, 10, `${sub} 条数`)
  }

  for (const item of GAIBING_ITEMS) {
    assert.ok(item.broken.endsWith('。'), `${item.id} 病句应以句号结尾`)
    assert.notEqual(item.fixed, item.broken, `${item.id} 没有改动`)
    for (const alt of item.acceptable) {
      assert.notEqual(alt, item.broken, `${item.id} 可接受答案与病句相同`)
      assert.notEqual(alt, item.fixed, `${item.id} 可接受答案与主答案重复`)
    }

    if (item.subkind === '搭配不当') {
      assert.ok(item.broken.includes(item.defect), `${item.id} 病句里找不到 defect`)
      assert.equal(
        item.fixed,
        item.broken.replace(item.defect, item.replacement),
        `${item.id} 搭配修改不是一次替换`,
      )
    } else if (item.subkind === '重复啰嗦') {
      assert.ok(item.broken.includes(item.defect), `${item.id} 病句里找不到 defect`)
      assert.equal(item.replacement, '', `${item.id} 重复类应删除而不是替换`)
      assert.equal(
        item.fixed,
        item.broken.replace(item.defect, ''),
        `${item.id} 重复修改不是一次删除`,
      )
    } else if (item.subkind === '成分残缺') {
      assert.equal(item.defect, '', `${item.id} 成分残缺不应有 defect`)
      assert.ok(item.replacement.length > 0, `${item.id} 没给出补上的成分`)
      assert.ok(
        isInsertion(item.broken, item.fixed, item.replacement),
        `${item.id} 不是纯插入式补全`,
      )
    } else {
      assert.ok(
        sortedChars(item.broken) === sortedChars(item.fixed),
        `${item.id} 语序调整改动了字词`,
      )
    }
  }
})

test('扩写句子：每档必须用上的词数递增，答案保留原句主干', () => {
  for (const item of KUOXIE_ITEMS) {
    const expected = item.level === 'A' ? 1 : item.level === 'B' ? 2 : 3
    assert.equal(item.requiredParts.length, expected, `${item.id} 扩写处数不符`)
    assert.ok(item.samples.length >= 1, `${item.id} 没有参考答案`)
    assert.ok(item.rubric.length >= 2, `${item.id} 评分点不足`)
    for (const sample of item.samples) {
      assert.ok(sample.length > item.base.length, `${item.id} 参考答案没有扩写`)
      for (const part of [...item.keep, ...item.requiredParts]) {
        assert.ok(sample.includes(part), `${item.id} 答案缺少「${part}」`)
      }
      assert.match(sample, /[。！？]$/, `${item.id} 答案没有句末标点`)
    }
  }
})

test('关联词填空：空数与占位一致，答案在白名单内且可枚举', () => {
  const whitelist = new Set<string>(GUANLIAN_WORDS)
  for (const item of GUANLIAN_ITEMS) {
    assert.equal(placeholders(item.text), item.blanks.length, `${item.id} 空数不符`)
    for (const blank of item.blanks) {
      assert.ok(blank.length >= 1, `${item.id} 出现空答案`)
      assert.equal(new Set(blank).size, blank.length, `${item.id} 同一空内答案重复`)
      for (const answer of blank) {
        assert.ok(whitelist.has(answer), `${item.id} 超纲关联词「${answer}」`)
      }
    }
    assert.ok(item.pair.length > 0, `${item.id} 缺少关联词搭配`)
  }
})

test('标点符号：空数与占位一致，标点合法且引号书名号成对', () => {
  const marks = new Set<string>(BIAODIAN_MARKS)
  for (const item of BIAODIAN_ITEMS) {
    assert.equal(placeholders(item.text), item.blanks.length, `${item.id} 空数不符`)
    for (const mark of item.blanks) {
      assert.ok(marks.has(mark), `${item.id} 超纲标点「${mark}」`)
    }
    const joined = item.blanks.join('')
    assert.equal(
      item.blanks.filter((mark) => mark === '“').length,
      item.blanks.filter((mark) => mark === '”').length,
      `${item.id} 引号不成对`,
    )
    assert.equal(
      item.blanks.filter((mark) => mark === '《').length,
      item.blanks.filter((mark) => mark === '》').length,
      `${item.id} 书名号不成对`,
    )
    assert.ok(item.blanks.length > 0 && joined.length > 0, `${item.id} 答案为空`)
  }
})

test('比喻与拟人：仿写答案带可核对的标志词', () => {
  for (const item of FANGXIE_ITEMS) {
    const markers = new Set<string>(BIYU_MARKERS)
    assert.ok(item.samples.length >= 1, `${item.id} 没有参考答案`)
    for (const sample of item.samples) {
      if (item.mode === '比喻') {
        const hit = [...markers].some((marker) => sample.includes(marker))
        assert.ok(hit, `${item.id} 比喻句没有比喻词：${sample}`)
      } else {
        const hit = item.keywords.some((keyword) => sample.includes(keyword))
        assert.ok(hit, `${item.id} 拟人句没有拟人动作：${sample}`)
      }
      assert.match(sample, /[。！？]$/, `${item.id} 答案没有句末标点`)
    }
  }
})

test('句子题库：随机抽取同卷不重复，固定种子可复现', () => {
  const first = pickSentences({ count: 40, seed: 12345 })
  const second = pickSentences({ count: 40, seed: 12345 })
  assert.deepEqual(
    first.map((item) => item.id),
    second.map((item) => item.id),
    '同一种子应得到同一组题',
  )
  assert.equal(new Set(first.map((item) => item.id)).size, 40, '同一卷内出现重复题')

  const mixed = pickSentences({
    count: 20,
    kinds: ['gaibing', 'guanlian'],
    levels: ['B'],
    seed: 7,
  })
  assert.ok(mixed.length <= 20, '抽题数超过请求')
  for (const item of mixed) {
    assert.equal(item.level, 'B')
    assert.ok(item.kind === 'gaibing' || item.kind === 'guanlian')
  }

  const overflow = pickSentences({ count: 9999, kinds: ['kuoxie'], seed: 1 })
  assert.equal(overflow.length, KUOXIE_ITEMS.length, '抽不满时应返回全部可用题')
})

test('句子题库：复核记录覆盖独立重做与机械校验', () => {
  const review = SENTENCE_BANK_META.review
  assert.ok(review.pass2.includes('不看成句答案'), '复核记录没有说明独立重做')
  assert.ok(review.mechanical.length >= 5, '机械校验条目不足')
  assert.ok(review.samples.length >= 3, '缺少抽查记录')
})
