import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  angleSupported,
  angleUnitSupported,
  buildAngleFill,
  makeAngleAddLine,
  makeAngleClassify,
  makeAngleCount,
  makeCountRectangles,
  makeCountTriangles,
  verifyAngleFill,
  type AngleFillForm,
} from '../src/quiz/angle.ts'
import { createRng } from '../src/quiz/rng.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { generateFill } from '../src/quiz/fill.ts'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'
import { buildPaper, migrateLegacyCounts, typeAvailability } from '../src/app/paperBuilder.ts'
import { formatSupports } from '../src/quiz/formats.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo, type TypstItem } from '../src/app/types.ts'
import { splitFill } from '../src/app/typstData.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }

const combination = (n: number, k: number): number => {
  let value = 1
  for (let index = 1; index <= k; index++) value = (value * (n - k + index)) / index
  return value
}

const angleFill = (form: AngleFillForm, seed: number, level: 'L1' | 'L2' | 'L3') =>
  buildAngleFill(form, createRng(seed), level)

const draftItem = (draft: ReturnType<typeof angleFill>): TypstItem => ({
  id: 'angle-fill',
  kind: 'fill',
  parts: splitFill(draft.stem, draft.answers),
  answers: draft.answers,
  solution: [draft.answers.join('；')],
  fig: draft.fig,
})

const isAngleItem = (item: TypstItem): boolean => {
  const text = JSON.stringify(item.parts ?? [])
  return text.includes('从一点引出') || text.includes('图中标出了') || text.includes('如果再添一条射线')
}

test('角形态并入填空：三种形态的答案都能由 params 独立重算', () => {
  const rng = createRng(20261105)
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (const form of ['angle-count', 'angle-classify', 'angle-add-line'] as const) {
      const draft = buildAngleFill(form, rng, level)
      assert.deepEqual(verifyAngleFill(form, draft.params), draft.answers, `${form}/${level} 答案与重算不一致`)
      assert.ok(draft.stem.includes('____'), `${form}/${level} 题干缺少空位`)
    }
  }
})

test('一点数角：答案唯一且等于 C(n,2)', () => {
  const rng = createRng(31)
  const seen = new Map<number, string>()
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const draft = makeAngleCount(rng, level)
      const n = Number(draft.params.n)
      assert.ok(n >= 3 && n <= 9)
      assert.equal(draft.answers[0], String(combination(n, 2)))
      seen.set(n, draft.answers[0]!)
    }
  }
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9])
})

test('角的分类：三类计数与直角符号/开口弧线数量一致', () => {
  const rng = createRng(77)
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const draft = makeAngleClassify(rng, level)
      const degrees = String(draft.params.angles).split(',').map(Number)
      const right = degrees.filter((degree) => degree === 90).length
      const acute = degrees.filter((degree) => degree < 90).length
      const obtuse = degrees.filter((degree) => degree > 90).length
      assert.deepEqual(draft.answers, [String(right), String(acute), String(obtuse)])
      assert.deepEqual(verifyAngleFill('angle-classify', draft.params), draft.answers)
      const fig = draft.fig!
      const squares = fig.shapes.filter((shape) => shape.points.length === 3 && shape.stroke === 'thin').length
      const arcs = fig.shapes.filter((shape) => shape.points.length > 3 && shape.stroke === 'thin').length
      assert.equal(squares, right, '每个直角都必须画直角符号')
      assert.equal(arcs, degrees.length - right, '非直角都必须画开口弧线')
      assert.deepEqual(verifyItemStructure(draftItem(draft)), [])
    }
  }
})

test('添线数角：增加数 = m，总数 = C(m+1,2)', () => {
  const rng = createRng(99)
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const draft = makeAngleAddLine(rng, level)
      const m = Number(draft.params.m)
      const expected = draft.params.ask === 'added' ? m : combination(m + 1, 2)
      assert.equal(draft.answers[0], String(expected))
      assert.deepEqual(verifyAngleFill('angle-add-line', draft.params), draft.answers)
      assert.deepEqual(verifyItemStructure(draftItem(draft)), [])
    }
  }
})

test('数三角形 / 数长方形：方案小样答案与独立枚举一致', () => {
  const rng = createRng(123)
  const rectangleKeys = new Set<string>()
  for (let attempt = 0; attempt < 300; attempt++) {
    const triangle = makeCountTriangles(rng)
    const k = Number(triangle.params.k)
    assert.equal(triangle.answer, String(combination(k + 2, 2)))

    const rectangle = makeCountRectangles(rng)
    const m = Number(rectangle.params.m)
    const n = Number(rectangle.params.n)
    assert.equal(rectangle.answer, String(combination(m + 1, 2) * combination(n + 1, 2)))
    rectangleKeys.add(`${rectangle.params.m}x${rectangle.params.n}`)
  }
  assert.equal(rectangleKeys.size, 10, '2–5 的完整方格网应有 10 种（旋转视为同一种）')
})

