import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MOUNTED_READINGS,
  PRACTICE_READING_BANK,
  READING_BANK,
  READING_THEMES,
  readingText,
} from '../src/data/chinese/readings/index.ts'
import { readingCandidates } from '../src/chinese/materials.ts'

const PLACEHOLDER = '（ ）'
const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1

const gateRecords: Array<{ id: string; pass: boolean }> = readFileSync(
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

test('挂载题库：只挂载 quality_gate 通过且未下架的篇目', () => {
  assert.equal(
    MOUNTED_READINGS.length,
    gatePassed.size,
    `挂载 ${MOUNTED_READINGS.length} 篇，过闸 ${gatePassed.size} 篇`,
  )
  assert.equal(
    PRACTICE_READING_BANK.length,
    READING_BANK.length + MOUNTED_READINGS.length,
    '出卷题库没有合并精选库与挂载稿',
  )
  const mountedIds = new Set(MOUNTED_READINGS.map((reading) => reading.id))
  assert.equal(mountedIds.size, MOUNTED_READINGS.length, '挂载稿编号有重复')
  for (const id of mountedIds) {
    assert.ok(gatePassed.has(id), `${id} 未通过 quality_gate 却被挂载`)
    assert.ok(!downlisted.has(id), `${id} 已下架却被挂载`)
  }
  assert.ok(!mountedIds.has('RD-492'), 'RD-492 本应缺号')
})

test('挂载题库：结构完整，题目与答案可直接使用', () => {
  for (const reading of MOUNTED_READINGS) {
    assert.ok(READING_THEMES.includes(reading.theme), `${reading.id} 主题越界：${reading.theme}`)
    assert.equal(reading.status, 'verified', `${reading.id} 仍为 pending`)
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

test('挂载题库：选择题四选一且答案说明非空', () => {
  for (const reading of MOUNTED_READINGS) {
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

test('挂载题库：填空占位与答案一致，且答案能在原文找到', () => {
  for (const reading of MOUNTED_READINGS) {
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
        assert.ok(text.includes(blank), `${reading.id} 填空答案「${blank}」不在原文`)
      }
    }
  }
})

test('挂载题库：简答题有 2–3 个非空评分点', () => {
  for (const reading of MOUNTED_READINGS) {
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

test('挂载题库：可进入出卷候选题并能判客观题', () => {
  const candidates = readingCandidates()
  assert.equal(candidates.length, PRACTICE_READING_BANK.length)
  const mounted = candidates.filter((item) => gatePassed.has(item.id))
  assert.equal(mounted.length, MOUNTED_READINGS.length)
  const sample = mounted.slice(0, 10)
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
