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
import { WORD_PINYIN } from '../data/chinese/word-pinyin.ts'
import {
  CIPU_SEEDS,
  DUOYIN_SEEDS,
  JINAYI_SEEDS,
  RIJI_SEEDS,
  XUANZI_SEEDS,
  type FillTextSeed,
} from '../data/chinese/word-bank.ts'
import { SENTENCE_BANK, sentenceKindLabel } from '../data/chinese/sentences/index.ts'
import { PRACTICE_READING_BANK } from '../data/chinese/readings/index.ts'
import { WRITING_PROMPTS } from '../data/chinese/writing.ts'
import type {
  ChineseLesson,
  ChineseLevel,
  ChineseReading,
  ChineseSentenceKind,
  ChinesePoem,
  ChineseUnit,
  ChineseWord,
} from '../data/chinese/types.ts'
import type {
  ChineseAnswerMode,
  ChinesePaperItem,
  ChinesePaperTypeId,
  DuoyinItem,
  FillTextItem,
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
  duoyin: {
    typeId: 'duoyin',
    label: '多音字组词',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
  },
  cipu: {
    typeId: 'cipu',
    label: '词语搭配与积累',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'A',
    countUnit: '题',
  },
  jinayi: {
    typeId: 'jinayi',
    label: '近义词与反义词',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'A',
    countUnit: '题',
  },
  xuanzi: {
    typeId: 'xuanzi',
    label: '选字填空',
    group: '字词',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'B',
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
  riji: {
    typeId: 'riji',
    label: '日积月累',
    group: '积累',
    defaultPerItemScore: 1,
    itemLevels: true,
    baselineLevel: 'B',
    countUnit: '题',
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
    itemLevels: true,
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
  duoyin: 'objective',
  xingjin: 'objective',
  cipu: 'objective',
  jinayi: 'objective',
  xuanzi: 'objective',
  'gushi-fill': 'objective',
  'gushi-dimo': 'objective',
  riji: 'objective',
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

interface LessonEntry {
  unit: ChineseUnit
  lesson: ChineseLesson
}

const lessonEntries: LessonEntry[] = CHINESE_CURRICULUM_3A.units.flatMap((unit) =>
  unit.lessons.map((lesson) => ({ unit, lesson })),
)
const lessonOfChar = new Map<string, LessonEntry>()
const wordsOfLesson = new Map<string, string[]>()

interface PoemEntry {
  poem: ChinesePoem
  unitId: string
  sourceLabel: string
}

const poemEntries: PoemEntry[] = []

for (const entry of lessonEntries) {
  const { unit, lesson } = entry
  wordsOfLesson.set(
    lesson.lessonId,
    lesson.words.map((word) => word.word),
  )
  for (const char of [...lesson.renzi, ...lesson.xiezi]) {
    if (!lessonOfChar.has(char.char)) lessonOfChar.set(char.char, entry)
  }
  for (const poem of lesson.poems ?? []) {
    poemEntries.push({
      poem,
      unitId: unit.unitId,
      sourceLabel: `第 ${lesson.no} 课《${lesson.title}》`,
    })
  }
  for (const poem of unit.garden?.poems ?? []) {
    poemEntries.push({
      poem,
      unitId: unit.unitId,
      sourceLabel: `${unit.unitName}·语文园地`,
    })
  }
}

const lessonLabel = (lesson: ChineseLesson): string => `第 ${lesson.no} 课《${lesson.title}》`

/** 园地词语：按单元归属，来源写清「语文园地·词语表」 */
interface GardenWordEntry {
  unit: ChineseUnit
  word: ChineseWord
}

const gardenWords: GardenWordEntry[] = CHINESE_CURRICULUM_3A.units.flatMap((unit) =>
  (unit.garden?.words ?? []).map((word) => ({ unit, word })),
)

/**
 * 多音字语境词：教材识字表蓝色字共 26 个，每个都给一个能锁定本课读音的常用词。
 * 只作卷面提示，不改数据层读音。
 */
const MULTI_CONTEXT: Record<string, string> = {
  假: '放假',
  磨: '磨刀',
  挑: '挑促织',
  吗: '干吗',
  中: '中弹',
  弹: '子弹',
  少: '少年',
  冲: '冲进',
  系: '关系',
  应: '答应',
  骨: '骨头',
  处: '处理',
  禁: '禁止',
  臂: '手臂',
  参: '海参',
  兴: '兴奋',
  舍: '宿舍',
  角: '角色',
  抹: '浓抹',
  呢: '还早呢',
  哩: '好哩',
  差: '差别',
  大: '大夫',
  担: '担心',
  还: '归还',
}

/** 非多音字的语境词：优先取本课词语表中包含该字的词，取不到就用单字 */
function contextFor(entry: LessonEntry, char: string): string {
  const multi = MULTI_CONTEXT[char]
  if (multi) return multi
  const words = wordsOfLesson.get(entry.lesson.lessonId) ?? []
  const hit = words
    .filter((word) => word.includes(char) && word.length <= 6)
    .sort((a, b) => a.length - b.length)[0]
  return hit ?? char
}

/**
 * 形近字组：题面字全部来自写字表，配对字为常用形近字。
 * 组词答案不唯一，答案页按主答案展示，并标注「意思通顺也算对」。
 */
const XINGJIN_PAIRS: { a: string; b: string; aAnswer: string; bAnswer: string }[] = [
  { a: '坡', b: '波', aAnswer: '山坡', bAnswer: '波浪' },
  { a: '扬', b: '杨', aAnswer: '飞扬', bAnswer: '杨树' },
  { a: '壮', b: '状', aAnswer: '雄壮', bAnswer: '形状' },
  { a: '飘', b: '漂', aAnswer: '飘动', bAnswer: '漂浮' },
  { a: '粗', b: '组', aAnswer: '粗心', bAnswer: '小组' },
  { a: '径', b: '经', aAnswer: '小径', bAnswer: '经过' },
  // 第 2–3 单元
  { a: '珠', b: '株', aAnswer: '珍珠', bAnswer: '一株' },
  { a: '规', b: '观', aAnswer: '规则', bAnswer: '观看' },
  { a: '争', b: '挣', aAnswer: '争气', bAnswer: '挣脱' },
  { a: '勾', b: '钩', aAnswer: '勾住', bAnswer: '鱼钩' },
  { a: '备', b: '各', aAnswer: '准备', bAnswer: '各自' },
  { a: '爬', b: '爪', aAnswer: '爬山', bAnswer: '爪子' },
  { a: '准', b: '谁', aAnswer: '准备', bAnswer: '是谁' },
  { a: '钻', b: '站', aAnswer: '钻出', bAnswer: '站立' },
  { a: '晒', b: '洒', aAnswer: '晒太阳', bAnswer: '洒水' },
  { a: '暴', b: '爆', aAnswer: '暴风雨', bAnswer: '爆炸' },
  // 第 4–5 单元
  { a: '错', b: '借', aAnswer: '错误', bAnswer: '借书' },
  { a: '宫', b: '官', aAnswer: '宫殿', bAnswer: '官员' },
  { a: '冒', b: '帽', aAnswer: '冒雨', bAnswer: '帽子' },
  { a: '式', b: '试', aAnswer: '方式', bAnswer: '考试' },
  { a: '怜', b: '冷', aAnswer: '可怜', bAnswer: '寒冷' },
  { a: '救', b: '球', aAnswer: '救命', bAnswer: '皮球' },
  { a: '管', b: '馆', aAnswer: '管理', bAnswer: '图书馆' },
  { a: '刚', b: '钢', aAnswer: '刚才', bAnswer: '钢铁' },
  { a: '搭', b: '塔', aAnswer: '搭船', bAnswer: '宝塔' },
  { a: '翠', b: '碎', aAnswer: '翠绿', bAnswer: '破碎' },
  { a: '蓝', b: '篮', aAnswer: '蓝天', bAnswer: '篮球' },
  { a: '静', b: '净', aAnswer: '安静', bAnswer: '干净' },
  // 第 6–8 单元
  { a: '景', b: '影', aAnswer: '风景', bAnswer: '影子' },
  { a: '底', b: '低', aAnswer: '水底', bAnswer: '低头' },
  { a: '岩', b: '岸', aAnswer: '岩石', bAnswer: '海岸' },
  { a: '密', b: '蜜', aAnswer: '茂密', bAnswer: '蜂蜜' },
  { a: '虾', b: '吓', aAnswer: '龙虾', bAnswer: '吓人' },
  { a: '荣', b: '容', aAnswer: '光荣', bAnswer: '容易' },
  { a: '姿', b: '资', aAnswer: '姿势', bAnswer: '资料' },
  { a: '梨', b: '利', aAnswer: '梨子', bAnswer: '利用' },
  { a: '考', b: '老', aAnswer: '考试', bAnswer: '老师' },
  { a: '退', b: '腿', aAnswer: '后退', bAnswer: '大腿' },
  { a: '努', b: '怒', aAnswer: '努力', bAnswer: '愤怒' },
  { a: '棒', b: '捧', aAnswer: '木棒', bAnswer: '捧着' },
  { a: '取', b: '耳', aAnswer: '取出', bAnswer: '耳朵' },
  { a: '盘', b: '盆', aAnswer: '盘子', bAnswer: '花盆' },
  { a: '秒', b: '妙', aAnswer: '秒针', bAnswer: '美妙' },
]

// ==================== 候选池 ====================

export function kanpinyinCandidates(): KanpinyinItem[] {
  const items: KanpinyinItem[] = []
  for (const { unit, lesson } of lessonEntries) {
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
        unitId: unit.unitId,
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
      })
    }
  }
  for (const { unit, word } of gardenWords) {
    const pinyin = WORD_PINYIN[word.word]
    if (!pinyin) continue
    items.push({
      typeId: 'kanpinyin',
      key: `word:${word.word}`,
      score: 0,
      level: 'A',
      source: `${unit.unitName}·语文园地·词语表`,
      word: word.word,
      pinyin,
      unitId: unit.unitId,
      lessonNo: 0,
      lessonTitle: unit.garden?.label ?? '语文园地',
    })
  }
  return items
}

