import type {
  CalcType,
  CarryMode,
  Constraints,
  FormName,
  GenerateOptions,
  Level,
  QuotientZeroMode,
  RemainderMode,
} from './types.ts'
import type { ExprNode } from './expr.ts'
import { bin, evalNode, num, stepLines, toLatex } from './expr.ts'
import { createRng, pick, randInt, type Rng } from './rng.ts'
import { buildDateKousuan } from './dateKousuan.ts'

export interface BuildContext {
  rng: Rng
  level: Level
  type: CalcType
  constraints: Constraints
  attempt: number
}

export interface BuiltQuestion {
  latex: string
  answer: string
  answerLines?: string[]
  operands?: [number, number]
  op?: 'mul' | 'div'
  values: number[]
  features: Record<string, number | string | boolean>
  node?: ExprNode
}

type Builder = (ctx: BuildContext) => BuiltQuestion | null

const pow10 = (n: number): number => 10 ** n

const digitsOf = (n: number): number => String(Math.abs(n)).length

const factorRange = (mulDigits: number | undefined): [number, number] => {
  if (mulDigits === 2) return [10, 99]
  if (mulDigits === 1) return [2, 9]
  return [2, 99]
}

function carryInfo(multiplicand: number, multiplier: number): {
  carries: number
  maxConsecutive: number
  finalCarry: number
} {
  let carry = 0
  let carries = 0
  let current = 0
  let maxConsecutive = 0
  for (const ch of String(multiplicand).split('').reverse()) {
    const total = Number(ch) * multiplier + carry
    carry = Math.floor(total / 10)
    if (carry > 0) {
      carries += 1
      current += 1
      maxConsecutive = Math.max(maxConsecutive, current)
    } else {
      current = 0
    }
  }
  return { carries, maxConsecutive, finalCarry: carry }
}

function carryMatches(mode: CarryMode | undefined, info: ReturnType<typeof carryInfo>): boolean {
  switch (mode) {
    case 'none':
      return info.carries === 0
    case 'once':
      return info.carries === 1
    case 'normal':
      return info.carries >= 1 && info.maxConsecutive === 1
    case 'continuous':
      return info.maxConsecutive >= 2
    default:
      return true
  }
}

function makeNoCarryMultiplicand(
  rng: Rng,
  digits: number,
  multiplier: number,
  zeroEnd: boolean,
): number | null {
  const maxDigit = Math.floor(9 / multiplier)
  if (maxDigit < 1) return null
  if (zeroEnd) return randInt(rng, 1, maxDigit) * pow10(digits - 1)
  let value = 0
  for (let pos = digits - 1; pos >= 0; pos--) {
    const low = pos === digits - 1 ? 1 : 0
    const digit = randInt(rng, low, maxDigit)
    value = value * 10 + digit
  }
  return value
}

function makeContinuousMultiplicand(rng: Rng, digits: number, multiplier: number): number | null {
  const reversed: number[] = []
  let carry = 0
  for (let pos = 0; pos < digits; pos++) {
    const minDigit = Math.max(0, Math.ceil((10 - carry) / multiplier))
    if (minDigit > 9) return null
    const digit = randInt(rng, minDigit, 9)
    carry = Math.floor((digit * multiplier + carry) / 10)
    if (carry === 0) return null
    reversed.push(digit)
  }
  if (reversed[reversed.length - 1] === 0) reversed[reversed.length - 1] = 1
  return Number(reversed.reverse().join(''))
}

function finishNode(ctx: BuildContext, node: ExprNode, values: number[], features: Record<string, number | string | boolean>, extra: Partial<BuiltQuestion> = {}): BuiltQuestion {
  const answer = evalNode(node)
  const wantsSteps = ctx.type === 'tuoshi' || ctx.type === 'jianbian'
  return {
    latex: `${toLatex(node)}${ctx.type === 'kousuan' || ctx.type === 'chushi' ? ' =' : ''}`,
    answer: String(answer),
    ...(wantsSteps ? { answerLines: stepLines(node) } : {}),
    values: [...values, answer],
    features: {
      result: answer,
      steps: countOps(node),
      ...features,
    },
    node,
    ...extra,
  }
}

function countOps(node: ExprNode): number {
  if (node.kind === 'num') return 0
  return 1 + countOps(node.left) + countOps(node.right)
}

