import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPaper, migrateCounts } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7']

function build(config: AppConfig, seed = 1) {
  return buildPaper({ config, template: TEMPLATE, seed, memory: new MemoryStore(), mode: 'practice' })
}

test('逐题型配额求和：总题数 = 各勾选题型设定之和', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    types: ['kousuan', 'tiankong', 'word'],
    counts: { kousuan: 20, tiankong: 8, word: 6 },
  }
  const result = build(config, 7)
  assert.equal(result.stats.requested, 34)
  assert.equal(result.count, 34)
  assert.equal(result.shortage, false)
  const stats = new Map(result.stats.typeStats.map((row) => [row.type, row]))
  assert.equal(stats.get('kousuan')?.requested, 20)
  assert.equal(stats.get('kousuan')?.actual, 20)
  assert.equal(stats.get('tiankong')?.actual, 8)
  assert.equal(stats.get('word')?.actual, 6)
})

test('0 或留空 = 不出该题型，也不占位', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    types: ['kousuan', 'tiankong'],
    counts: { kousuan: 0, tiankong: 5 },
  }
  const result = build(config)
  assert.equal(result.count, 5)
  assert.equal(result.stats.requested, 5)
  const stats = new Map(result.stats.typeStats.map((row) => [row.type, row]))
  assert.equal(stats.get('kousuan')?.actual, 0)
  assert.equal(stats.get('tiankong')?.actual, 5)
  assert.ok(!result.data.sections.some((section) => section.type === 'kousuan'))
})

test('均衡分配：11 题分到 3 个单元为 4/4/3，不强制绝对平均', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U1', '3A-U2', '3A-U4'],
    level: 'L2',
    types: ['kousuan'],
    counts: { kousuan: 11 },
  }
  const result = build(config, 3)
  assert.equal(result.count, 11)
  const perUnit = new Map<string, number>()
  for (const section of result.data.sections) {
    for (const item of section.items) {
      const unitId = item.id.split('-').slice(0, 2).join('-')
      perUnit.set(unitId, (perUnit.get(unitId) ?? 0) + 1)
    }
  }
  const counts = [...perUnit.values()].sort((a, b) => a - b)
  assert.deepEqual(counts, [3, 4, 4], `实际每单元: ${JSON.stringify([...perUnit])}`)
})

test('旧配置兼容：只有 count 时按默认权重映射，求和等于旧 count 且不崩', () => {
  const counts = migrateCounts(30, ['kousuan', 'tiankong', 'word'])
  const sum = ['kousuan', 'tiankong', 'word'].reduce((total, type) => total + (counts[type] ?? 0), 0)
  assert.equal(sum, 30)
  assert.ok((counts.kousuan ?? 0) >= (counts.word ?? 0), '口算权重应高于应用题')

  // 不带 counts 的老配置仍走兼容分配，不应报错
  const legacy: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    types: ['kousuan', 'tiankong', 'word'],
    count: 20,
  }
  const result = buildPaper({ config: legacy, template: TEMPLATE, seed: 5, memory: new MemoryStore() })
  assert.equal(result.count, 20)
  assert.equal(result.stats.requested, 20)
})

test('超过 200 题被引擎夹取，并在 notes 如实说明', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    types: ['kousuan', 'tiankong'],
    counts: { kousuan: 999, tiankong: 8 },
  }
  const result = build(config, 11)
  assert.equal(result.stats.requested, 208)
  const stats = new Map(result.stats.typeStats.map((row) => [row.type, row]))
  assert.equal(stats.get('kousuan')?.requested, 200)
  assert.equal(stats.get('kousuan')?.actual, 200)
  assert.ok(result.notes.some((note) => note.includes('单题型上限 200 题') && note.includes('999→200')))
})

test('旧配置迁移后每个题型都不超过 200', () => {
  const threeTypes = migrateCounts(999, ['kousuan', 'tiankong', 'word'])
  assert.ok(Object.values(threeTypes).every((value) => (value ?? 0) <= 200))
  assert.ok(Object.values(threeTypes).reduce((sum, value) => sum + (value ?? 0), 0) <= 600)

  const oneType = migrateCounts(999, ['kousuan'])
  assert.equal(oneType.kousuan, 200)
})

test('题型未达设定时如实报缺，不静默少出', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U3'],
    level: 'L1',
    types: ['kousuan', 'geom'],
    counts: { kousuan: 10, geom: 100 },
  }
  const result = build(config)
  // U3 没有口算规则 → 该题型不适用，不计入 requested（方案 A：单元说了算）
  assert.equal(result.stats.typeStats.find((row) => row.type === 'kousuan')?.requested ?? 0, 0)
  // 图形题在 U3 L1 只有有限的不重复题目，要求 100 时应如实报缺
  assert.equal(result.stats.requested, 100)
  assert.ok(result.count < 100)
  assert.equal(result.shortage, true)
  const geom = result.stats.typeStats.find((row) => row.type === 'geom')
  assert.ok(geom != null && geom.actual < geom.requested, '应写明该题型未达设定')
})
