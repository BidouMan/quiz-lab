/**
 * 3A-U3 三角形与四边形 · 图形元语库。
 *
 * 坐标单位 mm，原点在画布左上角；只描述线段与文字标注，由 typst/paper.typ 的
 * draw-fig(spec) 渲染成「文字在左、图在右」的版面。
 *
 * 约定：
 * - 所有图元都留 2mm 以上边距，标注放在图形下方，避免压线；
 * - 直角一律用「小正方形符号」，不写“90 度”；三上不引入角的度量与角度数字；
 * - 三角形/四边形只做按角分类与辨认，不标边长数字，避免滑向周长、面积。
 */
import type { FigureLabel, FigureShape, FigureSpec, FigureStroke } from './types.ts'

export type AngleKind = 'acute' | 'right' | 'obtuse'
export type TriangleKind = 'acute' | 'right' | 'obtuse'
export type QuadKind = 'rect' | 'square' | 'para'

type Pt = [number, number]

const MARKS = ['①', '②', '③', '④']

const seg = (a: Pt, b: Pt, stroke: FigureStroke = 'solid'): FigureShape => ({ points: [a, b], stroke })

const closed = (points: Pt[], stroke: FigureStroke = 'solid'): FigureShape => ({ points, closed: true, stroke })

/** 直角符号：在顶点 V 处，沿两条边的单位方向 u、v 画一个小正方形 */
function rightMark(v: Pt, u: Pt, w: Pt, size = 2.6): FigureShape[] {
  const p1: Pt = [v[0] + u[0] * size, v[1] + u[1] * size]
  const p2: Pt = [v[0] + (u[0] + w[0]) * size, v[1] + (u[1] + w[1]) * size]
  const p3: Pt = [v[0] + w[0] * size, v[1] + w[1] * size]
  return [seg(p1, p2, 'thin'), seg(p2, p3, 'thin')]
}

function scalePoints(points: Pt[], factor: number, cx: number, cy: number): Pt[] {
  return points.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as Pt)
}

function shiftPoints(points: Pt[], dx: number): Pt[] {
  return points.map(([x, y]) => [x + dx, y] as Pt)
}

function markLabel(index: number, x: number, y: number): FigureLabel {
  return { x, y, text: MARKS[index], size: 9 }
}

/** 图形的统一缩放：s 取 80–130，对应 0.8–1.3 倍；单图元内部再按画布收紧 */
const zoom = (s: number): number => s / 100

/** 一行角：每个角占 28×37mm，下方标 ①②③ */
export function anglesFigure(kinds: AngleKind[], s: number): FigureSpec {
  const lane = 28
  const h = 37
  const baseY = 30
  const len = 13 * zoom(s)
  const shapes: FigureShape[] = []
  const labels: FigureLabel[] = []

  kinds.forEach((kind, index) => {
    const x0 = index * lane
    if (kind === 'acute') {
      const v: Pt = [x0 + 4, baseY]
      const rad = (55 * Math.PI) / 180
      shapes.push(seg(v, [v[0] + len, baseY]))
      shapes.push(seg(v, [v[0] + len * Math.cos(rad), baseY - len * Math.sin(rad)]))
    } else if (kind === 'right') {
      const v: Pt = [x0 + 4, baseY]
      shapes.push(seg(v, [v[0] + len, baseY]))
      shapes.push(seg(v, [v[0], baseY - len]))
      shapes.push(...rightMark(v, [1, 0], [0, -1]))
    } else {
      const v: Pt = [x0 + 14, baseY]
      const rad = (50 * Math.PI) / 180
      const arm = len * 0.78
      shapes.push(seg(v, [v[0] - arm, baseY]))
      shapes.push(seg(v, [v[0] + arm * Math.cos(rad), baseY - arm * Math.sin(rad)]))
    }
    labels.push(markLabel(index, x0 + 1, baseY + 3))
  })

  return { w: lane * kinds.length + 1, h, shapes, labels: kinds.length > 1 ? labels : [] }
}

/** 两条边长短不同、开口相同的两个锐角：用来检验“边越长角越大”的误解 */
export function sameOpeningAngles(s: number): FigureSpec {
  const h = 39
  const baseY = 31
  const rad = (50 * Math.PI) / 180
  const short = 8 * zoom(s)
  const long = 19 * zoom(s)
  const v1: Pt = [5, baseY]
  const v2: Pt = [33, baseY]
  return {
    w: 62,
    h,
    shapes: [
      seg(v1, [v1[0] + short, baseY]),
      seg(v1, [v1[0] + short * Math.cos(rad), baseY - short * Math.sin(rad)]),
      seg(v2, [v2[0] + long, baseY]),
      seg(v2, [v2[0] + long * Math.cos(rad), baseY - long * Math.sin(rad)]),
    ],
    labels: [markLabel(0, 2, baseY + 3), markLabel(1, 30, baseY + 3)],
  }
}

