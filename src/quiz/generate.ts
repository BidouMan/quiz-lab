import { CURRICULUM, findKp, findUnit } from '../data/curriculum.ts'
import type {
  CalcType,
  Constraints,
  GeneratedQuestion,
  GenerateOptions,
  GenerateResult,
  KnowledgePoint,
  Level,
  RuleSpec,
  Unit,
} from './types.ts'
import { MemoryStore } from './memory.ts'
import { createRng, pick } from './rng.ts'
import { buildOne, kousuanRangeProblem, type BuiltQuestion } from './forms.ts'
import { evalLatex, evalNode } from './expr.ts'
import { unitGuardProblem } from './unitGuards.ts'

interface Target {
  unit: Unit
  kp: KnowledgePoint
  specs: RuleSpec[]
}

const MAX_NUMBERS: Record<string, number> = {
  '3A': 10_000,
  '3B': 100_000,
}

const asSpecs = (value: RuleSpec | RuleSpec[] | undefined): RuleSpec[] => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function resolveTargets(options: GenerateOptions): Target[] {
  const { grade, unitId, kpId, type, level } = options
  const targets: Target[] = []

  const pushUnit = (unit: Unit) => {
    for (const kp of unit.kps) {
      const specs = asSpecs(kp.rules[type]?.[level])
      if (specs.length > 0) targets.push({ unit, kp, specs })
    }
  }

  if (kpId) {
    const found = findKp(kpId)
    if (!found) throw new Error(`找不到知识点: ${kpId}`)
    if (found.unit.grade !== grade) throw new Error(`${kpId} 不属于 ${grade}`)
    if (unitId && found.unit.unitId !== unitId) throw new Error(`${kpId} 不属于 ${unitId}`)
    const specs = asSpecs(found.kp.rules[type]?.[level])
    if (specs.length === 0) throw new Error(`${kpId} 不支持 ${type}/${level}`)
    targets.push({ unit: found.unit, kp: found.kp, specs })
  } else if (unitId) {
    const unit = findUnit(unitId)
    if (!unit) throw new Error(`找不到单元: ${unitId}`)
    if (unit.grade !== grade) throw new Error(`${unitId} 不属于 ${grade}`)
    pushUnit(unit)
  } else {
    for (const unit of CURRICULUM.units) {
      if (unit.grade === grade) pushUnit(unit)
    }
  }

  if (targets.length === 0) {
    throw new Error(`${unitId ?? grade} 没有 ${type}/${level} 的生成规则`)
  }
  return targets
}

function checkMul1(built: BuiltQuestion, c: Constraints, level: Level): string | null {
  const [a, m, product] = built.values
  if (product !== a * m) return '乘法答案不对'
  const digits = c.multiplicandDigits ?? c.digits ?? 2
  if (String(a).length !== digits) return '被乘数位数不符'
  if (m < (c.multiplierMin ?? 2) || m > (c.multiplierMax ?? 9)) return '乘数越界'
  if (c.maxResult != null && product > c.maxResult) return '积超过约束'
  if (c.minResult != null && product < c.minResult) return '积低于约束'
  if (c.zeroEnd && a % 10 !== 0) return '末尾没有 0'
  if (c.zeroMiddle && !String(a).slice(1, -1).includes('0')) return '中间没有 0'
  const carries = Number(built.features.carries ?? 0)
  const maxConsecutive = Number(built.features.maxConsecutive ?? 0)
  if (c.carry === 'none' && carries !== 0) return 'L1 要求不进位'
  if (c.carry === 'once' && carries !== 1) return 'L2 要求恰好一次进位'
  if (c.carry === 'normal' && !(carries >= 1 && maxConsecutive === 1)) return 'L2 进位形态不符'
  if (c.carry === 'continuous' && maxConsecutive < 2) return 'L3 要求连续进位'
  if (level === 'L1' && maxConsecutive >= 2) return 'L1 出现连续进位'
  return null
}

function checkMul2(built: BuiltQuestion, c: Constraints, level: Level): string | null {
  const [a, b, product] = built.values
  if (product !== a * b) return '乘法答案不对'
  if (String(a).length !== (c.aDigits ?? c.digits ?? 2)) return '被乘数位数不符'
  if (String(b).length !== (c.bDigits ?? 2)) return '乘数位数不符'
  if (c.maxResult != null && product > c.maxResult) return '积超过约束'
  if (c.aZeroEnd && a % 10 !== 0) return '被乘数末尾没有 0'
  if (c.bZeroEnd && b % 10 !== 0) return '乘数末尾没有 0'
  const p1 = Number(built.features.partialCarries1 ?? 0)
  const p2 = Number(built.features.partialCarries2 ?? 0)
  const total = Number(built.features.totalCarries ?? 0)
  if (c.carry === 'none' && total !== 0) return 'L1 要求不进位'
  if (c.carry === 'once' && total !== 1) return 'L2 要求恰好一次进位'
  if (c.carry === 'continuous' && !(p1 >= 1 && p2 >= 1)) return 'L3 要求两个部分积都进位'
  if (level === 'L1' && total > 0) return 'L1 出现进位'
  return null
}

