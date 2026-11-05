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
import {
  CONCEPT_PROPOSITIONS,
  findConcept,
  validateConcept,
  verifyConceptItem,
  type ConceptProposition,
} from '../src/quiz/concepts.ts'
import { compareUnitForms, generateCompare } from '../src/quiz/compare.ts'

const UNITS = ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6', '3A-U7']

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
        // 概念题的真值是判断结论本身，错因值是判据而不是数值错误，跳过同值比较
        if (piece.data.pool !== 'concept') {
          assert.notEqual(piece.causes[0]!.value, piece.data.correct, '假命题不能与标答同值')
        }
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

test('单元可用性：U3 判断题与选择题都靠概念命题接入', () => {
  assert.equal(formatSupports('3A', ['3A-U1'], 'L1', 'judge'), true)
  assert.equal(formatSupports('3A', ['3A-U6'], 'L2', 'judge'), true)
  assert.deepEqual(formatSourceUnits('3A', ['3A-U3'], 'L1', 'judge'), ['3A-U3'])
  assert.deepEqual(formatSourceUnits('3A', ['3A-U3'], 'L1', 'choice'), ['3A-U3'])
  assert.equal(formatSupports('3A', ['3A-U3'], 'L1', 'choice'), true)
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

test('概念命题表：真命题有教材依据、假命题有单一错误点、陈述无模糊词', () => {
  assert.ok(CONCEPT_PROPOSITIONS.length >= 12, `命题表至少 12 条，实际 ${CONCEPT_PROPOSITIONS.length}`)
  for (const record of CONCEPT_PROPOSITIONS) {
    assert.deepEqual(validateConcept(record), [], `命题 ${record.id} 不合规`)
    assert.ok(record.knowledgePoint.trim().length > 0, `命题 ${record.id} 缺少知识点键`)
  }
  const ids = CONCEPT_PROPOSITIONS.map((record) => record.id)
  assert.equal(new Set(ids).size, ids.length, '命题 ID 不能重复')
  for (const unitId of ['3A-U3', '3A-U6', '3A-U1', '3A-U2']) {
    assert.ok(CONCEPT_PROPOSITIONS.some((record) => record.unitId === unitId), `${unitId} 缺少概念命题`)
  }
})

test('模棱两可命题与无单一错误点的假命题必须被拒', () => {
  const base: ConceptProposition = {
    id: 'test-ambiguous',
    knowledgePoint: 'u3.triangle.sideCount',
    unitId: '3A-U3',
    levels: ['L1'],
    statement: '三角形可能有4条边。',
    truth: false,
    rationale: '三角形只有3条边，说成4条边多算了1条。',
    singleError: '三角形只有3条边',
  }
  assert.ok(validateConcept(base).some((issue) => issue.includes('模糊表述')), '含「可能」应被拒')
  const noError = { ...base, id: 'test-no-error', statement: '三角形有4条边。', singleError: undefined }
  assert.ok(validateConcept(noError).some((issue) => issue.includes('单一错误点')), '假命题没有错误点应被拒')
  const wrongRationale = { ...base, id: 'test-rationale', rationale: '判据写错了。' }
  assert.ok(validateConcept(wrongRationale).some((issue) => issue.includes('覆盖单一错误点')), '判据没覆盖错误点应被拒')
})

test('判断题：概念命题占比 ≤1/3，真假各半且连续同答 ≤2', () => {
  const units = [...UNITS, '3A-U3']
  for (const [index, level] of (['L1', 'L2', 'L3'] as const).entries()) {
    const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: units, level, count: 20, seed: 880 + index })
    assert.equal(result.pieces.length, 20, `${level} 应出 20 道`)
    const concepts = result.pieces.filter((piece) => piece.data.pool === 'concept')
    // 概念池（48 条）远大于上限，应恰好截断到 6 道，不能多也不能少
    assert.equal(concepts.length, Math.floor(20 / 3), `${level} 概念命题应恰好 ${Math.floor(20 / 3)} 道`)
    assert.equal(result.pieces.filter((piece) => piece.truth).length, 10, `${level} 真假应各半`)
    assert.ok(longestRun(result.pieces.map((piece) => piece.truth)) <= 2, `${level} 连续同答超过 2`)
    for (const [position, piece] of result.pieces.entries()) {
      assert.deepEqual(verifyItemStructure(buildItem(piece, position) as never), [], `${level} 第 ${position + 1} 题复核`)
    }
    for (const piece of concepts) {
      const record = findConcept(piece.data.conceptId)!
      if (record.truth) {
        assert.deepEqual(piece.causes, [], '概念真命题不应带错因')
      } else {
        assert.equal(piece.causes[0]?.detail, record.rationale, '概念题错因必须抄自命题判据')
      }
      assert.ok(piece.data.conceptId && record.statement === piece.stem)
    }
  }
})

