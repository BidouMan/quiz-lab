/**
 * 独立复核：不复用 assemble.ts 的任何中间结果，也不复用 expr.ts 的求值器。
 * 这里自带一套「调度场算法」求值器 + 独立的答案重算路径，逐题从参数重新算。
 */
import type { Combo, PilotPaper, PilotQuestion, Scene, Skeleton } from './types.ts'
import { PRACTICE_LABELS } from './types.ts'
import { resolveSkeleton } from './bands.ts'

export interface VerifyIssue {
  code: string
  questionId: string
  message: string
}

const MONTH_31 = new Set([1, 3, 5, 7, 8, 10, 12])

const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const monthDays = (m: number): number => (m === 2 ? 28 : MONTH_31.has(m) ? 31 : 30)
const febDays = (y: number): number => (leap(y) ? 29 : 28)
const yearDays = (y: number): number => (leap(y) ? 366 : 365)

function daysFromJan1(m: number, d: number): number {
  let total = d
  for (let month = 1; month < m; month++) total += monthDays(month)
  return total
}

function daysBetween(m1: number, d1: number, m2: number, d2: number): number {
  if (m1 === m2) return d2 - d1 + 1
  let total = monthDays(m1) - d1 + 1
  for (let month = m1 + 1; month < m2; month++) total += monthDays(month)
  return total + d2
}

function elapsedMinutes(h1: number, m1: number, h2: number, m2: number): number {
  return (h2 - h1) * 60 + (m2 - m1)
}

function leapCount(y1: number, y2: number): number {
  let count = 0
  for (let y = y1; y <= y2; y++) if (leap(y)) count++
  return count
}

function weekdayCount(m: number): number {
  return Math.floor((monthDays(m) - 1) / 7) + 1
}

function next31(m: number): number {
  let month = m
  for (let i = 0; i < 12; i++) {
    month = month === 12 ? 1 : month + 1
    if (MONTH_31.has(month)) return month
  }
  return 1
}

const sqrtInt = (n: number): number => Math.round(Math.sqrt(n))
const hourOf = (minutes: number): number => Math.floor(minutes / 60)
const minuteOf = (minutes: number): number => minutes % 60
const wholeWeeks = (days: number): number => Math.floor(days / 7)
const restDays = (days: number): number => days % 7

type Token = { type: 'num' | 'name' | 'op' | '(' | ')' | ','; value: string }

function scan(source: string): Token[] {
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
      tokens.push({ type: 'num', value: source.slice(i, end) })
      i = end
      continue
    }
    if (/[a-z_]/i.test(ch)) {
      let end = i
      while (end < source.length && /[a-z0-9_]/i.test(source[end])) end++
      tokens.push({ type: 'name', value: source.slice(i, end) })
      i = end
      continue
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ type: ch, value: ch })
      i++
      continue
    }
    throw new Error(`独立复核：非法字符 ${ch}`)
  }
  return tokens
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

const FN: Record<string, { arity: number; run: (...args: number[]) => number }> = {
  monthDays: { arity: 1, run: monthDays },
  febDays: { arity: 1, run: febDays },
  yearDays: { arity: 1, run: yearDays },
  daysFromJan1: { arity: 2, run: daysFromJan1 },
  daysBetween: { arity: 4, run: daysBetween },
  elapsedMinutes: { arity: 4, run: elapsedMinutes },
  leapCount: { arity: 2, run: leapCount },
  weekdayCount: { arity: 1, run: weekdayCount },
  next31: { arity: 1, run: next31 },
  sqrtInt: { arity: 1, run: sqrtInt },
  hourOf: { arity: 1, run: hourOf },
  minuteOf: { arity: 1, run: minuteOf },
  wholeWeeks: { arity: 1, run: wholeWeeks },
  restDays: { arity: 1, run: restDays },
  quotientOf: { arity: 2, run: (a, b) => Math.floor(a / b) },
  remainderOf: { arity: 2, run: (a, b) => a % b },
  leapFlag: { arity: 1, run: (y) => (leap(y) ? 1 : 0) },
}

/** 两遍求值：先把函数调用就地展开成数字，再用调度场算法算四则（与生成侧递归下降是两套实现） */
function evalIndependent(source: string, params: Record<string, number>): number {
  let expr = source
  const callPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)\)/g
  let guard = 0
  while (callPattern.test(expr)) {
    expr = expr.replace(callPattern, (_, name: string, argText: string) => {
      const fn = FN[name]
      if (!fn) throw new Error(`独立复核：未知函数 ${name}`)
      const parts = argText.split(',').map((part) => evalIndependent(part, params))
      if (parts.length !== fn.arity) throw new Error(`独立复核：${name} 需要 ${fn.arity} 个参数`)
      return String(fn.run(...parts))
    })
    if (++guard > 20) throw new Error('独立复核：函数嵌套过深')
  }
  return evalArithmetic(expr, params)
}

