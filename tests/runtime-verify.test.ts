import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  admitWithRetry,
  verifyCalcQuestion,
  verifyFillQuestion,
  verifyItemStructure,
  verifySkeletonQuestion,
  verifyStaticItem,
} from '../src/app/runtimeCheck.ts'
import { buildPaper } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'
import { getCombo, buildComboPaper } from '../src/quiz/skeleton/index.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import type { FillQuestion, GeneratedQuestion } from '../src/quiz/types.ts'

const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

function calcQuestion(latex: string, answer: string): GeneratedQuestion {
  return {
    id: 'inject-1',
    grade: '3A',
    unitId: '3A-U2',
    unitName: '用一位数乘',
    kpId: 'kp',
    kpName: 'kp',
    type: 'kousuan',
    level: 'L2',
    latex,
    answer,
    fingerprint: latex,
    values: [],
    features: {},
  }
}

test('注入错误答案：复核拦住并重生成后放行，不混进卷面', () => {
  const wrong = calcQuestion('36 \\times 4 =', '148')
  const right = calcQuestion('36 \\times 4 =', '144')
  assert.deepEqual(verifyCalcQuestion(wrong), ['重算不符：36 \\times 4 = 144，答案为 148'])

  const outcome = admitWithRetry<GeneratedQuestion>({
    initial: wrong,
    verify: verifyCalcQuestion,
    regenerate: () => right,
  })
  assert.equal(outcome.firstFailed, true)
  assert.equal(outcome.dropped, false)
  assert.equal(outcome.accepted?.answer, '144')
  assert.equal(outcome.attempts, 1)
})

test('注入错误答案且重生成仍错：上限内重试后剔除', () => {
  const wrong = calcQuestion('36 \\times 4 =', '148')
  let calls = 0
  const outcome = admitWithRetry<GeneratedQuestion>({
    initial: wrong,
    verify: verifyCalcQuestion,
    regenerate: () => {
      calls++
      return wrong
    },
    maxRegenerations: 3,
  })
  assert.equal(calls, 3, '重生成必须有明确上限')
  assert.equal(outcome.dropped, true)
  assert.equal(outcome.accepted, null, '验不过的题不能进卷面')
})

test('骨架题复核：篡改答案会被独立求值器拦住', () => {
  const combo = getCombo('3A-U1|tiankong|L2')
  const paper = buildComboPaper(combo, { count: 6, seed: 20261104 })
  const original = paper.questions[0]
  const tampered = { ...original, answers: ['9999', ...original.answers.slice(1)] }
  assert.ok(verifySkeletonQuestion(original, combo).length === 0, '原题应通过')
  assert.ok(verifySkeletonQuestion(tampered, combo).length > 0, '篡改答案必须被拦住')
})

test('静态兜底题：空答案直接剔除', () => {
  assert.deepEqual(verifyItemStructure({ id: 'x', kind: 'word', text: '题目', answers: ['3'] }), [])
  assert.ok(
    verifyItemStructure({ id: 'y', kind: 'fill', parts: [{ t: '题干' }, { b: 20 }], answers: [] }).includes('缺少答案'),
  )
  assert.ok(verifyStaticItem({ id: 'z', kind: 'kousuan', expr: '6 times 7', answers: [] }).includes('静态兜底题缺少答案'))
})

function verifyFill(question: Pick<FillQuestion, 'stem' | 'answers'>): string[] {
  return verifyFillQuestion({ ...question } as FillQuestion)
}

test('旧填空生成器：空位与答案数量不一致会被拦住', () => {
  assert.deepEqual(verifyFill({ stem: '8 的 3 倍是______。', answers: ['24'] }), [])
  assert.ok(verifyFill({ stem: '______ 和______', answers: ['1'] }).some((issue) => issue.includes('空位')))
})

test('出卷链路：30 题混合卷每道题都过复核且卷面带答案', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8', '3A-U9'],
    level: 'L2',
    types: ['kousuan', 'tiankong', 'word'],
    count: 30,
  }
  const result = buildPaper({ config, template: TEMPLATE, seed: 20261104, memory: new MemoryStore() })
  assert.equal(result.count, 30, '复核不应无故少题')
  assert.ok(result.stats.runtimeCheck.checked >= 30, '卷面题目必须逐题送复核')
  assert.equal(result.stats.runtimeCheck.dropped, 0, '正常出卷不应剔除')

  for (const section of result.data.sections) {
    for (const item of section.items) {
      const issues = verifyItemStructure(item)
      assert.deepEqual(issues, [], `${item.id} 结构异常：${issues.join('；')}`)
      if (item.kind === 'fill' || item.kind === 'word') {
        assert.ok((item.answers ?? []).length > 0, `${item.id} 缺少答案`)
      }
    }
  }
})
