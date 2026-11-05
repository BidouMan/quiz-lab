/**
 * 列式计算（三上沪教版常见题型）。
 *
 * 与填空题的区别：列式计算必须写出综合算式并算出结果，卷面只给题号与题干，
 * 题干下方留 3 行空白供书写，不印空位、不画横线。
 *
 * 生成顺序（不可颠倒）：
 *   1. 先由句式模板声明运算结构（shape，如 `a*b+c`）；
 *   2. 抽数值、按 shape 生成 AST；
 *   3. 由同一模板把 AST 翻成中文题干。
 * 复核走两条独立路径：
 *   1) 按 AST 用栈式求值器重算结果（不复用生成侧的递归求值中间值）；
 *   2) 由模板 ID + 参数反向解析出「期望 AST」，与题目实际 AST 逐节点比对；
 *      题干必须等于模板渲染结果，固定量必须来自 LIE_FIXED 规则表。
 */

import { MemoryStore } from './memory.ts'
import { createRng, randInt, type Rng } from './rng.ts'
import type { Grade, Level } from './types.ts'
import { renderLieSkeleton } from './skeleton/lie-kit.ts'
import { U1_LIE_SKELETONS } from './skeleton/u1-lieshi.ts'
import { U2_LIE_SKELETONS } from './skeleton/u2-lieshi.ts'
import { U4_LIE_SKELETONS } from './skeleton/u4-lieshi.ts'

export type LieOp = '+' | '-' | '×' | '÷'

export type LieAst =
  | { kind: 'num'; value: number }
  | { kind: 'op'; op: LieOp; left: LieAst; right: LieAst }

/** 固定量规则表：题干只写名称，数值统一从这里取，不散落在句式里 */
export const LIE_FIXED = {
  maxTwoDigit: { value: 99, text: '最大的两位数' },
  maxThreeDigit: { value: 999, text: '最大的三位数' },
} as const

type FixedKey = keyof typeof LIE_FIXED

export type LieParams = Record<string, number>

export interface LieTemplate {
  /** 模板 / 句式 ID，跨卷去重与复核都以它为准 */
  id: string
  /** 句式名称（分布表用） */
  label: string
  levels: Level[]
  /** 运算结构；变量名 a,b,c,d,f，运算符 + - * / */
  shape: string
  /** 参数名（按题干出现顺序，便于审计） */
  params: string[]
  stem: (p: LieParams) => string
  /** 单元归属覆盖（“倍”属 U4；其余按 shape 运算映射） */
  units?: string[]
  fixed?: FixedKey
  /** “相差”类：复核要求大减小且差为正 */
  diff?: boolean
  draw: (rng: Rng) => LieParams | null
  /** 骨架迁移：同卷同一骨架最多出几题（旧模板缺省 2，骨架为 1） */
  maxPerPaper?: number
  /** 骨架迁移：从题干反解槽位数值的自检（复核路径 2 优先用它） */
  reverseStem?: (stem: string) => LieParams | null
}

// ---------- AST 基础 ----------

const PREC: Record<LieOp, number> = { '+': 1, '-': 1, '×': 2, '÷': 2 }

export const lieNum = (value: number): LieAst => ({ kind: 'num', value })
export const lieBin = (op: LieOp, left: LieAst, right: LieAst): LieAst => ({ kind: 'op', op, left, right })

/** 把 shape 字符串（a*b+c 等）按参数解析成 AST；生成与反向复核共用同一套词法 */
export function parseLieShape(shape: string, params: LieParams): LieAst {
  const src = shape.replace(/\s+/g, '')
  let i = 0
  const primary = (): LieAst => {
    if (src[i] === '(') {
      i++
      const inner = expr(1)
      if (src[i] !== ')') throw new Error(`shape 括号未闭合：${shape}`)
      i++
      return inner
    }
    const start = i
    while (i < src.length && /[0-9a-z]/.test(src[i]!)) i++
    if (start === i) throw new Error(`shape 非法字符：${shape}`)
    const token = src.slice(start, i)
    if (/^\d+$/.test(token)) return lieNum(Number(token))
    const value = params[token]
    if (typeof value !== 'number') throw new Error(`shape 缺少参数 ${token}：${shape}`)
    return lieNum(value)
  }
  const expr = (min: number): LieAst => {
    let left = primary()
    while (i < src.length) {
      const ch = src[i]!
      if (!'+-*/'.includes(ch)) break
      const op = (ch === '*' ? '×' : ch === '/' ? '÷' : ch) as LieOp
      const prec = PREC[op]
      if (prec < min) break
      i++
      const right = expr(prec + 1)
      left = lieBin(op, left, right)
    }
    return left
  }
  const result = expr(1)
  if (i !== src.length) throw new Error(`shape 有多余字符：${shape}`)
  return result
}

/** 结构化签名：复核用，不做数学化简，保留括号与左右顺序 */
export function lieAstKey(ast: LieAst): string {
  return ast.kind === 'num' ? String(ast.value) : `${ast.op}(${lieAstKey(ast.left)},${lieAstKey(ast.right)})`
}

/** 生成侧求值：递归下降 */
export function evalLieAst(ast: LieAst): number {
  if (ast.kind === 'num') return ast.value
  const left = evalLieAst(ast.left)
  const right = evalLieAst(ast.right)
  switch (ast.op) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '×':
      return left * right
    case '÷':
      if (right === 0 || left % right !== 0) throw new Error(`除法不是整数：${left}÷${right}`)
      return left / right
  }
}

/** 复核侧求值：AST → 后缀表达式 → 栈求值（与生成侧递归实现相互独立） */
export function evalLieAstIndependent(ast: LieAst): number {
  const postfix: Array<LieAst | LieOp> = []
  const build = (node: LieAst): void => {
    if (node.kind === 'num') {
      postfix.push(node)
      return
    }
    build(node.left)
    build(node.right)
    postfix.push(node.op)
  }
  build(ast)
  const stack: number[] = []
  for (const token of postfix) {
    if (typeof token !== 'string') {
      if (token.kind !== 'num') throw new Error('后缀表达式出现非数字节点')
      if (!Number.isInteger(token.value) || token.value < 0) throw new Error(`非法数字 ${token.value}`)
      stack.push(token.value)
      continue
    }
    const right = stack.pop()
    const left = stack.pop()
    if (left === undefined || right === undefined) throw new Error('后缀表达式缺少操作数')
    if (token === '÷' && (right === 0 || left % right !== 0)) throw new Error(`除法不是整数：${left}÷${right}`)
    const value =
      token === '+' ? left + right : token === '-' ? left - right : token === '×' ? left * right : left / right
    if (!Number.isInteger(value)) throw new Error(`结果不是整数：${value}`)
    stack.push(value)
  }
  if (stack.length !== 1) throw new Error('后缀表达式无法归约')
  return stack[0]!
}

