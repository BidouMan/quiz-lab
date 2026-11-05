/**
 * 出卷时的运行时复核（0.4.0 第三项）。
 *
 * 与生成路径分开：骨架题用 verify.ts 的独立求值器从参数重算，
 * 规则库计算题只拿最终 latex / answer 字符串用 evalLatex 重算，
 * 静态兜底题至少校验结构与答案非空。复核失败先有限次重生成，仍失败则剔除。
 */
import { evalLatex } from '../quiz/expr.ts'
import { verifyConceptItem } from '../quiz/concepts.ts'
import { verifyLieItem } from '../quiz/lieshi.ts'
import { deriveWrongValues, verifyFormatSource } from '../quiz/formats.ts'
import { verifyQuestion } from '../quiz/skeleton/index.ts'
import type { Combo, PilotQuestion } from '../quiz/skeleton/types.ts'
import type { FillQuestion, GeneratedQuestion } from '../quiz/types.ts'
import type { RuntimeCheckStats, TypstItem } from './types.ts'

export const MAX_REGENERATIONS = 3

export function emptyRuntimeCheck(): RuntimeCheckStats {
  return { checked: 0, failed: 0, dropped: 0, regenerated: 0, details: [] }
}

export interface AdmitOutcome<T> {
  accepted: T | null
  firstFailed: boolean
  /** 实际重生成次数 */
  attempts: number
  dropped: boolean
  issues: string[]
}

/**
 * 复核策略：首检不过 → 最多重生成 MAX_REGENERATIONS 次 → 仍不过就剔除。
 * 重生成候选必须重新过 verify；绝不直接放行未经验证的题。
 */
export function admitWithRetry<T>(input: {
  initial: T
  verify: (candidate: T) => string[]
  regenerate: (attempt: number) => T | null
  maxRegenerations?: number
  /** 候选被否决时回调，用于释放其占用的卷内去重键 */
  onReject?: (candidate: T) => void
}): AdmitOutcome<T> {
  const limit = input.maxRegenerations ?? MAX_REGENERATIONS
  const first = input.verify(input.initial)
  if (first.length === 0) {
    return { accepted: input.initial, firstFailed: false, attempts: 0, dropped: false, issues: [] }
  }
  input.onReject?.(input.initial)
  let issues = first
  let attempts = 0

  for (let attempt = 1; attempt <= limit; attempt++) {
    const candidate = input.regenerate(attempt)
    if (candidate == null) continue
    attempts = attempt
    const checked = input.verify(candidate)
    if (checked.length === 0) {
      return { accepted: candidate, firstFailed: true, attempts, dropped: false, issues: [] }
    }
    input.onReject?.(candidate)
    issues = checked
  }

  return { accepted: null, firstFailed: true, attempts, dropped: true, issues }
}

export function recordCheck(stats: RuntimeCheckStats, outcome: AdmitOutcome<unknown>, label: string): void {
  stats.checked++
  if (!outcome.firstFailed) return
  stats.failed++
  if (outcome.accepted == null) {
    stats.dropped++
    const reason = outcome.issues[0] ?? '复核未通过'
    const entry = `${label}：复核剔除（${reason}）`
    if (stats.details.length < 20 && !stats.details.includes(entry)) stats.details.push(entry)
  } else {
    stats.regenerated++
  }
}

// ---------- 规则库计算题 ----------