export function zhuyinCandidates(): ZhuyinItem[] {
  const items: ZhuyinItem[] = []
  for (const entry of lessonEntries) {
    const { unit, lesson } = entry
    for (const char of lesson.renzi) {
      if (!char.pinyin) continue
      items.push({
        typeId: 'zhuyin',
        key: `char:${char.char}`,
        score: 0,
        level: char.multi ? 'B' : 'A',
        source: `${lessonLabel(lesson)}·识字表`,
        char: char.char,
        pinyin: char.pinyin,
        context: contextFor(entry, char.char),
        unitId: unit.unitId,
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
      })
    }
  }
  return items
}

export function duoyinCandidates(): DuoyinItem[] {
  const items: DuoyinItem[] = DUOYIN_SEEDS.map((seed) => ({
    typeId: 'duoyin',
    key: `duoyin:${seed.char}`,
    score: 0,
    level: seed.level,
    source: seed.source,
    char: seed.char,
    readings: seed.readings,
    unitId: seed.unitId,
  }))
  return items.filter((item, index, list) => list.findIndex((other) => other.char === item.char) === index)
}

const FILL_SEEDS: Record<'cipu' | 'jinayi' | 'xuanzi' | 'riji', FillTextSeed[]> = {
  cipu: CIPU_SEEDS,
  jinayi: JINAYI_SEEDS,
  xuanzi: XUANZI_SEEDS,
  riji: RIJI_SEEDS,
}

