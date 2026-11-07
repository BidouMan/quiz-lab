import test from 'node:test'
import assert from 'node:assert/strict'
import type { GuanlianRelation } from '../src/data/chinese/types.ts'
import {
  BIAODIAN_ITEMS,
  BIAODIAN_MARKS,
  BIYU_MARKERS,
  FANGXIE_ITEMS,
  GAIBING_ITEMS,
  GUANLIAN_ITEMS,
  GUANLIAN_RELATIONS,
  GUANLIAN_WORDS,
  KUOXIE_ITEMS,
  SENTENCE_BANK,
  SENTENCE_BANK_META,
  pickSentences,
  sentenceCounts,
} from '../src/data/chinese/sentences/index.ts'

const PLACEHOLDER = '（ ）'

const placeholders = (text: string): number => text.split(PLACEHOLDER).length - 1

const sortedChars = (text: string): string => [...text].sort().join('')

/** fixed 是否恰为 broken 插入了 replacement（成分残缺的判定） */
const isInsertion = (broken: string, fixed: string, replacement: string): boolean => {
  if (fixed.length !== broken.length + replacement.length) return false
  for (let i = 0; i <= broken.length; i += 1) {
    if (fixed === broken.slice(0, i) + replacement + broken.slice(i)) return true
  }
  return false
}

/** 一组完整答案是否符合该类关联词的搭配，用于机器核对「答案集与语境一致」 */
const isValidPair = (relation: GuanlianRelation, combo: string[]): boolean => {
  const [a, b] = combo
  if (combo.length !== 2) return false
  switch (relation) {
    case '因果':
      return (a === '因为' || a === '由于') && (b === '所以' || b === '因此')
    case '转折':
      return (a === '虽然' || a === '尽管') && (b === '但是' || b === '可是' || b === '还是')
    case '假设':
      return (a === '如果' || a === '要是') && (b === '就' || b === '便')
    case '并列':
      return (
        ((a === '一边' || a === '一面') && (b === '一边' || b === '一面')) ||
        (a === '不是' && b === '而是')
      )
    case '并列递进':
      return (
        (a === '既' && (b === '又' || b === '也')) ||
        ((a === '不但' || a === '不仅') && (b === '而且' || b === '还')) ||
        (a === '不是' && b === '而是')
      )
    case '承接':
      return ((a === '先' || a === '首先') && (b === '再' || b === '然后')) || (a === '一' && b === '就')
    case '递进':
      return (a === '不但' || a === '不仅') && (b === '而且' || b === '还')
    case '条件':
      return (a === '只要' && (b === '就' || b === '便')) || (a === '只有' && b === '才')
    default:
      return false
  }
}

const balanced = (combo: string[], open: string, close: string): boolean => {
  let depth = 0
  for (const mark of combo) {
    if (mark === open) depth += 1
    if (mark === close) depth -= 1
    if (depth < 0) return false
  }
  return depth === 0
}

test('句子题库：五类题量均在 30–50 条，总数与分项统计一致', () => {
  const counts = sentenceCounts()
  for (const [kind, count] of Object.entries(counts)) {
    assert.ok(count >= 30 && count <= 50, `${kind} 题量 ${count} 不在 30–50`)
  }
  assert.equal(SENTENCE_BANK.length, 184, '题库总数应为 40+36×4')
  assert.equal(
    counts.gaibing + counts.kuoxie + counts.guanlian + counts.biaodian + counts.fangxie,
    SENTENCE_BANK.length,
  )
})

test('句子题库：编号唯一，来源定位到编号，全部 verified', () => {
  const ids = new Set<string>()
  for (const item of SENTENCE_BANK) {
    assert.ok(!ids.has(item.id), `重复编号：${item.id}`)
    ids.add(item.id)
    assert.equal(item.status, 'verified', `${item.id} 仍为 pending`)
    assert.ok(item.sources.length > 0, `${item.id} 缺来源`)
    assert.equal(item.sources[0].locator, item.id, `${item.id} 来源未定位到条目`)
    assert.ok(item.explain.length > 0, `${item.id} 缺少说明`)
    assert.ok(item.answerCount >= 1, `${item.id} 没有声明答案数量`)
  }
})

