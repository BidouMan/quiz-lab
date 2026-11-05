import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateCompare } from '../src/quiz/compare.ts'
import { generateGeom, geomMissingLabels } from '../src/quiz/geom.ts'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo, type TypstItem } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7']
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

  // 只勾「周长」：出同量纲的周长比较（长方形 vs 正方形）
  const perimeter = generateCompare({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 30, seed: 42 })
  assert.equal(perimeter.items.length, 30)
  assert.deepEqual([...new Set(perimeter.items.map((piece) => piece.form))].sort(), ['perimeterFormula'])
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
  assert.deepEqual(
    [...l1].sort(),
    [
      'count-rectangles',
      'count-shapes',
      'count-triangles',
      'recognize-name',
      'rect-perimeter',
      'square-perimeter',
      'triangle-perimeter',
    ],
  )
  assert.ok(l3.has('combine'), 'L3 必须出现拼合后周长')
  assert.ok(l3.has('ratio'), 'L3 必须出现长是宽的几倍')
  assert.ok(!l1.has('combine'), 'L1 不应出现拼合题')
})

const combination2 = (n: number): number => (n * (n - 1)) / 2

test('数图形：U3 三档出满各自形态池，数图形答案只按 k / m,n 独立重算', () => {
  // U8 并入后，U3 的独有形态池：L1/L2 可出 30 道，L3 只有 sticks/compose/classify/数图形 四类，上限 25
  const capacity: Record<'L1' | 'L2' | 'L3', number> = { L1: 30, L2: 30, L3: 25 }
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateGeom({ grade: '3A', unitIds: ['3A-U3'], level, count: 30, seed: 20261105 })
    assert.equal(generated.items.length, capacity[level], `${level} U3 应出满 ${capacity[level]} 题`)
    const counts = generated.items.filter((piece) => piece.form === 'count-triangles' || piece.form === 'count-rectangles')
    assert.ok(counts.length >= 2, `${level} U3 应至少出两道数图形`)
    const keys = new Set(counts.map((piece) => `${piece.form}|${JSON.stringify(piece.fig)}`))
    assert.equal(keys.size, counts.length, `${level} 同卷不得出现同图`)
    for (const piece of counts) {
      if (piece.form === 'count-triangles') {
        const k = Number(piece.params.k)
        assert.equal(piece.answer, String(combination2(k + 2)), `数三角形答案应由 k 独立重算：${piece.text}`)
      } else {
        const m = Number(piece.params.m)
        const n = Number(piece.params.n)
        assert.equal(
          piece.answer,
          String(combination2(m + 1) * combination2(n + 1)),
          `数长方形答案应由 m,n 独立重算：${piece.text}`,
        )
      }
      assert.deepEqual(verifyItemStructure(geomItem(piece)), [], `${level} ${piece.text}`)
      assert.equal(piece.unit, '', '数图形不带长度单位')
    }
  }
})

test('数图形：U3 跨卷去重生效，第二卷不复用第一卷的图', () => {
  const memory = new MemoryStore()
  memory.beginPaper()
  const first = generateGeom({ grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 10, seed: 11, memory })
  const firstKeys = new Set(first.items.map((piece) => `${piece.form}|${JSON.stringify(piece.fig)}|${JSON.stringify(piece.params)}`))
  memory.beginPaper()
  const second = generateGeom({ grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 10, seed: 12, memory })
  const secondKeys = second.items.map((piece) => `${piece.form}|${JSON.stringify(piece.fig)}|${JSON.stringify(piece.params)}`)
  assert.equal(second.items.length, 10, '第二卷仍应出满 10 题')
  assert.ok(secondKeys.every((key) => !firstKeys.has(key)), '跨卷不得复用上一卷的图形题')
  for (const piece of second.items) assert.deepEqual(verifyItemStructure(geomItem(piece)), [])
})

test('数图形：U3+U6 组合按并集出图，认识图形与周长同卷', () => {
  const combo = generateGeom({ grade: '3A', unitIds: ['3A-U3', '3A-U6'], level: 'L2', count: 30, seed: 20261106 })
  assert.equal(combo.items.length, 30, 'U3+U6 应出满 30 题')
  const forms = new Set(combo.items.map((piece) => piece.form))
  assert.ok(forms.has('count-triangles'), '应含数三角形')
  assert.ok(forms.has('count-rectangles'), '应含数长方形')
  assert.ok(forms.has('rect-perimeter'), '应含周长题')
  assert.ok(forms.has('count-shapes'), '应含 U3 认识图形')
  for (const piece of combo.items) assert.deepEqual(verifyItemStructure(geomItem(piece)), [], `${piece.form} ${piece.text}`)
})