test('U3 单独选判断题：知识点池扩到 30，三档都能出满 20，真假各半', () => {
  for (const [index, level] of (['L1', 'L2', 'L3'] as const).entries()) {
    const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U3'], level, count: 20, seed: 990 + index })
    assert.equal(result.pieces.length, 20, `${level} 实出 20 道`)
    assert.ok(result.pieces.every((piece) => piece.data.pool === 'concept'), `${level} 应全部是概念命题`)
    assert.equal(result.pieces.filter((piece) => piece.truth).length, 10, `${level} 真假应各半`)
    const knowledgePoints = result.pieces.map((piece) => findConcept(piece.data.conceptId)!.knowledgePoint)
    assert.equal(new Set(knowledgePoints).size, knowledgePoints.length, `${level} 同卷知识点应唯一`)
    assert.ok(
      result.notes.some((note) => note.includes('全部为概念命题') && note.includes('无其他判断来源')),
      `${level} 摘要应说明全概念及原因，实际：${result.notes.join('；')}`,
    )
    for (const [position, piece] of result.pieces.entries()) {
      assert.deepEqual(verifyItemStructure(buildItem(piece, position) as never), [], `${level} 第 ${position + 1} 题复核`)
    }
  }
})

test('U3 单独选判断题：三档均出满 30 且真假 15/15', () => {
  for (const [index, level] of (['L1', 'L2', 'L3'] as const).entries()) {
    const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U3'], level, count: 30, seed: 20261105 + index })
    assert.equal(result.pieces.length, 30, `${level} 实出 ${result.pieces.length} 道`)
    const truth = result.pieces.filter((piece) => piece.truth).length
    const falsy = result.pieces.filter((piece) => !piece.truth).length
    assert.equal(truth, 15, `${level} 真命题应为 15 道`)
    assert.equal(falsy, 15, `${level} 假命题应为 15 道`)
    const knowledgePoints = result.pieces.map((piece) => findConcept(piece.data.conceptId)!.knowledgePoint)
    assert.equal(new Set(knowledgePoints).size, result.pieces.length, `${level} 每题应落在不同知识点`)
    for (const [position, piece] of result.pieces.entries()) {
      assert.deepEqual(verifyItemStructure(buildItem(piece, position) as never), [], `${level} 第 ${position + 1} 题复核`)
    }
  }
})

test('判断题同卷知识点唯一：三配置 × 三档 × 多种子，每个 knowledgePoint 最多 1 次', () => {
  const configs: Array<{ name: string; units: string[] }> = [
    { name: '仅 U3', units: ['3A-U3'] },
    { name: 'U3+U4+U6', units: ['3A-U3', '3A-U4', '3A-U6'] },
    { name: '全单元', units: [...UNITS, '3A-U3'] },
  ]
  for (const config of configs) {
    for (const [index, level] of (['L1', 'L2', 'L3'] as const).entries()) {
      for (const seed of [990 + index, 771, 20261105]) {
        const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: config.units, level, count: 20, seed })
        const knowledgePoints = result.pieces
          .filter((piece) => piece.data.pool === 'concept')
          .map((piece) => findConcept(piece.data.conceptId)!.knowledgePoint)
        assert.equal(
          new Set(knowledgePoints).size,
          knowledgePoints.length,
          `${config.name} ${level} seed ${seed} 同卷知识点重复：${knowledgePoints.join(', ')}`,
        )
      }
    }
  }
})

test('跨卷去重按知识点：连续两卷的判断题概念知识点不重复', () => {
  const memory = new MemoryStore()
  const papers: string[][] = []
  for (let paper = 0; paper < 2; paper++) {
    memory.beginPaper()
    const result = generateFormat({
      kind: 'judge',
      grade: '3A',
      unitIds: ['3A-U3'],
      level: 'L2',
      count: 5,
      seed: 1000 + paper,
      memory,
    })
    assert.equal(result.pieces.length, 5)
    papers.push(result.pieces.map((piece) => findConcept(piece.data.conceptId)!.knowledgePoint))
  }
  const overlap = papers[0]!.filter((knowledgePoint) => papers[1]!.includes(knowledgePoint))
  assert.deepEqual(overlap, [], `跨卷不应重复知识点：${overlap.join(', ')}`)
})

test('知识点键：命题必须给 knowledgePoint，缺失或格式不合法都要被拒', () => {
  const base: ConceptProposition = {
    id: 'test-knowledge-point',
    knowledgePoint: 'u3.triangle.sideCount',
    unitId: '3A-U3',
    levels: ['L1'],
    statement: '三角形有3条边。',
    truth: true,
    rationale: '三角形由3条线段围成。',
    source: '沪教版三上 U3：三角形的认识',
  }
  assert.deepEqual(validateConcept(base), [])
  assert.ok(
    validateConcept({ ...base, knowledgePoint: '' }).some((issue) => issue.includes('knowledgePoint')),
    '缺失知识点键应被拒',
  )
  assert.ok(
    validateConcept({ ...base, knowledgePoint: 'u3triangle' }).some((issue) => issue.includes('格式不合法')),
    '知识点键格式不合法应被拒',
  )
})

