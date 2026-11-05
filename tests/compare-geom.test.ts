import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCompare } from '../src/quiz/compare.ts'
import { generateGeom, geomMissingLabels } from '../src/quiz/geom.ts'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo, type TypstItem } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8', '3A-U9']
const UNITS_3B = ['3B-U1', '3B-U2', '3B-U3', '3B-U4', '3B-U5', '3B-U6', '3B-U7']

function compareItem(piece: ReturnType<typeof generateCompare>['items'][number]): TypstItem {
  return {
    id: 'cmp',
    kind: 'compare',
    pre: piece.pre,
    post: piece.post,
    audit: { form: piece.form, answer: piece.answer, params: {} },
  }
}

function geomItem(piece: ReturnType<typeof generateGeom>['items'][number]): TypstItem {
  return {
    id: 'geo',
    kind: 'geom',
    text: piece.text,
    fig: piece.fig,
    blank: piece.blank,
    audit: { form: piece.form, answer: piece.answer, params: { ...piece.params, unit: piece.unit } },
  }
}

test('比大小：30 题不重复且每题独立复核通过（L1/L2/L3）', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateCompare({ grade: '3A', unitIds: UNITS_3A, level, count: 30, seed: 20261104 })
    assert.equal(generated.items.length, 30, `${level} 应出满 30 题`)
    const keys = new Set(generated.items.map((piece) => `${piece.pre}|${piece.post}`))
    assert.equal(keys.size, 30, `${level} 同卷不得逐字重复`)
    for (const piece of generated.items) {
      assert.deepEqual(verifyItemStructure(compareItem(piece)), [], `${level} ${piece.pre} ? ${piece.post}`)
    }
  }
})

test('比大小：难度递进是形态递进，L3 必须“先算再比”', () => {
  const l1 = generateCompare({ grade: '3A', unitIds: UNITS_3A, level: 'L1', count: 30, seed: 7 })
  const l3 = generateCompare({ grade: '3A', unitIds: UNITS_3A, level: 'L3', count: 30, seed: 7 })
  const forms = (items: typeof l1.items) => new Set(items.map((piece) => piece.form))
  const l1Forms = forms(l1.items)
  const l3Forms = forms(l3.items)

  assert.ok(!l1Forms.has('paren'), 'L1 不应出现带括号两步式')
  assert.ok(l1Forms.has('addSub'), 'L1 保留两步加减比较')
  assert.ok(l3Forms.has('paren'), 'L3 必须出现带括号两步式')
  assert.ok(l3Forms.has('mixedUnit'), 'L3 必须出现先换算再比的混合单位题')
  const leftSide = (items: typeof l1.items) => items.filter((piece) => /times|div/.test(piece.pre) || /times|div/.test(piece.post)).length
  assert.ok(leftSide(l3.items) > leftSide(l1.items), 'L3 的算式比较题应明显多于 L1')
})

test('比大小：按所选单元出对应知识点，不混入未勾单元内容', () => {
  // 只勾「用一位数乘」：只能出积比较、算式与数比较，不得出现除法/时间/图形边数
  const mulOnly = generateCompare({ grade: '3A', unitIds: ['3A-U2'], level: 'L2', count: 30, seed: 42 })
  const mulForms = new Set(mulOnly.items.map((piece) => piece.form))
  assert.deepEqual([...mulForms].sort(), ['exprVsNum', 'product'])

  // 只勾「年月日」：只能出时间/天数比较
  const dateOnly = generateCompare({ grade: '3A', unitIds: ['3A-U5'], level: 'L2', count: 30, seed: 42 })
  const dateForms = new Set(dateOnly.items.map((piece) => piece.form))
  assert.deepEqual([...dateForms].sort(), ['days', 'time'])

  // 只勾「周长」：与比大小无对应内容，不出并写明原因
  const none = generateCompare({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 30, seed: 42 })
  assert.equal(none.items.length, 0)
  assert.ok(none.notes.some((note) => note.includes('没有对应的比较知识点')))
})

