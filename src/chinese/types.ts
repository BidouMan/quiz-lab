/**
 * 语文出卷引擎的配置与结果类型（可 JSON 序列化，供界面调用）。
 *
 * 与 `src/quiz/*` 平级，但只做「按配置选卷」，不做跨卷冷却与复习调度：
 * 本版每次只在一套卷内按素材去重；冷却、错题回流、历史卷留到下一版接入，
 * 扩展点见文件末尾注释，不预先写空实现。
 */

import type {
  BiaodianItem,
  ChineseLevel,
  ChineseReading,
  ChineseWritingPrompt,
  FangxieItem,
  GaibingItem,
  GuanlianItem,
  KuoxieItem,
  ReadingChoiceQuestion,
  ReadingFillQuestion,
  ReadingShortQuestion,
} from '../data/chinese/types.ts'

/** 可进卷的题型；reading 的 count 为篇数，writing 为篇数，lianmian 为 1 */
export type ChinesePaperTypeId =
  | 'kanpinyin'
  | 'zhuyin'
  | 'xingjin'
  | 'gushi-fill'
  | 'gushi-dimo'
  | 'gaibing'
  | 'guanlian'
  | 'biaodian'
  | 'kuoxie'
  | 'fangxie'
  | 'reading'
  | 'writing'
  | 'lianmian'

/** 难度档：A 基础 / B 标准 / C 挑战；mixed 为混合，不按档位筛选 */
export type ChineseDifficulty = ChineseLevel | 'mixed'

/**
 * 答案页的判分方式：
 * - objective：对错可判，给出答案；
 * - subjective：主观题，只给评分要点，不给标准答案或范文；
 * - mixed：同一板块既有客观小题也有简答（目前只有课外阅读）。
 */
export type ChineseAnswerMode = 'objective' | 'subjective' | 'mixed'

/** 单个题型的配置 */
export interface ChineseSectionConfig {
  typeId: ChinesePaperTypeId
  /** 题量；reading 为篇数、writing 为篇数、lianmian 固定 1 */
  count: number
  /** 每题（每篇）分值；本板块分值 = count × perItemScore */
  perItemScore: number
  /** 可选：覆盖全局难度，只对确有逐题难度标注的题型生效 */
  levels?: ChineseLevel[]
}

/** 出卷配置：整份可 JSON 序列化，界面只需要构造它 */
export interface ChinesePaperConfig {
  version: 1
  grade: '3A'
  title: string
  subtitle?: string
  /** 固定种子，同一配置与种子可复现同一张卷 */
  seed: number
  difficulty: ChineseDifficulty
  /** 期望总题量，必须等于各题型 count 之和；不一致直接报错，不静默改数 */
  totalItems: number
  sections: ChineseSectionConfig[]
  /** 是否附答案页；false 时答案页整页不排 */
  includeAnswers: boolean
  /** 建议用时（分钟），只用于卷首说明 */
  timeMinutes?: number
}

/** 素材/卷面出处标注 */
export interface ChineseItemMeta {
  /** 套内去重键 */
  key: string
  /** 本题实际分值 */
  score: number
  /** 逐题难度；素材没有逐题标注时为 null */
  level: ChineseLevel | null
  /** 出处文本，例：第 1 课《大青树下的小学》·词语 */
  source: string
}

export interface KanpinyinItem extends ChineseItemMeta {
  typeId: 'kanpinyin'
  word: string
  pinyin: string
  lessonNo: number
  lessonTitle: string
}

export interface ZhuyinItem extends ChineseItemMeta {
  typeId: 'zhuyin'
  char: string
  pinyin: string
  /** 语境词，用于区分多音字，例：放假 */
  context: string
  lessonNo: number
  lessonTitle: string
}

export interface XingjinItem extends ChineseItemMeta {
  typeId: 'xingjin'
  a: string
  b: string
  aAnswer: string
  bAnswer: string
}

export interface GushiFillItem extends ChineseItemMeta {
  typeId: 'gushi-fill'
  title: string
  dynasty: string
  author: string
  /** 卷面给出的提示句 */
  prompt: string
  /** 需补全的一句 */
  answer: string
  /** true 表示空线在提示句之前（给下句补上句） */
  blankFirst: boolean
  poemTitle: string
}

