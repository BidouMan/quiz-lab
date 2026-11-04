import { CURRICULUM, findUnit } from '../data/curriculum.ts'
import type {
  CalcType,
  FillQuestion,
  GeneratedQuestion,
  Level,
  Unit,
  WordQuestion,
} from '../quiz/types.ts'
import type { MemoryStore } from '../quiz/memory.ts'
import { generate } from '../quiz/generate.ts'
import { fillLevelsFor, fillSupports, generateFill } from '../quiz/fill.ts'
import { generateWord, wordLevelsFor, wordSupports } from '../quiz/word.ts'
import {
  buildComboPaper,
  createUsedSets,
  rebuildQuestion,
  releaseQuestion,
  toPilotItem,
  type UsedSets,
} from '../quiz/skeleton/index.ts'
import type { Combo, PilotQuestion } from '../quiz/skeleton/types.ts'
import {
  admitWithRetry,
  emptyRuntimeCheck,
  recordCheck,
  verifyCalcQuestion,
  verifyItemStructure,
  verifySkeletonQuestion,
} from './runtimeCheck.ts'
import { skeletonCombo, skeletonLevels, skeletonUnits, type GeneratedType } from './skeletonSource.ts'
import { latexToTypst } from '../quiz/typst.ts'
import {
  CALC_TYPES,
  splitFill,
  STATIC_SAMPLES,
  typeLabel,
  TYPE_ORDER,
} from './typstData.ts'
import type {
  AppConfig,
  AppType,
  BuildResult,
  BuildStats,
  Grade,
  TemplateInfo,
  TypstItem,
  TypstSection,
} from './types'

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

const WEIGHTS: Record<AppType, number> = {
  kousuan: 0.35,
  chushi: 0.2,
  tuoshi: 0.2,
  jianbian: 0.15,
  tiankong: 0.18,
  compare: 0.04,
  geom: 0.03,
  word: 0.12,
}

const LEVELS: Level[] = ['L1', 'L2', 'L3']

/**
 * 教材里不存在的单元×题型，明确标为不适用，不再用旧题库兜底。
 * 依据见 PROGRESS.md「0.4.0 第二项」与 docs/题目质量评审-v0.3.0.md 的 P1-A1。
 */
const NOT_APPLICABLE_CALC: Record<string, Partial<Record<CalcType, string>>> = {
  '3A-U2': {
    jianbian: '教材未单列简便运算，结合律、分配律属四年级内容（P1-A1 评审结论）',
  },
  '3A-U5': {
    tuoshi: '本单元是年月日认识与经过时间，教材不设脱式；时间计算由填空/应用题承载',
  },
  '3A-U7': {
    kousuan: '“马拉松路线设计”是项目式学习单元，教材不设口算',
    tuoshi: '项目式学习单元，教材不设脱式；路线长度由填空承载',
  },
  '3A-U8': {
    kousuan: '数学广场是活动与图形玩法单元，教材不设口算',
    tuoshi: '活动单元，教材不设脱式；图形玩法由填空/应用题承载',
  },
  '3B-U4': {
    kousuan: '本版未建分数口算规则，可出的分数题不足一页，按不适用处理',
  },
}

export interface Availability {
  enabled: boolean
  reason: string
  /** 题目来源：骨架包 / 规则库 / 旧生成器 / 静态题库 / 教材不适用；界面据此标明而不是静默混用 */
  source?: 'skeleton' | 'rule' | 'legacy' | 'static' | 'na'
}

export function isCalcType(type: AppType): type is CalcType {
  return CALC_TYPES.some((calc) => calc === type)
}

export function unitsForGrade(grade: Grade): Unit[] {
  return CURRICULUM.units.filter((unit) => unit.grade === grade)
}

/** 参数面板只列三上已建骨架包的 8 个单元（U3 暂无填空/应用题包，不进入列表） */
export function panelUnits(): Unit[] {
  const ids = new Set(skeletonUnits('3A').map((unit) => unit.unitId))
  return unitsForGrade('3A').filter((unit) => ids.has(unit.unitId))
}

