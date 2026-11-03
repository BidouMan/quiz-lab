import { CURRICULUM, findUnit } from '../data/curriculum.ts'
import type { CalcType, GeneratedQuestion, Level, Unit } from '../quiz/types.ts'
import type { MemoryStore } from '../quiz/memory.ts'
import { generate } from '../quiz/generate.ts'
import { latexToTypst } from '../quiz/typst.ts'
import {
  CALC_TYPES,
  STATIC_SAMPLES,
  staticCountFor,
  staticItemsFor,
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
  tiankong: 0.15,
  compare: 0.04,
  geom: 0.03,
  word: 0.03,
}

const LEVELS: Level[] = ['L1', 'L2', 'L3']

export interface Availability {
  enabled: boolean
  reason: string
}

export function isCalcType(type: AppType): type is CalcType {
  return CALC_TYPES.some((calc) => calc === type)
}

export function unitsForGrade(grade: Grade): Unit[] {
  return CURRICULUM.units.filter((unit) => unit.grade === grade)
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
        result[type] = { enabled: true, reason: '' }
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
      const fallback = staticCountFor(
        config.grade,
        units.map((unit) => unit.unitId),
        type,
      )
      result[type] =
        fallback > 0
          ? { enabled: true, reason: `无生成规则，旧题库可兜底 ${fallback} 题` }
          : { enabled: false, reason: `所选单元在本版没有${label}生成规则` }
      continue
    }

    if (type === 'tiankong') {
      const fallback = staticCountFor(
        config.grade,
        units.map((unit) => unit.unitId),
        type,
      )
      result[type] =
        units.length === 0
          ? { enabled: false, reason: '请先选择单元' }
          : fallback > 0
            ? { enabled: true, reason: `本版不生成填空，旧题库兜底 ${fallback} 题` }
            : { enabled: false, reason: '本版只做计算类，填空属 0.3.0' }
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
          ? { enabled: true, reason: '静态示例题，非生成器' }
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

/** 某题型在当前单元下的容量上限（生成器视为无限，兜底题按静态题库数量封顶） */
function capacityOf(type: AppType, config: AppConfig): number {
  const unitIds = selectedUnits(config).map((unit) => unit.unitId)
  if (isCalcType(type)) {
    const supporting = unitIds.filter((unitId) => unitSupports(unitId, type, config.level))
    if (supporting.length > 0) return Number.POSITIVE_INFINITY
    return staticCountFor(config.grade, unitIds, type)
  }
  if (type === 'tiankong') return staticCountFor(config.grade, unitIds, type)
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

const itemKey = (item: TypstItem): string =>
  item.kind === 'fill' ? `fill:${item.id}` : `expr:${(item.expr ?? '').replace(/\s+/g, '')}`

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
  generated: number
  fallback: number
  duplicates: number
  kpNames: string[]
  notes: string[]
}

function emptyBuild(): TypeBuild {
  return { items: [], generated: 0, fallback: 0, duplicates: 0, kpNames: [], notes: [] }
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
  const fallbackUnits = units.filter((unit) => !unitSupports(unit.unitId, type, config.level))

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

  const takeFallback = (limit: number): number => {
    let added = 0
    for (const unit of fallbackUnits) {
      if (added >= limit) break
      const pool = staticItemsFor(config.grade, unit.unitId, type)
      let countFromUnit = 0
      for (const item of pool) {
        if (added >= limit) break
        if (add(item)) {
          added++
          countFromUnit++
        }
      }
      if (countFromUnit > 0) {
        build.fallback += countFromUnit
        build.notes.push(`${unit.unitName}：无生成规则，旧题库兜底 ${countFromUnit} 题`)
      }
    }
    return added
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
        for (const question of result.questions) {
          if (add(questionToItem(question))) {
            build.generated++
            if (!build.kpNames.includes(question.kpName)) build.kpNames.push(question.kpName)
          }
        }
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
            if (add(questionToItem(question))) {
              build.generated++
              if (!build.kpNames.includes(question.kpName)) build.kpNames.push(question.kpName)
            }
          }
        } catch {
          // 补采失败不再重复记原因
        }
      }
      if (build.items.length === before) break
    }
  }

  if (build.items.length < quota && fallbackUnits.length > 0) {
    takeFallback(quota - build.items.length)
  }

  return build
}

/** 旧题库兜底（填空，或整套都没有生成规则时） */
function buildFallbackType(
  type: AppType,
  quota: number,
  config: AppConfig,
  used: Set<string>,
): TypeBuild {
  const build = emptyBuild()
  for (const unit of selectedUnits(config)) {
    if (build.items.length >= quota) break
    const pool = staticItemsFor(config.grade, unit.unitId, type)
    let countFromUnit = 0
    for (const item of pool) {
      if (build.items.length >= quota) break
      const key = itemKey(item)
      if (used.has(key)) {
        build.duplicates++
        continue
      }
      used.add(key)
      build.items.push(item)
      countFromUnit++
    }
    if (countFromUnit > 0) {
      build.fallback += countFromUnit
      build.notes.push(`${unit.unitName}：本版无生成规则，旧题库兜底 ${countFromUnit} 题`)
    }
  }
  return build
}

function buildSampleType(type: AppType, quota: number, used: Set<string>): TypeBuild {
  const build = emptyBuild()
  const pool = STATIC_SAMPLES[type] ?? []
  for (const item of pool) {
    if (build.items.length >= quota) break
    const key = itemKey(item)
    if (used.has(key)) continue
    used.add(key)
    build.items.push(item)
    build.fallback++
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
  const quotas = allocate(requested, active)
  capQuotas(quotas, active, config)
  const builds = new Map<AppType, TypeBuild>()

  for (const type of active) {
    const quota = quotas.get(type) ?? 0
    if (isCalcType(type)) {
      builds.set(type, buildCalcType(type, quota, config, seed, memory, used))
    } else if (type === 'tiankong') {
      builds.set(type, buildFallbackType(type, quota, config, used))
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
    fallback: 0,
    duplicates: 0,
    kpNames: [],
    unitNames: [],
  }
  const notes: string[] = []
  for (const build of builds.values()) {
    stats.generated += build.generated
    stats.fallback += build.fallback
    stats.duplicates += build.duplicates
    for (const name of build.kpNames) {
      if (!stats.kpNames.includes(name)) stats.kpNames.push(name)
    }
    for (const note of build.notes) {
      if (!notes.includes(note)) notes.push(note)
    }
  }

  for (const type of skipped) {
    const reason = availability[type].reason
    notes.push(`${typeLabel(type)}：${reason}`)
  }

  const count = sections.reduce((sum, section) => sum + section.items.length, 0)
  const units = selectedUnits(config)
  stats.unitNames = units.map((unit) => unit.unitName)

  const singleUnit = units.length === 1 ? units[0].unitName : ''
  const singleType = active.length === 1 ? typeLabel(active[0]) : ''
  // 页眉居中标题与“（续）”标记同排，标题过长会在第 2 页重叠，保持简短
  const title =
    singleUnit && singleType
      ? `三年级数学 · ${singleUnit} · ${singleType}`
      : `三年级数学 · ${config.grade === '3A' ? '三上' : '三下'}计算练习`

  return {
    data: { title, sections },
    count,
    shortage: count < requested,
    skipped,
    notes,
    stats,
  }
}
