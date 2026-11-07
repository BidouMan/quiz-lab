import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ADV_3A_KP,
  ADV_CATEGORIES,
  advancedCategory,
  advancedKey,
  advancedLevelsFor,
  advancedStructureKey,
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

const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6']
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

test('拓展题：17 类可做，每类每一步都只挂三上知识点', () => {
  assert.equal(ADV_CATEGORIES.length, 17, `可做类别应为 17，实际 ${ADV_CATEGORIES.length}`)
  const tierCounts = ADV_CATEGORIES.reduce<Record<string, number>>((acc, category) => {
    acc[category.tier] = (acc[category.tier] ?? 0) + 1
    return acc
  }, {})
  assert.deepEqual(tierCounts, { T1: 7, T2: 7, T3: 3 }, `分档计数 ${JSON.stringify(tierCounts)}`)
  for (const category of ADV_CATEGORIES) {
    for (const kp of category.kpKeys) {
      assert.ok(ADV_3A_KP[kp], `${category.id} 的 ${kp} 不在三上允许集合`)
    }
    assert.ok(category.kpKeys.includes(category.primaryKp), `${category.id} 缺少主知识点`)
    assert.ok(category.workLines >= 3 && category.workLines <= 8, `${category.id} 留白 ${category.workLines} 行不合理`)
  }
})

test('拓展题：三档平均步骤数实测严格递增（解绑后 L2 含 T1 补充题）', () => {
  const averages: number[] = []
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateAdvanced({ grade: '3A', unitIds: UNITS_3A, level, count: 6, seed: 20261105 })
    assert.equal(result.questions.length, 6, `${level} 实出 ${result.questions.length}`)
    const average =
      result.questions.reduce((sum, question) => sum + question.steps.length, 0) / result.questions.length
    averages.push(average)
    assert.deepEqual(validateAdvancedPaper(result.questions), [], `${level} 双路径复核失败`)
  }
  assert.ok(averages[0]! < averages[1]!, `L1 ${averages[0]} 不小于 L2 ${averages[1]}`)
  assert.ok(averages[1]! < averages[2]!, `L2 ${averages[1]} 不小于 L3 ${averages[2]}`)
  assert.ok(averages[0]! >= 2 && averages[0]! < 3, `L1 平均 ${averages[0]} 不在 [2,3)`)
  assert.ok(averages[1]! >= 2.4 && averages[1]! < 3.7, `L2 平均 ${averages[1]} 不在 [2.4,3.7)`)
  assert.ok(averages[2]! >= 3.4 && averages[2]! < 5, `L3 平均 ${averages[2]} 不在 [3.4,5)`)
})

test('拓展题：同卷按“结构 + 知识点”去重，不按题干字符串', () => {
  const result = generateAdvanced({ grade: '3A', unitIds: UNITS_3A, level: 'L1', count: 20, seed: 90 })
  assert.equal(result.questions.length, 7, `L1 只有 7 类，实出 ${result.questions.length}`)
  const keys = new Set(result.questions.map((question) => question.key))
  assert.equal(keys.size, result.questions.length, `同卷出现重复结构：${result.questions.length - keys.size}`)
  const byStem = new Set(result.questions.map((question) => question.stem))
  assert.ok(byStem.size <= keys.size, '题干去重不应比结构去重更严格')
})

