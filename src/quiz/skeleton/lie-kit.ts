/**
 * 列式骨架的数据结构（与 skeleton 包同一套思路：句式 + 变量域 + 自检）。
 *
 * 与旧模板的差别：反解自检随骨架自带，不依赖外部模板表。
 * 题干由 parts 渲染；parts 里每个槽位只出现一次，反解时按出现顺序抽回数字，
 * 再由 shape 重建 AST，用于「从题干反解出的结构必须与生成 AST 一致」。
 */
import type { Level } from '../types.ts'
import { randInt, type Rng } from '../rng.ts'

export type LieSlotRole = 'add' | 'paren' | 'tiny' | 'factor' | 'mul' | 'small' | 'minuend'

/** 数值域按档收紧；一位数乘除为主，两位数乘一位数只用在不超纲的写法里 */
export const LIE_ROLE_RANGES: Record<Level, Record<LieSlotRole, [number, number]>> = {
  L1: { add: [2, 20], paren: [2, 8], tiny: [2, 4], factor: [2, 9], mul: [2, 9], small: [2, 4], minuend: [20, 60] },
  L2: { add: [5, 30], paren: [5, 20], tiny: [5, 12], factor: [3, 20], mul: [2, 9], small: [2, 6], minuend: [40, 90] },
  L3: { add: [10, 60], paren: [10, 40], tiny: [10, 25], factor: [10, 40], mul: [2, 9], small: [2, 7], minuend: [60, 150] },
}

export type LiePart = string | { slot: string }

export interface LieSkeletonDef {
  /** 句式 ID，同卷跨卷去重都以它为准 */
  id: string
  label: string
  shape: string
  parts: LiePart[]
  /** 槽位名 → 数值角色 */
  roles: Record<string, LieSlotRole>
  /** 额外的数域约束（减法不得为负等）；数值语义仍由生成器统一复核 */
  guard?: (p: Record<string, number>) => boolean
}

export interface LieSkeleton extends LieSkeletonDef {
  unitId: string
  level: Level
  slots: Record<string, { min: number; max: number }>
  /** 题干自检：从题面反解槽位数值，失败返回 null */
  reverse: (stem: string) => Record<string, number> | null
  draw: (rng: Rng) => Record<string, number> | null
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalize = (text: string): string => text.replace(/\s+/g, '')

export function renderLieSkeleton(skeleton: LieSkeleton, params: Record<string, number>): string {
  return skeleton.parts
    .map((part) => (typeof part === 'string' ? part : String(params[(part as { slot: string }).slot])))
    .join('')
}

function makeReverse(parts: LiePart[]): (stem: string) => Record<string, number> | null {
  const names = parts
    .filter((part): part is { slot: string } => typeof part !== 'string')
    .map((part) => part.slot)
  const pattern = parts
    .map((part) => (typeof part === 'string' ? escapeRegExp(normalize(part)) : '(\\d+)'))
    .join('')
  const regexp = new RegExp(`^${pattern}$`)
  return (stem) => {
    const match = normalize(stem).match(regexp)
    if (!match) return null
    const params: Record<string, number> = {}
    for (const [index, name] of names.entries()) {
      params[name] = Number(match[index + 1])
    }
    return params
  }
}

function makeDraw(def: LieSkeletonDef, level: Level, slots: LieSkeleton['slots']) {
  return (rng: Rng): Record<string, number> | null => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const params: Record<string, number> = {}
      for (const [name, role] of Object.entries(def.roles)) {
        const [min, max] = LIE_ROLE_RANGES[level][role]
        params[name] = randInt(rng, min, max)
      }
      // roles 与 slots 写漏时直接报错，避免静默出题
      if (Object.keys(slots).some((name) => typeof params[name] !== 'number')) return null
      if (def.guard && !def.guard(params)) continue
      return params
    }
    return null
  }
}

export interface LieSkeletonPackage {
  id: string
  unitId: string
  unitName: string
  type: 'lieshi'
  skeletons: LieSkeleton[]
}

export function buildLieSkeletonPackage(input: {
  id: string
  unitId: string
  unitName: string
  defs: LieSkeletonDef[]
  levels?: Level[]
}): LieSkeletonPackage {
  const levels = input.levels ?? (['L1', 'L2', 'L3'] as Level[])
  const skeletons: LieSkeleton[] = []
  for (const level of levels) {
    for (const def of input.defs) {
      const slots: LieSkeleton['slots'] = {}
      for (const [name, role] of Object.entries(def.roles)) {
        const [min, max] = LIE_ROLE_RANGES[level][role]
        slots[name] = { min, max }
      }
      skeletons.push({
        ...def,
        id: `${def.id}-${level}`,
        unitId: input.unitId,
        level,
        slots,
        reverse: makeReverse(def.parts),
        draw: makeDraw(def, level, slots),
      })
    }
  }
  return { id: input.id, unitId: input.unitId, unitName: input.unitName, type: 'lieshi', skeletons }
}
