import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CURRICULUM } from '../src/data/curriculum.ts'
import { generateFill, fillLevelsFor, verifyFillQuestion } from '../src/quiz/fill.ts'
import { generateWord, wordLevelsFor, verifyWordQuestion } from '../src/quiz/word.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { buildPaper, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG } from '../src/app/types.ts'
import type { AppConfig, TemplateInfo } from '../src/app/types.ts'
import type { Level } from '../src/quiz/types.ts'

const LEVELS: Level[] = ['L1', 'L2', 'L3']
const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

function unitsWith(
  kind: 'fill' | 'word',
  level: Level,
): { unitId: string; grade: '3A' | '3B' }[] {
  return CURRICULUM.units
    .filter((unit) =>
      kind === 'fill' ? fillLevelsFor(unit.unitId).includes(level) : wordLevelsFor(unit.unitId).includes(level),
    )
    .map((unit) => ({ unitId: unit.unitId, grade: unit.grade }))
}

function countBlanks(stem: string): number {
  return (stem.match(/__+/g) ?? []).length
}

const LEAK = /先算|再算|然后|接着|第一步|第二步|因此|所以|求出|算出/

test('填空：三上三下所有标注单元、三档难度都能稳定生成并通过独立求值', () => {
  let units = 0
  for (const level of LEVELS) {
    for (const unit of unitsWith('fill', level)) {
      const result = generateFill({
        grade: unit.grade,
        unitId: unit.unitId,
        level,
        count: 8,
        seed: 9001,
      })
      assert.equal(result.count, 8, `${unit.unitId}/${level} 题量不足`)
      for (const question of result.questions) {
        assert.equal(verifyFillQuestion(question), null, `${question.id} 独立求值失败`)
        assert.equal(question.answer, question.answers.join('；'))
        assert.equal(countBlanks(question.stem), question.answers.length, `${question.id} 空位与答案不匹配`)
        assert.ok(question.features.form, `${question.id} 缺少形态标记`)
        for (const value of question.values) {
          assert.ok(Number.isFinite(value) && value >= 0, `${question.id} 出现非法数值 ${value}`)
        }
      }
      units++
    }
  }
  assert.ok(units > 20, '填空覆盖的单元/难度组合过少')
})

test('应用题：三上三下所有标注单元、三档难度都自洽且分步解答与答案一致', () => {
  let count = 0
  for (const level of LEVELS) {
    for (const unit of unitsWith('word', level)) {
      const result = generateWord({
        grade: unit.grade,
        unitId: unit.unitId,
        level,
        count: 6,
        seed: 9002,
      })
      assert.equal(result.count, 6, `${unit.unitId}/${level} 题量不足`)
      for (const question of result.questions) {
        assert.equal(verifyWordQuestion(question), null, `${question.id} 分步自检失败`)
        assert.equal(question.questions.length, question.answers.length, `${question.id} 小问与答案数量不符`)
        assert.ok(question.workLines >= 2 && question.workLines <= 7, `${question.id} 留白行数越界`)
        // 留白必须容得下每问一个算式加一个答
        assert.ok(
          question.workLines >= 2 * question.questions.length,
          `${question.id} 留白行数不足（${question.questions.length} 问只有 ${question.workLines} 行）`,
        )
        assert.equal(question.answer.split('\n').length, question.steps.length, `${question.id} 解答行数不符`)
        assert.ok(!LEAK.test(question.stem), `${question.id} 题干泄露步骤`)
        assert.ok(!question.stem.includes('____'), `${question.id} 应用题混入填空线`)
        const numeric = question.answers.filter((value) => /^\d+$/.test(value)).map(Number)
        for (const value of numeric) assert.ok(value <= 100000, `${question.id} 结果超出三年级范围`)
        count++
      }
    }
  }
  assert.ok(count >= 60, '应用题覆盖题量过少')
})

test('难度分层：L1 单步、L2 两步、L3 多步/反向/判断确实有差别', () => {
  const wordByLevel = new Map<Level, ReturnType<typeof generateWord>['questions']>()
  for (const level of LEVELS) {
    const all: ReturnType<typeof generateWord>['questions'] = []
    for (const unit of unitsWith('word', level).slice(0, 4)) {
      all.push(
        ...generateWord({ grade: unit.grade, unitId: unit.unitId, level, count: 6, seed: 9003 }).questions,
      )
    }
    wordByLevel.set(level, all)
  }

  const l1 = wordByLevel.get('L1')!
  const l2 = wordByLevel.get('L2')!
  const l3 = wordByLevel.get('L3')!
  assert.ok(l1.every((q) => q.questions.length === 1 && q.steps.length === 1), 'L1 存在多步题')
  assert.ok(l2.every((q) => q.questions.length >= 2), 'L2 存在单问单步题')
  assert.ok(l3.filter((q) => Number(q.features.judge) === 1).length >= 3, 'L3 缺少“至少/最多/够不够”判断')
  assert.ok(l3.some((q) => q.steps.length >= 3), 'L3 缺少多步题')

  const fillByLevel = new Map<Level, ReturnType<typeof generateFill>['questions']>()
  for (const level of LEVELS) {
    const all: ReturnType<typeof generateFill>['questions'] = []
    for (const unit of unitsWith('fill', level).slice(0, 4)) {
      all.push(...generateFill({ grade: unit.grade, unitId: unit.unitId, level, count: 6, seed: 9004 }).questions)
    }
    fillByLevel.set(level, all)
  }
  const f1 = fillByLevel.get('L1')!
  const f2 = fillByLevel.get('L2')!
  const f3 = fillByLevel.get('L3')!
  assert.ok(f1.every((q) => Number(q.features.reverse) === 0 && q.answers.length === 1), 'L1 出现反向或多空题')
  assert.ok(f2.some((q) => q.answers.length >= 2), 'L2 缺少两空/两步题')
  assert.ok(f3.filter((q) => Number(q.features.reverse) === 1).length > f1.filter((q) => Number(q.features.reverse) === 1).length)
  assert.ok(f3.filter((q) => Number(q.features.reverse) === 1).length > 0, 'L3 缺少反向求的题')
})

