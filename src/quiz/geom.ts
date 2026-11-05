import { createRng, randInt, type Rng } from './rng.ts'
import type { MemoryStore } from './memory.ts'
import { shortHash, stableStringify } from './normalize.ts'
import { renderFigure, renderSegmentScene, type FigureModel } from './figure.ts'
import type { FigureSpec } from './skeleton/types.ts'
import type { Grade, Level } from './types.ts'

/**
 * 图形与周长规则生成器（沪教版三上「长方形与正方形」单元）。
 *
 * 绘制层与配方层分开：图形器 figure.ts 只把模型坐标画成 FigureSpec，
 * 本文件负责顶点生成规则、标注、周长闭式计算与可解性约束。
 * 一行一题、通栏；题干的单位与答案单位一一对应，由复核再独立算一遍。
 */
export type GeomForm =
  | 'rect-perimeter'
  | 'square-perimeter'
  | 'reverse-rect'
  | 'reverse-square'
  | 'fence'
  | 'combine'
  | 'ratio'
  | 'recognize-name'
  | 'count-shapes'
  | 'classify'
  | 'sticks'
  | 'compose'
  | 'triangle-perimeter'
  | 'isosceles-triangle-perimeter'
  | 'equilateral-triangle-perimeter'
  | 'parallelogram-perimeter'
  | 'trapezoid-perimeter'
  | 'lshape-perimeter'
  | 'concave-perimeter'
  | 'staircase-perimeter'
  | 't-shape-perimeter'
  | 'join-squares-perimeter'
  | 'grid-perimeter'
  | 'count-triangles'
  | 'count-rectangles'

export interface GeomPiece {
  text: string
  fig: FigureSpec
  blank: number
  /** 答案数值（不含单位） */
  answer: string
  form: GeomForm
  /** 复核参数：独立重算用 */
  params: Record<string, number | string>
  /** 题干与答案统一使用的单位；认识图形类题目无长度单位，留空 */
  unit: '' | '厘米' | '米'
  kpName: string
}

export interface GeomOptions {
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed: number
  /** 跨卷记忆：键 = fig 规格 + 关键数值 + 求解目标 */
  memory?: MemoryStore
}

/** 图形题只在三上「三角形与四边形（U3）」「周长（U6）」「数学广场（U8）」及复习单元 U9 内出图 */
export function geomSupported(grade: Grade, unitIds: string[]): boolean {
  if (grade === '3B') return true
  return unitIds.some((id) => id === '3A-U3' || id === '3A-U6' || id === '3A-U8' || id === '3A-U9')
}

/** 所选单元是否有任一难度可出图形题 */
export function geomUnitsSupported(grade: Grade, unitIds: string[]): boolean {
  return geomSupported(grade, unitIds)
}

// ---- 图形规格：坐标单位 mm，画布 48×25，与原 geom-fig 的 32×19 图形框对齐 ----
const BOX_X = 12
const BOX_Y = 6
const BOX_W = 32
const BOX_H = 19
const SQUARE_SIDE = 19

const round1 = (value: number): number => Math.round(value * 10) / 10

