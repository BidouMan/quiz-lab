import { createRng, randInt, type Rng } from './rng.ts'
import type { MemoryStore } from './memory.ts'
import { shortHash, stableStringify } from './normalize.ts'
import { renderRayScene, renderSegmentScene, type RayCellModel, type RaySpec } from './figure.ts'
import type { FigureSpec } from './skeleton/types.ts'
import type { Grade, Level } from './types.ts'

/**
 * 「角与图形计数」规则生成器（沪教版 2024 修订·五·四学制 三上 U3「三角形与四边形」）。
 *
 * 与 FigureKit 的边界一致：figure.ts 只负责画射线/弧线/直角符号/线段，
 * 本文件负责题面、答案与复核参数；答案的计算与独立重算都留在题型层。
 */
export type AngleForm = 'point-angles' | 'classify-angles' | 'add-line-angles'
export type CountForm = 'count-triangles' | 'count-rectangles'
export type AnyAngleForm = AngleForm | CountForm

export interface AnglePiece {
  text: string
  fig: FigureSpec
  blank: number
  /** 答案：点角类为数字，辨认类为「直角，锐角，钝角」计数串 */
  answer: string
  form: AnyAngleForm
  params: Record<string, number | string>
  kpName: string
}

export interface AngleOptions {
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed: number
  memory?: MemoryStore
}

/** 「角的初步认识」挂三上 U3；三下与 3B 无角单元，不出题 */
export function angleSupported(grade: Grade, unitIds: string[]): boolean {
  return grade === '3A' && unitIds.includes('3A-U3')
}

export function angleUnitsSupported(grade: Grade, unitIds: string[]): boolean {
  return angleSupported(grade, unitIds)
}

const FORMS_BY_LEVEL: Record<Level, AngleForm[]> = {
  L1: ['point-angles', 'classify-angles', 'add-line-angles'],
  L2: ['point-angles', 'classify-angles', 'add-line-angles'],
  L3: ['point-angles', 'classify-angles', 'add-line-angles'],
}

export function angleUnitForms(unitId: string, level: Level): AngleForm[] {
  if (unitId !== '3A-U3') return []
  return FORMS_BY_LEVEL[level]
}

const KP: Record<AnyAngleForm, string> = {
  'point-angles': '数角（一点引出 n 条射线）',
  'classify-angles': '直角、锐角、钝角的辨认与计数',
  'add-line-angles': '添线后数角',
  'count-triangles': '数三角形',
  'count-rectangles': '数长方形',
}

const round1 = (value: number): number => Math.round(value * 10) / 10

const ACUTE_DEGREES = [35, 40, 45, 50, 55, 60, 65, 70, 75]
const OBTUSE_DEGREES = [100, 105, 110, 120, 130]

type AngleKind = 'acute' | 'right' | 'obtuse'

const pick = <T,>(rng: Rng, list: readonly T[]): T => list[randInt(rng, 0, list.length - 1)]!

const angleKindOf = (degree: number): AngleKind =>
  degree < 90 ? 'acute' : degree === 90 ? 'right' : 'obtuse'

const degreesFor = (rng: Rng, kind: AngleKind): number => {
  if (kind === 'right') return 90
  return pick(rng, kind === 'acute' ? ACUTE_DEGREES : OBTUSE_DEGREES)
}

/** 一点引出 n 条射线：方向铺满上半平面，任意两条都不共线，答案 C(n,2) */
export function makePointAngles(rng: Rng, level: Level): AnglePiece {
  // 示例档位为 L1 3–4、L2 5–6、L3 7–9；为降低同卷同答案重复，每档放宽一档
  const range: Record<Level, [number, number]> = { L1: [3, 5], L2: [5, 7], L3: [7, 9] }
  const [minN, maxN] = range[level]
  const n = randInt(rng, minN, maxN)
  const start = randInt(rng, 20, 30)
  const end = randInt(rng, 150, 160)
  const step = (end - start) / (n - 1)
  const rays = Array.from({ length: n }, (_, index) => ({
    angle: start + step * index,
    length: 5,
  }))
  const fig = renderRayScene({ cells: [{ origin: [0, 0], rays }] })
  return {
    text: `从一点引出 ${n} 条射线（如图），一共可以数出多少个角？`,
    fig,
    blank: 1,
    answer: String((n * (n - 1)) / 2),
    form: 'point-angles',
    params: { form: 'point-angles', n, start, end },
    kpName: KP['point-angles'],
  }
}

