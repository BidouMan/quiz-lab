import test from 'node:test'
import assert from 'node:assert/strict'
import { CURRICULUM } from '../src/data/curriculum.ts'
import { generate } from '../src/quiz/generate.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { evalLatex } from '../src/quiz/expr.ts'
import { toTypstPaper, latexToTypst } from '../src/quiz/typst.ts'
import type { CalcType, GeneratedQuestion, Level, RuleSpec } from '../src/quiz/types.ts'

const TYPES: CalcType[] = ['kousuan', 'chushi', 'tuoshi', 'jianbian']
const LEVELS: Level[] = ['L1', 'L2', 'L3']

function specCount(unitId: string, type: CalcType, level: Level): number {
  const unit = CURRICULUM.units.find((u) => u.unitId === unitId)!
  let total = 0
  for (const kp of unit.kps) {
    const value = kp.rules[type]?.[level]
    if (value) total += Array.isArray(value) ? value.length : 1
  }
  return total
}

function specsOf(unitId: string, type: CalcType, level: Level): RuleSpec[] {
  const unit = CURRICULUM.units.find((u) => u.unitId === unitId)!
  const out: RuleSpec[] = []
  for (const kp of unit.kps) {
    const value = kp.rules[type]?.[level]
    if (!value) continue
    out.push(...(Array.isArray(value) ? value : [value]))
  }
  return out
}

function assertAnswer(q: GeneratedQuestion): void {
  if (q.answer.includes('……')) {
    const [quotient, rem] = q.answer.split('……').map(Number)
    assert.ok(Number.isInteger(quotient) && Number.isInteger(rem))
    const [dividend, divisor] = q.values
    assert.equal(dividend, quotient * divisor + rem)
    return
  }
  assert.equal(evalLatex(q.latex), Number(q.answer), `${q.latex} 答案应为 ${q.answer}`)
  if (q.answerLines) {
    assert.equal(q.answerLines.at(-1), `= ${q.answer}`)
  }
}

test('单元树：三上 7 个单元、三下 7 个单元，三下全部标记 unconfirmed', () => {
  const grade3A = CURRICULUM.units.filter((u) => u.grade === '3A')
  const grade3B = CURRICULUM.units.filter((u) => u.grade === '3B')
  assert.equal(grade3A.length, 7)
  assert.equal(grade3B.length, 7)
  assert.equal(CURRICULUM.units.length, 14)
  for (const unit of grade3B) {
    assert.equal(unit.unconfirmed, true, `${unit.unitId} 应标记 unconfirmed`)
    assert.ok(unit.note && unit.note.includes('推定'), `${unit.unitId} 应有推定备注`)
  }
  const ids = new Set<string>()
  for (const unit of CURRICULUM.units) {
    for (const kp of unit.kps) {
      assert.ok(!ids.has(kp.kpId), `知识点 ID 重复: ${kp.kpId}`)
      ids.add(kp.kpId)
      if (Object.keys(kp.rules).length > 0) {
        assert.ok(kp.kpId.startsWith(unit.unitId), `${kp.kpId} 前缀不匹配 ${unit.unitId}`)
      }
    }
  }
})

test('生成覆盖：所有登记的口算/竖式/脱式/简便规则都能出题', () => {
  for (const unit of CURRICULUM.units) {
    for (const type of TYPES) {
      for (const level of LEVELS) {
        if (specCount(unit.unitId, type, level) === 0) continue
        const result = generate({ grade: unit.grade, unitId: unit.unitId, type, level, count: 2, seed: 321 })
        assert.equal(result.count, 2, `${unit.unitId} ${type}/${level} 题量不足`)
      }
    }
  }
})

test('答案正确性：每题独立求值，带余除法验算，递等式末行等于答案', () => {
  for (const unit of CURRICULUM.units) {
    for (const type of TYPES) {
      for (const level of LEVELS) {
        if (specCount(unit.unitId, type, level) === 0) continue
        const result = generate({ grade: unit.grade, unitId: unit.unitId, type, level, count: 3, seed: 777 })
        for (const q of result.questions) assertAnswer(q)
      }
    }
  }
})