/** 有任意计算类规则的第一个单元，作为年级默认选中项 */
export function defaultUnitIds(grade: Grade): string[] {
  const units = unitsForGrade(grade)
  const withRules = units.find((unit) =>
    unit.kps.some((kp) => CALC_TYPES.some((type) => anyLevelRules(kp, type))),
  )
  return withRules ? [withRules.unitId] : units.slice(0, 1).map((unit) => unit.unitId)
}

function anyLevelRules(kp: Unit['kps'][number], type: CalcType): boolean {
  return LEVELS.some((level) => {
    const spec = kp.rules[type]?.[level]
    return spec != null && (Array.isArray(spec) ? spec.length > 0 : true)
  })
}

export function unitSupports(unitId: string, type: CalcType, level: Level): boolean {
  const unit = findUnit(unitId)
  if (!unit) return false
  return unit.kps.some((kp) => {
    const spec = kp.rules[type]?.[level]
    return spec != null && (Array.isArray(spec) ? spec.length > 0 : true)
  })
}

export function levelsFor(unitIds: string[], type: CalcType): Level[] {
  return LEVELS.filter((level) => unitIds.some((unitId) => unitSupports(unitId, type, level)))
}

function selectedUnits(config: AppConfig): Unit[] {
  return config.unitIds
    .map((unitId) => findUnit(unitId))
    .filter((unit): unit is Unit => unit != null && unit.grade === config.grade)
}

/** 题型可用性：不能生成时给出可读原因，界面直接展示 */
export function typeAvailability(
  config: AppConfig,
  template: TemplateInfo | null,
): Record<AppType, Availability> {
  const units = selectedUnits(config)
  const result = {} as Record<AppType, Availability>

  for (const type of TYPE_ORDER) {
    const label = typeLabel(type)

    if (isCalcType(type)) {
      if (units.length === 0) {
        result[type] = { enabled: false, reason: '请先选择单元' }
        continue
      }
      const supporting = units.filter((unit) => unitSupports(unit.unitId, type, config.level))
      if (supporting.length > 0) {
        result[type] = { enabled: true, reason: '', source: 'rule' }
        continue
      }
      const naReasons = units
        .map((unit) => NOT_APPLICABLE_CALC[unit.unitId]?.[type])
        .filter((reason): reason is string => reason != null)
      if (naReasons.length > 0) {
        result[type] = {
          enabled: false,
          reason: `不适用：${[...new Set(naReasons)].join('；')}`,
          source: 'na',
        }
        continue
      }
      const levels = levelsFor(
        units.map((unit) => unit.unitId),
        type,
      )
      if (levels.length > 0) {
        result[type] = {
          enabled: false,
          reason: `所选单元在 ${config.level} 没有${label}规则，可切到 ${levels.join('/')}`,
        }
        continue
      }
      result[type] = { enabled: false, reason: `所选单元在本版没有${label}生成规则` }
      continue
    }

    if (type === 'tiankong') {
      if (units.length === 0) {
        result[type] = { enabled: false, reason: '请先选择单元' }
        continue
      }
      const bySkeleton = units.filter((unit) => skeletonCombo(unit.unitId, 'tiankong', config.level) != null)
      if (bySkeleton.length > 0) {
        result[type] = { enabled: true, reason: '', source: 'skeleton' }
        continue
      }
      const skeletonLevelsAvailable = units.flatMap((unit) => skeletonLevels(unit.unitId, 'tiankong'))
      if (skeletonLevelsAvailable.length > 0) {
        result[type] = {
          enabled: false,
          reason: `所选单元在 ${config.level} 没有骨架填空题，可切到 ${[...new Set(skeletonLevelsAvailable)].join('/')}`,
        }
        continue
      }
      const supporting = units.filter((unit) => fillSupports(unit.unitId, config.level))
      if (supporting.length > 0) {
        result[type] = {
          enabled: true,
          reason: `所选单元无骨架填空包，使用旧填空生成器（兜底）`,
          source: 'legacy',
        }
        continue
      }
      const levels = units.flatMap((unit) => fillLevelsFor(unit.unitId))
      if (levels.length > 0) {
        result[type] = {
          enabled: false,
          reason: `所选单元在 ${config.level} 没有填空规则，可切到 ${[...new Set(levels)].join('/')}`,
        }
        continue
      }
      result[type] = { enabled: false, reason: '所选单元本版没有填空生成规则' }
      continue
    }

    if (type === 'word') {
      if (template == null) {
        result[type] = { enabled: false, reason: '正在读取模板…' }
        continue
      }
      if (!template.word) {
        result[type] = { enabled: false, reason: '当前排版模板未接入应用题' }
        continue
      }
      if (units.length === 0) {
        result[type] = { enabled: false, reason: '请先选择单元' }
        continue
      }
      const bySkeleton = units.filter((unit) => skeletonCombo(unit.unitId, 'word', config.level) != null)
      if (bySkeleton.length > 0) {
        result[type] = { enabled: true, reason: '', source: 'skeleton' }
        continue
      }
      const skeletonLevelsAvailable = units.flatMap((unit) => skeletonLevels(unit.unitId, 'word'))
      if (skeletonLevelsAvailable.length > 0) {
        result[type] = {
          enabled: false,
          reason: `所选单元在 ${config.level} 没有骨架应用题，可切到 ${[...new Set(skeletonLevelsAvailable)].join('/')}`,
        }
        continue
      }
      const supporting = units.filter((unit) => wordSupports(unit.unitId, config.level))
      if (supporting.length > 0) {
        result[type] = {
          enabled: true,
          reason: `所选单元无骨架应用题包，使用旧应用题生成器（兜底）`,
          source: 'legacy',
        }
        continue
      }
      const levels = units.flatMap((unit) => wordLevelsFor(unit.unitId))
      if (levels.length > 0) {
        result[type] = {
          enabled: false,
          reason: `所选单元在 ${config.level} 没有应用题规则，可切到 ${[...new Set(levels)].join('/')}`,
        }
        continue
      }
      result[type] = { enabled: false, reason: '所选单元本版没有应用题生成规则' }
      continue
    }

    const templateFlag =
      type === 'compare'
        ? template?.compare
        : type === 'geom'
          ? template?.geom
          : template?.word
    result[type] =
      template == null
        ? { enabled: false, reason: '正在读取模板…' }
        : templateFlag
          ? { enabled: true, reason: '静态示例题，非生成器', source: 'static' }
          : { enabled: false, reason: '当前排版模板未接入此题型' }
  }

  return result
}

