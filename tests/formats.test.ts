import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyItemStructure } from '../src/app/runtimeCheck.ts'
import { splitFill } from '../src/app/typstData.ts'
import {
  deriveWrongValues,
  formatSourceUnits,
  formatSupports,
  generateFormat,
  verifyFormatSource,
  type FormatSourceData,
} from '../src/quiz/formats.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const UNITS = ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U9']

function buildItem(piece: ReturnType<typeof generateFormat>['pieces'][number], index: number) {
  return {
    id: `fmt-${index}`,
    kind: piece.kind,
    parts: splitFill(piece.stem),
    truth: piece.truth,
    options: piece.options,
    answerIndex: piece.answerIndex,
    optionCols: piece.optionCols,
    answers: piece.answers,
    fmt: { data: piece.data, causes: piece.causes, truth: piece.truth, answerIndex: piece.answerIndex },
  }
}

test('判断题：三档均可生成，真假各半且逐题复核通过', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: UNITS, level, count: 20, seed: 771 })
    assert.equal(result.pieces.length, 20, `${level} 应出 20 道判断题`)
    const truths = result.pieces.filter((piece) => piece.truth).length
    assert.equal(truths, 10, `${level} 真假应为 10/10`)
    for (const [index, piece] of result.pieces.entries()) {
      assert.deepEqual(verifyItemStructure(buildItem(piece, index) as never), [], `${level} 第 ${index + 1} 题复核`)
      const source = verifyFormatSource(piece.data)
      assert.equal(source.ok, true)
      if (!piece.truth) {
        assert.equal(piece.causes.length, 1, '假命题必须带 1 条错因')
        assert.notEqual(piece.causes[0]!.value, piece.data.correct, '假命题不能与标答同值')
      }
    }
  }
})

test('选择题：正确答案在 A/B/C/D 各 5 题，且恰好一个正确选项', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateFormat({ kind: 'choice', grade: '3A', unitIds: UNITS, level, count: 20, seed: 772 })
    assert.equal(result.pieces.length, 20)
    const counts = [0, 0, 0, 0]
    for (const [index, piece] of result.pieces.entries()) {
      counts[piece.answerIndex ?? 0]! += 1
      assert.equal(piece.options?.length, 4)
      assert.equal(new Set(piece.options).size, 4)
      assert.equal(piece.options!.filter((option) => option === piece.data.correct).length, 1)
      assert.deepEqual(verifyItemStructure(buildItem(piece, index) as never), [])
    }
    assert.deepEqual(counts, [5, 5, 5, 5], `${level} 选项分布`)
  }
})

test('两个正确选项必须被拒', () => {
  const result = generateFormat({ kind: 'choice', grade: '3A', unitIds: UNITS, level: 'L2', count: 1, seed: 773 })
  const piece = result.pieces[0]!
  const item = buildItem(piece, 0)
  const options = [...piece.options!]
  const wrongSlot = options.findIndex((option) => option !== piece.data.correct)
  options[wrongSlot] = piece.data.correct
  const issues = verifyItemStructure({ ...item, options } as never)
  assert.ok(issues.some((issue) => issue.includes('正确选项应恰好 1 个')), issues.join('；'))
})

test('无错因的假命题必须被拒', () => {
  const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: UNITS, level: 'L2', count: 2, seed: 774 })
  const piece = result.pieces.find((candidate) => !candidate.truth)!
  const item = buildItem(piece, 0)
  const issues = verifyItemStructure({ ...item, fmt: { ...item.fmt, causes: [] } } as never)
  assert.ok(issues.some((issue) => issue.includes('假命题必须且只能带 1 条错因')), issues.join('；'))
  const fakeValue = { ...item, fmt: { ...item.fmt, causes: [{ value: piece.data.correct, rule: 'misread-operand', detail: '注入' }] } }
  const issues2 = verifyItemStructure(fakeValue as never)
  assert.ok(issues2.some((issue) => issue.includes('实际为真')), issues2.join('；'))
})