/** 语义边界：非负、整数、除法整除；返回第一个问题的文字说明 */
export function lieSemanticIssue(ast: LieAst): string | null {
  if (ast.kind === 'num') {
    if (!Number.isInteger(ast.value) || ast.value < 0) return `数字 ${ast.value} 不是非负整数`
    return null
  }
  const left = lieSemanticIssue(ast.left)
  if (left) return left
  const right = lieSemanticIssue(ast.right)
  if (right) return right
  try {
    const value = evalLieAst(ast)
    if (!Number.isInteger(value) || value < 0) return `结果 ${value} 不是非负整数`
  } catch (error) {
    return (error as Error).message
  }
  return null
}

/** 中缀算式文本：作为参考页的期望算式，括号按运算顺序补出 */
export function renderLieAst(ast: LieAst): string {
  const prec = (node: LieAst): number => (node.kind === 'num' ? 3 : PREC[node.op])
  const wrap = (node: LieAst, parent: LieOp | null, side: 'left' | 'right'): string => {
    const text =
      node.kind === 'num'
        ? String(node.value)
        : `${wrap(node.left, node.op, 'left')}${node.op}${wrap(node.right, node.op, 'right')}`
    if (parent == null || node.kind === 'num') return text
    const pp = PREC[parent]
    const cp = prec(node)
    const need =
      cp < pp ||
      (side === 'right' && cp === pp && (parent === '-' || parent === '÷' || node.op === '-' || node.op === '÷'))
    return need ? `(${text})` : text
  }
  return wrap(ast, null, 'left')
}

// ---------- 数值抽样 ----------

const retry = <T,>(make: () => T | null): T | null => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const value = make()
    if (value != null) return value
  }
  return null
}

interface MulPair {
  a: number
  b: number
  p: number
}
interface DivPair {
  a: number
  b: number
  q: number
}

const mulPair = (rng: Rng, maxProduct = 900): MulPair | null => {
  const a = randInt(rng, 12, 99)
  const b = randInt(rng, 2, 9)
  const p = a * b
  return p <= maxProduct ? { a, b, p } : null
}

const divPair = (rng: Rng, maxDividend = 999): DivPair | null => {
  const b = randInt(rng, 2, 9)
  const q = randInt(rng, 2, 99)
  const a = b * q
  return a <= maxDividend ? { a, b, q } : null
}

const divisorOf = (value: number, rng: Rng): number | null => {
  const list = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => value % d === 0)
  return list.length > 0 ? list[randInt(rng, 0, list.length - 1)]! : null
}

// ---------- 三档句式模板 ----------

const U1 = ['3A-U1']
const U2 = ['3A-U2']
const U4 = ['3A-U4']
const U6 = ['3A-U6']

const L1: Level[] = ['L1']
const L2: Level[] = ['L2']
const L3: Level[] = ['L3']

const dRepeatSum = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 2, 9)
    const b = randInt(rng, 11, 99)
    return b * a <= 999 ? { a, b } : null
  })

const dProduct = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng)
    return pair ? { a: pair.a, b: pair.b } : null
  })

const dProductMore = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng, 800)
    if (!pair) return null
    const c = randInt(rng, 2, Math.min(200, 999 - pair.p))
    return { a: pair.a, b: pair.b, c }
  })

const dProductLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng, 800)
    if (!pair || pair.p < 5) return null
    const c = randInt(rng, 2, Math.min(200, pair.p - 1))
    return { a: pair.a, b: pair.b, c }
  })

const dSumProduct = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 2, 9)
    const c = randInt(rng, 2, 20)
    return a + b * c <= 999 ? { a, b, c } : null
  })

const dProductSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const b = randInt(rng, 2, 9)
    const c = randInt(rng, 2, 20)
    const p = b * c
    const a = p + randInt(rng, 2, 200)
    return a <= 999 ? { a, b, c } : null
  })

const dAddSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 12, 99)
    const c = randInt(rng, 2, Math.min(200, a + b - 1))
    return { a, b, c }
  })

const dSubAdd = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 40, 99)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, Math.min(300, 999 - (a - b)))
    return { a, b, c }
  })

const dSumPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 12, 99)
    const c = randInt(rng, 2, 99)
    return a + b + c <= 999 ? { a, b, c } : null
  })

const dSubSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 100, 300)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, a - b - 1)
    return { a, b, c }
  })

const dQuotientPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair) return null
    const c = randInt(rng, 2, Math.min(200, 999 - pair.q))
    return { a: pair.a, b: pair.b, c }
  })

const dQuotientLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair || pair.q < 4) return null
    const c = randInt(rng, 2, pair.q - 1)
    return { a: pair.a, b: pair.b, c }
  })

const dProductDivide = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng)
    if (!pair) return null
    const c = divisorOf(pair.p, rng)
    return c == null ? null : { a: pair.a, b: pair.b, c }
  })

const dDivTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair) return null
    const c = randInt(rng, 2, 9)
    return pair.q * c <= 999 ? { a: pair.a, b: pair.b, c } : null
  })

const dDivSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair) return null
    const a = pair.a + randInt(rng, 2, Math.min(200, 999 - pair.a))
    return { a, b: pair.b, c: pair.q }
  })

const dBbeiPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 2, 20)
    const b = randInt(rng, 2, 9)
    return a * b <= 200 ? { a, b, c: randInt(rng, 2, Math.min(200, 999 - a * b)) } : null
  })

// 周长（U6）：长、宽均为整厘米，周长 =（长+宽）×2；正方形 = 边长×4
const dRectPerimeter = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 8, 40)
    const b = randInt(rng, 2, a - 1)
    return (a + b) * 2 <= 999 ? { a, b } : null
  })

const dSquarePerimeter = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 3, 40)
    return a * 4 <= 999 ? { a } : null
  })

// L2：两步含括号
const dSumTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 60)
    const b = randInt(rng, 12, 60)
    const c = randInt(rng, 2, 9)
    return (a + b) * c <= 999 ? { a, b, c } : null
  })

const dDiffTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 40, 99)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, 9)
    return (a - b) * c <= 999 ? { a, b, c } : null
  })