test('拓展题：250 题审计（复核失败 0、结构-解法一致性失败 0、同卷重复 0）', () => {
  let total = 0
  let failures = 0
  let duplicates = 0
  const keys: string[] = []
  const memory = new MemoryStore()
  // P1 第一批后每档可用结构数：L1=7、L2=23（T1 7 + T2 16）、L3=20（T2 16 + T3 4）
  const perPaper = { L1: 7, L2: 23, L3: 20 } as const
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let paper = 0; paper < 5; paper++) {
      memory.beginPaper()
      const result = generateAdvanced({
        grade: '3A',
        unitIds: UNITS_3A,
        level,
        count: 40,
        seed: 3000 + paper * 97 + (level === 'L1' ? 0 : level === 'L2' ? 1000 : 2000),
        memory,
      })
      assert.equal(
        result.questions.length,
        perPaper[level],
        `${level} 第 ${paper + 1} 卷实出 ${result.questions.length}`,
      )
      const issues = validateAdvancedPaper(result.questions)
      failures += issues.length
      duplicates += result.questions.length - new Set(result.questions.map((question) => question.key)).size
      keys.push(...result.questions.map((question) => question.key))
      total += result.questions.length
    }
  }
  assert.equal(total, 250)
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

test('方案 A 单元归属：U7 项目式单元不出拓展题，U3 转图形题；解绑后 U2/U5 各档可用', () => {
  assert.equal(advancedSupports('3A', ['3A-U7'], 'L2'), false)
  assert.deepEqual(advancedLevelsFor('3A', ['3A-U7']), [])
  assert.equal(advancedSupports('3A', ['3A-U3'], 'L2'), false)
  assert.equal(advancedSupports('3A', ['3A-U3'], 'L1'), false)
  assert.equal(advancedSupports('3A', ['3A-U2'], 'L2'), true)
  assert.deepEqual(advancedLevelsFor('3A', ['3A-U2']), ['L1', 'L2', 'L3'])
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L1'), true)
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L2'), true)
  assert.equal(advancedSupports('3A', ['3A-U5'], 'L3'), true)
})

test('单题型上限：P1 第一批后 L2=23 种结构、L3=20 种结构，同卷不重复', () => {
  const expected = { L2: 23, L3: 20 } as const
  for (const level of ['L2', 'L3'] as const) {
    const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6'], level, count: 200, seed: 8100 })
    assert.equal(result.questions.length, expected[level], `${level} 实出 ${result.questions.length}`)
    assert.equal(new Set(result.questions.map((question) => question.key)).size, expected[level])
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
    // U1 L2 解绑后有逆向 + 归一/年龄差/归总，留白按类别而非档位
    assert.ok(item.workLines >= 3 && item.workLines <= 8, `U1 L2 出现 ${item.workLines} 行留白`)
    assert.deepEqual(verifyItemStructure(item), [])
  }
})