test('同卷去重：同一次生成内题干与参数组合都不重复', () => {
  const fill = generateFill({ grade: '3A', unitId: '3A-U5', level: 'L2', count: 20, seed: 9101 })
  assert.equal(new Set(fill.questions.map((q) => q.stem)).size, 20)
  assert.equal(new Set(fill.questions.map((q) => q.fingerprint)).size, 20)

  const word = generateWord({ grade: '3B', unitId: '3B-U2', level: 'L3', count: 15, seed: 9102 })
  assert.equal(new Set(word.questions.map((q) => q.stem)).size, 15)
  assert.equal(new Set(word.questions.map((q) => q.fingerprint)).size, 15)
})

test('跨卷记忆：共享 MemoryStore 连出多卷时新卷尽量避开旧题', () => {
  const memory = new MemoryStore()
  const first = generateWord({
    grade: '3B',
    unitId: '3B-U2',
    level: 'L3',
    count: 8,
    seed: 9103,
    memory,
  })
  const second = generateWord({
    grade: '3B',
    unitId: '3B-U2',
    level: 'L3',
    count: 8,
    seed: 9104,
    memory,
  })
  const shared = second.questions.filter(
    (q) => first.questions.some((old) => old.fingerprint === q.fingerprint),
  )
  assert.ok(shared.length <= 1, `跨卷重复 ${shared.length} 题`)

  const fillMemory = new MemoryStore()
  const f1 = generateFill({
    grade: '3A',
    unitId: '3A-U6',
    level: 'L1',
    count: 8,
    seed: 9105,
    memory: fillMemory,
  })
  const f2 = generateFill({
    grade: '3A',
    unitId: '3A-U6',
    level: 'L1',
    count: 8,
    seed: 9106,
    memory: fillMemory,
  })
  assert.equal(
    f2.questions.filter((q) => f1.questions.some((old) => old.fingerprint === q.fingerprint)).length,
    0,
    '填空跨卷出现重复',
  )
})

test('题型可用性：填空/应用题按单元与难度动态放开，不可用时给出原因', () => {
  const base: AppConfig = { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U5'], level: 'L2' }
  const available = typeAvailability(base, TEMPLATE)
  assert.equal(available.tiankong.enabled, true)
  assert.equal(available.tiankong.reason, '')
  assert.equal(available.word.enabled, true)

  const wrongLevel = typeAvailability({ ...base, level: 'L1' }, TEMPLATE)
  assert.equal(wrongLevel.tiankong.enabled, true)

  const noRules = typeAvailability({ ...base, unitIds: ['3A-U3'] }, TEMPLATE)
  assert.equal(noRules.tiankong.enabled, false)
  assert.match(noRules.tiankong.reason, /没有填空生成规则/)
  assert.equal(noRules.word.enabled, false)
  assert.match(noRules.word.reason, /没有应用题生成规则/)

  const noBranch = typeAvailability(base, { ...TEMPLATE, word: false })
  assert.equal(noBranch.word.enabled, false)
  assert.match(noBranch.word.reason, /模板未接入应用题/)

  const fallbackOnly = typeAvailability(
    { ...DEFAULT_CONFIG, grade: '3A', unitIds: ['3A-U1'], level: 'L2' },
    TEMPLATE,
  )
  // U1 已有骨架填空包，优先走骨架，不再提示旧题库兜底
  assert.equal(fallbackOnly.tiankong.enabled, true)
  assert.equal(fallbackOnly.tiankong.reason, '')
  assert.equal(fallbackOnly.tiankong.source, 'skeleton')
})

test('出卷组装：填空 + 应用题混排，题量正确且无旧题库兜底提示', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U5'],
    level: 'L3',
    types: ['tiankong', 'word'],
    count: 12,
  }
  const result = buildPaper({ config, template: TEMPLATE, seed: 9201, memory: new MemoryStore() })
  assert.equal(result.count, 12)
  assert.equal(result.stats.generated, 12)
  assert.equal(result.stats.skeleton, 12)
  assert.equal(result.stats.legacy, 0)
  assert.equal(result.stats.fallback, 0)
  assert.ok(result.notes.every((note) => !note.includes('兜底')), '有生成规则时不应再走兜底')
  assert.deepEqual(
    result.data.sections.map((section) => section.kind),
    ['tiankong', 'word'],
  )
  const fill = result.data.sections[0].items
  const word = result.data.sections[1].items
  assert.ok(fill.length >= 6 && word.length >= 4)
  for (const item of fill) {
    assert.equal(item.kind, 'fill')
    assert.equal(item.answers?.length, (item.parts ?? []).filter((part) => 'b' in part).length)
    assert.ok(item.parts?.every((part) => ('b' in part ? part.b >= 12 && part.b <= 40 : true)))
  }
  for (const item of word) {
    assert.equal(item.kind, 'word')
    // 骨架应用题的留白按步数分档（2/4/6 行），不再是旧生成器的固定 3 行
    assert.ok((item.workLines ?? 0) >= 2 && (item.workLines ?? 0) <= 6, '留白行数按步数')
    assert.ok(item.solution && item.solution.length >= 1)
  }
})