/** 5–6 个互相独立的角，按直角/锐角/钝角分别计数；直角一律画直角符号 */
export function makeClassifyAngles(rng: Rng, level: Level): AnglePiece {
  const total = level === 'L1' ? 4 : level === 'L2' ? 5 : 6
  const kinds: AngleKind[] = ['right', 'acute', 'obtuse']
  while (kinds.length < total) {
    const extra = pick(rng, ['acute', 'acute', 'obtuse', 'right'] as const)
    if (extra === 'right' && kinds.filter((kind) => kind === 'right').length >= 2) continue
    kinds.push(extra)
  }
  // 打乱顺序，避免直角总在第一格
  for (let index = kinds.length - 1; index > 0; index--) {
    const swap = randInt(rng, 0, index)
    const value = kinds[index]!
    kinds[index] = kinds[swap]!
    kinds[swap] = value
  }
  const degrees = kinds.map((kind) => degreesFor(rng, kind))
  const circles = ['①', '②', '③', '④', '⑤', '⑥']

  const columns = total === 4 ? 2 : 3
  const secondRow = total - columns
  const cellGap = 9.5
  const centers = (count: number) =>
    Array.from({ length: count }, (_, index) => 13 + (index - (count - 1) / 2) * cellGap)
  const row1X = centers(columns)
  const row2X = centers(secondRow)

  const cells: RayCellModel[] = degrees.map((degree, index) => {
    const inFirst = index < columns
    const x = inFirst ? row1X[index]! : row2X[index - columns]!
    const y = inFirst ? 4.6 : 11.6
    const half = degree / 2
    const rays = [
      { angle: 90 - half, length: 3.8 },
      { angle: 90 + half, length: 3.8 },
    ]
    const cell: RayCellModel = {
      origin: [round1(x), y],
      rays,
      labels: [{ x: round1(x), y: y + 1.2, text: circles[index]!, anchor: 'center' }],
    }
    if (degree === 90) {
      cell.rightAngles = [{ a: 0, b: 1, size: 1.25 }]
    } else {
      cell.arcs = [{ from: 0, to: 1, radius: 2 }]
    }
    return cell
  })

  const counts = { right: 0, acute: 0, obtuse: 0 }
  for (const degree of degrees) counts[angleKindOf(degree)]++
  const fig = renderRayScene({ cells })
  return {
    text: `图中标出了 ${total} 个角。直角有（ ）个，锐角有（ ）个，钝角有（ ）个。`,
    fig,
    blank: 1,
    answer: `${counts.right}，${counts.acute}，${counts.obtuse}`,
    form: 'classify-angles',
    params: { form: 'classify-angles', angles: degrees.join(','), marks: counts.right },
    kpName: KP['classify-angles'],
  }
}

/** 已有 m 条射线，再添一条（虚线）；新线与每条已有线各成一个角 */
export function makeAddLineAngles(rng: Rng, level: Level): AnglePiece {
  const range: Record<Level, [number, number]> = { L1: [3, 5], L2: [4, 6], L3: [6, 8] }
  const ask: 'added' | 'total' = randInt(rng, 0, 1) === 0 ? 'added' : 'total'
  const [minM, maxM] = range[level]
  const m = randInt(rng, minM, maxM)
  const start = randInt(rng, 22, 28)
  const end = randInt(rng, 152, 158)
  const step = (end - start) / (m - 1)
  const baseAngles = Array.from({ length: m }, (_, index) => round1(start + step * index))
  const gap = randInt(rng, 0, m - 2)
  const addedAngle = round1((baseAngles[gap]! + baseAngles[gap + 1]!) / 2)
  const rays: RaySpec[] = baseAngles.map((angle) => ({ angle, length: 3.2 }))
  rays.push({ angle: addedAngle, length: 3.7, stroke: 'dashed' })
  const tip: [number, number] = [
    round1(Math.cos((addedAngle * Math.PI) / 180) * 4.6),
    round1(-Math.sin((addedAngle * Math.PI) / 180) * 4.6),
  ]
  const fig = renderRayScene({
    cells: [
      {
        origin: [0, 0],
        rays,
        labels: [{ x: tip[0], y: tip[1], text: '添', anchor: 'center' }],
      },
    ],
  })
  const text =
    ask === 'added'
      ? `图中从一点引出 ${m} 条射线。如果再添一条射线（图中虚线），会增加多少个角？`
      : `图中从一点引出 ${m} 条射线。如果再添一条射线（图中虚线），现在一共有多少个角？`
  return {
    text,
    fig,
    blank: 1,
    answer: String(ask === 'added' ? m : (m * (m + 1)) / 2),
    form: 'add-line-angles',
    params: { form: 'add-line-angles', m, ask, gap, added: addedAngle },
    kpName: KP['add-line-angles'],
  }
}

/**
 * 【方案验证·未接入出卷】数三角形：
 * 只数由图中已有线段围成的三角形。底边 AB 上有 k 个分点，顶点 C 向每个分点连线段，
 * 每个三角形都必须以 C 为一个顶点、从底边 k+2 个点中取两个，答案 C(k+2,2)。
 */