// ---------- 配额 ----------

function allocate(count: number, types: AppType[]): Map<AppType, number> {
  const quotas = new Map<AppType, number>()
  for (const type of types) quotas.set(type, 0)
  if (types.length === 0) return quotas

  let remaining = count
  if (count >= types.length) {
    for (const type of types) {
      quotas.set(type, 1)
      remaining--
    }
  }

  const totalWeight = types.reduce((sum, type) => sum + WEIGHTS[type], 0)
  const shares = types.map((type) => ({ type, exact: (remaining * WEIGHTS[type]) / totalWeight }))
  for (const share of shares) {
    const n = Math.floor(share.exact)
    quotas.set(share.type, (quotas.get(share.type) ?? 0) + n)
    remaining -= n
  }
  const byRemainder = [...shares].sort(
    (a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)),
  )
  let cursor = 0
  while (remaining > 0 && byRemainder.length > 0) {
    const share = byRemainder[cursor % byRemainder.length]
    quotas.set(share.type, (quotas.get(share.type) ?? 0) + 1)
    remaining--
    cursor++
  }
  return quotas
}

/**
 * 2 页内的默认题量（按题型与难度动态估算）。
 * 实测 A4 compact=1、body=14：填空单题 ≈29pt；应用题 L1≈90pt、L2≈155pt、L3≈230pt；
 * 每页正文 ≈738pt，2 页约 1476pt。L3 混合 16 题约需 1850pt，会排到第 3 页，故默认 12。
 */
const MIXED_COUNT: Record<Level, number> = { L1: 20, L2: 16, L3: 12 }

export function recommendedCount(config: AppConfig, pages = 2): number {
  const types = TYPE_ORDER.filter(
    (type) => config.types.includes(type) && (type === 'tiankong' || type === 'word'),
  )
  if (types.length === 0) return config.count
  if (pages <= 1) {
    if (types.length === 1 && types[0] === 'tiankong') return 16
    if (types.length === 1) return 4
    return Math.max(6, Math.floor(MIXED_COUNT[config.level] / 2))
  }
  if (types.length === 1 && types[0] === 'tiankong') return 30
  if (types.length === 1) return config.level === 'L3' ? 6 : 8
  return MIXED_COUNT[config.level]
}

