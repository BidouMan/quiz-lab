import { createRng, pick, randInt, type Rng } from './rng.ts'
import type { MemoryStore } from './memory.ts'
import { normalizeExpr } from './normalize.ts'
import type { Grade, Level } from './types.ts'

/**
 * 比大小规则生成器（沪教版三上/三下）。
 *
 * 只产出已学内容：乘法从“用一位数乘”起、除法从“用一位数除”起、
 * 分数只在三下分数单元之后；全部为整数，无负数、无小数。
 * 题干直接写成 Typst 数学串（times / div / frac），由 paper.typ 渲染。
 */
export type CompareForm =
  | 'int'
  | 'money'
  | 'product'
  | 'quotient'
  | 'exprVsNum'
  | 'length'
  | 'time'
  | 'fracSame'
  | 'fracUnit'
  | 'paren'
  | 'mixedUnit'
  | 'addSub'
  | 'divVsNum'
  | 'days'

export interface ComparePiece {
  /** Typst 数学串 */
  pre: string
  post: string
  answer: '<' | '>' | '='
  form: CompareForm
  kpName: string
}

export interface CompareOptions {
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed: number
  /** 跨卷记忆：键 = 左右两侧表达式规范化串 */
  memory?: MemoryStore
}

const ORDER_3A = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8']
const ORDER_3B = ['3B-U1', '3B-U2', '3B-U3', '3B-U4', '3B-U5', '3B-U6', '3B-U7']

function maxIndex(unitIds: string[], order: string[]): number {
  return unitIds.reduce((max, id) => Math.max(max, order.indexOf(id)), -1)
}

/** 按所选单元里“最靠后”的单元判断知识点是否已学，避免超前出题 */
export function compareCaps(grade: Grade, unitIds: string[]) {
  const a = maxIndex(unitIds, ORDER_3A)
  const b = maxIndex(unitIds, ORDER_3B)
  const isB = grade === '3B'
  return {
    mul: isB || a >= 1,
    div: isB || a >= 3,
    length: isB || a >= 2,
    time: isB || a >= 4,
    frac: isB && b >= 3,
  }
}

const KP: Record<CompareForm, string> = {
  int: '数的大小比较',
  money: '元与角的换算',
  product: '乘法的积比较',
  quotient: '除法的商比较',
  exprVsNum: '算式与数比较',
  length: '长度单位换算',
  time: '时间单位换算',
  fracSame: '同分母分数比较',
  fracUnit: '几分之一比较',
  paren: '带括号的两步式比较',
  mixedUnit: '米与厘米混合比较',
  addSub: '两步加减式比较',
  divVsNum: '除法算式与数比较',
  days: '天与时换算比较',
}

/** 三上单元 → 比大小可用形态（L1/L2/L3）；没有对应内容的单元为空数组 */
const UNIT_FORMS_3A: Record<string, Record<Level, CompareForm[]>> = {
  '3A-U1': { L1: ['addSub'], L2: ['addSub'], L3: ['addSub'] },
  '3A-U2': { L1: ['product'], L2: ['product', 'exprVsNum'], L3: ['paren', 'product', 'exprVsNum'] },
  '3A-U3': { L1: [], L2: [], L3: [] },
  '3A-U4': { L1: ['quotient'], L2: ['quotient', 'divVsNum'], L3: ['quotient', 'divVsNum'] },
  '3A-U5': { L1: ['time'], L2: ['time', 'days'], L3: ['time', 'days'] },
  '3A-U6': { L1: [], L2: [], L3: [] },
  '3A-U7': { L1: ['length'], L2: ['length', 'mixedUnit'], L3: ['mixedUnit', 'length'] },
  '3A-U8': { L1: [], L2: [], L3: [] },
}

/** 某单元在某难度下可用的比大小形态 */
export function compareUnitForms(unitId: string, level: Level): CompareForm[] {
  return UNIT_FORMS_3A[unitId]?.[level] ?? []
}

const UNIT_LABELS: Record<string, string> = {
  '3A-U1': '两步计算',
  '3A-U2': '用一位数乘',
  '3A-U3': '三角形与四边形',
  '3A-U4': '用一位数除',
  '3A-U5': '年月日',
  '3A-U6': '周长',
  '3A-U7': '马拉松路线',
  '3A-U8': '数学广场',
}

/** 所选单元是否有任一难度可出比大小 */
export function compareUnitsSupported(unitIds: string[]): boolean {
  return unitIds.some((unitId) => Object.keys(UNIT_FORMS_3A[unitId] ?? {}).length > 0)
}

