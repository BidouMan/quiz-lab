import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore } from '../src/quiz/memory.ts'
import {
  deriveWrongValues,
  generateFormat,
  verifyFormatSource,
  type FormatSourceData,
} from '../src/quiz/formats.ts'

const LEVELS = ['L1', 'L2', 'L3'] as const

/** generateFormat 记录的是来源 key；piece.key 带 fmt 前缀，写记忆时要去掉 */
const sourceKeyOf = (piece: { key: string }): string => piece.key.replace(/^fmt:(judge|choice):/, '')

test('U4 选择题三档各 30 题，复核全过、选项不重复', () => {
  for (const [index, level] of LEVELS.entries()) {
    const result = generateFormat({
      kind: 'choice',
      grade: '3A',
      unitIds: ['3A-U4'],
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
      assert.equal(piece.options[piece.answerIndex ?? -1], piece.data.correct)
      assert.ok(deriveWrongValues(piece.data).length >= 3)
    }
    if (level !== 'L3') {
      const equalShare = result.pieces.filter((piece) => piece.data.params?.['kind'] === 'equalShare')
      assert.ok(equalShare.length > 0, `${level} 没有抽到等分除法来源`)
      for (const piece of equalShare) {
        const { dividend, divisor, quotient } = piece.data.params ?? {}
        assert.equal(Number(dividend) % Number(divisor), 0, `${piece.stem} 不能整除`)
        assert.equal(Number(quotient), Number(dividend) / Number(divisor))
        assert.equal(piece.data.correct, String(quotient))
      }
    }
  }
})

test('U4 选择题等分除法来源可独立重算，坏参数被拒', () => {
  const good: FormatSourceData = {
    pool: 'u4choice',
    form: 'equalShare',
    correct: '4',
    params: { kind: 'equalShare', dividend: 12, divisor: 3, quotient: 4 },
  }
  assert.equal(verifyFormatSource(good).ok, true)
  const wrongs = deriveWrongValues(good)
  assert.ok(wrongs.length >= 3)
  assert.equal(wrongs.some((item) => item.value === good.correct), false)
  for (const params of [
    { kind: 'equalShare', dividend: 13, divisor: 4, quotient: 3 },
    { kind: 'equalShare', dividend: 12, divisor: 10, quotient: 1 },
    { kind: 'equalShare', dividend: 12, divisor: 3, quotient: 5 },
  ]) {
    const verdict = verifyFormatSource({ ...good, params })
    assert.equal(verdict.ok, false, `${JSON.stringify(params)} 应被拒绝`)
  }
})

test('U4 选择题连续两卷零复用', () => {
  for (const level of LEVELS) {
    for (const [seed, nextSeed] of [
      [1, 2],
      [31337, 31338],
    ] as const) {
      const memory = new MemoryStore()
      const first = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U4'], level, count: 30, seed })
      memory.beginPaper()
      for (const piece of first.pieces) memory.record(sourceKeyOf(piece))
      const second = generateFormat({
        kind: 'choice',
        grade: '3A',
        unitIds: ['3A-U4'],
        level,
        count: 30,
        seed: nextSeed,
        memory,
      })
      assert.equal(second.pieces.length, 30, `${level} 第二卷实出 ${second.pieces.length}`)
      assert.equal(second.crossReused, 0, `${level} 跨卷复用 ${second.crossReused}`)
      const firstKeys = new Set(first.pieces.map((piece) => piece.key))
      assert.equal(
        second.pieces.filter((piece) => firstKeys.has(piece.key)).length,
        0,
        `${level} seed ${seed}→${nextSeed} 仍有跨卷重叠`,
      )
    }
  }
})