test('约束合法性：位数、进位、余数、商 0 都在规则范围内', () => {
  const mulL1 = generate({ grade: '3A', kpId: '3A-U2-K2', type: 'chushi', level: 'L1', count: 20, seed: 101 }).questions
  for (const q of mulL1) {
    assert.equal(Number(q.features.carries), 0, `L1 不应进位: ${q.latex}`)
    assert.ok(q.values[0] >= 10 && q.values[0] <= 99)
  }

  const mulL2 = generate({ grade: '3A', kpId: '3A-U2-K2', type: 'chushi', level: 'L2', count: 20, seed: 102 }).questions
  for (const q of mulL2) {
    assert.ok(Number(q.features.carries) >= 1)
    assert.equal(Number(q.features.maxConsecutive), 1)
  }

  const mulL3 = generate({ grade: '3A', kpId: '3A-U2-K2', type: 'chushi', level: 'L3', count: 20, seed: 103 }).questions
  for (const q of mulL3) {
    assert.ok(Number(q.features.maxConsecutive) >= 2, `L3 应连续进位: ${q.latex}`)
  }

  const divL3 = generate({ grade: '3A', kpId: '3A-U4-K4', type: 'chushi', level: 'L3', count: 20, seed: 104 }).questions
  for (const q of divL3) {
    assert.equal(q.features.quotientZero, true, `L3 商应有 0: ${q.latex}`)
    assert.equal(q.features.remainder, 0)
  }

  const twoDigitDiv = generate({ grade: '3B', kpId: '3B-U2-K6', type: 'chushi', level: 'L1', count: 20, seed: 105 }).questions
  for (const q of twoDigitDiv) {
    assert.ok(Number(q.features.divisor) >= 11)
    assert.equal(q.features.remainder, 0)
    assert.equal(q.features.quotientDigits, 1)
  }
})

test('同卷去重：30 题内算式与数值组合都不重复', () => {
  const result = generate({ grade: '3A', unitId: '3A-U2', type: 'chushi', level: 'L3', count: 30, seed: 202 })
  assert.equal(result.questions.length, 30)
  const latex = new Set(result.questions.map((q) => q.latex.replace(/\s+/g, '')))
  const fp = new Set(result.questions.map((q) => q.fingerprint))
  assert.equal(latex.size, 30)
  assert.equal(fp.size, 30)
})

test('难度差异：L1 不进位、L2 单次进位、L3 连续进位；L3 脱式为三步带括号', () => {
  const levelStats = (level: Level) => {
    const qs = generate({ grade: '3A', kpId: '3A-U2-K2', type: 'chushi', level, count: 20, seed: 300 }).questions
    return {
      maxCarries: Math.max(...qs.map((q) => Number(q.features.carries))),
      maxConsecutive: Math.max(...qs.map((q) => Number(q.features.maxConsecutive))),
      avgProduct: qs.reduce((sum, q) => sum + Number(q.answer), 0) / qs.length,
    }
  }
  const l1 = levelStats('L1')
  const l2 = levelStats('L2')
  const l3 = levelStats('L3')
  assert.equal(l1.maxCarries, 0)
  assert.ok(l2.maxCarries >= 1)
  assert.equal(l2.maxConsecutive, 1)
  assert.ok(l3.maxConsecutive >= 2)
  assert.ok(l3.avgProduct > l1.avgProduct)

  const steps = (level: Level) =>
    generate({ grade: '3A', kpId: '3A-U1-K2', type: 'tuoshi', level, count: 15, seed: 301 }).questions
  const l1Steps = steps('L1')
  const l3Steps = steps('L3')
  assert.ok(l1Steps.every((q) => Number(q.features.steps) === 2))
  assert.ok(l3Steps.every((q) => Number(q.features.steps) === 3))
  assert.ok(l3Steps.every((q) => q.latex.includes('(')))
})