/** 展开函数后只剩数字、参数与四则运算：用简化版调度场求值 */
function evalArithmetic(source: string, params: Record<string, number>): number {
  const tokens = scan(source)
  const values: number[] = []
  const ops: string[] = []
  const reduce = () => {
    const op = ops.pop()!
    const right = values.pop()!
    const left = values.pop()!
    values.push(op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : left / right)
  }
  let expectOperand = true
  for (const token of tokens) {
    if (token.type === 'num') {
      values.push(Number(token.value))
      expectOperand = false
    } else if (token.type === 'name') {
      values.push(params[token.value])
      expectOperand = false
    } else if (token.type === '(') {
      ops.push('(')
    } else if (token.type === ')') {
      while (ops[ops.length - 1] !== '(') reduce()
      ops.pop()
    } else {
      const op = token.value
      while (ops.length && ops[ops.length - 1] !== '(' && PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[op] && !expectOperand) {
        reduce()
      }
      ops.push(op)
      expectOperand = true
    }
  }
  while (ops.length) reduce()
  if (values.length !== 1) throw new Error(`独立复核：算式无法归约 ${source}`)
  return values[0]
}

function splitDivision(source: string): { num: string; den: string } {
  let depth = 0
  let cut = -1
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') depth++
    else if (source[i] === ')') depth--
    else if (source[i] === '/' && depth === 0) {
      if (cut !== -1) throw new Error('独立复核：只支持一层除法')
      cut = i
    }
  }
  if (cut === -1) throw new Error('独立复核：缺少除法')
  return { num: source.slice(0, cut), den: source.slice(cut + 1) }
}

function resolveUnit(unit: string, scene: Scene): string {
  return unit.split('{cls}').join(scene.cls)
}

function numbersIn(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number)
}

function expectedAnswer(skeleton: Skeleton, index: number, params: Record<string, number>, scene: Scene): { text: string; numbers: number[] } {
  const formula = skeleton.formulas[index]
  if (skeleton.judge) {
    const match = /\s*(<=|>=|<|>)\s*/.exec(formula)
    if (!match) throw new Error('独立复核：判断式缺少比较符')
    const left = evalIndependent(formula.slice(0, match.index), params)
    const right = evalIndependent(formula.slice(match.index + match[0].length), params)
    const op = match[1]
    const ok = op === '<' ? left < right : op === '<=' ? left <= right : op === '>' ? left > right : left >= right
    return { text: ok ? skeleton.judge[0] : skeleton.judge[1], numbers: [] }
  }
  const unit = resolveUnit(skeleton.answerUnits?.[index] ?? skeleton.unit, scene)
  const mode = skeleton.askModes?.[index] ?? 'exact'
  if (mode === 'exact') {
    const value = evalIndependent(formula, params)
    return { text: `${value}${unit ? ` ${unit}` : ''}`, numbers: [value] }
  }
  const split = splitDivision(formula)
  const numerator = evalIndependent(split.num, params)
  const denominator = evalIndependent(split.den, params)
  const quotient = Math.floor(numerator / denominator)
  const remainder = numerator - quotient * denominator
  const remainderUnit = resolveUnit(skeleton.remainderUnit ?? '{cls}', scene)
  if (mode === 'ceil') {
    const value = remainder > 0 ? quotient + 1 : quotient
    return { text: `${value}${unit ? ` ${unit}` : ''}`, numbers: [value] }
  }
  return {
    text: `${quotient}${unit ? ` ${unit}` : ''}，还剩 ${remainder}${remainderUnit ? ` ${remainderUnit}` : ''}`,
    numbers: [quotient, remainder],
  }
}

function stemLength(stem: string): number {
  return stem.replace(/\s+/g, '').replace(/_{2,}/g, '□').length
}

