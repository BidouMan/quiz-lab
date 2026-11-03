/**
 * 骨架生成侧的算式求值（与 verify.ts 的独立复核实现刻意分开，互不复用）。
 * 算式只支持整数四则运算 + 少量年月日/几何函数，避免引入“生成时中间结果”泄漏。
 */

export type Params = Record<string, number>

const MONTH_31 = new Set([1, 3, 5, 7, 8, 10, 12])

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function monthDays(m: number): number {
  if (m === 2) return 28
  return MONTH_31.has(m) ? 31 : 30
}

export function febDays(y: number): number {
  return isLeap(y) ? 29 : 28
}

export function yearDays(y: number): number {
  return isLeap(y) ? 366 : 365
}

export function daysFromJan1(m: number, d: number): number {
  let total = d
  for (let i = 1; i < m; i++) total += monthDays(i)
  return total
}

export function daysBetween(m1: number, d1: number, m2: number, d2: number): number {
  if (m1 === m2) return d2 - d1 + 1
  let total = monthDays(m1) - d1 + 1
  for (let m = m1 + 1; m < m2; m++) total += monthDays(m)
  return total + d2
}

export function elapsedMinutes(h1: number, m1: number, h2: number, m2: number): number {
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

export function quarterDays(_q: number): number {
  return 0 // 占位，避免误用；季度天数由公式显式相加
}

export function leapCount(y1: number, y2: number): number {
  let n = 0
  for (let y = y1; y <= y2; y++) if (isLeap(y)) n++
  return n
}

export function weekdayCount(m: number): number {
  // 假设该月 1 日是星期一，求这个月有几个星期一
  return Math.floor((monthDays(m) - 1) / 7) + 1
}

export function next31(m: number): number {
  for (let step = 1; step <= 12; step++) {
    const cur = ((m - 1 + step) % 12) + 1
    if (MONTH_31.has(cur)) return cur
  }
  return 1
}

export function sqrtInt(n: number): number {
  return Math.round(Math.sqrt(n))
}

/** 分钟数换成“时” */
export function hourOf(minutes: number): number {
  return Math.floor(minutes / 60)
}

/** 分钟数换成“分”（余下不足 60 的部分） */
export function minuteOf(minutes: number): number {
  return minutes % 60
}

/** 天数换成整星期数 */
export function wholeWeeks(days: number): number {
  return Math.floor(days / 7)
}

/** 天数除以 7 的余数 */
export function restDays(days: number): number {
  return days % 7
}

type Token = { kind: 'num' | 'ident' | 'op'; text: string }

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let end = i
      while (end < source.length && source[end] >= '0' && source[end] <= '9') end++
      tokens.push({ kind: 'num', text: source.slice(i, end) })
      i = end
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i
      while (end < source.length && /[a-zA-Z0-9_]/.test(source[end])) end++
      tokens.push({ kind: 'ident', text: source.slice(i, end) })
      i = end
      continue
    }
    if ('+-*/()'.includes(ch) || ch === ',') {
      tokens.push({ kind: 'op', text: ch })
      i++
      continue
    }
    throw new Error(`算式含非法字符: ${ch}`)
  }
  return tokens
}

const FUNCS: Record<string, (...args: number[]) => number> = {
  monthDays,
  febDays,
  yearDays,
  daysFromJan1,
  daysBetween,
  elapsedMinutes,
  leapCount,
  weekdayCount,
  next31,
  sqrtInt,
  hourOf,
  minuteOf,
  wholeWeeks,
  restDays,
  quotientOf: (a, b) => Math.floor(a / b),
  remainderOf: (a, b) => a % b,
  isLeap: (y) => (isLeap(y) ? 1 : 0),
}

export function evalFormula(source: string, params: Params): number {
  const tokens = tokenize(source)
  let pos = 0
  const peek = () => tokens[pos]
  const eat = (text?: string): Token => {
    const token = tokens[pos]
    if (!token) throw new Error(`算式意外结束: ${source}`)
    if (text != null && token.text !== text) throw new Error(`期望 ${text}，实际 ${token.text}`)
    pos++
    return token
  }

  const primary = (): number => {
    const token = peek()
    if (!token) throw new Error(`算式意外结束: ${source}`)
    if (token.kind === 'num') {
      pos++
      return Number(token.text)
    }
    if (token.kind === 'ident') {
      pos++
      if (peek()?.text === '(') {
        eat('(')
        const args: number[] = []
        if (peek()?.text !== ')') {
          args.push(expression())
          while (peek()?.text === ',') {
            eat(',')
            args.push(expression())
          }
        }
        eat(')')
        const fn = FUNCS[token.text]
        if (!fn) throw new Error(`未知函数: ${token.text}`)
        return fn(...args)
      }
      const value = params[token.text]
      if (value == null) throw new Error(`缺少参数: ${token.text}`)
      return value
    }
    if (token.text === '(') {
      eat('(')
      const value = expression()
      eat(')')
      return value
    }
    throw new Error(`无法解析: ${token.text}`)
  }

  const factor = (): number => {
    if (peek()?.text === '-') {
      eat('-')
      return -factor()
    }
    return primary()
  }

  const term = (): number => {
    let value = factor()
    while (peek()?.text === '*' || peek()?.text === '/') {
      const op = eat().text
      const right = factor()
      value = op === '*' ? value * right : value / right
    }
    return value
  }

  function expression(): number {
    let value = term()
    while (peek()?.text === '+' || peek()?.text === '-') {
      const op = eat().text
      const right = term()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  const result = expression()
  if (pos < tokens.length) throw new Error(`算式有多余内容: ${source}`)
  return result
}

/** 判断式：只支持 一层比较运算，两侧为整数算式 */
export function evalComparison(source: string, params: Params): {
  left: number
  right: number
  op: '<' | '<=' | '>' | '>='
  ok: boolean
} {
  const match = /\s*(<=|>=|<|>)\s*/.exec(source)
  if (!match) throw new Error(`不是判断式: ${source}`)
  const op = match[1] as '<' | '<=' | '>' | '>='
  const left = evalFormula(source.slice(0, match.index), params)
  const right = evalFormula(source.slice(match.index + match[0].length), params)
  const ok = op === '<' ? left < right : op === '<=' ? left <= right : op === '>' ? left > right : left >= right
  return { left, right, op, ok }
}

/** 顶层除法（不含括号）拆成被除数/除数，用于带余数、取整口径 */
export function splitTopDivision(source: string): { num: string; den: string } | null {
  let depth = 0
  let index = -1
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '/' && depth === 0) {
      if (index !== -1) return null
      index = i
    }
  }
  if (index === -1) return null
  return { num: source.slice(0, index), den: source.slice(index + 1) }
}

/** 把算式渲染成三年级看得懂的写法：a*2+b 形式 → “36 × 2 + 20 × 2” */
export function renderFormula(source: string, params: Params): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i
      while (end < source.length && /[a-zA-Z0-9_]/.test(source[end])) end++
      const name = source.slice(i, end)
      if (source[end] === '(') {
        out += name
      } else {
        const value = params[name]
        out += value == null ? name : String(value)
      }
      i = end
      continue
    }
    if (ch === '*') out += ' × '
    else if (ch === '/') out += ' ÷ '
    else if (ch === '+') out += ' + '
    else if (ch === '-') out += ' - '
    else out += ch
    i++
  }
  return out.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
}