// U2 用一位数乘：先合并份数（b±c 为一位数），再用单价/每份数乘
const dRowsSumTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 6, 20)
    const b = randInt(rng, 1, 4)
    const c = randInt(rng, 1, 4)
    return b + c <= 9 && a * (b + c) <= 999 ? { a, b, c } : null
  })

const dPriceMoreTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 2, 4)
    const c = randInt(rng, 1, 4)
    return b + c <= 9 && a * (b + c) <= 999 ? { a, b, c } : null
  })

const dBoxesLeftTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 60)
    const b = randInt(rng, 3, 9)
    const c = randInt(rng, 1, b - 2)
    return b - c >= 2 && a * (b - c) <= 999 ? { a, b, c } : null
  })

const dSumDiv = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 2, 99)
    const sum = c * q
    if (sum > 999 || sum < 30) return null
    const a = randInt(rng, 12, sum - 12)
    return { a, b: sum - a, c }
  })

const dDiffDiv = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 2, 99)
    const diff = c * q
    if (diff > 900) return null
    const b = randInt(rng, 12, 999 - diff)
    return { a: b + diff, b, c }
  })

// L3：三步或“相差/多/少”语义复合
const dSumTimesLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 60)
    const b = randInt(rng, 12, 60)
    const c = randInt(rng, 2, 9)
    const p = (a + b) * c
    if (p > 999) return null
    return { a, b, c, d: randInt(rng, 2, Math.min(200, p - 1)) }
  })

const dDiffTimesPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 40, 99)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, 9)
    const p = (a - b) * c
    if (p > 800) return null
    return { a, b, c, d: randInt(rng, 2, Math.min(200, 999 - p)) }
  })

const dProductAddSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng, 600)
    if (!pair) return null
    const c = randInt(rng, 2, Math.min(200, 999 - pair.p - 2))
    const d = randInt(rng, 2, pair.p + c - 1)
    return { a: pair.a, b: pair.b, c, d }
  })

const dProductSubAdd = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng, 600)
    if (!pair || pair.p < 5) return null
    const c = randInt(rng, 2, Math.min(200, pair.p - 1))
    const rest = pair.p - c
    return { a: pair.a, b: pair.b, c, d: randInt(rng, 2, Math.min(200, 999 - rest)) }
  })

const dSumTimesPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 60)
    const b = randInt(rng, 12, 60)
    const c = randInt(rng, 2, 9)
    const p = (a + b) * c
    return p <= 800 ? { a, b, c, d: randInt(rng, 2, Math.min(200, 999 - p)) } : null
  })

const dDiffTimesLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 40, 99)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, 9)
    const p = (a - b) * c
    if (p < 5) return null
    return { a, b, c, d: randInt(rng, 2, Math.min(200, p - 1)) }
  })

const dRepeatSumDiff = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 2, 9)
    const b = randInt(rng, 12, 99)
    return b * a > LIE_FIXED.maxTwoDigit.value ? { a, b, f: LIE_FIXED.maxTwoDigit.value } : null
  })

const dAddSubAdd = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 12, 99)
    const c = randInt(rng, 2, Math.min(200, a + b - 1))
    const d = randInt(rng, 2, Math.min(200, 999 - (a + b - c)))
    return { a, b, c, d }
  })

const dSubAddSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 100, 300)
    const b = randInt(rng, 2, a - 2)
    const c = randInt(rng, 2, Math.min(300, 999 - (a - b)))
    const rest = a - b + c
    if (rest < 3) return null
    return { a, b, c, d: randInt(rng, 2, rest - 1) }
  })

const dProductProductAdd = (rng: Rng): LieParams | null =>
  retry(() => {
    const p1 = mulPair(rng, 400)
    const p2 = mulPair(rng, 400)
    if (!p1 || !p2 || p1.p + p2.p > 999) return null
    return { a: p1.a, b: p1.b, c: p2.a, d: p2.b }
  })

const dSumProductSub = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 2, 9)
    const c = randInt(rng, 2, 20)
    const p = b * c
    if (a + p > 999 || a + p < 5) return null
    return { a, b, c, d: randInt(rng, 2, Math.min(200, a + p - 1)) }
  })

const dRepeatSumTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 2, 9)
    const b = randInt(rng, 12, 99)
    const c = randInt(rng, 2, 9)
    return b * a * c <= 999 ? { a, b, c } : null
  })

const dProductTimes = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 99)
    const b = randInt(rng, 2, 9)
    const c = randInt(rng, 2, 9)
    return a * b * c <= 999 ? { a, b, c } : null
  })

const dProductDivPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng)
    if (!pair) return null
    const c = divisorOf(pair.p, rng)
    if (c == null) return null
    const q = pair.p / c
    return { a: pair.a, b: pair.b, c, d: randInt(rng, 2, Math.min(200, 999 - q)) }
  })

const dProductDivLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = mulPair(rng)
    if (!pair) return null
    const c = divisorOf(pair.p, rng)
    if (c == null) return null
    const q = pair.p / c
    if (q < 4) return null
    return { a: pair.a, b: pair.b, c, d: randInt(rng, 2, Math.min(200, q - 1)) }
  })

const dSumDivPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 2, 99)
    const sum = c * q
    if (sum > 800 || sum < 30) return null
    const a = randInt(rng, 12, sum - 12)
    return { a, b: sum - a, c, d: randInt(rng, 2, Math.min(200, 999 - q)) }
  })

const dSumDivLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 4, 99)
    const sum = c * q
    if (sum > 800 || sum < 30) return null
    const a = randInt(rng, 12, sum - 12)
    return { a, b: sum - a, c, d: randInt(rng, 2, Math.min(200, q - 1)) }
  })

const dDiffDivPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 2, 99)
    const diff = c * q
    if (diff > 600) return null
    const b = randInt(rng, 12, 999 - diff)
    return { a: b + diff, b, c, d: randInt(rng, 2, Math.min(200, 999 - q)) }
  })

const dDiffDivLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const q = randInt(rng, 4, 99)
    const diff = c * q
    if (diff > 600) return null
    const b = randInt(rng, 12, 999 - diff)
    return { a: b + diff, b, c, d: randInt(rng, 2, Math.min(200, q - 1)) }
  })

const dQuotientDiff = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair || pair.q < 4) return null
    const c = randInt(rng, 2, pair.q - 1)
    return { a: pair.a, b: pair.b, c }
  })

const dDivTimesPlus = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair) return null
    const c = randInt(rng, 2, 9)
    const p = pair.q * c
    if (p > 800) return null
    return { a: pair.a, b: pair.b, c, d: randInt(rng, 2, Math.min(200, 999 - p)) }
  })

