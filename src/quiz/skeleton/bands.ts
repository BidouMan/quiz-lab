/**
 * 三档（L1/L2/L3）解析与写档工具。
 *
 * 包模型下一条骨架只写一句句式，三档复用；`bands` 里按档给出数值域，
 * 必要时覆盖 guard / asks / formulas（用来加减步数）。
 */
import type { Level } from '../types.ts'
import type { Skeleton, SkeletonBand, SlotSpec } from './types.ts'

/** 写档速记：R(min, max, step?, lt?, gt?) */
export function R(min: number, max: number, step?: number, lt?: string, gt?: string): SlotSpec {
  const spec: SlotSpec = { min, max }
  if (step != null) spec.step = step
  if (lt) spec.lt = lt
  if (gt) spec.gt = gt
  return spec
}

/** 写档速记：band(slots, 可选覆盖项) */
export function band(slots: Record<string, SlotSpec>, extra?: Omit<SkeletonBand, 'slots'>): SkeletonBand {
  return { slots, ...extra }
}

/** 按 level 取出实际生效的骨架；缺档时返回原骨架（基线档） */
export function resolveSkeleton(skeleton: Skeleton, level: Level): Skeleton {
  const item = skeleton.bands?.[level]
  if (!item) return skeleton
  return {
    ...skeleton,
    template: item.template ?? skeleton.template,
    slots: item.slots,
    guard: item.guard ?? skeleton.guard,
    asks: item.asks ?? skeleton.asks,
    formulas: item.formulas ?? skeleton.formulas,
    askModes: item.askModes ?? skeleton.askModes,
    remainderUnit: item.remainderUnit ?? skeleton.remainderUnit,
    workLines: item.workLines ?? skeleton.workLines,
    unit: item.unit ?? skeleton.unit,
    answerUnits: item.answerUnits ?? skeleton.answerUnits,
    answerChoices: item.answerChoices ?? skeleton.answerChoices,
    figure: item.figure ?? skeleton.figure,
    sceneUnit: item.sceneUnit ?? skeleton.sceneUnit,
    sceneTags: item.sceneTags ?? skeleton.sceneTags,
  }
}

/** 给一组骨架挂上按 id 组织的三档数据；缺数据的骨架保持原样 */
export function attachBands(
  skeletons: Skeleton[],
  bands: Record<string, Partial<Record<Level, SkeletonBand>>>,
): Skeleton[] {
  return skeletons.map((skeleton) => {
    const item = bands[skeleton.id]
    return item ? { ...skeleton, bands: item } : skeleton
  })
}
