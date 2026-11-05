import type { Level } from '../quiz/types.ts'
import type { FigureSpec } from '../quiz/skeleton/types.ts'
import type { FormatSourceData } from '../quiz/formats.ts'

export type AppType =
  | 'kousuan'
  | 'chushi'
  | 'tuoshi'
  | 'jianbian'
  | 'tiankong'
  | 'compare'
  | 'geom'
  | 'word'
  | 'judge'
  | 'choice'

export type Grade = '3A' | '3B'

export interface AppConfig {
  grade: Grade
  /** 已选单元；空数组表示“未选”，生成前会提示 */
  unitIds: string[]
  level: Level
  types: AppType[]
  /**
   * 练习模式逐题型题量：0 或留空 = 不出该题型。
   * 旧配置没有 counts 时由 buildPaper 按 count 做兼容分配。
   */
  counts?: Partial<Record<AppType, number>>
  count: number
  pages: number
  /**
   * 跨卷去重语义位：默认 true（全部题型统一去重）。
   * 暂不暴露 UI；将来做“某类题强化练习”时可按题型覆盖，关掉后不读也不写记忆。
   */
  dedup?: boolean
  /** 留空则自动探测：/opt/homebrew/bin/typst → /usr/local/bin/typst → PATH */
  typstPath: string
}

export const DEFAULT_CONFIG: AppConfig = {
  grade: '3A',
  unitIds: [],
  level: 'L2',
  types: ['kousuan', 'chushi', 'tuoshi'],
  count: 20,
  pages: 1,
  dedup: true,
  typstPath: '',
}

/** 单题型题量硬上限：界面、引擎与配置迁移共用同一口径 */
export const MAX_TYPE_COUNT = 200

/** 把任意来源的题量夹到 0–200（0 表示不出该题型） */
export function clampTypeCount(raw: unknown): number {
  const value = Math.round(Number(raw) || 0)
  return Math.min(MAX_TYPE_COUNT, Math.max(0, value))
}

/** 练习模式首启默认题量（逐题型，未列出的题型为 0） */
export const PRACTICE_DEFAULT_COUNTS: Record<AppType, number> = {
  kousuan: 20,
  chushi: 6,
  tuoshi: 6,
  jianbian: 0,
  tiankong: 8,
  compare: 4,
  geom: 4,
  word: 6,
  judge: 4,
  choice: 4,
}

/** 练习模式首启默认勾选题型 */
export const PRACTICE_DEFAULT_TYPES: AppType[] = ['kousuan', 'tiankong', 'word']

export interface TypstInfo {
  path: string
  version: string
}

export interface TemplateInfo {
  path: string
  exists: boolean
  word: boolean
  compare: boolean
  geom: boolean
}

export interface LayoutCheck {
  ok: boolean
  skipped: boolean
  elapsedMs: number
  output: string
}

export interface GenerateResult {
  outputPath: string
  dataPath: string
  elapsedMs: number
  bytes: number
  pdfBase64: string
  typstPath: string
  typstVersion: string
  /** typst 输出的 warning 原文 */
  warnings: string[]
  /** 是否出现 unknown font family（字体回退到系统字体） */
  fontFallback: boolean
  layout: LayoutCheck
}

export type FillPart = { t: string } | { m: string } | { b: number }

/** 题目渲染类型：填空在模板内部叫 fill，但分区仍叫 tiankong */
export type TypstItemKind = AppType | 'fill'

/** 规则生成题（比大小 / 图形与周长）的复核信息：答案与独立重算参数 */
export interface ItemAudit {
  form: string
  answer: string
  params: Record<string, number | string>
}

export interface TypstItem {
  id: string
  kind: TypstItemKind
  expr?: string
  display?: boolean
  blank?: number
  lines?: number
  parts?: FillPart[]
  pre?: string
  post?: string
  fig?: 'rect' | 'square' | FigureSpec
  text?: string
  workLines?: number
  /** 填空/应用题的答案（模板不渲染，供参考页与导出使用） */
  answers?: string[]
  /** 应用题的完整解答步骤（逐行） */
  solution?: string[]
  /** 比大小 / 图形题的复核字段（模板不渲染） */
  audit?: ItemAudit
  /** 判断题：命题真假（模板按 kind 渲染，不直接显示此字段） */
  truth?: boolean
  /** 选择题：A/B/C/D 选项文本 */
  options?: string[]
  /** 选择题：正确选项下标（0=A） */
  answerIndex?: number
  /** 选择题：每行几个选项（4/2/1） */
  optionCols?: number
  /** 判断题/选择题的复核字段（来源描述 + 每个错误变体的错因） */
  fmt?: FormatAudit
}

export interface FormatAudit {
  data: FormatSourceData
  causes: { value: string; rule: string; detail: string }[]
  truth?: boolean
  answerIndex?: number
}

export interface TypstSection {
  title: string
  kind: AppType
  numbered: boolean
  note?: string
  items: TypstItem[]
}

export interface TypstPaperData {
  title: string
  sections: TypstSection[]
}

/** 出卷运行时复核统计（界面必须展示，不能只写日志） */
export interface RuntimeCheckStats {
  /** 送进复核的题数（不含重生成候选） */
  checked: number
  /** 首次复核不通过、需要重生成或剔除的题数 */
  failed: number
  /** 重生成后仍不通过、最终从卷面剔除的题数 */
  dropped: number
  /** 经重生成后通过复核、留在卷面的题数 */
  regenerated: number
  /** 剔除原因摘要 */
  details: string[]
}

/** 出卷统计，供界面一行摘要使用 */
export interface BuildStats {
  requested: number
  /** 由生成器算出的题量 */
  generated: number
  /** 其中骨架包出题数 */
  skeleton: number
  /** 其中骨架复用题数（题量超过单包骨架数时，同骨架换场景/数字复用） */
  reused: number
  /** 其中旧生成器出题数（骨架无组合时兜底） */
  legacy: number
  /** 同卷去重命中（候选被丢弃）的题量 */
  duplicates: number
  /** 记忆池轮转后跨卷复用的题量（最近 RECENT_WINDOW 卷都出过后按 LRU 复用） */
  crossReused: number
  /** 本次用到的知识点名称（去重） */
  kpNames: string[]
  /** 各题型的设定题量 / 实出题量 / 复用题量 */
  typeStats: TypeQuotaStats[]
  /** 实际覆盖的单元名称 */
  unitNames: string[]
  /** 本次出卷的独立复核结果 */
  runtimeCheck: RuntimeCheckStats
}

export interface TypeQuotaStats {
  type: AppType
  /** 练习模式下为该题型设定值；兼容模式为分配值 */
  requested: number
  /** 实际写入卷面的题量 */
  actual: number
  /** 其中骨架/跨卷复用题量 */
  reused: number
}

export interface BuildResult {
  data: TypstPaperData
  /** 实际写入卷面的题目数量 */
  count: number
  /** 因容量不足而没达到目标题量时给出的提示 */
  shortage: boolean
  /** 已勾选但当前不可用、被跳过的题型 */
  skipped: AppType[]
  /** 兜底 / 跳过 / 生成失败等需要向用户解释的说明 */
  notes: string[]
  stats: BuildStats
  /** 排版回填的页数（未排版时为粗估） */
  pageEstimate?: number
}