test('句子题库：每类覆盖 A/B/C，A 档比例降到真实基础题范围', () => {
  for (const kind of ['gaibing', 'kuoxie', 'guanlian', 'biaodian', 'fangxie'] as const) {
    const levels = new Set(
      SENTENCE_BANK.filter((item) => item.kind === kind).map((item) => item.level),
    )
    assert.deepEqual([...levels].sort(), ['A', 'B', 'C'], `${kind} 难度档位不全`)

    const a = SENTENCE_BANK.filter((item) => item.kind === kind && item.level === 'A').length
    const b = SENTENCE_BANK.filter((item) => item.kind === kind && item.level === 'B').length
    const c = SENTENCE_BANK.filter((item) => item.kind === kind && item.level === 'C').length
    assert.ok(a >= 4 && a <= 8, `${kind} A 档 ${a} 条不在 4–8`)
    assert.ok(b >= 12, `${kind} B 档 ${b} 条偏少`)
    assert.ok(c >= 12, `${kind} C 档 ${c} 条偏少`)
  }

  const aTotal = SENTENCE_BANK.filter((item) => item.level === 'A').length
  assert.ok(aTotal <= 40, `A 档共 ${aTotal} 条，占比仍偏高`)
})

test('修改病句：四类各 10 条，答案可机械复核，开放题明确标注', () => {
  const subtypes = ['成分残缺', '搭配不当', '语序颠倒', '重复啰嗦'] as const
  for (const sub of subtypes) {
    assert.equal(GAIBING_ITEMS.filter((item) => item.subkind === sub).length, 10, `${sub} 条数`)
  }

  for (const item of GAIBING_ITEMS) {
    assert.ok(item.instruction.length > 0, `${item.id} 缺题干指令`)
    assert.ok(item.broken.endsWith('。'), `${item.id} 病句应以句号结尾`)
    assert.notEqual(item.fixed, item.broken, `${item.id} 没有改动`)
    assert.equal(item.answerCount, 1 + item.acceptable.length, `${item.id} 答案数量声明不符`)
    for (const alt of item.acceptable) {
      assert.notEqual(alt, item.broken, `${item.id} 可接受答案与病句相同`)
      assert.notEqual(alt, item.fixed, `${item.id} 可接受答案与主答案重复`)
      assert.ok(alt.endsWith('。'), `${item.id} 可接受答案应以句号结尾`)
    }

    if (item.subkind === '成分残缺') {
      assert.equal(item.judging, 'rubric', `${item.id} 成分残缺是开放题，应标 rubric`)
      assert.equal(item.answerKind, 'multiple', `${item.id} 成分残缺应有多条示例`)
      assert.ok(item.acceptable.length >= 2, `${item.id} 成分残缺示例不足 3 条`)
      assert.equal(item.defect, '', `${item.id} 成分残缺不应有 defect`)
      assert.ok(item.replacement.length > 0, `${item.id} 没给出补上的成分`)
      assert.ok(
        isInsertion(item.broken, item.fixed, item.replacement),
        `${item.id} 不是纯插入式补全`,
      )
      continue
    }

    assert.equal(item.judging, 'auto', `${item.id} 客观题应标 auto`)
    assert.equal(
      item.answerKind,
      item.acceptable.length > 0 ? 'multiple' : 'unique',
      `${item.id} 答案种类声明不符`,
    )

    if (item.subkind === '搭配不当') {
      assert.ok(item.broken.includes(item.defect), `${item.id} 病句里找不到 defect`)
      assert.equal(
        item.fixed,
        item.broken.replace(item.defect, item.replacement),
        `${item.id} 搭配修改不是一次替换`,
      )
    } else if (item.subkind === '重复啰嗦') {
      assert.ok(item.broken.includes(item.defect), `${item.id} 病句里找不到 defect`)
      assert.equal(item.replacement, '', `${item.id} 重复类应删除而不是替换`)
      assert.equal(
        item.fixed,
        item.broken.replace(item.defect, ''),
        `${item.id} 重复修改不是一次删除`,
      )
    } else {
      assert.ok(
        sortedChars(item.broken) === sortedChars(item.fixed),
        `${item.id} 语序调整改动了字词`,
      )
    }
  }
})

