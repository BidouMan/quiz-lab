/**
 * v0.3.0 题面骨架试点：数据结构。
 *
 * 两个正交维度：
 * - practice（做法/认知动作）：这题让孩子做什么；
 * - 句式（skeleton）+ 场景（scene）：这题怎么说、发生在哪里。
 *
 * 只读新数据，不依赖现有 fill.ts / word.ts / forms.ts / generate.ts。
 */
import type { Grade, Level } from '../types.ts'

/** 做法（认知动作）：与“句式/场景”正交，同一做法下再分不同说法 */
export type Practice =
  | 'direct'
  | 'inverse'
  | 'perUnit'
  | 'compare'
  | 'compose'
  | 'multistep'
  | 'judge'
  | 'pattern'
  | 'filter'
  | 'open'
  | 'integrated'

export const PRACTICE_LABELS: Record<Practice, string> = {
  direct: '直接求',
  inverse: '逆向求',
  perUnit: '每份数相乘',
  compare: '比较与最值',
  compose: '组合与拆分',
  multistep: '多步合成',
  judge: '判断与验证',
  pattern: '找规律',
  filter: '信息筛选',
  open: '开放举例',
  integrated: '跨知识点综合',
}

export type ComboType = 'word' | 'tiankong'

/** 场景卡：人物 / 物品 / 场所 / 计量单位 / 量词，同一张卡可在不同组合间复用 */
export interface Scene {
  id: string
  person: string
  item: string
  place: string
  /** 只有周长、面积这类“带度量单位”的组合才使用；其余为空串 */
  unit: string
  /** 量词（个/本/支/块/张/间…），模板里写 {cls} */
  cls: string
  /** 场景标签（如 outdoor：能在四周围篱笆/沿边跑），缺省不限制 */
  tags?: string[]
}

/** 数值槽位约束；范围一律按“该组合该难度可接受的数”收紧 */
export interface SlotSpec {
  min: number
  max: number
  /** 步长，例如整十数、偶数 */
  step?: number
  /** 必须严格小于另一个槽位的值 */
  lt?: string
  /** 必须严格大于另一个槽位的值 */
  gt?: string
  /** 与另一个槽位之和固定为 sum（用于“长+宽=定值”这类配比） */
  sumWith?: string
  sum?: number
}

/** 除法结果口径：整除 / 带余数 / 向上取整 / 向下取整 */
export type AskMode = 'exact' | 'remainder' | 'ceil' | 'floor'

/**
 * 一条骨架的一档约束：slots 必填，其余字段按档覆盖。
 * 三档共用同一句式，只换数值域；确实需要加步数时，用 asks/formulas 覆盖。
 */
export interface SkeletonBand {
  slots: Record<string, SlotSpec>
  /** 按档改写题干：单步 / 两步 / 三步做不到同一句时用（如 U1、U6 填空） */
  template?: string
  guard?: (p: Record<string, number>) => boolean
  asks?: string[]
  formulas?: string[]
  answerChoices?: string[][]
  figure?: (p: Record<string, number>) => FigureSpec
  askModes?: AskMode[]
  remainderUnit?: string
  workLines?: number
  unit?: string
  answerUnits?: string[]
  sceneUnit?: string
  sceneTags?: string[]
}

/** 图形标注/图形元语：坐标单位为 mm，原点在画布左上角 */
export interface FigureLabel {
  x: number
  y: number
  text: string
  size?: number
  bold?: boolean
  /** 标注锚点：默认 left（x/y 为左上角），center 表示 top-center，right 表示 top-right */
  anchor?: 'left' | 'center' | 'right'
}

export type FigureStroke = 'solid' | 'dashed' | 'thin' | 'bold'

export interface FigureShape {
  /** 折线顶点；closed=true 时首尾相连 */
  points: [number, number][]
  closed?: boolean
  stroke?: FigureStroke
}

export interface FigureSpec {
  w: number
  h: number
  shapes: FigureShape[]
  labels?: FigureLabel[]
}

/** 一个空位/一问的答案；answerChoices 存在时 formulas 求的是 0 起的选项下标 */
export interface AnswerChoice {
  choices: string[]
}

