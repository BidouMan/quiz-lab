import type { FigureLabel, FigureShape, FigureSpec, FigureStroke } from './skeleton/types.ts'

/**
 * FigureKit —— 只负责“画图”的图形器。
 *
 * 输入是模型坐标（真实尺寸，y 向下），输出是 paper.typ 的 FigureSpec：
 * 按等比缩放放进 48×25mm 画布中间的 26×11mm 图形区（仍落在既有 32×19 框内），
 * 只保证形状、标注、直角符号与虚线，不参与出题、不算答案。
 */
export interface FigureModelLabel {
  /** 标注挂在第几条边上（顶点 i → i+1） */
  edge: number
  text: string
}

export interface FigureModelGuide {
  from: [number, number]
  to: [number, number]
  /** 辅助线：虚线（补全外框）或细线（网格线） */
  stroke?: 'dashed' | 'thin'
}

export interface FigureModel {
  /** 多边形顶点，按顺序给，模型坐标（单位与题面一致，渲染时等比缩放） */
  points: Array<[number, number]>
  labels?: FigureModelLabel[]
  /** 直角符号：顶点序号 */
  rightAngles?: number[]
  /** 虚线辅助线：模型坐标起止点 */
  dashed?: Array<[[number, number], [number, number]]>
  /** 辅助线（虚线/细线），网格图形与补全外框用 */
  guides?: FigureModelGuide[]
  /** 额外文字（模型坐标，默认放在点上边居中） */
  extraLabels?: Array<{ x: number; y: number; text: string; anchor?: 'left' | 'center' | 'right' }>
}

const CANVAS_W = 48
const CANVAS_H = 25
/** 图形本体上限，留出四周标注空间 */
const DRAW_W = 26
const DRAW_H = 11

const round1 = (value: number): number => Math.round(value * 10) / 10

/** 粗估文字宽度（mm），只用于把标注框夹在画布内并避免标注重叠 */
function textWidth(text: string): number {
  let width = 0
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/u.test(char)) width += 3.2
    else if (char === ' ') width += 0.9
    else if (char === '×' || char === '÷') width += 2.6
    else if (/[0-9]/.test(char)) width += 1.7
    else width += 1.8
  }
  return width
}

const TEXT_H = 3.2

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function boxOverlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function orientation(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function segmentsCross(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  return o1 * o2 < 0 && o3 * o4 < 0
}

/** 线段是否进入标注框（含少量余量），用于避开线条 */
function segmentHitsBox(p1: [number, number], p2: [number, number], box: Box): boolean {
  const pad = 0.4
  const left = box.x - pad
  const right = box.x + box.w + pad
  const top = box.y - pad
  const bottom = box.y + box.h + pad
  const corners: Array<[number, number]> = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ]
  if (
    (p1[0] >= left && p1[0] <= right && p1[1] >= top && p1[1] <= bottom) ||
    (p2[0] >= left && p2[0] <= right && p2[1] >= top && p2[1] <= bottom)
  ) {
    return true
  }
  for (let index = 0; index < 4; index++) {
    if (segmentsCross(p1, p2, corners[index]!, corners[(index + 1) % 4]!)) return true
  }
  return false
}

