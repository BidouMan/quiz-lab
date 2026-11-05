import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONCEPT_PROPOSITIONS } from '../src/quiz/concepts.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { generateFormat, verifyFormatSource } from '../src/quiz/formats.ts'

const LEVELS = ['L1', 'L2', 'L3'] as const

/** generateFormat 记录的是来源 key；piece.key 带 fmt 前缀，写记忆时要去掉 */
const sourceKeyOf = (piece: { key: string }): string => piece.key.replace(/^fmt:(judge|choice):/, '')

test('U5 判断题三档各 30 题，真 15 / 假 15、复核全过', () => {
  for (const [index, level] of LEVELS.entries()) {
    const result = generateFormat({
      kind: 'judge',
      grade: '3A',
      unitIds: ['3A-U5'],
      level,
      count: 30,
      seed: 20261105 + index,
    })
    assert.equal(result.pieces.length, 30, `${level} 实出 ${result.pieces.length}`)
    assert.equal(result.pieces.filter((piece) => piece.truth).length, 15)
    assert.equal(result.pieces.filter((piece) => !piece.truth).length, 15)
    assert.equal(new Set(result.pieces.map((piece) => piece.key)).size, 30)
    assert.equal(new Set(result.pieces.map((piece) => piece.stem)).size, 30)
    for (const piece of result.pieces) {
      const verified = verifyFormatSource(piece.data)
      assert.ok(verified.ok, `${piece.key} 复核失败：${verified.error}`)
    }
  }
})

test('U5 判断题连续两卷零复用', () => {
  const memory = new MemoryStore()
  const first = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U5'], level: 'L3', count: 30, seed: 3 })
  memory.beginPaper()
  for (const piece of first.pieces) memory.record(sourceKeyOf(piece))
  const second = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U5'], level: 'L3', count: 30, seed: 4, memory })
  assert.equal(second.pieces.length, 30)
  assert.equal(second.crossReused, 0)
  const firstKeys = new Set(first.pieces.map((piece) => piece.key))
  assert.equal(second.pieces.filter((piece) => firstKeys.has(piece.key)).length, 0)
})

test('U5 事实命题 13 条，知识点唯一、真假均衡', () => {
  const facts = CONCEPT_PROPOSITIONS.filter((record) => record.unitId === '3A-U5')
  assert.equal(facts.length, 13)
  assert.equal(new Set(facts.map((record) => record.knowledgePoint)).size, 13)
  assert.equal(facts.filter((record) => record.truth).length, 7)
  assert.equal(facts.filter((record) => !record.truth).length, 6)
  for (const record of facts) {
    assert.equal(record.levels.length, 3, `${record.id} 未覆盖三档`)
  }
})