/** 长方形按长宽比例缩放后居中画在 32×19 的框里，避免 15×2 被画成 8:5 */
function rectSpec(
  l: number,
  w: number,
  unit: string,
  options?: { wall?: boolean; hideWidth?: boolean; noLabels?: boolean },
): FigureSpec {
  const scale = Math.min(BOX_W / l, BOX_H / w)
  const bw = round1(l * scale)
  const bh = round1(w * scale)
  const x0 = round1(BOX_X + (BOX_W - bw) / 2)
  const y0 = round1(BOX_Y + (BOX_H - bh) / 2)
  const x1 = round1(x0 + bw)
  const y1 = round1(y0 + bh)
  const shapes: FigureSpec['shapes'] = [
    {
      points: [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      closed: true,
    },
  ]
  const labels: NonNullable<FigureSpec['labels']> = options?.noLabels
    ? []
    : [{ x: round1(x0 + bw / 2 - 6), y: Math.max(0, round1(y0 - 7)), text: `${l} ${unit}` }]
  if (options?.wall) {
    shapes.push({ points: [[x0, y0], [x1, y0]], stroke: 'dashed' })
    labels.push({ x: round1(x1 - 9), y: Math.max(0, round1(y0 - 7)), text: '墙' })
  }
  if (!options?.hideWidth && !options?.noLabels) {
    labels.push({ x: Math.max(0, round1(x0 - 12)), y: round1(y0 + bh / 2 - 3), text: `${w} ${unit}` })
  }
  return { w: 48, h: 25, shapes, labels }
}

function squareSpec(s: number, unit: string, hideSide = false): FigureSpec {
  const x0 = round1(BOX_X + (BOX_W - SQUARE_SIDE) / 2)
  const y0 = BOX_Y
  const shapes: FigureSpec['shapes'] = [
    {
      points: [
        [x0, y0],
        [x0 + SQUARE_SIDE, y0],
        [x0 + SQUARE_SIDE, y0 + SQUARE_SIDE],
        [x0, y0 + SQUARE_SIDE],
      ],
      closed: true,
    },
  ]
  const labels: NonNullable<FigureSpec['labels']> = hideSide
    ? []
    : [
        { x: round1(x0 + SQUARE_SIDE / 2 - 5), y: 0, text: `${s} ${unit}` },
        { x: Math.max(0, round1(x0 - 12)), y: round1(y0 + SQUARE_SIDE / 2 - 3), text: `${s} ${unit}` },
      ]
  return { w: 48, h: 25, shapes, labels }
}

const KP = {
  rect: '长方形的周长',
  square: '正方形的周长',
  reverse: '周长求边长',
  fence: '靠墙围篱笆',
  combine: '拼接后的周长',
  ratio: '长与宽的倍数关系',
  triangle: '三角形的周长',
  isosceles: '等腰三角形的周长',
  equilateral: '等边三角形的周长',
  parallelogram: '平行四边形的周长',
  trapezoid: '梯形的周长',
  lshape: '组合图形周长（平移）',
  concave: '凹形周长（平移）',
  staircase: '阶梯形周长（平移）',
  tshape: 'T 形周长（平移）',
  joinSquares: '拼正方形后的周长',
  grid: '数方格求周长',
  countTriangles: '数三角形',
  countRectangles: '数长方形',
}

function makeRectPerim(rng: Rng): GeomPiece {
  const l = randInt(rng, 6, 15)
  const w = randInt(rng, 2, l - 1)
  const answer = 2 * (l + w)
  return {
    text: `一个长方形，长 ${l} 厘米，宽 ${w} 厘米。它的周长是多少厘米？`,
    fig: rectSpec(l, w, 'cm'),
    blank: 15,
    answer: String(answer),
    form: 'rect-perimeter',
    params: { form: 'rect-perimeter', l, w },
    unit: '厘米',
    kpName: KP.rect,
  }
}

function makeSquarePerim(rng: Rng): GeomPiece {
  // 参数池从 17 档扩到 49 档，降低跨卷重复
  const s = randInt(rng, 2, 50)
  return {
    text: `一个正方形的边长是 ${s} 厘米。它的周长是多少厘米？`,
    fig: squareSpec(s, 'cm'),
    blank: 15,
    answer: String(4 * s),
    form: 'square-perimeter',
    params: { form: 'square-perimeter', s },
    unit: '厘米',
    kpName: KP.square,
  }
}

function makeReverseRect(rng: Rng): GeomPiece {
  const w = randInt(rng, 3, 9)
  const l = randInt(rng, w + 2, w + 9)
  const p = 2 * (l + w)
  return {
    text: `一个长方形的周长是 ${p} 厘米，长是 ${l} 厘米。它的宽是多少厘米？`,
    fig: rectSpec(l, w, 'cm', { hideWidth: true }),
    blank: 15,
    answer: String(w),
    form: 'reverse-rect',
    params: { form: 'reverse-rect', p, l },
    unit: '厘米',
    kpName: KP.reverse,
  }
}

function makeReverseSquare(rng: Rng): GeomPiece {
  const s = randInt(rng, 3, 20)
  const p = 4 * s
  return {
    text: `一个正方形的周长是 ${p} 厘米。它的边长是多少厘米？`,
    fig: squareSpec(s, 'cm', true),
    blank: 15,
    answer: String(s),
    form: 'reverse-square',
    params: { form: 'reverse-square', p },
    unit: '厘米',
    kpName: KP.reverse,
  }
}

function makeFence(rng: Rng): GeomPiece {
  const w = randInt(rng, 2, 8)
  const l = randInt(rng, w + 3, w + 10)
  const answer = l + 2 * w
  return {
    text: `一块长方形菜地，长 ${l} 米，宽 ${w} 米。一条长边靠墙，其余三面围上篱笆，篱笆至少长多少米？`,
    fig: rectSpec(l, w, 'm', { wall: true }),
    blank: 15,
    answer: String(answer),
    form: 'fence',
    params: { form: 'fence', l, w },
    unit: '米',
    kpName: KP.fence,
  }
}

function makeCombine(rng: Rng): GeomPiece {
  const l = randInt(rng, 5, 12)
  const w = randInt(rng, 2, l - 1)
  // 两条长边相拼，拼成 l×2w 的大长方形
  const answer = 2 * (l + 2 * w)
  return {
    text: `两个完全一样的长方形，长 ${l} 厘米，宽 ${w} 厘米。把两条长边拼在一起，拼成一个大长方形。这个大长方形的周长是多少厘米？`,
    fig: joinedSpec(l, w, 'along-long'),
    blank: 15,
    answer: String(answer),
    form: 'combine',
    params: { form: 'combine', l, w },
    unit: '厘米',
    kpName: KP.combine,
  }
}

function makeRatio(rng: Rng): GeomPiece {
  const w = randInt(rng, 2, 7)
  const k = randInt(rng, 2, 4)
  const l = k * w
  const answer = 2 * (l + w)
  return {
    text: `一个长方形的长是宽的 ${k} 倍，宽是 ${w} 厘米。它的周长是多少厘米？`,
    fig: rectSpec(l, w, 'cm'),
    blank: 15,
    answer: String(answer),
    form: 'ratio',
    params: { form: 'ratio', w, k },
    unit: '厘米',
    kpName: KP.ratio,
  }
}

/** 一排并列的长方形/正方形，用于“按边数分类、数图形” */
function rowSpec(items: Array<'rect' | 'square'>): FigureSpec {
  const size = 10
  const gap = 3
  const total = items.length * size + (items.length - 1) * gap
  const start = round1((48 - total) / 2)
  const y0 = 7
  const shapes: FigureSpec['shapes'] = []
  const labels: NonNullable<FigureSpec['labels']> = []
  items.forEach((kind, index) => {
    const x0 = round1(start + index * (size + gap))
    shapes.push({
      points: [
        [x0, y0],
        [x0 + size, y0],
        [x0 + size, y0 + size],
        [x0, y0 + size],
      ],
      closed: true,
    })
    labels.push({ x: round1(x0 + size / 2 - 2), y: 0, text: `${'①②③④⑤'[index] ?? index + 1}` })
    if (kind === 'square') {
      labels.push({ x: round1(x0 + size / 2 - 2), y: 19, text: '□' })
    }
  })
  return { w: 48, h: 25, shapes, labels }
}

/** 两个完全一样的长方形拼成一个大的长方形（中间拼接线画细线） */
function joinedSpec(
  l: number,
  w: number,
  axis: 'along-long' | 'along-short' = 'along-short',
): FigureSpec {
  // along-long：两条长边相拼，结果是 l×2w；along-short：两条宽边相拼，结果是 2l×w
  const bw = axis === 'along-long' ? l : 2 * l
  const bh = axis === 'along-long' ? 2 * w : w
  const scale = Math.min(BOX_W / bw, BOX_H / bh)
  const drawW = round1(bw * scale)
  const drawH = round1(bh * scale)
  const x0 = round1(BOX_X + (BOX_W - drawW) / 2)
  const y0 = round1(BOX_Y + (BOX_H - drawH) / 2)
  const x1 = round1(x0 + drawW)
  const y1 = round1(y0 + drawH)
  const seam: FigureSpec['shapes'][number] =
    axis === 'along-long'
      ? { points: [[x0, round1(y0 + drawH / 2)], [x1, round1(y0 + drawH / 2)]], stroke: 'thin' }
      : { points: [[round1(x0 + drawW / 2), y0], [round1(x0 + drawW / 2), y1]], stroke: 'thin' }
  return {
    w: 48,
    h: 25,
    shapes: [
      {
        points: [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
        closed: true,
      },
      seam,
    ],
  }
}

function makeRecognizeName(rng: Rng): GeomPiece {
  const square = rng() < 0.5
  const l = randInt(rng, 4, 9)
  const w = randInt(rng, 3, l)
  return {
    text: '右边的图形是什么形状？',
    fig: square ? squareSpec(l, 'cm', true) : rectSpec(l, w, 'cm', { noLabels: true }),
    blank: 8,
    answer: square ? '正方形' : '长方形',
    form: 'recognize-name',
    params: { form: 'recognize-name', shape: square ? 'square' : 'rect' },
    unit: '',
    kpName: '认识长方形和正方形',
  }
}

function makeCountShapes(rng: Rng): GeomPiece {
  const l = randInt(rng, 5, 9)
  const w = randInt(rng, 2, 4)
  return {
    text: '右边的图形由两个长方形拼成，图中一共有几个长方形？',
    fig: joinedSpec(l, w),
    blank: 8,
    answer: '3',
    form: 'count-shapes',
    params: { form: 'count-shapes', parts: 2 },
    unit: '',
    kpName: '数图形个数',
  }
}

function makeClassify(rng: Rng): GeomPiece {
  const items: Array<'rect' | 'square'> = [
    rng() < 0.5 ? 'rect' : 'square',
    rng() < 0.5 ? 'rect' : 'square',
    rng() < 0.5 ? 'rect' : 'square',
  ]
  const squares = items.filter((item) => item === 'square').length
  return {
    text: '上面三个图形中，正方形有几个？',
    fig: rowSpec(items),
    blank: 8,
    answer: String(squares),
    form: 'classify',
    params: { form: 'classify', shapes: items.join(',') },
    unit: '',
    kpName: '按边的特征分类',
  }
}

function makeSticks(rng: Rng): GeomPiece {
  const side = randInt(rng, 2, 5)
  const sticks = side * 4
  return {
    text: `用 ${sticks} 根同样长的小棒正好搭成一个正方形，每条边用几根小棒？`,
    fig: squareSpec(6, 'cm', true),
    blank: 8,
    answer: String(side),
    form: 'sticks',
    params: { form: 'sticks', sticks },
    unit: '',
    kpName: '用小棒搭图形',
  }
}

function makeCompose(rng: Rng): GeomPiece {
  const s = randInt(rng, 3, 9)
  return {
    text: `两个完全一样的正方形拼成一个长方形，正方形的边长是 ${s} 厘米，拼成的长方形的长是多少厘米？`,
    fig: joinedSpec(s, s),
    blank: 15,
    answer: String(2 * s),
    form: 'compose',
    params: { form: 'compose', s },
    unit: '厘米',
    kpName: '图形拼组',
  }
}
// ---------- FigureKit 配方层：顶点规则、标注、周长闭式、可解性 ----------

const unitText = (unit: '厘米' | '米'): string => (unit === '米' ? 'm' : 'cm')

function polySpec(model: FigureModel): FigureSpec {
  return renderFigure(model)
}

/** 三边满足三角形不等式，且高不小于 2.2、顶点落在底边范围内（避免又扁又歪） */
function pickTriangle(rng: Rng): { a: number; b: number; c: number } {
  for (let attempt = 0; attempt < 120; attempt++) {
    const a = randInt(rng, 4, 12)
    const b = randInt(rng, 5, 13)
    const c = randInt(rng, 4, 12)
    if (a + b <= c || a + c <= b || b + c <= a) continue
    const x0 = (a * a + b * b - c * c) / (2 * b)
    const h = Math.sqrt(Math.max(0, a * a - x0 * x0))
    if (h < 2.2 || x0 < 0.2 || x0 > b - 0.2) continue
    return { a, b, c }
  }
  return { a: 5, b: 6, c: 7 }
}

function makeTrianglePerim(rng: Rng): GeomPiece {
  const { a, b, c } = pickTriangle(rng)
  // 底边 b 放在下方，顶点由两条腰 a、c 的余弦关系定出；三边都标在图上
  const x0 = (a * a + b * b - c * c) / (2 * b)
  const h = Math.sqrt(Math.max(0, a * a - x0 * x0))
  const model: FigureModel = {
    points: [
      [0, h],
      [b, h],
      [x0, 0],
    ],
    labels: [
      { edge: 0, text: `${b} ${unitText('厘米')}` },
      { edge: 1, text: `${c} ${unitText('厘米')}` },
      { edge: 2, text: `${a} ${unitText('厘米')}` },
    ],
  }
  return {
    text: '右面三角形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(a + b + c),
    form: 'triangle-perimeter',
    params: { form: 'triangle-perimeter', a, b, c },
    unit: '厘米',
    kpName: KP.triangle,
  }
}

function makeIsoscelesTrianglePerim(rng: Rng): GeomPiece {
  const b = randInt(rng, 4, 10)
  const a = randInt(rng, Math.ceil((b + 1) / 2), 12)
  const h = Math.sqrt(Math.max(0, a * a - (b / 2) * (b / 2)))
  const model: FigureModel = {
    // 等腰三角形：底 b，两腰 a；三条边都标出来，等长关系看得见
    points: [
      [0, h],
      [b, h],
      [b / 2, 0],
    ],
    labels: [
      { edge: 0, text: `${b} ${unitText('厘米')}` },
      { edge: 1, text: `${a} ${unitText('厘米')}` },
      { edge: 2, text: `${a} ${unitText('厘米')}` },
    ],
  }
  return {
    text: '右面等腰三角形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * a + b),
    form: 'isosceles-triangle-perimeter',
    params: { form: 'isosceles-triangle-perimeter', a, b },
    unit: '厘米',
    kpName: KP.isosceles,
  }
}

function makeEquilateralTrianglePerim(rng: Rng): GeomPiece {
  // 参数池从 8 档扩到 28 档，降低跨卷重复
  const a = randInt(rng, 3, 30)
  const h = (Math.sqrt(3) / 2) * a
  const model: FigureModel = {
    // 等边三角形只标一条边，题干说明“等边”，三边相等由定义推出
    points: [
      [0, h],
      [a, h],
      [a / 2, 0],
    ],
    labels: [{ edge: 0, text: `${a} ${unitText('厘米')}` }],
  }
  return {
    text: '右面等边三角形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(3 * a),
    form: 'equilateral-triangle-perimeter',
    params: { form: 'equilateral-triangle-perimeter', a },
    unit: '厘米',
    kpName: KP.equilateral,
  }
}

function makeParallelogramPerim(rng: Rng): GeomPiece {
  const a = randInt(rng, 6, 14)
  const b = randInt(rng, 4, 9)
  // 斜边取 1-2-√3 比例，保证图上斜边长度确实等于 b，又不至于太扁
  const dx = 0.5 * b
  const h = Math.sqrt(b * b - dx * dx)
  const model: FigureModel = {
    points: [
      [dx, 0],
      [a + dx, 0],
      [a, h],
      [0, h],
    ],
    labels: [
      { edge: 0, text: `${a} ${unitText('厘米')}` },
      { edge: 1, text: `${b} ${unitText('厘米')}` },
    ],
  }
  return {
    text: '右面平行四边形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (a + b)),
    form: 'parallelogram-perimeter',
    params: { form: 'parallelogram-perimeter', a, b },
    unit: '厘米',
    kpName: KP.parallelogram,
  }
}

const TRAPEZOID_TRIPLES: Array<{ dx: number; h: number; s: number }> = [
  { dx: 3, h: 4, s: 5 },
  { dx: 6, h: 8, s: 10 },
  { dx: 8, h: 6, s: 10 },
  { dx: 5, h: 12, s: 13 },
  { dx: 9, h: 12, s: 15 },
]

function makeTrapezoidPerim(rng: Rng): GeomPiece {
  const triple = TRAPEZOID_TRIPLES[randInt(rng, 0, TRAPEZOID_TRIPLES.length - 1)]!
  const a = randInt(rng, 3, 8)
  const b = a + triple.dx
  const model: FigureModel = {
    // 直角梯形：左边竖直，上底 a，下底 b，斜腰 s
    points: [
      [0, 0],
      [a, 0],
      [a + triple.dx, triple.h],
      [0, triple.h],
    ],
    labels: [
      { edge: 0, text: `${a} ${unitText('厘米')}` },
      { edge: 1, text: `${triple.s} ${unitText('厘米')}` },
      { edge: 2, text: `${b} ${unitText('厘米')}` },
      { edge: 3, text: `${triple.h} ${unitText('厘米')}` },
    ],
    rightAngles: [0, 3],
  }
  return {
    text: '右面梯形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(a + b + triple.h + triple.s),
    form: 'trapezoid-perimeter',
    params: { form: 'trapezoid-perimeter', a, b, h: triple.h, s: triple.s },
    unit: '厘米',
    kpName: KP.trapezoid,
  }
}

function makeLshapePerim(rng: Rng): GeomPiece {
  const L = randInt(rng, 8, 16)
  const W = randInt(rng, 6, 12)
  const a = randInt(rng, 3, L - 4)
  const b = randInt(rng, 3, W - 3)
  const model: FigureModel = {
    // 外框 L×W，右下缺 a×b：给 L/W/a/b，未知的右边 W-b、底边 L-a 由平移推出
    points: [
      [0, 0],
      [L, 0],
      [L, W - b],
      [L - a, W - b],
      [L - a, W],
      [0, W],
    ],
    labels: [
      { edge: 0, text: `${L} ${unitText('厘米')}` },
      { edge: 5, text: `${W} ${unitText('厘米')}` },
    ],
    dashed: [
      [
        [L, W - b],
        [L, W],
      ],
      [
        [L, W],
        [L - a, W],
      ],
    ],
  }
  return {
    text: `右面图形的右下角缺去一个长 ${a} 厘米、宽 ${b} 厘米的小长方形（图中虚线），它的周长是多少厘米？`,
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (L + W)),
    form: 'lshape-perimeter',
    params: { form: 'lshape-perimeter', L, W, a, b },
    unit: '厘米',
    kpName: KP.lshape,
  }
}

function makeConcavePerim(rng: Rng): GeomPiece {
  const L = randInt(rng, 10, 16)
  const W = randInt(rng, 9, 13)
  const a = randInt(rng, 3, L - 4)
  // 凹口深度至少 5cm，保证竖边上的标注不会压到凹口底边
  const d = randInt(rng, 5, W - 3)
  const half = (L - a) / 2
  const model: FigureModel = {
    // 顶部中间凹进 a×d：两条竖边各 d，凹口底 a；周长 = 2(L+W) + 2d
    points: [
      [0, 0],
      [half, 0],
      [half, d],
      [half + a, d],
      [half + a, 0],
      [L, 0],
      [L, W],
      [0, W],
    ],
    labels: [
      { edge: 2, text: `${a} ${unitText('厘米')}` },
      { edge: 5, text: `${W} ${unitText('厘米')}` },
      { edge: 6, text: `${L} ${unitText('厘米')}` },
    ],
  }
  return {
    text: `右面图形的凹口深 ${d} 厘米，它的周长是多少厘米？`,
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (L + W) + 2 * d),
    form: 'concave-perimeter',
    params: { form: 'concave-perimeter', L, W, a, d },
    unit: '厘米',
    kpName: KP.concave,
  }
}