test('错因值可由规则独立重算，正确值由参数独立重算', () => {
  const result = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U5', '3A-U7'], level: 'L1', count: 10, seed: 775 })
  assert.ok(result.pieces.length >= 6, `至少产出 6 道，实际 ${result.pieces.length}`)
  for (const piece of result.pieces) {
    const source: FormatSourceData = piece.data
    assert.equal(verifyFormatSource(source).ok, true)
    const derived = new Set(deriveWrongValues(source).map((item) => item.value))
    for (const cause of piece.causes) assert.ok(derived.has(cause.value), `${cause.value} 应可由规则重算`)
  }
})

test('单元可用性：三上 U1/U6 可用，U3/U8 暂不接入', () => {
  assert.equal(formatSupports('3A', ['3A-U1'], 'L1'), true)
  assert.equal(formatSupports('3A', ['3A-U6'], 'L2'), true)
  assert.deepEqual(formatSourceUnits('3A', ['3A-U3', '3A-U8'], 'L1'), [])
  assert.equal(formatSupports('3A', ['3A-U8'], 'L1'), false)
})

test('跨卷去重：连续 4 卷不重复', () => {
  const memory = new MemoryStore()
  const keys: string[][] = []
  for (let paper = 0; paper < 4; paper++) {
    memory.beginPaper()
    const result = generateFormat({
      kind: 'judge',
      grade: '3A',
      unitIds: ['3A-U1', '3A-U2', '3A-U6'],
      level: 'L2',
      count: 15,
      seed: 900 + paper,
      memory,
    })
    assert.equal(result.pieces.length, 15)
    keys.push(result.pieces.map((piece) => piece.key))
  }
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const overlap = keys[i]!.filter((key) => keys[j]!.includes(key))
      assert.deepEqual(overlap, [], `第 ${i + 1} 卷与第 ${j + 1} 卷不应重复`)
    }
  }
})

const longestRun = <T,>(sequence: T[]): number => {
  let best = 0
  let run = 0
  for (let index = 0; index < sequence.length; index++) {
    run = index > 0 && sequence[index] === sequence[index - 1] ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

test('防猜测：6 份卷的答案序列不是固定轮转，且连续同答案不超阈值', () => {
  const choicePapers: string[][] = []
  const judgePapers: string[][] = []
  for (let paper = 0; paper < 6; paper++) {
    const choice = generateFormat({ kind: 'choice', grade: '3A', unitIds: UNITS, level: 'L2', count: 20, seed: 810 + paper })
    const judge = generateFormat({ kind: 'judge', grade: '3A', unitIds: UNITS, level: 'L2', count: 20, seed: 860 + paper })
    assert.equal(choice.pieces.length, 20)
    assert.equal(judge.pieces.length, 20)
    const choiceAnswers = choice.pieces.map((piece) => ['A', 'B', 'C', 'D'][piece.answerIndex ?? 0]!)
    const judgeAnswers = judge.pieces.map((piece) => (piece.truth ? '√' : '×'))
    // 至少一位偏离固定轮转（选择题 index % 4、判断题奇偶交替）
    const rotation = ['A', 'B', 'C', 'D']
    const deviates = choiceAnswers.some((answer, index) => answer !== rotation[index % 4])
    const parityDeviates = judgeAnswers.some((answer, index) => answer !== (index % 2 === 1 ? '×' : '√'))
    assert.ok(deviates, `第 ${paper + 1} 卷选择题仍与固定轮转一致`)
    assert.ok(parityDeviates, `第 ${paper + 1} 卷判断题仍与奇偶交替一致`)
    assert.ok(longestRun(choiceAnswers) <= 3, `选择题最长连续同答案 ${longestRun(choiceAnswers)} 超过 3`)
    assert.ok(longestRun(judgeAnswers) <= 2, `判断题最长连续同答案 ${longestRun(judgeAnswers)} 超过 2`)
    choicePapers.push(choiceAnswers)
    judgePapers.push(judgeAnswers)
  }
  // 同一 seed 可复现
  const replay = generateFormat({ kind: 'choice', grade: '3A', unitIds: UNITS, level: 'L2', count: 20, seed: 810 })
  assert.deepEqual(replay.pieces.map((piece) => ['A', 'B', 'C', 'D'][piece.answerIndex ?? 0]!), choicePapers[0])
})