function buildMul1(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const digits = c.multiplicandDigits ?? c.digits ?? 2
  const multiplierMin = c.multiplierMin ?? (digits === 1 ? 2 : 2)
  const multiplierMax = c.multiplierMax ?? 9
  if (multiplierMin > multiplierMax) return null

  for (let attempt = 0; attempt < 600; attempt++) {
    const multiplier = randInt(rng, multiplierMin, multiplierMax)
    let multiplicand: number | null = null

    if (c.zeroEnd) {
      if (c.carry === 'none') {
        multiplicand = makeNoCarryMultiplicand(rng, digits, multiplier, true)
      } else {
        multiplicand = randInt(rng, 1, 9) * pow10(digits - 1)
      }
    } else if (c.zeroMiddle && digits >= 3) {
      const head = randInt(rng, 1, 9)
      const tail = randInt(rng, 1, 9)
      multiplicand = head * pow10(digits - 1) + tail
    } else if (c.carry === 'none') {
      multiplicand = makeNoCarryMultiplicand(rng, digits, multiplier, false)
    } else if (c.carry === 'continuous') {
      multiplicand = makeContinuousMultiplicand(rng, digits, multiplier)
    } else {
      multiplicand = randInt(rng, digits === 1 ? 1 : pow10(digits - 1), pow10(digits) - 1)
    }

    if (multiplicand == null) continue
    if (digitsOf(multiplicand) !== digits) continue
    const product = multiplicand * multiplier
    if (c.minResult != null && product < c.minResult) continue
    if (c.maxResult != null && product > c.maxResult) continue

    const info = carryInfo(multiplicand, multiplier)
    if (!carryMatches(c.carry, info)) continue
    if (c.zeroMiddle && String(multiplicand).at(-2) !== '0') continue
    if (c.zeroEnd && multiplicand % 10 !== 0) continue

    const values = [multiplicand, multiplier, product]
    return {
      latex: `${multiplicand} \\times ${multiplier} =`,
      answer: String(product),
      operands: [multiplicand, multiplier],
      op: 'mul',
      values,
      features: {
        ...info,
        digits,
        zeroEnd: multiplicand % 10 === 0,
        zeroMiddle: String(multiplicand).includes('0'),
        multiplier,
      },
    }
  }
  return null
}

interface DivCoreOptions {
  dividendDigits: number
  quotientDigits: number
  divisorMin: number
  divisorMax: number
  divisorStep?: number
  quotientZero: QuotientZeroMode
  remainder: RemainderMode
  maxResult?: number
  minResult?: number
}

function divCore(rng: Rng, options: DivCoreOptions): {
  dividend: number
  divisor: number
  quotient: number
  rem: number
  quotientZeroHit: boolean
} | null {
  const qMin = pow10(options.quotientDigits - 1)
  const qMax = pow10(options.quotientDigits) - 1
  for (let attempt = 0; attempt < 900; attempt++) {
    let divisor: number
    if (options.divisorStep) {
      const low = Math.ceil(options.divisorMin / options.divisorStep)
      const high = Math.floor(options.divisorMax / options.divisorStep)
      if (low > high) return null
      divisor = randInt(rng, low, high) * options.divisorStep
    } else {
      divisor = randInt(rng, options.divisorMin, options.divisorMax)
    }

    let quotient: number
    if (options.quotientZero === 'middle') {
      if (options.quotientDigits < 3) continue
      const head = randInt(rng, 1, Math.floor(qMax / pow10(options.quotientDigits - 1)))
      const tail = randInt(rng, 1, 9)
      quotient = head * pow10(options.quotientDigits - 1) + tail
      if (quotient < qMin || quotient > qMax) continue
    } else if (options.quotientZero === 'end') {
      quotient = Math.floor(randInt(rng, qMin, qMax) / 10) * 10
      if (quotient < qMin || quotient > qMax) continue
    } else {
      quotient = randInt(rng, qMin, qMax)
    }

    const rem = options.remainder === 'nonzero' ? randInt(rng, 1, divisor - 1) : 0
    const dividend = quotient * divisor + rem
    if (digitsOf(dividend) !== options.dividendDigits) continue
    if (options.maxResult != null && dividend > options.maxResult) continue
    if (options.minResult != null && dividend < options.minResult) continue

    return {
      dividend,
      divisor,
      quotient,
      rem,
      quotientZeroHit:
        (options.quotientZero === 'middle' && String(quotient).length >= 3 && String(quotient).at(-2) === '0') ||
        (options.quotientZero === 'end' && quotient % 10 === 0),
    }
  }
  return null
}

