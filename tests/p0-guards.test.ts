import assert from 'node:assert/strict'
import test from 'node:test'
import { generate } from '../src/quiz/generate.ts'
import { generateWord } from '../src/quiz/word.ts'
import { generateFill } from '../src/quiz/fill.ts'
import { kousuanRangeProblem } from '../src/quiz/forms.ts'
import type { CalcType, Level } from '../src/quiz/types.ts'

const LEVELS: Level[] = ['L1', 'L2', 'L3']
const CALC_TYPES: CalcType[] = ['kousuan', 'chushi', 'tuoshi', 'jianbian']
const MIN_CORE_RATIO = 0.7

const round = (value: number): number => Math.round(value * 1000) / 1000

// ---------- P0-1：3A-U1 不得出现除法与余数分配 ----------

test('P0-1 3A-U1 计算题不含除号', () => {
  let checked = 0
  for (const level of LEVELS) {
    for (const type of CALC_TYPES) {
      for (const seed of [9101, 9102]) {
        let questions: { latex: string }[] = []
        try {
          questions = generate({ grade: '3A', unitId: '3A-U1', type, level, count: 20, seed }).questions
        } catch {
          continue // 该题型在本单元无规则
        }
        for (const question of questions) {
          const latex = question.latex.replace(/\s+/g, '')
          assert.ok(!latex.includes('\\div'), `3A-U1/${type}/${level} 出现除法：${question.latex}`)
          assert.ok(!latex.includes('÷'), `3A-U1/${type}/${level} 出现除号：${question.latex}`)
          checked++
        }
      }
    }
  }
  assert.ok(checked > 100, `U1 计算题样本不足：${checked}`)
})

test('P0-1 3A-U1 应用题不含除法与余数语义', () => {
  let checked = 0
  for (const level of LEVELS) {
    let total = 0
    const samples: ReturnType<typeof generateWord>['questions'] = []
    for (let seed = 0; seed < 10; seed++) {
      const result = generateWord({ grade: '3A', unitId: '3A-U1', level, count: 20, seed: 9200 + seed })
      samples.push(...result.questions)
      total += result.count
    }
    assert.equal(total, 200, `U1/${level} 应生成 200 题`)
    for (const question of samples) {
      const texts = [question.stem, ...question.answers, ...question.steps.map((item) => item.line)]
      for (const text of texts) {
        assert.ok(!text.includes('÷'), `3A-U1/${level} 出现除法：${text}`)
        assert.ok(!text.includes('……'), `3A-U1/${level} 出现余数写法：${text}`)
        assert.ok(!text.includes('余'), `3A-U1/${level} 出现余数语义：${text}`)
      }
      checked++
    }
  }
  assert.equal(checked, 600)
})

// ---------- P0-2：口算只能心算 ----------
//
// 判定条件（由 kousuanRangeProblem 执行）：
// 1. 加减：操作数与结果都是两位/三位整数（≤999）；
// 2. 乘法：至少一个因数是一位数，或至少一个因数是整十/整百数；积 ≤9999；
// 3. 除法：除数是一位数，或是 10/20/…/90 的整十数；被除数 ≤999；
// 4. 整十除数必须整除；被除数四位及以上、除数 11–99 非整十、两位数×两位数一律不许入口算。

