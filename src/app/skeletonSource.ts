/**
 * 骨架包 → 应用出卷的映射层。
 *
 * 三年级上册的填空/应用题优先走 `src/quiz/skeleton/` 的包；
 * 只有该「单元 + 题型 + 难度」没有骨架组合时，才由调用方回退到旧生成器。
 */
import type { Level } from '../quiz/types.ts'
import { PACKAGES, getCombo } from '../quiz/skeleton/registry.ts'
import type { Combo } from '../quiz/skeleton/types.ts'

export type GeneratedType = 'tiankong' | 'word'

const LEVELS: Level[] = ['L1', 'L2', 'L3']

export interface SkeletonUnit {
  unitId: string
  unitName: string
}

/** 三上可出填空/应用题的 8 个单元（U3 只有静态图形题，未建包） */
export function skeletonUnits(grade: '3A' | '3B' = '3A'): SkeletonUnit[] {
  const seen = new Set<string>()
  const units: SkeletonUnit[] = []
  for (const pkg of PACKAGES) {
    if (pkg.grade !== grade || seen.has(pkg.unitId)) continue
    seen.add(pkg.unitId)
    units.push({ unitId: pkg.unitId, unitName: pkg.unitName })
  }
  return units
}

export function hasSkeletonPackage(unitId: string, type: GeneratedType): boolean {
  return PACKAGES.some((pkg) => pkg.unitId === unitId && pkg.type === type)
}

/** 单元 + 题型 + 难度 → 骨架组合；没有返回 null（调用方据此决定是否兜底） */
export function skeletonCombo(
  unitId: string,
  type: GeneratedType,
  level: Level,
): Combo | null {
  if (!hasSkeletonPackage(unitId, type)) return null
  try {
    return getCombo(`${unitId}|${type}|${level}`)
  } catch {
    return null
  }
}

export function skeletonLevels(unitId: string, type: GeneratedType): Level[] {
  if (!hasSkeletonPackage(unitId, type)) return []
  return LEVELS.filter((level) => skeletonCombo(unitId, type, level) != null)
}