function sign(left: number, right: number): '<' | '>' | '=' {
  return left < right ? '<' : left > right ? '>' : '='
}

function makeInt(rng: Rng): ComparePiece {
  const leftValue = randInt(rng, 11, 999)
  let rightValue = randInt(rng, 11, 999)
  if (rightValue === leftValue) rightValue = leftValue + randInt(rng, 1, 9)
  const pre = String(leftValue)
  const post = String(rightValue)
  return { pre, post, answer: sign(leftValue, rightValue), form: 'int', kpName: KP.int }
}

function makeMoney(rng: Rng): ComparePiece {
  // 元/角：1 元 = 10 角
  const yuan = randInt(rng, 1, 19)
  const jiao = randInt(rng, 10, 190)
  if (yuan * 10 === jiao) return makeMoney(rng)
  const pre = `${yuan} "元"`
  const post = `${jiao} "角"`
  return { pre, post, answer: sign(yuan * 10, jiao), form: 'money', kpName: KP.money }
}

function makeProduct(rng: Rng, level: Level): ComparePiece {
  const digits = level === 'L3' ? 3 : level === 'L2' ? 3 : 2
  const a = randInt(rng, digits === 3 ? 101 : 12, digits === 3 ? 999 : 99)
  const b = randInt(rng, 3, 9)
  const c = randInt(rng, digits === 3 ? 101 : 12, digits === 3 ? 999 : 99)
  const d = randInt(rng, 3, 9)
  const pre = `${a} times ${b}`
  const post = `${c} times ${d}`
  return { pre, post, answer: sign(a * b, c * d), form: 'product', kpName: KP.product }
}

function makeQuotient(rng: Rng): ComparePiece {
  // 只用能整除的除法，商为 2..99
  const b = randInt(rng, 2, 9)
  const q1 = randInt(rng, 6, 99)
  const d = randInt(rng, 2, 9)
  const q2 = randInt(rng, 6, 99)
  const pre = `${b * q1} div ${b}`
  const post = `${d * q2} div ${d}`
  return { pre, post, answer: sign(q1, q2), form: 'quotient', kpName: KP.quotient }
}

function makeExprVsNum(rng: Rng): ComparePiece {
  const a = randInt(rng, 12, 99)
  const b = randInt(rng, 3, 9)
  const value = a * b
  const num = randInt(rng, 50, 900)
  const pre = `${a} times ${b}`
  const post = String(num)
  return { pre, post, answer: sign(value, num), form: 'exprVsNum', kpName: KP.exprVsNum }
}

function makeLength(rng: Rng): ComparePiece {
  // 米/分米/厘米换算，左侧单位更大
  const useDm = rng() < 0.5
  if (useDm) {
    const dm = randInt(rng, 1, 9)
    const cm = randInt(rng, 10, 90)
    if (dm * 10 === cm) return makeLength(rng)
    return {
      pre: `${dm} "分米"`,
      post: `${cm} "厘米"`,
      answer: sign(dm * 10, cm),
      form: 'length',
      kpName: KP.length,
    }
  }
  const m = randInt(rng, 1, 6)
  const cm = randInt(rng, 10, 600)
  if (m * 100 === cm) return makeLength(rng)
  return {
    pre: `${m} "米"`,
    post: `${cm} "厘米"`,
    answer: sign(m * 100, cm),
    form: 'length',
    kpName: KP.length,
  }
}

function makeTime(rng: Rng): ComparePiece {
  // 1 时 = 60 分，1 分 = 60 秒
  if (rng() < 0.5) {
    const hour = randInt(rng, 1, 5)
    const minute = randInt(rng, 30, 300)
    if (hour * 60 === minute) return makeTime(rng)
    return {
      pre: `${hour} "时"`,
      post: `${minute} "分"`,
      answer: sign(hour * 60, minute),
      form: 'time',
      kpName: KP.time,
    }
  }
  const minute = randInt(rng, 1, 9)
  const second = randInt(rng, 30, 540)
  if (minute * 60 === second) return makeTime(rng)
  return {
    pre: `${minute} "分"`,
    post: `${second} "秒"`,
    answer: sign(minute * 60, second),
    form: 'time',
    kpName: KP.time,
  }
}

function makeFracSame(rng: Rng): ComparePiece {
  const d = pick(rng, [5, 7, 8, 9, 10])
  const n1 = randInt(rng, 1, d - 1)
  let n2 = randInt(rng, 1, d - 1)
  if (n2 === n1) n2 = n1 === d - 1 ? 1 : n1 + 1
  return {
    pre: `frac(${n1}, ${d})`,
    post: `frac(${n2}, ${d})`,
    answer: sign(n1, n2),
    form: 'fracSame',
    kpName: KP.fracSame,
  }
}

