import { findUnit } from '../data/curriculum.ts'
import { generate } from './generate.ts'
import { generateFill, verifyFill } from './fill.ts'
import { buildDateKousuan, recomputeDateKousuan, type DateKousuanPiece } from './dateKousuan.ts'
import { bin, evalLatex, evalNode, num, type BinOp, type ExprNode } from './expr.ts'
import type { MemoryStore } from './memory.ts'
import { stableStringify } from './normalize.ts'
import { createRng, randInt, type Rng } from './rng.ts'
import {
  conceptForUnit,
  findConcept,
  verifyConceptChoice,
  verifyConceptSource,
  type ConceptProposition,
} from './concepts.ts'
import type {
  CalcType,
  DateKousuanKind,
  FillFormName,
  FillQuestion,
  GeneratedQuestion,
  Grade,
  Level,
  ParamMap,
} from './types.ts'

/**
 * 判断题 / 选择题：不另建题库，而是从现有的计算题、填空题内容池取题，
 * 按「呈现形式」改写问法，并给每个错误变体标注明确错因。
 *
 * 复核口径：正确值一律从原始参数独立重算（计算题 evalLatex、填空题 verifyFill），
 * 干扰项/假命题的错误值再用错因规则重新推导一次，确保「确实是错的且错因成立」。
 */

export type FormatKind = 'judge' | 'choice'

export type ErrorRuleId =
  | 'misread-operand'
  | 'miss-group'
  | 'extra-group'
  | 'stop-early'
  | 'carry-drop'
  | 'order'
  | 'bracket-drop'
  | 'remainder-swap'
  | 'quotient-off'
  | 'forget-remainder'
  | 'unit-rate'
  | 'not-converted'
  | 'wrong-days'
  | 'time-off'
  | 'half-perimeter'
  | 'miss-side'
  | 'perimeter-area'
  | 'opposite-judgement'
  | 'concept-error'

interface Wrong {
  value: string
  rule: ErrorRuleId
  detail: string
}

/** 复核用的来源描述：够独立重算正确值与每个错因值 */
export interface FormatSourceData {
  pool: 'calc' | 'fill' | 'concept' | 'conceptChoice' | 'dateKousuan' | 'u4choice'
  form: string
  correct: string
  latex?: string
  operands?: [number, number]
  params?: Record<string, number | string>
  /** 概念命题 ID：复核按 ID 查命题表，不靠重算 */
  conceptId?: string
  /** 概念选择题：四个陈述选项与标答下标 */
  options?: string[]
  answerIndex?: number
  /** 概念选择题的问法：want=true 问“正确的是”，false 问“不正确的是” */
  want?: 'true' | 'false'
}

export interface FormatPiece {
  kind: FormatKind
  /** 判断题题干（末尾由模板补「（　　）」）；选择题题干空位已替换为「（　）」 */
  stem: string
  truth?: boolean
  options?: string[]
  answerIndex?: number
  optionCols?: number
  answers: string[]
  kpName: string
  data: FormatSourceData
  causes: Wrong[]
  key: string
}

export interface FormatOptions {
  kind: FormatKind
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed: number
  memory?: MemoryStore
  /** 同卷已用来源（含计算/填空正题） */
  sourceUsed?: Set<string>
}

export interface FormatResult {
  pieces: FormatPiece[]
  notes: string[]
  crossReused: number
}

interface Source {
  pool: 'calc' | 'fill' | 'concept' | 'dateKousuan' | 'u4choice'
  form: string
  correct: string
  numeric: number | null
  kpName: string
  key: string
  judgeStem: (stated: string) => string
  choiceStem: string
  wrongs: Wrong[]
  data: FormatSourceData
  /** 概念命题：真值固定，不能按位置临时改写真假 */
  concept?: ConceptProposition
}

const LEVELS: Level[] = ['L1', 'L2', 'L3']
const levelRank = (level: Level): number => LEVELS.indexOf(level)

/** 错因的最低启用档位：L1 只放「一眼可见的单点错误」，顺序/括号/周长面积放到 L3 */
const RULE_MIN_LEVEL: Record<ErrorRuleId, Level> = {
  'misread-operand': 'L1',
  'miss-group': 'L1',
  'extra-group': 'L1',
  'stop-early': 'L1',
  'unit-rate': 'L1',
  'not-converted': 'L1',
  'wrong-days': 'L1',
  'time-off': 'L1',
  'half-perimeter': 'L1',
  'miss-side': 'L1',
  'opposite-judgement': 'L1',
  'concept-error': 'L1',
  'carry-drop': 'L2',
  'remainder-swap': 'L2',
  'quotient-off': 'L2',
  'forget-remainder': 'L2',
  'perimeter-area': 'L3',
  'order': 'L3',
  'bracket-drop': 'L3',
}

const ruleAllowed = (rule: ErrorRuleId, level: Level): boolean =>
  levelRank(RULE_MIN_LEVEL[rule]) <= levelRank(level)

const specsOf = <T,>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** 各填空形态在本实现中「单空、可构造错因」的档位 */
const FORM_LEVELS: Partial<Record<FillFormName, Level[]>> = {
  leapYear: ['L1', 'L2'],
  monthDays: ['L1'],
  timeHour: ['L1'],
  lengthUnits: ['L1', 'L2'],
  kmM: ['L1', 'L2'],
  rectPerimeter: ['L1', 'L2', 'L3'],
  squarePerimeter: ['L1', 'L2', 'L3'],
  priceQty: ['L1', 'L3'],
  routeSum: ['L2', 'L3'],
}

const CALC_TYPES: CalcType[] = ['kousuan', 'chushi', 'tuoshi', 'jianbian']

/** 所选单元中，真正能产出判断题/选择题来源的单元 */
export function formatSourceUnits(
  grade: Grade,
  unitIds: string[],
  level: Level,
  _kind: FormatKind = 'judge',
): string[] {
  const out: string[] = []
  for (const unitId of unitIds) {
    const unit = findUnit(unitId)
    if (!unit || unit.grade !== grade) continue
    const hasCalc = CALC_TYPES.some((type) =>
      unit.kps.some((kp) => specsOf(kp.rules[type]?.[level]).length > 0),
    )
    const hasFill = unit.kps.some((kp) =>
      specsOf(kp.rules.tiankong?.[level]).some((spec) => FORM_LEVELS[spec.form]?.includes(level)),
    )
    // 概念命题：判断题整卷可用；选择题只有在没有任何数值来源时才用它兜底
    const hasConcept = conceptForUnit(grade, unitId, level).length > 0
    if (hasCalc || hasFill || hasConcept) out.push(unitId)
  }
  return out
}

export function formatSupports(
  grade: Grade,
  unitIds: string[],
  level: Level,
  kind: FormatKind = 'judge',
): boolean {
  return formatSourceUnits(grade, unitIds, level, kind).length > 0
}

// ---------- 计算题的错因推导 ----------

function parseAst(latex: string, flat = false): ExprNode | null {
  const src = latex
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/=/g, ' ')
    .replace(/\s+/g, '')
  let i = 0
  const precOf = (op: BinOp): number => (flat ? 1 : op === '+' || op === '-' ? 1 : 2)
  const primary = (): ExprNode | null => {
    if (src[i] === '(') {
      i++
      const inner = expr(1)
      if (!inner || src[i] !== ')') return null
      i++
      return inner
    }
    const start = i
    while (i < src.length && /[0-9]/.test(src[i]!)) i++
    if (start === i) return null
    return num(Number(src.slice(start, i)))
  }
  const expr = (min: number): ExprNode | null => {
    let left = primary()
    if (!left) return null
    while (true) {
      const op = src[i] as BinOp | undefined
      if (!op || !['+', '-', '×', '÷'].includes(op)) break
      const prec = precOf(op)
      if (prec < min) break
      i++
      const right = expr(prec + 1)
      if (!right) return null
      left = bin(op, left, right)
    }
    return left
  }
  const result = expr(1)
  return result && i === src.length ? result : null
}