/** 某题型在当前单元下的容量上限（有生成器视为无限，没有生成器则为 0） */
function capacityOf(type: AppType, config: AppConfig): number {
  const unitIds = selectedUnits(config).map((unit) => unit.unitId)
  if (isCalcType(type)) {
    const supporting = unitIds.filter((unitId) => unitSupports(unitId, type, config.level))
    if (supporting.length > 0) return Number.POSITIVE_INFINITY
    return 0
  }
  if (type === 'tiankong') {
    const unitIds = selectedUnits(config).map((unit) => unit.unitId)
    if (unitIds.some((unitId) => skeletonCombo(unitId, 'tiankong', config.level) != null)) {
      return Number.POSITIVE_INFINITY
    }
    const supporting = unitIds.filter((unitId) => fillSupports(unitId, config.level))
    if (supporting.length > 0) return Number.POSITIVE_INFINITY
    return 0
  }
  if (type === 'word') {
    const unitIds = selectedUnits(config).map((unit) => unit.unitId)
    if (unitIds.some((unitId) => skeletonCombo(unitId, 'word', config.level) != null)) {
      return Number.POSITIVE_INFINITY
    }
    const supporting = unitIds.filter((unitId) => wordSupports(unitId, config.level))
    return supporting.length > 0 ? Number.POSITIVE_INFINITY : 0
  }
  return (STATIC_SAMPLES[type] ?? []).length
}

/** 把兜底题型的超额配额让给还能继续出题的题型，避免“明明能出却题量不足” */
function capQuotas(quotas: Map<AppType, number>, active: AppType[], config: AppConfig): void {
  let total = 0
  for (const type of active) {
    const capped = Math.min(quotas.get(type) ?? 0, capacityOf(type, config))
    quotas.set(type, capped)
    total += capped
  }

  let remaining = Math.max(0, Math.round(config.count) - total)
  let guard = 0
  while (remaining > 0 && guard < 200) {
    let progressed = false
    for (const type of active) {
      const current = quotas.get(type) ?? 0
      if (current >= capacityOf(type, config)) continue
      quotas.set(type, current + 1)
      remaining--
      progressed = true
      if (remaining === 0) break
    }
    guard++
    if (!progressed) break
  }
}

function splitQuota(total: number, parts: number): number[] {
  if (parts <= 0) return []
  const base = Math.floor(total / parts)
  const extra = total % parts
  return Array.from({ length: parts }, (_, index) => base + (index < extra ? 1 : 0))
}

// ---------- 题目转换 ----------

const itemKey = (item: TypstItem): string => {
  if (item.kind === 'fill') {
    const text = (item.parts ?? [])
      .map((part) => ('t' in part ? part.t : 'm' in part ? part.m : '_'))
      .join('')
    return `fill:${text.replace(/\s+/g, '')}`
  }
  if (item.kind === 'word') return `word:${(item.text ?? '').replace(/\s+/g, '')}`
  return `expr:${(item.expr ?? '').replace(/\s+/g, '')}`
}

function fillQuestionToItem(question: FillQuestion): TypstItem {
  return {
    id: question.id,
    kind: 'fill',
    parts: splitFill(question.stem, question.answers),
    answers: question.answers,
    solution: [question.answer],
  }
}

function wordQuestionToItem(question: WordQuestion): TypstItem {
  return {
    id: question.id,
    kind: 'word',
    text: question.stem,
    workLines: question.workLines,
    answers: question.answers,
    solution: question.answer.split('\n'),
  }
}

function questionToItem(question: GeneratedQuestion): TypstItem {
  const expr = latexToTypst(question.latex)
  if (question.type === 'kousuan') {
    return { id: question.id, kind: 'kousuan', expr, display: false }
  }
  if (question.type === 'chushi') {
    return { id: question.id, kind: 'chushi', expr, display: false, blank: 30 }
  }
  // 脱式与简便运算共用 tuoshi 渲染块（模板按 item.kind 渲染，节 kind 只影响标题）
  return { id: question.id, kind: 'tuoshi', expr, display: false, lines: 3 }
}

