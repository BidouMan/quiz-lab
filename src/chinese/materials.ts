/**
 * 语文出卷引擎的素材层：把 `src/data/chinese` 的题库整理成「可直接进卷」的候选题。
 *
 * 数据层不负责卷面标注，这里补三类试卷标注，全部在注释中标明来源：
 * - 词语拼音：`ChineseWord` 没有拼音字段，词语表也不给轻声，按常用读音标注；
 * - 注音语境词：用于区分多音字，只作题目提示，不改数据层读音；
 * - 形近字组：题面字取写字表，配对字与答案词为卷面标注，答案不唯一。
 * 这些标注只影响卷面呈现，不改动 `src/data/chinese` 的 verified 结论。
 */

import { CHINESE_CURRICULUM_3A } from '../data/chinese/curriculum.ts'
import { SENTENCE_BANK, sentenceKindLabel } from '../data/chinese/sentences/index.ts'
import { PRACTICE_READING_BANK } from '../data/chinese/readings/index.ts'
import { WRITING_PROMPTS } from '../data/chinese/writing.ts'
import type {
  ChineseLesson,
  ChineseLevel,
  ChineseReading,
  ChineseSentenceKind,
  ChinesePoem,
} from '../data/chinese/types.ts'
import type {
  ChineseAnswerMode,
  ChinesePaperItem,
  ChinesePaperTypeId,
  GushiDimoItem,
  GushiFillItem,
  KanpinyinItem,
  ReadingPaperItem,
  WritingPaperItem,
  XingjinItem,
  ZhuyinItem,
} from './types.ts'

// ==================== 题型元数据 ====================

export interface ChinesePaperTypeMeta {
  typeId: ChinesePaperTypeId
  label: string
  group: '字词' | '积累' | '句子' | '阅读' | '习作' | '卷面'
  defaultPerItemScore: number
  /** 素材是否有逐题难度标注；没有的题型按 baselineLevel 整体出题 */
  itemLevels: boolean
  baselineLevel: ChineseLevel
  /** count 的单位，给界面与摘要用 */
  countUnit: '题' | '空' | '组' | '首' | '篇'
}