const dDivTimesLess = (rng: Rng): LieParams | null =>
  retry(() => {
    const pair = divPair(rng)
    if (!pair) return null
    const c = randInt(rng, 2, 9)
    const p = pair.q * c
    if (p < 5) return null
    return { a: pair.a, b: pair.b, c, d: randInt(rng, 2, Math.min(200, p - 1)) }
  })

const dBbeiDiff = (rng: Rng): LieParams | null =>
  retry(() => {
    const a = randInt(rng, 12, 20)
    const b = randInt(rng, 6, 9)
    return a * b > LIE_FIXED.maxTwoDigit.value ? { a, b, f: LIE_FIXED.maxTwoDigit.value } : null
  })

const dSumTimesDiv = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const d = randInt(rng, 2, 9)
    const k = randInt(rng, 2, Math.floor(999 / (c * d)))
    const sum = d * k
    if (sum < 30) return null
    const a = randInt(rng, 12, sum - 12)
    return { a, b: sum - a, c, d }
  })

const dDiffTimesDiv = (rng: Rng): LieParams | null =>
  retry(() => {
    const c = randInt(rng, 2, 9)
    const d = randInt(rng, 2, 9)
    const k = randInt(rng, 2, Math.floor(900 / (c * d)))
    const diff = d * k
    const b = randInt(rng, 12, 999 - diff)
    return { a: b + diff, b, c, d }
  })