export interface GushiDimoItem extends ChineseItemMeta {
  typeId: 'gushi-dimo'
  title: string
  dynasty: string
  author: string
  lines: string[]
  poemTitle: string
}

export type GaibingPaperItem = GaibingItem & ChineseItemMeta & { typeId: 'gaibing' }

export type GuanlianPaperItem = GuanlianItem & ChineseItemMeta & { typeId: 'guanlian' }

export type BiaodianPaperItem = BiaodianItem & ChineseItemMeta & { typeId: 'biaodian' }

export type KuoxiePaperItem = KuoxieItem & ChineseItemMeta & { typeId: 'kuoxie' }

export type FangxiePaperItem = FangxieItem & ChineseItemMeta & { typeId: 'fangxie' }

export type ChineseReadingPaperQuestion =
  | (ReadingChoiceQuestion & { score: number })
  | (ReadingFillQuestion & { score: number })
  | (ReadingShortQuestion & { score: number })

export interface ReadingPaperItem extends ChineseItemMeta {
  typeId: 'reading'
  id: string
  title: string
  theme: ChineseReading['theme']
  paragraphs: string[]
  questions: ChineseReadingPaperQuestion[]
  /** 篇内题量，便于界面摘要 */
  questionCount: number
  /** 质检状态：qualified 正式题库；pending-repair 待修区（可练习，不计入合格数） */
  quality?: 'qualified' | 'pending-repair'
}

export interface WritingPaperItem extends ChineseItemMeta {
  typeId: 'writing'
  id: string
  unitId: string
  unitName: string
  title: string
  prompt: string
  storyOpening?: string
  requirements: string[]
  wordCount: { min: number; max: number }
  scoring: ChineseWritingPrompt['scoring']
}

export interface LianmianItem extends ChineseItemMeta {
  typeId: 'lianmian'
  note: string
}

export type ChinesePaperItem =
  | KanpinyinItem
  | ZhuyinItem
  | XingjinItem
  | GushiFillItem
  | GushiDimoItem
  | GaibingPaperItem
  | GuanlianPaperItem
  | BiaodianPaperItem
  | KuoxiePaperItem
  | FangxiePaperItem
  | ReadingPaperItem
  | WritingPaperItem
  | LianmianItem

/** 素材缺口：需要多少、现有多少；卷面据此排占位块，不用重复题凑数 */
export interface ChinesePaperGap {
  typeId: ChinesePaperTypeId
  label: string
  needed: number
  available: number
  missing: number
  reason: string
  /** 直接可印在卷面上的整句说明 */
  message: string
}

export interface ChineseSectionResult {
  typeId: ChinesePaperTypeId
  label: string
  /** 题型所属板块，排版用它决定换页时机 */
  group: '字词' | '积累' | '句子' | '阅读' | '习作' | '卷面'
  /** 答案页判分方式，决定给答案还是只给评分要点 */
  answerMode: ChineseAnswerMode
  /** 卷面题号：一、二、三……按配置顺序 */
  no: string
  requested: number
  selected: number
  perItemScore: number
  score: number
  items: ChinesePaperItem[]
  gap: ChinesePaperGap | null
}

export interface ChinesePaperScore {
  /** 实际排入卷面的分值 */
  total: number
  /** 可按答案页核对的分值（面批项不计） */
  gradable: number
  /** 配置期望分值；素材不足时会低于它 */
  requested: number
}

export interface ChinesePaperResult {
  config: ChinesePaperConfig
  sections: ChineseSectionResult[]
  /** 摊平后的全部题目，便于界面做摘要与单题预览 */
  items: ChinesePaperItem[]
  score: ChinesePaperScore
  gaps: ChinesePaperGap[]
  /** 难度口径等需要写进卷面/摘要的说明 */
  notes: string[]
}

/**
 * 预留扩展点（本版不实现）：
 * - 跨卷冷却：需要「最近 N 套已用 key」的历史，落在 `ChinesePaperConfig` 之外，
 *   由界面/存储层传入下一次的排除集合；
 * - 复习调度与错题回流：需要掌握度与到期套号，属选卷前的候选池排序；
 * - 历史卷管理：需要套号递增与卷面快照。
 * 这些都不属于「按配置出卷」，本版只保证 `buildChinesePaper(config)` 纯函数可复现。
 */
