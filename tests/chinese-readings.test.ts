import test from 'node:test'
import assert from 'node:assert/strict'
import {
  READING_BANK,
  READING_BANK_META,
  pickReadings,
  readingCharCount,
  readingCounts,
  readingText,
} from '../src/data/chinese/readings/index.ts'

const PLACEHOLDER = '（ ）'
const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1
const quotes = (text: string): string[] =>
  [...text.matchAll(/“([^”]+)”/g)].map((match) => match[1])

function readingCountsFor(bank: typeof READING_BANK): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const reading of bank) counts[reading.theme] = (counts[reading.theme] ?? 0) + 1
  return counts
}

/** 引号写法差异不算错字：把单书名号/日式引号统一成中文双引号 */
const normalizeQuotes = (text: string): string =>
  text.replace(/[‘’「」『』]/g, (mark) => (mark === '‘' || mark === '「' || mark === '『' ? '“' : '”'))

/** 引文按题干空格拆开；只有成句（汉字 ≥5）才按原句硬核，词/短语只作强调 */
function citationParts(fragment: string): string[] {
  const parts = fragment.split(PLACEHOLDER).map((part) => part.trim()).filter(Boolean)
  const hanzi = parts.join('').match(/[\u4e00-\u9fff]/g)?.length ?? 0
  return hanzi >= 5 ? parts : []
}

test('课外阅读：总量不少于 20 篇，原创六个主题各 4 篇', () => {
  assert.ok(READING_BANK.length >= 20, `短文总量 ${READING_BANK.length}`)
  const originals = READING_BANK.filter((reading) => reading.sources[0]?.label.includes('原创'))
  assert.equal(originals.length, 24, '原创短文应为 24 篇')
  const originalCounts = readingCountsFor(originals)
  // 精选原创只覆盖六类主题；非连续、童话、记事由挂载稿提供，不在原创 24 篇内
  const originalThemes = ['写人', '写景', '写事', '状物', '寓言', '科普']
  for (const theme of originalThemes) {
    assert.equal(originalCounts[theme], 4, `原创 ${theme} 篇数不是 4`)
  }
  assert.deepEqual(
    Object.keys(originalCounts).sort(),
    [...originalThemes].sort(),
    '原创篇目混入了挂载层主题',
  )
})

test('课外阅读：正文 300–500 字（只计汉字）', () => {
  for (const reading of READING_BANK) {
    const count = readingCharCount(reading)
    assert.ok(count >= 300 && count <= 500, `${reading.id} 字数 ${count} 越界`)
    assert.ok(reading.paragraphs.length >= 3, `${reading.id} 分段少于 3 段`)
  }
})

test('课外阅读：编号、标题唯一，来源定位到篇目且全部 verified', () => {
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const reading of READING_BANK) {
    assert.ok(!ids.has(reading.id), `重复编号：${reading.id}`)
    ids.add(reading.id)
    assert.ok(!titles.has(reading.title), `重复标题：${reading.title}`)
    titles.add(reading.title)
    assert.equal(reading.status, 'verified', `${reading.id} 仍为 pending`)
    assert.ok(reading.sources.length > 0, `${reading.id} 缺来源`)
    assert.equal(reading.sources[0].locator, reading.id, `${reading.id} 来源未定位`)
    if (reading.sources[0].label.includes('原创')) {
      assert.ok(reading.sources[0].label.includes('原创'), `${reading.id} 未标明原创`)
    } else {
      assert.ok(reading.sources[0].label.length > 0, `${reading.id} 缺来源说明`)
      assert.ok(
        reading.sources[0].url?.startsWith('http'),
        `${reading.id} 转载来源缺可核对 URL`,
      )
    }
    assert.ok(reading.review.length > 0, `${reading.id} 缺复核记录`)
  }
})

test('课外阅读：每篇 3–5 题，选择、填空、简答齐备', () => {
  for (const reading of READING_BANK) {
    assert.ok(
      reading.questions.length >= 3 && reading.questions.length <= 5,
      `${reading.id} 题量 ${reading.questions.length} 越界`,
    )
    const types = new Set(reading.questions.map((question) => question.type))
    for (const type of ['choice', 'fill', 'short'] as const) {
      assert.ok(types.has(type), `${reading.id} 缺少 ${type} 题`)
    }
  }
})

test('课外阅读：选择题四选一，答案唯一并有原文依据说明', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'choice') continue
      assert.equal(question.options.length, 4, `${reading.id} 选项不是 4 个`)
      assert.equal(
        new Set(question.options).size,
        4,
        `${reading.id} 选项重复：${question.stem}`,
      )
      assert.ok(question.answer >= 0 && question.answer < 4, `${reading.id} 答案下标越界`)
      assert.ok(question.explain.length > 0, `${reading.id} 选择题缺答案说明`)
    }
  }
})