test('角形态只在三上 U3，U6 与 3B 不出现', () => {
  assert.equal(angleSupported('3A', ['3A-U3']), true)
  assert.equal(angleSupported('3A', ['3A-U6']), false)
  assert.equal(angleSupported('3B', ['3B-U1']), false)
  assert.equal(angleUnitSupported('3A-U3'), true)
  assert.equal(angleUnitSupported('3A-U6'), false)

  const u6 = generateFill({ grade: '3A', unitId: '3A-U6', level: 'L2', count: 20, seed: 5 })
  for (const question of u6.questions) {
    assert.equal(String(question.params.form ?? '').startsWith('angle-'), false, 'U6 不应出角形态')
  }
})

test('填空卷：U3 三档角形态 ≤1/3、其他填空仍出现、同卷不重复、复核失败 0', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const memory = new MemoryStore()
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      grade: '3A',
      unitIds: ['3A-U3'],
      level,
      types: ['tiankong'],
      count: 20,
    }
    memory.beginPaper()
    const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory })
    assert.equal(result.count, 20, `${level} 应出满 20 题`)
    assert.equal(result.stats.duplicates, 0, `${level} 同卷不得重复`)
    assert.equal(result.stats.runtimeCheck.dropped, 0, `${level} 复核失败应为 0`)
    const items = result.data.sections.flatMap((section) => section.items)
    const angleItems = items.filter(isAngleItem)
    assert.ok(angleItems.length <= Math.floor(20 / 3), `${level} 角形态 ${angleItems.length} 超过 1/3`)
    assert.ok(items.some((item) => !isAngleItem(item)), `${level} 其他填空形态不应被挤空`)
    const forms = new Set(angleItems.map((item) => JSON.stringify(item.parts).includes('图中标出了') ? 'classify' : JSON.stringify(item.parts).includes('如果再添一条射线') ? 'add' : 'count'))
    const expectedForms = level === 'L1' ? 2 : 3
    assert.equal(forms.size, expectedForms, `${level} 角形态数量不符（${[...forms].join(',')}）`)
    for (const item of items) assert.deepEqual(verifyItemStructure(item), [], `${level} ${item.id}`)
  }
})

test('填空卷：U3 连续 3 卷跨卷重复 ≤10%', () => {
  const memory = new MemoryStore()
  const keysPerPaper: string[][] = []
  for (let paper = 0; paper < 3; paper++) {
    memory.beginPaper()
    const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U3'], level: 'L2', types: ['tiankong'], count: 20 }
    const result = buildPaper({ config, template: TEMPLATE, seed: 7000 + paper * 131, memory })
    const items = result.data.sections.flatMap((section) => section.items)
    keysPerPaper.push(items.map((item) => JSON.stringify(item.parts ?? []) + '|' + JSON.stringify(item.fig ?? null)))
  }
  let overlap = 0
  for (let i = 0; i < keysPerPaper.length; i++) {
    for (let j = i + 1; j < keysPerPaper.length; j++) {
      const seen = new Set(keysPerPaper[i]!)
      for (const key of keysPerPaper[j]!) if (seen.has(key)) overlap++
    }
  }
  assert.ok(overlap <= 6, `3 卷跨卷重复 ${overlap} 题，超过 10%`)
})

test('配置迁移：counts.angle 累加到 counts.tiankong，不丢设置', () => {
  assert.deepEqual(migrateLegacyCounts({ tiankong: 0, angle: 4 }), { tiankong: 4 })
  assert.deepEqual(migrateLegacyCounts({ tiankong: 8, angle: 4 }), { tiankong: 12 })
  assert.deepEqual(migrateLegacyCounts({ angle: 4 }), { tiankong: 4 })
  assert.deepEqual(migrateLegacyCounts({ tiankong: 8 }), { tiankong: 8 })
  assert.equal(migrateLegacyCounts(null), null)
  // 超过单题型上限时截断到 200
  assert.deepEqual(migrateLegacyCounts({ tiankong: 198, angle: 4 }), { tiankong: 200 })
})

test('题型可用性：U3 通过填空可出，角不再作为独立题型；判断/选择不引用角', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U3'], level: 'L2', types: ['tiankong'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.tiankong.enabled, true)
  assert.ok(availability.tiankong.source === 'rule' || availability.tiankong.source === 'skeleton')
  assert.equal((availability as Record<string, unknown>).angle, undefined)
  // U3 的判断来源改由概念命题接入；选择题仍不引用角/U3
  assert.equal(formatSupports('3A', ['3A-U3'], 'L2', 'judge'), true, 'U3 判断题靠概念命题可出')
  assert.equal(formatSupports('3A', ['3A-U3'], 'L2', 'choice'), false, '选择题来源池只认单值计算/填空，不含角形态')
})