function makeStaircasePerim(rng: Rng): GeomPiece {
  const a = randInt(rng, 2, 4)
  const b = randInt(rng, 2, 4)
  const n = randInt(rng, 3, 4)
  const width = n * a
  const height = n * b
  const points: Array<[number, number]> = [
    [0, height],
    [width, height],
    [width, 0],
  ]
  for (let i = 1; i <= n; i++) {
    points.push([width - i * a, (i - 1) * b])
    if (i < n) points.push([width - i * a, i * b])
  }
  const model: FigureModel = {
    points,
    // 只标总底宽与总高：级宽、级高由平移合并，周长 = 2(底宽 + 总高)
    labels: [
      { edge: 0, text: `${width} ${unitText('厘米')}` },
      { edge: 1, text: `${height} ${unitText('厘米')}` },
    ],
  }
  return {
    text: '右面图形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (width + height)),
    form: 'staircase-perimeter',
    params: {
      form: 'staircase-perimeter',
      n,
      a,
      b,
      bottom: width,
      right: height,
    },
    unit: '厘米',
    kpName: KP.staircase,
  }
}

function makeTshapePerim(rng: Rng): GeomPiece {
  const L = randInt(rng, 10, 16)
  const t = randInt(rng, 2, 4)
  const h = randInt(rng, 4, 8)
  const w = randInt(rng, 4, Math.max(4, L - 4))
  const half = (L + w) / 2
  const model: FigureModel = {
    // T 形：横条 L×t + 竖条 w×h；只标 L、t、h，竖条宽由平移抵消
    points: [
      [0, 0],
      [L, 0],
      [L, t],
      [half, t],
      [half, t + h],
      [L - half, t + h],
      [L - half, t],
      [0, t],
    ],
    labels: [
      { edge: 0, text: `${L} ${unitText('厘米')}` },
      { edge: 1, text: `${t} ${unitText('厘米')}` },
      { edge: 3, text: `${h} ${unitText('厘米')}` },
    ],
  }
  return {
    text: '右面图形的周长是多少厘米？',
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (L + t + h)),
    form: 't-shape-perimeter',
    params: { form: 't-shape-perimeter', L, t, h, w },
    unit: '厘米',
    kpName: KP.tshape,
  }
}