/** 一行三角形：每个占 34×37mm，下方标 ①②③ */
export function trianglesFigure(kinds: TriangleKind[], s: number): FigureSpec {
  const lane = 34
  const h = 37
  const labelY = 33
  const factor = 0.82 + (zoom(s) - 0.8) * 0.55
  const shapes: FigureShape[] = []
  const labels: FigureLabel[] = []

  kinds.forEach((kind, index) => {
    const x0 = index * lane
    const local: Pt[] =
      kind === 'acute'
        ? [[4, 30], [30, 30], [17, 9]]
        : kind === 'right'
          ? [[4, 30], [28, 30], [4, 11]]
          : [[11, 30], [33, 30], [2, 16]]
    const points = shiftPoints(scalePoints(local, factor, 17, 19), x0)
    shapes.push(closed(points))
    if (kind === 'right') {
      const v = shiftPoints(scalePoints([[4, 30]], factor, 17, 19), x0)[0]
      shapes.push(...rightMark(v, [1, 0], [0, -1]))
    }
    labels.push(markLabel(index, x0 + 2, labelY))
  })

  return { w: lane * kinds.length + 1, h, shapes, labels: kinds.length > 1 ? labels : [] }
}

/** 一行四边形：每个占 38×40mm，下方标 ①②③ */
export function quadsFigure(kinds: QuadKind[], s: number): FigureSpec {
  const lane = 38
  const h = 40
  const labelY = 35
  const factor = 0.85 + (zoom(s) - 0.8) * 0.5
  const shapes: FigureShape[] = []
  const labels: FigureLabel[] = []

  kinds.forEach((kind, index) => {
    const x0 = index * lane
    const local: Pt[] =
      kind === 'rect'
        ? [[4, 10], [34, 10], [34, 28], [4, 28]]
        : kind === 'square'
          ? [[8, 9], [28, 9], [28, 29], [8, 29]]
          : [[10, 9], [34, 9], [28, 29], [4, 29]]
    const points = shiftPoints(scalePoints(local, factor, 19, 20), x0)
    shapes.push(closed(points))
    labels.push(markLabel(index, x0 + 2, labelY))
  })

  return { w: lane * kinds.length + 1, h, shapes, labels: kinds.length > 1 ? labels : [] }
}

export type MixedKind = 'tri' | 'rightTri' | 'rect' | 'square' | 'para'

function mixedLocal(kind: MixedKind): Pt[] {
  return kind === 'tri'
    ? [[4, 30], [30, 30], [17, 9]]
    : kind === 'rightTri'
      ? [[4, 30], [28, 30], [4, 11]]
      : kind === 'rect'
        ? [[4, 10], [34, 10], [34, 28], [4, 28]]
        : kind === 'square'
          ? [[8, 9], [28, 9], [28, 29], [8, 29]]
          : [[10, 9], [34, 9], [28, 29], [4, 29]]
}

/** 三角形与四边形混排：每个占 36×40mm，用于“哪一个是/一共有几个”的混排题 */
export function mixedFigure(kinds: MixedKind[], s: number): FigureSpec {
  const lane = 36
  const h = 40
  const labelY = 35
  const factor = 0.82 + (zoom(s) - 0.8) * 0.45
  const shapes: FigureShape[] = []
  const labels: FigureLabel[] = []

  kinds.forEach((kind, index) => {
    const x0 = index * lane
    const points = shiftPoints(scalePoints(mixedLocal(kind), factor, 18, 20), x0)
    shapes.push(closed(points))
    if (kind === 'rightTri') {
      const v = shiftPoints(scalePoints([[4, 30]], factor, 18, 20), x0)[0]
      shapes.push(...rightMark(v, [1, 0], [0, -1]))
    }
    labels.push(markLabel(index, x0 + 2, labelY))
  })

  return { w: lane * kinds.length + 1, h, shapes, labels: kinds.length > 1 ? labels : [] }
}

/** 混排 2×2：四个图形分两行，避免一行四个把题干挤到 30mm 以下 */
export function mixedGridFigure(kinds: MixedKind[], s: number, columns = 2): FigureSpec {
  const laneW = 34
  const laneH = 38
  const rows = Math.ceil(kinds.length / columns)
  const factor = 0.8 + (zoom(s) - 0.8) * 0.4
  const shapes: FigureShape[] = []
  const labels: FigureLabel[] = []

  kinds.forEach((kind, index) => {
    const x0 = (index % columns) * laneW
    const y0 = Math.floor(index / columns) * laneH
    const points = shiftPoints(scalePoints(mixedLocal(kind), factor, 18, 20), x0).map(
      ([x, y]) => [x, y + y0] as Pt,
    )
    shapes.push(closed(points))
    if (kind === 'rightTri') {
      const v = shiftPoints(scalePoints([[4, 30]], factor, 18, 20), x0)[0]
      shapes.push(...rightMark([v[0], v[1] + y0], [1, 0], [0, -1]))
    }
    labels.push(markLabel(index, x0 + 2, y0 + 34))
  })

  return { w: columns * laneW + 1, h: rows * laneH + 1, shapes, labels }
}

