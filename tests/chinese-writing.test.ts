import test from 'node:test'
import assert from 'node:assert/strict'
import { WRITING_BANK_META, WRITING_PROMPTS } from '../src/data/chinese/writing.ts'

const EXPECTED = [
  ['3A-U1', '猜猜他是谁'],
  ['3A-U2', '写日记'],
  ['3A-U3', '续写故事'],
  ['3A-U4', '我来编童话'],
  ['3A-U5', '我们眼中的缤纷世界'],
  ['3A-U6', '这儿真美'],
  ['3A-U7', '我有一个想法'],
  ['3A-U8', '那次经历真难忘'],
] as const

test('习作：8 个单元各一条，篇目与方案 §1.2 一致', () => {
  assert.equal(WRITING_PROMPTS.length, 8)
  EXPECTED.forEach(([unitId, title], index) => {
    const prompt = WRITING_PROMPTS[index]
    assert.equal(prompt.unitId, unitId, `第 ${index + 1} 条单元不符`)
    assert.equal(prompt.title, title, `${unitId} 篇目不符`)
  })
})

test('习作：编号与篇目唯一，全部 verified 且来源可定位', () => {
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const prompt of WRITING_PROMPTS) {
    assert.ok(!ids.has(prompt.id), `重复编号：${prompt.id}`)
    ids.add(prompt.id)
    assert.ok(!titles.has(prompt.title), `重复篇目：${prompt.title}`)
    titles.add(prompt.title)
    assert.equal(prompt.status, 'verified', `${prompt.id} 仍为 pending`)
    assert.ok(prompt.sources.length >= 2, `${prompt.id} 来源不足`)
    assert.ok(
      prompt.sources.some((source) => source.locator?.includes(prompt.unitId)),
      `${prompt.id} 来源未定位到单元`,
    )
  }
})

test('习作：每条有题目、提示、2–3 条要求与合理字数', () => {
  for (const prompt of WRITING_PROMPTS) {
    assert.ok(prompt.title.length > 0, `${prompt.id} 缺题目`)
    assert.ok(prompt.prompt.length >= 40, `${prompt.id} 写作提示过短`)
    assert.ok(
      prompt.requirements.length >= 2 && prompt.requirements.length <= 3,
      `${prompt.id} 要求条数不是 2–3`,
    )
    for (const requirement of prompt.requirements) {
      assert.ok(requirement.length > 0, `${prompt.id} 空要求`)
    }
    const { min, max } = prompt.wordCount
    assert.ok(min >= 200 && max <= 450, `${prompt.id} 字数要求超出三上范围`)
    assert.ok(max > min, `${prompt.id} 字数上限不大于下限`)
  }
})

test('习作：只出题，不含评分、等级或范文', () => {
  for (const prompt of WRITING_PROMPTS) {
    const forbidden = ['score', 'scoring', 'rubric', 'grade', 'level', 'sample', '范文']
    for (const key of Object.keys(prompt)) {
      assert.ok(!forbidden.includes(key), `${prompt.id} 出现判分字段：${key}`)
    }
  }
})

test('习作：复核记录覆盖修订版篇目核对', () => {
  const review = WRITING_BANK_META.review
  assert.ok(review.pass2.includes('那次经历真难忘'), '复核记录没有核对第 8 单元新题')
  assert.ok(review.mechanical.length >= 4, '机械校验条目不足')
  assert.ok(review.samples.length >= 2, '缺少抽查记录')
})