function makeFracUnit(rng: Rng): ComparePiece {
  // 分子相同的分数：分母越大，每份越小
  const n = pick(rng, [1, 1, 1, 2])
  const d1 = pick(rng, [2, 3, 4, 5, 6])
  let d2 = pick(rng, [2, 3, 4, 5, 6, 8])
  if (d2 === d1) d2 = d1 === 2 ? 3 : d1 - 1
  // 独立比较 n/d1 与 n/d2：交叉相乘
  return {
    pre: `frac(${n}, ${d1})`,
    post: `frac(${n}, ${d2})`,
    answer: sign(n * d2, n * d1),
    form: 'fracUnit',
    kpName: KP.fracUnit,
  }
}

function makeParen(rng: Rng): ComparePiece {
  // 带括号两步式：(a+b)×c 与 d×e
  const mode = rng() < 0.6 ? 'add' : 'sub'
  const a = randInt(rng, 11, 60)
  const b = randInt(rng, 5, mode === 'add' ? 40 : a - 1)
  const c = randInt(rng, 3, 9)
  const leftValue = mode === 'add' ? (a + b) * c : (a - b) * c
  const d = randInt(rng, 11, 99)
  const e = randInt(rng, 3, 9)
  const pre = `(${a} ${mode === 'add' ? '+' : '-'} ${b}) times ${c}`
  const post = `${d} times ${e}`
  return { pre, post, answer: sign(leftValue, d * e), form: 'paren', kpName: KP.paren }
}

function makeMixedUnit(rng: Rng): ComparePiece {
  // 米+厘米 与 厘米 比，先统一单位再比
  const m = randInt(rng, 1, 5)
  const cm = randInt(rng, 1, 90)
  const total = m * 100 + cm
  const other = randInt(rng, 100, 600)
  return {
    pre: `${m} "米" ${cm} "厘米"`,
    post: `${other} "厘米"`,
    answer: sign(total, other),
    form: 'mixedUnit',
    kpName: KP.mixedUnit,
  }
}

function makeAddSub(rng: Rng, level: Level): ComparePiece {
  // 两步加减：先加后减 / 先减后加，全程非负；L3 两侧都是两步式
  const a = randInt(rng, 30, 99)
  const b = randInt(rng, 8, 40)
  const c = randInt(rng, 5, Math.min(30, a + b - 1))
  const leftValue = a + b - c
  if (level === 'L3') {
    const d = randInt(rng, 30, 99)
    const e = randInt(rng, 5, 30)
    const f = randInt(rng, 5, Math.min(30, d - e + 30 > 0 ? d + 20 : 20))
    const rightValue = d - e + f
    return {
      pre: `${a} + ${b} - ${c}`,
      post: `${d} - ${e} + ${f}`,
      answer: sign(leftValue, rightValue),
      form: 'addSub',
      kpName: KP.addSub,
    }
  }
  const num = randInt(rng, 20, 160)
  return {
    pre: `${a} + ${b} - ${c}`,
    post: String(num),
    answer: sign(leftValue, num),
    form: 'addSub',
    kpName: KP.addSub,
  }
}

function makeDivVsNum(rng: Rng): ComparePiece {
  const b = randInt(rng, 2, 9)
  const q = randInt(rng, 6, 99)
  const num = randInt(rng, 10, 900)
  return {
    pre: `${b * q} div ${b}`,
    post: String(num),
    answer: sign(q, num),
    form: 'divVsNum',
    kpName: KP.divVsNum,
  }
}

function makeDays(rng: Rng): ComparePiece {
  // 1 天 = 24 时
  const days = randInt(rng, 1, 6)
  const hours = randInt(rng, 20, 168)
  if (days * 24 === hours) return makeDays(rng)
  return {
    pre: `${days} "天"`,
    post: `${hours} "时"`,
    answer: sign(days * 24, hours),
    form: 'days',
    kpName: KP.days,
  }
}
/** 三下沿用按已学上限的通用形态（三下暂不开放成品，仅保持可编译） */
function formsFor3B(level: Level, caps: ReturnType<typeof compareCaps>): CompareForm[] {
  if (level === 'L1') {
    return [
      'int',
      'money',
      ...(caps.mul ? (['product'] as CompareForm[]) : []),
      ...(caps.div ? (['quotient'] as CompareForm[]) : []),
    ]
  }
  if (level === 'L2') {
    return [
      ...(caps.mul ? (['product', 'exprVsNum'] as CompareForm[]) : ['int' as CompareForm]),
      ...(caps.div ? (['quotient'] as CompareForm[]) : []),
      ...(caps.length ? (['length', 'time'] as CompareForm[]) : []),
      ...(caps.frac ? (['fracSame'] as CompareForm[]) : []),
    ]
  }
  return [
    ...(caps.mul ? (['paren', 'product', 'exprVsNum'] as CompareForm[]) : ['int' as CompareForm]),
    ...(caps.div ? (['quotient'] as CompareForm[]) : []),
    ...(caps.length ? (['mixedUnit', 'length', 'time'] as CompareForm[]) : []),
    ...(caps.frac ? (['fracUnit', 'fracSame'] as CompareForm[]) : []),
  ]
}