/** 填空类字词题：题干里的「（ ）」按顺序对应 answers */
export function fillTextCandidates(
  typeId: 'cipu' | 'jinayi' | 'xuanzi' | 'riji',
): FillTextItem[] {
  return FILL_SEEDS[typeId].map((seed, index) => {
    const dedupeKey =
      typeId === 'jinayi'
        ? seed.text.replace(/^写出(近|反)义词：/, '').replace(/（[\s\S]*$/, '').trim()
        : undefined
    return {
      typeId,
      key: `${typeId}:${index}`,
      score: 0,
      level: seed.level,
      source: seed.source,
      text: seed.text,
      answers: seed.answers,
      ...(dedupeKey ? { dedupeKey } : {}),
      ...(seed.bank ? { bank: seed.bank } : {}),
      ...(seed.group ? { group: seed.group } : {}),
      ...(seed.note ? { note: seed.note } : {}),
      unitId: seed.unitId,
    }
  })
}

export function xingjinCandidates(): XingjinItem[] {
  const items: XingjinItem[] = []
  for (const pair of XINGJIN_PAIRS) {
    const entry = lessonOfChar.get(pair.a)
    if (!entry) continue
    items.push({
      typeId: 'xingjin',
      key: `xingjin:${pair.a}:${pair.b}`,
      score: 0,
      level: 'A',
      source: `${lessonLabel(entry.lesson)}·写字表`,
      unitId: entry.unit.unitId,
      ...pair,
    })
  }
  return items
}