test('接入 typeAvailability：U7 标不适用，U3 转图形题，U5/L3 解绑后可用', () => {
  const availability = (unitIds: string[], level: 'L1' | 'L2' | 'L3') =>
    typeAvailability(
      { ...DEFAULT_CONFIG, grade: '3A', unitIds, level, types: ['advanced'], counts: { advanced: 3 }, count: 3 },
      TEMPLATE,
    ).advanced
  assert.equal(availability(['3A-U7'], 'L2').enabled, false)
  assert.equal(availability(['3A-U7'], 'L2').source, 'na')
  assert.equal(availability(['3A-U3'], 'L2').enabled, false)
  assert.equal(availability(['3A-U5'], 'L3').enabled, true)
  assert.equal(availability(['3A-U2'], 'L2').enabled, true)
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

test('P0 剪拼：长≠2宽、剩下部分不是正方形、长短边命名正确、答案唯一', () => {
  const category = advancedCategory('adv-cut-perimeter')
  assert.ok(category)
  const rng = createRng(77)
  let scanned = 0
  const violations: string[] = []
  for (let index = 0; index < 3000; index++) {
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
    const match = /剩下部分长(\d+)厘米、宽(\d+)厘米/.exec(built.steps[0]!.text)
    if (!match) violations.push(`未按长/宽命名：${built.steps[0]!.text}`)
    else if (Number(match[1]) < Number(match[2])) {
      violations.push(`短边被叫“长”：${built.steps[0]!.text}`)
    }
  }
  assert.ok(scanned >= 2900, `剪拼扫描量只有 ${scanned}`)
  assert.deepEqual(violations.slice(0, 5), [], `剪拼长/宽命名问题 ${violations.length} 条`)
})

test('P0 经过时间：3000 题无绝对分钟相减、答案只有一种写法且与题干要求一致', () => {
  const category = advancedCategory('adv-elapsed')
  assert.ok(category)
  const rng = createRng(20261107)
  let scanned = 0
  const violations: string[] = []
  const answerPattern = /^(?:\d+小时(?:\d+分钟)?|\d+分钟)$/
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const stem = category.stem(params)
    if (!stem.includes('用几小时几分钟表示')) violations.push(`题干未交代答案格式：${stem}`)
    const built = category.build(params)
    if (!answerPattern.test(built.answer)) violations.push(`答案写法不唯一：${built.answer}`)
    if (built.answer.includes('（')) violations.push(`答案仍是双写法：${built.answer}`)
    for (const step of built.steps) {
      for (const match of step.text.matchAll(/(\d+)-(\d+)/g)) {
        if (Number(match[1]) >= 60 || Number(match[2]) >= 60) {
          violations.push(`步骤出现绝对分钟相减：${step.text}`)
        }
      }
    }
    if (built.answer !== category.recompute(params)) violations.push(`答案与独立重算不一致：${built.answer}`)
  }
  assert.ok(scanned >= 2900, `经过时间扫描量只有 ${scanned}`)
  assert.deepEqual(violations.slice(0, 5), [], `经过时间问题 ${violations.length} 条`)
})

test('租船：方案表 ≤5 行、留白 8 行；各类别留白按类别而非档位', () => {
  const category = advancedCategory('adv-rent-plan')
  assert.ok(category)
  assert.equal(category.workLines, 8)
  const rng = createRng(19)
  let scanned = 0
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    assert.ok(
      Math.ceil(Number(params.people) / Number(params.bigCap)) <= 4,
      `方案表超过 5 行：${JSON.stringify(params)}`,
    )
    // 前提：大船人均更便宜；不满足必须被 draw 拒掉
    assert.ok(
      Number(params.bigCost) * Number(params.smallCap) < Number(params.smallCost) * Number(params.bigCap),
      `大船人均不便宜仍被生成：${JSON.stringify(params)}`,
    )
    const stem = category.stem(params)
    assert.ok(stem.length <= 50, `题干 ${stem.length} 字，超过 50：${stem}`)
    assert.ok(stem.includes('不能超载') && stem.includes('怎样租最省') && stem.includes('最少多少元'), stem)
    const built = category.build(params)
    assert.equal(built.answer, category.recompute(params))
  }
  assert.ok(scanned >= 100, `租船扫描量只有 ${scanned}`)
  // 反例：大船人均更贵的参数必须被 invariant 拒掉
  assert.ok(category.invariant({ people: 15, bigCap: 6, bigCost: 37, smallCap: 4, smallCost: 19 }))
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
    'adv-cut-perimeter': 4,
    'adv-weekday': 4,
    'adv-rent-plan': 8,
    'adv-combine-perimeter': 6,
    'adv-arrange-rect': 8,
    'adv-reshape': 4,
    'adv-calendar-card': 4,
    'adv-misread': 4,
    'adv-digit-count': 4,
  })
})

