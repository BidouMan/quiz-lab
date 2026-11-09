import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChinesePaper, allocateReadingScores } from '../src/chinese/build.ts'
import {
  CHINESE_PAPER_PRESETS,
  DEFAULT_CHINESE_PAPER_CONFIG,
} from '../src/chinese/presets.ts'
import { CHINESE_ANSWER_MODE, CHINESE_PAPER_TYPE_IDS } from '../src/chinese/materials.ts'
import { buildChinesePaperDoc, buildReadingPaperConfig } from '../src/chinese/doc.ts'
import type { ChinesePaperConfig } from '../src/chinese/types.ts'

const build = (patch: Partial<ChinesePaperConfig>): ReturnType<typeof buildChinesePaper> =>
  buildChinesePaper({ ...DEFAULT_CHINESE_PAPER_CONFIG, ...patch })

test('默认卷：无缺口，题量等于配置，分值等于期望', () => {
  const paper = build({})
  assert.equal(paper.gaps.length, 0)
  assert.equal(paper.items.length, DEFAULT_CHINESE_PAPER_CONFIG.totalItems)
  assert.equal(paper.score.total, paper.score.requested)
  for (const section of paper.sections) {
    assert.equal(section.selected, section.requested, section.label)
  }
})

test('默认卷：同一套卷内题目 key 与古诗都不重复', () => {
  const paper = build({})
  const keys = paper.items.map((item) => item.key)
  assert.equal(new Set(keys).size, keys.length)

  const poems = paper.items
    .filter((item): item is typeof item & { poemTitle: string } => 'poemTitle' in item)
    .map((item) => item.poemTitle)
  assert.equal(new Set(poems).size, poems.length)
})

test('缺口卷：素材不足时只排现有题，卷面缺口写明需要与现有', () => {
  const paper = buildChinesePaper(CHINESE_PAPER_PRESETS.gap)
  assert.equal(paper.gaps.length, 3)
  assert.ok(paper.score.total < paper.score.requested)

  const kanpinyin = paper.sections.find((section) => section.typeId === 'kanpinyin')
  assert.ok(kanpinyin?.gap)
  assert.equal(kanpinyin.selected, 12)
  assert.equal(kanpinyin.gap.needed, 15)
  assert.equal(kanpinyin.gap.available, 12)
  assert.match(kanpinyin.gap.message, /需要 15 题，现有 12 题/)

  const keys = paper.items.map((item) => item.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('难度档：有逐题标注的题型按档筛选，不硬凑', () => {
  const paper = build({
    difficulty: 'B',
    totalItems: 2,
    sections: [{ typeId: 'zhuyin', count: 2, perItemScore: 1 }],
  })
  assert.equal(paper.gaps.length, 0)
  assert.deepEqual(
    paper.items.map((item) => item.level),
    ['B', 'B'],
  )
})

test('阅读分值：篇内各题之和等于该篇分值', () => {
  const paper = build({
    totalItems: 1,
    sections: [{ typeId: 'reading', count: 1, perItemScore: 12 }],
  })
  const reading = paper.items[0]
  assert.equal(reading.typeId, 'reading')
  if (reading.typeId !== 'reading') return
  const sum = reading.questions.reduce((total, question) => total + question.score, 0)
  assert.equal(sum, 12)
  assert.equal(reading.score, 12)
})

test('阅读分值分配：任意题量下都是整数且总和精确', () => {
  const questions = [
    { type: 'choice' as const },
    { type: 'fill' as const },
    { type: 'short' as const },
  ] as Parameters<typeof allocateReadingScores>[0]
  for (const total of [0, 5, 12, 15]) {
    const scores = allocateReadingScores(questions, total)
    assert.equal(scores.reduce((sum, score) => sum + score, 0), total)
    assert.ok(scores.every((score) => Number.isInteger(score) && score >= 0))
  }
})

test('答案页判分方式：客观题给答案，主观题只给评分要点', () => {
  for (const typeId of CHINESE_PAPER_TYPE_IDS) {
    assert.ok(CHINESE_ANSWER_MODE[typeId], `${typeId} 缺少判分方式`)
  }
  const paper = build({})
  const modes = Object.fromEntries(
    paper.sections.map((section) => [section.typeId, section.answerMode]),
  )
  assert.equal(modes.kanpinyin, 'objective')
  assert.equal(modes.gaibing, 'objective')
  assert.equal(modes.kuoxie, 'subjective')
  assert.equal(modes.fangxie, 'subjective')
  assert.equal(modes.reading, 'mixed')
  assert.equal(modes.writing, 'subjective')
  assert.equal(modes.lianmian, 'subjective')
})

test('配置校验：totalItems 与各题型 count 不一致直接报错', () => {
  assert.throws(
    () => build({ totalItems: 1 }),
    /totalItems=1，但各题型 count 合计=38/,
  )
})

test('阅读专项：按考点与难度筛选，篇篇命中条件', () => {
  const config = buildReadingPaperConfig(
    { skills: ['SK7'], themes: [], levels: ['C'], count: 3 },
    7,
  )
  const { paper, doc } = buildChinesePaperDoc(config)
  assert.equal(paper.sections.length, 1)
  assert.equal(paper.sections[0].typeId, 'reading')
  assert.equal(paper.items.length, 3)
  for (const item of paper.items) {
    assert.equal(item.typeId, 'reading')
    if (item.typeId !== 'reading') continue
    assert.ok(item.skills.includes('SK7'))
    assert.equal(item.level, 'C')
  }
  assert.equal(doc.meta.totalItems, 3)
  assert.equal(doc.meta.total, paper.score.total)
  assert.equal(doc.meta.requestedItems, 3)
})

test('阅读专项：按主题筛选，且不选条件时不给小节加筛选字段', () => {
  const narrowed = buildReadingPaperConfig(
    { skills: [], themes: ['写景'], levels: [], count: 2 },
    11,
  )
  const { paper } = buildChinesePaperDoc(narrowed)
  for (const item of paper.items) {
    assert.equal(item.theme, '写景')
  }

  const open = buildReadingPaperConfig({ skills: [], themes: [], levels: [], count: 2 }, 12)
  assert.equal(open.sections[0].skills, undefined)
  assert.equal(open.sections[0].themes, undefined)
  assert.equal(open.sections[0].levels, undefined)
  assert.equal(open.difficulty, 'mixed')
})

test('阅读专项：篇数收口在 1–20，多档难度按小节筛选', () => {
  assert.equal(buildReadingPaperConfig({ skills: [], themes: [], levels: [], count: 0 }, 1).totalItems, 1)
  assert.equal(buildReadingPaperConfig({ skills: [], themes: [], levels: [], count: 99 }, 1).totalItems, 20)
  const config = buildReadingPaperConfig(
    { skills: [], themes: [], levels: ['A', 'B'], count: 3 },
    1,
  )
  assert.deepEqual(config.sections[0].levels, ['A', 'B'])
  const { paper } = buildChinesePaperDoc(config)
  for (const item of paper.items) {
    assert.ok(item.level === 'A' || item.level === 'B')
  }
})
