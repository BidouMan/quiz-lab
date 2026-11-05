import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDateKousuan, recomputeDateKousuan, verifyDateKousuan } from '../src/quiz/dateKousuan.ts'
import { createRng } from '../src/quiz/rng.ts'
import { generate } from '../src/quiz/generate.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { verifyCalcQuestion } from '../src/app/runtimeCheck.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

test('U5 口算：月份天数按平年 / 闰年区分，2 月题面必写明', () => {
  const rng = createRng(20261105)
  for (let i = 0; i < 300; i++) {
    const piece = buildDateKousuan('monthDays', rng, 'L2')
    const month = Number(piece.features['month'])
    const expected = month === 2 ? (Number(piece.features['leap']) === 1 ? 29 : 28) : MONTH_DAYS[month - 1]
    assert.equal(piece.answer, String(expected), `${month} 月天数不对`)
    assert.equal(recomputeDateKousuan(piece.features), expected)
    if (month === 2) {
      assert.ok(piece.latex.includes('平年') || piece.latex.includes('闰年'), '2 月必须写明平年/闰年')
    }
    assert.equal(verifyDateKousuan(piece.features, piece.latex), null)
  }
})

test('U5 口算：一年有 7 个大月，题面不得含糊', () => {
  const piece = buildDateKousuan('bigMonths', createRng(7), 'L1')
  assert.equal(piece.answer, '7')
  assert.ok(piece.latex.includes('大月'))
  assert.equal(verifyDateKousuan(piece.features, piece.latex), null)
})

test('U5 口算：整时经过时间，答案 = 结束时刻 − 开始时刻 且至少 1 小时', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const rng = createRng(20261105)
    for (let i = 0; i < 100; i++) {
      const piece = buildDateKousuan('elapsedHour', rng, level)
      const start = Number(piece.features['start'])
      const end = Number(piece.features['end'])
      assert.ok(end > start, '结束时刻必须晚于开始时刻')
      assert.ok(end <= 24)
      assert.equal(piece.answer, String(end - start))
      assert.ok(piece.latex.includes(`${start}时到${end}时`))
      assert.equal(verifyDateKousuan(piece.features, piece.latex), null)
    }
  }
})

test('U5 口算：日期推算不跨月、往后天数至少 1 天', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const rng = createRng(20261105)
    for (let i = 0; i < 100; i++) {
      const piece = buildDateKousuan('dateOffset', rng, level)
      const month = Number(piece.features['month'])
      const base = Number(piece.features['base'])
      const offset = Number(piece.features['offset'])
      assert.ok(offset >= 1, '不得出现“往后 0 天”')
      assert.ok(base + offset <= MONTH_DAYS[month - 1]!, '不得跨月')
      assert.ok(piece.latex.includes(`${month}月${base}日往后${offset}天`))
      assert.equal(piece.answer, String(base + offset))
      assert.equal(verifyDateKousuan(piece.features, piece.latex), null)
    }
  }
})

test('U5 口算复核：答案被改错时能拦住', () => {
  const piece = buildDateKousuan('monthDays', createRng(1), 'L1')
  const wrong = { ...piece.features, result: Number(piece.features['result']) + 1 }
  assert.ok(verifyDateKousuan(wrong, piece.latex)?.includes('答案不符'))
})

test('U5 口算复核：往后 0 天、跨月、题面与参数不符都拦住', () => {
  const zero = { result: 9, kind: 'dateOffset', month: 8, base: 8, offset: 0 }
  assert.ok(verifyDateKousuan(zero, '"8月8日往后0天是（　　）号"')?.includes('无法独立重算'))

  const crossMonth = { result: 33, kind: 'dateOffset', month: 8, base: 30, offset: 3 }
  assert.ok(verifyDateKousuan(crossMonth, '"8月30日往后3天是（　　）号"')?.includes('无法独立重算'))

  const mismatch = { result: 8, kind: 'dateOffset', month: 8, base: 1, offset: 7 }
  assert.ok(verifyDateKousuan(mismatch, '"8月2日往后7天是（　　）号"')?.includes('日期与参数不符'))

  const badHour = { result: 2, kind: 'elapsedHour', start: 11, end: 9 }
  assert.ok(verifyDateKousuan(badHour, '"11时到9时经过（　　）小时"')?.includes('无法独立重算'))
})

test('U5 口算：L1/L2/L3 各出满 30 题、同卷不重复、每题过运行时复核', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generate({
      grade: '3A',
      unitId: '3A-U5',
      type: 'kousuan',
      level,
      count: 30,
      seed: 20261105,
      memory: new MemoryStore(),
    })
    assert.equal(result.count, 30, `${level} 应出满 30 题`)
    assert.equal(new Set(result.questions.map((q) => q.fingerprint)).size, 30, `${level} 同卷不得重复`)
    assert.deepEqual(
      [...new Set(result.questions.map((q) => q.features['kind']))].sort(),
      ['bigMonths', 'dateOffset', 'elapsedHour', 'monthDays'],
      `${level} 四类素材都应出现`,
    )
    for (const question of result.questions) {
      assert.equal(verifyCalcQuestion(question).length, 0, `${level} ${question.latex}`)
      assert.equal(recomputeDateKousuan(question.features), Number(question.answer), `${level} ${question.latex}`)
    }
  }
})

test('接线：U5 只出口算时可出满且不剔除', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U5'], level: 'L2', types: ['kousuan'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.kousuan.enabled, true)
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory: new MemoryStore() })
  assert.equal(result.count, 20)
  assert.equal(result.skipped.includes('kousuan'), false)
  assert.equal(result.stats.runtimeCheck.dropped, 0)
})
