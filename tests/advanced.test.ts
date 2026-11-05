import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ADV_3A_KP,
  ADV_CATEGORIES,
  advancedCategory,
  advancedKey,
  advancedLevelsFor,
  advancedSupports,
  generateAdvanced,
  levelForTier,
  validateAdvancedPaper,
  verifyAdvancedRecord,
  type AdvancedKp,
  type AdvancedRecord,
} from '../src/quiz/advanced.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'

const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U9']
const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }

const recordOf = (question: {
  categoryId: string
  tier: 'T1' | 'T2' | 'T3'
  level: 'L1' | 'L2' | 'L3'
  unitId: string
  kpKey: AdvancedKp
  kpKeys: AdvancedKp[]
  params: Record<string, number | string>
  known: string[]
  unknown: string
  stem: string
  steps: { text: string; kp: AdvancedKp; expr?: string; result?: number }[]
  answer: string
  key: string
}): AdvancedRecord => ({
  categoryId: question.categoryId,
  tier: question.tier,
  level: question.level,
  unitId: question.unitId,
  kpKey: question.kpKey,
  kpKeys: question.kpKeys,
  params: question.params,
  known: question.known,
  unknown: question.unknown,
  stem: question.stem,
  steps: question.steps,
  answer: question.answer,
  key: question.key,
})

test('拓展题：15 类可做，每类每一步都只挂三上知识点', () => {
  assert.equal(ADV_CATEGORIES.length, 15, `可做类别应为 15，实际 ${ADV_CATEGORIES.length}`)
  for (const category of ADV_CATEGORIES) {
    for (const kp of category.kpKeys) {
      assert.ok(ADV_3A_KP[kp], `${category.id} 的 ${kp} 不在三上允许集合`)
    }
    assert.ok(category.kpKeys.includes(category.primaryKp), `${category.id} 缺少主知识点`)
  }
})

test('拓展题：三档平均步骤数实测严格递增（2.0 / 3.0 / 4.5）', () => {
  const averages: number[] = []
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateAdvanced({ grade: '3A', unitIds: UNITS_3A, level, count: 10, seed: 20261105 })
    assert.equal(result.questions.length, 10, `${level} 实出 ${result.questions.length}`)
    const average =
      result.questions.reduce((sum, question) => sum + question.steps.length, 0) / result.questions.length
    averages.push(average)
    assert.deepEqual(validateAdvancedPaper(result.questions), [], `${level} 双路径复核失败`)
  }
  assert.ok(averages[0]! < averages[1]!, `T1 ${averages[0]} 不小于 T2 ${averages[1]}`)
  assert.ok(averages[1]! < averages[2]!, `T2 ${averages[1]} 不小于 T3 ${averages[2]}`)
  assert.equal(averages[0], 2)
  assert.equal(averages[1], 3)
  assert.equal(averages[2], 4.5)
})

test('拓展题：同卷按“结构 + 知识点”去重，不按题干字符串', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: UNITS_3A, level: 'L1', count: 20, seed: 90 })
  assert.equal(result.questions.length, 20)
  const keys = new Set(result.questions.map((question) => question.key))
  assert.equal(keys.size, 20, `同卷出现重复结构：${20 - keys.size}`)
  const byStem = new Set(result.questions.map((question) => question.stem))
  assert.ok(byStem.size <= keys.size, '题干去重不应比结构去重更严格')
})

test('拓展题：300 题审计（复核失败 0、结构-解法一致性失败 0、同卷重复 0）', () => {
  let total = 0
  let failures = 0
  let duplicates = 0
  const keys: string[] = []
  const memory = new MemoryStore()
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let paper = 0; paper < 5; paper++) {
      memory.beginPaper()
      const result = generateAdvanced({
        grade: '3A',
        unitIds: UNITS_3A,
        level,
        count: 20,
        seed: 3000 + paper * 97 + (level === 'L1' ? 0 : level === 'L2' ? 1000 : 2000),
        memory,
      })
      assert.equal(result.questions.length, 20, `${level} 第 ${paper + 1} 卷实出 ${result.questions.length}`)
      const issues = validateAdvancedPaper(result.questions)
      failures += issues.length
      duplicates += result.questions.length - new Set(result.questions.map((question) => question.key)).size
      keys.push(...result.questions.map((question) => question.key))
      total += result.questions.length
    }
  }
  assert.equal(total, 300)
  assert.equal(failures, 0, `复核失败 ${failures}`)
  assert.equal(duplicates, 0, `同卷重复 ${duplicates}`)
  const crossDuplicate = keys.length - new Set(keys).size
  assert.ok(crossDuplicate / total < 0.05, `跨卷重复率 ${(crossDuplicate / total * 100).toFixed(1)}%`)
})

test('反例：解法用到超纲知识点必须被拒', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U4'], level: 'L1', count: 1, seed: 1 })
  const question = result.questions[0]!
  const record = recordOf(question)
  record.steps[0] = { ...record.steps[0]!, kp: '3A-EQUATION' as AdvancedKp }
  const issues = verifyAdvancedRecord(record)
  assert.ok(issues.some((issue) => issue.includes('非三上知识点')), `应拒绝超纲步骤：${issues.join('；')}`)
})