export const CHINESE_PAPER_TYPE_META: Record<ChinesePaperTypeId, ChinesePaperTypeMeta> = {
  kanpinyin: {
    typeId: 'kanpinyin',
    label: '看拼音写词语',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: false,
    baselineLevel: 'A',
    countUnit: '题',
  },
  zhuyin: {
    typeId: 'zhuyin',
    label: '给加点字注音',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'A',
    countUnit: '题',
  },
  xingjin: {
    typeId: 'xingjin',
    label: '形近字组词',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: false,
    baselineLevel: 'A',
    countUnit: '组',
  },
  'gushi-fill': {
    typeId: 'gushi-fill',
    label: '古诗补全',
    group: '积累',
    defaultPerItemScore: 2,
    itemLevels: false,
    baselineLevel: 'A',
    countUnit: '题',
  },
  'gushi-dimo': {
    typeId: 'gushi-dimo',
    label: '古诗默写',
    group: '积累',
    defaultPerItemScore: 3,
    itemLevels: false,
    baselineLevel: 'B',
    countUnit: '首',
  },
  gaibing: {
    typeId: 'gaibing',
    label: '修改病句',
    group: '句子',
    defaultPerItemScore: 2,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  guanlian: {
    typeId: 'guanlian',
    label: '关联词填空',
    group: '句子',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  biaodian: {
    typeId: 'biaodian',
    label: '标点符号',
    group: '句子',
    defaultPerItemScore: 2,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  kuoxie: {
    typeId: 'kuoxie',
    label: '扩写句子',
    group: '句子',
    defaultPerItemScore: 2,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  fangxie: {
    typeId: 'fangxie',
    label: '仿写句子',
    group: '句子',
    defaultPerItemScore: 2,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  reading: {
    typeId: 'reading',
    label: '课外阅读',
    group: '阅读',
    defaultPerItemScore: 12,
    itemLevels: false,
    baselineLevel: 'B',
    countUnit: '篇',
  },
  writing: {
    typeId: 'writing',
    label: '习作',
    group: '习作',
    defaultPerItemScore: 30,
    itemLevels: false,
    baselineLevel: 'C',
    countUnit: '篇',
  },
  lianmian: {
    typeId: 'lianmian',
    label: '卷面书写',
    group: '卷面',
    defaultPerItemScore: 3,
    itemLevels: false,
    baselineLevel: 'A',
    countUnit: '题',
  },
}

export const CHINESE_PAPER_TYPE_IDS = Object.keys(
  CHINESE_PAPER_TYPE_META,
) as ChinesePaperTypeId[]

/**
 * 答案页判分方式：客观题给答案；主观题只给评分要点。
 * 形近字组词答案不唯一，但仍按词语能否成立核对，归入客观题。
 * 课外阅读是混合板块：选择、填空给答案，简答只给评分要点。
 */
export const CHINESE_ANSWER_MODE: Record<ChinesePaperTypeId, ChineseAnswerMode> = {
  kanpinyin: 'objective',
  zhuyin: 'objective',
  xingjin: 'objective',
  'gushi-fill': 'objective',
  'gushi-dimo': 'objective',
  gaibing: 'objective',
  guanlian: 'objective',
  biaodian: 'objective',
  kuoxie: 'subjective',
  fangxie: 'subjective',
  reading: 'mixed',
  writing: 'subjective',
  lianmian: 'subjective',
}

// ==================== 数据索引 ====================

const lessons = CHINESE_CURRICULUM_3A.units.flatMap((unit) => unit.lessons)
const lessonOfWord = new Map<string, ChineseLesson>()
const lessonOfChar = new Map<string, ChineseLesson>()
const poemEntries: { poem: ChinesePoem; lesson: ChineseLesson }[] = []

for (const lesson of lessons) {
  for (const word of lesson.words) {
    if (!lessonOfWord.has(word.word)) lessonOfWord.set(word.word, lesson)
  }
  for (const char of [...lesson.renzi, ...lesson.xiezi]) {
    if (!lessonOfChar.has(char.char)) lessonOfChar.set(char.char, lesson)
  }
  for (const poem of lesson.poems ?? []) poemEntries.push({ poem, lesson })
}

const lessonLabel = (lesson: ChineseLesson): string => `第 ${lesson.no} 课《${lesson.title}》`

/**
 * 词语拼音标注：数据层 `ChineseWord` 只有词形与来源，没有拼音字段。
 * 这里按教材词语表的常用读音标注（轻声按口语读音，如「热闹 rè nao」），
 * 只用于卷面与答案页；缺标注的词不入选，避免用推测拼音硬凑。
 */
const WORD_PINYIN: Record<string, string> = {
  洁白: 'jié bái',
  飘扬: 'piāo yáng',
  粗壮: 'cū zhuàng',
  热闹: 'rè nao',
  阵雨: 'zhèn yǔ',
  湿润: 'shī rùn',
  风笛: 'fēng dí',
  功课: 'gōng kè',
  急忙: 'jí máng',
  狂欢: 'kuáng huān',
  私塾: 'sī shú',
  戒尺: 'jiè chǐ',
}

/**
 * 注音语境词：让学生在多音字语境中定音；`multi` 标记多音字，按 B 档出题。
 * 语境词均为常用词，含目标字，不改变数据层读音。
 */
const ZHUYIN_CONTEXT: Record<string, { context: string; multi?: boolean }> = {
  绒: { context: '绒球' },
  昂: { context: '昂头' },
  凤: { context: '凤尾竹' },
  墙: { context: '墙壁' },
  晃: { context: '晃动', multi: true },
  荒: { context: '荒凉' },
  假: { context: '放假', multi: true },
  臂: { context: '手臂' },
  诵: { context: '背诵' },
  例: { context: '例子' },
  糊: { context: '糊涂' },
  戒: { context: '戒尺' },
  厉: { context: '严厉' },
  详: { context: '详细' },
  挨: { context: '挨饿' },
}

/**
 * 形近字组：题面字全部来自第 1–4 课写字表，配对字为常用形近字。
 * 组词答案不唯一，答案页按主答案展示，并标注「意思通顺也算对」。
 */
const XINGJIN_PAIRS: { a: string; b: string; aAnswer: string; bAnswer: string }[] = [
  { a: '坡', b: '波', aAnswer: '山坡', bAnswer: '波浪' },
  { a: '扬', b: '杨', aAnswer: '飞扬', bAnswer: '杨树' },
  { a: '壮', b: '状', aAnswer: '雄壮', bAnswer: '形状' },
  { a: '飘', b: '漂', aAnswer: '飘动', bAnswer: '漂浮' },
  { a: '粗', b: '组', aAnswer: '粗心', bAnswer: '小组' },
  { a: '径', b: '经', aAnswer: '小径', bAnswer: '经过' },
]

// ==================== 候选池 ====================

export function kanpinyinCandidates(): KanpinyinItem[] {
  const items: KanpinyinItem[] = []
  for (const lesson of lessons) {
    for (const word of lesson.words) {
      const pinyin = WORD_PINYIN[word.word]
      if (!pinyin) continue
      items.push({
        typeId: 'kanpinyin',
        key: `word:${word.word}`,
        score: 0,
        level: 'A',
        source: `${lessonLabel(lesson)}·${word.kind}`,
        word: word.word,
        pinyin,
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
      })
    }
  }
  return items
}

export function zhuyinCandidates(): ZhuyinItem[] {
  const items: ZhuyinItem[] = []
  for (const lesson of lessons) {
    for (const char of lesson.renzi) {
      const ctx = ZHUYIN_CONTEXT[char.char]
      if (!ctx) continue
      items.push({
        typeId: 'zhuyin',
        key: `char:${char.char}`,
        score: 0,
        level: ctx.multi ? 'B' : 'A',
        source: `${lessonLabel(lesson)}·识字表`,
        char: char.char,
        pinyin: char.pinyin,
        context: ctx.context,
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
      })
    }
  }
  return items
}

export function xingjinCandidates(): XingjinItem[] {
  const items: XingjinItem[] = []
  for (const pair of XINGJIN_PAIRS) {
    const lesson = lessonOfChar.get(pair.a)
    if (!lesson) continue
    items.push({
      typeId: 'xingjin',
      key: `xingjin:${pair.a}:${pair.b}`,
      score: 0,
      level: 'A',
      source: `${lessonLabel(lesson)}·写字表`,
      ...pair,
    })
  }
  return items
}

export function gushiFillCandidates(): GushiFillItem[] {
  const items: GushiFillItem[] = []
  for (const { poem, lesson } of poemEntries) {
    const [first, second] = poem.lines
    // 每首两个题面：给上句补下句、给下句补上句；同一套内按 poemTitle 去重
    items.push({
      typeId: 'gushi-fill',
      key: `gushi:${poem.title}:second`,
      score: 0,
      level: 'A',
      source: `${lessonLabel(lesson)}·古诗《${poem.title}》`,
      title: poem.title,
      dynasty: poem.dynasty,
      author: poem.author,
      prompt: first,
      answer: second,
      blankFirst: false,
      poemTitle: poem.title,
    })
    items.push({
      typeId: 'gushi-fill',
      key: `gushi:${poem.title}:first`,
      score: 0,
      level: 'A',
      source: `${lessonLabel(lesson)}·古诗《${poem.title}》`,
      title: poem.title,
      dynasty: poem.dynasty,
      author: poem.author,
      prompt: second,
      answer: first,
      blankFirst: true,
      poemTitle: poem.title,
    })
  }
  return items
}

export function gushiDimoCandidates(): GushiDimoItem[] {
  return poemEntries.map(({ poem, lesson }) => ({
    typeId: 'gushi-dimo',
    key: `gushi-dimo:${poem.title}`,
    score: 0,
    level: 'B',
    source: `${lessonLabel(lesson)}·古诗《${poem.title}》`,
    title: poem.title,
    dynasty: poem.dynasty,
    author: poem.author,
    lines: poem.lines,
    poemTitle: poem.title,
  }))
}

const SENTENCE_SECTION_TYPES: Record<ChineseSentenceKind, ChinesePaperTypeId> = {
  gaibing: 'gaibing',
  kuoxie: 'kuoxie',
  guanlian: 'guanlian',
  biaodian: 'biaodian',
  fangxie: 'fangxie',
}

/** 句子题候选；一条题库条目就是一道题，id 即去重键 */
export function sentenceCandidates(kind: ChineseSentenceKind): ChinesePaperItem[] {
  const typeId = SENTENCE_SECTION_TYPES[kind]
  const label = sentenceKindLabel(kind)
  return SENTENCE_BANK.filter((item) => item.kind === kind).map((item) => {
    const source = item.sources[0]
    return {
      ...item,
      typeId,
      key: `sentence:${item.id}`,
      score: 0,
      source: `${item.id}｜${label}${source ? `｜${source.label}` : ''}`,
    } as ChinesePaperItem
  })
}

export function readingCandidates(): ReadingPaperItem[] {
  return PRACTICE_READING_BANK.map((reading: ChineseReading) => ({
    typeId: 'reading',
    key: `reading:${reading.id}`,
    score: 0,
    level: 'B',
    source: `${reading.id}《${reading.title}》｜${reading.theme}`,
    id: reading.id,
    title: reading.title,
    theme: reading.theme,
    paragraphs: reading.paragraphs,
    questions: reading.questions.map((question) => ({ ...question, score: 0 })),
    questionCount: reading.questions.length,
  }))
}

export function writingCandidates(): WritingPaperItem[] {
  return WRITING_PROMPTS.map((prompt) => ({
    typeId: 'writing',
    key: `writing:${prompt.id}`,
    score: 0,
    level: 'C',
    source: `${prompt.id}《${prompt.title}》｜${prompt.unitName}习作`,
    id: prompt.id,
    unitId: prompt.unitId,
    unitName: prompt.unitName,
    title: prompt.title,
    prompt: prompt.prompt,
    storyOpening: prompt.storyOpening,
    requirements: prompt.requirements,
    wordCount: prompt.wordCount,
    scoring: prompt.scoring,
  }))
}

export function lianmianCandidates(): ChinesePaperItem[] {
  return [
    {
      typeId: 'lianmian',
      key: 'lianmian',
      score: 0,
      level: 'A',
      source: '题型表 §2.5：卷面书写 2–3 分（人工评分）',
      note: '按全卷书写是否工整、卷面是否整洁评分。',
    },
  ]
}

/** 可出数：界面后续做「添加题型」置灰与容量摘要时直接可用 */
export function chineseMaterialInventory(): Record<ChinesePaperTypeId, number> {
  const sentenceCount = SENTENCE_BANK.reduce(
    (acc, item) => {
      acc[item.kind] += 1
      return acc
    },
    { gaibing: 0, kuoxie: 0, guanlian: 0, biaodian: 0, fangxie: 0 } as Record<
      ChineseSentenceKind,
      number
    >,
  )
  return {
    kanpinyin: kanpinyinCandidates().length,
    zhuyin: zhuyinCandidates().length,
    xingjin: xingjinCandidates().length,
    'gushi-fill': poemEntries.length,
    'gushi-dimo': gushiDimoCandidates().length,
    gaibing: sentenceCount.gaibing,
    guanlian: sentenceCount.guanlian,
    biaodian: sentenceCount.biaodian,
    kuoxie: sentenceCount.kuoxie,
    fangxie: sentenceCount.fangxie,
    reading: PRACTICE_READING_BANK.length,
    writing: WRITING_PROMPTS.length,
    lianmian: 1,
  }
}
