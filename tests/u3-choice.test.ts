import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONCEPT_PROPOSITIONS } from '../src/quiz/concepts.ts'
import { generateFormat, verifyFormatSource } from '../src/quiz/formats.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const TEMPLATE: TemplateInfo = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const byStatement = (statement: string) =>
  CONCEPT_PROPOSITIONS.find((record) => record.statement.trim() === statement.trim())

test('U3 选择题：L2 出满 30 题，每题 1 真 + 3 假且干扰项来自其他知识点', () => {
  const result = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 30, seed: 20261105 })
  assert.equal(result.pieces.length, 30)
  const kps = new Set(result.pieces.map((piece) => piece.kpName))
  assert.equal(kps.size, 30, '同卷每个知识点最多 1 题')
  for (const piece of result.pieces) {
    const options = (piece.options ?? []).map((option) => option.trim())
    assert.equal(options.length, 4)
    assert.equal(new Set(options).size, 4, `选项重复：${piece.stem}`)
    const wantTrue = piece.data.want === 'true'
    assert.ok(piece.stem.includes(wantTrue ? '下面说法正确的是' : '下面说法不正确的是'))
    assert.equal(piece.answerIndex, options.indexOf(options[piece.answerIndex!]!), '标答下标越界')
    const records = options.map((option) => byStatement(option))
    assert.ok(records.every(Boolean), `选项必须来自命题表：${options.join(' / ')}`)
    const truths = records.filter((record) => record!.truth).length
    assert.equal(truths, wantTrue ? 1 : 3, `真假分布不对：${options.join(' / ')}`)
    const focal = byStatement(options[piece.answerIndex!]!)!
    assert.equal(focal.truth, wantTrue, '标答真值与问法不一致')
    for (const record of records.filter((record) => record!.truth !== wantTrue)) {
      assert.ok(
        record!.knowledgePoint !== focal.knowledgePoint,
        `干扰项不应与焦点同知识点：${record!.statement}`,
      )
      // 问“正确的是”时干扰项是假说法（须有唯一错误点）；问“不正确的是”时干扰项是真说法（须有依据）
      if (record!.truth) assert.ok(record!.source, `干扰项必须有依据：${record!.statement}`)
      else assert.ok(record!.singleError, `干扰项必须有唯一错误点：${record!.statement}`)
    }
    assert.equal(verifyFormatSource(piece.data).ok, true, `${piece.stem} 来源复核失败`)
    assert.equal(piece.answers[0], ['A', 'B', 'C', 'D'][piece.answerIndex!])
  }
})

test('U3 选择题：L1/L3 按知识点池如实出题（L1 27 / L3 30）', () => {
  const l1 = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U3'], level: 'L1', count: 30, seed: 20261105 })
  assert.equal(l1.pieces.length, 27, 'L1 知识点池只有 27 个，不拿同知识点反说法凑数')
  assert.equal(new Set(l1.pieces.map((piece) => piece.kpName)).size, 27)
  const l3 = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U3'], level: 'L3', count: 30, seed: 20261105 })
  assert.equal(l3.pieces.length, 30)
  assert.equal(new Set(l3.pieces.map((piece) => piece.kpName)).size, 30)
})

test('U3 选择题复核：干扰项混入同真值陈述时能拦住', () => {
  const result = generateFormat({ kind: 'choice', grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 5, seed: 20261105 })
  const piece = result.pieces.find((candidate) => candidate.data.want === 'true')!
  const options = [...(piece.options ?? [])]
  const distractorSlot = [0, 1, 2, 3].find((slot) => slot !== piece.answerIndex)!
  const extraTrue = CONCEPT_PROPOSITIONS.find(
    (record) => record.truth && !options.map((option) => option.trim()).includes(record.statement.trim()),
  )!
  options[distractorSlot] = extraTrue.statement
  const bad = { ...piece.data, options }
  const verdict = verifyFormatSource(bad)
  assert.equal(verdict.ok, false)
  assert.ok(verdict.error?.includes('正确陈述'))
})

test('接线：U3 只出选择题时可出满且运行时剔除为 0', () => {
  const config: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U3'], level: 'L2', types: ['choice'], count: 20 }
  const availability = typeAvailability(config, TEMPLATE)
  assert.equal(availability.choice.enabled, true)
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory: new MemoryStore() })
  assert.equal(result.count, 20)
  assert.equal(result.skipped.includes('choice'), false)
  assert.equal(result.stats.runtimeCheck.dropped, 0)
  for (const item of result.data.sections[0]!.items) {
    assert.equal((item.options ?? []).length, 4)
    const stem = (item.parts ?? []).map((part) => ('t' in part ? part.t : '')).join('')
    assert.ok(stem.includes('说法'), '题干应为说法选择题')
  }
})