export const LIE_TEMPLATES: LieTemplate[] = [
  // ---- L1：一步，或两步但不含括号 ----
  {
    id: 'l1-repeat-sum',
    label: 'a个b相加',
    levels: L1,
    shape: 'b*a',
    params: ['a', 'b'],
    stem: (p) => `${p.a}个${p.b}相加的和是多少？`,
    draw: dRepeatSum,
  },
  {
    id: 'l1-repeat-sum-alt',
    label: 'a个b相加（另一种问法）',
    levels: L1,
    shape: 'b*a',
    params: ['a', 'b'],
    stem: (p) => `把${p.a}个${p.b}相加，和是多少？`,
    draw: dRepeatSum,
  },
  {
    id: 'l1-product',
    label: 'a乘b',
    levels: L1,
    shape: 'a*b',
    params: ['a', 'b'],
    stem: (p) => `${p.a}乘${p.b}得多少？`,
    draw: dProduct,
  },
  {
    id: 'l1-product-more',
    label: '比a与b的积多c',
    levels: L1,
    shape: 'a*b+c',
    params: ['a', 'b', 'c'],
    stem: (p) => `比${p.a}与${p.b}的积多${p.c}的数是多少？`,
    draw: dProductMore,
  },
  {
    id: 'l1-product-less',
    label: '比a与b的积少c',
    levels: L1,
    shape: 'a*b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `比${p.a}与${p.b}的积少${p.c}的数是多少？`,
    draw: dProductLess,
  },
  {
    id: 'l1-sum-product',
    label: 'a加上b与c的积',
    levels: L1,
    shape: 'a+b*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}加上${p.b}与${p.c}的积，得多少？`,
    draw: dSumProduct,
  },
  {
    id: 'l1-product-sub',
    label: '从a里减去b与c的积',
    levels: L1,
    shape: 'a-b*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `从${p.a}里减去${p.b}与${p.c}的积，得多少？`,
    draw: dProductSub,
  },
  {
    id: 'l1-add-sub',
    label: 'a加b再减c',
    levels: L1,
    shape: 'a+b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}加${p.b}再减去${p.c}，得多少？`,
    draw: dAddSub,
  },
  {
    id: 'l1-sum-less',
    label: 'a与b的和减c',
    levels: L1,
    shape: 'a+b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的和再减去${p.c}，得多少？`,
    draw: dAddSub,
  },
  {
    id: 'l1-sub-add',
    label: 'a减b再加c',
    levels: L1,
    shape: 'a-b+c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}减${p.b}再加${p.c}，得多少？`,
    draw: dSubAdd,
  },
  {
    id: 'l1-sum-plus',
    label: 'a加b再加c',
    levels: L1,
    shape: 'a+b+c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}加${p.b}再加${p.c}，和是多少？`,
    draw: dSumPlus,
  },
  {
    id: 'l1-sum-plus-alt',
    label: 'a与b的和再加c',
    levels: L1,
    shape: 'a+b+c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的和再加${p.c}，和是多少？`,
    draw: dSumPlus,
  },
  {
    id: 'l1-sub-sub',
    label: 'a减b再减c',
    levels: L1,
    shape: 'a-b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}减${p.b}再减${p.c}，差是多少？`,
    draw: dSubSub,
  },
  {
    id: 'l1-quotient-plus',
    label: 'a除以b的商加c',
    levels: L1,
    shape: 'a/b+c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}除以${p.b}的商加${p.c}，得多少？`,
    draw: dQuotientPlus,
  },
  {
    id: 'l1-quotient-less',
    label: 'a除以b的商减c',
    levels: L1,
    shape: 'a/b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}除以${p.b}的商减${p.c}，得多少？`,
    draw: dQuotientLess,
  },
  {
    id: 'l1-product-divide',
    label: 'a与b的积除以c',
    levels: L1,
    shape: 'a*b/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的积除以${p.c}，商是多少？`,
    draw: dProductDivide,
  },
  {
    id: 'l1-div-times',
    label: 'a除以b的商乘c',
    levels: L1,
    shape: 'a/b*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}除以${p.b}的商乘${p.c}，积是多少？`,
    draw: dDivTimes,
  },
  {
    id: 'l1-share',
    label: '把a平均分成b份',
    levels: L1,
    shape: 'a/b',
    params: ['a', 'b'],
    stem: (p) => `把${p.a}平均分成${p.b}份，每份是多少？`,
    draw: (rng) => {
      const pair = divPair(rng)
      return pair ? { a: pair.a, b: pair.b } : null
    },
  },
  {
    id: 'l1-div-sub',
    label: '从a里减去商',
    levels: L1,
    shape: 'a-b/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `从${p.a}里减去${p.b}除以${p.c}的商，得多少？`,
    draw: dDivSub,
  },
  {
    id: 'l1-bbei-plus',
    label: 'a的b倍与c的和',
    levels: L1,
    shape: 'a*b+c',
    params: ['a', 'b', 'c'],
    units: U4,
    stem: (p) => `${p.a}的${p.b}倍与${p.c}的和是多少？`,
    draw: dBbeiPlus,
  },
  {
    id: 'l1-square-perimeter',
    label: '正方形周长（边长乘4）',
    levels: L1,
    shape: 'a*4',
    params: ['a'],
    units: U6,
    stem: (p) => `边长${p.a}厘米的正方形，周长是多少厘米？`,
    draw: dSquarePerimeter,
  },

  // ---- L2：两步含括号 ----
  {
    id: 'l2-sum-times',
    label: 'a与b的和乘c',
    levels: L2,
    shape: '(a+b)*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的和乘${p.c}，积是多少？`,
    draw: dSumTimes,
  },
  {
    id: 'l2-diff-times',
    label: 'a与b的差乘c',
    levels: L2,
    shape: '(a-b)*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的差乘${p.c}，积是多少？`,
    draw: dDiffTimes,
  },
  {
    id: 'l2-times-sum',
    label: 'c乘a与b的和',
    levels: L2,
    shape: 'c*(a+b)',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.c}乘${p.a}与${p.b}的和，积是多少？`,
    draw: dSumTimes,
  },
  {
    id: 'l2-times-diff',
    label: 'c乘a与b的差',
    levels: L2,
    shape: 'c*(a-b)',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.c}乘${p.a}与${p.b}的差，积是多少？`,
    draw: dDiffTimes,
  },
  {
    id: 'l2-sum-times-pre',
    label: '先把a与b相加再乘c',
    levels: L2,
    shape: '(a+b)*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `先把${p.a}与${p.b}相加，再乘${p.c}，得多少？`,
    draw: dSumTimes,
  },
  {
    id: 'l2-diff-times-pre',
    label: '先把a与b相减再乘c',
    levels: L2,
    shape: '(a-b)*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `先把${p.a}与${p.b}相减，再乘${p.c}，得多少？`,
    draw: dDiffTimes,
  },
  {
    id: 'l2-sum-div',
    label: 'a与b的和除以c',
    levels: L2,
    shape: '(a+b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的和除以${p.c}，商是多少？`,
    draw: dSumDiv,
  },
  {
    id: 'l2-diff-div',
    label: 'a与b的差除以c',
    levels: L2,
    shape: '(a-b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的差除以${p.c}，商是多少？`,
    draw: dDiffDiv,
  },
  {
    id: 'l2-sum-share',
    label: '把a与b的和平均分成c份',
    levels: L2,
    shape: '(a+b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `把${p.a}与${p.b}的和平均分成${p.c}份，每份是多少？`,
    draw: dSumDiv,
  },
  {
    id: 'l2-diff-share',
    label: '把a与b的差平均分成c份',
    levels: L2,
    shape: '(a-b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `把${p.a}与${p.b}的差平均分成${p.c}份，每份是多少？`,
    draw: dDiffDiv,
  },
  {
    id: 'l2-sum-div-alt',
    label: 'a与b的和是c的几倍',
    levels: L2,
    shape: '(a+b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的和是${p.c}的几倍？`,
    draw: dSumDiv,
  },
  {
    id: 'l2-diff-div-alt',
    label: 'a与b的差里面有几个c',
    levels: L2,
    shape: '(a-b)/c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的差里面有几个${p.c}？`,
    draw: dDiffDiv,
  },
  {
    id: 'l2-rows-sum-times',
    label: '每排人数乘（男生排数+女生排数）',
    levels: L2,
    shape: 'a*(b+c)',
    params: ['a', 'b', 'c'],
    units: U2,
    stem: (p) => `每排${p.a}人，男生站${p.b}排，女生站${p.c}排，一共有多少人？`,
    draw: dRowsSumTimes,
  },
  {
    id: 'l2-price-more-times',
    label: '单价乘（先买个数+再买个数）',
    levels: L2,
    shape: 'a*(b+c)',
    params: ['a', 'b', 'c'],
    units: U2,
    stem: (p) => `每个${p.a}元，买${p.b}个，再买${p.c}个，一共要多少元？`,
    draw: dPriceMoreTimes,
  },
  {
    id: 'l2-boxes-left-times',
    label: '每盒个数乘（买了盒数-送出盒数）',
    levels: L2,
    shape: 'a*(b-c)',
    params: ['a', 'b', 'c'],
    units: U2,
    stem: (p) => `每盒有${p.a}个鸡蛋，买了${p.b}盒，送给邻居${p.c}盒，还剩多少个鸡蛋？`,
    draw: dBoxesLeftTimes,
  },
  {
    id: 'l2-rect-perimeter',
    label: '长方形周长（长、宽的和乘2）',
    levels: L2,
    shape: '(a+b)*2',
    params: ['a', 'b'],
    units: U6,
    stem: (p) => `长${p.a}厘米、宽${p.b}厘米的长方形，周长是多少厘米？`,
    draw: dRectPerimeter,
  },
  {
    id: 'l2-rect-perimeter-alt',
    label: '长方形周长（另一种问法）',
    levels: L2,
    shape: '(a+b)*2',
    params: ['a', 'b'],
    units: U6,
    stem: (p) => `一个长方形的长是${p.a}厘米，宽是${p.b}厘米，它的周长是多少厘米？`,
    draw: dRectPerimeter,
  },

  // ---- L3：三步，或“相差/多/少”语义复合 ----
  {
    id: 'l3-sum-times-less',
    label: '和乘c再减d',
    levels: L3,
    shape: '(a+b)*c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的和乘${p.c}，再减去${p.d}，得多少？`,
    draw: dSumTimesLess,
  },
  {
    id: 'l3-diff-times-plus',
    label: '差乘c再加d',
    levels: L3,
    shape: '(a-b)*c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的差乘${p.c}，再加上${p.d}，得多少？`,
    draw: dDiffTimesPlus,
  },
  {
    id: 'l3-product-add-sub',
    label: '积加c再减d',
    levels: L3,
    shape: 'a*b+c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的积加${p.c}再减${p.d}，得多少？`,
    draw: dProductAddSub,
  },
  {
    id: 'l3-product-sub-add',
    label: '积减c再加d',
    levels: L3,
    shape: 'a*b-c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的积减${p.c}再加${p.d}，得多少？`,
    draw: dProductSubAdd,
  },
  {
    id: 'l3-sum-times-plus',
    label: '和乘c再加d',
    levels: L3,
    shape: '(a+b)*c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的和乘${p.c}，再加上${p.d}，得多少？`,
    draw: dSumTimesPlus,
  },
  {
    id: 'l3-diff-times-less',
    label: '差乘c再减d',
    levels: L3,
    shape: '(a-b)*c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的差乘${p.c}，再减去${p.d}，得多少？`,
    draw: dDiffTimesLess,
  },
  {
    id: 'l3-repeat-sum-diff',
    label: 'a个b相加的和与最大的两位数相差',
    levels: L3,
    shape: 'b*a-f',
    params: ['a', 'b', 'f'],
    fixed: 'maxTwoDigit',
    diff: true,
    stem: (p) => `${p.a}个${p.b}相加的和与${LIE_FIXED.maxTwoDigit.text}相差多少？`,
    draw: dRepeatSumDiff,
  },
  {
    id: 'l3-add-sub-add',
    label: 'a加b减c再加d',
    levels: L3,
    shape: 'a+b-c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}加${p.b}再减去${p.c}，最后加${p.d}，得多少？`,
    draw: dAddSubAdd,
  },
  {
    id: 'l3-sub-add-sub',
    label: 'a减b加c再减d',
    levels: L3,
    shape: 'a-b+c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}减${p.b}再加${p.c}，最后减${p.d}，得多少？`,
    draw: dSubAddSub,
  },
  {
    id: 'l3-product-product-add',
    label: '两个积相加',
    levels: L3,
    shape: 'a*b+c*d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的积加${p.c}与${p.d}的积，和是多少？`,
    draw: dProductProductAdd,
  },
  {
    id: 'l3-sum-product-sub',
    label: 'a加积再减d',
    levels: L3,
    shape: 'a+b*c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}加上${p.b}与${p.c}的积，再减去${p.d}，得多少？`,
    draw: dSumProductSub,
  },
  {
    id: 'l3-repeat-sum-times',
    label: 'a个b相加的和再乘c',
    levels: L3,
    shape: 'b*a*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}个${p.b}相加的和再乘${p.c}，积是多少？`,
    draw: dRepeatSumTimes,
  },
  {
    id: 'l3-product-times',
    label: 'a与b的积再乘c',
    levels: L3,
    shape: 'a*b*c',
    params: ['a', 'b', 'c'],
    stem: (p) => `${p.a}与${p.b}的积再乘${p.c}，积是多少？`,
    draw: dProductTimes,
  },
  {
    id: 'l3-product-div-plus',
    label: '积除以c再加d',
    levels: L3,
    shape: 'a*b/c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的积除以${p.c}，再加${p.d}，得多少？`,
    draw: dProductDivPlus,
  },
  {
    id: 'l3-product-div-less',
    label: '积除以c再减d',
    levels: L3,
    shape: 'a*b/c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的积除以${p.c}，再减去${p.d}，得多少？`,
    draw: dProductDivLess,
  },
  {
    id: 'l3-sum-div-plus',
    label: '和除以c再加d',
    levels: L3,
    shape: '(a+b)/c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的和除以${p.c}，再加${p.d}，得多少？`,
    draw: dSumDivPlus,
  },
  {
    id: 'l3-sum-div-less',
    label: '和除以c再减d',
    levels: L3,
    shape: '(a+b)/c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的和除以${p.c}，再减去${p.d}，得多少？`,
    draw: dSumDivLess,
  },
  {
    id: 'l3-diff-div-plus',
    label: '差除以c再加d',
    levels: L3,
    shape: '(a-b)/c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的差除以${p.c}，再加${p.d}，得多少？`,
    draw: dDiffDivPlus,
  },
  {
    id: 'l3-diff-div-less',
    label: '差除以c再减d',
    levels: L3,
    shape: '(a-b)/c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的差除以${p.c}，再减去${p.d}，得多少？`,
    draw: dDiffDivLess,
  },
  {
    id: 'l3-quotient-diff',
    label: '商与c相差',
    levels: L3,
    shape: 'a/b-c',
    params: ['a', 'b', 'c'],
    diff: true,
    stem: (p) => `${p.a}除以${p.b}的商与${p.c}相差多少？`,
    draw: dQuotientDiff,
  },
  {
    id: 'l3-quotient-less',
    label: '比商少c',
    levels: L3,
    shape: 'a/b-c',
    params: ['a', 'b', 'c'],
    stem: (p) => `比${p.a}除以${p.b}的商少${p.c}的数是多少？`,
    draw: dQuotientLess,
  },
  {
    id: 'l3-div-times-plus',
    label: '商乘c再加d',
    levels: L3,
    shape: 'a/b*c+d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}除以${p.b}的商乘${p.c}，再加${p.d}，得多少？`,
    draw: dDivTimesPlus,
  },
  {
    id: 'l3-div-times-less',
    label: '商乘c再减d',
    levels: L3,
    shape: 'a/b*c-d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}除以${p.b}的商乘${p.c}，再减去${p.d}，得多少？`,
    draw: dDivTimesLess,
  },
  {
    id: 'l3-bbei-diff',
    label: 'a的b倍与最大的两位数相差',
    levels: L3,
    shape: 'a*b-f',
    params: ['a', 'b', 'f'],
    units: U4,
    fixed: 'maxTwoDigit',
    diff: true,
    stem: (p) => `${p.a}的${p.b}倍与${LIE_FIXED.maxTwoDigit.text}相差多少？`,
    draw: dBbeiDiff,
  },
  {
    id: 'l3-sum-times-div',
    label: '和乘c再除以d',
    levels: L3,
    shape: '(a+b)*c/d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的和乘${p.c}，再除以${p.d}，商是多少？`,
    draw: dSumTimesDiv,
  },
  {
    id: 'l3-diff-times-div',
    label: '差乘c再除以d',
    levels: L3,
    shape: '(a-b)*c/d',
    params: ['a', 'b', 'c', 'd'],
    stem: (p) => `${p.a}与${p.b}的差乘${p.c}，再除以${p.d}，商是多少？`,
    draw: dDiffTimesDiv,
  },
]