function insidePolygon(point: [number, number], points: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!
    const [xj, yj] = points[j]!
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function renderFigure(model: FigureModel): FigureSpec {
  const points = model.points
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const modelW = Math.max(1e-6, maxX - minX)
  const modelH = Math.max(1e-6, maxY - minY)
  const scale = Math.min(DRAW_W / modelW, DRAW_H / modelH)
  const ox = (CANVAS_W - modelW * scale) / 2 - minX * scale
  const oy = (CANVAS_H - modelH * scale) / 2 - minY * scale
  const map = (point: [number, number]): [number, number] => [
    round1(ox + point[0] * scale),
    round1(oy + point[1] * scale),
  ]
  const mapped = points.map(map)
  const shapes: FigureShape[] = [{ points: mapped, closed: true }]

  // 直角符号：沿两条相邻边向内画一个小三折线
  for (const vertex of model.rightAngles ?? []) {
    const prev = mapped[(vertex + mapped.length - 1) % mapped.length]!
    const current = mapped[vertex]!
    const next = mapped[(vertex + 1) % mapped.length]!
    const dir1 = unitVector(current, prev)
    const dir2 = unitVector(current, next)
    const size = 2.2
    const p1: [number, number] = [round1(current[0] + dir1[0] * size), round1(current[1] + dir1[1] * size)]
    const p2: [number, number] = [
      round1(current[0] + (dir1[0] + dir2[0]) * size),
      round1(current[1] + (dir1[1] + dir2[1]) * size),
    ]
    const p3: [number, number] = [round1(current[0] + dir2[0] * size), round1(current[1] + dir2[1] * size)]
    shapes.push({ points: [p1, p2, p3], stroke: 'thin' })
  }

  for (const [from, to] of model.dashed ?? []) {
    shapes.push({ points: [map(from), map(to)], stroke: 'dashed' })
  }
  for (const guide of model.guides ?? []) {
    shapes.push({ points: [map(guide.from), map(guide.to)], stroke: guide.stroke ?? 'thin' })
  }

  const labels: FigureLabel[] = []
  const occupied: Box[] = []
  const center = mapped.reduce(
    (acc, point) => [acc[0] + point[0] / mapped.length, acc[1] + point[1] / mapped.length],
    [0, 0] as [number, number],
  )

  for (const label of model.labels ?? []) {
    const from = mapped[label.edge % mapped.length]!
    const to = mapped[(label.edge + 1) % mapped.length]!
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
    const normal = outwardNormal(from, to, mid, mapped, center)
    const width = textWidth(label.text)
    let placed: FigureLabel | null = null
    // 竖直边上的标注需要让开半个文字宽，水平边只需要让开半个文字高
    const base = Math.abs(normal[0]) > 0.5 ? width / 2 + 1.6 : TEXT_H / 2 + 1.4
    for (const distance of [base, base + 1.4, base + 2.8]) {
      const cx = mid[0] + normal[0] * distance
      const boxY = mid[1] + normal[1] * distance
      const box: Box = { x: round1(cx - width / 2), y: round1(boxY), w: width, h: TEXT_H }
      clampBox(box)
      if (!hitsAnyEdge(box, mapped) && !occupied.some((other) => boxOverlaps(box, other))) {
        placed = { x: round1(box.x + box.w / 2), y: round1(box.y), text: label.text, anchor: 'center' }
        occupied.push(box)
        break
      }
    }
    if (placed == null) {
      const box: Box = { x: round1(mid[0] + normal[0] * base - width / 2), y: round1(mid[1] + normal[1] * base), w: width, h: TEXT_H }
      clampBox(box)
      placed = { x: round1(box.x + box.w / 2), y: round1(box.y), text: label.text, anchor: 'center' }
      occupied.push(box)
    }
    labels.push(placed)
  }

  for (const extra of model.extraLabels ?? []) {
    const [x, y] = map([extra.x, extra.y])
    const width = textWidth(extra.text)
    const anchor = extra.anchor ?? 'center'
    const box: Box = {
      x: round1(anchor === 'left' ? x : anchor === 'right' ? x - width : x - width / 2),
      y: round1(y),
      w: width,
      h: TEXT_H,
    }
    clampBox(box)
    labels.push({ x: round1(box.x + box.w / 2), y: round1(box.y), text: extra.text, anchor: 'center' })
  }

  return { w: CANVAS_W, h: CANVAS_H, shapes, labels }
}

function clampBox(box: Box): void {
  box.x = clamp(box.x, 0.5, CANVAS_W - box.w - 0.5)
  box.y = clamp(box.y, 0.4, CANVAS_H - box.h - 0.4)
}

function hitsAnyEdge(box: Box, polygon: Array<[number, number]>): boolean {
  for (let index = 0; index < polygon.length; index++) {
    if (segmentHitsBox(polygon[index]!, polygon[(index + 1) % polygon.length]!, box)) return true
  }
  return false
}

function unitVector(from: [number, number], to: [number, number]): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy) || 1
  return [dx / length, dy / length]
}

