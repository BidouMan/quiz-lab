import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/quiz/generate.ts'
import { typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG } from '../src/app/types.ts'
import type { AppConfig, TemplateInfo } from '../src/app/types.ts'
import type { Level } from '../src/quiz/types.ts'

const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

const LEVELS: Level[] = ['L1', 'L2', 'L3']

function availability(unitId: string, level: Level) {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: [unitId], level }
  return typeAvailability(config, TEMPLATE)
}

function evalAscii(latex: string): number {
  const expr = latex.replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/\s+/g, '')
  return Function(`return ${expr}`)() as number
}

test('教材不适用题型：U2 简便 / U5 脱式 / U7 口算脱式', () => {
  const u2 = availability('3A-U2', 'L2')
  assert.equal(u2.jianbian.enabled, false)
  assert.equal(u2.jianbian.source, 'na')
  assert.match(u2.jianbian.reason, /不适用/)
  assert.match(u2.jianbian.reason, /P1-A1/)

  const u5 = availability('3A-U5', 'L2')
  assert.equal(u5.tuoshi.enabled, false)
  assert.equal(u5.tuoshi.source, 'na')
  assert.match(u5.tuoshi.reason, /年月日/)

  for (const unitId of ['3A-U7']) {
    const unit = availability(unitId, 'L2')
    for (const type of ['kousuan', 'tuoshi'] as const) {
      assert.equal(unit[type].enabled, false, `${unitId} ${type} 应不适用`)
      assert.equal(unit[type].source, 'na')
      assert.match(unit[type].reason, /不适用/)
    }
  }
})

test('U6 周长脱式：只出 (长+宽)×2，三档各 30 题且独立复算通过', () => {
  for (const level of LEVELS) {
    const result = generate({
      grade: '3A',
      unitId: '3A-U6',
      type: 'tuoshi',
      level,
      count: 30,
      seed: 20261104,
    })
    assert.equal(result.questions.length, 30, `${level} 题量`)
    assert.equal(new Set(result.questions.map((q) => q.fingerprint)).size, 30, `${level} 去重`)
    for (const q of result.questions) {
      assert.match(q.latex, /^\(\d+ \+ \d+\) \\times 2$/, `${level} 式子应固定乘 2：${q.latex}`)
      assert.ok(!q.latex.includes('\\div'), `${level} 不得出现除法`)
      assert.equal(evalAscii(q.latex), Number(q.answer), `${level} 复算 ${q.latex}`)
      assert.equal(q.answerLines?.length, 3, `${level} 脱式应有三行`)
    }
  }
})