/** 从最终 latex / answer 字符串重算；带余数除法单独校验商、余与除数关系 */
export function verifyCalcQuestion(question: GeneratedQuestion): string[] {
  const issues: string[] = []
  const latex = (question.latex ?? '').trim()
  const answer = (question.answer ?? '').trim()

  if (!latex) return ['算式为空']
  if (/undefined|NaN/.test(latex)) return [`算式含未替换值：${latex}`]
  if (!answer) return ['答案为空']
  if (/undefined|NaN/.test(answer)) return [`答案含未替换值：${answer}`]

  if (answer.includes('……')) {
    const match = /^(\d+)\s*\\div\s*(\d+)\s*=$/.exec(latex)
    if (!match) return [`带余数答案的算式不是除法：${latex}`]
    const dividend = Number(match[1])
    const divisor = Number(match[2])
    const [quotientText, remainderText] = answer.split('……')
    const quotient = Number(quotientText)
    const remainder = Number(remainderText)
    if (!Number.isInteger(quotient) || !Number.isInteger(remainder)) {
      return [`带余数答案格式错误：${answer}`]
    }
    if (divisor <= 0) return [`除数不合法：${divisor}`]
    if (remainder < 0 || remainder >= divisor) {
      const display = latex.replace(/\s*=\s*$/, '')
      return [`余数 ${remainder} 不在 [0, ${divisor}) 内：${display} = ${answer}`]
    }
    if (dividend !== quotient * divisor + remainder) {
      return [`带余除法重算不符：${dividend} ÷ ${divisor} 应为 ${quotient}……${remainder}`]
    }
  } else {
    let value: number
    try {
      value = evalLatex(latex)
    } catch (error) {
      return [`算式重算失败：${(error as Error).message}`]
    }
    if (String(value) !== answer) {
      const display = latex.replace(/\s*=\s*$/, '')
      return [`重算不符：${display} = ${value}，答案为 ${answer}`]
    }
  }

  // 脱式/简便运算的递等式：每一行都必须与最终答案同值，防止答案正确但过程写错
  for (const line of question.answerLines ?? []) {
    const text = line.replace(/^\s*=\s*/, '').trim()
    if (!text) continue
    let value: number
    try {
      value = evalLatex(text)
    } catch (error) {
      return [`递等式重算失败：${line}（${(error as Error).message}）`]
    }
    if (!answer.includes('……') && String(value) !== answer) {
      return [`递等式与答案不一致：${line} = ${value}，答案为 ${answer}`]
    }
  }

  return issues
}

// ---------- 旧生成器（填空/应用题） ----------

export function verifyFillQuestion(question: FillQuestion): string[] {
  const issues: string[] = []
  const stem = (question.stem ?? '').trim()
  const answers = question.answers ?? []
  if (!stem) issues.push('题干为空')
  if (/undefined|NaN/.test(stem)) issues.push(`题干含未替换值：${stem}`)
  if (!answers.length) issues.push('缺少答案')
  if (answers.some((answer) => !String(answer).trim())) issues.push('存在空答案')
  const blanks = (stem.match(/_{2,}/g) ?? []).length
  if (blanks !== answers.length) issues.push(`空位 ${blanks} 个，答案 ${answers.length} 条`)
  return issues
}

// ---------- 静态兜底 / 静态示例题 ----------

export function verifyItemStructure(item: TypstItem): string[] {
  const issues: string[] = []
  if (!item.id) issues.push('题目缺少 id')
  const kind = item.kind

  if (kind === 'kousuan' || kind === 'chushi' || kind === 'tuoshi' || kind === 'jianbian') {
    const expr = (item.expr ?? '').trim()
    if (!expr) issues.push('算式为空')
    if (/undefined|NaN/.test(expr)) issues.push(`算式含未替换值：${expr}`)
    return issues
  }

  if (kind === 'fill') {
    const parts = item.parts ?? []
    const blanks = parts.filter((part) => 'b' in part).length
    if (parts.length === 0) issues.push('填空结构为空')
    if (blanks === 0) issues.push('填空没有空位')
    const answers = item.answers ?? []
    if (!answers.length) issues.push('缺少答案')
    else if (answers.some((answer) => !String(answer).trim())) issues.push('存在空答案')
    else if (blanks !== answers.length) issues.push(`空位 ${blanks} 个，答案 ${answers.length} 条`)
    return issues
  }

  if (kind === 'word') {
    if (!(item.text ?? '').trim()) issues.push('题干为空')
    const answers = item.answers ?? []
    if (!answers.length) issues.push('缺少答案')
    else if (answers.some((answer) => !String(answer).trim())) issues.push('存在空答案')
    return issues
  }

  if (kind === 'judge' || kind === 'choice') return verifyFormatItem(item)

  // 列式计算：复用生成器暴露的双路径复核（独立求值 + 模板反解结构）
  if (kind === 'lieshi') return verifyLieItem(item)

  // 比大小 / 图形题：按题面独立重算，再与标注答案核对
  if (kind === 'compare') {
    if (!(item.pre ?? '').trim() || !(item.post ?? '').trim()) {
      issues.push('比较式为空')
      return issues
    }
    const left = evalCompareSide(item.pre ?? '')
    const right = evalCompareSide(item.post ?? '')
    if (left == null || right == null) {
      issues.push('比较式无法独立求值')
      return issues
    }
    const actual = compareSides(left, right)
    if (item.audit?.answer && actual !== item.audit.answer) {
      issues.push(`比大小答案不符：独立算出 ${actual}，标注 ${item.audit.answer}`)
    }
  } else if (kind === 'geom') {
    if (!(item.text ?? '').trim()) issues.push('图形题题干为空')
    if (typeof item.fig === 'string' || item.fig == null) issues.push('图形题缺少图形规格')
    if (item.audit) {
      const expected = geomRecompute(item.audit.params)
      if (expected == null) issues.push(`无法重算图形题（form=${item.audit.form}）`)
      else if (typeof expected.value === 'number') {
        if (Math.abs(expected.value - Number(item.audit.answer)) > 1e-9) {
          issues.push(`图形题答案不符：独立算出 ${expected.value}，标注 ${item.audit.answer}`)
        }
      } else if (expected.value !== String(item.audit.answer).trim()) {
        issues.push(`图形题答案不符：独立算出 ${expected.value}，标注 ${item.audit.answer}`)
      }
      const unit = item.audit.params.unit
      if (typeof unit === 'string' && !(item.text ?? '').includes(unit) && Number.isFinite(Number(item.audit.answer))) {
        issues.push(`题干单位与答案单位不一致：答案按${unit}，题干未写`)
      }
    }
  }
  return issues
}