const safeEval = (fn: () => number): number | null => {
  try {
    const value = fn()
    return Number.isInteger(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}

/** 深度优先找到「两个操作数都已是数字」的第一个运算，返回它的结果 */
function firstOperationValue(node: ExprNode): number | null {
  if (node.kind === 'num') return null
  const left = firstOperationValue(node.left)
  if (left !== null) return left
  if (node.left.kind === 'num' && node.right.kind === 'num') {
    return safeEval(() => evalNode(node))
  }
  return firstOperationValue(node.right)
}

function missedCarryValues(a: number, b: number): { value: number; column: number }[] {
  const digits = String(a).split('').reverse().map(Number)
  let carry = 0
  const out: { value: number; column: number }[] = []
  for (let index = 0; index < digits.length; index++) {
    const total = digits[index]! * b + carry
    const carryOut = Math.floor(total / 10)
    if (carryOut > 0) out.push({ value: a * b - carryOut * 10 ** (index + 1), column: index })
    carry = carryOut
  }
  return out
}

type CalcLike = Pick<GeneratedQuestion, 'latex'> & {
  operands?: [number, number]
  features: Record<string, number | string | boolean>
}

function calcWrongs(question: CalcLike, correct: number, form: string): Wrong[] {
  const out: Wrong[] = []
  const push = (value: number, rule: ErrorRuleId, detail: string): void => {
    if (!Number.isInteger(value) || value <= 0) return
    const text = String(value)
    if (text === String(correct)) return
    if (out.some((item) => item.value === text)) return
    out.push({ value: text, rule, detail })
  }

  if (form === 'mul1' && question.operands) {
    const [a, b] = question.operands
    push(a * (b - 1), 'miss-group', `少乘 1 组（只算了 ${b - 1} 个 ${a}）`)
    push(a * (b + 1), 'extra-group', `多乘 1 组（算了 ${b + 1} 个 ${a}）`)
    push((a + 1) * b, 'misread-operand', `把 ${a} 看成 ${a + 1}`)
    push((a - 1) * b, 'misread-operand', `把 ${a} 看成 ${a - 1}`)
    push(a * (b + 1), 'misread-operand', `把乘数 ${b} 看成 ${b + 1}`)
    push(a * (b - 1), 'misread-operand', `把乘数 ${b} 看成 ${b - 1}`)
    for (const item of missedCarryValues(a, b)) {
      // 丢掉大额进位会得出明显荒谬的数（如 90×9 漏进位得 10），只保留像真实笔误的结果
      if (item.value < Math.floor(correct * 0.6)) continue
      push(item.value, 'carry-drop', `漏加第 ${item.column + 2} 位的进位`)
    }
    return out
  }

  if ((form === 'div1' || form === 'div2') && question.operands) {
    const [dividend, divisor] = question.operands
    // 整除题的错因：商多/少 1、看错除数
    push(correct - 1, 'quotient-off', '商少算了 1')
    push(correct + 1, 'quotient-off', '商多算了 1')
    if (divisor > 1) {
      push(dividend / (divisor - 1), 'misread-operand', `把除数 ${divisor} 看成 ${divisor - 1}`)
    }
    push(dividend / (divisor + 1), 'misread-operand', `把除数 ${divisor} 看成 ${divisor + 1}`)
    return out
  }

  if (form === 'mul2' && question.operands) {
    const [a, b] = question.operands
    push(a * (b - 1), 'miss-group', '少乘 1 组')
    push(a * (b + 1), 'extra-group', '多乘 1 组')
    push((a + 1) * b, 'misread-operand', `把 ${a} 看成 ${a + 1}`)
    push((a - 1) * b, 'misread-operand', `把 ${a} 看成 ${a - 1}`)
    return out
  }

  // 混合运算：运算顺序 / 漏括号 / 只算一步 / 看错第一个数
  const flat = parseAst(question.latex, true)
  if (flat) {
    const value = safeEval(() => evalNode(flat))
    if (value !== null) push(value, 'order', '运算顺序错（从左往右依次算）')
  }
  if (/[()]/.test(question.latex)) {
    const value = safeEval(() => evalLatex(question.latex.replace(/[()]/g, '')))
    if (value !== null) push(value, 'bracket-drop', '漏掉括号，先算了乘除')
  }
  const ast = parseAst(question.latex)
  if (ast) {
    // 只算了一步 = 只完成了整道题里最先可算的那一个运算，剩下的没算
    const first = firstOperationValue(ast)
    if (first !== null) push(first, 'stop-early', '只算了一步，没有算完')
  }
  const firstNumber = question.latex.match(/\d+/)
  if (firstNumber && firstNumber.index !== undefined) {
    for (const delta of [1, -1]) {
      const replaced =
        question.latex.slice(0, firstNumber.index) +
        String(Number(firstNumber[0]) + delta) +
        question.latex.slice(firstNumber.index + firstNumber[0].length)
      const value = safeEval(() => evalLatex(replaced))
      if (value !== null) {
        push(value, 'misread-operand', `把第一个数 ${firstNumber[0]} 看成 ${Number(firstNumber[0]) + delta}`)
      }
    }
  }
  return out
}

// ---------- 填空题的错因推导 ----------

const pnum = (params: ParamMap | Record<string, number | string> | undefined, key: string): number => {
  const value = params?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function fillWrongs(form: FillFormName, params: ParamMap, correct: string): Wrong[] {
  const out: Wrong[] = []
  const push = (value: number | string, rule: ErrorRuleId, detail: string): void => {
    const text = String(value)
    if (text === correct) return
    if (typeof value === 'number' && (!Number.isInteger(value) || value <= 0)) return
    if (out.some((item) => item.value === text)) return
    out.push({ value: text, rule, detail })
  }
  const mode = String(params.mode ?? '')

  switch (form) {
    case 'leapYear': {
      if (mode === 'judge') {
        push(correct === '闰年' ? '平年' : '闰年', 'opposite-judgement', '平年、闰年判断颠倒')
        break
      }
      if (mode === 'feb') {
        const days = pnum(params, 'year') % 4 === 0 && (pnum(params, 'year') % 100 !== 0 || pnum(params, 'year') % 400 === 0) ? 29 : 28
        push(days === 29 ? 28 : 29, 'wrong-days', days === 29 ? '把闰年二月当成 28 天' : '把平年二月当成 29 天')
        push(30, 'wrong-days', '把二月按小月算成 30 天')
        push(31, 'wrong-days', '把二月按大月算成 31 天')
      }
      break
    }
    case 'monthDays': {
      if (mode === 'days') {
        for (const days of [28, 29, 30, 31]) {
          if (days === 28 || days === 29) push(days, 'wrong-days', '按二月天数算')
          else push(days, 'wrong-days', days === 30 ? '按小月天数算' : '按大月天数算')
        }
      }
      break
    }
    case 'timeHour': {
      if (mode === 'to24' && pnum(params, 'minute') === 0) {
        const hour = pnum(params, 'hour')
        push(hour, 'not-converted', '没有加 12，直接写成上午的时数')
        push(12, 'time-off', '只写成 12 时')
        push(hour + 13, 'time-off', '换算时多算 1 小时')
      }
      break
    }
    case 'lengthUnits': {
      if (mode === 'm2cm') {
        const metres = pnum(params, 'metres')
        push(metres, 'not-converted', '没有乘 100')
        push(metres * 10, 'unit-rate', '按 1 米 = 10 厘米算')
        push(metres * 1000, 'unit-rate', '按 1 米 = 1000 厘米算')
      } else if (mode === 'mixed2cm') {
        const centimetres = pnum(params, 'centimetres')
        push(centimetres, 'not-converted', '漏掉前面的 1 米')
        push(100 + centimetres * 10, 'unit-rate', '把厘米数也乘了 10')
        push(10 + centimetres, 'unit-rate', '按 1 米 = 10 厘米算')
      }
      break
    }
    case 'kmM': {
      if (mode === 'km2m') {
        const kilometres = pnum(params, 'kilometres')
        push(kilometres, 'not-converted', '没有乘 1000')
        push(kilometres * 100, 'unit-rate', '按 1 千米 = 100 米算')
        push(kilometres * 10, 'unit-rate', '按 1 千米 = 10 米算')
      } else if (mode === 'mixed2m') {
        const kilometres = pnum(params, 'kilometres')
        const metres = pnum(params, 'metres')
        push(kilometres + metres, 'unit-rate', '千米和米直接相加，没有换算')
        push(kilometres * 100 + metres, 'unit-rate', '按 1 千米 = 100 米算')
        push(kilometres * 1000 + metres / 10, 'unit-rate', '米数换算时多除了 10')
      } else if (mode === 'kmDiff') {
        const longer = pnum(params, 'kilometres')
        const shorter = pnum(params, 'metres')
        push(longer + shorter, 'misread-operand', '把两条路的长度相加')
        push(longer, 'miss-group', '只写了长的一条')
        push(shorter, 'stop-early', '只写了短的一条')
      } else if (mode === 'unitChoice') {
        push(correct === '千米' ? '米' : '千米', 'opposite-judgement', '单位判断颠倒')
      }
      break
    }
    case 'rectPerimeter': {
      if (mode === 'perimeter' || mode === 'widthLess' || mode === 'doubleLength') {
        const length = pnum(params, 'length')
        const width = pnum(params, 'width')
        push(length + width, 'half-perimeter', '只算了长与宽的和，漏乘 2')
        push(2 * length + width, 'miss-side', '只加了一条宽')
        push(length + 2 * width, 'miss-side', '只加了一条长')
        push(length * width, 'perimeter-area', '把周长和面积混用')
      } else if (mode === 'reverseSide' || mode === 'reverseLength') {
        const perimeter = pnum(params, 'perimeter')
        push(perimeter / 2, 'half-perimeter', '只求了长与宽的和，没有减去已知边')
        push(perimeter, 'not-converted', '忘记除以 2')
        push(perimeter / 2 + pnum(params, 'width'), 'miss-side', '半周长又加了一次宽')
      }
      break
    }
    case 'squarePerimeter': {
      if (mode === 'perimeter') {
        const side = pnum(params, 'side')
        push(side * 2, 'half-perimeter', '漏乘 2，只算了两个边')
        push(side * 3, 'miss-side', '少算一条边')
        push(side, 'miss-side', '把边长当成周长')
        push(side * side, 'perimeter-area', '把周长和面积混用')
      } else if (mode === 'reverseSide') {
        const side = pnum(params, 'side')
        push(side * 4, 'not-converted', '忘记除以 4')
        push(side * 2, 'half-perimeter', '只除以 2')
        push(side * 3, 'miss-side', '少算一条边')
      }
      break
    }
    case 'priceQty': {
      if (mode === 'total') {
        const price = pnum(params, 'price')
        const quantity = pnum(params, 'quantity')
        push(price + quantity, 'misread-operand', '把单价和数量相加')
        push(price * (quantity - 1), 'miss-group', '少算 1 件')
        push((price + 1) * quantity, 'misread-operand', '把单价看高了 1 元')
      } else if (mode === 'reverseUnitPrice') {
        const total = pnum(params, 'total')
        const quantity = pnum(params, 'quantity')
        push(total - quantity, 'stop-early', '用总价减数量')
        push(total / quantity + 1, 'quotient-off', '商多算了 1')
        push(total / (quantity + 1), 'misread-operand', '把数量看多了 1')
      } else if (mode === 'reverseQuantity') {
        const price = pnum(params, 'price')
        const total = pnum(params, 'total')
        push(total - price, 'stop-early', '用总价减单价')
        push(total / price + 1, 'quotient-off', '商多算了 1')
        push(total / price - 1, 'quotient-off', '商少算了 1')
      } else if (mode === 'reverseUnitByChange') {
        const paid = pnum(params, 'paid')
        const change = pnum(params, 'change')
        const quantity = pnum(params, 'quantity')
        push(paid - change, 'stop-early', '只求了总价，没有平均分')
        push((paid - change) / quantity + 1, 'quotient-off', '商多算了 1')
        push(paid + change, 'misread-operand', '把找回的钱也加上')
      } else if (mode === 'reverseTotalByChange') {
        const paid = pnum(params, 'paid')
        const change = pnum(params, 'change')
        push(paid + change, 'misread-operand', '把找回的钱也加上')
        push(paid, 'stop-early', '忘记减去找回的钱')
        push(change, 'misread-operand', '把找回的钱当成总价')
      }
      break
    }
    case 'routeSum': {
      if (mode === 'twoLegs') {
        const a = pnum(params, 'a')
        const b = pnum(params, 'b')
        push(Math.abs(a - b), 'stop-early', '把两段路相减')
        push(a, 'miss-group', '漏算第二段路')
        push(a + b + a, 'extra-group', '多算了一段路')
      } else if (mode === 'compareMore') {
        const a = pnum(params, 'a')
        const b = pnum(params, 'b')
        const extra = pnum(params, 'extra')
        push(a + b, 'stop-early', '漏加多出来的部分')
        push(a + b + extra + extra, 'extra-group', '把多出来的部分算了两次')
        push(a + extra, 'miss-group', '漏算第二段路')
      } else if (mode === 'compareLess') {
        const a = pnum(params, 'a')
        const b = pnum(params, 'b')
        const extra = pnum(params, 'extra')
        push(a + b, 'stop-early', '忘记减去少走的部分')
        push(a + b + extra, 'extra-group', '把少的当成多的')
        push(a, 'miss-group', '漏算第二段路')
      } else if (mode === 'compareRoute') {
        const a = pnum(params, 'a')
        const b = pnum(params, 'b')
        const otherWay = pnum(params, 'otherWay')
        push(a + b + otherWay, 'misread-operand', '把两条路线长度相加')
        push(a + b, 'stop-early', '只写了一条路线的长度')
        push(otherWay, 'miss-group', '只写了另一条路线的长度')
      }
      break
    }
    default:
      break
  }
  return out
}

// ---------- 来源 → 判断题 / 选择题 ----------

function calcSource(question: GeneratedQuestion): Source {
  const form = String(question.features.form ?? '')
  const correct = question.answer
  const hasRemainder = correct.includes('……')
  let wrongs: Wrong[] = []
  if (hasRemainder) {
    const [quotientText, remainderText] = correct.split('……')
    const quotient = Number(quotientText)
    const remainder = Number(remainderText)
    const candidates: Wrong[] = [
      { value: `${remainder}……${quotient}`, rule: 'remainder-swap', detail: '商与余数写反（余数必须小于除数）' },
      { value: `${quotient - 1}……${remainder}`, rule: 'quotient-off', detail: '商少算了 1' },
      { value: `${quotient + 1}……${remainder}`, rule: 'quotient-off', detail: '商多算了 1' },
      { value: String(quotient), rule: 'forget-remainder', detail: '漏写余数' },
    ]
    wrongs = candidates.filter((item) => item.value !== correct && !item.value.startsWith('0……'))
  } else {
    wrongs = calcWrongs(question, Number(correct), form)
  }
  const equals = question.latex.includes('=')
  return {
    pool: 'calc',
    form,
    correct,
    numeric: hasRemainder ? null : Number(correct),
    kpName: question.kpName,
    key: `calc:${question.fingerprint}`,
    judgeStem: (stated) =>
      equals ? `$${question.latex}$ ${stated}` : `$${question.latex}$ = ${stated}`,
    choiceStem: equals ? `$${question.latex}$ （　）` : `$${question.latex}$ = （　）`,
    wrongs,
    data: {
      pool: 'calc',
      form,
      correct,
      latex: question.latex,
      ...(question.operands ? { operands: question.operands } : {}),
    },
  }
}

const BLANK = /_{2,}/

function fillSource(question: FillQuestion): Source {
  const form = question.features.form as FillFormName
  const correct = question.answers[0] ?? ''
  const mode = String(question.params.mode ?? '')
  const wrongs = fillWrongs(form, question.params, correct)
  const numeric = /^\d+$/.test(correct) ? Number(correct) : null
  const stemForChoice = question.stem.replace(BLANK, '（　）')
  const stemForJudge = question.stem.replace(BLANK, '$VALUE$').replace(/（填[^）]*）/g, '')
  const judgeStem = (stated: string): string => {
    if (form === 'leapYear' && mode === 'judge') return `${pnum(question.params, 'year')} 年是${stated}。`
    return stemForJudge.replace('$VALUE$', stated)
  }
  return {
    pool: 'fill',
    form,
    correct,
    numeric,
    kpName: question.kpName,
    key: `fill:${question.fingerprint}`,
    judgeStem,
    choiceStem: stemForChoice.replace(/（填[^）]*）/g, ''),
    wrongs,
    data: {
      pool: 'fill',
      form,
      correct,
      params: Object.fromEntries(
        Object.entries(question.params).filter((entry): entry is [string, number | string] => entry[1] !== undefined),
      ),
    },
  }
}

/** 概念命题来源：题干是整句陈述，真值固定；错因就是命题表里的判据 */
function conceptSource(record: ConceptProposition): Source {
  const correct = record.truth ? '√' : '×'
  return {
    pool: 'concept',
    form: 'concept',
    correct,
    numeric: null,
    kpName: '概念判断',
    key: `concept:${record.knowledgePoint}`,
    judgeStem: () => record.statement,
    choiceStem: '',
    wrongs: record.truth ? [] : [{ value: '×', rule: 'concept-error', detail: record.rationale }],
    data: { pool: 'concept', form: 'concept', correct, conceptId: record.id },
    concept: record,
  }
}

/** 所选单元 / 难度可用的概念命题来源（只进判断题，不进选择题） */
function collectConceptSources(grade: Grade, unitIds: string[], level: Level): Source[] {
  const sources: Source[] = []
  const seenIds = new Set<string>()
  for (const unitId of unitIds) {
    for (const record of conceptForUnit(grade, unitId, level)) {
      if (seenIds.has(record.id)) continue
      seenIds.add(record.id)
      sources.push(conceptSource(record))
    }
  }
  return sources
}

/** 年月日口算：选项/错因必须与正确答案同量纲（天、小时、日） */
const DATE_BLANK = '（　　）'

const monthDaysByRule = (month: number): number | null => {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31
  if ([4, 6, 9, 11].includes(month)) return 30
  return null
}

function dateWrongs(
  kind: string,
  params: Record<string, number | string>,
  correct: string,
): Wrong[] {
  const out: Wrong[] = []
  const push = (value: number, rule: ErrorRuleId, detail: string): void => {
    const text = String(value)
    if (!Number.isInteger(value) || value <= 0) return
    if (text === correct) return
    if (out.some((item) => item.value === text)) return
    out.push({ value: text, rule, detail })
  }
  if (kind === 'monthDays') {
    for (const value of [28, 29, 30, 31]) {
      push(value, 'wrong-days', `该月不是 ${value} 天（记错了月份天数）`)
    }
  } else if (kind === 'bigMonths') {
    for (const value of [6, 8, 9, 12]) {
      push(value, 'wrong-days', `大月个数记成 ${value} 个`)
    }
  } else if (kind === 'elapsedHour') {
    const span = Number(params['result'])
    for (const delta of [1, 2, 3, -1, -2]) {
      push(span + delta, 'time-off', `经过时间算错（多/少算了 ${Math.abs(delta)} 小时）`)
    }
  } else if (kind === 'dateOffset') {
    const day = Number(params['result'])
    const month = Number(params['month'])
    const days = monthDaysByRule(month) ?? 31
    for (const value of [day + 1, day + 2, day - 1, day - 2]) {
      if (value <= days) push(value, 'time-off', '日期推算错（往后数错了天数）')
    }
  }
  return out
}

function dateSource(piece: DateKousuanPiece): Source {
  const kind = String(piece.features['kind'] ?? '')
  const correct = piece.answer
  const text = piece.latex.replace(/^\s*"|"\s*$/g, '')
  const params: Record<string, number | string> = {}
  for (const [key, value] of Object.entries(piece.features)) {
    if (typeof value === 'boolean') params[key] = value ? 1 : 0
    else params[key] = value
  }
  return {
    pool: 'dateKousuan',
    form: kind,
    correct,
    numeric: Number(correct),
    kpName: kind === 'elapsedHour' ? '3A-TIME-ELAPSED' : '3A-CALENDAR-DATE',
    key: `date:${stableStringify(params)}`,
    judgeStem: (stated) => text.replace(DATE_BLANK, stated),
    choiceStem: text.replace(DATE_BLANK, '（　）'),
    wrongs: dateWrongs(kind, params, correct),
    data: { pool: 'dateKousuan', form: kind, correct, params },
  }
}

function u4ChoiceWrongs(
  kind: string,
  params: Record<string, number | string>,
  correct: string,
): Wrong[] {
  const out: Wrong[] = []
  const push = (value: number, rule: ErrorRuleId, detail: string): void => {
    const text = String(value)
    if (!Number.isInteger(value) || value <= 0) return
    if (text === correct) return
    if (out.some((item) => item.value === text)) return
    out.push({ value: text, rule, detail })
  }
  const divisor = Number(params['divisor'])
  const remainder = Number(params['remainder'])
  if (kind === 'remainderRead') {
    push(remainder + 1, 'remainder-swap', '把余数多算了 1')
    push(remainder + 2, 'remainder-swap', '把余数多算了 2')
    push(divisor, 'remainder-swap', '把除数当成余数')
  } else {
    push(divisor, 'remainder-swap', '余数不能等于除数')
    push(divisor - 2, 'forget-remainder', '最大余数少算了 1')
    push(divisor + 1, 'remainder-swap', '余数超过除数')
  }
  return out
}

function u4ChoiceSource(seed: number, index: number): Source {
  const rng = createRng(seed + 5003 + index * 97)
  const divisor = randInt(rng, 6, 9)
  const quotient = randInt(rng, 2, 8)
  if (index === 0) {
    const remainder = randInt(rng, 1, 3)
    const dividend = divisor * quotient + remainder
    const correct = String(remainder)
    return {
      pool: 'u4choice',
      form: 'remainderRead',
      correct,
      numeric: remainder,
      kpName: '3A-DIV-REMAINDER',
      key: `u4:remainderRead:${dividend}:${divisor}`,
      judgeStem: (stated) => `${dividend}÷${divisor}=${quotient}……${stated}`,
      choiceStem: `${dividend}÷${divisor}=${quotient}……（　）`,
      wrongs: u4ChoiceWrongs('remainderRead', { divisor, remainder }, correct),
      data: {
        pool: 'u4choice',
        form: 'remainderRead',
        correct,
        params: { kind: 'remainderRead', divisor, quotient, dividend, remainder },
      },
    }
  }
  const correct = String(divisor - 1)
  return {
    pool: 'u4choice',
    form: 'maxRemainder',
    correct,
    numeric: divisor - 1,
    kpName: '3A-DIV-REMAINDER',
    key: `u4:maxRemainder:${divisor}`,
    judgeStem: (stated) => `除数是${divisor}，余数最大是${stated}。`,
    choiceStem: `除数是${divisor}，余数最大是（　）。`,
    wrongs: u4ChoiceWrongs('maxRemainder', { divisor, remainder: divisor - 1 }, correct),
    data: {
      pool: 'u4choice',
      form: 'maxRemainder',
      correct,
      params: { kind: 'maxRemainder', divisor },
    },
  }
}

function collectSources(input: { grade: Grade; unitIds: string[]; level: Level; seed: number }): Source[] {
  const { grade, unitIds, level, seed } = input
  const sources: Source[] = []
  for (const unitId of unitIds) {
    for (const type of CALC_TYPES) {
      try {
        const result = generate({ grade, unitId, type, level, count: 3, seed })
        for (const question of result.questions) {
          // 年月日口算的题面是填空题，统一改由 dateSource 生成判断/选择陈述句
          if (question.features.form === 'dateKousuan') continue
          sources.push(calcSource(question))
        }
      } catch {
        // 该单元/难度没有这种计算题型
      }
    }
    try {
      const result = generateFill({ grade, unitId, level, count: 8, seed })
      for (const question of result.questions) {
        const form = question.features.form as FillFormName
        if (!FORM_LEVELS[form]?.includes(level)) continue
        if (!question.answers.length || question.answers.length > 1) continue
        if ((question.stem.match(BLANK) ?? []).length !== 1) continue
        sources.push(fillSource(question))
      }
    } catch {
      // 该单元/难度没有填空规则
    }
    if (unitId.endsWith('U5')) {
      for (const kind of ['monthDays', 'bigMonths', 'elapsedHour', 'dateOffset'] as DateKousuanKind[]) {
        const seen = new Set(sources.map((source) => source.key))
        for (let attempt = 0; attempt < 80; attempt++) {
          const rng = createRng(seed + 7001 + attempt * 131 + kind.length * 17)
          const piece = buildDateKousuan(kind, rng, level)
          const source = dateSource(piece)
          if (seen.has(source.key)) continue
          seen.add(source.key)
          sources.push(source)
        }
      }
    }
    if (unitId.endsWith('U4') && level !== 'L1') {
      sources.push(u4ChoiceSource(seed, 0), u4ChoiceSource(seed, 1))
    }
  }
  return sources
}

function optionColumns(options: string[]): number {
  const longest = Math.max(...options.map((option) => option.length))
  if (longest <= 4) return 4
  if (longest <= 10) return 2
  return 1
}

const shuffle = <T,>(rng: Rng, list: T[]): T[] => {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = randInt(rng, 0, index)
    const value = copy[index]!
    copy[index] = copy[swap]!
    copy[swap] = value
  }
  return copy
}

/**
 * 答案序列：先按组均衡，再组内随机洗牌。
 * - 选择题：每 4 道为一组，组内 A/B/C/D 各一次后打散；组界处最多连 2 个相同字母。
 * - 判断题：每 2 道为一组，组内一真一假后打散；组界处最多连 2 个同真假。
 * 不做 index % 4 / 奇偶轮转，孩子无法凭位置规律猜答案；同一 seed 可复现。
 */
function choicePlan(total: number, rng: Rng): number[] {
  const plan: number[] = []
  while (plan.length < total) {
    const group = shuffle(rng, [0, 1, 2, 3])
    plan.push(...group.slice(0, Math.min(4, total - plan.length)))
  }
  return plan
}

function judgePlan(total: number, rng: Rng): boolean[] {
  const plan: boolean[] = []
  while (plan.length < total) {
    const group = shuffle(rng, [true, false])
    plan.push(...group.slice(0, Math.min(2, total - plan.length)))
  }
  return plan
}

function buildJudge(source: Source, allowed: Wrong[], wantFalse: boolean, rng: Rng): FormatPiece | null {
  if (source.concept) {
    const record = source.concept
    // 概念命题真值固定，只能放在与之匹配的答案位置
    if (record.truth === wantFalse) return null
    return {
      kind: 'judge',
      stem: record.statement,
      truth: record.truth,
      answers: [record.truth ? '√' : '×'],
      kpName: source.kpName,
      data: source.data,
      causes: record.truth ? [] : [{ value: '×', rule: 'concept-error', detail: record.rationale }],
      key: `fmt:judge:${source.key}`,
    }
  }
  if (wantFalse && allowed.length === 0) return null
  const cause = wantFalse ? allowed[randInt(rng, 0, allowed.length - 1)]! : null
  const stated = cause ? cause.value : source.correct
  return {
    kind: 'judge',
    stem: source.judgeStem(stated),
    truth: !cause,
    answers: [cause ? '×' : '√'],
    kpName: source.kpName,
    data: source.data,
    causes: cause ? [cause] : [],
    key: `fmt:judge:${source.key}`,
  }
}

function buildChoice(source: Source, allowed: Wrong[], answerIndex: number, rng: Rng): FormatPiece | null {
  if (source.numeric === null) return null
  if (allowed.length < 3) return null
  const picks = shuffle(rng, allowed).slice(0, 3)
  if (picks.length < 3) return null
  const options = new Array<string>(4)
  options[answerIndex] = source.correct
  const others = picks.map((item) => item.value)
  let cursor = 0
  for (let slot = 0; slot < 4; slot++) {
    if (slot === answerIndex) continue
    options[slot] = others[cursor++]!
  }
  if (new Set(options).size !== 4) return null
  return {
    kind: 'choice',
    stem: source.choiceStem,
    options,
    answerIndex,
    optionCols: optionColumns(options),
    answers: [['A', 'B', 'C', 'D'][answerIndex]!],
    kpName: source.kpName,
    data: source.data,
    causes: picks,
    key: `fmt:choice:${source.key}`,
  }
}

/**
 * 概念选择题：焦点命题决定问法（真命题问“正确的是”，假命题问“不正确的是”），
 * 另外 3 个选项取相反真值、且来自其他知识点的陈述 —— 这样每个错误选项只有一处可指认的错误。
 */
function buildConceptChoice(
  focal: Source,
  all: Source[],
  answerIndex: number,
  seed: number,
  distractorUse: Map<string, number>,
): FormatPiece | null {
  const record = focal.concept!
  const wantTrue = record.truth
  const pool = all.filter(
    (source) =>
      source.concept!.truth !== wantTrue &&
      source.concept!.knowledgePoint !== record.knowledgePoint &&
      source.concept!.statement !== record.statement,
  )
  if (pool.length < 3) return null
  // 优先用本卷里出现次数少的陈述，避免同一干扰项反复出现
  const rng = createRng(seed)
  const ordered = shuffle(rng, pool).sort(
    (left, right) =>
      (distractorUse.get(left.concept!.statement) ?? 0) - (distractorUse.get(right.concept!.statement) ?? 0),
  )
  const picks: Source[] = []
  const used = new Set<string>()
  for (const source of ordered) {
    const statement = source.concept!.statement
    if (used.has(statement)) continue
    used.add(statement)
    picks.push(source)
    if (picks.length === 3) break
  }
  if (picks.length < 3) return null
  const options = new Array<string>(4)
  options[answerIndex] = record.statement
  let cursor = 0
  for (let slot = 0; slot < 4; slot++) {
    if (slot === answerIndex) continue
    options[slot] = picks[cursor++]!.concept!.statement
  }
  if (new Set(options.map((option) => option.trim())).size !== 4) return null
  for (const pick of picks) {
    const statement = pick.concept!.statement
    distractorUse.set(statement, (distractorUse.get(statement) ?? 0) + 1)
  }
  const letter = ['A', 'B', 'C', 'D'][answerIndex]!
  return {
    kind: 'choice',
    stem: wantTrue ? '下面说法正确的是（　）' : '下面说法不正确的是（　）',
    options,
    answerIndex,
    optionCols: optionColumns(options),
    answers: [letter],
    kpName: record.knowledgePoint,
    causes: picks.map((pick) => ({
      value: pick.concept!.statement,
      rule: 'concept-error' as ErrorRuleId,
      // 问“不正确的是”时干扰项本身是正确说法，判据改为“不符合问法”
      detail: pick.concept!.truth
        ? '该说法本身正确，不符合“选出不正确说法”的问法'
        : pick.concept!.singleError ?? pick.concept!.rationale,
    })),
    key: `fmt:choice:concept:${record.knowledgePoint}`,
    data: {
      pool: 'conceptChoice',
      form: 'concept',
      correct: letter,
      conceptId: record.id,
      options,
      answerIndex,
      want: wantTrue ? 'true' : 'false',
    },
  }
}

/**
 * 纯概念卷排卷：知识点是硬约束（同卷每个 knowledgePoint 最多 1 题），真假位是软约束。
 * 先按知识点在真假上的可用性分组，再按可出的知识点数决定实出量；
 * 知识点用尽就如实少出，不拿同一知识点的反说法凑数。
 */
function planConceptOnly(
  sources: Source[],
  count: number,
  seed: number,
  sourceUsed: Set<string> | undefined,
  memory: MemoryStore | undefined,
): Array<{ source: Source; reused: boolean }> {
  const rng = createRng(seed + 4519)
  type Group = { trueSources: Source[]; falseSources: Source[] }
  const groups = new Map<string, Group>()
  for (const source of sources) {
    if (sourceUsed?.has(source.key)) continue
    const concept = source.concept!
    const group = groups.get(concept.knowledgePoint) ?? { trueSources: [], falseSources: [] }
    if (concept.truth) group.trueSources.push(source)
    else group.falseSources.push(source)
    groups.set(concept.knowledgePoint, group)
  }
  const isRecent = (source: Source): boolean => memory?.recentlyUsed(source.key) ?? false
  const freshFor = (entry: [string, Group], truth: boolean): boolean =>
    (truth ? entry[1].trueSources : entry[1].falseSources).some((source) => !isRecent(source))
  // 跨卷未用过的知识点优先；同组内保持 shuffle 后的随机顺序
  const entries = shuffle(rng, [...groups.entries()])
  const trueOnly = entries.filter(([, group]) => group.falseSources.length === 0)
  const falseOnly = entries.filter(([, group]) => group.trueSources.length === 0)
  const both = entries.filter(([, group]) => group.trueSources.length > 0 && group.falseSources.length > 0)
  const maxTrue = trueOnly.length + both.length
  const maxFalse = falseOnly.length + both.length
  const total = Math.min(count, entries.length)
  if (total === 0) return []
  // 知识点池不够时只出 total 题；真假尽量各半，但不能靠同知识点凑数
  const lo = Math.max(0, total - maxFalse)
  const hi = Math.min(total, maxTrue)
  const trueCount = Math.min(Math.max(Math.floor(total / 2), lo), hi)
  const falseCount = total - trueCount
  const needBothTrue = Math.max(0, trueCount - trueOnly.length)

  const orderedFor = (list: Array<[string, Group]>, truth: boolean): Array<[string, Group]> => {
    const fresh = list.filter((entry) => freshFor(entry, truth))
    const stale = list.filter((entry) => !freshFor(entry, truth))
    return [...fresh, ...stale]
  }
  const usedKp = new Set<string>()
  const take = (list: Array<[string, Group]>, need: number, maxBoth: number): Array<[string, Group]> => {
    const picked: Array<[string, Group]> = []
    let bothCount = 0
    for (const entry of list) {
      if (picked.length >= need) break
      if (usedKp.has(entry[0])) continue
      const isBoth = entry[1].trueSources.length > 0 && entry[1].falseSources.length > 0
      if (isBoth && bothCount >= maxBoth) continue
      picked.push(entry)
      usedKp.add(entry[0])
      if (isBoth) bothCount += 1
    }
    return picked
  }
  // 先排假，再排真：留够真命题需要的「真假兼备」知识点，假命题优先用真正没出过的
  const falseGroups = take(orderedFor([...falseOnly, ...both], false), falseCount, both.length - needBothTrue)
  const trueGroups = take(orderedFor([...trueOnly, ...both], true), trueCount, needBothTrue)
  const actualTrue = trueGroups.length
  const actualFalse = falseGroups.length

  // 真假序列：能交错就交错，避免连续 3 个同答
  const schedule: boolean[] = []
  let remainingTrue = actualTrue
  let remainingFalse = actualFalse
  while (remainingTrue > 0 || remainingFalse > 0) {
    const options: boolean[] = []
    if (remainingTrue > 0) options.push(true)
    if (remainingFalse > 0) options.push(false)
    const last = schedule[schedule.length - 1]
    const secondLast = schedule[schedule.length - 2]
    const fresh = options.filter((value) => !(value === last && value === secondLast))
    const pool = fresh.length > 0 ? fresh : options
    const value = pool[randInt(rng, 0, pool.length - 1)]!
    schedule.push(value)
    if (value) remainingTrue -= 1
    else remainingFalse -= 1
  }

  const pickSource = (list: Source[]): Source => {
    const fresh = list.filter((source) => !memory?.recentlyUsed(source.key))
    const pool = fresh.length > 0 ? fresh : list
    return pool[randInt(rng, 0, pool.length - 1)]!
  }
  const truePicks = shuffle(rng, trueGroups.map(([, group]) => pickSource(group.trueSources)))
  const falsePicks = shuffle(rng, falseGroups.map(([, group]) => pickSource(group.falseSources)))
  let trueCursor = 0
  let falseCursor = 0
  return schedule.map((truth) => {
    const source = truth ? truePicks[trueCursor++]! : falsePicks[falseCursor++]!
    return { source, reused: memory?.recentlyUsed(source.key) ?? false }
  })
}

export function generateFormat(options: FormatOptions): FormatResult {
  const { kind, grade, level, count, seed } = options
  const memory = options.memory
  const sourceUsed = options.sourceUsed
  if (!Number.isInteger(count) || count <= 0) return { pieces: [], notes: [], crossReused: 0 }
  const units = formatSourceUnits(grade, options.unitIds, level, kind)
  const label = kind === 'judge' ? '判断题' : '选择题'
  if (units.length === 0) {
    return {
      pieces: [],
      notes: [`${label}：所选单元在 ${level} 没有可用于判断/选择的计算或填空内容池，已跳过`],
      crossReused: 0,
    }
  }

  const pieces: FormatPiece[] = []
  const seen = new Set<string>()
  const stale: FormatPiece[] = []
  const staleKeys = new Set<string>()
  let crossReused = 0
  const planRng = createRng(seed + 6173)
  const judgeTarget = kind === 'judge' ? judgePlan(count, planRng) : null
  const choiceTarget = kind === 'choice' ? choicePlan(count, planRng) : null

  const accept = (piece: FormatPiece, key: string, reused: boolean): void => {
    if (reused) crossReused++
    pieces.push(piece)
    seen.add(key)
    sourceUsed?.add(key)
    memory?.record(key)
  }

  // 概念命题：默认整卷最多 1/3；只有该单元组合没有任何数值判断来源时，才放宽到 100%
  const conceptSources = collectConceptSources(grade, units, level)
  const numericSources = collectSources({ grade, unitIds: units, level, seed })
  const conceptOnly = kind === 'judge' && conceptSources.length > 0 && numericSources.length === 0
  // 选择题没有任何数值来源时（例如单独选 U3），用概念命题兜底成“说法选择题”
  const conceptChoiceOnly = kind === 'choice' && conceptSources.length > 0 && numericSources.length === 0
  const conceptList = shuffle(createRng(seed + 8123), conceptSources)
  const conceptCap = conceptOnly
    ? Math.min(count, conceptList.length)
    : Math.min(Math.floor(count / 3), conceptList.length)
  const conceptSlots = new Set<number>()
  if (conceptCap > 0) {
    const step = count / conceptCap
    for (let index = 0; index < conceptCap; index++) {
      conceptSlots.add(Math.min(count - 1, Math.floor(index * step) + 1))
    }
  }
  const conceptStale: FormatPiece[] = []
  let conceptUsed = 0
  const tryConcept = (round: number): boolean => {
    if (kind !== 'judge' || pieces.length >= count || conceptUsed >= conceptCap) return false
    const position = pieces.length
    const wantFalse = judgeTarget![position] === false
    const candidates = conceptList
      .map((source, index) => ({ source, index }))
      .filter(
        ({ source }) =>
          source.concept!.truth === !wantFalse &&
          !seen.has(source.key) &&
          !sourceUsed?.has(source.key),
      )
    if (candidates.length === 0) return false
    // 优先没用过的；只有全被跨卷记忆占用时才走 stale
    const chosen =
      candidates.find(({ source }) => !memory?.recentlyUsed(source.key)) ?? candidates[0]!
    const source = conceptList.splice(chosen.index, 1)[0]!
    const piece = buildJudge(source, [], wantFalse, createRng(seed + position * 31 + round))
    if (!piece) return false
    if (memory?.recentlyUsed(source.key)) {
      conceptStale.push(piece)
      return false
    }
    accept(piece, source.key, false)
    conceptUsed++
    return true
  }
  const fillConceptSlots = (round: number): void => {
    while (kind === 'judge' && pieces.length < count && conceptSlots.has(pieces.length)) {
      conceptSlots.delete(pieces.length)
      if (!tryConcept(round)) continue
    }
  }

  if (conceptChoiceOnly) {
    // 纯概念选择题（如单选 U3）：每题 1 条焦点陈述 + 3 条相反真值陈述，按知识点去重
    const distractorUse = new Map<string, number>()
    const groups = new Map<string, Source[]>()
    for (const source of conceptSources) {
      const kp = source.concept!.knowledgePoint
      const group = groups.get(kp) ?? []
      group.push(source)
      groups.set(kp, group)
    }
    const entries = shuffle(createRng(seed + 9173), [...groups.entries()])
    for (const [kp, group] of entries) {
      if (pieces.length >= count) break
      const key = `concept:${kp}`
      if (seen.has(key) || sourceUsed?.has(key)) continue
      const fresh = group.filter((source) => !memory?.recentlyUsed(source.key))
      const focal = fresh.length > 0 ? fresh[0]! : group[0]!
      const piece = buildConceptChoice(
        focal,
        conceptSources,
        choiceTarget![pieces.length] ?? 0,
        seed + pieces.length * 31,
        distractorUse,
      )
      if (!piece) continue
      accept(piece, key, fresh.length === 0)
    }
  } else if (conceptOnly) {
    // 纯概念卷：按知识点池排卷，知识点用尽就如实少出
    for (const { source, reused } of planConceptOnly(conceptSources, count, seed, sourceUsed, memory)) {
      const piece = buildJudge(source, [], !source.concept!.truth, createRng(seed + pieces.length * 31))
      if (!piece) continue
      accept(piece, source.key, reused)
    }
  } else {
    for (let round = 0; round < 10 && pieces.length < count; round++) {
      fillConceptSlots(round)
      const collected = collectSources({ grade, unitIds: units, level, seed: seed + round * 7919 })
      if (collected.length === 0) {
        // 只有概念命题可用（例如单选 U3）：按答案位顺序补齐，仍受 1/3 上限
        while (tryConcept(round)) {
          /* 继续填，直到凑满或概念候选用尽 */
        }
        break
      }
      // 打散来源顺序，避免总是被排在前面的计算题占满配额，让填空来源也有机会进卷
      const sources = shuffle(createRng(seed + round * 104729), collected)
      for (const source of sources) {
        if (pieces.length >= count) break
        fillConceptSlots(round)
        if (pieces.length >= count) break
        if (seen.has(source.key) || sourceUsed?.has(source.key)) continue
        const allowed = source.wrongs.filter((item) => ruleAllowed(item.rule, level))
        const rng = createRng(seed + pieces.length * 31 + round)
        const position = pieces.length
        const piece =
          kind === 'judge'
            ? buildJudge(source, allowed, judgeTarget![position] === false, rng)
            : buildChoice(source, allowed, choiceTarget![position] ?? 0, rng)
        if (!piece) continue
        if (memory?.recentlyUsed(source.key)) {
          if (!staleKeys.has(source.key)) {
            staleKeys.add(source.key)
            stale.push(piece)
          }
          continue
        }
        accept(piece, source.key, false)
      }
    }

    for (const piece of stale) {
      if (pieces.length >= count) break
      const key = piece.key.replace(/^fmt:(judge|choice):/, '')
      if (seen.has(key)) continue
      accept(piece, key, true)
    }

    // 概念题跨卷复用：只有真值与当前位置一致、且未超 1/3 时才补入，避免破坏真假均衡
    for (const piece of conceptStale) {
      if (pieces.length >= count || conceptUsed >= conceptCap) break
      const key = piece.key.replace(/^fmt:(judge|choice):/, '')
      if (seen.has(key)) continue
      if (piece.truth !== judgeTarget![pieces.length]) continue
      accept(piece, key, true)
      conceptUsed++
    }
  }

  const notes: string[] = []
  if (crossReused > 0) {
    notes.push(`${label}：题池不足，${crossReused} 道按 LRU 跨卷复用（同卷仍不重复）`)
  }
  if (pieces.length < count) {
    notes.push(
      conceptOnly
        ? `判断题：题池只凑到 ${pieces.length}/${count} 道（知识点去重后没有其他知识点的补充命题）`
        : conceptChoiceOnly
          ? `选择题：题池只凑到 ${pieces.length}/${count} 道（知识点去重 + 每题需 3 条相反真值干扰项）`
          : `${label}：题池只凑到 ${pieces.length}/${count} 道（受错因规则与单空来源限制）`,
    )
  }
  if (conceptChoiceOnly) {
    const kpCount = new Set(conceptSources.map((source) => source.concept!.knowledgePoint)).size
    notes.push(
      `选择题：本卷全部为概念命题（实出 ${pieces.length} 题，该单元知识点 ${kpCount} 个；同知识点不重复，干扰项取其他知识点的相反真值陈述）`,
    )
  }
  if (kind === 'judge' && conceptSources.length > 0) {
    const conceptCount = pieces.filter((piece) => piece.data.pool === 'concept').length
    const kpCount = new Set(conceptSources.map((source) => source.concept!.knowledgePoint)).size
    if (conceptOnly && pieces.length < count) {
      notes.push(
        `判断题：本卷全部为概念命题（实出 ${pieces.length} 题，该单元知识点 ${kpCount} 个；同知识点不重复，不用反说法凑数）`,
      )
    } else {
      notes.push(
        conceptOnly
          ? `判断题：本卷全部为概念命题（${conceptCount}/${pieces.length}，该单元无其他判断来源）`
          : `判断题：概念命题 ${conceptCount}/${pieces.length} 道（占比上限 ${Math.floor(count / 3)}）`,
      )
    }
  }
  return { pieces, notes, crossReused }
}

// ---------- 复核：正确值与错因值都独立重算 ----------

export interface FormatVerifyResult {
  ok: boolean
  correct?: string
  error?: string
}

/** 从原始参数重算正确值；不看题面里写的答案 */
export function verifyFormatSource(data: FormatSourceData): FormatVerifyResult {
  if (data.pool === 'conceptChoice') {
    // 概念选择题：逐项回命题表查真值，核对“恰好一真/一假”与标答下标
    const result = verifyConceptChoice({
      conceptId: data.conceptId ?? '',
      options: data.options ?? [],
      answerIndex: data.answerIndex ?? -1,
      want: data.want ?? 'true',
    })
    if (!result.ok) return { ok: false, error: result.error }
    const letter = ['A', 'B', 'C', 'D'][data.answerIndex ?? -1]
    if (data.correct !== letter) return { ok: false, error: `标答字母 ${data.correct} 与下标不符` }
    return { ok: true, correct: data.correct }
  }
  if (data.pool === 'concept') {
    // 概念命题没有数值可重算：按命题 ID 查判据表，核对真值与标答
    const result = verifyConceptSource(data.conceptId, data.correct)
    return result.ok ? { ok: true, correct: data.correct } : { ok: false, error: result.error }
  }
  if (data.pool === 'calc') {
    const latex = data.latex ?? ''
    if (data.correct.includes('……')) {
      const [quotientText, remainderText] = data.correct.split('……')
      const quotient = Number(quotientText)
      const remainder = Number(remainderText)
      const numbers = latex.replace(/\\div/g, '÷').split('÷').map((part) => Number(part.replace(/[^0-9]/g, '')))
      const dividend = numbers[0]
      const divisor = numbers[1]
      if (dividend === undefined || divisor === undefined || !Number.isInteger(dividend) || !Number.isInteger(divisor)) {
        return { ok: false, error: '有余数除法算式无法解析' }
      }
      if (quotient * divisor + remainder !== dividend) return { ok: false, error: '商×除数+余数 ≠ 被除数' }
      if (!(remainder >= 0 && remainder < divisor)) return { ok: false, error: '余数不小于除数' }
      return { ok: true, correct: data.correct }
    }
    try {
      const value = evalLatex(latex)
      if (String(value) !== data.correct) return { ok: false, error: `独立求值 ${value} ≠ 答案 ${data.correct}` }
      return { ok: true, correct: String(value) }
    } catch (error) {
      return { ok: false, error: `算式求值失败：${String(error)}` }
    }
  }

  if (data.pool === 'dateKousuan') {
    const value = recomputeDateKousuan(data.params ?? {})
    if (value === null) return { ok: false, error: '年月日口算无法独立重算' }
    if (String(value) !== data.correct) {
      return { ok: false, error: `独立重算 ${value} ≠ 答案 ${data.correct}` }
    }
    return { ok: true, correct: String(value) }
  }
  if (data.pool === 'u4choice') {
    const params = data.params ?? {}
    const kind = String(params['kind'] ?? '')
    const divisor = Number(params['divisor'])
    const dividend = Number(params['dividend'])
    const quotient = Number(params['quotient'])
    if (!Number.isInteger(divisor) || divisor <= 0) return { ok: false, error: '有余数除法除数无效' }
    let value: number | null = null
    if (kind === 'remainderRead') {
      if (dividend % divisor !== Number(data.correct)) {
        return { ok: false, error: `独立重算余数 ${dividend % divisor} ≠ 答案 ${data.correct}` }
      }
      if (Math.floor(dividend / divisor) !== quotient) {
        return { ok: false, error: '商与独立重算不符' }
      }
      value = dividend % divisor
    } else if (kind === 'maxRemainder') {
      value = divisor - 1
      if (String(value) !== data.correct) {
        return { ok: false, error: `独立重算最大余数 ${value} ≠ 答案 ${data.correct}` }
      }
    }
    if (value === null) return { ok: false, error: '未知的有余数除法题型' }
    if (!(value >= 0 && value < divisor)) return { ok: false, error: '余数不小于除数' }
    return { ok: true, correct: String(value) }
  }

  const form = data.form as FillFormName
  const params: ParamMap = { ...(data.params ?? {}), form }
  try {
    const answers = verifyFill(form, params)
    const expected = answers[0]
    if (expected === undefined) return { ok: false, error: '填空复核没有返回答案' }
    if (String(expected).trim() !== String(data.correct).trim()) {
      return { ok: false, error: `独立复核 ${expected} ≠ 答案 ${data.correct}` }
    }
    return { ok: true, correct: String(expected) }
  } catch (error) {
    return { ok: false, error: `填空复核失败：${String(error)}` }
  }
}

/** 按错因规则重新推导错误值，供复核逐项对照 */
export function deriveWrongValues(data: FormatSourceData): Wrong[] {
  if (data.pool === 'conceptChoice') return []
  if (data.pool === 'concept') {
    const record = findConcept(data.conceptId)
    if (!record || record.truth) return []
    return [{ value: '×', rule: 'concept-error', detail: record.rationale }]
  }
  if (data.pool === 'dateKousuan') {
    const kind = String(data.form)
    return dateWrongs(kind, data.params ?? {}, data.correct)
  }
  if (data.pool === 'u4choice') {
    const params = data.params ?? {}
    const kind = String(params['kind'] ?? data.form)
    return u4ChoiceWrongs(kind, params, data.correct)
  }
  if (data.pool === 'fill') {
    const form = data.form as FillFormName
    const params: ParamMap = { ...(data.params ?? {}), form }
    return fillWrongs(form, params, data.correct)
  }
  if (data.correct.includes('……')) {
    const [quotientText, remainderText] = data.correct.split('……')
    const quotient = Number(quotientText)
    const remainder = Number(remainderText)
    return [
      { value: `${remainder}……${quotient}`, rule: 'remainder-swap', detail: '商与余数写反' },
      { value: `${quotient - 1}……${remainder}`, rule: 'quotient-off', detail: '商少算 1' },
      { value: `${quotient + 1}……${remainder}`, rule: 'quotient-off', detail: '商多算 1' },
      { value: String(quotient), rule: 'forget-remainder', detail: '漏写余数' },
    ]
  }
  return calcWrongs(
    { latex: data.latex ?? '', operands: data.operands, features: { form: data.form } },
    Number(data.correct),
    data.form,
  )
}

export const formatRuleLabel: Record<ErrorRuleId, string> = {
  'misread-operand': '看错数',
  'miss-group': '少算一组/一段',
  'extra-group': '多算一组/一段',
  'stop-early': '少算一步',
  'carry-drop': '漏进位',
  order: '运算顺序错',
  'bracket-drop': '漏括号',
  'remainder-swap': '余数与商写反',
  'quotient-off': '商多/少 1',
  'forget-remainder': '漏写余数',
  'unit-rate': '换算进率错',
  'not-converted': '单位未换算',
  'wrong-days': '天数记错',
  'time-off': '时刻换算错',
  'half-perimeter': '周长漏乘 2',
  'miss-side': '漏算一条边',
  'perimeter-area': '周长面积混用',
  'opposite-judgement': '判断颠倒',
  'concept-error': '概念判断错',
}

export const formatSourceKey = (piece: FormatPiece): string => piece.key
export const formatKeyOf = (data: FormatSourceData): string => `fmt:${data.pool}:${stableStringify(data)}`