test('跨卷记忆：连续 10 份的重复率低于无记忆基线', () => {
  const measure = (shared: boolean) => {
    const memory = shared ? new MemoryStore() : null
    const all = new Set<string>()
    let total = 0
    let within = 0
    for (let i = 1; i <= 10; i++) {
      const store = memory ?? new MemoryStore()
      if (shared) store.beginPaper()
      const result = generate({
        grade: '3A',
        unitId: '3A-U2',
        type: 'kousuan',
        level: 'L1',
        count: 12,
        seed: 1000 + i * 17,
        memory: store,
      })
      total += result.questions.length
      const local = new Set<string>()
      for (const q of result.questions) {
        const key = q.latex.replace(/\s+/g, '')
        if (local.has(key)) within++
        local.add(key)
        all.add(`${q.kpId}|${key}`)
      }
    }
    return { total, unique: all.size, within }
  }

  const withMemory = measure(true)
  const withoutMemory = measure(false)
  assert.equal(withMemory.within, 0)
  assert.equal(withoutMemory.within, 0)
  assert.ok(withMemory.unique > withoutMemory.unique, '跨卷记忆应提高去重率')
  assert.ok(withMemory.unique / withMemory.total >= 0.7)
})

test('可复现：同 seed 结果一致，不同 seed 结果不同；Typst JSON 结构正确', () => {
  const a = generate({ grade: '3A', unitId: '3A-U2', type: 'chushi', level: 'L2', count: 8, seed: 42 }).questions
  const b = generate({ grade: '3A', unitId: '3A-U2', type: 'chushi', level: 'L2', count: 8, seed: 42 }).questions
  const c = generate({ grade: '3A', unitId: '3A-U2', type: 'chushi', level: 'L2', count: 8, seed: 43 }).questions
  assert.deepEqual(a.map((q) => q.latex), b.map((q) => q.latex))
  assert.notDeepEqual(a.map((q) => q.latex), c.map((q) => q.latex))

  assert.equal(latexToTypst('2 \\times 3 ='), '2 times 3 =')
  assert.equal(latexToTypst('8 \\div 4 ='), '8 div 4 =')

  const kousuan = generate({ grade: '3A', unitId: '3A-U2', type: 'kousuan', level: 'L1', count: 4, seed: 44 }).questions
  const chushi = generate({ grade: '3A', unitId: '3A-U2', type: 'chushi', level: 'L2', count: 4, seed: 45 }).questions
  const paper = toTypstPaper([...kousuan, ...chushi], '测试卷')
  assert.equal(paper.sections.length, 2)
  assert.equal(paper.sections[0].title, '一、口算')
  assert.equal(paper.sections[0].items[0].kind, 'kousuan')
  assert.equal(paper.sections[1].title, '二、竖式计算')
  assert.equal(paper.sections[1].items[0].kind, 'chushi')
  assert.equal(paper.meta.count, 8)
})

test('规则元数据：每个规则都写明 form 与数值约束对象', () => {
  for (const unit of CURRICULUM.units) {
    for (const kp of unit.kps) {
      for (const type of TYPES) {
        const levels = kp.rules[type]
        if (!levels) continue
        for (const level of LEVELS) {
          const value = levels[level]
          if (!value) continue
          for (const spec of Array.isArray(value) ? value : [value]) {
            assert.ok(spec.form)
            assert.ok(spec.constraints && typeof spec.constraints === 'object')
          }
        }
      }
    }
  }
})

test('简便运算：三上移除，三下只保留 25×4/125×8 凑整', () => {
  // P1-A1：三上不再生成简便运算（乘法结合律/分配律属四年级内容）
  assert.throws(
    () => generate({ grade: '3A', unitId: '3A-U2', type: 'jianbian', level: 'L1', count: 5, seed: 501 }),
    /没有 jianbian\/L1 的生成规则/,
  )
  assert.throws(
    () => generate({ grade: '3A', unitId: '3A-U1', type: 'jianbian', level: 'L1', count: 5, seed: 502 }),
    /没有 jianbian\/L1 的生成规则/,
  )
  // 三下保留的简便运算仍只走 25×4/125×8 凑整
  const l3 = generate({ grade: '3B', unitId: '3B-U2', type: 'jianbian', level: 'L1', count: 10, seed: 503 }).questions
  assert.ok(l3.every((q) => Number(q.features.roundTo) === 100))
  for (const q of l3) {
    assert.ok(q.answerLines?.length)
    assert.equal(q.answerLines?.at(-1), `= ${q.answer}`)
  }
})