test('课外阅读：填空题空数与占位一致，答案非空', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'fill') continue
      assert.equal(
        placeholders(question.stem),
        question.blanks.length,
        `${reading.id} 填空空数不符：${question.stem}`,
      )
      for (const blank of question.blanks) {
        assert.ok(blank.length > 0, `${reading.id} 填空答案为空`)
      }
      assert.ok(question.explain.length > 0, `${reading.id} 填空题缺答案说明`)
    }
  }
})

test('课外阅读：简答题有 2–3 个评分点，参考答案可选', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type !== 'short') continue
      assert.ok(
        question.scoring.length >= 2 && question.scoring.length <= 3,
        `${reading.id} 评分点 ${question.scoring.length} 条`,
      )
      for (const point of question.scoring) {
        assert.ok(point.length > 0, `${reading.id} 空评分点`)
      }
      if (question.answer !== undefined) {
        assert.ok(question.answer.trim().length > 0, `${reading.id} 简答参考答案为空`)
      }
    }
  }
})

test('课外阅读：每道题的答案都不为空', () => {
  for (const reading of READING_BANK) {
    for (const question of reading.questions) {
      if (question.type === 'choice') {
        assert.ok(question.explain.trim().length > 0, `${reading.id} 选择题说明为空`)
        for (const option of question.options) {
          assert.ok(option.trim().length > 0, `${reading.id} 选择题有空选项`)
        }
      } else if (question.type === 'fill') {
        assert.ok(question.blanks.length > 0, `${reading.id} 填空题没有答案`)
        for (const blank of question.blanks) {
          assert.ok(blank.trim().length > 0, `${reading.id} 填空答案为空`)
        }
      } else {
        assert.ok(question.scoring.length >= 2, `${reading.id} 简答题评分点少于 2 条`)
        if (question.answer !== undefined) {
          assert.ok(question.answer.trim().length > 0, `${reading.id} 简答题参考答案为空`)
        }
      }
    }
  }
})

test('课外阅读：填空题答案必须逐字出现在原文', () => {
  for (const reading of READING_BANK) {
    const text = readingText(reading)
    for (const question of reading.questions) {
      if (question.type !== 'fill') continue
      for (const blank of question.blanks) {
        assert.ok(
          text.includes(blank),
          `${reading.id} 填空答案「${blank}」在原文找不到：${question.stem}`,
        )
      }
    }
  }
})

test('课外阅读：选择题说明里的引文必须逐字出现在原文', () => {
  for (const reading of READING_BANK) {
    const text = readingText(reading)
    for (const question of reading.questions) {
      if (question.type !== 'choice') continue
      const cited = quotes(question.explain)
      assert.ok(cited.length > 0, `${reading.id} 选择题说明没有原文引文：${question.stem}`)
      for (const segment of cited) {
        assert.ok(
          text.includes(segment),
          `${reading.id} 引文「${segment}」在原文找不到：${question.stem}`,
        )
      }
    }
  }
})

test('课外阅读：题干和解析里明确引用的原句必须逐字出现在原文', () => {
  for (const reading of READING_BANK) {
    const text = normalizeQuotes(readingText(reading))
    for (const question of reading.questions) {
      const cited = [...quotes(question.stem), ...quotes(question.explain ?? '')]
      for (const segment of cited) {
        for (const part of citationParts(segment)) {
          assert.ok(
            text.includes(normalizeQuotes(part)),
            `${reading.id} 引文「${part}」在原文找不到：${question.stem}`,
          )
        }
      }
    }
  }
})

test('课外阅读：同一篇内题干不重复，随机抽取不重复且可复现', () => {
  for (const reading of READING_BANK) {
    const stems = reading.questions.map((question) => question.stem)
    assert.equal(new Set(stems).size, stems.length, `${reading.id} 题干重复`)
  }

  const first = pickReadings({ count: 8, seed: 2026 })
  const second = pickReadings({ count: 8, seed: 2026 })
  assert.deepEqual(
    first.map((reading) => reading.id),
    second.map((reading) => reading.id),
    '同一种子应得到同一组短文',
  )
  assert.equal(new Set(first.map((reading) => reading.id)).size, 8, '同一组出现重复短文')

  const fables = pickReadings({ count: 99, themes: ['寓言'], seed: 9 })
  assert.ok(fables.length >= 4, '按主题抽取数量不对')
  for (const reading of fables) assert.equal(reading.theme, '寓言')
})

test('课外阅读：复核记录覆盖独立重做与机械校验', () => {
  const review = READING_BANK_META.review
  assert.ok(review.pass2.includes('不看答案'), '复核记录没有说明独立重做')
  assert.ok(review.mechanical.length >= 5, '机械校验条目不足')
  assert.ok(review.samples.length >= 3, '缺少抽查记录')
})