// ---------- 骨架包迁移：U1 / U2 / U4 列式骨架 → 生成/复核可用的句式 ----------

const SKELETON_LIE = [...U1_LIE_SKELETONS, ...U2_LIE_SKELETONS, ...U4_LIE_SKELETONS]

const SKELETON_TEMPLATES: LieTemplate[] = SKELETON_LIE.map((skeleton) => ({
  id: skeleton.id,
  label: skeleton.label,
  levels: [skeleton.level],
  shape: skeleton.shape,
  params: Object.keys(skeleton.slots),
  units: [skeleton.unitId],
  stem: (params) => renderLieSkeleton(skeleton, params),
  draw: (rng) => skeleton.draw(rng),
  maxPerPaper: 1,
  reverseStem: skeleton.reverse,
}))

const TEMPLATE_BY_ID = new Map<string, LieTemplate>(
  [...LIE_TEMPLATES, ...SKELETON_TEMPLATES].map((template) => [template.id, template]),
)

// ---------- 单元归属（方案 A：只从所选单元出题） ----------

const shapeOps = (shape: string): Set<LieOp> => {
  const ops = new Set<LieOp>()
  for (const ch of shape) {
    if (ch === '+') ops.add('+')
    else if (ch === '-') ops.add('-')
    else if (ch === '*') ops.add('×')
    else if (ch === '/') ops.add('÷')
  }
  return ops
}

