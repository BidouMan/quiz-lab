import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LIE_TEMPLATES,
  evalLieAst,
  generateLie,
  lieKey,
  parseLieShape,
  renderLieAst,
  validateLiePaper,
  verifyLieRecord,
  type LieAst,
  type LieQuestion,
} from '../src/quiz/lieshi.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const UNITS_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8']

const template = (id: string) => {
  const found = LIE_TEMPLATES.find((item) => item.id === id)
  assert.ok(found, `缺少模板 ${id}`)
  return found
}

const recordOf = (id: string, params: Record<string, number>, ast?: LieAst) => {
  const spec = template(id)
  const actual = ast ?? parseLieShape(spec.shape, params)
  return {
    templateId: id,
    level: spec.levels[0]!,
    params,
    ast: actual,
    expression: renderLieAst(actual),
    answer: String(evalLieAst(actual)),
    stem: spec.stem(params),
  }
}

test('句式与结构不符必须被拒', () => {
  const params = { a: 12, b: 5, c: 10 }
  // 题干是“比积多10”，实际 AST 却是“积减10”
  const ast = parseLieShape('a*b-c', params)
  const wrong = verifyLieRecord({
    templateId: 'l1-product-more',
    level: 'L1',
    params,
    ast,
    expression: renderLieAst(ast),
    answer: '50',
    stem: template('l1-product-more').stem(params),
  })
  assert.ok(
    wrong.some((issue) => issue.includes('结构-语句不一致')),
    `应拒绝结构不符：${wrong.join('；')}`,
  )
})

test('结果为负数必须被拒', () => {
  const issues = verifyLieRecord(recordOf('l1-product-less', { a: 2, b: 3, c: 100 }))
  assert.ok(
    issues.some((issue) => issue.includes('语义边界') || issue.includes('非负')),
    `应拒绝负数结果：${issues.join('；')}`,
  )
})

test('同卷同句式超过 2 次必须被拒', () => {
  const questions: LieQuestion[] = [12, 13, 14].map((a, index) => {
    const params = { a, b: 3 }
    const ast = parseLieShape('a*b', params)
    return {
      id: `lie-test-${index}`,
      grade: '3A',
      unitId: '3A-U2',
      unitName: '用一位数乘',
      kpName: '用一位数乘',
      level: 'L1',
      templateId: 'l1-product',
      patternLabel: 'a乘b',
      stem: template('l1-product').stem(params),
      expression: renderLieAst(ast),
      answer: String(evalLieAst(ast)),
      params,
      ast,
      // 三条不同数值，排除“同卷重复”这条，只检验句式上限
      key: lieKey('l1-product', ast),
    }
  })
  // 答案刻意写错也会触发结果复核，这里只关心句式上限这一条
  const issues = validateLiePaper(questions)
  assert.ok(
    issues.some((issue) => issue.includes('同卷同句式超过 2 次')),
    `应拒绝同句式 3 次：${issues.join('；')}`,
  )
})

test('三档各 20 题：句式 ≥8 种、同句式 ≤2 次、双路径复核全过', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const result = generateLie({
      grade: '3A',
      unitIds: UNITS_3A,
      level,
      count: 20,
      seed: 20261105,
    })
    assert.equal(result.questions.length, 20, `${level} 实出 ${result.questions.length}`)
    const perPattern = new Map<string, number>()
    for (const question of result.questions) {
      perPattern.set(question.templateId, (perPattern.get(question.templateId) ?? 0) + 1)
    }
    assert.ok(perPattern.size >= 8, `${level} 只有 ${perPattern.size} 种句式`)
    assert.ok(
      [...perPattern.values()].every((count) => count <= 2),
      `${level} 存在同句式超过 2 次`,
    )
    assert.deepEqual(validateLiePaper(result.questions), [], `${level} 复核未通过`)
  }
})

test('单元映射：U3 不适用，U2 纯乘法与 L2 括号句式都可用', () => {
  const u3 = generateLie({ grade: '3A', unitIds: ['3A-U3'], level: 'L2', count: 20 })
  assert.equal(u3.questions.length, 0)
  assert.ok(u3.notes[0]?.includes('没有可用运算结构'))

  const u2l2 = generateLie({ grade: '3A', unitIds: ['3A-U2'], level: 'L2', count: 20 })
  assert.equal(u2l2.questions.length, 6, 'U2 L2 三种括号句式，各出 2 题')
  for (const question of u2l2.questions) {
    assert.ok(question.expression.includes('('), `U2 L2 必须含括号：${question.expression}`)
    assert.equal(question.unitId, '3A-U2')
  }
  assert.deepEqual(validateLiePaper(u2l2.questions), [])

  const u2l1 = generateLie({ grade: '3A', unitIds: ['3A-U2'], level: 'L1', count: 20 })
  assert.equal(u2l1.questions.length, 6)
})

test('U6 周长列式：长方形（长+宽）×2 与正方形 边长×4', () => {
  const l2 = generateLie({ grade: '3A', unitIds: ['3A-U6'], level: 'L2', count: 20 })
  assert.equal(l2.questions.length, 4, 'U6 L2 两种问法，各出 2 题')
  for (const question of l2.questions) {
    assert.equal(question.unitId, '3A-U6')
    assert.equal(question.kpName, '周长')
    assert.ok(question.expression.endsWith(')×2'), `长方形周长应为（长+宽）×2：${question.expression}`)
  }
  assert.deepEqual(validateLiePaper(l2.questions), [])

  const sample = l2.questions.find((question) => question.params.a === 12 && question.params.b === 5)
  // 12、5 不保证被抽到；直接按目标算式复核同结构记录
  const target = recordOf('l2-rect-perimeter', { a: 12, b: 5 })
  assert.equal(target.expression, '(12+5)×2')
  assert.equal(target.answer, '34')
  assert.deepEqual(verifyLieRecord(target), [])
  assert.ok(sample === undefined || sample.expression === '(12+5)×2')

  const l1 = generateLie({ grade: '3A', unitIds: ['3A-U6'], level: 'L1', count: 20 })
  assert.equal(l1.questions.length, 2)
  for (const question of l1.questions) {
    assert.ok(question.expression.endsWith('×4'), `正方形周长应为 边长×4：${question.expression}`)
  }
  assert.deepEqual(validateLiePaper(l1.questions), [])
})

test('跨卷同句式同结构不再重复（记忆池有记录时换题）', () => {
  const first = generateLie({
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    count: 20,
    seed: 41,
  })
  const memory = new MemoryStore()
  memory.beginPaper()
  for (const question of first.questions) memory.record(question.key)
  const second = generateLie({
    grade: '3A',
    unitIds: UNITS_3A,
    level: 'L2',
    count: 20,
    seed: 42,
    memory,
  })
  const reused = second.questions.filter((question) => first.questions.some((old) => old.key === question.key))
  assert.ok(reused.length <= 2, `跨卷重复 ${reused.length} 题，应只允许少量 LRU 复用`)
})