function buildDiv1(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const dividendDigits = c.dividendDigits ?? 2
  const quotientDigits = c.quotientDigits ?? Math.max(1, dividendDigits - 1)
  const result = divCore(rng, {
    dividendDigits,
    quotientDigits,
    divisorMin: c.divisorMin ?? 2,
    divisorMax: c.divisorMax ?? 9,
    quotientZero: c.quotientZero ?? 'none',
    remainder: c.remainder ?? (c.exact === false ? 'nonzero' : 'zero'),
    maxResult: c.maxResult,
    minResult: c.minResult,
  })
  if (!result) return null
  const { dividend, divisor, quotient, rem, quotientZeroHit } = result
  if (c.remainder === 'zero' && rem !== 0) return null
  if (c.remainder === 'nonzero' && rem === 0) return null
  if (c.quotientZero === 'none' && quotientZeroHit) return null

  return {
    latex: `${dividend} \\div ${divisor} =`,
    answer: rem === 0 ? String(quotient) : `${quotient}……${rem}`,
    operands: [dividend, divisor],
    op: 'div',
    values: [dividend, divisor, quotient, rem],
    features: {
      divisor,
      quotient,
      remainder: rem,
      dividendDigits,
      quotientDigits: digitsOf(quotient),
      quotientZero: quotientZeroHit,
      exact: rem === 0,
    },
  }
}

function buildMul2(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const aDigits = c.aDigits ?? c.digits ?? 2
  const bDigits = c.bDigits ?? 2

  for (let attempt = 0; attempt < 1200; attempt++) {
    const a = c.aZeroEnd
      ? randInt(rng, 1, 9) * pow10(aDigits - 1)
      : randInt(rng, pow10(aDigits - 1), pow10(aDigits) - 1)
    const b = c.bZeroEnd
      ? randInt(rng, 1, 9) * pow10(bDigits - 1)
      : randInt(rng, pow10(bDigits - 1), pow10(bDigits) - 1)
    if (digitsOf(a) !== aDigits || digitsOf(b) !== bDigits) continue
    if (c.zeroEnd && a % 10 !== 0) continue
    const product = a * b
    if (c.minResult != null && product < c.minResult) continue
    if (c.maxResult != null && product > c.maxResult) continue

    const bOnes = b % 10
    const bTens = Math.floor(b / 10) % 10
    const p1 = carryInfo(a, bOnes)
    const p2 = carryInfo(a, bTens)
    const totalCarries = p1.carries + p2.carries
    const additionCarry = hasAddCarry(a * bOnes, a * bTens * 10)

    let ok = true
    switch (c.carry) {
      case 'none':
        ok = totalCarries === 0 && !additionCarry
        break
      case 'once':
        ok = totalCarries === 1
        break
      case 'normal':
        ok = totalCarries >= 1
        break
      case 'continuous':
        ok = p1.carries >= 1 && p2.carries >= 1
        break
      default:
        break
    }
    if (!ok) continue

    return {
      latex: `${a} \\times ${b} =`,
      answer: String(product),
      operands: [a, b],
      op: 'mul',
      values: [a, b, product],
      features: {
        partialCarries1: p1.carries,
        partialCarries2: p2.carries,
        totalCarries,
        additionCarry,
        aZeroEnd: a % 10 === 0,
        bZeroEnd: b % 10 === 0,
      },
    }
  }
  return null
}

function hasAddCarry(a: number, b: number): boolean {
  let carry = 0
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const sum = (x % 10) + (y % 10) + carry
    carry = sum >= 10 ? 1 : 0
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return carry > 0
}