function makeJoinSquaresPerim(rng: Rng): GeomPiece {
  const n = randInt(rng, 2, 3)
  const s = randInt(rng, 3, 12)
  const width = n * s
  const seams: FigureModel['guides'] = []
  for (let i = 1; i < n; i++) {
    seams.push({ from: [i * s, 0], to: [i * s, s], stroke: 'dashed' })
  }
  const model: FigureModel = {
    points: [
      [0, 0],
      [width, 0],
      [width, s],
      [0, s],
    ],
    // 只在左边标一条边长 s；拼几个由题干说明，拼后周长 = 2(n+1)s
    labels: [{ edge: 3, text: `${s} ${unitText('厘米')}` }],
    guides: seams,
  }
  return {
    text: `${n === 2 ? '两个' : '三个'}完全一样的正方形拼成一个大长方形（如图）。这个大长方形的周长是多少厘米？`,
    fig: polySpec(model),
    blank: 15,
    answer: String(2 * (n + 1) * s),
    form: 'join-squares-perimeter',
    params: { form: 'join-squares-perimeter', n, s },
    unit: '厘米',
    kpName: KP.joinSquares,
  }
}

const cellKey = (cell: [number, number]): string => `${cell[0]},${cell[1]}`

/**
 * 枚举 2–5 格的全部自由多联骨牌（平移/旋转/翻转视为同一种），共 20 种，
 * 方格图形参数池由 4 个模板扩到 20 个。
 */