interface TypeBuild {
  items: TypstItem[]
  /** 骨架包出题数 */
  skeleton: number
  /** 其中骨架复用题数（题量超过骨架数时同骨架换场景/数字） */
  reused: number
  /** 旧生成器出题数 */
  legacy: number
  generated: number
  duplicates: number
  kpNames: string[]
  notes: string[]
  /** 本次生成的运行时复核结果 */
  check: BuildStats['runtimeCheck']
}

function emptyBuild(): TypeBuild {
  return {
    items: [],
    skeleton: 0,
    reused: 0,
    legacy: 0,
    generated: 0,
    duplicates: 0,
    kpNames: [],
    notes: [],
    check: emptyRuntimeCheck(),
  }
}

/** 计算类：生成器出题；无规则的单元用旧题库兜底 */
function buildCalcType(
  type: CalcType,
  quota: number,
  config: AppConfig,
  seed: number,
  memory: MemoryStore,
  used: Set<string>,
): TypeBuild {
  const build = emptyBuild()
  if (quota <= 0) return build

  const units = selectedUnits(config)
  const supporting = units.filter((unit) => unitSupports(unit.unitId, type, config.level))

  const add = (item: TypstItem): boolean => {
    const key = itemKey(item)
    if (used.has(key)) {
      build.duplicates++
      return false
    }
    used.add(key)
    build.items.push(item)
    return true
  }

  /** 规则库计算题：生成后独立用 evalLatex 重算；失败有限次重生成，仍失败则剔除 */
  const takeQuestions = (questions: GeneratedQuestion[], unit: Unit, unitSeed: number): void => {
    for (const question of questions) {
      const outcome = admitWithRetry<GeneratedQuestion>({
        initial: question,
        verify: verifyCalcQuestion,
        regenerate: (attempt) => {
          try {
            const retry = generate({
              grade: config.grade,
              unitId: unit.unitId,
              type,
              level: config.level,
              count: 1,
              seed: unitSeed + attempt * 1009,
              memory,
            })
            return retry.questions[0] ?? null
          } catch {
            return null
          }
        },
      })
      recordCheck(build.check, outcome, `${unit.unitName}·${typeLabel(type)}`)
      if (outcome.accepted == null) continue
      const accepted = outcome.accepted
      if (add(questionToItem(accepted))) {
        build.generated++
        if (!build.kpNames.includes(accepted.kpName)) build.kpNames.push(accepted.kpName)
      }
    }
  }

  if (supporting.length > 0) {
    const quotas = splitQuota(quota, supporting.length)
    for (const [index, unit] of supporting.entries()) {
      if (quotas[index] <= 0) continue
      try {
        const result = generate({
          grade: config.grade,
          unitId: unit.unitId,
          type,
          level: config.level,
          count: quotas[index],
          seed: seed + index * 131,
          memory,
        })
        takeQuestions(result.questions, unit, seed + index * 131)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        build.notes.push(`${unit.unitName}：生成失败（${reason}）`)
      }
    }

    // 生成量不足时补采，直到配额或连续无进展
    for (let round = 1; round <= 3 && build.items.length < quota; round++) {
      const before = build.items.length
      const need = quota - before
      const quotas = splitQuota(Math.max(need, supporting.length), supporting.length)
      for (const [index, unit] of supporting.entries()) {
        if (quotas[index] <= 0) continue
        try {
          const result = generate({
            grade: config.grade,
            unitId: unit.unitId,
            type,
            level: config.level,
            count: quotas[index],
            seed: seed + round * 977 + index * 131,
            memory,
          })
          for (const question of result.questions) {
            if (build.items.length >= quota) break
            takeQuestions([question], unit, seed + round * 977 + index * 131)
          }
        } catch {
          // 补采失败不再重复记原因
        }
      }
      if (build.items.length === before) break
    }
  }

  return build
}

interface GeneratedPiece {
  item: TypstItem
  kpName: string
}

/** 骨架题必须同时保留可复核的 PilotQuestion，复核只从参数重算，不回看组装结果 */
interface SkeletonPiece extends GeneratedPiece {
  question: PilotQuestion
  combo: Combo
}