export function verifyQuestion(question: PilotQuestion, combo: Combo): VerifyIssue[] {
  const issues: VerifyIssue[] = []
  const push = (code: string, message: string) => issues.push({ code, questionId: question.id, message })
  const skeleton = combo.skeletons.find((item) => item.id === question.skeletonId)
  const scene = combo.scenes.find((item) => item.id === question.sceneId)
  if (!skeleton || !scene) {
    push('missing-source', `找不到骨架或场景：${question.skeletonId}/${question.sceneId}`)
    return issues
  }
  // 包模型：复核同样按当前难度档取数值域与步骤
  const active = resolveSkeleton(skeleton, combo.level)
  if (stemLength(question.stem) > 45) {
    push('stem-too-long', `题干 ${stemLength(question.stem)} 字，超过 45 字：${question.stem}`)
  }
  if (/[{}]/.test(question.stem) || /undefined|NaN/.test(question.stem)) {
    push('stem-broken', `题干有未替换占位符：${question.stem}`)
  }
  if (question.stem.trim().length === 0) push('stem-empty', '题干为空')

  if (combo.type === 'tiankong') {
    const blanks = (question.stem.match(/_+/g) ?? []).length
    if (blanks !== active.formulas.length) {
      push('blank-count', `${blanks} 个空位，但算式有 ${active.formulas.length} 个`)
    }
  } else {
    // 允许“一个问句、多个答案”（如“最迟几时几分出发？”），但不允许问句多于算式
    if (question.asks.length > active.formulas.length) {
      push('ask-count', `${question.asks.length} 个问句，但算式只有 ${active.formulas.length} 个`)
    }
    if (question.answers.length !== active.formulas.length) {
      push('answer-count', `答案 ${question.answers.length} 条，算式 ${active.formulas.length} 条`)
    }
    if (!active.judge) {
      active.formulas.forEach((_, index) => {
        const unit = resolveUnit(active.answerUnits?.[index] ?? active.unit, scene)
        if (unit && !question.asks.some((ask) => ask.includes(unit))) {
          push('unit-mismatch', `第 ${index + 1} 问没有出现单位 ${unit}：${question.asks.join('/')}`)
        }
      })
    }
  }

  for (let index = 0; index < active.formulas.length; index++) {
    let expected: { text: string; numbers: number[] }
    try {
      expected = expectedAnswer(active, index, question.params, scene)
    } catch (error) {
      push('recompute-failed', `第 ${index + 1} 问重算失败：${(error as Error).message}`)
      continue
    }
    const actual = question.answers[index]
    if (actual == null) {
      push('answer-missing', `缺少第 ${index + 1} 问答案`)
      continue
    }
    const actualNumbers = numbersIn(actual)
    if (actualNumbers.length !== expected.numbers.length) {
      push('answer-numbers', `第 ${index + 1} 问数字个数不符：${actual} vs ${expected.text}`)
      continue
    }
    for (let i = 0; i < expected.numbers.length; i++) {
      if (actualNumbers[i] !== expected.numbers[i]) {
        push('answer-value', `第 ${index + 1} 问答案错：${actual} 应为 ${expected.text}`)
        break
      }
    }
    if (active.judge) {
      if (actual !== expected.text) push('judge-text', `判断结论错：${actual} 应为 ${expected.text}`)
    } else {
      // 逐问校验：非判断题答案必须带正确单位，避免“问厘米答米”“问分钟答时”
      const expectedUnit = resolveUnit(active.answerUnits?.[index] ?? active.unit, scene)
      if (expectedUnit && !actual.includes(expectedUnit)) {
        push('answer-unit', `答案缺少单位 ${expectedUnit}：${actual}`)
      }
    }
  }

  for (const [name, value] of Object.entries(question.params)) {
    if (!Number.isInteger(value)) push('param-int', `参数 ${name}=${value} 不是整数`)
    if (value < 0) push('param-negative', `参数 ${name}=${value} 为负`)
    if (value > 100000) push('param-range', `参数 ${name}=${value} 超出三年级范围`)
  }

  return issues
}

export function verifyPaper(paper: PilotPaper, combo: Combo): VerifyIssue[] {
  const issues: VerifyIssue[] = []
  const usedSkeletons = new Set<string>()
  const usedScenes = new Set<string>()
  const usedValues = new Set<string>()
  const usedTexts = new Set<string>()

  for (const question of paper.questions) {
    issues.push(...verifyQuestion(question, combo))
    if (usedSkeletons.has(question.skeletonId)) {
      issues.push({ code: 'dup-skeleton', questionId: question.id, message: `同一份卷子句式重复：${question.skeletonId}` })
    }
    usedSkeletons.add(question.skeletonId)
    if (usedScenes.has(question.sceneKey)) {
      issues.push({ code: 'dup-scene', questionId: question.id, message: `同一份卷子场景重复：${question.sceneKey}` })
    }
    usedScenes.add(question.sceneKey)
    const valuesKey = question.values.join(',')
    if (usedValues.has(valuesKey)) {
      issues.push({ code: 'dup-values', questionId: question.id, message: `同一份卷子数值重复：${valuesKey}` })
    }
    usedValues.add(valuesKey)
    const textKey = question.stem.replace(/\d+/g, '#')
    if (usedTexts.has(textKey)) {
      issues.push({ code: 'dup-text', questionId: question.id, message: `同一份卷子题干重复：${question.stem}` })
    }
    usedTexts.add(textKey)
  }

  const missing = combo.skeletons.filter((skeleton) => !usedSkeletons.has(skeleton.id)).map((skeleton) => skeleton.id)
  if (combo.type !== 'tiankong' && paper.questions.length >= combo.skeletons.length && missing.length > 0) {
    issues.push({ code: 'skeleton-uncovered', questionId: '-', message: `有骨架未覆盖：${missing.join(', ')}` })
  }
  return issues
}

/** 统计：句式/场景/数值/做法 的去重数 */
export function stats(paper: PilotPaper, _combo: Combo): {
  count: number
  skeletons: number
  scenes: number
  values: number
  practices: number
  practiceBreakdown: Record<string, number>
} {
  const practiceBreakdown: Record<string, number> = {}
  for (const question of paper.questions) {
    const label = PRACTICE_LABELS[question.practice]
    practiceBreakdown[label] = (practiceBreakdown[label] ?? 0) + 1
  }
  return {
    count: paper.questions.length,
    skeletons: new Set(paper.questions.map((q) => q.skeletonId)).size,
    scenes: new Set(paper.questions.map((q) => q.sceneKey)).size,
    values: new Set(paper.questions.map((q) => q.values.join(','))).size,
    practices: new Set(paper.questions.map((q) => q.practice)).size,
    practiceBreakdown,
  }
}