/** 正方形 + 一条虚线对角线 */
export function squareWithDiagonal(s: number): FigureSpec {
  const factor = 0.85 + (zoom(s) - 0.8) * 0.5
  const points = scalePoints([[8, 8], [30, 8], [30, 30], [8, 30]], factor, 19, 19)
  return {
    w: 38,
    h: 39,
    shapes: [closed(points), seg(points[0], points[2], 'dashed')],
  }
}

/** 长方形 + 一条虚线对角线 */
export function rectWithDiagonal(s: number): FigureSpec {
  const factor = 0.85 + (zoom(s) - 0.8) * 0.4
  const points = scalePoints([[4, 10], [40, 10], [40, 30], [4, 30]], factor, 22, 20)
  return {
    w: 44,
    h: 39,
    shapes: [closed(points), seg(points[0], points[2], 'dashed')],
  }
}

/** 两个完全一样的正方形并排拼成一个长方形（中间用细线示意接缝） */
export function twoSquares(s: number): FigureSpec {
  const factor = 0.85 + (zoom(s) - 0.8) * 0.4
  const left = scalePoints([[4, 10], [24, 10], [24, 30], [4, 30]], factor, 24, 20)
  const right = scalePoints([[24, 10], [44, 10], [44, 30], [24, 30]], factor, 24, 20)
  const topY = 20 + (10 - 20) * factor
  const bottomY = 20 + (30 - 20) * factor
  return {
    w: 48,
    h: 39,
    shapes: [closed(left), closed(right), seg([24, topY], [24, bottomY], 'thin')],
  }
}

/** 长方形从左上角剪到右边一点：一个三角形 + 一个四边形 */
export function rectCut(s: number): FigureSpec {
  const factor = 0.82 + (zoom(s) - 0.8) * 0.4
  const points = scalePoints([[4, 8], [40, 8], [40, 34], [4, 34]], factor, 22, 21)
  const cutEnd: Pt = [points[0][0] + (points[1][0] - points[0][0]) * 0.62, points[2][1]]
  return {
    w: 44,
    h: 43,
    shapes: [closed(points), seg(points[0], cutEnd, 'dashed')],
  }
}

/** 平行四边形 + 虚线对角线 */
export function paraWithDiagonal(s: number): FigureSpec {
  const factor = 0.82 + (zoom(s) - 0.8) * 0.45
  const points = scalePoints([[10, 9], [38, 9], [32, 31], [4, 31]], factor, 21, 20)
  return {
    w: 44,
    h: 42,
    shapes: [closed(points), seg(points[0], points[2], 'dashed')],
  }
}

/** 2×2 方格：四个小正方形拼成一个大正方形 */
export function grid2x2(s: number): FigureSpec {
  const factor = 0.85 + (zoom(s) - 0.8) * 0.4
  const points = scalePoints([[6, 6], [40, 6], [40, 40], [6, 40]], factor, 23, 23)
  const midX = (points[0][0] + points[1][0]) / 2
  const midY = (points[0][1] + points[3][1]) / 2
  return {
    w: 46,
    h: 45,
    shapes: [
      closed(points),
      seg([midX, points[0][1]], [midX, points[3][1]], 'thin'),
      seg([points[0][0], midY], [points[1][0], midY], 'thin'),
    ],
  }
}

/** 两个分开的长方形（用于数直角/边数） */
export function twoRects(s: number): FigureSpec {
  const factor = 0.82 + (zoom(s) - 0.8) * 0.4
  const left = scalePoints([[2, 10], [28, 10], [28, 30], [2, 30]], factor, 30, 20)
  const right = scalePoints([[36, 10], [62, 10], [62, 30], [36, 30]], factor, 30, 20)
  return { w: 64, h: 39, shapes: [closed(left), closed(right)] }
}

/** 一个长方形和一个三角形并排（用于比较边/角/直角数） */
export function rectPlusTriangle(s: number): FigureSpec {
  const factor = 0.82 + (zoom(s) - 0.8) * 0.4
  const rect = scalePoints([[2, 10], [34, 10], [34, 32], [2, 32]], factor, 32, 21)
  const tri = scalePoints([[40, 32], [68, 32], [54, 10]], factor, 32, 21)
  return { w: 70, h: 41, shapes: [closed(rect), closed(tri)] }
}

/** 两个分开的三角形（其一为直角三角形，用于数直角/角的个数） */
export function twoTriangles(s: number): FigureSpec {
  const factor = 0.82 + (zoom(s) - 0.8) * 0.4
  const left = scalePoints([[4, 30], [30, 30], [17, 9]], factor, 17, 19)
  const right = scalePoints([[40, 30], [64, 30], [40, 11]], factor, 40, 20)
  return {
    w: 68,
    h: 39,
    shapes: [closed(left), closed(right), ...rightMark([right[0][0], right[0][1]], [1, 0], [0, -1])],
  }
}
