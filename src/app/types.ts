export type AppType = 'kousuan' | 'chushi' | 'tuoshi' | 'tiankong' | 'compare' | 'geom' | 'word'

export type Grade = '3A' | '3B'

export interface AppConfig {
  grade: Grade
  types: AppType[]
  count: number
  pages: number
  /** 留空则自动探测：/opt/homebrew/bin/typst → /usr/local/bin/typst → PATH */
  typstPath: string
}

export const DEFAULT_CONFIG: AppConfig = {
  grade: '3A',
  types: ['kousuan', 'chushi', 'tuoshi', 'tiankong'],
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
  fig?: 'rect' | 'square'
  text?: string
  workLines?: number
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

export interface BuildResult {
  data: TypstPaperData
  /** 实际写入卷面的题目数量 */
  count: number
  /** 因题库容量不足而没达到目标题量时给出的提示 */
  shortage: boolean
  /** 已勾选但当前模板不支持、被跳过的题型 */
  skipped: AppType[]
}
