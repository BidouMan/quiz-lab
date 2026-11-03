/** v0.2.0 题库地基：类型定义（只做数据与生成器，不接 UI） */

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
}

export interface RuleSpec {
  form: FormName
  constraints: Constraints
  note?: string
}

export type LevelSpecs = Partial<Record<Level, RuleSpec | RuleSpec[]>>

export interface KpRules {
  kousuan?: LevelSpecs
  chushi?: LevelSpecs
  tuoshi?: LevelSpecs
  jianbian?: LevelSpecs
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
}
