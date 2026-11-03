/** 年级（上海五四学制，小学 1–5 年级） */
export type GradeSemester = '3A' | '3B'

/** 题型 */
export type QuestionType = 'kousuan' | 'chushi' | 'tuoshi' | 'jianbian' | 'tiankong'

export const TYPE_LABELS: Record<QuestionType, string> = {
  kousuan: '口算',
  chushi: '竖式',
  tuoshi: '脱式',
  jianbian: '简便运算',
  tiankong: '填空',
}

/** 竖式运算符 */
export type VertOp = 'add' | 'sub' | 'mul' | 'div'

export interface Question {
  id: string
  grade: GradeSemester
  unitId: string
  unitName: string
  type: QuestionType
  /** LaTeX 题干（仅简单式子），竖式题不用 */
  latex?: string
  /** 竖式题的操作数；mul: [被乘数, 乘数]，div: [被除数, 除数] */
  operands?: [number, number]
  op?: VertOp
  /** 文本题干（可含 LaTeX 片段，用 $...$ 包裹） */
  text?: string
  answer: string
  /** 脱式 / 简便运算的完整递等式（LaTeX，每步一行，含题干行），答案页使用 */
  answerLines?: string[]
}

export interface Unit {
  id: string
  grade: GradeSemester
  name: string
  /** 推定结构标记（三下教材目录未公开发布） */
  inferred?: boolean
}

export interface PaperParams {
  grade: GradeSemester
  unitIds: string[]
  types: QuestionType[]
  /** 用户自由输入 1–100 */
  count: number
  /** 期望卷面页数（不含答案页） */
  pages: number
  withAnswers: boolean
  title: string
}