test('修改病句：GB-40 不再误判“天空上”', () => {
  const item = GAIBING_ITEMS.find((candidate) => candidate.id === 'GB-40')
  assert.ok(item, '缺少 GB-40')
  assert.ok(item.fixed.includes('天空上'), 'GB-40 不应把“天空上”改掉')
  assert.ok(item.broken.includes('秋天的'), 'GB-40 应保留原来的重复成分')
  assert.equal(item.replacement, '', 'GB-40 应通过删除重复成分修正')
})

test('扩写句子：取消指定词硬约束，按评分点标注开放题', () => {
  const bases = KUOXIE_ITEMS.map((item) => item.base)
  assert.equal(new Set(bases).size, bases.length, '扩写原句出现重复')

  for (const item of KUOXIE_ITEMS) {
    assert.equal(item.judging, 'rubric', `${item.id} 扩写是开放题，应标 rubric`)
    assert.equal(item.answerKind, 'multiple', `${item.id} 扩写应给多种写法`)
    assert.equal(item.answerCount, item.samples.length, `${item.id} 示例数量声明不符`)
    assert.ok(item.samples.length >= 2, `${item.id} 参考答案少于 2 条`)
    assert.ok(item.hints.length >= 3, `${item.id} 提示角不足`)
    assert.ok(item.rubric.length >= 3, `${item.id} 评分点不足`)
    assert.ok(!('requiredParts' in item), `${item.id} 仍保留指定词硬约束`)

    for (const sample of item.samples) {
      assert.ok(sample.length > item.base.length, `${item.id} 参考答案没有扩写`)
      for (const part of item.keep) {
        assert.ok(sample.includes(part), `${item.id} 答案缺少主干「${part}」`)
      }
      assert.match(sample, /[。！？]$/, `${item.id} 答案没有句末标点`)
    }
  }
})

test('关联词填空：空数一致，答案集穷举且与关系类型相符', () => {
  const whitelist = new Set<string>(GUANLIAN_WORDS)
  const relationWords = new Set<string>()
  for (const words of Object.values(GUANLIAN_RELATIONS)) {
    for (const word of words) relationWords.add(word)
  }
  assert.deepEqual([...relationWords].sort(), [...whitelist].sort(), '关系词表与白名单不一致')

  for (const item of GUANLIAN_ITEMS) {
    assert.ok(item.instruction.length > 0, `${item.id} 缺题干指令`)
    assert.ok(item.answers.length >= 1, `${item.id} 答案集为空`)
    assert.equal(item.answerCount, item.answers.length, `${item.id} 答案数量声明不符`)
    assert.equal(
      item.answerKind,
      item.answers.length > 1 ? 'multiple' : 'unique',
      `${item.id} 答案种类声明不符`,
    )
    assert.equal(
      new Set(item.answers.map((combo) => combo.join('｜'))).size,
      item.answers.length,
      `${item.id} 出现重复答案组合`,
    )

    const blanks = placeholders(item.text)
    for (const combo of item.answers) {
      assert.equal(combo.length, blanks, `${item.id} 答案组合长度与空数不符`)
      for (const word of combo) {
        assert.ok(whitelist.has(word), `${item.id} 超纲关联词「${word}」`)
        assert.ok(
          GUANLIAN_RELATIONS[item.relation].includes(word),
          `${item.id} 答案「${word}」不属于${item.relation}关系`,
        )
      }
      assert.ok(
        isValidPair(item.relation, combo),
        `${item.id} 答案组合「${combo.join('……')}」与${item.relation}语境不符`,
      )
    }
    assert.ok(item.pair.length > 0, `${item.id} 缺少关联词搭配`)
  }
})