/** 取远离图形内部的一侧作为标注方向 */
function outwardNormal(
  from: [number, number],
  to: [number, number],
  mid: [number, number],
  polygon: Array<[number, number]>,
  center: [number, number],
): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy) || 1
  const candidates: Array<[number, number]> = [
    [-dy / length, dx / length],
    [dy / length, -dx / length],
  ]
  const outside = candidates.find((normal) => {
    const probe: [number, number] = [mid[0] + normal[0] * 0.9, mid[1] + normal[1] * 0.9]
    return !insidePolygon(probe, polygon)
  })
  if (outside != null) return outside
  const away: [number, number] = [mid[0] - center[0], mid[1] - center[1]]
  return away[0] * candidates[0]![0] + away[1] * candidates[0]![1] >= 0 ? candidates[0]! : candidates[1]!
}

// ---------- 射线 / 角图元：只画图，不算答案 ----------

export interface RaySpec {
  /** 方向角：0° 向右，逆时针为正（画布 y 轴向下，绘制时自动取反） */
  angle: number
  length: number
  stroke?: FigureStroke
}

export interface RayCellModel {
  /** 顶点，模型坐标（y 向下） */
  origin: [number, number]
  rays: RaySpec[]
  /** 开口弧线：连接第 from、to 条射线 */
  arcs?: Array<{ from: number; to: number; radius: number }>
  /** 直角符号：在第 a、b 条射线之间画小方角 */
  rightAngles?: Array<{ a: number; b: number; size?: number }>
  labels?: Array<{ x: number; y: number; text: string; anchor?: 'left' | 'center' | 'right' }>
}

export interface RaySceneModel {
  cells: RayCellModel[]
}

export interface SegmentSpec {
  from: [number, number]
  to: [number, number]
  stroke?: FigureStroke
}

export interface SegmentSceneModel {
  segments: SegmentSpec[]
  labels?: Array<{ x: number; y: number; text: string; anchor?: 'left' | 'center' | 'right' }>
}

const directionOf = (angle: number): [number, number] => [
  Math.cos((angle * Math.PI) / 180),
  -Math.sin((angle * Math.PI) / 180),
]

/** 把模型坐标等比缩放到 26×11 图形区并居中；返回映射函数 */
function fitScene(points: Array<[number, number]>): (point: [number, number]) => [number, number] {
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const modelW = Math.max(1e-6, maxX - minX)
  const modelH = Math.max(1e-6, maxY - minY)
  const scale = Math.min(DRAW_W / modelW, DRAW_H / modelH)
  const ox = (CANVAS_W - modelW * scale) / 2 - minX * scale
  const oy = (CANVAS_H - modelH * scale) / 2 - minY * scale
  return (point: [number, number]): [number, number] => [
    round1(ox + point[0] * scale),
    round1(oy + point[1] * scale),
  ]
}

