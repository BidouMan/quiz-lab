import test from 'node:test'
import assert from 'node:assert/strict'
import {
  READING_BANK,
  READING_BANK_META,
  READING_THEMES,
  pickReadings,
  readingCharCount,
  readingCounts,
} from '../src/data/chinese/readings/index.ts'

const PLACEHOLDER = '（ ）'
const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1

test('课外阅读：20–30 篇，六个主题各 4 篇', () => {
  assert.ok(READING_BANK.length >= 20 && READING_BANK.length <= 30)
  const counts = readingCounts()
  for (const theme of READING_THEMES) {
    assert.equal(counts[theme], 4, `${theme} 篇数不是 4`)
  }
})

test('课外阅读：正文 250–450 字（只计汉字）', () => {
  for (const reading of READING_BANK) {
    const count = readingCharCount(reading)
    assert.ok(count >= 250 && count <= 450, `${reading.id} 字数 ${count} 越界`)
    assert.ok(reading.paragraphs.length >= 3, `${reading.id} 分段少于 3 段`)
  }
})

test('课外阅读：编号、标题唯一，来源定位到篇目且全部 verified', () => {
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const reading of READING_BANK) {
    assert.ok(!ids.has(reading.id), `重复编号：${reading.id}`)
    ids.add(reading.id)
    assert.ok(!titles.has(reading.title), `重复标题：${reading.title}`)
    titles.add(reading.title)
    assert.equal(reading.status, 'verified', `${reading.id} 仍为 pending`)
    assert.ok(reading.sources.length > 0, `${reading.id} 缺来源`)
    assert.equal(reading.sources[0].locator, reading.id, `${reading.id} 来源未定位`)
    assert.ok(reading.sources[0].label.includes('原创'), `${reading.id} 未标明原创`)
    assert.ok(reading.review.length > 0, `${reading.id} 缺复核记录`)
  }
})

test('课外阅读：每篇 3–5 题，选择、填空、简答齐备', () => {
  for (const reading of READING_BANK) {
    assert.ok(
      reading.questions.length >= 3 && reading.questions.length <= 5,
      `${reading.id} 题量 ${reading.questions.length} 越界`,
    )
    const types = new Set(reading.questions.map((question) => question.type))
    for (const type of ['choice', 'fill', 'short'] as const) {
      assert.ok(types.has(type), `${reading.id} 缺少 ${type} 题`)
    }
  }
})

test('课外阅读：选择题四选一，答案唯一并有原文依据说明', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'choice') continue
      assert.equal(question.options.length, 4, `${reading.id} 选项不是 4 个`)
      assert.equal(
        new Set(question.options).size,
        4,
        `${reading.id} 选项重复：${question.stem}`,
      )
      assert.ok(question.answer >= 0 && question.answer < 4, `${reading.id} 答案下标越界`)
      assert.ok(question.explain.length > 0, `${reading.id} 选择题缺答案说明`)
    }
  }
})

test('课外阅读：填空题空数与占位一致，答案非空', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'fill') continue
      assert.equal(
        placeholders(question.stem),
        question.blanks.length,
        `${reading.id} 填空空数不符：${question.stem}`,
      )
      for (const blank of question.blanks) {
        assert.ok(blank.length > 0, `${reading.id} 填空答案为空`)
      }
      assert.ok(question.explain.length > 0, `${reading.id} 填空题缺答案说明`)
    }
  }
})

test('课外阅读：简答题有参考答案与 2–3 个评分点', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'short') continue
      assert.ok(question.answer.length > 0, `${reading.id} 简答无参考答案`)
      assert.ok(
        question.scoring.length >= 2 && question.scoring.length <= 3,
        `${reading.id} 评分点 ${question.scoring.length} 条`,
      )
      for (const point of question.scoring) {
        assert.ok(point.length > 0, `${reading.id} 空评分点`)
      }
    }
  }
})

test('课外阅读：同一篇内题干不重复，随机抽取不重复且可复现', () => {
  for (const reading of READING_BANK) {
    const stems = reading.questions.map((question) => question.stem)
    assert.equal(new Set(stems).size, stems.length, `${reading.id} 题干重复`)
  }

  const first = pickReadings({ count: 8, seed: 2026 })
  const second = pickReadings({ count: 8, seed: 2026 })
  assert.deepEqual(
    first.map((reading) => reading.id),
    second.map((reading) => reading.id),
    '同一种子应得到同一组短文',
  )
  assert.equal(new Set(first.map((reading) => reading.id)).size, 8, '同一组出现重复短文')

  const fables = pickReadings({ count: 99, themes: ['寓言'], seed: 9 })
  assert.equal(fables.length, 4, '按主题抽取数量不对')
  for (const reading of fables) assert.equal(reading.theme, '寓言')
})

test('课外阅读：复核记录覆盖独立重做与机械校验', () => {
  const review = READING_BANK_META.review
  assert.ok(review.pass2.includes('不看答案'), '复核记录没有说明独立重做')
  assert.ok(review.mechanical.length >= 5, '机械校验条目不足')
  assert.ok(review.samples.length >= 3, '缺少抽查记录')
})
