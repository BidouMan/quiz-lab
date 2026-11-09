import type {
  ChineseReading,
  ChineseReadingBankMeta,
  ReadingTheme,
} from '../types.ts'
import { PEOPLE_READINGS } from './people.ts'
import { SCENERY_READINGS } from './scenery.ts'
import { EVENTS_READINGS } from './events.ts'
import { OBJECT_READINGS } from './objects.ts'
import { FABLE_READINGS } from './fables.ts'
import { SCIENCE_READINGS } from './science.ts'
import { IMPORTED_READINGS } from './imported.ts'
import { MOUNTED_READINGS, PENDING_READINGS } from './mounted.ts'
import { ORIGINAL_READING_TAGS } from './tags.ts'

export {
  PEOPLE_READINGS,
  SCENERY_READINGS,
  EVENTS_READINGS,
  OBJECT_READINGS,
  FABLE_READINGS,
  SCIENCE_READINGS,
  IMPORTED_READINGS,
  MOUNTED_READINGS,
  PENDING_READINGS,
}

export const READING_THEMES: ReadingTheme[] = [
  '写人',
  '写景',
  '写事',
  '状物',
  '寓言',
  '科普',
  '非连续',
  '童话',
  '记事',
]

export const READING_BANK: ChineseReading[] = [
  ...PEOPLE_READINGS,
  ...SCENERY_READINGS,
  ...EVENTS_READINGS,
  ...OBJECT_READINGS,
  ...FABLE_READINGS,
  ...SCIENCE_READINGS,
  ...IMPORTED_READINGS,
].map((reading) => {
  const tag = ORIGINAL_READING_TAGS[reading.id]
  if (!tag) return reading
  return {
    ...reading,
    skills: tag.skills,
    difficulty: tag.difficulty,
    questions: reading.questions.map((question, index) => ({
      ...question,
      skill: tag.questionSkills[index],
    })),
  }
})

/** 正式题库：精选库 + quality_gate 通过且未下架的命题稿，计入合格挂载。 */
export const QUALIFIED_READING_BANK: ChineseReading[] = [
  ...READING_BANK,
  ...MOUNTED_READINGS,
]

/** 待修区：quality_gate 未通过、但正文合格且未下架的命题稿；可练习，不计入合格数。 */
export const PENDING_READING_BANK: ChineseReading[] = [
  ...PENDING_READINGS,
]

/** 出卷可用的全部短文：正式题库 + 待修区。 */
export const PRACTICE_READING_BANK: ChineseReading[] = [
  ...QUALIFIED_READING_BANK,
  ...PENDING_READING_BANK,
]

export const READING_BANK_META: ChineseReadingBankMeta = {
  subject: 'chinese',
  grade: '3A',
  scope: '课外阅读',
  review: {
    authoredAt: '2026-11-07',
    pass1: '六个主题各 4 篇，共 24 篇原创短文，每篇 3–5 题，选择、填空、简答齐备。',
    pass2:
      '第二遍逐篇朗读，检查用字是否适合三上；再不看答案逐题回原文定位，选择题逐项排除，简答题按评分点自评，答案与存档不一致的改写或撤下。第三遍按 0.7.0 教研评审逐条返修：每篇扩写到 300–500 字，修 3 处 P0 与 15 处 P2 细节。',
    mechanical: [
      '字数：只统计汉字，正文 300–500 字。',
      '题量：每篇 3–5 题，且选择题、填空题、简答题各至少一道。',
      '选择题：4 个选项、互不重复、正确项下标在范围内，答案说明里的引文必须逐字出现在原文中。',
      '填空题：题干「（ ）」数量与答案数量一致，答案非空，且每个答案都能在原文中逐字找到。',
      '简答题：不设标准答案，评分点 2–3 条；题干与解析里“”引用的原句必须逐字出现在原文。',
    ],
    samples: [
      'RD-02《我的同桌》：选择题错项“只有一支彩笔”与原文“十二支彩笔”矛盾。',
      'RD-07《江边的傍晚》：第 4 题题干改为“哪些景物 + 什么顺序”，与两条评分点对应。',
      'RD-08《雪后的山村》：冰柱、缝鞋垫、扫雪声三处按教研意见改后，第 4 题答案回原文逐句核对。',
      'RD-13《我的小台灯》：第 3 题评分点补齐灯座、灯杆、灯罩、开关四项。',
      'RD-22《会“出汗”的树叶》：第 1 题区分蒸腾（水汽）与露水（水汽凝结），按保守口径改写。',
      'RD-24《月亮的脸为什么会变》：新月位置、公转方向、约一个月周期逐项核对。',
    ],
  },
}

export function readingText(reading: ChineseReading): string {
  return reading.paragraphs.join('')
}

/** 只统计汉字，标点、数字不计，作为“字数”口径 */
export function readingCharCount(reading: ChineseReading): number {
  return readingText(reading).match(/[\u4e00-\u9fff]/g)?.length ?? 0
}

export function readingCounts(): Record<ReadingTheme, number> {
  const counts: Record<ReadingTheme, number> = {
    写人: 0,
    写景: 0,
    写事: 0,
    状物: 0,
    寓言: 0,
    科普: 0,
    非连续: 0,
    童话: 0,
    记事: 0,
  }
  for (const reading of READING_BANK) counts[reading.theme] += 1
  return counts
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ReadingPickOptions {
  count: number
  themes?: ReadingTheme[]
  seed?: number
}

/** 随机抽短文：同一次调用内不重复，固定种子可复现 */
export function pickReadings(options: ReadingPickOptions): ChineseReading[] {
  const { count, themes, seed = 20261107 } = options
  const pool = READING_BANK.filter((reading) => (themes ? themes.includes(reading.theme) : true))
  const random = makeRandom(seed)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