test('判断题：有其他数值来源时概念仍受 1/3 上限', () => {
  const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U3', '3A-U4', '3A-U6'], level: 'L2', count: 20, seed: 991 })
  assert.equal(result.pieces.length, 20)
  assert.equal(result.pieces.filter((piece) => piece.data.pool === 'concept').length, Math.floor(20 / 3))
  assert.ok(result.notes.some((note) => note.includes('上限')), `应写明 1/3 上限，实际：${result.notes.join('；')}`)
})

test('超纲：除法与余数命题只能落在 U4，不得出现在未学除法的 U1', () => {
  const division = /除法|余数|除数/
  const u1 = CONCEPT_PROPOSITIONS.filter((record) => record.unitId === '3A-U1')
  assert.ok(u1.length > 0, 'U1 应仍有概念命题')
  for (const record of u1) {
    assert.ok(!division.test(record.statement), `U1 命题超纲：${record.statement}`)
  }
  const remainders = CONCEPT_PROPOSITIONS.filter((record) => /余数/.test(record.statement))
  assert.ok(remainders.length >= 2, '余数命题应保留')
  for (const record of remainders) assert.equal(record.unitId, '3A-U4', `余数命题 ${record.id} 必须归属 U4`)
  const result = generateFormat({ kind: 'judge', grade: '3A', unitIds: ['3A-U1'], level: 'L2', count: 20, seed: 992 })
  for (const piece of result.pieces) assert.ok(!/余数|除数/.test(piece.stem), `U1 判断题出现超纲题干：${piece.stem}`)
})

test('绝对化表述：必须标注特例复核，缺字段或结论不完整都要被拒', () => {
  const absolute = /都|一定|所有|任何|只有|必须|总|每/
  for (const record of CONCEPT_PROPOSITIONS) {
    if (!absolute.test(record.statement)) continue
    assert.ok(record.absoluteReview?.includes('特例'), `命题 ${record.id} 的绝对化表述缺少特例复核`)
  }
  const base: ConceptProposition = {
    id: 'test-absolute',
    knowledgePoint: 'u3.quadrilateral.rightAngles',
    unitId: '3A-U3',
    levels: ['L1'],
    statement: '四边形的4个角都是直角。',
    truth: false,
    rationale: '四边形的4个角不都是直角。',
    singleError: '四边形的4个角不都是直角',
  }
  assert.ok(validateConcept(base).some((issue) => issue.includes('特例复核')), '绝对化表述缺 absoluteReview 应被拒')
  const weak = { ...base, id: 'test-absolute-weak', absoluteReview: '已复核。' }
  assert.ok(validateConcept(weak).some((issue) => issue.includes('必须写明「特例」')), '复核结论没写特例应被拒')
})

test('概念题复核：篡改真值或判据都会被拒', () => {
  const record = CONCEPT_PROPOSITIONS.find((item) => !item.truth)!
  const tamperedTruth = verifyConceptItem({
    conceptId: record.id,
    stem: record.statement,
    truth: true,
    answers: ['√'],
    causes: [{ value: '×', rule: 'concept-error', detail: record.rationale }],
  })
  assert.ok(tamperedTruth.some((issue) => issue.includes('真假与命题表不一致')), tamperedTruth.join('；'))
  const tamperedRationale = verifyConceptItem({
    conceptId: record.id,
    stem: record.statement,
    truth: false,
    answers: ['×'],
    causes: [{ value: '×', rule: 'concept-error', detail: '生成时顺手记的答案' }],
  })
  assert.ok(tamperedRationale.some((issue) => issue.includes('错因未落到命题判据')), tamperedRationale.join('；'))
})

test('比大小题库：不再有文字型概念比较', () => {
  assert.deepEqual(compareUnitForms('3A-U3', 'L1'), [], 'U3 不应再有比大小形态')
  assert.deepEqual(compareUnitForms('3A-U3', 'L2'), [])
  const banned = /平行四边形|正方形|梯形|三角形|条边|个角|长方形|四边形/
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateCompare({
      grade: '3A',
      unitIds: ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U7'],
      level,
      count: 60,
      seed: 300 + level.length,
    })
    assert.ok(result.items.length >= 20, `${level} 数值型比大小仍应可出`)
    for (const item of result.items) {
      assert.ok(!banned.test(item.pre), `${level} 左式仍含概念词：${item.pre}`)
      assert.ok(!banned.test(item.post), `${level} 右式仍含概念词：${item.post}`)
    }
  }
})

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