export function gushiFillCandidates(): GushiFillItem[] {
  const items: GushiFillItem[] = []
  for (const { poem, unitId, sourceLabel } of poemEntries) {
    const [first, second] = poem.lines
    // 每首两个题面：给上句补下句、给下句补上句；同一套内按 poemTitle 去重
    items.push({
      typeId: 'gushi-fill',
      key: `gushi:${poem.title}:second`,
      score: 0,
      level: 'A',
      source: `${sourceLabel}·古诗《${poem.title}》`,
      title: poem.title,
      dynasty: poem.dynasty,
      author: poem.author,
      prompt: first,
      answer: second,
      blankFirst: false,
      poemTitle: poem.title,
      unitId,
    })
    items.push({
      typeId: 'gushi-fill',
      key: `gushi:${poem.title}:first`,
      score: 0,
      level: 'A',
      source: `${sourceLabel}·古诗《${poem.title}》`,
      title: poem.title,
      dynasty: poem.dynasty,
      author: poem.author,
      prompt: second,
      answer: first,
      blankFirst: true,
      poemTitle: poem.title,
      unitId,
    })
  }
  return items
}

export function gushiDimoCandidates(): GushiDimoItem[] {
  return poemEntries.map(({ poem, unitId, sourceLabel }) => ({
    typeId: 'gushi-dimo',
    key: `gushi-dimo:${poem.title}`,
    score: 0,
    level: 'B',
    source: `${sourceLabel}·古诗《${poem.title}》`,
    title: poem.title,
    dynasty: poem.dynasty,
    author: poem.author,
    lines: poem.lines,
    poemTitle: poem.title,
    unitId,
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
  return PRACTICE_READING_BANK.map((reading: ChineseReading) => {
    const pending = reading.status === 'pending'
    return {
      typeId: 'reading',
      key: `reading:${reading.id}`,
      score: 0,
      level: reading.difficulty ?? 'B',
      source: `${pending ? '【待修】' : ''}${reading.id}《${reading.title}》｜${reading.theme}`,
      id: reading.id,
      title: reading.title,
      theme: reading.theme,
      paragraphs: reading.paragraphs,
      questions: reading.questions.map((question) => ({ ...question, score: 0 })),
      skills: reading.skills ?? [],
      questionCount: reading.questions.length,
      quality: pending ? 'pending-repair' : 'qualified',
    }
  })
}

/** 只取正式题库（quality_gate 通过），供精选/考试模式使用。 */
export function qualifiedReadingCandidates(): ReadingPaperItem[] {
  return readingCandidates().filter((item) => item.quality === 'qualified')
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

/** 按所选单元统计教材类题可出数；句子、阅读、习作、卷面仍按全册计 */
export function chineseUnitInventory(
  unitIds: string[],
): Record<ChinesePaperTypeId, number> {
  const allowed = new Set(unitIds)
  const global = chineseMaterialInventory()
  const inUnits = (items: ChinesePaperItem[]): number =>
    items.filter((item) => 'unitId' in item && allowed.has(String(item.unitId))).length
  const uniqueInUnits = (items: FillTextItem[]): number =>
    new Set(
      items
        .filter((item) => allowed.has(String(item.unitId)))
        .map((item) => item.dedupeKey ?? item.key),
    ).size
  const poemTitles = new Set(
    gushiDimoCandidates()
      .filter((item) => allowed.has(String(item.unitId)))
      .map((item) => item.poemTitle),
  )
  return {
    ...global,
    kanpinyin: inUnits(kanpinyinCandidates()),
    zhuyin: inUnits(zhuyinCandidates()),
    duoyin: inUnits(duoyinCandidates()),
    xingjin: inUnits(xingjinCandidates()),
    cipu: inUnits(fillTextCandidates('cipu')),
    jinayi: uniqueInUnits(fillTextCandidates('jinayi')),
    xuanzi: inUnits(fillTextCandidates('xuanzi')),
    'gushi-fill': poemTitles.size,
    'gushi-dimo': poemTitles.size,
    riji: inUnits(fillTextCandidates('riji')),
    writing: inUnits(writingCandidates()),
  }
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
    duoyin: duoyinCandidates().length,
    xingjin: xingjinCandidates().length,
    cipu: fillTextCandidates('cipu').length,
    jinayi: fillTextCandidates('jinayi').length,
    xuanzi: fillTextCandidates('xuanzi').length,
    'gushi-fill': poemEntries.length,
    'gushi-dimo': gushiDimoCandidates().length,
    riji: fillTextCandidates('riji').length,
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
