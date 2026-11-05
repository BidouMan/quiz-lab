/** v0.2.0 题库地基：类型定义（只做数据与生成器，不接 UI） */

import type { FigureSpec } from './skeleton/types.ts'

export type Grade = '3A' | '3B'
export type Semester = '上' | '下'
export type CalcType = 'kousuan' | 'chushi' | 'tuoshi' | 'jianbian'
export type Level = 'L1' | 'L2' | 'L3'
export type FormName = 'mul1' | 'div1' | 'mul2' | 'div2' | 'mix2' | 'mix3' | 'assoc' | 'dist'
export type CarryMode = 'none' | 'once' | 'normal' | 'continuous' | 'any'
export type RemainderMode = 'zero' | 'nonzero' | 'any'
export type QuotientZeroMode = 'none' | 'middle' | 'end'

/**
 * 数值约束：所有字段都可选，由具体 form 解释。
 * 数据里写清楚“和≤100”“三位数×一位数、连续进位”“除数一位数、商中间有 0”等要求。
 */
export interface Constraints {
  /** 被乘数 / 被除数的位数 */
  digits?: number
  multiplicandDigits?: number
  multiplierMin?: number
  multiplierMax?: number
  zeroEnd?: boolean
  zeroMiddle?: boolean
  carry?: CarryMode
  maxResult?: number
  minResult?: number
  maxOperand?: number
  minOperand?: number
  dividendDigits?: number
  divisorMin?: number
  divisorMax?: number
  /** 整十数除数步长，例如 10 表示 10/20/.../90 */
  divisorStep?: number
  quotientDigits?: number
  quotientMin?: number
  quotientMax?: number
  exact?: boolean
  remainder?: RemainderMode
  quotientZero?: QuotientZeroMode
  aDigits?: number
  bDigits?: number
  aZeroEnd?: boolean
  bZeroEnd?: boolean
  /** mix2 / mix3 的算式骨架，占位符为 a,b,c,d */
  pattern?: string
  mulDigits?: number
  bracket?: boolean
  terms?: number
  roundTo?: number
  roundPair?: 'a*b' | 'a*c' | 'b*c'
  maxFactor?: number
  minFactor?: number
  /** 混合算式必须包含的运算符，例如 3A-U4 的脱式必须含 ÷ */
  requireOp?: '÷' | '×' | '+' | '-'
}

export interface RuleSpec {
  form: FormName
  constraints: Constraints
  note?: string
}

export type LevelSpecs = Partial<Record<Level, RuleSpec | RuleSpec[]>>

/** 填空题型（tiankong）的知识点形态；每个形态自己处理 L1/L2/L3 的差别 */
export type FillFormName =
  | 'leapYear'
  | 'monthDays'
  | 'timeHour'
  | 'elapsed'
  | 'lengthUnits'
  | 'kmM'
  | 'rectPerimeter'
  | 'squarePerimeter'
  | 'priceQty'
  | 'areaUnit'
  | 'rectArea'
  | 'squareArea'
  | 'fraction'
  | 'speed'
  | 'mul2x2'
  | 'mul2x3'
  | 'div2x2'
  | 'routeSum'
  | 'wallFence'
  | 'fractionUnit'
  | 'fractionPart'
  | 'pattern'
  | 'maxArea'
  | 'tangram'
  | 'angle-count'
  | 'angle-classify'
  | 'angle-add-line'

/** 应用题的场景形态 */
export type WordFormName =
  | 'shopping'
  | 'trip'
  | 'timePlan'
  | 'perimeter'
  | 'area'
  | 'share'
  | 'shopping2'
  | 'bulk'
  | 'pack'
  | 'wallFence'
  | 'shop3'
  | 'shopCompare'
  | 'discount'
  | 'pattern'
  | 'maxArea'
  | 'tangram'

export interface FillRuleSpec {
  form: FillFormName
  note?: string
}

export type FillLevelSpecs = Partial<Record<Level, FillRuleSpec | FillRuleSpec[]>>

export interface WordRuleSpec {
  form: WordFormName
  note?: string
}

export type WordLevelSpecs = Partial<Record<Level, WordRuleSpec | WordRuleSpec[]>>

export interface KpRules {
  kousuan?: LevelSpecs
  chushi?: LevelSpecs
  tuoshi?: LevelSpecs
  jianbian?: LevelSpecs
  tiankong?: FillLevelSpecs
  word?: WordLevelSpecs
}

export interface KnowledgePoint {
  kpId: string
  kpName: string
  rules: KpRules
  /** 为什么本版不生成 / 规则不足的说明 */
  note?: string
}