const POLYOMINO_TRANSFORMS: Array<(cell: [number, number]) => [number, number]> = [
  ([x, y]) => [x, y],
  ([x, y]) => [x, -y],
  ([x, y]) => [-x, y],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, x],
  ([x, y]) => [y, -x],
  ([x, y]) => [-y, x],
  ([x, y]) => [-y, -x],
]

function canonicalPolyomino(cells: Array<[number, number]>): { key: string; cells: Array<[number, number]> } {
  let best: { key: string; cells: Array<[number, number]> } | null = null
  for (const transform of POLYOMINO_TRANSFORMS) {
    const mapped = cells.map(transform)
    const minX = Math.min(...mapped.map((cell) => cell[0]))
    const minY = Math.min(...mapped.map((cell) => cell[1]))
    const normalized = mapped
      .map(([x, y]) => [x - minX, y - minY] as [number, number])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    const key = normalized.map((cell) => cell.join(',')).join('|')
    if (best == null || key < best.key) best = { key, cells: normalized }
  }
  return best!
}

function enumeratePolyominoes(maxSize: number): Array<Array<[number, number]>> {
  let frontier = new Map<string, Array<[number, number]>>()
  const all = new Map<string, Array<[number, number]>>()
  const start = canonicalPolyomino([[0, 0]])
  frontier.set(start.key, start.cells)
  all.set(start.key, start.cells)
  for (let size = 2; size <= maxSize; size++) {
    const next = new Map<string, Array<[number, number]>>()
    for (const cells of frontier.values()) {
      const set = new Set(cells.map(cellKey))
      for (const [x, y] of cells) {
        for (const [nx, ny] of [
          [x, y - 1],
          [x + 1, y],
          [x, y + 1],
          [x - 1, y],
        ] as Array<[number, number]>) {
          if (set.has(cellKey([nx, ny]))) continue
          const candidate = canonicalPolyomino([...cells, [nx, ny]])
          if (!next.has(candidate.key)) next.set(candidate.key, candidate.cells)
        }
      }
    }
    for (const [key, cells] of next) all.set(key, cells)
    frontier = next
  }
  return [...all.entries()]
    .filter(([, cells]) => cells.length >= 2)
    .sort((a, b) => a[1].length - b[1].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, cells]) => cells)
}

