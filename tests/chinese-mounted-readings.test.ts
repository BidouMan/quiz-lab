import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MOUNTED_READINGS,
  PENDING_READINGS,
  PENDING_READING_BANK,
  PRACTICE_READING_BANK,
  QUALIFIED_READING_BANK,
  READING_BANK,
  READING_THEMES,
  readingText,
} from '../src/data/chinese/readings/index.ts'
import { qualifiedReadingCandidates, readingCandidates } from '../src/chinese/materials.ts'

const PLACEHOLDER = '（ ）'
const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1

const gateRecords: Array<{ id: string; pass: boolean; needs_human_review?: boolean }> = readFileSync(
  new URL('../data/reading-catalog/quality-gate.jsonl', import.meta.url),
  'utf8',
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const gatePassed = new Set(gateRecords.filter((record) => record.pass).map((record) => record.id))
const downlisted = new Set(
  JSON.parse(
    readFileSync(new URL('../data/reading-catalog/downlisted.json', import.meta.url), 'utf8'),
  ).readings.map((item: { id: string }) => item.id),
)
const gatePending = new Set(
  gateRecords
    .filter((record) => !record.pass && !downlisted.has(record.id))
    .map((record) => record.id),
)

test('双区挂载：正式题库只收 quality_gate 通过篇目，待修区收未通过篇目', () => {
  assert.equal(
    MOUNTED_READINGS.length,
    gatePassed.size,
    `正式 ${MOUNTED_READINGS.length} 篇，过闸 ${gatePassed.size} 篇`,
  )
  assert.equal(
    PENDING_READINGS.length,
    gatePending.size,
    `待修 ${PENDING_READINGS.length} 篇，未过闸 ${gatePending.size} 篇`,
  )
  assert.equal(
    QUALIFIED_READING_BANK.length,
    READING_BANK.length + MOUNTED_READINGS.length,
    '正式题库没有合并精选库与过闸稿',
  )
  assert.equal(
    PRACTICE_READING_BANK.length,
    QUALIFIED_READING_BANK.length + PENDING_READING_BANK.length,
    '练习池没有合并正式题库与待修区',
  )
  const mountedIds = new Set(MOUNTED_READINGS.map((reading) => reading.id))
  assert.equal(mountedIds.size, MOUNTED_READINGS.length, '正式题库编号有重复')
  for (const id of mountedIds) {
    assert.ok(gatePassed.has(id), `${id} 未过闸却进入正式题库`)
    assert.ok(!downlisted.has(id), `${id} 已下架却进入正式题库`)
  }
  const pendingIds = new Set(PENDING_READINGS.map((reading) => reading.id))
  for (const id of pendingIds) {
    assert.ok(gatePending.has(id), `${id} 不该在待修区`)
    assert.ok(!downlisted.has(id), `${id} 已下架却在待修区`)
  }
  assert.ok(!mountedIds.has('RD-492') && !pendingIds.has('RD-492'), 'RD-492 本应缺号')
})

test('双区挂载：结构完整，待修区显式标 pending', () => {
  for (const reading of MOUNTED_READINGS) {
    assert.equal(reading.status, 'verified', `${reading.id} 正式题库状态不是 verified`)
  }
  for (const reading of PENDING_READINGS) {
    assert.equal(reading.status, 'pending', `${reading.id} 待修区状态不是 pending`)
    assert.ok(reading.review.includes('待修区'), `${reading.id} 复核记录没标待修`)
  }
  for (const reading of [...MOUNTED_READINGS, ...PENDING_READINGS]) {
    assert.ok(READING_THEMES.includes(reading.theme), `${reading.id} 主题越界：${reading.theme}`)
    assert.ok(reading.paragraphs.length > 0, `${reading.id} 正文为空`)
    assert.ok(reading.sources.length > 0, `${reading.id} 缺来源`)
    assert.ok(reading.review.length > 0, `${reading.id} 缺复核记录`)
    assert.ok(
      reading.questions.length >= 3 && reading.questions.length <= 5,
      `${reading.id} 题量 ${reading.questions.length} 越界`,
    )
    const stems = reading.questions.map((question) => question.stem)
    assert.equal(new Set(stems).size, stems.length, `${reading.id} 题干重复`)
  }
})

test('双区挂载：选择题四选一且答案说明非空', () => {
  for (const reading of [...MOUNTED_READINGS, ...PENDING_READINGS]) {
    for (const question of reading.questions) {
      if (question.type !== 'choice') continue
      assert.equal(question.options.length, 4, `${reading.id} 选项不是 4 个`)
      assert.equal(new Set(question.options).size, 4, `${reading.id} 选项重复`)
      assert.ok(question.answer >= 0 && question.answer < 4, `${reading.id} 答案下标越界`)
      assert.ok(question.explain.trim().length > 0, `${reading.id} 缺答案说明`)
      for (const option of question.options) {
        assert.ok(option.trim().length > 0, `${reading.id} 有空选项`)
      }
    }
  }
})

test('双区挂载：填空占位与答案一致；正式题库答案必须能在原文找到', () => {
  for (const [readings, strict] of [
    [MOUNTED_READINGS, true],
    [PENDING_READINGS, false],
  ] as const) {
    for (const reading of readings) {
      const text = readingText(reading)
      for (const question of reading.questions) {
        if (question.type !== 'fill') continue
        assert.equal(
          placeholders(question.stem),
          question.blanks.length,
          `${reading.id} 填空空数不符：${question.stem}`,
        )
        assert.ok(question.explain.trim().length > 0, `${reading.id} 填空题缺答案说明`)
        for (const blank of question.blanks) {
          assert.ok(blank.trim().length > 0, `${reading.id} 填空答案为空`)
          if (strict) assert.ok(text.includes(blank), `${reading.id} 填空答案「${blank}」不在原文`)
        }
      }
    }
  }
})

test('双区挂载：简答题有 2–3 个非空评分点', () => {
  for (const reading of [...MOUNTED_READINGS, ...PENDING_READINGS]) {
    for (const question of reading.questions) {
      if (question.type !== 'short') continue
      assert.ok(
        question.scoring.length >= 2 && question.scoring.length <= 3,
        `${reading.id} 评分点 ${question.scoring.length} 条`,
      )
      for (const point of question.scoring) {
        assert.ok(point.trim().length > 0, `${reading.id} 有空评分点`)
      }
      if (question.answer !== undefined) {
        assert.ok(question.answer.trim().length > 0, `${reading.id} 简答参考答案为空`)
      }
    }
  }
})

test('双区挂载：可进入出卷候选，正式与待修可区分', () => {
  const candidates = readingCandidates()
  assert.equal(candidates.length, PRACTICE_READING_BANK.length)
  const qualified = qualifiedReadingCandidates()
  assert.equal(qualified.length, QUALIFIED_READING_BANK.length)
  assert.equal(qualified.filter((item) => item.quality !== 'qualified').length, 0)
  const pending = candidates.filter((item) => item.quality === 'pending-repair')
  assert.equal(pending.length, PENDING_READINGS.length)
  for (const item of pending) {
    assert.ok(item.source.startsWith('【待修】'), `${item.id} 待修候选没标【待修】`)
  }
  const sample = candidates.slice(0, 10)
  for (const item of sample) {
    assert.ok(item.paragraphs.length > 0, `${item.id} 候选正文为空`)
    assert.ok(item.questions.length > 0, `${item.id} 候选没有题目`)
    const gradable = item.questions.some(
      (question) =>
        (question.type === 'choice' && typeof question.answer === 'number') ||
        (question.type === 'fill' && question.blanks.length > 0),
    )
    assert.ok(gradable, `${item.id} 没有可自动判分的客观题`)
  }
})