test('P0 拼成大长方形：4 步、答案唯一、并列最优拒生成、3000 题两路径一致', () => {
  const category = advancedCategory('adv-combine-perimeter')
  assert.ok(category)
  assert.equal(category.tier, 'T3')
  assert.equal(category.workLines, 6)
  assert.ok(category.kpKeys.includes('3A-PERIMETER') && category.kpKeys.includes('3A-STRATEGY'))
  // 并列最优（长=宽）与长=2宽必须被 invariant 拒掉
  assert.ok(category.invariant({ l: 9, w: 9 }))
  assert.ok(category.invariant({ l: 10, w: 5 }))
  const rng = createRng(20261108)
  let scanned = 0
  const violations: string[] = []
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const l = Number(params.l)
    const w = Number(params.w)
    if (l < 8 || l > 15) violations.push(`长越界：${l}`)
    if (w < 3 || w > 6) violations.push(`宽越界：${w}`)
    if (l <= w) violations.push(`长不大于宽：${l}×${w}`)
    if (l === 2 * w) violations.push(`长=2宽：${l}×${w}`)
    const built = category.build(params)
    if (built.steps.length !== 4) violations.push(`步骤不是 4 步：${built.steps.length}`)
    for (const step of built.steps) {
      if (!category.kpKeys.includes(step.kp)) violations.push(`知识点越界：${step.kp}`)
    }
    const longPerimeter = 2 * (2 * l + w)
    const shortPerimeter = 2 * (l + 2 * w)
    if (longPerimeter === shortPerimeter) violations.push(`并列最优：${l}×${w}`)
    if (!built.answer.includes(`最短${shortPerimeter}厘米`)) violations.push(`最短答案不对：${built.answer}`)
    if (built.answer !== category.recompute(params)) violations.push(`两路径不一致：${built.answer}`)
  }
  assert.ok(scanned >= 2900, `拼成大长方形扫描量只有 ${scanned}`)
  assert.deepEqual(violations.slice(0, 5), [], `拼成大长方形问题 ${violations.length} 条`)
})

test('固定周长摆长方形：枚举计数正确、唯一答案、退化情形排除', () => {
  const category = advancedCategory('adv-arrange-rect')
  assert.ok(category)
  const cases = [
    { perimeter: 12, count: 3, pairs: '长5宽1、长4宽2、长3宽3（正方形）' },
    { perimeter: 14, count: 3, pairs: '长6宽1、长5宽2、长4宽3' },
    { perimeter: 16, count: 4, pairs: '长7宽1、长6宽2、长5宽3、长4宽4（正方形）' },
    {
      perimeter: 24,
      count: 6,
      pairs: '长11宽1、长10宽2、长9宽3、长8宽4、长7宽5、长6宽6（正方形）',
    },
    {
      perimeter: 40,
      count: 10,
      pairs:
        '长19宽1、长18宽2、长17宽3、长16宽4、长15宽5、长14宽6、长13宽7、长12宽8、长11宽9、长10宽10（正方形）',
    },
  ]
  for (const item of cases) {
    const built = category.build({ perimeter: item.perimeter })
    assert.equal(built.answer, `共${item.count}种：${item.pairs}`)
    assert.equal(category.recompute({ perimeter: item.perimeter }), built.answer)
    assert.equal(category.invariant({ perimeter: item.perimeter }), null)
  }
  // 周长 10 低于下限；23 为奇数；42 超出 40，都必须拒
  assert.equal(category.invariant({ perimeter: 10 }), '周长限定 12–40')
  assert.equal(category.invariant({ perimeter: 23 }), '周长必须是偶数，长和宽才是整数')
  assert.equal(category.invariant({ perimeter: 42 }), '周长限定 12–40')
  const rng = createRng(303)
  let min = 99
  let max = 0
  for (let index = 0; index < 1000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    min = Math.min(min, Number(params.perimeter))
    max = Math.max(max, Number(params.perimeter))
  }
  assert.ok(min >= 12 && max <= 40, `周长实测 ${min}–${max} 超出 12–40`)
})