function buildDiv2(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const dividendDigits = c.dividendDigits ?? 3
  const quotientDigits = c.quotientDigits ?? Math.max(1, dividendDigits - 2)
  const result = divCore(rng, {
    dividendDigits,
    quotientDigits,
    divisorMin: c.divisorMin ?? 11,
    divisorMax: c.divisorMax ?? 99,
    divisorStep: c.divisorStep,
    quotientZero: c.quotientZero ?? 'none',
    remainder: c.remainder ?? (c.exact === false ? 'nonzero' : 'zero'),
    maxResult: c.maxResult,
    minResult: c.minResult,
  })
  if (!result) return null
  const { dividend, divisor, quotient, rem, quotientZeroHit } = result
  if (c.remainder === 'zero' && rem !== 0) return null
  if (c.remainder === 'nonzero' && rem === 0) return null
  if (c.quotientZero === 'none' && quotientZeroHit) return null

  return {
    latex: `${dividend} \\div ${divisor} =`,
    answer: rem === 0 ? String(quotient) : `${quotient}……${rem}`,
    operands: [dividend, divisor],
    op: 'div',
    values: [dividend, divisor, quotient, rem],
    features: {
      divisor,
      quotient,
      remainder: rem,
      dividendDigits,
      quotientDigits: digitsOf(quotient),
      quotientZero: quotientZeroHit,
      exact: rem === 0,
    },
  }
}