test('P0-2 口算 200 题全部落在心算范围', () => {
  const units = [
    '3A-U1','3A-U2','3A-U3','3A-U4','3A-U5','3A-U6','3A-U7','3A-U8','3A-U9',
    '3B-U1','3B-U2','3B-U3','3B-U4','3B-U5','3B-U6','3B-U7',
  ]
  const samples: ReturnType<typeof generate>['questions'] = []
  let index = 0
  while (samples.length < 200 && index < 400) {
    const unitId = units[index % units.length]
    const grade: '3A' | '3B' = unitId.startsWith('3A') ? '3A' : '3B'
    const level = LEVELS[Math.floor(index / units.length) % LEVELS.length]
    const seed = 9300 + index
    index++
    try {
      const result = generate({ grade, unitId, type: 'kousuan', level, count: 12, seed })
      samples.push(...result.questions)
    } catch {
      // 本单元该难度没有口算规则，跳过
    }
  }
  assert.ok(samples.length >= 200, `口算样本不足：${samples.length}`)
  const checked = samples.slice(0, 200)
  for (const question of checked) {
    assert.equal(
      kousuanRangeProblem(question as never),
      null,
      `口算越界：${question.latex}（${question.unitId}/${question.level}）`,
    )
    // 混合题在输出里没有节点树，再按 LaTeX 文字复核一遍乘除子式
    for (const match of question.latex.matchAll(/(\d+)\s*\\div\s*(\d+)/g)) {
      const dividend = Number(match[1])
      const divisor = Number(match[2])
      assert.ok(dividend <= 999, `口算被除数四位以上：${question.latex}`)
      assert.ok(
        divisor <= 9 || (divisor >= 10 && divisor <= 90 && divisor % 10 === 0),
        `口算除数不是一位数或整十数：${question.latex}`,
      )
    }
    for (const match of question.latex.matchAll(/(\d+)\s*\\times\s*(\d+)/g)) {
      const a = Number(match[1])
      const b = Number(match[2])
      assert.ok(
        a <= 9 || b <= 9 || a % 10 === 0 || b % 10 === 0,
        `口算出现两位数×两位数：${question.latex}`,
      )
      assert.ok(a * b <= 9999, `口算乘积四位以上：${question.latex}`)
    }
  }
})

test('P0-2 口算规则本身拒绝 53×81、408÷24、1033÷51', () => {
  const fake = (values: number[], operands: number[], op: 'mul' | 'div') =>
    ({ values, operands, op, latex: '', answer: '' }) as never
  assert.match(String(kousuanRangeProblem(fake([53 * 81], [53, 81], 'mul'))), /超出心算范围/)
  assert.match(String(kousuanRangeProblem(fake([408, 24, 17, 0], [408, 24], 'div'))), /超出心算范围/)
  assert.match(String(kousuanRangeProblem(fake([1033, 51, 20, 13], [1033, 51], 'div'))), /超出心算范围/)
  assert.equal(kousuanRangeProblem(fake([24 * 30], [24, 30], 'mul')), null)
  assert.equal(kousuanRangeProblem(fake([840, 20, 42, 0], [840, 20], 'div')), null)
})

// ---------- P0-3：3B-U2 覆盖本单元核心 ----------

interface Sample {
  features: Record<string, number | string | boolean>
}

const sampleMany = (build: (seed: number) => Sample[], rounds: number): Sample[] => {
  const all: Sample[] = []
  for (let seed = 0; seed < rounds; seed++) all.push(...build(seed))
  return all
}

test('P0-3 3B-U2 填空：两位数乘除步骤占比 ≥ 70%', () => {
  for (const level of LEVELS) {
    const samples = sampleMany(
      (seed) =>
        generateFill({ grade: '3B', unitId: '3B-U2', level, count: 8, seed: 9400 + seed }).questions as never,
      25,
    )
    assert.equal(samples.length, 200, `3B-U2/${level} 填空应生成 200 题`)
    const core = samples.filter((question) => question.features.twoDigitStep === true).length
    const ratio = core / samples.length
    assert.ok(
      ratio >= MIN_CORE_RATIO,
      `3B-U2/${level} 填空核心步骤占比 ${round(ratio)} < ${MIN_CORE_RATIO}（${core}/${samples.length}）`,
    )
  }
})

test('P0-3 3B-U2 应用题：两位数乘除步骤占比 ≥ 70%', () => {
  for (const level of LEVELS) {
    const samples = sampleMany(
      (seed) =>
        generateWord({ grade: '3B', unitId: '3B-U2', level, count: 8, seed: 9500 + seed }).questions as never,
      25,
    )
    assert.equal(samples.length, 200, `3B-U2/${level} 应用题应生成 200 题`)
    const core = samples.filter((question) => Number(question.features.twoDigitSteps) > 0).length
    const ratio = core / samples.length
    assert.ok(
      ratio >= MIN_CORE_RATIO,
      `3B-U2/${level} 应用题核心步骤占比 ${round(ratio)} < ${MIN_CORE_RATIO}（${core}/${samples.length}）`,
    )
  }
})