function shortestDelta(from: number, to: number): number {
  let delta = to - from
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

function mappedSegments(shapes: FigureShape[]): Array<[[number, number], [number, number]]> {
  const segments: Array<[[number, number], [number, number]]> = []
  for (const shape of shapes) {
    for (let index = 0; index + 1 < shape.points.length; index++) {
      segments.push([shape.points[index]!, shape.points[index + 1]!])
    }
  }
  return segments
}

function hitsAnySegment(box: Box, segments: Array<[[number, number], [number, number]]>): boolean {
  return segments.some(([from, to]) => segmentHitsBox(from, to, box))
}

function placeSceneLabels(
  labels: NonNullable<RayCellModel['labels']>,
  map: (point: [number, number]) => [number, number],
  shapes: FigureShape[],
): FigureLabel[] {
  const segments = mappedSegments(shapes)
  const occupied: Box[] = []
  const placedLabels: FigureLabel[] = []
  const offsets: Array<[number, number]> = [
    [0, 0],
    [0, -1.6],
    [0, 1.6],
    [-1.6, 0],
    [1.6, 0],
    [1.6, -1.6],
    [-1.6, -1.6],
    [1.6, 1.6],
    [-1.6, 1.6],
  ]
  for (const label of labels) {
    const [cx, cy] = map([label.x, label.y])
    const width = textWidth(label.text)
    const anchor = label.anchor ?? 'center'
    const baseX = anchor === 'left' ? cx : anchor === 'right' ? cx - width : cx - width / 2
    let placed: Box | null = null
    for (const [dx, dy] of offsets) {
      const box: Box = { x: round1(baseX + dx), y: round1(cy + dy), w: width, h: TEXT_H }
      clampBox(box)
      if (!hitsAnySegment(box, segments) && !occupied.some((other) => boxOverlaps(box, other))) {
        placed = box
        break
      }
    }
    if (placed == null) {
      placed = { x: round1(baseX), y: round1(cy), w: width, h: TEXT_H }
      clampBox(placed)
    }
    occupied.push(placed)
    placedLabels.push({
      x: round1(placed.x + placed.w / 2),
      y: placed.y,
      text: label.text,
      anchor: 'center',
    })
  }
  return placedLabels
}

/** 一张图里可以有多个角（顶点/射线/弧线/直角符号），整体等比缩放 */
export function renderRayScene(model: RaySceneModel): FigureSpec {
  const cells = model.cells.map((cell) => {
    const dirs = cell.rays.map((ray) => directionOf(ray.angle))
    const ends = cell.rays.map((ray, index) => {
      const dir = dirs[index]!
      return [
        cell.origin[0] + dir[0] * ray.length,
        cell.origin[1] + dir[1] * ray.length,
      ] as [number, number]
    })
    const arcs = (cell.arcs ?? []).map((arc) => {
      const from = cell.rays[arc.from]
      const to = cell.rays[arc.to]
      if (from == null || to == null) return [] as Array<[number, number]>
      const delta = shortestDelta(from.angle, to.angle)
      const steps = Math.max(6, Math.round(Math.abs(delta) / 9))
      const points: Array<[number, number]> = []
      for (let index = 0; index <= steps; index++) {
        const angle = from.angle + (delta * index) / steps
        const dir = directionOf(angle)
        points.push([cell.origin[0] + dir[0] * arc.radius, cell.origin[1] + dir[1] * arc.radius])
      }
      return points
    })
    const rightMarks = (cell.rightAngles ?? []).map((mark) => {
      const a = cell.rays[mark.a]
      const b = cell.rays[mark.b]
      if (a == null || b == null) return [] as Array<[number, number]>
      const u1 = directionOf(a.angle)
      const u2 = directionOf(b.angle)
      const size = mark.size ?? 1.5
      const origin = cell.origin
      return [
        [origin[0] + u1[0] * size, origin[1] + u1[1] * size],
        [origin[0] + (u1[0] + u2[0]) * size, origin[1] + (u1[1] + u2[1]) * size],
        [origin[0] + u2[0] * size, origin[1] + u2[1] * size],
      ] as Array<[number, number]>
    })
    return { cell, ends, arcs, rightMarks }
  })

  const all: Array<[number, number]> = []
  for (const item of cells) {
    all.push(item.cell.origin, ...item.ends)
    for (const arc of item.arcs) all.push(...arc)
    for (const mark of item.rightMarks) all.push(...mark)
  }
  const map = fitScene(all)

  const shapes: FigureShape[] = []
  for (const item of cells) {
    item.cell.rays.forEach((ray, index) => {
      shapes.push({
        points: [map(item.cell.origin), map(item.ends[index]!)],
        stroke: ray.stroke ?? 'solid',
      })
    })
    for (const arc of item.arcs) {
      if (arc.length > 1) shapes.push({ points: arc.map(map), stroke: 'thin' })
    }
    for (const mark of item.rightMarks) {
      if (mark.length > 0) shapes.push({ points: mark.map(map), stroke: 'thin' })
    }
  }

  const labels = placeSceneLabels(
    cells.flatMap((item) => item.cell.labels ?? []),
    map,
    shapes,
  )
  return { w: CANVAS_W, h: CANVAS_H, shapes, labels }
}

/** 多条独立线段（数三角形/数长方形的网格图） */
export function renderSegmentScene(model: SegmentSceneModel): FigureSpec {
  const all: Array<[number, number]> = []
  for (const segment of model.segments) all.push(segment.from, segment.to)
  const map = fitScene(all)
  const shapes: FigureShape[] = model.segments.map((segment) => ({
    points: [map(segment.from), map(segment.to)],
    stroke: segment.stroke ?? 'solid',
  }))
  const labels = placeSceneLabels(model.labels ?? [], map, shapes)
  return { w: CANVAS_W, h: CANVAS_H, shapes, labels }
}