/**
 * 判断题 / 选择题复核：
 * 1) 正确值从来源参数独立重算（不是信题面里写的答案）；
 * 2) 假命题/干扰项逐个用错因规则重新推导，确认「确实错」「错因对得上」；
 * 3) 选择题必须恰好一个选项与标答等值。
 */
function verifyFormatItem(item: TypstItem): string[] {
  const issues: string[] = []
  const fmt = item.fmt
  if (!fmt) return ['缺少判断/选择复核字段']
  const source = verifyFormatSource(fmt.data)
  if (!source.ok) issues.push(`来源重算失败：${source.error}`)
  const correct = fmt.data.correct.trim()
  const derived = deriveWrongValues(fmt.data)
  const derivedValues = new Set(derived.map((item) => item.value.trim()))
  const stemText = (item.parts ?? [])
    .map((part) => ('t' in part ? part.t : ''))
    .join('')

  if (fmt.data.pool === 'concept') {
    // 概念命题没有数值可重算：走「命题 ID → 判据表」复核，题干/真值/标答/错因四处对齐
    const source = verifyFormatSource(fmt.data)
    if (!source.ok) issues.push(`来源复核失败：${source.error}`)
    issues.push(
      ...verifyConceptItem({
        conceptId: fmt.data.conceptId,
        stem: stemText,
        truth: item.truth,
        answers: item.answers,
        causes: fmt.causes,
      }),
    )
    return issues
  }

  if (item.kind === 'judge') {
    if (typeof item.truth !== 'boolean') issues.push('判断题缺少真假标注')
    const expectedAnswer = item.truth ? '√' : '×'
    if ((item.answers?.[0] ?? '') !== expectedAnswer) issues.push('答案符号与真假标注不一致')
    if (item.truth) {
      if (stemText && !stemText.includes(correct)) issues.push('真命题题干没有出现标答值')
      if ((fmt.causes ?? []).length > 0) issues.push('真命题不应带错因')
    } else {
      const causes = fmt.causes ?? []
      if (causes.length !== 1) {
        issues.push('假命题必须且只能带 1 条错因')
      }
      const cause = causes[0]
      if (cause) {
        if (cause.value.trim() === correct) issues.push('假命题的值与标答相同，实际为真')
        const matched = derived.find(
          (candidate) => candidate.value.trim() === cause.value.trim() && candidate.rule === cause.rule,
        )
        if (!matched) issues.push(`假命题错因无法由规则重算：${cause.rule}`)
        if (stemText && !stemText.includes(cause.value.trim())) issues.push('题干没有出现假命题的值')
      }
    }
  } else {
    const options = (item.options ?? []).map((option) => option.trim())
    if (options.length !== 4) issues.push(`选择题选项应为 4 个，实际 ${options.length}`)
    if (new Set(options).size !== options.length) issues.push('选择题存在重复选项')
    const index = item.answerIndex
    if (typeof index !== 'number' || index < 0 || index > 3) issues.push('选择题标答下标越界')
    const correctHits = options.filter((option) => option === correct).length
    if (correctHits !== 1) issues.push(`正确选项应恰好 1 个，实际 ${correctHits}`)
    if (typeof index === 'number' && options[index] !== correct) issues.push('标答下标指向的不是正确值')
    const causes = fmt.causes ?? []
    if (causes.length !== 3) issues.push(`干扰项错因应为 3 条，实际 ${causes.length}`)
    for (const option of options) {
      if (option === correct) continue
      if (!derivedValues.has(option)) issues.push(`干扰项「${option}」无法由错因规则重算`)
      if (!causes.some((cause) => cause.value.trim() === option)) {
        issues.push(`干扰项「${option}」缺少错因标注`)
      }
    }
    const letter = typeof index === 'number' ? ['A', 'B', 'C', 'D'][index] : undefined
    if (letter && (item.answers?.[0] ?? '') !== letter) issues.push('答案字母与标答下标不一致')
  }
  return issues
}