const GRID_TEMPLATES: Array<Array<[number, number]>> = enumeratePolyominoes(5)

/** 单位方格拼成的连通图形：取外轮廓（用于绘制与数周长） */
function polyominoBoundary(cells: Array<[number, number]>): Array<[number, number]> {
  const set = new Set(cells.map(cellKey))
  const edges = new Map<string, { from: [number, number]; to: [number, number] }>()
  const add = (from: [number, number], to: [number, number]): void => {
    edges.set(`${from[0]},${from[1]}`, { from, to })
  }
  for (const [x, y] of cells) {
    if (!set.has(`${x},${y - 1}`)) add([x, y], [x + 1, y])
    if (!set.has(`${x + 1},${y}`)) add([x + 1, y], [x + 1, y + 1])
    if (!set.has(`${x},${y + 1}`)) add([x + 1, y + 1], [x, y + 1])
    if (!set.has(`${x - 1},${y}`)) add([x, y + 1], [x, y])
  }
  const start = edges.values().next().value as { from: [number, number]; to: [number, number] } | undefined
  if (start == null) return []
  const loop: Array<[number, number]> = []
  let current = start
  for (let guard = 0; guard < 200; guard++) {
    loop.push(current.from)
    if (current.to[0] === start.from[0] && current.to[1] === start.from[1]) break
    const next = edges.get(`${current.to[0]},${current.to[1]}`)
    if (next == null) break
    current = next
  }
  return loop
}

/** 相邻方格之间的公共边画成细线，读图时能看出由几个小方格拼成 */
function polyominoGuides(cells: Array<[number, number]>): FigureModel['guides'] {
  const set = new Set(cells.map(cellKey))
  const guides: NonNullable<FigureModel['guides']> = []
  for (const [x, y] of cells) {
    if (set.has(`${x + 1},${y}`)) guides.push({ from: [x + 1, y], to: [x + 1, y + 1], stroke: 'thin' })
    if (set.has(`${x},${y + 1}`)) guides.push({ from: [x, y + 1], to: [x + 1, y + 1], stroke: 'thin' })
  }
  return guides
}

function makeGridPerim(rng: Rng): GeomPiece {
  const cells = GRID_TEMPLATES[randInt(rng, 0, GRID_TEMPLATES.length - 1)]!
  const boundary = polyominoBoundary(cells)
  return {
    text: '右面图形由小方格拼成，每个小方格的边长是 1 厘米。这个图形的周长是多少厘米？',
    fig: polySpec({ points: boundary, guides: polyominoGuides(cells) }),
    blank: 15,
    answer: String(boundary.length),
    form: 'grid-perimeter',
    params: { form: 'grid-perimeter', cells: cells.map((cell) => cell.join(',')).join('|') },
    unit: '厘米',
    kpName: KP.grid,
  }
}

/**
 * 数三角形：底边上有 k 个分点，顶点 C 与每个分点都连线段。
 * 三角形必须取 C 加底边上两点，答案 C(k+2,2)，只由 k 独立重算。
 */
function makeCountTriangles(rng: Rng): GeomPiece {
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
  const answer = ((k + 1) * (k + 2)) / 2
  return {
    text: '图中由已有线段围成的三角形一共有多少个？',
    fig: renderSegmentScene({ segments }),
    blank: 8,
    answer: String(answer),
    form: 'count-triangles',
    params: { form: 'count-triangles', k, base, height, apex: apexX },
    unit: '',
    kpName: KP.countTriangles,
  }
}

/**
 * 数长方形：m×n 的完整方格网，所有边都落在已有网格线上。
 * 答案 C(m+1,2)×C(n+1,2)，只由 m、n 独立重算。
 */
function makeCountRectangles(rng: Rng): GeomPiece {
  // 旋转视为同一种网格：固定 m ≥ n，2–4 共 6 种（上限收到 4，避免孩子数到眼花）
  const a = randInt(rng, 2, 4)
  const b = randInt(rng, 2, 4)
  const m = Math.max(a, b)
  const n = Math.min(a, b)
  const segments: Array<{ from: [number, number]; to: [number, number] }> = []
  for (let x = 0; x <= m; x++) {
    segments.push({ from: [x, 0], to: [x, n] })
  }
  for (let y = 0; y <= n; y++) {
    segments.push({ from: [0, y], to: [m, y] })
  }
  const answer = ((m * (m + 1)) / 2) * ((n * (n + 1)) / 2)
  return {
    text: '图中由已有线段围成的长方形（正方形也算长方形）一共有多少个？',
    fig: renderSegmentScene({ segments }),
    blank: 8,
    answer: String(answer),
    form: 'count-rectangles',
    params: { form: 'count-rectangles', m, n },
    unit: '',
    kpName: KP.countRectangles,
  }
}