function buildMix2(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const pattern = c.pattern ?? 'a*b+c'
  const [fmin, fmax] = factorRange(c.mulDigits)
  const maxResult = c.maxResult ?? 1000
  const maxOperand = c.maxOperand ?? maxResult
  const mul = () => {
    const a = randInt(rng, fmin, fmax)
    const b = randInt(rng, fmin, fmax)
    return { a, b, product: a * b }
  }

  for (let attempt = 0; attempt < 400; attempt++) {
    let node: ExprNode
    let values: number[]
    switch (pattern) {
      case 'a*b+c': {
        const { a, b } = mul()
        const c0 = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('+', bin('×', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a*b-c': {
        const { a, b, product } = mul()
        if (product <= 1) continue
        const c0 = randInt(rng, 1, product - 1)
        node = bin('-', bin('×', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a+b*c': {
        const { a, b } = mul()
        const x = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('+', num(x), bin('×', num(a), num(b)))
        values = [x, a, b]
        break
      }
      case 'a-b*c': {
        const { a, b, product } = mul()
        const x = product + randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('-', num(x), bin('×', num(a), num(b)))
        values = [x, a, b]
        break
      }
      case 'a/b+c': {
        const b = randInt(rng, 2, 9)
        const q = randInt(rng, 1, Math.max(1, Math.floor(maxResult / b)))
        const a = b * q
        const c0 = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('+', bin('÷', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a/b-c': {
        const b = randInt(rng, 2, 9)
        const q = randInt(rng, 2, Math.max(2, Math.floor(maxResult / b)))
        const c0 = randInt(rng, 1, q - 1)
        const a = b * q
        node = bin('-', bin('÷', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a*b/c': {
        const a = randInt(rng, fmin, fmax)
        const b = randInt(rng, fmin, fmax)
        const c0 = randInt(rng, 2, 9)
        if ((a * b) % c0 !== 0) continue
        node = bin('÷', bin('×', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a/b*c': {
        const b = randInt(rng, 2, 9)
        const q = randInt(rng, 1, Math.max(1, Math.floor(maxResult / b)))
        const a = b * q
        const c0 = randInt(rng, fmin, fmax)
        node = bin('×', bin('÷', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a+b-c':
      case 'a-b+c': {
        const a = randInt(rng, 1, Math.max(1, maxOperand))
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const c0 = randInt(rng, 1, Math.max(1, maxOperand))
        if (pattern === 'a+b-c') {
          if (a + b - c0 < 0) continue
          node = bin('-', bin('+', num(a), num(b)), num(c0))
        } else {
          if (a - b + c0 < 0) continue
          node = bin('+', bin('-', num(a), num(b)), num(c0))
        }
        values = [a, b, c0]
        break
      }
      default:
        return null
    }
    try {
      const built = finishNode(ctx, node, values, { pattern, terms: 3 })
      const value = Number(built.features.result)
      if (value <= maxResult && value >= 0) return built
    } catch {
      continue
    }
  }
  return null
}

function buildMix3(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const pattern = c.pattern ?? '(a+b)*c'
  const [fmin, fmax] = factorRange(c.mulDigits)
  const maxResult = c.maxResult ?? 1000
  const maxOperand = c.maxOperand ?? maxResult
  const mul = () => {
    const a = randInt(rng, fmin, fmax)
    const b = randInt(rng, fmin, fmax)
    return { a, b, product: a * b }
  }

  for (let attempt = 0; attempt < 400; attempt++) {
    let node: ExprNode
    let values: number[]
    let terms = 2
    switch (pattern) {
      case '(a+b)*c': {
        const a = randInt(rng, 1, Math.max(1, maxOperand))
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const c0 = randInt(rng, fmin, fmax)
        node = bin('×', bin('+', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case '(a-b)*c': {
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const diff = randInt(rng, 1, Math.max(1, maxOperand))
        const a = b + diff
        const c0 = randInt(rng, fmin, fmax)
        node = bin('×', bin('-', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case '(a+b)*2': {
        // 周长专用：固定乘 2，避免生成 (长+宽)×3 这类与单元无关的式子
        const omin = Math.max(1, c.minOperand ?? 1)
        const omax = Math.max(omin, maxOperand)
        const a = randInt(rng, omin, omax)
        const b = randInt(rng, omin, omax)
        node = bin('×', bin('+', num(a), num(b)), num(2))
        values = [a, b, 2]
        break
      }
      case '(a+b)/c': {
        const c0 = randInt(rng, 2, 9)
        const q = randInt(rng, 1, Math.max(1, Math.floor(maxResult / c0)))
        const sum = c0 * q
        const a = randInt(rng, 1, sum - 1)
        const b = sum - a
        node = bin('÷', bin('+', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case '(a-b)/c': {
        const c0 = randInt(rng, 2, 9)
        const q = randInt(rng, 1, Math.max(1, Math.floor(maxResult / c0)))
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const a = b + c0 * q
        node = bin('÷', bin('-', num(a), num(b)), num(c0))
        values = [a, b, c0]
        break
      }
      case 'a*(b+c)': {
        const { a } = mul()
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const c0 = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('×', num(a), bin('+', num(b), num(c0)))
        values = [a, b, c0]
        break
      }
      case 'a*(b-c)': {
        const { a } = mul()
        const b = randInt(rng, 2, Math.max(2, maxOperand))
        const c0 = randInt(rng, 1, b - 1)
        node = bin('×', num(a), bin('-', num(b), num(c0)))
        values = [a, b, c0]
        break
      }
      case 'a*(b+c)-d': {
        const { a } = mul()
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const c0 = randInt(rng, 1, Math.max(1, maxOperand))
        const d = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('-', bin('×', num(a), bin('+', num(b), num(c0))), num(d))
        values = [a, b, c0, d]
        terms = 3
        break
      }
      case 'a*b-c*d': {
        const left = mul()
        const right = mul()
        if (left.product <= right.product) continue
        node = bin('-', bin('×', num(left.a), num(left.b)), bin('×', num(right.a), num(right.b)))
        values = [left.a, left.b, right.a, right.b]
        terms = 3
        break
      }
      case 'a*b+c*d': {
        const left = mul()
        const right = mul()
        node = bin('+', bin('×', num(left.a), num(left.b)), bin('×', num(right.a), num(right.b)))
        values = [left.a, left.b, right.a, right.b]
        terms = 3
        break
      }
      case '(a+b)*c-d': {
        const a = randInt(rng, 1, Math.max(1, maxOperand))
        const b = randInt(rng, 1, Math.max(1, maxOperand))
        const c0 = randInt(rng, fmin, fmax)
        const d = randInt(rng, 1, Math.max(1, maxOperand))
        node = bin('-', bin('×', bin('+', num(a), num(b)), num(c0)), num(d))
        values = [a, b, c0, d]
        terms = 3
        break
      }
      default:
        return null
    }
    try {
      const built = finishNode(ctx, node, values, { pattern, terms, bracket: pattern.includes('(') })
      const value = Number(built.features.result)
      if (value <= maxResult && value >= 0) return built
    } catch {
      continue
    }
  }
  return null
}

const ROUND_PAIRS: Record<number, [number, number][]> = {
  100: [
    [25, 4],
    [50, 2],
    [20, 5],
    [4, 25],
    [2, 50],
    [5, 20],
  ],
  1000: [
    [125, 8],
    [250, 4],
    [500, 2],
    [8, 125],
    [4, 250],
    [2, 500],
  ],
}

function buildAssoc(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const roundTo = c.roundTo ?? 100
  const pairs = ROUND_PAIRS[roundTo]
  if (!pairs) return null
  const [x, y] = pick(rng, pairs)
  const z = randInt(rng, c.minFactor ?? 2, c.maxFactor ?? 9)
  const pair = c.roundPair ?? 'a*c'
  const a = pair === 'a*b' ? x : pair === 'a*c' ? x : z
  const b = pair === 'b*c' ? x : pair === 'a*b' ? y : z
  const c0 = pair === 'a*c' ? y : pair === 'b*c' ? y : z
  const result = roundTo * z
  const orig = `${a} \\times ${b} \\times ${c0}`
  let lines: string[]
  if (pair === 'a*b') {
    lines = [orig, `= ${roundTo} \\times ${c0}`, `= ${result}`]
  } else if (pair === 'a*c') {
    lines = [orig, `= ${x} \\times ${y} \\times ${z}`, `= ${roundTo} \\times ${z}`, `= ${result}`]
  } else {
    lines = [orig, `= ${z} \\times ${x} \\times ${y}`, `= ${z} \\times ${roundTo}`, `= ${result}`]
  }
  const wantsSteps = ctx.type === 'tuoshi' || ctx.type === 'jianbian'
  return {
    latex: `${orig}${ctx.type === 'kousuan' || ctx.type === 'chushi' ? ' =' : ''}`,
    answer: String(result),
    ...(wantsSteps ? { answerLines: lines } : {}),
    values: [a, b, c0, result],
    features: { result, steps: 3, terms: 3, roundTo, roundPair: pair },
    node: bin('×', bin('×', num(a), num(b)), num(c0)),
  }
}

function buildDist(ctx: BuildContext): BuiltQuestion | null {
  const { rng, constraints: c } = ctx
  const roundTo = c.roundTo ?? 100
  const c0 = randInt(rng, c.minFactor ?? 2, c.maxFactor ?? 9)
  const pattern = c.pattern ?? 'a*c+b*c'
  let a: number
  let b: number
  let d = 0
  let node: ExprNode
  if (pattern === 'a*c-b*c') {
    b = randInt(rng, 1, Math.max(1, roundTo - 1))
    a = b + roundTo
    node = bin('-', bin('×', num(a), num(c0)), bin('×', num(b), num(c0)))
  } else if (pattern === 'a*c+b*c+d*c') {
    a = randInt(rng, 1, roundTo - 2)
    b = randInt(rng, 1, roundTo - a - 1)
    d = roundTo - a - b
    node = bin(
      '+',
      bin('+', bin('×', num(a), num(c0)), bin('×', num(b), num(c0))),
      bin('×', num(d), num(c0)),
    )
  } else {
    a = randInt(rng, 1, roundTo - 1)
    b = roundTo - a
    node = bin('+', bin('×', num(a), num(c0)), bin('×', num(b), num(c0)))
  }
  let result: number
  try {
    result = evalNode(node)
  } catch {
    return null
  }
  if (c.maxResult != null && result > c.maxResult) return null
  const wantsSteps = ctx.type === 'tuoshi' || ctx.type === 'jianbian'
  const sumText =
    pattern === 'a*c-b*c'
      ? `${a} - ${b}`
      : pattern === 'a*c+b*c+d*c'
        ? `${a} + ${b} + ${d}`
        : `${a} + ${b}`
  const orig =
    pattern === 'a*c-b*c'
      ? `${a} \\times ${c0} - ${b} \\times ${c0}`
      : pattern === 'a*c+b*c+d*c'
        ? `${a} \\times ${c0} + ${b} \\times ${c0} + ${d} \\times ${c0}`
        : `${a} \\times ${c0} + ${b} \\times ${c0}`
  const lines = [
    orig,
    `= (${sumText}) \\times ${c0}`,
    `= ${roundTo} \\times ${c0}`,
    `= ${result}`,
  ]
  return {
    latex: `${orig}${ctx.type === 'kousuan' || ctx.type === 'chushi' ? ' =' : ''}`,
    answer: String(result),
    ...(wantsSteps ? { answerLines: lines } : {}),
    values: pattern === 'a*c+b*c+d*c' ? [a, b, d, c0, result] : [a, b, c0, result],
    features: {
      result,
      steps: pattern === 'a*c+b*c+d*c' ? 3 : 2,
      terms: pattern === 'a*c+b*c+d*c' ? 4 : 3,
      roundTo,
      pattern,
    },
    node,
  }
}

export const BUILDERS: Record<FormName, Builder> = {
  mul1: buildMul1,
  div1: buildDiv1,
  mul2: buildMul2,
  div2: buildDiv2,
  mix2: buildMix2,
  mix3: buildMix3,
  assoc: buildAssoc,
  dist: buildDist,
  // 年月日口算：由 dateKousuan 模块生成，复核走同一模块的独立重算
  dateKousuan: (ctx) => buildDateKousuan(ctx.constraints.dateKind ?? 'monthDays', ctx.rng, ctx.level),
}

// ---------- 口算范围硬限制 ----------
//
// 口算没有竖式留白，必须落在“能心算”的范围：
// - 加减：操作数与结果都是两位/三位整数（≤999）；
// - 乘法：一位数×两/三位数，或整十/整百数参与（不允许两位数×两位数）；
// - 除法：除数是一位数或整十除数；除数十位以上必须整除；
// - 被除数四位及以上一律不许入口算。
// 该判定供 generate 自检与单元测试共用，避免只靠调参“碰巧”不越界。

const mulWithinMental = (a: number, b: number): boolean => {
  if (a > 999 || b > 999) return false
  if (a * b > 9999) return false
  return a <= 9 || b <= 9 || a % 10 === 0 || b % 10 === 0
}

const divWithinMental = (dividend: number, divisor: number, remainder: number): boolean => {
  if (dividend > 999) return false
  if (divisor <= 9) return true
  if (divisor > 90 || divisor % 10 !== 0) return false
  return remainder === 0
}

function nodeKousuanProblem(node: ExprNode): string | null {
  if (node.kind === 'num') {
    return node.value <= 999 ? null : `口算出现四位及以上整数 ${node.value}`
  }
  if (node.op === '×') {
    const a = evalNode(node.left)
    const b = evalNode(node.right)
    if (!mulWithinMental(a, b)) return `口算乘法超出心算范围：${a} × ${b}`
  }
  if (node.op === '÷') {
    const dividend = evalNode(node.left)
    const divisor = evalNode(node.right)
    const remainder = dividend % divisor
    if (!divWithinMental(dividend, divisor, remainder)) {
      return `口算除法超出心算范围：${dividend} ÷ ${divisor}`
    }
  }
  return nodeKousuanProblem(node.left) ?? nodeKousuanProblem(node.right)
}

/** 返回 null 表示符合口算范围，否则返回具体越界原因 */
export function kousuanRangeProblem(built: BuiltQuestion): string | null {
  if (built.node) return nodeKousuanProblem(built.node)
  if (built.op === 'mul') {
    const [a, b] = built.operands ?? []
    if (a == null || b == null) return '缺少乘法操作数'
    return mulWithinMental(a, b) ? null : `口算乘法超出心算范围：${a} × ${b}`
  }
  if (built.op === 'div') {
    const [dividend, divisor, , rem] = built.values
    if (dividend == null || divisor == null) return '缺少除法操作数'
    return divWithinMental(dividend, divisor, rem ?? 0)
      ? null
      : `口算除法超出心算范围：${dividend} ÷ ${divisor}`
  }
  return null
}

export function buildOne(
  form: FormName,
  ctx: BuildContext,
): BuiltQuestion | null {
  return BUILDERS[form](ctx)
}

/** 供测试与 CLI 使用：给定 seed 直接出题（不经过单元树） */
export function sampleBuild(options: {
  form: FormName
  type: CalcType
  level: Level
  constraints: Constraints
  seed?: number
  count?: number
}): BuiltQuestion[] {
  const rng = createRng(options.seed ?? 1)
  const out: BuiltQuestion[] = []
  for (let i = 0; i < (options.count ?? 1); i++) {
    const built = buildOne(options.form, {
      rng,
      level: options.level,
      type: options.type,
      constraints: options.constraints,
      attempt: i,
    })
    if (built) out.push(built)
  }
  return out
}

/** 便于外部按同一 seed 复现 */
export function rngFor(seed: number): Rng {
  return createRng(seed)
}

/** CLI 参数到 GenerateOptions 的桥接（保持模块无 node 依赖） */
export type CliOptions = GenerateOptions & { unitId: string }