test('标点符号：空数一致，答案组合穷举且引号书名号成对', () => {
  const marks = new Set<string>(BIAODIAN_MARKS)
  for (const item of BIAODIAN_ITEMS) {
    assert.ok(item.instruction.length > 0, `${item.id} 缺题干指令`)
    assert.ok(item.answers.length >= 1, `${item.id} 答案集为空`)
    assert.equal(item.answerCount, item.answers.length, `${item.id} 答案数量声明不符`)
    assert.equal(
      item.answerKind,
      item.answers.length > 1 ? 'multiple' : 'unique',
      `${item.id} 答案种类声明不符`,
    )
    assert.equal(
      new Set(item.answers.map((combo) => combo.join(''))).size,
      item.answers.length,
      `${item.id} 出现重复答案组合`,
    )

    const blanks = placeholders(item.text)
    for (const combo of item.answers) {
      assert.equal(combo.length, blanks, `${item.id} 答案组合长度与空数不符`)
      for (const mark of combo) {
        assert.ok(marks.has(mark), `${item.id} 超纲标点「${mark}」`)
      }
      assert.ok(balanced(combo, '“', '”'), `${item.id} 引号不成对`)
      assert.ok(balanced(combo, '《', '》'), `${item.id} 书名号不成对`)
      assert.ok(!['”', '》'].includes(combo[0]), `${item.id} 答案以收束引号或书名号开头`)
      assert.ok(!['“', '《'].includes(combo[combo.length - 1]), `${item.id} 答案以开启标点结尾`)
    }
  }

  for (const item of BIAODIAN_ITEMS.filter((candidate) => candidate.level === 'A')) {
    assert.ok(placeholders(item.text) >= 2, `${item.id} A 档不应只考句末标点`)
  }
})

test('比喻与拟人：补齐评分点，参考答案只做初筛不锁死答案', () => {
  const examples = FANGXIE_ITEMS.map((item) => item.example)
  assert.equal(new Set(examples).size, examples.length, '仿写例句出现重复')

  for (const item of FANGXIE_ITEMS) {
    assert.equal(item.judging, 'rubric', `${item.id} 仿写是开放题，应标 rubric`)
    assert.equal(item.answerKind, 'multiple', `${item.id} 仿写应给多种写法`)
    assert.equal(item.answerCount, item.samples.length, `${item.id} 示例数量声明不符`)
    assert.ok(item.samples.length >= 2, `${item.id} 参考答案少于 2 条`)
    assert.ok(item.rubric.length >= 3, `${item.id} 评分点不足`)
    assert.ok(item.guide.length > 0, `${item.id} 缺少写法引导`)
    if (item.level === 'A') {
      assert.ok(item.prompt.includes('判断'), `${item.id} A 档应先判断比喻还是拟人`)
    }

    for (const sample of item.samples) {
      assert.notEqual(sample, item.example, `${item.id} 答案与例句重复`)
      assert.match(sample, /[。！？]$/, `${item.id} 答案没有句末标点`)
      if (item.mode === '比喻') {
        const hit = BIYU_MARKERS.some((marker) => sample.includes(marker))
        assert.ok(hit, `${item.id} 比喻句没有比喻词：${sample}`)
      } else {
        assert.ok(
          item.keywords.some((keyword) => sample.includes(keyword)),
          `${item.id} 拟人句没有可对照的动作词：${sample}`,
        )
      }
    }
  }
})

test('句子题库：随机抽取同卷不重复，固定种子可复现', () => {
  const first = pickSentences({ count: 40, seed: 12345 })
  const second = pickSentences({ count: 40, seed: 12345 })
  assert.deepEqual(
    first.map((item) => item.id),
    second.map((item) => item.id),
    '同一种子应得到同一组题',
  )
  assert.equal(new Set(first.map((item) => item.id)).size, 40, '同一卷内出现重复题')

  const mixed = pickSentences({
    count: 20,
    kinds: ['gaibing', 'guanlian'],
    levels: ['B'],
    seed: 7,
  })
  assert.ok(mixed.length <= 20, '抽题数超过请求')
  for (const item of mixed) {
    assert.equal(item.level, 'B')
    assert.ok(item.kind === 'gaibing' || item.kind === 'guanlian')
  }

  const overflow = pickSentences({ count: 9999, kinds: ['kuoxie'], seed: 1 })
  assert.equal(overflow.length, KUOXIE_ITEMS.length, '抽不满时应返回全部可用题')
})

test('句子题库：复核记录说明返修口径与机器/人工边界', () => {
  const review = SENTENCE_BANK_META.review
  assert.ok(review.pass2.includes('不看成句答案'), '复核记录没有说明独立重做')
  assert.ok(review.pass2.includes('参考评分点'), '复核记录没有说明开放题不自动判分')
  assert.ok(review.mechanical.length >= 7, '机械校验条目不足')
  assert.ok(review.mechanical.some((line) => line.includes('relation')), '缺关联词语境校验')
  assert.ok(review.mechanical.some((line) => line.includes('answerCount')), '缺答案数量声明校验')
  assert.ok(review.samples.length >= 5, '缺少抽查记录')
})