test('P0 摆长方形：3000 题无铺满歧义、答案枚举完整且唯一、口径与奇偶为 0', () => {
  const category = advancedCategory('adv-arrange-rect')
  assert.ok(category)
  const rng = createRng(20261106)
  let scanned = 0
  const violations: string[] = []
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const perimeter = Number(params.perimeter)
    if (perimeter % 2 !== 0 || perimeter < 12 || perimeter > 40) {
      violations.push(`周长越界：${perimeter}`)
      continue
    }
    const half = perimeter / 2
    const includeSquare = params.squareCounts === undefined || Number(params.squareCounts) === 1
    if (!includeSquare && half % 2 !== 0) violations.push(`不含正方形却半周长为奇数：${perimeter}`)
    const stem = category.stem(params)
    const texts = [stem, ...category.build(params).steps.map((step) => step.text)]
    for (const text of texts) {
      if (/铺|填|占满|每根算一条边/.test(text)) violations.push(`题面有铺满歧义：${text}`)
    }
    const squareRule = includeSquare ? '正方形也算一种长方形' : '只数长和宽不一样的长方形，正方形不算'
    if (!stem.includes('沿边围一圈') || !stem.includes('长不短于宽') || !stem.includes('每根算1厘米') || !stem.includes(squareRule)) {
      violations.push(`题干未锁定围边模型或口径：${stem}`)
    }
    const built = category.build(params)
    if (built.answer !== category.recompute(params)) violations.push(`两条路径答案不一致：${built.answer}`)
    const parsed = [...built.answer.matchAll(/长(\d+)宽(\d+)/g)].map((match) => [
      Number(match[1]),
      Number(match[2]),
    ])
    const expected = includeSquare ? Math.floor(half / 2) : Math.floor((half - 1) / 2)
    if (parsed.length !== expected) violations.push(`枚举数量不对：${built.answer}`)
    if (expected > 10) violations.push(`组合超过 10 组：${expected}`)
    if (!includeSquare && built.answer.includes('（正方形）')) {
      violations.push(`不含正方形却数进正方形：${built.answer}`)
    }
    if (built.answer.length > 70) violations.push(`答案超过两行（${built.answer.length} 字）：${built.answer}`)
    const seen = new Set<string>()
    for (const [long, short] of parsed) {
      if (long < short) violations.push(`长小于宽：${long}<${short}`)
      if (long + short !== half) violations.push(`长+宽≠${half}：${long}+${short}`)
      const key = `${long}:${short}`
      if (seen.has(key)) violations.push(`同组重复：${key}`)
      seen.add(key)
    }
  }
  assert.ok(scanned >= 2900, `摆长方形扫描量只有 ${scanned}`)
  assert.deepEqual(violations.slice(0, 5), [], `摆长方形问题 ${violations.length} 条`)
})

test('摆长方形参数域：周长 12–40 共 15 种；连续两卷同结构重复 0', () => {
  const category = advancedCategory('adv-arrange-rect')
  assert.ok(category)
  const rng = createRng(20261110)
  const pool = new Set<number>()
  const variants = new Set<string>()
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    pool.add(Number(params.perimeter))
    variants.add(String(params.variant))
  }
  assert.deepEqual([...pool].sort((a, b) => a - b), [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40])
  assert.deepEqual([...variants].sort(), ['no-square', 'with-square'])

  const memory = new MemoryStore()
  memory.beginPaper()
  const first = generateAdvanced({ grade: '3A', unitIds: ['3A-U6'], level: 'L3', count: 7, seed: 11, memory })
  memory.beginPaper()
  const second = generateAdvanced({ grade: '3A', unitIds: ['3A-U6'], level: 'L3', count: 7, seed: 22, memory })
  const keys = [...first.questions, ...second.questions]
    .filter((question) => question.categoryId === 'adv-arrange-rect')
    .map((question) => question.key)
  assert.equal(keys.length, new Set(keys).size, `连续两卷出现完全相同的摆长方形：${keys.join('、')}`)
})