/**
 * 由结构映射单元：
 * - 含除法 → U4 / U9；
 * - 含乘法且同时含加减（两步四则） → U1 / U9；
 * - 纯乘法 → U2 / U9；
 * - 纯加减 → U1 / U9。
 * “倍”的模板用 units 覆盖为 U4 / U9（倍在 U4-K3）。
 */
export function lieTemplateUnits(template: LieTemplate): string[] {
  if (template.units) return template.units
  const ops = shapeOps(template.shape)
  if (ops.has('÷')) return U4
  if (ops.has('×')) return ops.has('+') || ops.has('-') ? U1 : U2
  return U1
}

const UNIT_KP: Record<string, string> = {
  '3A-U1': '两步四则运算',
  '3A-U2': '用一位数乘',
  '3A-U4': '用一位数除',
  '3A-U6': '周长',
}

const UNIT_NAME: Record<string, string> = {
  '3A-U1': '两步四则运算与应用题',
  '3A-U2': '用一位数乘',
  '3A-U4': '用一位数除',
  '3A-U6': '周长',
}

export function lieTemplatesFor(level: Level, unitIds: string[]): LieTemplate[] {
  const selected = new Set(unitIds)
  const skeletonTemplates = SKELETON_TEMPLATES.filter(
    (template) =>
      template.levels.includes(level) &&
      (template.units ?? []).some((unitId) => selected.has(unitId)),
  )
  // 已迁骨架的单元优先走骨架路径，旧模板留作对照/兜底，不与新路径混排
  const migratedUnits = new Set(skeletonTemplates.flatMap((template) => template.units ?? []))
  const legacy = LIE_TEMPLATES.filter((template) => {
    if (!template.levels.includes(level)) return false
    const units = lieTemplateUnits(template)
    if (!units.some((unitId) => selected.has(unitId))) return false
    return !units.some((unitId) => migratedUnits.has(unitId))
  })
  return [...skeletonTemplates, ...legacy]
}

export function lieSupports(grade: Grade, unitIds: string[], level: Level): boolean {
  if (grade !== '3A') return false
  return lieTemplatesFor(level, unitIds).length > 0
}

export function lieLevelsFor(grade: Grade, unitIds: string[]): Level[] {
  if (grade !== '3A') return []
  return (['L1', 'L2', 'L3'] as Level[]).filter((level) => lieSupports(grade, unitIds, level))
}

export function lieUnitSupported(grade: Grade, unitId: string, level: Level): boolean {
  return lieSupports(grade, [unitId], level)
}

// ---------- 生成 ----------

export interface GenerateLieOptions {
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed?: number
  memory?: MemoryStore
  /** 同卷统一去重集合（与计算/填空/应用题共用） */
  sourceUsed?: Set<string>
}

export interface LieQuestion {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  kpName: string
  level: Level
  templateId: string
  patternLabel: string
  stem: string
  expression: string
  answer: string
  params: LieParams
  ast: LieAst
  key: string
  reused?: boolean
}

