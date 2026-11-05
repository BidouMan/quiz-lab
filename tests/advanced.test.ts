import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ADV_3A_KP,
  ADV_CATEGORIES,
  advancedCategory,
  advancedKey,
  advancedLevelsFor,
  advancedStyleIssue,
  advancedSupports,
  generateAdvanced,
  levelForTier,
  validateAdvancedPaper,
  verifyAdvancedRecord,
  type AdvancedKp,
  type AdvancedRecord,
} from '../src/quiz/advanced.ts'
import { createRng } from '../src/quiz/rng.ts'
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

test('拓展题：14 类可做，每类每一步都只挂三上知识点', () => {
  assert.equal(ADV_CATEGORIES.length, 14, `可做类别应为 14，实际 ${ADV_CATEGORIES.length}`)
  for (const category of ADV_CATEGORIES) {
    for (const kp of category.kpKeys) {
      assert.ok(ADV_3A_KP[kp], `${category.id} 的 ${kp} 不在三上允许集合`)
    }
    assert.ok(category.kpKeys.includes(category.primaryKp), `${category.id} 缺少主知识点`)
    assert.ok(category.workLines >= 3 && category.workLines <= 8, `${category.id} 留白 ${category.workLines} 行不合理`)
  }
})

test('拓展题：三档平均步骤数实测严格递增（T1 2–2.5 / T2 3 / T3 4.5）', () => {
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
  assert.ok(averages[0]! >= 2 && averages[0]! < 3, `T1 平均 ${averages[0]} 不在 [2,3)`)
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

test('方案 A 单元归属：U8 不出拓展题，U3 删除数长方形后无 T2 类别', () => {
  assert.equal(advancedSupports('3A', ['3A-U8'], 'L2'), false)
  assert.deepEqual(advancedLevelsFor('3A', ['3A-U8']), [])
  assert.equal(advancedSupports('3A', ['3A-U3'], 'L2'), false)
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

test('接入 buildPaper：默认 3 题、按类别留白、运行时复核 0 丢弃', () => {
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
    // U1 L2 只有逆向（4 行）与重叠（5 行）两类
    assert.ok([4, 5].includes(item.workLines), `U1 L2 出现 ${item.workLines} 行留白`)
    assert.deepEqual(verifyItemStructure(item), [])
  }
})

test('接入 typeAvailability：U8 标不适用，U3 删除数长方形后不可用，U5/L3 给可切档提示', () => {
  const availability = (unitIds: string[], level: 'L1' | 'L2' | 'L3') =>
    typeAvailability(
      { ...DEFAULT_CONFIG, grade: '3A', unitIds, level, types: ['advanced'], counts: { advanced: 3 }, count: 3 },
      TEMPLATE,
    ).advanced
  assert.equal(availability(['3A-U8'], 'L2').enabled, false)
  assert.equal(availability(['3A-U8'], 'L2').source, 'na')
  assert.equal(availability(['3A-U3'], 'L2').enabled, false)
  const u5l3 = availability(['3A-U5'], 'L3')
  assert.equal(u5l3.enabled, false)
  assert.ok(u5l3.reason.includes('L1') || u5l3.reason.includes('L2'), u5l3.reason)
})

test('P0 数域扫描：13 类各 2000 次抽样，两位数除法/两位数×两位数/归一归总超 99 均为 0', () => {
  const rng = createRng(20261105)
  let scanned = 0
  const violations: string[] = []
  for (const category of ADV_CATEGORIES) {
    for (let index = 0; index < 2000; index++) {
      const params = category.draw(rng)
      if (params == null) continue
      const built = category.build(params)
      scanned++
      const texts = [category.stem(params), ...built.steps.map((step) => step.text)]
      for (const text of texts) {
        for (const match of text.matchAll(/÷(\d+)/g)) {
          if (match[1]!.length > 1) violations.push(`${category.id} 两位数除法：${text}`)
        }
        for (const match of text.matchAll(/(\d+)×(\d+)/g)) {
          if (match[1]!.length > 1 && match[2]!.length > 1) {
            violations.push(`${category.id} 两位数×两位数：${text}`)
          }
        }
      }
      for (const step of built.steps) {
        if (step.expr == null) continue
        for (const match of step.expr.matchAll(/(?<![0-9])(\d+)\/(\d+)/g)) {
          if (match[2]!.length > 1) violations.push(`${category.id} 算式两位数除法：${step.expr}`)
        }
        for (const match of step.expr.matchAll(/(\d+)\*(\d+)/g)) {
          if (match[1]!.length > 1 && match[2]!.length > 1) {
            violations.push(`${category.id} 算式两位数×两位数：${step.expr}`)
          }
        }
      }
      if (
        ['adv-normalize', 'adv-totalize'].includes(category.id) &&
        /^\d+$/.test(built.answer) &&
        Number(built.answer) > 99
      ) {
        violations.push(`${category.id} 答案超过 99：${built.answer}`)
      }
    }
  }
  assert.ok(scanned >= 20000, `扫描量只有 ${scanned}，不足 13×2000`)
  assert.deepEqual(violations.slice(0, 5), [], `超纲样本 ${violations.length} 条`)
})

test('P0 写法扫描：无“0 天/……0/时0分”，星期几日期下限 8 且起算点写死', () => {
  const rng = createRng(20261106)
  const violations: string[] = []
  for (const category of ADV_CATEGORIES) {
    for (let index = 0; index < 2000; index++) {
      const params = category.draw(rng)
      if (params == null) continue
      const stem = category.stem(params)
      const built = category.build(params)
      for (const text of [stem, ...built.steps.map((step) => step.text)]) {
        const issue = advancedStyleIssue(text)
        if (issue) violations.push(`${category.id}：${issue}｜${text}`)
      }
      if (category.id === 'adv-weekday') {
        if (Number(params.day) < 8) violations.push(`星期几日期小于 8：${stem}`)
        if (!stem.includes('从1日算起')) violations.push(`星期几未写死起算点：${stem}`)
      }
      if (category.id === 'adv-cut-perimeter' && !stem.includes('从一端剪下')) {
        violations.push(`剪拼未锁定从一端剪：${stem}`)
      }
    }
  }
  assert.deepEqual(violations.slice(0, 5), [], `写法问题 ${violations.length} 条`)
})

test('P0 剪拼：长≠2宽、剩下部分不是正方形、答案唯一', () => {
  const category = advancedCategory('adv-cut-perimeter')
  assert.ok(category)
  const rng = createRng(77)
  let scanned = 0
  for (let index = 0; index < 2000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const l = Number(params.l)
    const w = Number(params.w)
    assert.notEqual(l, 2 * w, '长不能正好是宽的 2 倍')
    assert.notEqual(l - w, w, '剩下部分不能是正方形')
    assert.ok(category.stem(params).includes('从一端剪下'), '题干必须写“从一端剪下”')
    const built = category.build(params)
    assert.equal(built.answer, String(category.recompute(params)))
  }
  assert.ok(scanned >= 1000, `剪拼扫描量只有 ${scanned}`)
})

test('租船：方案表 ≤5 行、留白 8 行；各类别留白按类别而非档位', () => {
  const category = advancedCategory('adv-rent-plan')
  assert.ok(category)
  assert.equal(category.workLines, 8)
  const rng = createRng(19)
  let scanned = 0
  for (let index = 0; index < 500; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    assert.ok(
      Math.ceil(Number(params.people) / Number(params.bigCap)) <= 4,
      `方案表超过 5 行：${JSON.stringify(params)}`,
    )
  }
  assert.ok(scanned >= 100, `租船扫描量只有 ${scanned}`)
  const lines = Object.fromEntries(ADV_CATEGORIES.map((item) => [item.id, item.workLines]))
  assert.deepEqual(lines, {
    'adv-cycle': 3,
    'adv-normalize': 3,
    'adv-substitute': 3,
    'adv-elapsed': 4,
    'adv-age-diff': 3,
    'adv-join-perimeter': 3,
    'adv-totalize': 3,
    'adv-reverse': 4,
    'adv-overlap': 5,
    'adv-cut-perimeter': 4,
    'adv-symbol': 4,
    'adv-weekday': 4,
    'adv-rent-plan': 8,
    'adv-arrange-rect': 6,
  })
})

test('固定周长摆长方形：枚举计数正确、唯一答案、退化情形排除', () => {
  const category = advancedCategory('adv-arrange-rect')
  assert.ok(category)
  const cases = [
    { perimeter: 12, count: 3, pairs: '长5宽1、长4宽2、长3宽3' },
    { perimeter: 14, count: 3, pairs: '长6宽1、长5宽2、长4宽3' },
    { perimeter: 16, count: 4, pairs: '长7宽1、长6宽2、长5宽3、长4宽4' },
    { perimeter: 24, count: 6, pairs: '长11宽1、长10宽2、长9宽3、长8宽4、长7宽5、长6宽6' },
  ]
  for (const item of cases) {
    const built = category.build({ perimeter: item.perimeter })
    assert.equal(built.answer, `共${item.count}种：${item.pairs}`)
    assert.equal(category.recompute({ perimeter: item.perimeter }), built.answer)
    assert.equal(category.invariant({ perimeter: item.perimeter }), null)
  }
  // 周长 10：半周长 5，只能摆成长3宽2（长≥宽），仍可出；9 为奇数必须拒
  assert.equal(category.invariant({ perimeter: 10 }), '周长限定 12–24')
  assert.equal(category.invariant({ perimeter: 23 }), '周长必须是偶数，长和宽才是整数')
  const rng = createRng(303)
  let min = 99
  let max = 0
  for (let index = 0; index < 1000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    min = Math.min(min, Number(params.perimeter))
    max = Math.max(max, Number(params.perimeter))
  }
  assert.ok(min >= 12 && max <= 24, `周长实测 ${min}–${max} 超出 12–24`)
})

test('反例：星期几写成“3÷7=0……3”或剪拼缺“从一端”必须被拒', () => {
  const weekday = generateAdvanced({ grade: '3A', unitIds: ['3A-U5'], level: 'L2', count: 1, seed: 31 }).questions[0]
  assert.ok(weekday)
  const weekdayRecord = recordOf(weekday)
  weekdayRecord.steps[1] = { ...weekdayRecord.steps[1]!, text: '3÷7=0……3' }
  const weekdayIssues = verifyAdvancedRecord(weekdayRecord)
  assert.ok(weekdayIssues.some((issue) => issue.includes('商 0')), `应拒绝商 0 写法：${weekdayIssues.join('；')}`)

  const cut = advancedCategory('adv-cut-perimeter')
  assert.ok(cut)
  const params = { l: 9, w: 4 }
  const built = cut.build(params)
  const cutRecord: AdvancedRecord = {
    categoryId: cut.id,
    tier: cut.tier,
    level: levelForTier(cut.tier),
    unitId: '3A-U6',
    kpKey: cut.primaryKp,
    kpKeys: cut.kpKeys,
    params,
    known: built.known,
    unknown: built.unknown,
    stem: cut.stem(params).replace('从一端剪下', '剪下'),
    steps: built.steps,
    answer: built.answer,
    key: advancedKey(cut.id, cut.primaryKp, params),
  }
  const cutIssues = verifyAdvancedRecord(cutRecord)
  assert.ok(cutIssues.some((issue) => issue.includes('从一端')), `应拒绝未锁定的剪法：${cutIssues.join('；')}`)
})