const UNIT_FACTORS: Record<string, number> = {
  毫米: 1,
  厘米: 10,
  分米: 100,
  米: 1000,
  元: 10,
  角: 1,
  时: 3600,
  分: 60,
  秒: 1,
  天: 86400,
}

interface CompareSide {
  value: number
  frac?: { n: number; d: number }
}

/** 独立求值：解析题面里的 Typst 数学串（分数按有理数处理，单位按基准换算） */
function evalCompareSide(math: string): CompareSide | null {
  try {
    let source = math.replace(/^display\((.+)\)$/s, '$1').trim()
    // 混合单位：1 米 20 厘米 这类，逐项换算后相加
    const mixed = [...source.matchAll(/(\d+)\s*"([^"]+)"/g)]
    if (mixed.length >= 2) {
      let total = 0
      for (const m of mixed) {
        const factor = UNIT_FACTORS[m[2]]
        if (factor == null) return null
        total += Number(m[1]) * factor
      }
      return { value: total }
    }
    const unit = mixed[0]?.[2]
    const factor = unit == null ? 1 : UNIT_FACTORS[unit]
    if (factor == null) return null
    source = source.replace(/"([^"]+)"/g, '').trim()

    const single = source.match(/^frac\(\s*(\d+)\s*,\s*(\d+)\s*\)$/)
    if (single) {
      const n = Number(single[1]) * factor
      const d = Number(single[2])
      return { value: n / d, frac: { n, d } }
    }
    const plain = source
      .replace(/frac\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, '($1÷$2)')
      .replace(/\btimes\b/g, '×')
      .replace(/\bdiv\b/g, '÷')
      .replace(/\bdot\b/g, '×')
    return { value: evalLatex(plain) * factor }
  } catch {
    return null
  }
}

function compareSides(left: CompareSide, right: CompareSide): '<' | '>' | '=' {
  if (left.frac && right.frac) {
    const a = left.frac.n * right.frac.d
    const b = right.frac.n * left.frac.d
    return a < b ? '<' : a > b ? '>' : '='
  }
  return left.value < right.value ? '<' : left.value > right.value ? '>' : '='
}

