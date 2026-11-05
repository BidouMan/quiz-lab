import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRng } from '../src/quiz/rng.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { U1_LIE_PACKAGE, U1_LIE_SKELETONS } from '../src/quiz/skeleton/u1-lieshi.ts'
import { U2_LIE_PACKAGE, U2_LIE_SKELETONS } from '../src/quiz/skeleton/u2-lieshi.ts'
import { renderLieSkeleton } from '../src/quiz/skeleton/lie-kit.ts'
import { generateLie, validateLiePaper, verifyLieRecord } from '../src/quiz/lieshi.ts'

test('U1 列式骨架包：三档各 30 条、共 90 条，编号唯一且只含加减乘', () => {
  assert.equal(U1_LIE_PACKAGE.unitId, '3A-U1')
  assert.equal(U1_LIE_SKELETONS.length, 90)
  for (const level of ['L1', 'L2', 'L3']) {
    const pool = U1_LIE_SKELETONS.filter((skeleton) => skeleton.level === level)
    assert.equal(pool.length, 30, `${level} 应有 30 条骨架`)
    assert.equal(new Set(pool.map((skeleton) => skeleton.id)).size, 30)
  }
  assert.equal(new Set(U1_LIE_SKELETONS.map((skeleton) => skeleton.id)).size, 90)
  for (const skeleton of U1_LIE_SKELETONS) {
    assert.ok(!skeleton.shape.includes('÷'), `${skeleton.id} 不应含除法`)
    for (const slot of Object.keys(skeleton.slots)) {
      const [min, max] = Object.values(skeleton.slots[slot]) as [number, number]
      assert.ok(min >= 2 && max <= 200, `${skeleton.id}.${slot} 数值域 ${min}~${max} 超三上范围`)
    }
  }
})

test('U2 列式骨架包：三档各 30 条、共 90 条，编号唯一且只含乘法', () => {
  assert.equal(U2_LIE_PACKAGE.unitId, '3A-U2')
  assert.equal(U2_LIE_SKELETONS.length, 90)
  for (const level of ['L1', 'L2', 'L3']) {
    const pool = U2_LIE_SKELETONS.filter((skeleton) => skeleton.level === level)
    assert.equal(pool.length, 30, `${level} 应有 30 条骨架`)
    assert.equal(new Set(pool.map((skeleton) => skeleton.id)).size, 30)
  }
  for (const skeleton of U2_LIE_SKELETONS) {
    assert.ok(skeleton.shape.includes('*'), `${skeleton.id} 应含乘法`)
    assert.ok(!skeleton.shape.includes('÷'), `${skeleton.id} 不应含除法`)
  }
})

test('U2 列式三档各出满 30 题，复核全过、无同卷重复', () => {
  for (const level of ['L1', 'L2', 'L3']) {
    const result = generateLie({ grade: '3A', unitIds: ['3A-U2'], level, count: 30, seed: 20261105 })
    assert.equal(result.questions.length, 30, `${level} 实出 ${result.questions.length}`)
    assert.equal(result.crossReused, 0)
    assert.equal(new Set(result.questions.map((question) => question.templateId)).size, 30)
    assert.deepEqual(validateLiePaper(result.questions), [])
  }
})

test('U2 连续两卷零复用', () => {
  const memory = new MemoryStore()
  const first = generateLie({ grade: '3A', unitIds: ['3A-U2'], level: 'L3', count: 30, seed: 3 })
  memory.beginPaper()
  for (const question of first.questions) memory.record(question.key)
  const second = generateLie({
    grade: '3A',
    unitIds: ['3A-U2'],
    level: 'L3',
    count: 30,
    seed: 4,
    memory,
  })
  assert.equal(second.questions.length, 30)
  assert.equal(second.crossReused, 0)
  const firstKeys = new Set(first.questions.map((question) => question.key))
  assert.equal(second.questions.filter((question) => firstKeys.has(question.key)).length, 0)
})

test('骨架自带反解：题干抽回槽位与渲染参数一致', () => {
  const rng = createRng(20261105)
  for (const skeleton of [...U1_LIE_SKELETONS, ...U2_LIE_SKELETONS]) {
    let checked = 0
    for (let attempt = 0; attempt < 10 && checked < 3; attempt++) {
      const params = skeleton.draw(rng)
      if (!params) continue
      const stem = renderLieSkeleton(skeleton, params)
      const reversed = skeleton.reverse(stem)
      assert.notEqual(reversed, null, `${skeleton.id} 反解失败：${stem}`)
      assert.deepEqual(reversed, params, `${skeleton.id} 反解参数不一致：${stem}`)
      checked++
    }
    assert.ok(checked >= 3, `${skeleton.id} 未能抽出 3 组可用参数`)
  }
})

test('U1 列式三档各出满 30 题，复核全过、无同卷重复', () => {
  for (const level of ['L1', 'L2', 'L3']) {
    const result = generateLie({ grade: '3A', unitIds: ['3A-U1'], level, count: 30, seed: 20261105 })
    assert.equal(result.questions.length, 30, `${level} 实出 ${result.questions.length}`)
    assert.equal(result.crossReused, 0)
    assert.equal(new Set(result.questions.map((question) => question.templateId)).size, 30)
    assert.equal(new Set(result.questions.map((question) => question.stem)).size, 30)
    assert.equal(new Set(result.questions.map((question) => question.key)).size, 30)
    assert.deepEqual(validateLiePaper(result.questions), [])
    for (const question of result.questions) {
      assert.deepEqual(verifyLieRecord(question), [], `${question.id} 复核失败`)
    }
  }
})

test('连续两卷零复用：同骨架不同卷不再出同题', () => {
  const memory = new MemoryStore()
  const first = generateLie({ grade: '3A', unitIds: ['3A-U1'], level: 'L2', count: 30, seed: 1 })
  memory.beginPaper()
  for (const question of first.questions) memory.record(question.key)
  const second = generateLie({
    grade: '3A',
    unitIds: ['3A-U1'],
    level: 'L2',
    count: 30,
    seed: 2,
    memory,
  })
  assert.equal(second.questions.length, 30)
  assert.equal(second.crossReused, 0)
  const firstKeys = new Set(first.questions.map((question) => question.key))
  assert.equal(second.questions.filter((question) => firstKeys.has(question.key)).length, 0)
  assert.equal(new Set(second.questions.map((question) => question.stem)).size, 30)
})

test('复核拦截题干被篡改 / 答案被篡改', () => {
  const result = generateLie({ grade: '3A', unitIds: ['3A-U1'], level: 'L1', count: 3, seed: 77 })
  const question = result.questions[0]

  const stemTampered = { ...question, stem: question.stem.replace(/\d+/, '9999') }
  assert.ok(verifyLieRecord(stemTampered).length > 0)

  const answerTampered = { ...question, answer: String(Number(question.answer) + 1) }
  assert.ok(verifyLieRecord(answerTampered).some((issue) => issue.includes('结果复核不符')))
})