/** 骨架包出题：题量超过单包骨架数时，由 assemble 内部按「同骨架换场景/数字」复用补足，不再截断 */
function skeletonPieces(
  combo: Combo,
  count: number,
  seed: number,
  used: UsedSets,
  kpName: string,
): SkeletonPiece[] {
  const paper = buildComboPaper(combo, { count, seed, used })
  const items = paper.data.sections.flatMap((section) => section.items) as TypstItem[]
  return paper.questions.map((question, index) => ({
    item: items[index],
    kpName,
    question,
    combo,
  }))
}

/**
 * 填空/应用题的通用组装：
 * 1. 有骨架包（单元+题型+难度）→ 优先骨架；
 * 2. 骨架不可用而旧生成器支持 → 旧生成器兜底，并在 notes 里标明；
 * 3. 都没有 → 旧题库静态题兜底。
 */
function buildGeneratedType(input: {
  type: GeneratedType
  label: string
  quota: number
  config: AppConfig
  seed: number
  used: Set<string>
  skeletonUsed: UsedSets
  runLegacy: (unit: Unit, count: number, seed: number) => GeneratedPiece[]
}): TypeBuild {
  const { type, label, quota, config, seed, used, skeletonUsed, runLegacy } = input
  const build = emptyBuild()
  if (quota <= 0) return build

  const units = selectedUnits(config)
  const add = (item: TypstItem, source: 'skeleton' | 'legacy', kpName: string): boolean => {
    const key = itemKey(item)
    if (used.has(key)) {
      build.duplicates++
      return false
    }
    used.add(key)
    build.items.push(item)
    if (source === 'skeleton') {
      build.skeleton++
      build.generated++
    } else {
      build.legacy++
      build.generated++
    }
    if (kpName && !build.kpNames.includes(kpName)) build.kpNames.push(kpName)
    return true
  }

  const generative = units.filter(
    (unit) => skeletonCombo(unit.unitId, type, config.level) != null || supportsLegacy(unit.unitId, type, config.level),
  )
  const staticOnly = units.filter(
    (unit) => skeletonCombo(unit.unitId, type, config.level) == null && !supportsLegacy(unit.unitId, type, config.level),
  )

  const takeSkeleton = (unit: Unit, count: number, unitSeed: number): number => {
    const combo = skeletonCombo(unit.unitId, type, config.level)
    if (combo == null) return 0
    try {
      const pieces = skeletonPieces(combo, count, unitSeed, skeletonUsed, `${unit.unitName}·${label}`)
      let added = 0
      let nextIndex = 1000
      for (const piece of pieces) {
        if (build.items.length >= quota) break
        // 骨架题走 verify.ts 的独立求值器；失败先同句式换参数重生成，仍失败则剔除
        const outcome = admitWithRetry<SkeletonPiece>({
          initial: piece,
          verify: (candidate) => verifySkeletonQuestion(candidate.question, candidate.combo),
          regenerate: (attempt) => {
            const question = rebuildQuestion({
              combo,
              skeletonId: piece.question.skeletonId,
              seed: unitSeed + attempt * 1009,
              index: nextIndex++,
              used: skeletonUsed,
            })
            if (!question) return null
            question.reused = piece.question.reused
            return { item: toPilotItem(question, combo), kpName: piece.kpName, question, combo }
          },
          onReject: (candidate) => releaseQuestion(candidate.question, skeletonUsed),
        })
        recordCheck(build.check, outcome, `${unit.unitName}·骨架${label}`)
        if (outcome.accepted == null) continue
        if (add(outcome.accepted.item, 'skeleton', outcome.accepted.kpName)) {
          added++
          if (outcome.accepted.question.reused) build.reused++
        }
      }
      return added
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      build.notes.push(`${unit.unitName}：骨架${label}生成失败（${reason}）`)
      return 0
    }
  }

  const takeLegacy = (unit: Unit, count: number, unitSeed: number): number => {
    try {
      const pieces = runLegacy(unit, count, unitSeed)
      let added = 0
      for (const piece of pieces) {
        if (build.items.length >= quota) break
        // 旧生成器的兜底题至少做结构 + 答案非空校验；失败换种子重生成，仍失败则剔除
        const outcome = admitWithRetry<GeneratedPiece>({
          initial: piece,
          verify: (candidate) => verifyItemStructure(candidate.item),
          regenerate: (attempt) => {
            try {
              return runLegacy(unit, 1, unitSeed + attempt * 1009)[0] ?? null
            } catch {
              return null
            }
          },
        })
        recordCheck(build.check, outcome, `${unit.unitName}·旧${label}生成器`)
        if (outcome.accepted == null) continue
        if (add(outcome.accepted.item, 'legacy', outcome.accepted.kpName)) added++
      }
      return added
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      build.notes.push(`${unit.unitName}：旧${label}生成器失败（${reason}）`)
      return 0
    }
  }

  if (generative.length > 0) {
    const quotas = splitQuota(quota, generative.length)
    for (const [index, unit] of generative.entries()) {
      if (quotas[index] <= 0) continue
      const unitSeed = seed + index * 131
      const hasSkeleton = skeletonCombo(unit.unitId, type, config.level) != null
      let added = 0
      if (hasSkeleton) added = takeSkeleton(unit, quotas[index], unitSeed)
      if (added === 0 && supportsLegacy(unit.unitId, type, config.level)) {
        added = takeLegacy(unit, quotas[index], unitSeed)
        if (added > 0) {
          const why = hasSkeleton ? '骨架不可用' : '无骨架包'
          build.notes.push(`${unit.unitName}：${why}，旧${label}生成器兜底 ${added} 题`)
        }
      }
    }

    for (let round = 1; round <= 3 && build.items.length < quota; round++) {
      const before = build.items.length
      const quotas = splitQuota(Math.max(quota - before, generative.length), generative.length)
      for (const [index, unit] of generative.entries()) {
        if (quotas[index] <= 0) continue
        if (!supportsLegacy(unit.unitId, type, config.level)) continue
        takeLegacy(unit, quotas[index], seed + round * 977 + index * 131)
      }
      if (build.items.length === before) break
    }
  }

  for (const unit of staticOnly) {
    if (!build.notes.some((note) => note.startsWith(unit.unitName))) {
      build.notes.push(`${unit.unitName}：本版没有${label}生成规则`)
    }
  }

  return build
}