function checkDiv(built: BuiltQuestion, c: Constraints): string | null {
  const [dividend, divisor, quotient, rem] = built.values
  if (dividend !== quotient * divisor + rem) return '除法答案不对'
  if (rem >= divisor) return '余数不小于除数'
  if (c.divisorMin != null && divisor < c.divisorMin) return '除数越界'
  if (c.divisorMax != null && divisor > c.divisorMax) return '除数越界'
  if (c.divisorStep && divisor % c.divisorStep !== 0) return '除数不是整十数'
  if (String(dividend).length !== c.dividendDigits) return '被除数位数不符'
  if (c.quotientDigits != null && String(quotient).length !== c.quotientDigits) return '商位数不符'
  if (c.remainder === 'zero' && rem !== 0) return '要求整除'
  if (c.remainder === 'nonzero' && rem === 0) return '要求有余数'
  if (c.remainder == null && c.exact === true && rem !== 0) return '要求整除'
  if (c.quotientZero === 'middle' && String(quotient).length >= 3 && String(quotient).at(-2) !== '0') {
    return '商中间没有 0'
  }
  if (c.quotientZero === 'end' && quotient % 10 !== 0) return '商末尾没有 0'
  return null
}

function checkNode(built: BuiltQuestion, c: Constraints): string | null {
  if (!built.node) return '缺少算式结构'
  let value: number
  try {
    value = evalNode(built.node)
  } catch (error) {
    return `算式不合法: ${(error as Error).message}`
  }
  if (String(value) !== built.answer) return '答案与算式不一致'
  if (c.maxResult != null && value > c.maxResult) return '结果超过约束'
  if (c.minResult != null && value < c.minResult) return '结果低于约束'
  if (c.bracket && !built.latex.includes('(')) return '要求带括号'
  // 单元核心运算硬约束：例如 3A-U4 的脱式必须含除号
  const opMap: Record<string, string> = { '÷': '\\div', '×': '\\times', '+': '+', '-': '-' }
  if (c.requireOp && !built.latex.includes(opMap[c.requireOp])) {
    return `脱式缺少必须的运算符 ${c.requireOp}`
  }
  return null
}

function selfCheck(
  built: BuiltQuestion,
  spec: RuleSpec,
  level: Level,
  grade: string,
  unitId: string,
  type: CalcType,
): string | null {
  const maxNumber = MAX_NUMBERS[grade] ?? 100_000
  for (const value of built.values) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return '出现非整数'
    if (value < 0) return '出现负数'
    if (value > maxNumber) return `数值超出年级范围: ${value}`
  }

  if (!built.answer) return '缺少答案'

  // 单元级禁算符：教材顺序硬约束，命中即判定本题生成失败
  const guard = unitGuardProblem(unitId, [built.latex, built.answer, ...(built.answerLines ?? [])])
  if (guard) return guard

  // 口算范围：没有竖式留白，必须落在心算可及的范围
  if (type === 'kousuan') {
    const range = kousuanRangeProblem(built)
    if (range) return range
  }
  // 竖式不练“整十数×整十数”：那类题只需表内乘法再添零，属于口算；
  // 两位数末尾有 0（40×82）同样退回口算，三位数末尾有 0（340×27）保留为竖式变式。
  if (type === 'chushi' && spec.form === 'mul2') {
    const [a, b] = built.values
    const aZero = a % 10 === 0
    const bZero = b % 10 === 0
    if ((aZero && bZero) || (aZero && a < 100) || (bZero && b < 100)) {
      return '竖式出现整十数乘法，应放进口算'
    }
  }
  if (built.answer.includes('……')) {
    const [q, r] = built.answer.split('……').map(Number)
    const [dividend, divisor] = built.values
    if (!(Number.isInteger(q) && Number.isInteger(r))) return '余数答案格式错误'
    if (dividend !== q * divisor + r) return '带余除法答案不对'
  } else {
    let value: number
    try {
      value = evalLatex(built.latex)
    } catch (error) {
      return `算式解析失败: ${(error as Error).message}`
    }
    if (String(value) !== built.answer) return '独立求值与答案不一致'
  }

  switch (spec.form) {
    case 'mul1':
      return checkMul1(built, spec.constraints, level)
    case 'mul2':
      return checkMul2(built, spec.constraints, level)
    case 'div1':
    case 'div2':
      return checkDiv(built, spec.constraints)
    case 'mix2':
    case 'mix3':
    case 'assoc':
    case 'dist':
      return checkNode(built, spec.constraints)
  }
  return null
}

