/**
 * 语文素材数据层：类型定义。
 *
 * 与数学侧同构：单元（unit）→ 题型（typeId）→ 难度（A/B/C）。
 * 差异在于语文素材需要逐条溯源，因此每一条生字/词语都带 source 与 status：
 * - verified：来源可直接核对（教材/教师用书页次，或人教社官方资料）
 * - pending：只查到教辅 OCR 或推断，使用时必须在卷面标注「待核实」
 */

/** 难度：A 基础 / B 常规 / C 提高 */
export type ChineseLevel = 'A' | 'B' | 'C'

export type VerifyStatus = 'verified' | 'pending'

/** 生字所属表：识字表（会认） / 写字表（会写） */
export type CharTable = 'renzi' | 'xiezi'

export interface SourceRef {
  /** 来源说明，例如「教材第 1 课·写字表」 */
  label: string
  /** 可点击核对的地址（可选） */
  url?: string
  /** 页次/条目定位（可选） */
  locator?: string
}

export interface ChineseChar {
  char: string
  /** 带调拼音；查不到时留空并置 pending */
  pinyin: string
  table: CharTable
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChineseWord {
  word: string
  /** 词语表（教材词语表）/ 课文词语（课文或课后练习出现） */
  kind: '词语表' | '课文词语'
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChinesePoem {
  title: string
  author: string
  dynasty: string
  /** 逐句，按教材分行 */
  lines: string[]
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChineseLesson {
  lessonId: string
  /** 课次，例：1、3（略读课沿用数字，另由 kind 区分） */
  no: number
  title: string
  /** 精读要求写字，略读只有识字表 */
  kind: '精读' | '略读'
  renzi: ChineseChar[]
  xiezi: ChineseChar[]
  words: ChineseWord[]
  poems?: ChinesePoem[]
  note?: string
}

export type ChineseTypeId =
  | 'kanpinyin'
  | 'zhuyin'
  | 'duoyin'
  | 'xingjin'
  | 'cipu'
  | 'jinayi'
  | 'gushi'
  | 'juzi'

export interface ChineseTypeMeta {
  typeId: ChineseTypeId
  label: string
  /** 各难度的建议题量（出卷时的默认值，可在界面再调） */
  counts: Record<ChineseLevel, number>
  note?: string
}

export interface ChineseUnitGarden {
  label: string
  /** 日积月累等固定内容；未核实则留空 */
  items: string[]
  status: VerifyStatus
  sources: SourceRef[]
}

export interface ChineseUnitWriting {
  label: string
  /** 只给题目与提示，不判对错 */
  prompt?: string
  status: VerifyStatus
  sources: SourceRef[]
}

export interface ChineseUnit {
  unitId: string
  unitName: string
  /** 人文主题（查证不到时留空） */
  theme: string
  lessons: ChineseLesson[]
  /** 本单元可出的题型 */
  availableTypes: ChineseTypeId[]
  garden?: ChineseUnitGarden
  writing?: ChineseUnitWriting
  oral?: { label: string; status: VerifyStatus }
  /** 快乐读书吧等单元级附加内容 */
  extra?: { label: string; status: VerifyStatus }
  note?: string
}

export interface ChineseCurriculum {
  subject: 'chinese'
  grade: '3A'
  edition: string
  source: string
  units: ChineseUnit[]
}