function supportsLegacy(unitId: string, type: GeneratedType, level: Level): boolean {
  return type === 'tiankong' ? fillSupports(unitId, level) : type === 'word' ? wordSupports(unitId, level) : false
}

function buildFillType(
  quota: number,
  config: AppConfig,
  seed: number,
  memory: MemoryStore,
  used: Set<string>,
  skeletonUsed: UsedSets,
): TypeBuild {
  return buildGeneratedType({
    type: 'tiankong',
    label: '填空',
    quota,
    config,
    seed,
    used,
    skeletonUsed,
    runLegacy: (unit, count, unitSeed) =>
      generateFill({
        grade: config.grade,
        unitId: unit.unitId,
        level: config.level,
        count,
        seed: unitSeed,
        memory,
      }).questions.map((question) => ({ item: fillQuestionToItem(question), kpName: question.kpName })),
  })
}

function buildWordType(
  quota: number,
  config: AppConfig,
  seed: number,
  memory: MemoryStore,
  used: Set<string>,
  skeletonUsed: UsedSets,
): TypeBuild {
  return buildGeneratedType({
    type: 'word',
    label: '应用题',
    quota,
    config,
    seed,
    used,
    skeletonUsed,
    runLegacy: (unit, count, unitSeed) =>
      generateWord({
        grade: config.grade,
        unitId: unit.unitId,
        level: config.level,
        count,
        seed: unitSeed,
        memory,
      }).questions.map((question) => ({ item: wordQuestionToItem(question), kpName: question.kpName })),
  })
}

function buildSampleType(type: AppType, quota: number, used: Set<string>): TypeBuild {
  const build = emptyBuild()
  const pool = STATIC_SAMPLES[type] ?? []
  for (const item of pool) {
    if (build.items.length >= quota) break
    // 静态示例题不是兜底题库：只做结构校验，不合格不出现在卷面
    const outcome = admitWithRetry<TypstItem>({
      initial: item,
      verify: verifyItemStructure,
      regenerate: () => null,
    })
    recordCheck(build.check, outcome, `${typeLabel(type)}·静态示例`)
    if (outcome.accepted == null) continue
    const key = itemKey(outcome.accepted)
    if (used.has(key)) continue
    used.add(key)
    build.items.push(outcome.accepted)
  }
  if (build.items.length > 0) {
    build.notes.push(`${typeLabel(type)}：当前为静态示例题（非生成器）`)
  }
  return build
}