function fingerprint(built: BuiltQuestion, form: string): string {
  return `${form}|${built.values.join('|')}`
}

function makeQuestion(
  built: BuiltQuestion,
  target: Target,
  spec: RuleSpec,
  options: GenerateOptions,
  index: number,
): GeneratedQuestion {
  const { grade, type, level } = options
  const fp = fingerprint(built, spec.form)
  return {
    id: `${target.unit.unitId}-${target.kp.kpId}-${type}-${level}-${String(index + 1).padStart(2, '0')}`,
    grade,
    unitId: target.unit.unitId,
    unitName: target.unit.unitName,
    kpId: target.kp.kpId,
    kpName: target.kp.kpName,
    type,
    level,
    latex: built.latex,
    answer: built.answer,
    ...(built.answerLines ? { answerLines: built.answerLines } : {}),
    ...(built.operands ? { operands: built.operands } : {}),
    ...(built.op ? { op: built.op } : {}),
    fingerprint: fp,
    values: built.values,
    // 计算题也写入 form，便于跨题型统计（进位次数、整十数等）与自检复用同一套过滤
    features: { ...built.features, form: spec.form },
  }
}

interface Candidate {
  built: BuiltQuestion
  spec: RuleSpec
}

/**
 * 生成一份卷子的计算题。
 * - 输入单元或知识点 + 题型 + 难度 + 题量；
 * - 同卷按“算式 + 数值组合”去重；
 * - 跨卷用 MemoryStore 降低已用数值组合权重；
 * - 每题独立自检，不合格自动重试。
 */
export function generate(options: GenerateOptions): GenerateResult {
  const { count, type, level, grade } = options
  if (!Number.isInteger(count) || count <= 0) throw new Error('题量必须是正整数')
  const targets = resolveTargets(options)
  const rng = createRng(options.seed ?? 20261103)
  const memory = options.memory ?? new MemoryStore()

  const usedExpr = new Set<string>()
  const usedFp = new Set<string>()
  const questions: GeneratedQuestion[] = []
  const failures: string[] = []

  for (let index = 0; index < count; index++) {
    const target = targets[index % targets.length]
    const candidates: Candidate[] = []

    for (let attempt = 0; attempt < 700 && candidates.length < 10; attempt++) {
      const spec = pick(rng, target.specs)
      const built = buildOne(spec.form, {
        rng,
        level,
        type,
        constraints: spec.constraints,
        attempt,
      })
      if (!built) continue
      const fp = fingerprint(built, spec.form)
      const exprKey = built.latex.replace(/\s+/g, '')
      if (usedFp.has(fp) || usedExpr.has(exprKey)) continue
      const problem = selfCheck(built, spec, level, grade, target.unit.unitId, type)
      if (problem) {
        if (failures.length < 8) failures.push(problem)
        continue
      }
      candidates.push({ built, spec })
    }

    if (candidates.length === 0) {
      throw new Error(
        `生成失败：${target.unit.unitId}/${target.kp.kpId} ${type}/${level} 连续 700 次没有合格题` +
          (failures.length ? `；最近原因: ${failures.slice(-3).join(' / ')}` : ''),
      )
    }

    // 记忆权重：优先挑未出现过的数值组合；相同权重随机
    let bestUsage = Number.POSITIVE_INFINITY
    let best: Candidate[] = []
    for (const candidate of candidates) {
      const usage = memory.usage(fingerprint(candidate.built, candidate.spec.form))
      if (usage < bestUsage) {
        bestUsage = usage
        best = [candidate]
      } else if (usage === bestUsage) {
        best.push(candidate)
      }
    }
    const chosen = pick(rng, best)
    const fp = fingerprint(chosen.built, chosen.spec.form)
    memory.record(fp)
    usedFp.add(fp)
    usedExpr.add(chosen.built.latex.replace(/\s+/g, ''))
    questions.push(makeQuestion(chosen.built, target, chosen.spec, options, index))
  }

  return {
    questions,
    count: questions.length,
    targets: targets.map((t) => ({
      unitId: t.unit.unitId,
      kpId: t.kp.kpId,
      kpName: t.kp.kpName,
    })),
  }
}

export function supportedLevels(unitId: string, type: CalcType): Level[] {
  const unit = findUnit(unitId)
  if (!unit) return []
  const levels = new Set<Level>()
  for (const kp of unit.kps) {
    for (const level of ['L1', 'L2', 'L3'] as Level[]) {
      if (asSpecs(kp.rules[type]?.[level]).length > 0) levels.add(level)
    }
  }
  return [...levels].sort()
}
