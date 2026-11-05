import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore } from '../src/quiz/memory.ts'
import { deriveWrongValues, generateFormat, verifyFormatSource } from '../src/quiz/formats.ts'

const LEVELS = ['L1', 'L2', 'L3'] as const

/** generateFormat 记录的是来源 key；piece.key 带 fmt 前缀，写记忆时要去掉 */
const sourceKeyOf = (piece: { key: string }): string => piece.key.replace(/^fmt:(judge|choice):/, '')

test('U5 选择题三档各 30 题，同量纲干扰值至少 3 个且复核全过', () => {
  for (const [index, level] of LEVELS.entries()) {
    const result = generateFormat({
      kind: 'choice',
      grade: '3A',
      unitIds: ['3A-U5'],
      level,
      count: 30,
      seed: 20261105 + index,
    })
    assert.equal(result.pieces.length, 30, `${level} 实出 ${result.pieces.length}`)
    assert.equal(new Set(result.pieces.map((piece) => piece.key)).size, 30)
    assert.equal(new Set(result.pieces.map((piece) => piece.stem)).size, 30)
    for (const piece of result.pieces) {
      const verified = verifyFormatSource(piece.data)
      assert.ok(verified.ok, `${piece.key} 复核失败：${verified.error}`)
      assert.equal(piece.options?.length, 4)
      assert.equal(new Set(piece.options).size, 4)
      assert.equal(new Set(piece.options).has(piece.data.correct), true)
      const wrongs = deriveWrongValues(piece.data)
      assert.ok(wrongs.length >= 3, `${piece.key} 同量纲干扰值不足 3 个`)
      assert.ok(wrongs.every((wrong) => wrong.value !== piece.answers[0]))
    }
  }
})

test('U5 选择题连续两卷零复用', () => {
  const memory = new MemoryStore()
  const first = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U5'], level: 'L3', count: 30, seed: 5 })
  memory.beginPaper()
  for (const piece of first.pieces) memory.record(sourceKeyOf(piece))
  const second = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U5'], level: 'L3', count: 30, seed: 6, memory })
  assert.equal(second.pieces.length, 30)
  assert.equal(second.crossReused, 0)
  const firstKeys = new Set(first.pieces.map((piece) => piece.key))
  assert.equal(second.pieces.filter((piece) => firstKeys.has(piece.key)).length, 0)
})