export function makeCountTriangles(rng: Rng): AnglePiece {
  const k = randInt(rng, 1, 4)
  const base = randInt(rng, 8, 12)
  const height = randInt(rng, 6, 9)
  const apexX = round1(base * (randInt(rng, 40, 60) / 100))
  const apex: [number, number] = [apexX, 0]
  const left: [number, number] = [0, height]
  const right: [number, number] = [base, height]
  const segments = [
    { from: left, to: right },
    { from: left, to: apex },
    { from: right, to: apex },
  ]
  for (let index = 1; index <= k; index++) {
    segments.push({ from: apex, to: [round1((base * index) / (k + 1)), height] as [number, number] })
  }
  const fig = renderSegmentScene({ segments })
  const answer = ((k + 1) * (k + 2)) / 2
  return {
    text: `图中由已有线段围成的三角形一共有多少个？`,
    fig,
    blank: 1,
    answer: String(answer),
    form: 'count-triangles',
    params: { form: 'count-triangles', k, base, height, apex: apexX },
    kpName: KP['count-triangles'],
  }
}

/**
 * 【方案验证·未接入出卷】数长方形：
 * m×n 的完整方格网，所有边都落在已有网格线上；答案 C(m+1,2)×C(n+1,2)。
 */
export function makeCountRectangles(rng: Rng): AnglePiece {
  // 旋转视为同一种网格：固定 m ≥ n，2–5 共 10 种
  const a = randInt(rng, 2, 5)
  const b = randInt(rng, 2, 5)
  const m = Math.max(a, b)
  const n = Math.min(a, b)
  const segments = []
  for (let x = 0; x <= m; x++) {
    segments.push({ from: [x, 0] as [number, number], to: [x, n] as [number, number] })
  }
  for (let y = 0; y <= n; y++) {
    segments.push({ from: [0, y] as [number, number], to: [m, y] as [number, number] })
  }
  const answer = ((m * (m + 1)) / 2) * ((n * (n + 1)) / 2)
  return {
    text: `图中由已有线段围成的长方形一共有多少个？`,
    fig: renderSegmentScene({ segments }),
    blank: 1,
    answer: String(answer),
    form: 'count-rectangles',
    params: { form: 'count-rectangles', m, n },
    kpName: KP['count-rectangles'],
  }
}

const makeOne = (form: AngleForm, rng: Rng, level: Level): AnglePiece => {
  switch (form) {
    case 'point-angles':
      return makePointAngles(rng, level)
    case 'classify-angles':
      return makeClassifyAngles(rng, level)
    case 'add-line-angles':
      return makeAddLineAngles(rng, level)
  }
}

/** 跨卷记忆键：fig 规格（短哈希）+ 关键数值 + 求解目标 */
export function angleKey(piece: AnglePiece): string {
  const params = Object.keys(piece.params)
    .sort()
    .map((key) => `${key}=${piece.params[key]}`)
    .join('&')
  return `angle:${piece.form}:${shortHash(stableStringify(piece.fig))}:${params}`
}

export function generateAngle(options: AngleOptions): {
  items: AnglePiece[]
  notes: string[]
  crossReused: number
} {
  const { grade, unitIds, level, count, seed, memory } = options
  if (!angleSupported(grade, unitIds)) {
    return {
      items: [],
      notes: ['角与图形计数：所选单元不含三上 U3「角的初步认识」，已跳过'],
      crossReused: 0,
    }
  }
  const forms = FORMS_BY_LEVEL[level]
  const rng = createRng(seed)
  const items: AnglePiece[] = []
  const used = new Set<string>()
  // 点角/添线角只按图变化时答案会重复，同卷内再按「题型+答案」去重
  const answerKeys = new Set<string>()
  const exhausted = new Set<AngleForm>()
  const maxAttemptsPerItem = 220
  let cursor = 0
  let crossReused = 0

  while (items.length < count) {
    const remaining = forms.filter((form) => !exhausted.has(form))
    if (remaining.length === 0) break
    let form = forms[cursor % forms.length]!
    if (exhausted.has(form)) {
      form = remaining[0]!
    }
    cursor++
    if (exhausted.has(form)) continue

    let fresh: AnglePiece | null = null
    let stale: AnglePiece | null = null
    for (let attempt = 0; attempt < maxAttemptsPerItem; attempt++) {
      const piece = makeOne(form, rng, level)
      const key = angleKey(piece)
      if (used.has(key)) continue
      if (
        (form === 'point-angles' || form === 'add-line-angles') &&
        answerKeys.has(`${form}:${piece.answer}`)
      ) {
        continue
      }
      if (memory?.recentlyUsed(key)) {
        if (stale == null || memory.lastPaper(key) < memory.lastPaper(angleKey(stale))) {
          stale = piece
        }
        continue
      }
      fresh = piece
      break
    }
    const chosen = fresh ?? stale
    if (chosen == null) {
      exhausted.add(form)
      continue
    }
    const key = angleKey(chosen)
    if (memory?.crossPaperUsed(key)) crossReused++
    memory?.record(key)
    used.add(key)
    if (chosen.form === 'point-angles' || chosen.form === 'add-line-angles') {
      answerKeys.add(`${chosen.form}:${chosen.answer}`)
    }
    items.push(chosen)
  }

  const notes: string[] = []
  if (items.length < count) notes.push(`本版角与图形计数规则最多可出 ${items.length} 道不重复题`)
  return { items, notes, crossReused }
}
