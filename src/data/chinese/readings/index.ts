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

export {
  PEOPLE_READINGS,
  SCENERY_READINGS,
  EVENTS_READINGS,
  OBJECT_READINGS,
  FABLE_READINGS,
  SCIENCE_READINGS,
}

export const READING_THEMES: ReadingTheme[] = ['写人', '写景', '写事', '状物', '寓言', '科普']

export const READING_BANK: ChineseReading[] = [
  ...PEOPLE_READINGS,
  ...SCENERY_READINGS,
  ...EVENTS_READINGS,
  ...OBJECT_READINGS,
  ...FABLE_READINGS,
  ...SCIENCE_READINGS,
]

export const READING_BANK_META: ChineseReadingBankMeta = {
  subject: 'chinese',
  grade: '3A',
  scope: '课外阅读',
  review: {
    authoredAt: '2026-11-07',
    pass1: '六个主题各 4 篇，共 24 篇原创短文，每篇 3–5 题，选择、填空、简答齐备。',
    pass2:
      '第二遍逐篇朗读，检查用字是否适合三上；再不看答案逐题回原文定位，选择题逐项排除，简答题按评分点自评，答案与存档不一致的改写或撤下。',
    mechanical: [
      '字数：只统计汉字，正文 250–450 字。',
      '题量：每篇 3–5 题，且选择题、填空题、简答题各至少一道。',
      '选择题：4 个选项、互不重复、正确项下标在范围内且有原文依据。',
      '填空题：题干「（ ）」数量与答案数量一致，答案非空。',
      '简答题：参考答案非空，评分点 2–3 条。',
    ],
    samples: [
      'RD-02《我的同桌》：选择题错项“只有一支彩笔”与原文“十二支彩笔”矛盾。',
      'RD-08《雪后的山村》：三道声音均回原文核对为“咯吱、滴水、鸡鸣”。',
      'RD-18《爱学样的小猴子》：简答“变化”按“先想、不再乱学”两点自评，与存档一致。',
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