test('比大小：遵守教材口径（未学除法/分数不出）', () => {
  const early = generateCompare({ grade: '3A', unitIds: ['3A-U3'], level: 'L3', count: 30, seed: 99 })
  for (const piece of early.items) {
    assert.ok(!/div|frac/.test(piece.pre + piece.post), `3A-U3 未学除法/分数：${piece.pre} ? ${piece.post}`)
  }
  const afterDiv = generateCompare({ grade: '3A', unitIds: ['3A-U4'], level: 'L3', count: 30, seed: 99 })
  assert.ok(afterDiv.items.some((piece) => /div/.test(piece.pre + piece.post)), '3A-U4 起应有除法比较')
  const frac = generateCompare({ grade: '3B', unitIds: UNITS_3B, level: 'L3', count: 30, seed: 99 })
  assert.ok(frac.items.some((piece) => /frac/.test(piece.pre + piece.post)), '三下分数单元之后应有分数比较')
  for (const piece of frac.items.filter((item) => /frac/.test(item.pre))) {
    assert.ok(!/neg|-/.test(piece.pre.replace(/frac\(\d+, \d+\)/g, '')), '分数题不得出现负数')
  }
})

test('图形与周长：30 题不重复、答案可独立重算、题干与答案单位一致', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateGeom({ grade: '3A', unitIds: UNITS_3A, level, count: 30, seed: 20261104 })
    assert.equal(generated.items.length, 30, `${level} 应出满 30 题`)
    // U3 认识图形类题目题干会重复（如“右边的图形是什么形状？”），
    // 真正区分题目的是图形规格与参数，故按 form + 图形 + 参数 + 题干判重
    const keys = new Set(
      generated.items.map(
        (piece) => `${piece.form}|${JSON.stringify(piece.fig)}|${JSON.stringify(piece.params)}|${piece.text}`,
      ),
    )
    assert.equal(keys.size, 30, `${level} 同卷不得出现同图同题`)
    for (const piece of generated.items) {
      assert.deepEqual(verifyItemStructure(geomItem(piece)), [], `${level} ${piece.text}`)
      if (piece.unit) {
        assert.ok(piece.text.includes(piece.unit), `题干必须写单位：${piece.text}`)
        assert.ok(piece.text.includes(`多少${piece.unit}？`), `答案单位必须与题干一致：${piece.text}`)
      }
      assert.ok(typeof piece.fig === 'object', '必须带动态图形规格')
    }
  }
})

test('图形与周长：新增配方逐题标注足够、独立重算通过', () => {
  const newForms = [
    'triangle-perimeter',
    'isosceles-triangle-perimeter',
    'equilateral-triangle-perimeter',
    'parallelogram-perimeter',
    'trapezoid-perimeter',
    'lshape-perimeter',
    'concave-perimeter',
    'staircase-perimeter',
    't-shape-perimeter',
    'join-squares-perimeter',
    'grid-perimeter',
  ]
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateGeom({ grade: '3A', unitIds: ['3A-U6'], level, count: 40, seed: 20261105 })
    for (const piece of generated.items) {
      assert.deepEqual(geomMissingLabels(piece), [], `${piece.form} 图上标注不足：${JSON.stringify(piece.params)}`)
      assert.deepEqual(verifyItemStructure(geomItem(piece)), [], `${piece.form} 复核未过：${piece.text}`)
    }
  }
  // 三档合起来应当把全部拓展配方都轮到（三角形在 L1/L2，其余多在 L3）
  const forms = new Set<string>()
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateGeom({ grade: '3A', unitIds: ['3A-U6'], level, count: 120, seed: 20261105 })
    for (const piece of generated.items) forms.add(piece.form)
  }
  for (const form of newForms) assert.ok(forms.has(form), `L1–L3 应覆盖 ${form}`)
})

test('图形与周长：信息不足必须被拒', () => {
  const piece = generateGeom({ grade: '3A', unitIds: ['3A-U6'], level: 'L3', count: 120, seed: 20261105 }).items.find(
    (item) => item.form === 'trapezoid-perimeter',
  )
  assert.ok(piece, '应能生成梯形题')
  // 少标一条已知边 → 图上信息不足
  const broken = { ...piece, fig: { ...piece.fig, labels: (piece.fig.labels ?? []).slice(1) } }
  assert.notDeepEqual(geomMissingLabels(broken), [], '少标一条边必须被识别为信息不足')
  // 参数缺一条边 → 独立重算拒绝
  const incomplete = {
    ...geomItem(piece),
    audit: { form: piece.form, answer: piece.answer, params: { form: piece.form, a: piece.params.a } },
  }
  assert.ok(
    verifyItemStructure(incomplete).some((issue) => issue.includes('无法重算')),
    '缺参数时复核必须拒绝而不是默认通过',
  )
})