test('P0-2 逆向推理 4 变体：句式各不相同、双路径一致、同卷同变体只出 1 次', () => {
  const category = advancedCategory('adv-reverse')
  assert.ok(category)
  assert.equal(category.variantCount, 4)
  const rng = createRng(20261112)
  const variants = new Set<string>()
  const stems = new Map<string, string>()
  let scanned = 0
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const variant = String(params.variant)
    variants.add(variant)
    const built = category.build(params)
    assert.equal(String(category.recompute(params)), built.answer, `${variant} 双路径不一致`)
    assert.equal(category.invariant(params), null, `${variant} 结构约束不通过`)
    assert.equal(verifyAdvancedRecord({ ...recordOf({
      categoryId: category.id,
      tier: category.tier,
      level: 'L2',
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
    }) }).length, 0)
    // 同一变体换数字后句式必须完全一致，防止模板串台
    const normalized = category.stem(params).replace(/\d+/g, '#')
    if (stems.has(variant)) assert.equal(normalized, stems.get(variant))
    else stems.set(variant, normalized)
    // 三上数域：乘数、除数都只能是 2–9
    for (const key of ['mult', 'divisor']) {
      const value = params[key]
      if (typeof value === 'number') assert.ok(value >= 2 && value <= 9, `${variant} 的 ${key}=${value}`)
    }
  }
  assert.ok(scanned >= 2900, `逆向推理扫描量只有 ${scanned}`)
  assert.deepEqual([...variants].sort(), ['add-div', 'add-mul', 'mul-add', 'sub-mul'])
  assert.equal(stems.size, 4, '4 个变体应有 4 套不同句式')

  const paper = generateAdvanced({ grade: '3A', unitIds: ['3A-U1'], level: 'L2', count: 10, seed: 424242 })
  const structures = paper.questions
    .filter((question) => question.categoryId === 'adv-reverse')
    .map((question) => advancedStructureKey(question.categoryId, question.params))
  assert.equal(structures.length, new Set(structures).size, `同卷逆向重复变体：${structures.join('、')}`)
})

test('P0-2 出不满时：提示写清“只有 N 类”和缺哪几类题型', () => {
  // U6 L2 只映射到“拼图形后的周长 + 剪拼后的周长 + 改围图形”3 类共 5 种结构，6 题必然出不满
  const result = generateAdvanced({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 6, seed: 907 })
  assert.ok(result.questions.length < 6, `U6 L2 竟然出满 ${result.questions.length} 题`)
  const note = result.notes.find((item) => item.includes('如实出'))
  assert.ok(note, `缺少如实提示：${result.notes.join('｜')}`)
  assert.ok(note!.includes('本单元该档目前只有 3 类'), note)
  assert.ok(note!.includes('实际可用 5 种结构'), note)
  assert.ok(note!.includes('拼图形后的周长') && note!.includes('剪拼后的周长') && note!.includes('改围图形'), note)
  assert.ok(note!.includes('没有映射到本单元'), note)
  // 缺的题型必须点名（只列同档题型，L3 专有的拼大长方形/摆长方形不算 L2 缺口）
  assert.ok(note!.includes('本档另有 11 类'), note)
  for (const label of ['逆向推理', '周期排列', '归一问题', '等量代换', '月历牌推理', '错中求解']) {
    assert.ok(note!.includes(label), `缺的题型没点名 ${label}：${note}`)
  }
  assert.ok(!note!.includes('固定周长摆长方形'), `不该把 L3 题型算进 L2 缺口：${note}`)
  // 出满的卷不出现这条提示（U2 L2 有 4 类 6 种结构，正好出满）
  const full = generateAdvanced({ grade: '3A', unitIds: ['3A-U2'], level: 'L2', count: 6, seed: 907 })
  assert.equal(full.questions.length, 6)
  assert.ok(!full.notes.some((item) => item.includes('如实出')), full.notes.join('｜'))
})

