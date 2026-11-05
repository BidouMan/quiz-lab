import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  angleKey,
  angleSupported,
  generateAngle,
  makeAddLineAngles,
  makeClassifyAngles,
  makeCountRectangles,
  makeCountTriangles,
  makePointAngles,
  type AnglePiece,
} from '../src/quiz/angle.ts'
import { createRng } from '../src/quiz/rng.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo, type TypstItem } from '../src/app/types.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8', '3A-U9']

const toItem = (piece: AnglePiece): TypstItem => ({
  id: 'ang',
  kind: 'geom',
  text: piece.text,
  fig: piece.fig,
  blank: piece.blank,
  audit: { form: piece.form, answer: piece.answer, params: piece.params },
})

const combination = (n: number, k: number): number => {
  let value = 1
  for (let index = 1; index <= k; index++) value = (value * (n - k + index)) / index
  return value
}

test('角与图形计数：三档各 20 题不重复，逐题复核通过', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const generated = generateAngle({ grade: '3A', unitIds: ['3A-U3'], level, count: 20, seed: 20261105 })
    assert.equal(generated.items.length, 20, `${level} 应出满 20 题`)
    assert.equal(new Set(generated.items.map(angleKey)).size, 20, `${level} 同卷不得重复`)
    const forms = new Set(generated.items.map((piece) => piece.form))
    assert.ok(forms.has('point-angles') && forms.has('classify-angles') && forms.has('add-line-angles'))
    for (const piece of generated.items) {
      assert.deepEqual(verifyItemStructure(toItem(piece)), [], `${level} ${piece.text}`)
    }
  }
})

test('一点数角：答案唯一且等于 C(n,2)', () => {
  const rng = createRng(31)
  const seen = new Map<number, string>()
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const piece = makePointAngles(rng, level)
      const n = Number(piece.params.n)
      assert.ok(n >= 3 && n <= 9)
      assert.equal(piece.answer, String(combination(n, 2)))
      seen.set(n, piece.answer)
    }
  }
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9])
})

test('角的分类：三类计数与直角符号/开口弧线数量一致', () => {
  const rng = createRng(77)
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const piece = makeClassifyAngles(rng, level)
      const degrees = String(piece.params.angles).split(',').map(Number)
      const right = degrees.filter((degree) => degree === 90).length
      const acute = degrees.filter((degree) => degree < 90).length
      const obtuse = degrees.filter((degree) => degree > 90).length
      assert.equal(piece.answer, `${right}，${acute}，${obtuse}`)
      assert.equal(degrees.length, right + acute + obtuse)
      const squares = piece.fig.shapes.filter((shape) => shape.points.length === 3 && shape.stroke === 'thin').length
      const arcs = piece.fig.shapes.filter((shape) => shape.points.length > 3 && shape.stroke === 'thin').length
      assert.equal(squares, right, '每个直角都必须画直角符号')
      assert.equal(arcs, degrees.length - right, '非直角都必须画开口弧线')
      assert.deepEqual(verifyItemStructure(toItem(piece)), [])
    }
  }
})

test('添线数角：增加数 = m，总数 = C(m+1,2)', () => {
  const rng = createRng(99)
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const piece = makeAddLineAngles(rng, level)
      const m = Number(piece.params.m)
      const expected = piece.params.ask === 'added' ? m : combination(m + 1, 2)
      assert.equal(piece.answer, String(expected))
      assert.deepEqual(verifyItemStructure(toItem(piece)), [])
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
    assert.deepEqual(verifyItemStructure(toItem(triangle)), [])

    const rectangle = makeCountRectangles(rng)
    const m = Number(rectangle.params.m)
    const n = Number(rectangle.params.n)
    assert.equal(rectangle.answer, String(combination(m + 1, 2) * combination(n + 1, 2)))
    assert.deepEqual(verifyItemStructure(toItem(rectangle)), [])
    rectangleKeys.add(angleKey(rectangle))
  }
  assert.equal(rectangleKeys.size, 10, '2–5 的完整方格网应有 10 种（旋转视为同一种）')
})

test('角与图形计数：只在三上 U3 出题，其他单元明确跳过', () => {
  assert.equal(angleSupported('3A', ['3A-U3']), true)
  assert.equal(angleSupported('3A', ['3A-U6']), false)
  assert.equal(angleSupported('3B', ['3B-U1']), false)

  const u6 = generateAngle({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 10, seed: 5 })
  assert.equal(u6.items.length, 0)
  assert.ok(u6.notes.some((note) => note.includes('U3')))
})

test('接线：角与图形计数进入题型列表并按单元出卷', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U3'],
    level: 'L2',
    types: ['angle'],
    count: 20,
  }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.angle.enabled, true)
  assert.equal(availability.angle.source, 'rule')
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory: new MemoryStore() })
  assert.equal(result.count, 20)
  assert.equal(result.shortage, false)
  assert.equal(result.stats.duplicates, 0)
  assert.equal(result.stats.runtimeCheck.dropped, 0)
  const items = result.data.sections.flatMap((section) => section.items)
  assert.equal(items.length, 20)
  for (const item of items) assert.deepEqual(verifyItemStructure(item), [])

  const u6: AppConfig = { ...config, unitIds: ['3A-U6'] }
  const u6Availability = typeAvailability(u6, TEMPLATE)
  assert.equal(u6Availability.angle.enabled, false)
  const u6Result = buildPaper({ config: u6, template: TEMPLATE, seed: 20261105, memory: new MemoryStore() })
  assert.equal(u6Result.count, 0)
  assert.ok(u6Result.skipped.includes('angle'))
})