export interface LieResult {
  questions: LieQuestion[]
  notes: string[]
  crossReused: number
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

/** 跨卷去重键：句式 + 结构（结构含数值，等价于“同句式同数同结构”） */
export const lieKey = (templateId: string, ast: LieAst): string => `lieshi:${templateId}:${lieAstKey(ast)}`

export const LIE_PATTERN_LIMIT = 2

const templateLimit = (template: LieTemplate): number => template.maxPerPaper ?? LIE_PATTERN_LIMIT

interface Candidate {
  template: LieTemplate
  unitId: string
  params: LieParams
  ast: LieAst
  stem: string
  expression: string
  answer: string
  key: string
}

function makeCandidate(template: LieTemplate, params: LieParams, unitId: string): Candidate | null {
  let ast: LieAst
  try {
    ast = parseLieShape(template.shape, params)
  } catch {
    return null
  }
  const issue = lieSemanticIssue(ast)
  if (issue) return null
  if (template.fixed) {
    const fixed = LIE_FIXED[template.fixed]
    if (params.f !== fixed.value) return null
  }
  let value: number
  try {
    value = evalLieAst(ast)
  } catch {
    return null
  }
  if (template.diff && value <= 0) return null
  return {
    template,
    unitId,
    params,
    ast,
    stem: template.stem(params),
    expression: renderLieAst(ast),
    answer: String(value),
    key: lieKey(template.id, ast),
  }
}

export function generateLie(options: GenerateLieOptions): LieResult {
  const { grade, unitIds, level, count } = options
  const seed = options.seed ?? 20260101
  const memory = options.memory
  const questions: LieQuestion[] = []
  const notes: string[] = []
  if (!Number.isInteger(count) || count <= 0) return { questions, notes, crossReused: 0 }
  if (grade !== '3A') {
    return { questions, notes: ['列式计算：本版只覆盖三年级上册'], crossReused: 0 }
  }

  const templates = lieTemplatesFor(level, unitIds)
  if (templates.length === 0) {
    return {
      questions,
      notes: [
        `列式计算：所选单元在 ${level} 没有可用运算结构（加减→U1/U9，乘法→U2，除法→U4，倍→U4）`,
      ],
      crossReused: 0,
    }
  }

  const rng = createRng(seed + 2711)
  const seen = new Set<string>()
  const patternCount = new Map<string, number>()
  const stale: Candidate[] = []
  const staleKeys = new Set<string>()
  let crossReused = 0

  const accept = (candidate: Candidate, reused: boolean): void => {
    const template = candidate.template
    const unitId =
      lieTemplateUnits(template).find((unit) => unitIds.includes(unit)) ?? candidate.unitId
    questions.push({
      id: `lie-${questions.length + 1}-${template.id}`,
      grade,
      unitId,
      unitName: UNIT_NAME[unitId] ?? unitId,
      kpName: UNIT_KP[unitId] ?? '列式计算',
      level,
      templateId: template.id,
      patternLabel: template.label,
      stem: candidate.stem,
      expression: candidate.expression,
      answer: candidate.answer,
      params: candidate.params,
      ast: candidate.ast,
      key: candidate.key,
      ...(reused ? { reused: true } : {}),
    })
    patternCount.set(template.id, (patternCount.get(template.id) ?? 0) + 1)
    seen.add(candidate.key)
    options.sourceUsed?.add(candidate.key)
    memory?.record(candidate.key)
    if (reused) crossReused++
  }

  for (let round = 0; round < 8 && questions.length < count; round++) {
    const order = shuffle(rng, templates)
    for (const template of order) {
      if (questions.length >= count) break
      if ((patternCount.get(template.id) ?? 0) >= templateLimit(template)) continue
      const units = lieTemplateUnits(template)
      let picked: Candidate | null = null
      for (let attempt = 0; attempt < 40 && picked == null; attempt++) {
        const params = template.draw(rng)
        if (!params) continue
        const candidate = makeCandidate(template, params, units[0] ?? '')
        if (!candidate) continue
        if (seen.has(candidate.key)) continue
        const reused = memory?.recentlyUsed(candidate.key) ?? false
        if (reused) {
          if (!staleKeys.has(candidate.key)) {
            staleKeys.add(candidate.key)
            stale.push(candidate)
          }
          continue
        }
        picked = candidate
      }
      if (picked) accept(picked, false)
    }
  }

  for (const candidate of stale) {
    if (questions.length >= count) break
    if (seen.has(candidate.key)) continue
    if ((patternCount.get(candidate.template.id) ?? 0) >= templateLimit(candidate.template)) continue
    accept(candidate, true)
  }

  if (questions.length < count) {
    const capacity = templates.reduce((sum, template) => sum + templateLimit(template), 0)
    notes.push(
      `列式计算：本档可用句式 ${templates.length} 种，按句式上限合计最多 ${capacity} 题；实出 ${questions.length}/${count}（同句式不超限，不用重复句式凑数）`,
    )
  }
  if (crossReused > 0) {
    notes.push(`列式计算：题池不足，${crossReused} 道按 LRU 跨卷复用（同卷仍不重复）`)
  }
  return { questions, notes, crossReused }
}

// ---------- 复核（两条独立路径） ----------

export interface LieRecord {
  templateId: string
  level: Level
  params: LieParams
  ast: LieAst
  expression: string
  answer: string
  stem: string
}

/** 单题复核：结果重算 + 结构-语句一致性 */
export function verifyLieRecord(record: LieRecord): string[] {
  const issues: string[] = []
  const template = TEMPLATE_BY_ID.get(record.templateId)
  if (!template) return [`未知句式模板：${record.templateId}`]
  if (!template.levels.includes(record.level)) {
    issues.push(`句式 ${template.id} 不在 ${record.level} 档`)
  }
  if (template.fixed) {
    const fixed = LIE_FIXED[template.fixed]
    if (record.params.f !== fixed.value) {
      issues.push(`固定量 ${template.fixed} 应为 ${fixed.value}，实际 ${String(record.params.f)}`)
    }
  }

  // 路径 1：从 AST 独立重算结果
  let value: number
  try {
    value = evalLieAstIndependent(record.ast)
  } catch (error) {
    issues.push(`结果复核失败：${(error as Error).message}`)
    return issues
  }
  if (String(value) !== record.answer) {
    issues.push(`结果复核不符：独立算出 ${value}，答案 ${record.answer}`)
  }
  const semantic = lieSemanticIssue(record.ast)
  if (semantic) issues.push(`语义边界不通过：${semantic}`)
  if (template.diff && value <= 0) issues.push(`“相差”必须大减小且差为正，实际 ${value}`)

  // 路径 2：模板 ID + 参数反向解析出期望 AST，与实际 AST 比对
  // 骨架迁移后的句式先从题干反解槽位，骨架自带反解自检；
  // 反解失败/参数不一致都直接记为问题，不退回记录参数。
  let shapeParams = record.params
  if (template.reverseStem) {
    const reversed = template.reverseStem(record.stem)
    if (!reversed) {
      issues.push(`题干反解失败：句式 ${template.id} 无法从「${record.stem}」抽回槽位`)
      return issues
    }
    const mismatched = Object.keys(reversed).filter(
      (name) => record.params[name] !== reversed[name],
    )
    if (mismatched.length > 0) {
      issues.push(`题干反解参数与记录不一致：${mismatched.join('、')}`)
    }
    shapeParams = reversed
  }
  let expected: LieAst
  try {
    expected = parseLieShape(template.shape, shapeParams)
  } catch (error) {
    issues.push(`结构反解失败：${(error as Error).message}`)
    return issues
  }
  if (lieAstKey(expected) !== lieAstKey(record.ast)) {
    issues.push(
      `结构-语句不一致：句式 ${template.id} 期望 ${lieAstKey(expected)}，实际 ${lieAstKey(record.ast)}`,
    )
  }
  if (renderLieAst(record.ast) !== record.expression) {
    issues.push(`期望算式与 AST 不符：${record.expression} vs ${renderLieAst(record.ast)}`)
  }
  // 题干必须由该模板渲染，防止“句子换了模板但结构没换”
  const renderedStem = template.stem(record.params).replace(/\s+/g, '')
  if (renderedStem !== record.stem.replace(/\s+/g, '')) {
    issues.push(`题干与句式模板不符：${record.stem}`)
  }
  return issues
}

/** 运行时卷面复核入口（TypstItem.lie 字段） */
export function verifyLieItem(item: {
  text?: string
  answers?: string[]
  lie?: LieRecord
}): string[] {
  if (!item.lie) return ['缺少列式计算复核字段']
  return verifyLieRecord({
    templateId: item.lie.templateId,
    level: item.lie.level,
    params: item.lie.params,
    ast: item.lie.ast,
    expression: item.lie.expression,
    answer: item.answers?.[0] ?? item.lie.answer,
    stem: item.text ?? '',
  })
}

/** 卷级校验：逐题复核 + 同卷重复 + 同句式上限 */
export function validateLiePaper(questions: LieQuestion[]): string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  const perPattern = new Map<string, number>()
  for (const question of questions) {
    issues.push(...verifyLieRecord(question).map((issue) => `${question.id}：${issue}`))
    if (seen.has(question.key)) issues.push(`同卷重复：${question.key}`)
    seen.add(question.key)
    const count = (perPattern.get(question.templateId) ?? 0) + 1
    perPattern.set(question.templateId, count)
    const limit = templateLimit(TEMPLATE_BY_ID.get(question.templateId) ?? ({} as LieTemplate))
    if (count > limit) {
      issues.push(`同卷同句式超过 ${limit} 次：${question.templateId}`)
    }
  }
  return issues
}
