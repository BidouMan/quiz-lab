import { randInt, type Rng } from './rng.ts'
import { renderRayScene, renderSegmentScene, type RayCellModel, type RaySpec } from './figure.ts'
import type { FigureSpec } from './skeleton/types.ts'
import type { FillDraft, FillFormName, Grade, Level } from './types.ts'

/**
 * 「角与图形计数」填空子形态（沪教版 2024 修订·五·四学制 三上 U3「三角形与四边形」）。
 *
 * 角类题不再单开题型：三种点/线/分类形态都产出 FillDraft，由 fill.ts 统一
 * 走题干空位、答案、去重、跨卷记忆与运行时复核。figure.ts 只负责画图。
 */
export type AngleFillForm = 'angle-count' | 'angle-classify' | 'angle-add-line'
export type CountForm = 'count-triangles' | 'count-rectangles'

/** 未接入出卷的计数方案小样（保留验证用，不参与填空生成） */
export interface CountPiece {
  text: string
  fig: FigureSpec
  blank: number
  answer: string
  form: CountForm
  params: Record<string, number | string>
  kpName: string
}

const BLANK = '____'

/** 角类形态挂三上 U3；其他单元没有角内容 */
export function angleUnitSupported(unitId: string): boolean {
  return unitId === '3A-U3'
}

export function angleSupported(grade: Grade, unitIds: string[]): boolean {
  return grade === '3A' && unitIds.includes('3A-U3')
}

const FORMS_BY_LEVEL: Record<Level, AngleFillForm[]> = {
  // L1 只出单空、正向题；分类计三空、添线求总数属于两步，放 L2/L3
  L1: ['angle-count', 'angle-add-line'],
  L2: ['angle-count', 'angle-classify', 'angle-add-line'],
  L3: ['angle-count', 'angle-classify', 'angle-add-line'],
}

export function angleFillForms(level: Level): AngleFillForm[] {
  return FORMS_BY_LEVEL[level]
}

export function isAngleForm(form: FillFormName | string): form is AngleFillForm {
  return form === 'angle-count' || form === 'angle-classify' || form === 'angle-add-line'
}

const round1 = (value: number): number => Math.round(value * 10) / 10

const ACUTE_DEGREES = [35, 40, 45, 50, 55, 60, 65, 70, 75]
const OBTUSE_DEGREES = [100, 105, 110, 120, 130]

type AngleKind = 'acute' | 'right' | 'obtuse'

const pick = <T,>(rng: Rng, list: readonly T[]): T => list[randInt(rng, 0, list.length - 1)]!

const combination = (n: number): number => (n * (n - 1)) / 2

const angleKindOf = (degree: number): AngleKind =>
  degree < 90 ? 'acute' : degree === 90 ? 'right' : 'obtuse'

const degreesFor = (rng: Rng, kind: AngleKind): number => {
  if (kind === 'right') return 90
  return pick(rng, kind === 'acute' ? ACUTE_DEGREES : OBTUSE_DEGREES)
}

/** 一点引出 n 条射线：方向铺满上半平面，任意两条都不共线，答案 C(n,2) */
export function makeAngleCount(rng: Rng, level: Level): FillDraft {
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
  const answer = String(combination(n))
  return {
    stem: `从一点引出 ${n} 条射线（如图），一共可以数出 ${BLANK} 个角。`,
    answers: [answer],
    values: [combination(n)],
    fig,
    params: { form: 'angle-count', n, start, end },
    features: { form: 'angle-count', level, figure: 1, reverse: 0 },
  }
}

/** 4–6 个互相独立的角，按直角/锐角/钝角分别计数；直角一律画直角符号 */
export function makeAngleClassify(rng: Rng, level: Level): FillDraft {
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
    stem: `图中标出了 ${total} 个角。直角有 ${BLANK} 个，锐角有 ${BLANK} 个，钝角有 ${BLANK} 个。`,
    answers: [String(counts.right), String(counts.acute), String(counts.obtuse)],
    values: [counts.right, counts.acute, counts.obtuse],
    fig,
    params: { form: 'angle-classify', angles: degrees.join(','), marks: counts.right },
    features: { form: 'angle-classify', level, figure: 1, reverse: 0 },
  }
}

/** 已有 m 条射线，再添一条（虚线）；新线与每条已有线各成一个角 */
export function makeAngleAddLine(rng: Rng, level: Level): FillDraft {
  const range: Record<Level, [number, number]> = { L1: [3, 5], L2: [4, 6], L3: [6, 8] }
  const ask: 'added' | 'total' = level === 'L1' ? 'added' : randInt(rng, 0, 1) === 0 ? 'added' : 'total'
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
  const answer = ask === 'added' ? m : ((m + 1) * m) / 2
  const stem =
    ask === 'added'
      ? `图中从一点引出 ${m} 条射线。如果再添一条射线（图中虚线），会增加 ${BLANK} 个角。`
      : `图中从一点引出 ${m} 条射线。如果再添一条射线（图中虚线），现在一共有 ${BLANK} 个角。`
  return {
    stem,
    answers: [String(answer)],
    values: [answer],
    fig,
    params: { form: 'angle-add-line', m, ask, gap, added: addedAngle },
    features: { form: 'angle-add-line', level, figure: 1, reverse: 0 },
  }
}

export function buildAngleFill(form: AngleFillForm, rng: Rng, level: Level): FillDraft {
  switch (form) {
    case 'angle-count':
      return makeAngleCount(rng, level)
    case 'angle-classify':
      return makeAngleClassify(rng, level)
    case 'angle-add-line':
      return makeAngleAddLine(rng, level)
  }
}

/** 独立重算：只依赖 params，不复用生成时的中间结果 */
export function verifyAngleFill(form: AngleFillForm, params: Record<string, number | string | undefined>): string[] {
  if (form === 'angle-count') {
    const n = Number(params.n)
    return [String(combination(n))]
  }
  if (form === 'angle-classify') {
    const degrees = String(params.angles ?? '')
      .split(',')
      .map(Number)
      .filter((degree) => Number.isFinite(degree))
    const right = degrees.filter((degree) => degree === 90).length
    const acute = degrees.filter((degree) => degree < 90).length
    const obtuse = degrees.filter((degree) => degree > 90).length
    return [String(right), String(acute), String(obtuse)]
  }
  if (form === 'angle-add-line') {
    const m = Number(params.m)
    return [String(params.ask === 'added' ? m : ((m + 1) * m) / 2)]
  }
  return []
}

/**
 * 【方案验证·未接入出卷】数三角形：
 * 只数由图中已有线段围成的三角形。底边 AB 上有 k 个分点，顶点 C 向每个分点连线段，
 * 每个三角形都必须以 C 为一个顶点、从底边 k+2 个点中取两个，答案 C(k+2,2)。
 */
export function makeCountTriangles(rng: Rng): CountPiece {
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
    kpName: '数三角形',
  }
}

/**
 * 【方案验证·未接入出卷】数长方形：
 * m×n 的完整方格网，所有边都落在已有网格线上；答案 C(m+1,2)×C(n+1,2)。
 */
export function makeCountRectangles(rng: Rng): CountPiece {
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
    kpName: '数长方形',
  }
}