test('反例：步骤知识点不属于该类别（即使在三上集合内）必须被拒', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U4'], level: 'L1', count: 1, seed: 2 })
  const question = result.questions[0]!
  const record = recordOf(question)
  record.steps[0] = { ...record.steps[0]!, kp: '3A-STRATEGY' }
  const issues = verifyAdvancedRecord(record)
  assert.ok(issues.some((issue) => issue.includes('不在类别')), `应拒绝跨类别知识点：${issues.join('；')}`)
})

test('反例：有多解（并列最优）的租船题必须被拒', () => {
  const category = advancedCategory('adv-rent-plan')
  assert.ok(category)
  const params = { people: 24, bigCap: 6, bigCost: 36, smallCap: 4, smallCost: 24 }
  const built = category.build(params)
  const record: AdvancedRecord = {
    categoryId: category.id,
    tier: category.tier,
    level: levelForTier(category.tier),
    unitId: '3A-U1',
    kpKey: category.primaryKp,
    kpKeys: category.kpKeys,
    params,
    known: built.known,
    unknown: built.unknown,
    stem: category.stem(params),
    steps: built.steps,
    answer: built.answer,
    key: advancedKey(category.id, category.primaryKp, params),
  }
  const issues = verifyAdvancedRecord(record)
  assert.ok(
    issues.some((issue) => issue.includes('并列') || issue.includes('唯一')),
    `应拒绝多解：${issues.join('；')}`,
  )
})

test('反例：题干含模糊词必须被拒', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U4'], level: 'L1', count: 1, seed: 3 })
  const question = result.questions[0]!
  const record = recordOf(question)
  record.stem = `大约${record.stem}`
  const issues = verifyAdvancedRecord(record)
  assert.ok(issues.some((issue) => issue.includes('模糊词')), `应拒绝模糊词：${issues.join('；')}`)
})

test('反例：超纲词（面积/方程等）必须被拒', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U4'], level: 'L1', count: 1, seed: 4 })
  const question = result.questions[0]!
  const record = recordOf(question)
  record.stem = `${record.stem}这个图形的面积是多少？`
  const issues = verifyAdvancedRecord(record)
  assert.ok(issues.some((issue) => issue.includes('超纲词')), `应拒绝超纲词：${issues.join('；')}`)
})

test('方案 A 单元归属：U8 不出拓展题，U3 只出 T2，U5 无 T3', () => {
  assert.equal(advancedSupports('3A', ['3A-U8'], 'L2'), false)
  assert.deepEqual(advancedLevelsFor('3A', ['3A-U8']), [])
  assert.equal(advancedSupports('3A', ['3A-U3'], 'L2'), true)
  assert.equal(advancedSupports('3A', ['3A-U3'], 'L1'), false)
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L1'), true)
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L2'), true)
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L3'), false)
})

test('单题型 200 上限：U9 L2/L3 均可出满且同卷不重复', () => {
  for (const level of ['L2', 'L3'] as const) {
    const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U9'], level, count: 200, seed: 8100 })
    assert.equal(result.questions.length, 200, `${level} 实出 ${result.questions.length}`)
    assert.equal(new Set(result.questions.map((question) => question.key)).size, 200)
    assert.deepEqual(validateAdvancedPaper(result.questions), [])
  }
})

test('接入 buildPaper：默认 3 题、通栏 4 行、运行时复核 0 丢弃', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U1'],
    level: 'L2',
    types: ['advanced'],
    counts: { advanced: 3 },
    count: 3,
  }
  const memory = new MemoryStore()
  memory.beginPaper()
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory })
  assert.equal(result.count, 3, `实出 ${result.count}`)
  assert.equal(result.stats.duplicates, 0)
  assert.equal(result.stats.runtimeCheck.dropped, 0)
  const items = result.data.sections.flatMap((section) => section.items)
  assert.equal(items.length, 3)
  for (const item of items) {
    assert.equal(item.kind, 'advanced')
    assert.equal(item.workLines, 4)
    assert.deepEqual(verifyItemStructure(item), [])
  }
})

test('接入 typeAvailability：U8 标不适用，U3/L2 可用，U5/L3 给可切档提示', () => {
  const availability = (unitIds: string[], level: 'L1' | 'L2' | 'L3') =>
    typeAvailability(
      { ...DEFAULT_CONFIG, grade: '3A', unitIds, level, types: ['advanced'], counts: { advanced: 3 }, count: 3 },
      TEMPLATE,
    ).advanced
  assert.equal(availability(['3A-U8'], 'L2').enabled, false)
  assert.equal(availability(['3A-U8'], 'L2').source, 'na')
  assert.equal(availability(['3A-U3'], 'L2').enabled, true)
  const u5l3 = availability(['3A-U5'], 'L3')
  assert.equal(u5l3.enabled, false)
  assert.ok(u5l3.reason.includes('L1') || u5l3.reason.includes('L2'), u5l3.reason)
})
