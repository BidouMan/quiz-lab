import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore } from '../src/quiz/memory.ts'
import { buildChinesePaper } from '../src/chinese/build.ts'
import type { ChinesePaperConfig, ChinesePaperMemory } from '../src/chinese/types.ts'

const makeConfig = (
  count: number,
  seed: number,
  memory?: ChinesePaperMemory,
): ChinesePaperConfig => ({
  version: 1,
  grade: '3A',
  title: '测试卷',
  seed,
  difficulty: 'mixed',
  totalItems: count,
  sections: [{ typeId: 'gaibing', count, perItemScore: 2 }],
  includeAnswers: true,
  ...(memory ? { memory } : {}),
})

/** 模拟界面出卷：领卷号 → 出卷 → 把本卷用到的题写回记忆 */
function runRound(store: MemoryStore, count: number, seed: number) {
  const paper = buildChinesePaper(
    makeConfig(count, seed, { paper: store.beginPaper(), entries: store.data.entries }),
  )
  for (const key of paper.usedKeys) store.record(key)
  return paper
}

test('跨卷记忆：连续出卷优先新题，重复比例约两成', () => {
  const store = new MemoryStore()
  const seen = new Map<string, number>()
  let total = 0
  for (let round = 0; round < 6; round += 1) {
    const paper = runRound(store, 6, 100 + round)
    assert.equal(paper.items.length, 6, '每卷应出满 6 道')
    for (const key of paper.usedKeys) {
      seen.set(key, (seen.get(key) ?? 0) + 1)
      total += 1
    }
  }
  const repeated = total - seen.size
  assert.ok(seen.size >= 30, `六卷只覆盖 ${seen.size} 道，新题优先级没生效`)
  assert.ok(
    repeated <= Math.ceil(total * 0.2),
    `重复 ${repeated} 道，超过 20% 的巩固额度`,
  )
})

test('跨卷记忆：池子轮完后按最久没出过的题开始新一轮', () => {
  const store = new MemoryStore()
  // 修改病句题库当前 48 条；跑满一轮后再看新一轮怎么排
  const poolSize = 48
  let guard = 0
  while (Object.keys(store.data.entries).length < poolSize && guard < 60) {
    runRound(store, 8, 200 + guard)
    guard += 1
  }
  assert.ok(Object.keys(store.data.entries).length >= poolSize, `一轮没跑满 ${poolSize} 道`)

  // 深拷贝快照：record 会就地改 entry，浅拷贝拿不到出卷前的值
  const before = Object.fromEntries(
    Object.entries(store.data.entries).map(([key, entry]) => [key, { ...entry }]),
  )
  const paper = runRound(store, 8, 300)
  // 用出卷前的快照比较：选中的应是 lastPaper 最小的那批
  const picked = paper.usedKeys.map((key) => before[key]!.lastPaper)
  const rest = Object.keys(before)
    .filter((key) => !paper.usedKeys.includes(key))
    .map((key) => before[key]!.lastPaper)
  assert.equal(paper.items.length, 8, '轮完后应能出满')
  assert.ok(
    Math.max(...picked) <= Math.min(...rest),
    '新一轮没有优先排最久没出过的题',
  )
})

test('跨卷记忆：不传 memory 时仍是原来的随机抽题，同种子可复现', () => {
  const first = buildChinesePaper(makeConfig(6, 42))
  const second = buildChinesePaper(makeConfig(6, 42))
  assert.deepEqual(first.usedKeys, second.usedKeys)
  assert.equal(first.usedKeys.length, 6)
})

test('跨卷记忆：usedKeys 与卷面题一一对应，写回后记为当前卷', () => {
  const store = new MemoryStore()
  const paper = runRound(store, 6, 7)
  assert.equal(paper.usedKeys.length, paper.items.length)
  assert.equal(new Set(paper.usedKeys).size, paper.usedKeys.length, '本卷出现重复题')
  for (const key of paper.usedKeys) {
    assert.equal(store.data.entries[key]?.lastPaper, 1)
  }
})

test('跨卷记忆：冷却期内同一道题不重复，期满后才再次出现', () => {
  // 修改病句的冷却期是 8 卷
  const COOLDOWN = 8
  const store = new MemoryStore()
  const lastSeen = new Map<string, number>()
  for (let round = 0; round < 20; round += 1) {
    const paper = runRound(store, 4, 400 + round)
    const paperNo = store.data.papers
    for (const key of paper.usedKeys) {
      const seenAt = lastSeen.get(key)
      if (seenAt !== undefined) {
        assert.ok(
          paperNo - seenAt >= COOLDOWN,
          `${key} 在 ${paperNo - seenAt} 卷内重复，短于冷却期 ${COOLDOWN}`,
        )
      }
      lastSeen.set(key, paperNo)
    }
  }
  assert.ok(lastSeen.size >= 40, `20 卷只覆盖 ${lastSeen.size} 道，供给不足`)
})
