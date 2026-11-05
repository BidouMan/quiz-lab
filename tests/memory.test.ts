import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_MEMORY_ENTRIES, MemoryStore, RECENT_WINDOW } from '../src/quiz/memory.ts'
import { buildPaper } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG } from '../src/app/types.ts'
import type { AppConfig, TemplateInfo } from '../src/app/types.ts'

const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7']

test('记忆写入/读取：卷号、次数、最近卷号可往返', () => {
  const store = new MemoryStore()
  assert.equal(store.beginPaper(), 1)
  store.record('calc:2+3')
  assert.equal(store.usage('calc:2+3'), 1)
  assert.equal(store.lastPaper('calc:2+3'), 1)
  assert.equal(store.beginPaper(), 2)
  store.record('calc:2+3')
  assert.equal(store.usage('calc:2+3'), 2)
  assert.equal(store.lastPaper('calc:2+3'), 2)

  const restored = MemoryStore.fromJSON(store.toJSON())
  assert.equal(restored.data.papers, 2)
  assert.equal(restored.usage('calc:2+3'), 2)
  assert.equal(restored.lastPaper('calc:2+3'), 2)
  assert.equal(restored.usage('never-used'), 0)
  assert.equal(restored.lastPaper('never-used'), 0)
})

test('最近窗口：窗口边界按卷号计算，刚好 N 卷前可再次出现', () => {
  const store = new MemoryStore({
    papers: 10,
    entries: {
      edge: { count: 1, lastPaper: 10 - RECENT_WINDOW },
      hot: { count: 1, lastPaper: 10 - RECENT_WINDOW + 1 },
      old: { count: 1, lastPaper: 1 },
    },
  })
  assert.equal(store.recentlyUsed('edge'), false, `第 ${RECENT_WINDOW} 卷前出现视为已冷却`)
  assert.equal(store.recentlyUsed('hot'), true)
  assert.equal(store.recentlyUsed('old'), false)
  assert.equal(store.recentlyUsed('never-used'), false)
})

test('LRU 依据：lastPaper 越小越久未用', () => {
  const store = new MemoryStore({
    papers: 5,
    entries: {
      a: { count: 1, lastPaper: 1 },
      b: { count: 3, lastPaper: 4 },
    },
  })
  assert.ok(store.lastPaper('a') < store.lastPaper('b'))
  assert.equal(store.usage('a'), 1)
})

test('体积上限：超出条目上限时按最久未用裁剪，保留最新条目', () => {
  const entries: Record<string, { count: number; lastPaper: number }> = {}
  for (let index = 0; index < 5; index++) entries[`k${index}`] = { count: 1, lastPaper: index + 1 }
  const store = new MemoryStore({ papers: 5, entries })
  store.prune(3)
  assert.deepEqual(Object.keys(store.data.entries).sort(), ['k2', 'k3', 'k4'])
  assert.ok(MAX_MEMORY_ENTRIES >= 1000, '默认上限应能容纳长期使用')

  const huge = new MemoryStore({ papers: 100, entries })
  huge.prune(MAX_MEMORY_ENTRIES)
  assert.equal(huge.size(), 5, '未超上限不应裁剪')
})

test('损坏容错：非法 JSON / 错误结构 / 脏条目都按空记忆重建，不抛错', () => {
  for (const text of ['{bad json', '[]', 'null', '"text"']) {
    const store = MemoryStore.fromJSON(text)
    assert.equal(store.size(), 0)
    assert.equal(store.data.papers, 0)
    assert.equal(store.beginPaper(), 1)
    store.record('calc:1+1')
    assert.equal(store.usage('calc:1+1'), 1)
  }

  const dirty = MemoryStore.fromJSON(
    JSON.stringify({ version: 1, papers: 'NaN', entries: { good: { count: 2, lastPaper: 3 }, bad: {} } }),
  )
  assert.equal(dirty.data.papers, 0)
  assert.equal(dirty.usage('good'), 2)
  assert.equal(dirty.usage('bad'), 0)
})

test('耗尽标注：记忆池全部命中时不少出题，跨卷复用计数并写入 notes', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L1',
    types: ['geom'],
    count: 20,
  }
  const memory = new MemoryStore()
  // 模拟“上一卷已出过、最近窗口内所有候选都命中”：强制 recentlyUsed 恒真，
  // 并把 lastPaper 固定为上一卷（本卷内复用不计入跨卷复用）
  memory.data.papers = 2
  memory.recentlyUsed = () => true
  memory.lastPaper = () => 1
  memory.record = () => {}

  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory })
  assert.equal(result.count, 20, '池子耗尽也必须出满题，禁止少出题')
  assert.equal(result.shortage, false)
  assert.equal(result.stats.crossReused, 20)
  assert.ok(
    result.notes.some((note) => note.includes('跨卷复用 20 题')),
    `应在 notes 标注跨卷复用，实际: ${result.notes.join(' / ')}`,
  )
})