/** 图形题独立重算：只认 form + 已知边长，不读生成器算出的答案；认识类返回文字答案 */
function geomRecompute(
  params: Record<string, number | string>,
): { value: number | string; unit?: string } | null {
  const num = (key: string): number => Number(params[key])
  const ok = (...values: number[]): boolean => values.every((value) => Number.isFinite(value))
  switch (params.form) {
    case 'rect-perimeter': {
      const l = num('l')
      const w = num('w')
      return ok(l, w) ? { value: 2 * (l + w) } : null
    }
    case 'square-perimeter': {
      const s = num('s')
      return ok(s) ? { value: 4 * s } : null
    }
    case 'reverse-rect': {
      const p = num('p')
      const l = num('l')
      return ok(p, l) ? { value: p / 2 - l } : null
    }
    case 'reverse-square': {
      const p = num('p')
      return ok(p) ? { value: p / 4 } : null
    }
    case 'fence': {
      const l = num('l')
      const w = num('w')
      return ok(l, w) ? { value: l + 2 * w } : null
    }
    case 'combine': {
      // 两条长边相拼：l×2w，周长 2(l+2w)
      const l = num('l')
      const w = num('w')
      return ok(l, w) ? { value: 2 * (l + 2 * w) } : null
    }
    case 'ratio': {
      const k = num('k')
      const w = num('w')
      return ok(k, w) ? { value: 2 * (k + 1) * w } : null
    }
    case 'recognize-name':
      return { value: params.shape === 'square' ? '正方形' : '长方形' }
    case 'count-shapes':
      // 两个小长方形 + 拼成的一个大长方形
      return { value: num('parts') + 1 }
    case 'classify': {
      const shapes = String(params.shapes ?? '').split(',')
      return { value: shapes.filter((shape) => shape === 'square').length }
    }
    case 'sticks': {
      const sticks = num('sticks')
      return ok(sticks) ? { value: sticks / 4 } : null
    }
    case 'compose': {
      const s = num('s')
      return ok(s) ? { value: 2 * s } : null
    }
    case 'triangle-perimeter': {
      const a = num('a')
      const b = num('b')
      const c = num('c')
      if (!ok(a, b, c)) return null
      if (a + b <= c || a + c <= b || b + c <= a) return null
      return { value: a + b + c }
    }
    case 'isosceles-triangle-perimeter': {
      const a = num('a')
      const b = num('b')
      if (!ok(a, b) || 2 * a <= b) return null
      return { value: 2 * a + b }
    }
    case 'equilateral-triangle-perimeter': {
      const a = num('a')
      return ok(a) ? { value: 3 * a } : null
    }
    case 'parallelogram-perimeter': {
      const a = num('a')
      const b = num('b')
      return ok(a, b) ? { value: 2 * (a + b) } : null
    }
    case 'trapezoid-perimeter': {
      const a = num('a')
      const b = num('b')
      const h = num('h')
      const s = num('s')
      return ok(a, b, h, s) ? { value: a + b + h + s } : null
    }
    case 'lshape-perimeter':
    case 'concave-perimeter': {
      const L = num('L')
      const W = num('W')
      if (!ok(L, W)) return null
      if (params.form === 'lshape-perimeter') return { value: 2 * (L + W) }
      const d = num('d')
      return ok(d) ? { value: 2 * (L + W) + 2 * d } : null
    }
    case 'staircase-perimeter': {
      const n = num('n')
      const a = num('a')
      const b = num('b')
      if (!ok(n, a, b) || n <= 0) return null
      return { value: 2 * n * (a + b) }
    }
    case 't-shape-perimeter': {
      const L = num('L')
      const t = num('t')
      const h = num('h')
      return ok(L, t, h) ? { value: 2 * (L + t + h) } : null
    }
    case 'join-squares-perimeter': {
      const n = num('n')
      const s = num('s')
      if (!ok(n, s) || n <= 0) return null
      return { value: 2 * (n + 1) * s }
    }
    case 'grid-perimeter': {
      const pairs = String(params.cells ?? '')
        .split('|')
        .filter(Boolean)
        .map((pair) => pair.split(',').map(Number))
      if (pairs.length === 0) return null
      if (pairs.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return null
      const cells = pairs as Array<[number, number]>
      const set = new Set(cells.map(([x, y]) => `${x},${y}`))
      let perimeter = 0
      for (const [x, y] of cells) {
        for (const [nx, ny] of [
          [x, y - 1],
          [x + 1, y],
          [x, y + 1],
          [x - 1, y],
        ] as Array<[number, number]>) {
          if (!set.has(`${nx},${ny}`)) perimeter++
        }
      }
      return { value: perimeter }
    }
    // ---- 角与几何计数：独立按定义重算，不读生成器中间值 ----
    case 'point-angles': {
      const n = num('n')
      if (!ok(n) || n < 2) return null
      return { value: (n * (n - 1)) / 2 }
    }
    case 'classify-angles': {
      const degrees = String(params.angles ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number)
      if (degrees.length === 0 || degrees.some((degree) => !Number.isFinite(degree) || degree <= 0 || degree >= 180)) {
        return null
      }
      const right = degrees.filter((degree) => degree === 90).length
      const acute = degrees.filter((degree) => degree < 90).length
      const obtuse = degrees.filter((degree) => degree > 90).length
      return { value: `${right}，${acute}，${obtuse}` }
    }
    case 'add-line-angles': {
      const m = num('m')
      if (!ok(m) || m < 2) return null
      if (params.ask === 'added') return { value: m }
      if (params.ask === 'total') return { value: (m * (m + 1)) / 2 }
      return null
    }
    case 'count-triangles': {
      const k = num('k')
      if (!ok(k) || k < 1) return null
      return { value: ((k + 1) * (k + 2)) / 2 }
    }
    case 'count-rectangles': {
      const m = num('m')
      const n = num('n')
      if (!ok(m, n) || m < 1 || n < 1) return null
      return { value: ((m * (m + 1)) / 2) * ((n * (n + 1)) / 2) }
    }
    default:
      return null
  }
}

/** 骨架题：走 verify.ts 的独立求值器（参数重算，不复用组装中间结果） */
export function verifySkeletonQuestion(question: PilotQuestion, combo: Combo): string[] {
  return verifyQuestion(question, combo).map((issue) => `[${issue.code}] ${issue.message}`)
}