/** 各配方在图上必须标出的已知量，按标注顺序排列（供测试与核对脚本逐题验证“标注足够”） */
export const GEOM_FIGURE_GIVENS: Partial<Record<GeomForm, string[]>> = {
  'triangle-perimeter': ['b', 'c', 'a'],
  'isosceles-triangle-perimeter': ['b', 'a', 'a'],
  'equilateral-triangle-perimeter': ['a'],
  'parallelogram-perimeter': ['a', 'b'],
  'trapezoid-perimeter': ['a', 's', 'b', 'h'],
  'lshape-perimeter': ['L', 'W'],
  'concave-perimeter': ['a', 'W', 'L'],
  'staircase-perimeter': ['bottom', 'right'],
  't-shape-perimeter': ['L', 't', 'h'],
  'join-squares-perimeter': ['s'],
}

/** 图上标注是否覆盖了该配方全部已知量；返回缺失项（空数组 = 信息足够） */
export function geomMissingLabels(piece: GeomPiece): string[] {
  const givens = GEOM_FIGURE_GIVENS[piece.form]
  if (givens == null) return []
  const unit = unitText(piece.unit === '米' ? '米' : '厘米')
  const labels = piece.fig.labels ?? []
  const missing: string[] = []
  if (labels.length < givens.length) missing.push(`标注数 ${labels.length} < ${givens.length}`)
  givens.forEach((key, index) => {
    const value = Number(piece.params[key])
    if (!Number.isFinite(value)) {
      missing.push(`${key}=?`)
      return
    }
    const label = labels[index]
    if (label == null || label.text.replace(/\s+/g, '') !== `${value}${unit}`) {
      missing.push(`${key}=${value}（第 ${index + 1} 条标注不对应）`)
    }
  })
  // 凹口深度放在题干里（凹口内放不下标注，且易与 a 相撞）
  if (piece.form === 'concave-perimeter') {
    const d = Number(piece.params.d)
    if (!Number.isFinite(d) || !piece.text.includes(`${d} 厘米`)) missing.push(`d=${d}（题干未说明）`)
  }
  // 方格图形：单位方格边长由题干交代
  if (piece.form === 'grid-perimeter' && !piece.text.includes('1 厘米')) missing.push('方格边长未说明')
  // 题干承载已知量的配方：逐条核对题面是否真的给了
  const promptChecks: Partial<Record<GeomForm, Array<[string, string]>>> = {
    'reverse-rect': [['p', ' 厘米']],
    'reverse-square': [['p', ' 厘米']],
    'lshape-perimeter': [
      ['a', ' 厘米'],
      ['b', ' 厘米'],
    ],
    fence: [
      ['l', ' 米'],
      ['w', ' 米'],
    ],
    combine: [
      ['l', ' 厘米'],
      ['w', ' 厘米'],
    ],
    ratio: [['w', ' 厘米']],
  }
  for (const [key, suffix] of promptChecks[piece.form] ?? []) {
    const value = Number(piece.params[key])
    if (!Number.isFinite(value) || !piece.text.includes(`${value}${suffix}`)) {
      missing.push(`${key}=${value}（题干未说明）`)
    }
  }
  if (piece.form === 'ratio') {
    const k = Number(piece.params.k)
    if (!Number.isFinite(k) || !piece.text.includes(`${k} 倍`)) missing.push(`k=${k}（题干未说明）`)
  }
  if (piece.form === 'join-squares-perimeter') {
    const n = Number(piece.params.n)
    const word = n === 3 ? '三个' : '两个'
    if (!piece.text.includes(word)) missing.push(`n=${n}（题干未说明拼几个）`)
  }
  return missing
}

/** 3A-U3 认识图形：只做认名称、数个数、按边分类、小棒、拼组，不涉及周长计算 */
const U3_FORMS: Record<Level, GeomForm[]> = {
  L1: ['recognize-name', 'count-shapes', 'count-triangles', 'count-rectangles'],
  L2: ['count-shapes', 'classify', 'recognize-name', 'count-triangles', 'count-rectangles'],
  L3: ['sticks', 'compose', 'classify', 'count-triangles', 'count-rectangles'],
}

/** 3A-U8 数学广场：数图形玩法，只画图、答案按参数独立重算 */
const U8_FORMS: Record<Level, GeomForm[]> = {
  L1: ['count-triangles', 'count-rectangles'],
  L2: ['count-triangles', 'count-rectangles'],
  L3: ['count-triangles', 'count-rectangles'],
}

function formsForU6(level: Level): GeomForm[] {
  if (level === 'L1') return ['rect-perimeter', 'square-perimeter', 'triangle-perimeter']
  if (level === 'L2') {
    return [
      'reverse-rect',
      'reverse-square',
      'fence',
      'rect-perimeter',
      'triangle-perimeter',
      'isosceles-triangle-perimeter',
      'equilateral-triangle-perimeter',
      'parallelogram-perimeter',
      'lshape-perimeter',
    ]
  }
  return [
    'combine',
    'ratio',
    'fence',
    'reverse-rect',
    'trapezoid-perimeter',
    'concave-perimeter',
    'staircase-perimeter',
    't-shape-perimeter',
    'join-squares-perimeter',
    'grid-perimeter',
  ]
}

/** 某单元在某难度下可出的图形形态；U3/U6/U8 之外为空 */
export function geomUnitForms(unitId: string, level: Level): GeomForm[] {
  if (unitId === '3A-U3') return U3_FORMS[level]
  if (unitId === '3A-U6') return formsForU6(level)
  if (unitId === '3A-U8') return U8_FORMS[level]
  // U9 是整册复习：继承 U3 认识图形、U6 周长与 U8 数图形
  if (unitId === '3A-U9') {
    const forms: GeomForm[] = []
    for (const form of [...U3_FORMS[level], ...formsForU6(level), ...U8_FORMS[level]]) {
      if (!forms.includes(form)) forms.push(form)
    }
    return forms
  }
  return []
}

