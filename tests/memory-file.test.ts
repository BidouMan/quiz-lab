import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MAX_MEMORY_BYTES, MemoryStore } from '../src/quiz/memory.ts'
import { loadMemoryFile, saveMemoryFile } from '../src/quiz/memoryFile.ts'
import { buildPaper } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'

const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

const CONFIG: AppConfig = {
  ...DEFAULT_CONFIG,
  grade: '3A',
  unitIds: ['3A-U1'],
  level: 'L2',
  types: ['kousuan'],
  count: 8,
}

const NOW = new Date(2026, 10, 5, 10, 15, 0)

function makeDir() {
  return mkdtempSync(join(tmpdir(), 'quizlab-mem-'))
}

/** 损坏场景统一断言：不抛异常、有备份、能继续出题 */
function assertRecovered(content: string, label: string) {
  const dir = makeDir()
  const path = join(dir, 'gen-memory.json')
  writeFileSync(path, content)

  let loaded!: ReturnType<typeof loadMemoryFile>
  assert.doesNotThrow(() => {
    loaded = loadMemoryFile(path, NOW)
  }, `${label}：读取不应抛异常`)

  assert.equal(loaded.status, 'recovered', `${label}：应判为损坏`)
  assert.ok(loaded.reason, `${label}：应记录损坏原因`)
  assert.ok(loaded.notice?.includes('出题记录读不出来'), `${label}：应给出家长可读提示`)
  assert.equal(loaded.store.size(), 0, `${label}：应重建为空记忆`)
  assert.equal(loaded.store.beginPaper(), 1, `${label}：重建后应能开启新卷`)

  const backups = readdirSync(dir).filter((name) => name.includes('.corrupt-20261105T101500'))
  assert.equal(backups.length, 1, `${label}：应生成带时间戳的备份`)
  assert.equal(readFileSync(join(dir, backups[0]), 'utf8'), content, `${label}：备份应是原文`)

  const result = buildPaper({ config: CONFIG, template: TEMPLATE, seed: 20261105, memory: loaded.store })
  assert.ok(result.count > 0, `${label}：恢复后应能继续出题`)
  assert.equal(result.count, CONFIG.count, `${label}：应能出满题量`)

  rmSync(dir, { recursive: true, force: true })
}

test('损坏恢复 1/5：空文件', () => {
  assertRecovered('', '空文件')
})

test('损坏恢复 2/5：超大文件', () => {
  assertRecovered('x'.repeat(MAX_MEMORY_BYTES + 1024), '超大文件')
})

test('损坏恢复 3/5：缺字段', () => {
  assertRecovered(JSON.stringify({ papers: 3, entries: { 'calc:1+1': { count: 1, lastPaper: 3 } } }), '缺 version')
})

test('损坏恢复 4/5：字段类型错', () => {
  assertRecovered(
    JSON.stringify({ version: 1, papers: 3, entries: { 'calc:1+1': { count: '2', lastPaper: 3 } } }),
    'count 为字符串',
  )
})

test('损坏恢复 5/5：JSON 截断', () => {
  const full = new MemoryStore({ papers: 3, entries: { 'calc:1+1': { count: 1, lastPaper: 3 } } }).toJSON()
  assertRecovered(full.slice(0, Math.floor(full.length / 2)), '截断一半')
})

test('正常往返：原子写后读取无备份、无残留临时文件', () => {
  const dir = makeDir()
  const path = join(dir, 'gen-memory.json')
  const store = new MemoryStore({ papers: 4, entries: { 'calc:2+3': { count: 2, lastPaper: 4 } } })
  saveMemoryFile(path, store)

  assert.deepEqual(readdirSync(dir).sort(), ['gen-memory.json'], '原子写不应残留临时文件')
  const loaded = loadMemoryFile(path, NOW)
  assert.equal(loaded.status, 'ok')
  assert.equal(loaded.notice, undefined)
  assert.equal(loaded.store.data.papers, 4)
  assert.equal(loaded.store.usage('calc:2+3'), 2)

  rmSync(dir, { recursive: true, force: true })
})

test('文件不存在：按空记忆开始，不产生备份', () => {
  const dir = makeDir()
  const path = join(dir, 'gen-memory.json')
  const loaded = loadMemoryFile(path, NOW)
  assert.equal(loaded.status, 'ok')
  assert.equal(loaded.notice, undefined)
  assert.equal(loaded.store.beginPaper(), 1)
  assert.equal(existsSync(path), false)
  assert.equal(readdirSync(dir).length, 0)

  rmSync(dir, { recursive: true, force: true })
})