/**
 * 一条骨架 = 一种句式。
 * 同一做法下写 2–3 条（试点数据实际写到 5 条），一条骨架在一份卷子里最多出现一次。
 * 三档约束：`slots` 是基线档，`bands` 补其余档（见各包文件注释）。
 */
export interface Skeleton {
  id: string
  practice: Practice
  /** 题干模板：{a}/{b} 为数值槽位，{person}/{item}/{place}/{cls} 来自场景卡 */
  template: string
  /** 小问（应用题），渲染时按 ①②③ 接在模板后；填空题为空数组 */
  asks: string[]
  /** 与 asks（或填空空位）一一对应的算式，变量名同 slots */
  formulas: string[]
  /** 应用题答案单位；可写 {cls} 表示取场景量词。填空用 answerUnits */
  unit: string
  /** 场景匹配用的度量单位（厘米/米/平方厘米/平方米）；缺省取 unit */
  sceneUnit?: string
  /** 要求的场景标签（与 Scene.tags 取交集），如绕场跑只能配 outdoor */
  sceneTags?: string[]
  /** 每个空位 / 每问的单位（'' 表示纯数字）；缺省取 unit */
  answerUnits?: string[]
  /** 每问的除法口径，缺省 exact */
  askModes?: AskMode[]
  /** 余数单位，缺省 {cls} */
  remainderUnit?: string
  /** 判断题成立/不成立的说法 */
  judge?: [string, string]
  workLines?: number
  slots: Record<string, SlotSpec>
  /** 数值区间无法表达的额外约束（如 a×b > c×d、必须整除） */
  guard?: (p: Record<string, number>) => boolean
  /** 答案选项：与 formulas 一一对应，formula 求 0 起下标；用于辨认/分类等文字答案 */
  answerChoices?: string[][]
  /** 按参数生成图形；坐标单位 mm，渲染为「文字在左、图在右」 */
  figure?: (p: Record<string, number>) => FigureSpec
  /** 三档约束；缺省档沿用本骨架的 slots/guard/asks/formulas */
  bands?: Partial<Record<Level, SkeletonBand>>
}

export interface Combo {
  /** 组合 id，形如 3A-U6|word|L2 */
  id: string
  /** 样张文件名用，如 u6-perimeter */
  slug: string
  grade: Grade
  unitId: string
  unitName: string
  type: ComboType
  level: Level
  title: string
  /** 场景池：≥12 个场景卡；带单位组合按单位分池 */
  scenes: Scene[]
  /** 骨架：≥5 做法 × 2–3 句式 */
  skeletons: Skeleton[]
  /** 是否按场景单位匹配骨架（周长、面积这类带度量的组合为 true） */
  matchSceneUnit: boolean
}

export interface ComboMeta {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  type: ComboType
  level: Level
  title: string
}

/** 组装器产出的单题（含可复核参数） */
export interface PilotQuestion {
  id: string
  comboId: string
  skeletonId: string
  practice: Practice
  /** 场景去重键：人物|物品|场所 */
  sceneKey: string
  sceneId: string
  params: Record<string, number>
  /** 数值去重键（按槽位名排序后的值） */
  values: number[]
  stem: string
  asks: string[]
  answers: string[]
  steps: string[]
  /** 随题图形；坐标单位 mm */
  fig?: FigureSpec
  answerUnits: string[]
  workLines: number
  /** 题量超过骨架数时，该题由同骨架换场景/数字复用而来 */
  reused?: boolean
}

/** 与 typst/paper.typ 对齐的卷面数据（title / sections / items） */
export interface PilotItem {
  id: string
  kind: 'fill' | 'word'
  parts?: ({ t: string } | { m: string } | { b: number })[]
  text?: string
  workLines?: number
  /** 图形题：渲染在题干右侧 */
  fig?: FigureSpec
  answers?: string[]
  solution?: string[]
}

export interface PilotSection {
  title: string
  kind: ComboType
  numbered: boolean
  items: PilotItem[]
}

export interface PilotPaper {
  title: string
  data: { title: string; sections: PilotSection[] }
  questions: PilotQuestion[]
  /** 其中骨架复用题数（题量超过骨架数时产生） */
  reused: number
  /** 记忆池轮转一轮后跨卷复用的题数 */
  crossReused?: number
}
