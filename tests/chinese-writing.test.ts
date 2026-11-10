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

test('习作：8 个单元各两条（正题 + 备选），正题篇目与方案 §1.2 一致', () => {
  assert.equal(WRITING_PROMPTS.length, 16)
  EXPECTED.forEach(([unitId, title], index) => {
    const prompt = WRITING_PROMPTS[index]
    assert.equal(prompt.unitId, unitId, `第 ${index + 1} 条单元不符`)
    assert.equal(prompt.title, title, `${unitId} 篇目不符`)

    const backup = WRITING_PROMPTS[index + 8]
    assert.ok(backup, `${unitId} 缺备选题目`)
    assert.equal(backup.unitId, unitId, `${unitId} 备选题单元不符`)
    assert.equal(backup.title, `${title}（备选）`, `${unitId} 备选题应加“（备选）”后缀`)
    const sameUnit = WRITING_PROMPTS.filter((item) => item.unitId === unitId)
    assert.equal(sameUnit.length, 2, `${unitId} 应各两条（正题 + 备选）`)
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

test('习作：每条评分标准分项清楚，合计 30 分，并给 A/B/C 三档', () => {
  for (const prompt of WRITING_PROMPTS) {
    assert.equal(prompt.scoring.total, 30, `${prompt.id} 评分总分不是 30`)
    assert.ok(prompt.scoring.rows.length >= 4, `${prompt.id} 评分分项不足`)

    const sum = prompt.scoring.rows.reduce((total, row) => total + row.points, 0)
    assert.equal(sum, prompt.scoring.total, `${prompt.id} 分项分值合计与总分不符`)

    const aspects = prompt.scoring.rows.map((row) => row.aspect)
    assert.ok(aspects.includes('内容'), `${prompt.id} 缺内容分项`)
    assert.ok(aspects.includes('条理'), `${prompt.id} 缺条理分项`)
    assert.ok(aspects.includes('语言'), `${prompt.id} 缺语言分项`)
    assert.ok(aspects.includes('标点与书写'), `${prompt.id} 缺标点与书写分项`)

    for (const row of prompt.scoring.rows) {
      assert.ok(row.points > 0, `${prompt.id} 分项分值为 0`)
      assert.ok(row.description.length >= 10, `${prompt.id} 分项说明过短`)
    }

    assert.deepEqual(
      prompt.scoring.bands.map((band) => band.band).sort(),
      ['A', 'B', 'C'],
      `${prompt.id} 缺档位`,
    )
    for (const band of prompt.scoring.bands) {
      assert.ok(band.label.length > 0, `${prompt.id} 档位缺名称`)
      assert.ok(band.description.length >= 15, `${prompt.id} 档位描述过短`)
    }
  }
})

test('习作：评分标准只给家长面批，数据里没有自动判分字段', () => {
  for (const prompt of WRITING_PROMPTS) {
    const forbidden = ['score', 'autoScore', 'grade', 'level', 'autoGrade', 'machineScore', '范文']
    for (const key of Object.keys(prompt)) {
      assert.ok(!forbidden.includes(key), `${prompt.id} 出现自动判分字段：${key}`)
    }
    assert.ok(prompt.scoring, `${prompt.id} 缺家长评分标准`)
  }
})

test('习作：第 1 单元按短文写，第 3 单元给出可直接续写的开头', () => {
  const first = WRITING_PROMPTS.find((prompt) => prompt.unitId === '3A-U1')
  assert.ok(first, '缺 U1')
  assert.ok(first.prompt.includes('短文'), 'U1 字数 200–300，提示应写“短文”而不是“一段话”')

  const third = WRITING_PROMPTS.find((prompt) => prompt.unitId === '3A-U3')
  assert.ok(third, '缺 U3')
  assert.ok(third.storyOpening, 'U3 缺故事开头')
  assert.ok(third.storyOpening.length >= 40, 'U3 故事开头过短')
  assert.ok(third.prompt.includes('开头'), 'U3 提示没有要求学生接着开头写')
  assert.ok(third.requirements.some((item) => item.includes('接着')), 'U3 要求没有写“接着开头”')

  for (const prompt of WRITING_PROMPTS.filter((item) => item.unitId !== '3A-U3')) {
    assert.ok(!prompt.storyOpening, `${prompt.id} 不应有续写开头`)
  }
})

test('习作：复核记录覆盖修订版篇目与评分标准', () => {
  const review = WRITING_BANK_META.review
  assert.ok(review.pass2.includes('那次经历真难忘'), '复核记录没有核对第 8 单元新题')
  assert.ok(review.pass2.includes('故事开头'), '复核记录没有说明第 3 单元补开头')
  assert.ok(review.mechanical.length >= 5, '机械校验条目不足')
  assert.ok(review.mechanical.some((line) => line.includes('评分标准')), '缺评分标准校验')
  assert.ok(review.samples.length >= 2, '缺少抽查记录')
})
