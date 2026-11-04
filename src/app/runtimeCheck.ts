/**
 * 出卷时的运行时复核（0.4.0 第三项）。
 *
 * 与生成路径分开：骨架题用 verify.ts 的独立求值器从参数重算，
 * 规则库计算题只拿最终 latex / answer 字符串用 evalLatex 重算，
 * 静态兜底题至少校验结构与答案非空。复核失败先有限次重生成，仍失败则剔除。
 */
import { evalLatex } from '../quiz/expr.ts'
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

  // 比大小 / 图形示例：没有“答案”字段，至少要求题面非空
  if (kind === 'compare') {
    if (!(item.pre ?? '').trim() || !(item.post ?? '').trim()) issues.push('比较式为空')
  } else if (kind === 'geom') {
    if (!(item.text ?? '').trim()) issues.push('图形题题干为空')
  }
  return issues
}

/** 静态兜底题：结构之外，计算题还必须有非空答案（旧题库条目已带答案） */
export function verifyStaticItem(item: TypstItem): string[] {
  const issues = verifyItemStructure(item)
  if (item.kind === 'kousuan' || item.kind === 'chushi' || item.kind === 'tuoshi' || item.kind === 'jianbian') {
    if (!item.answers || item.answers.length === 0) issues.push('静态兜底题缺少答案')
    else if (item.answers.some((answer) => !String(answer).trim())) issues.push('静态兜底题答案为空')
  }
  return issues
}

/** 骨架题：走 verify.ts 的独立求值器（参数重算，不复用组装中间结果） */
export function verifySkeletonQuestion(question: PilotQuestion, combo: Combo): string[] {
  return verifyQuestion(question, combo).map((issue) => `[${issue.code}] ${issue.message}`)
}
