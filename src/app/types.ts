import type { Level } from '../quiz/types.ts'
import type { FigureSpec } from '../quiz/skeleton/types.ts'

export type AppType =
  | 'kousuan'
  | 'chushi'
  | 'tuoshi'
  | 'jianbian'
  | 'tiankong'
  | 'compare'
  | 'geom'
  | 'word'

export type Grade = '3A' | '3B'

export interface AppConfig {
  grade: Grade
  /** 已选单元；空数组表示“未选”，生成前会提示 */
  unitIds: string[]
  level: Level
  types: AppType[]
  count: number
  pages: number
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
  typstPath: '',
}

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
  /** 回退到旧静态题库的题量 */
  fallback: number
  /** 同卷去重命中（候选被丢弃）的题量 */
  duplicates: number
  /** 本次用到的知识点名称（去重） */
  kpNames: string[]
  /** 实际覆盖的单元名称 */
  unitNames: string[]
  /** 本次出卷的独立复核结果 */
  runtimeCheck: RuntimeCheckStats
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
}