export interface Unit {
  grade: Grade
  semester: Semester
  unitId: string
  unitName: string
  /** 三下目录未公开发布，按旧结构推定 */
  unconfirmed?: boolean
  note?: string
  kps: KnowledgePoint[]
}

export interface Curriculum {
  version: string
  source: string
  units: Unit[]
}

/** 生成器输出的单题：LaTeX 写法沿用现有题库（\times / \div） */
export interface GeneratedQuestion {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  kpId: string
  kpName: string
  type: CalcType
  level: Level
  latex: string
  /** 程序计算出的答案；有余数写作“商……余数” */
  answer: string
  /** 脱式 / 简便运算的递等式，每行一条 LaTeX */
  answerLines?: string[]
  operands?: [number, number]
  op?: 'mul' | 'div'
  fingerprint: string
  values: number[]
  /** 生成时命中的数值特征，供自检与测试使用 */
  features: Record<string, number | string | boolean>
}

export interface GenerateOptions {
  grade: Grade
  unitId?: string
  kpId?: string
  type: CalcType
  level: Level
  count: number
  seed?: number
  /** 跨卷记忆；不传则本次进程内有效 */
  memory?: import('./memory.ts').MemoryStore
}

export interface GenerateResult {
  questions: GeneratedQuestion[]
  /** 实际题量（去重后不足时可能少于 count） */
  count: number
  /** 目标知识点 */
  targets: { unitId: string; kpId: string; kpName: string }[]
  /** 记忆池轮转后跨卷复用的题数（正常新题不计） */
  crossReused?: number
}

/** 填空题生成中的一道草稿：题干、答案与复核参数；带图形态附 FigureSpec */
export interface FillDraft {
  stem: string
  answers: string[]
  params: ParamMap
  values: number[]
  features: Record<string, number | string | boolean>
  fig?: FigureSpec
}

/** 填空题：题干用 $...$ 表示数学片段、连续下划线表示空位，answer 用“；”分隔 */
export interface FillQuestion {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  kpId: string
  kpName: string
  type: 'tiankong'
  level: Level
  /** 题干：空位写成连续 2 个以上下划线 */
  stem: string
  /** 每个空位一个答案，顺序与题干空位一致 */
  answers: string[]
  /** 参考答案行：answers.join('；') */
  answer: string
  /** 生成参数，供独立求值复核（不是答案本身） */
  params: ParamMap
  fingerprint: string
  values: number[]
  features: Record<string, number | string | boolean>
  /** 角与图形计数等带图填空的图形规格 */
  fig?: FigureSpec
}

/** 应用题的一步解答：算式 + 结果 */
export interface WordStep {
  /** 算式文本，例如 “3 × 6”（不含等号与结果） */
  expr: string
  /** 该步结果（判断类步骤用 0/1 表示不成立/成立） */
  result: number
  /** 参考解答里的完整一行，例如 “3 × 6 = 18（元）” */
  line: string
  /** 是否为“够不够/至少”这类判断步骤（不做算式求值） */
  judge?: boolean
  /** 该步骤对应第几个小问（从 1 开始），自检要求每步都能落到某个小问 */
  q?: number
  /** 带余数除法的余数；有值时按 “a ÷ b = 商……余” 校验 */
  remainder?: number
}

/** 应用题：场景化题干 + 分步解答 */
export interface WordQuestion {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  kpId: string
  kpName: string
  type: 'word'
  level: Level
  /** 场景化题干（1–3 句，问句在题干末尾或分①②列出） */
  stem: string
  /** 逐问的小问句 */
  questions: string[]
  /** 与 questions 一一对应的最终答案（判断类为“够/不够”等） */
  answers: string[]
  /** 参考解答全文（多行，供参考页使用） */
  answer: string
  steps: WordStep[]
  /** 作答留白行数 2–4 */
  workLines: number
  params: ParamMap
  fingerprint: string
  values: number[]
  features: Record<string, number | string | boolean>
}

/** 生成参数键值；允许缺省键（分支形态只填用到的参数） */
export type ParamMap = Record<string, number | string | undefined>

export interface GenerateFillOptions {
  grade: Grade
  unitId?: string
  kpId?: string
  level: Level
  count: number
  seed?: number
  memory?: import('./memory.ts').MemoryStore
  /** 角与图形计数形态的本卷最多占几题；缺省按 count 的 1/3 */
  maxAngle?: number
}

export interface GenerateWordOptions {
  grade: Grade
  unitId?: string
  kpId?: string
  level: Level
  count: number
  seed?: number
  memory?: import('./memory.ts').MemoryStore
}