// ---------- 主入口 ----------

export function buildPaper(input: {
  config: AppConfig
  template: TemplateInfo | null
  seed: number
  memory: MemoryStore
}): BuildResult {
  const { config, template, seed, memory } = input
  const requested = Math.min(100, Math.max(1, Math.round(config.count) || 1))
  const availability = typeAvailability(config, template)
  const configured = TYPE_ORDER.filter((type) => config.types.includes(type))
  const active = configured.filter((type) => availability[type].enabled)
  const skipped = configured.filter((type) => !availability[type].enabled)

  memory.beginPaper()

  const used = new Set<string>()
  const skeletonUsed = createUsedSets()
  const quotas = allocate(requested, active)
  capQuotas(quotas, active, config)
  const builds = new Map<AppType, TypeBuild>()

  for (const type of active) {
    const quota = quotas.get(type) ?? 0
    if (isCalcType(type)) {
      builds.set(type, buildCalcType(type, quota, config, seed, memory, used))
    } else if (type === 'tiankong') {
      builds.set(type, buildFillType(quota, config, seed, memory, used, skeletonUsed))
    } else if (type === 'word') {
      builds.set(type, buildWordType(quota, config, seed, memory, used, skeletonUsed))
    } else {
      builds.set(type, buildSampleType(type, quota, used))
    }
  }

  const sections: TypstSection[] = []
  for (const type of TYPE_ORDER) {
    const build = builds.get(type)
    if (!build || build.items.length === 0) continue
    const numbered = !isCalcType(type)
    sections.push({
      title: `${CN_NUM[sections.length] ?? '?'}、${typeLabel(type)}`,
      kind: type,
      numbered,
      items: build.items,
    })
  }

  const stats: BuildStats = {
    requested,
    generated: 0,
    skeleton: 0,
    reused: 0,
    legacy: 0,
    duplicates: 0,
    kpNames: [],
    unitNames: [],
    runtimeCheck: emptyRuntimeCheck(),
  }
  const notes: string[] = []
  const check = stats.runtimeCheck
  for (const build of builds.values()) {
    stats.generated += build.generated
    stats.skeleton += build.skeleton
    stats.reused += build.reused
    stats.legacy += build.legacy
    stats.duplicates += build.duplicates
    check.checked += build.check.checked
    check.failed += build.check.failed
    check.dropped += build.check.dropped
    check.regenerated += build.check.regenerated
    for (const detail of build.check.details) {
      if (check.details.length < 20 && !check.details.includes(detail)) check.details.push(detail)
    }
    for (const name of build.kpNames) {
      if (!stats.kpNames.includes(name)) stats.kpNames.push(name)
    }
    for (const note of build.notes) {
      if (!notes.includes(note)) notes.push(note)
    }
  }
  if (check.dropped > 0) {
    notes.push(
      `运行时复核：复核 ${check.checked} 题，失败 ${check.failed} 题，剔除 ${check.dropped} 题（${check.details.join('；')}）`,
    )
  }

  for (const type of skipped) {
    const reason = availability[type].reason
    notes.push(`${typeLabel(type)}：${reason}`)
  }

  const count = sections.reduce((sum, section) => sum + section.items.length, 0)
  if (stats.reused > 0) {
    notes.push(`本卷 ${count} 题，其中 ${stats.reused} 题为骨架复用（同骨架换场景/数字）`)
  }
  const units = selectedUnits(config)
  stats.unitNames = units.map((unit) => unit.unitName)

  const singleUnit = units.length === 1 ? units[0].unitName : ''
  const singleType = active.length === 1 ? typeLabel(active[0]) : ''
  // 页眉居中标题与“（续）”标记同排，标题过长会在第 2 页重叠，保持简短
  const title =
    singleUnit && singleType
      ? `三年级数学 · ${singleUnit} · ${singleType}`
      : singleUnit
        ? `三年级数学 · ${singleUnit} · 练习`
        : `三年级数学 · ${config.grade === '3A' ? '三上' : '三下'}练习`

  return {
    data: { title, sections },
    count,
    shortage: count < requested,
    skipped,
    notes,
    stats,
  }
}