test('图形与周长：只在所选单元内出图，不含 U3/U6 时不出', () => {
  const u1Only = generateGeom({ grade: '3A', unitIds: ['3A-U1'], level: 'L2', count: 10, seed: 9 })
  assert.equal(u1Only.items.length, 0)
  assert.ok(u1Only.notes.some((note) => note.includes('不含认识图形')))

  const u3Only = generateGeom({ grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 10, seed: 9 })
  const u3Forms = u3Only.items.map((piece) => piece.form)
  for (const form of ['classify', 'count-shapes', 'recognize-name']) {
    assert.ok(u3Forms.includes(form), `U3 原有形态 ${form} 被挤掉`)
  }
  const u3Counts = u3Forms.filter((form) => form === 'count-triangles' || form === 'count-rectangles')
  assert.ok(u3Counts.length <= 2, `U3 数图形配额应为 2（10 题的 20%），实际 ${u3Counts.length}`)
  assert.ok(u3Counts.length >= 1, 'U3 应小配额开数图形')

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

test('接线：只选 U3 出比大小时明确写「本单元无比大小内容」，不静默出 0', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U3'], level: 'L2', types: ['compare'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.compare.enabled, false)
  assert.equal(availability.compare.source, 'na')
  assert.ok(availability.compare.reason.includes('本单元'), `原因应点明单元，实际：${availability.compare.reason}`)
  assert.ok(availability.compare.reason.includes('无比大小内容'), `原因应写明无比大小内容，实际：${availability.compare.reason}`)
})

test('比大小卷面：不编号、整组行内渲染、文字组每行最多 2 组', () => {
  const src = readFileSync(new URL('../typst/paper.typ', import.meta.url), 'utf8')
  const numbered = src.match(/#let numbered-kind\(kind\) = kind in \(([^)]*)\)/)
  assert.ok(numbered, '缺少 numbered-kind 定义')
  assert.ok(!numbered![1]!.includes('"compare"'), '比大小不应在 numbered-kind 中（卷面惯例不编号）')

  const branch = src.slice(src.indexOf('} else if it.kind == "compare"'), src.indexOf('} else if it.kind == "geom"'))
  assert.ok(branch.includes('compare-group(it)'), '比大小分支必须整组渲染')
  assert.ok(!branch.includes('qno-mark') && !branch.includes('(#no)'), '比大小分支不得输出题号')

  const group = src.slice(src.indexOf('#let compare-group'), src.indexOf('#let item-body'))
  assert.ok(group.includes('[○]') && !group.includes('radius: 50%'), '圆圈必须是文字字形，不能改回矢量框')

  assert.ok(src.includes('#let compare-flow'), '缺少按组装行逻辑')
  assert.ok(src.includes('measure(g).width'), '装行必须按实测宽度')
  assert.ok(src.includes('current-text >= 2'), '文字组必须限制每行最多 2 组')
  assert.ok(!src.includes('layout(size =>'), '不得用 layout 整节包死（会溢出页脚）')

  const flow = src.slice(src.indexOf('#let compare-flow'), src.indexOf('#let compare-only'))
  assert.ok(flow.includes('block(breakable: false'), '每行必须放在不可断行块内（组内不折行）')
  assert.ok(flow.includes('set par(justify: false'), '组内段落不得参与两端对齐折行')
})

test('比大小：U6 周长同量纲比较，答案由独立重算得到（L1/L2/L3）', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateCompare({ grade: '3A', unitIds: ['3A-U6'], level, count: 30, seed: 20261105 })
    assert.equal(generated.items.length, 30, `${level} 应出满 30 题`)
    const keys = new Set(generated.items.map((piece) => `${piece.pre}|${piece.post}`))
    assert.equal(keys.size, 30, `${level} 同卷不得重复`)
    for (const piece of generated.items) {
      // 只按题面里的边长重算，不信生成器给出的答案
      const leftMatch = /\((\d+) \+ (\d+)\) times 2/.exec(piece.pre)
      assert.ok(leftMatch, `长方形周长必须是 (长+宽)×2：${piece.pre}`)
      const left = 2 * (Number(leftMatch[1]) + Number(leftMatch[2]))
      let right: number
      if (piece.form === 'perimeter') {
        const rightMatch = /\((\d+) \+ (\d+)\) times 2/.exec(piece.post)
        assert.ok(rightMatch, `正方形周长题面异常：${piece.post}`)
        right = 2 * (Number(rightMatch[1]) + Number(rightMatch[2]))
      } else {
        const rightMatch = /4 times (\d+)/.exec(piece.post)
        assert.ok(rightMatch, `正方形周长必须是 边长×4：${piece.post}`)
        right = 4 * Number(rightMatch[1])
      }
      const expected = left < right ? '<' : left > right ? '>' : '='
      assert.equal(piece.answer, expected, `${piece.pre} ? ${piece.post}`)
      assert.ok(left <= 160 && right <= 160, `周长应在三年级心算范围：${left} / ${right}`)
      assert.deepEqual(verifyItemStructure(compareItem(piece)), [], `${piece.pre} ? ${piece.post}`)
    }
  }
})

test('比大小：所选单元与比大小无对应内容时不出比大小题', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U3'], level: 'L2', types: ['compare'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.compare.enabled, false)
  assert.ok(availability.compare.reason.includes('比大小'))
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
  assert.equal(result.count, 0)
  assert.ok(result.skipped.includes('compare'))
})

test('接线：U6 只出比大小时可出满，且每题过运行时复核', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U6'], level: 'L2', types: ['compare'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.compare.enabled, true)
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
  assert.equal(result.count, 20)
  assert.equal(result.skipped.includes('compare'), false)
  assert.equal(result.stats.runtimeCheck.dropped, 0)
  for (const item of result.data.sections[0]!.items) {
    assert.ok(item.pre && item.post, '每题都要有左右式')
  }
})