/** 三上按所选单元合并形态；三下保持原有权重复习形态 */
function formsFor(grade: Grade, unitIds: string[], level: Level): GeomForm[] {
  if (grade === '3B') return formsForU6(level)
  const forms: GeomForm[] = []
  for (const unitId of unitIds) {
    for (const form of geomUnitForms(unitId, level)) {
      if (!forms.includes(form)) forms.push(form)
    }
  }
  return forms
}

function makeOne(form: GeomForm, rng: Rng): GeomPiece {
  switch (form) {
    case 'rect-perimeter':
      return makeRectPerim(rng)
    case 'square-perimeter':
      return makeSquarePerim(rng)
    case 'reverse-rect':
      return makeReverseRect(rng)
    case 'reverse-square':
      return makeReverseSquare(rng)
    case 'fence':
      return makeFence(rng)
    case 'combine':
      return makeCombine(rng)
    case 'ratio':
      return makeRatio(rng)
    case 'recognize-name':
      return makeRecognizeName(rng)
    case 'count-shapes':
      return makeCountShapes(rng)
    case 'classify':
      return makeClassify(rng)
    case 'sticks':
      return makeSticks(rng)
    case 'compose':
      return makeCompose(rng)
    case 'triangle-perimeter':
      return makeTrianglePerim(rng)
    case 'isosceles-triangle-perimeter':
      return makeIsoscelesTrianglePerim(rng)
    case 'equilateral-triangle-perimeter':
      return makeEquilateralTrianglePerim(rng)
    case 'parallelogram-perimeter':
      return makeParallelogramPerim(rng)
    case 'trapezoid-perimeter':
      return makeTrapezoidPerim(rng)
    case 'lshape-perimeter':
      return makeLshapePerim(rng)
    case 'concave-perimeter':
      return makeConcavePerim(rng)
    case 'staircase-perimeter':
      return makeStaircasePerim(rng)
    case 't-shape-perimeter':
      return makeTshapePerim(rng)
    case 'join-squares-perimeter':
      return makeJoinSquaresPerim(rng)
    case 'grid-perimeter':
      return makeGridPerim(rng)
    case 'count-triangles':
      return makeCountTriangles(rng)
    case 'count-rectangles':
      return makeCountRectangles(rng)
  }
}

/** 跨卷记忆键：fig 规格（短哈希）+ 关键数值 + 求解目标 */
export function geomKey(piece: GeomPiece): string {
  const params = Object.keys(piece.params)
    .sort()
    .map((key) => `${key}=${piece.params[key]}`)
    .join('&')
  return `geom:${piece.form}:${shortHash(stableStringify(piece.fig))}:${params}`
}

/**
 * 生成 count 道互不重复的图形题。
 * 同一卷内题干逐字去重；跨卷优先避开最近窗口出现过的题，形态池耗尽时按最久未用轮换。
 */
export function generateGeom(options: GeomOptions): {
  items: GeomPiece[]
  notes: string[]
  crossReused: number
} {
  const { grade, unitIds, level, count, seed, memory } = options
  const forms = formsFor(grade, unitIds, level)
  if (forms.length === 0) {
    return {
      items: [],
      notes: ['图形与周长：所选单元不含认识图形（U3）或周长（U6）内容，已跳过'],
      crossReused: 0,
    }
  }
  const rng = createRng(seed)
  const items: GeomPiece[] = []
  const used = new Set<string>()
  const exhausted = new Set<GeomForm>()
  // U3 单开时数图形只做少量补充，避免挤掉该单元原有的认图形形态
  const countForms: GeomForm[] = ['count-triangles', 'count-rectangles']
  const countCap =
    unitIds.includes('3A-U3') && !unitIds.includes('3A-U8')
      ? Math.max(1, Math.ceil(count / 5))
      : Number.POSITIVE_INFINITY
  let countUsed = 0
  // 数长方形网格收到 2–4 后只有 6 种，U8/U9 里同样限流，避免跨卷反复撞同一批
  const rectCap =
    unitIds.includes('3A-U8') || unitIds.includes('3A-U3')
      ? Math.max(1, Math.ceil(count / 5))
      : Number.POSITIVE_INFINITY
  let rectUsed = 0
  let crossReused = 0
  const maxAttemptsPerItem = 240
  let cursor = 0

  // 逐题轮转形态；某形态参数池耗尽时跳过该形态，继续用其他形态出满，
  // 只有全部形态都耗尽才少出（不再“一个形态耗尽就整卷停笔”）
  while (items.length < count && exhausted.size < forms.length) {
    const form = forms[cursor % forms.length]
    cursor++
    if (exhausted.has(form)) continue
    if (countForms.includes(form) && countUsed >= countCap) {
      exhausted.add(form)
      continue
    }
    if (form === 'count-rectangles' && rectUsed >= rectCap) {
      exhausted.add(form)
      continue
    }

    let fresh: GeomPiece | null = null
    let stale: GeomPiece | null = null
    for (let attempt = 0; attempt < maxAttemptsPerItem; attempt++) {
      const piece = makeOne(form, rng)
      const key = geomKey(piece)
      if (used.has(key)) continue
      if (memory?.recentlyUsed(key)) {
        if (stale == null || memory.lastPaper(key) < memory.lastPaper(geomKey(stale))) {
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
    const key = geomKey(chosen)
    if (memory?.crossPaperUsed(key)) crossReused++
    memory?.record(key)
    used.add(key)
    items.push(chosen)
    if (countForms.includes(chosen.form)) countUsed++
    if (chosen.form === 'count-rectangles') rectUsed++
  }

  const notes: string[] = []
  if (items.length < count) notes.push(`本版图形规则最多可出 ${items.length} 道不重复题`)
  return { items, notes, crossReused }
}