test('图形与周长：L1 只给条件求周长/认识图形，L3 含拼合/倍数关系', () => {
  const l1 = new Set(generateGeom({ grade: '3A', unitIds: UNITS_3A, level: 'L1', count: 10, seed: 3 }).items.map((p) => p.form))
  const l3 = new Set(generateGeom({ grade: '3A', unitIds: UNITS_3A, level: 'L3', count: 10, seed: 3 }).items.map((p) => p.form))
  assert.deepEqual([...l1].sort(), ['count-shapes', 'recognize-name', 'rect-perimeter', 'square-perimeter', 'triangle-perimeter'])
  assert.ok(l3.has('combine'), 'L3 必须出现拼合后周长')
  assert.ok(l3.has('ratio'), 'L3 必须出现长是宽的几倍')
  assert.ok(!l1.has('combine'), 'L1 不应出现拼合题')
})

test('图形与周长：只在所选单元内出图，不含 U3/U6 时不出', () => {
  const u1Only = generateGeom({ grade: '3A', unitIds: ['3A-U1'], level: 'L2', count: 10, seed: 9 })
  assert.equal(u1Only.items.length, 0)
  assert.ok(u1Only.notes.some((note) => note.includes('不含认识图形')))

  const u3Only = generateGeom({ grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 10, seed: 9 })
  const u3Forms = new Set(u3Only.items.map((piece) => piece.form))
  assert.deepEqual([...u3Forms].sort(), ['classify', 'count-shapes', 'recognize-name'])

  const u6Only = generateGeom({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 10, seed: 9 })
  const u6Forms = new Set(u6Only.items.map((piece) => piece.form))
  assert.ok([...u6Forms].every((form) => !['classify', 'count-shapes', 'recognize-name'].includes(form)))
})

test('复核拦截：篡改比大小/图形答案会被独立重算拦住', () => {
  const cmp = generateCompare({ grade: '3A', unitIds: UNITS_3A, level: 'L3', count: 1, seed: 5 }).items[0]
  const wrongCmp = { ...compareItem(cmp), audit: { form: cmp.form, answer: cmp.answer === '<' ? '>' : '<', params: {} } }
  assert.ok(verifyItemStructure(wrongCmp).some((issue) => issue.includes('比大小答案不符')))

  const geo = generateGeom({ grade: '3A', unitIds: UNITS_3A, level: 'L2', count: 1, seed: 5 }).items[0]
  const wrongGeo = { ...geomItem(geo), audit: { form: geo.form, answer: String(Number(geo.answer) + 1), params: { ...geo.params, unit: geo.unit } } }
  assert.ok(verifyItemStructure(wrongGeo).some((issue) => issue.includes('图形题答案不符')))

  const mixedUnit = { ...geomItem(geo), audit: { form: geo.form, answer: geo.answer, params: { ...geo.params, unit: '米' } } }
  if (!geo.text.includes('米')) {
    assert.ok(verifyItemStructure(mixedUnit).some((issue) => issue.includes('题干单位与答案单位不一致')))
  }
})

test('接线：比大小/图形走规则库，30 题出满且复核零剔除', () => {
  const base: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: UNITS_3A, level: 'L2', count: 30 }

  for (const type of ['compare', 'geom'] as const) {
    const config: AppConfig = { ...base, types: [type] }
    const availability = typeAvailability(config, TEMPLATE)
    assert.equal(availability[type].source, 'rule', `${type} 应标记为规则库`)
    const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
    assert.equal(result.count, 30, `${type} 应出满 30 题`)
    assert.equal(result.shortage, false, `${type} 不应题量不足`)
    assert.equal(result.stats.duplicates, 0, `${type} 同卷不得重复`)
    assert.equal(result.stats.runtimeCheck.dropped, 0, `${type} 正常出卷不应剔除`)
    const items = result.data.sections.flatMap((section) => section.items)
    assert.equal(items.length, 30)
    for (const item of items) assert.deepEqual(verifyItemStructure(item), [])
  }
})

test('接线：所选单元不含图形内容时不出图形题，并在界面写清原因', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U1'], level: 'L2', types: ['geom'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.geom.enabled, false)
  assert.ok(availability.geom.reason.includes('不含认识图形'))
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
  assert.equal(result.count, 0)
  assert.ok(result.skipped.includes('geom'))
})

test('接线：所选单元与比大小无对应内容时不出比大小题', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U6'], level: 'L2', types: ['compare'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.compare.enabled, false)
  assert.ok(availability.compare.reason.includes('比大小'))
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
  assert.equal(result.count, 0)
  assert.ok(result.skipped.includes('compare'))
})