test('P1 第一批新增 4 类：双路径一致、变体齐全、数域守卫生效', () => {
  const checks = [
    { id: 'adv-reshape', variants: ['rect-to-square', 'square-to-rect', 'perimeter-to-width'] },
    { id: 'adv-calendar-card', variants: ['vertical-3', 'horizontal-3', 'cross-5'] },
    { id: 'adv-misread', variants: ['factor', 'op-swap'] },
    { id: 'adv-digit-count', variants: ['two-digit-max', 'three-digit-min'] },
  ] as const
  for (const check of checks) {
    const category = advancedCategory(check.id)
    assert.ok(category, check.id)
    assert.equal(category.variantCount, check.variants.length, `${check.id} 变体数`)
    const rng = createRng(20261115)
    const seen = new Set<string>()
    let scanned = 0
    for (let index = 0; index < 2000; index++) {
      const params = category.draw(rng)
      if (params == null) continue
      scanned++
      const variant = String(params.variant)
      seen.add(variant)
      const built = category.build(params)
      assert.equal(String(category.recompute(params)), built.answer, `${check.id}/${variant} 两条路径不一致`)
      assert.equal(category.invariant(params), null, `${check.id}/${variant} 约束不通过`)
      const texts = [category.stem(params), ...built.steps.map((step) => step.text), built.answer]
      for (const text of texts) {
        assert.ok(
          !/面积|平方厘米|平方米|分数|小数|方程/.test(text),
          `${check.id} 出现三上以外的内容：${text}`,
        )
      }
      // 三上数域：乘数、除数都只能是 2–9，且不出现两位数乘两位数
      for (const key of ['a', 'b', 'divisor']) {
        const value = params[key]
        if (typeof value === 'number') assert.ok(value >= 2 && value <= 9, `${check.id} 的 ${key}=${value}`)
      }
      const products = [...`${texts.join(' ')}`.matchAll(/(\d{2,})×(\d{2,})/g)]
      assert.equal(products.length, 0, `${check.id} 出现两位数乘两位数：${products.map((m) => m[0]).join('、')}`)
    }
    assert.ok(scanned >= 1900, `${check.id} 扫描量只有 ${scanned}`)
    assert.deepEqual([...seen].sort(), [...check.variants].sort(), `${check.id} 变体未出全`)
  }
})

test('P1 周期：3000 题周期串无重复符号、答案最高占比 <35%、题干要求写算式', () => {
  const category = advancedCategory('adv-cycle')
  assert.ok(category)
  // 反例：旧串“○△○□”里 ○ 出现两次，必须被 invariant 拒掉
  assert.ok(category.invariant({ pattern: '○△○□', kind: '图形', n: 41 }))
  const rng = createRng(20261109)
  let scanned = 0
  const answerCounts = new Map<string, number>()
  const duplicatePatterns: string[] = []
  for (let index = 0; index < 3000; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    scanned++
    const pattern = String(params.pattern)
    if (new Set(pattern).size !== pattern.length) duplicatePatterns.push(pattern)
    assert.ok(category.stem(params).includes('（写出算式和答句）'), `周期题干缺少作答要求`)
    const answer = category.build(params).answer
    answerCounts.set(answer, (answerCounts.get(answer) ?? 0) + 1)
    assert.equal(answer, category.recompute(params))
  }
  const maxShare = Math.max(...[...answerCounts.values()]) / scanned
  assert.ok(scanned >= 2900, `周期扫描量只有 ${scanned}`)
  assert.deepEqual(duplicatePatterns, [], `仍有重复符号周期串：${duplicatePatterns.slice(0, 3).join('、')}`)
  assert.ok(maxShare < 0.35, `最高答案占比 ${(maxShare * 100).toFixed(1)}%，未降到 35% 以下`)
})

test('蒙对收紧：星期几题干要求写算式和答句', () => {
  const category = advancedCategory('adv-weekday')
  assert.ok(category)
  const rng = createRng(404)
  for (let index = 0; index < 300; index++) {
    const params = category.draw(rng)
    if (params == null) continue
    assert.ok(category.stem(params).includes('（写出算式和答句）'), `adv-weekday 题干缺少作答要求`)
  }
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