/**
 * 三上按“所选单元的知识点”决定形态：只出所选单元真正对应的比较，
 * 单元与比大小无任何对应内容（如只勾周长）时返回空数组，由生成器如实说明。
 */
function formsFor(grade: Grade, unitIds: string[], level: Level): CompareForm[] {
  if (grade === '3B') return formsFor3B(level, compareCaps(grade, unitIds))
  const forms: CompareForm[] = []
  for (const unitId of unitIds) {
    for (const form of compareUnitForms(unitId, level)) {
      if (!forms.includes(form)) forms.push(form)
    }
  }
  return forms
}

function makeOne(form: CompareForm, rng: Rng, level: Level): ComparePiece {
  switch (form) {
    case 'int':
      return makeInt(rng)
    case 'money':
      return makeMoney(rng)
    case 'product':
      return makeProduct(rng, level)
    case 'quotient':
      return makeQuotient(rng)
    case 'exprVsNum':
      return makeExprVsNum(rng)
    case 'length':
      return makeLength(rng)
    case 'time':
      return makeTime(rng)
    case 'fracSame':
      return makeFracSame(rng)
    case 'fracUnit':
      return makeFracUnit(rng)
    case 'paren':
      return makeParen(rng)
    case 'mixedUnit':
      return makeMixedUnit(rng)
    case 'addSub':
      return makeAddSub(rng, level)
    case 'divVsNum':
      return makeDivVsNum(rng)
    case 'days':
      return makeDays(rng)
  }
}

/** 跨卷记忆键：左右两侧表达式规范化串（去空格、统一运算符） */
export function compareKey(piece: ComparePiece): string {
  return `compare:${normalizeExpr(piece.pre)}|${normalizeExpr(piece.post)}`
}

/**
 * 生成 count 道互不重复的比大小题。
 * 同一卷内以“左式|右式”为键去重；跨卷优先避开最近窗口出现过的题，
 * 形态池耗尽时按最久未用（lastPaper 最小）轮换，由调用方在 notes 里标注。
 */
export function generateCompare(options: CompareOptions): {
  items: ComparePiece[]
  notes: string[]
  crossReused: number
} {
  const { grade, unitIds, level, count, seed, memory } = options
  const forms = formsFor(grade, unitIds, level)
  if (forms.length === 0) {
    const empty = unitIds
      .filter((unitId) => compareUnitForms(unitId, level).length === 0)
      .map((unitId) => UNIT_LABELS[unitId] ?? unitId)
      .join('、')
    return {
      items: [],
      notes: [`比大小：所选单元（${empty || '无'}）没有对应的比较知识点，已跳过`],
      crossReused: 0,
    }
  }
  const rng = createRng(seed)
  const items: ComparePiece[] = []
  const used = new Set<string>()
  let crossReused = 0
  const maxAttemptsPerItem = 240

  for (let index = 0; index < count; index++) {
    const form = forms[index % forms.length]
    let fresh: ComparePiece | null = null
    let stale: ComparePiece | null = null
    for (let attempt = 0; attempt < maxAttemptsPerItem; attempt++) {
      const piece = makeOne(form, rng, level)
      const key = compareKey(piece)
      if (used.has(key)) continue
      if (memory?.recentlyUsed(key)) {
        if (stale == null || memory.lastPaper(key) < memory.lastPaper(compareKey(stale))) {
          stale = piece
        }
        continue
      }
      fresh = piece
      break
    }
    const chosen = fresh ?? stale
    if (chosen == null) break
    const key = compareKey(chosen)
    if (memory?.crossPaperUsed(key)) crossReused++
    memory?.record(key)
    used.add(key)
    items.push(chosen)
  }

  const notes: string[] = []
  if (items.length < count) notes.push(`本版比大小规则最多可出 ${items.length} 道不重复题`)
  return { items, notes, crossReused }
}
