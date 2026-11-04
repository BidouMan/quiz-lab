/**
 * 3A-U3 三角形与四边形 · 填空 · 30 条骨架（L1 基线）。
 *
 * 口径（沪教版三上）：
 * - 角的初步认识：直角 / 锐角 / 钝角辨认，不引入角的度量，不写“90 度”；
 * - 三角形按角分类：锐角三角形 / 直角三角形 / 钝角三角形；
 * - 四边形初步：长方形、正方形、平行四边形的辨认与特征；
 * - 图形拼摆：两个直角三角形拼长方形、正方形沿对角线剪开、2×2 方格数正方形；
 * - 不涉及面积、周长计算，不涉及三角形内角和推导。
 *
 * 三档分工（L2/L3 写在 u3-shapes-fill.bands.ts）：
 * - L1 单点辨认：一个角 / 一个三角形 / 一个四边形，直接判断；
 * - L2 两步比较或分类：两个图形二选一、按特征找图形、两个图形的边角相加；
 * - L3 综合判断或多图形组合：三个图形计数、剪拼后的图形判断、组合图形数图形。
 */
import type { Skeleton } from './types.ts'
import { R } from './bands.ts'
import {
  anglesFigure,
  quadsFigure,
  trianglesFigure,
  twoSquares,
  rectWithDiagonal,
  squareWithDiagonal,
  paraWithDiagonal,
  mixedFigure,
  type AngleKind,
  type TriangleKind,
  type QuadKind,
} from './u3-figures.ts'

const ANGLE_KINDS: AngleKind[] = ['acute', 'right', 'obtuse']
const TRIANGLE_KINDS: TriangleKind[] = ['acute', 'right', 'obtuse']

const SIZE = () => ({ s: R(80, 130) })
const WITH_K = (max: number) => ({ k: R(0, max), s: R(80, 130) })

export const U3_SHAPES_FILL_SKELETONS: Skeleton[] = [
  // ============ 直接辨认（5） ============
  {
    id: 'u3f-d1',
    practice: 'direct',
    template: '{person}在{place}画了一个角（如图），它是 ____ 角。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(2),
    answerChoices: [['锐角', '直角', '钝角']],
    figure: (p) => anglesFigure([ANGLE_KINDS[p.k]], p.s),
  },
  {
    id: 'u3f-d2',
    practice: 'direct',
    template: '{person}在{place}拼了一个三角形（如图），它是 ____ 三角形。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(2),
    answerChoices: [['锐角三角形', '直角三角形', '钝角三角形']],
    figure: (p) => trianglesFigure([TRIANGLE_KINDS[p.k]], p.s),
  },
  {
    id: 'u3f-d3',
    practice: 'direct',
    template: '{person}在{place}摆了一个四边形（如图），它是 ____。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['平行四边形', '长方形', '三角形']],
    figure: (p) => quadsFigure(['para'], p.s),
  },
  {
    id: 'u3f-d4',
    practice: 'direct',
    template: '{person}在{place}画了一个长方形（如图），它有 ____ 条边。',
    asks: [],
    formulas: ['4'],
    unit: '',
    slots: SIZE(),
    figure: (p) => quadsFigure(['rect'], p.s),
  },
  {
    id: 'u3f-d5',
    practice: 'direct',
    template: '{person}在{place}围了一个三角形（如图），它有 ____ 条边。',
    asks: [],
    formulas: ['3'],
    unit: '',
    slots: SIZE(),
    figure: (p) => trianglesFigure(['acute'], p.s),
  },

  // ============ 逆向求（5） ============
  {
    id: 'u3f-i1',
    practice: 'inverse',
    template: '一个角比直角小，它是 ____ 角。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['锐角', '直角', '钝角']],
  },
  {
    id: 'u3f-i2',
    practice: 'inverse',
    template: '一个三角形有一个直角，它是 ____ 三角形。',
    asks: [],
    formulas: ['1'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['锐角三角形', '直角三角形', '钝角三角形']],
  },
  {
    id: 'u3f-i3',
    practice: 'inverse',
    template: '一个四边形四条边都相等，四个角都是直角，它是 ____。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['正方形', '平行四边形', '三角形']],
  },
  {
    id: 'u3f-i4',
    practice: 'inverse',
    template: '下面三个角中，直角是 ____ 号。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(2),
    answerChoices: [['①', '②', '③']],
    figure: (p) => {
      const lanes: AngleKind[] = ['acute', 'acute', 'acute']
      lanes[p.k] = 'right'
      return anglesFigure(lanes, p.s)
    },
  },
  {
    id: 'u3f-i5',
    practice: 'inverse',
    template: '下面三个四边形中，四条边都相等的是 ____ 号。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(2),
    answerChoices: [['①', '②', '③']],
    figure: (p) => {
      const lanes: QuadKind[] = ['rect', 'rect', 'rect']
      lanes[p.k] = 'square'
      return quadsFigure(lanes, p.s)
    },
  },

  // ============ 比较与最值（5） ============
  {
    id: 'u3f-c1',
    practice: 'compare',
    template: '{person}在{place}画了两个角（如图），较大的角是 ____ 号。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(1),
    answerChoices: [['①', '②']],
    figure: (p) => anglesFigure(p.k === 0 ? ['obtuse', 'acute'] : ['acute', 'obtuse'], p.s),
  },
  {
    id: 'u3f-c2',
    practice: 'compare',
    template: '{person}在{place}拼了两个三角形（如图），有直角的是 ____ 号。',
    asks: [],
    formulas: ['k'],
    unit: '',
    slots: WITH_K(1),
    answerChoices: [['①', '②']],
    figure: (p) => trianglesFigure(p.k === 0 ? ['right', 'acute'] : ['acute', 'right'], p.s),
  },
  {
    id: 'u3f-c3',
    practice: 'compare',
    template: '长方形和正方形相比，四条边都相等的是 ____。',
    asks: [],
    formulas: ['1'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['长方形', '正方形']],
    figure: (p) => quadsFigure(['rect', 'square'], p.s),
  },
  {
    id: 'u3f-c4',
    practice: 'compare',
    template: '三角形有 3 条边，四边形比三角形多 ____ 条边。',
    asks: [],
    formulas: ['1'],
    unit: '',
    slots: SIZE(),
    figure: (p) => quadsFigure(['rect'], p.s),
  },
  {
    id: 'u3f-c5',
    practice: 'compare',
    template: '一个三角形和一个四边形，____ 的边多。',
    asks: [],
    formulas: ['1'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['三角形', '四边形']],
    figure: (p) => quadsFigure(['rect'], p.s),
  },

  // ============ 组合与拆分（5） ============
  {
    id: 'u3f-p1',
    practice: 'compose',
    template: '两个完全一样的直角三角形照图拼在一起，拼成的是 ____。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['长方形', '三角形', '平行四边形']],
    figure: (p) => rectWithDiagonal(p.s),
  },
  {
    id: 'u3f-p2',
    practice: 'compose',
    template: '两个完全一样的正方形照图拼在一起，拼成的是 ____。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['长方形', '正方形', '三角形']],
    figure: (p) => twoSquares(p.s),
  },
  {
    id: 'u3f-p3',
    practice: 'compose',
    template: '一个正方形沿对角线剪开，得到 ____ 个三角形。',
    asks: [],
    formulas: ['2'],
    unit: '',
    slots: SIZE(),
    figure: (p) => squareWithDiagonal(p.s),
  },
  {
    id: 'u3f-p4',
    practice: 'compose',
    template: '一个平行四边形沿对角线剪开，得到两个 ____。',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['三角形', '四边形', '正方形']],
    figure: (p) => paraWithDiagonal(p.s),
  },
  {
    id: 'u3f-p5',
    practice: 'compose',
    template: '图中的长方形被一条对角线分成两个三角形，一共有 ____ 条边。',
    asks: [],
    formulas: ['6'],
    unit: '',
    slots: SIZE(),
    figure: (p) => rectWithDiagonal(p.s),
  },

  // ============ 多步合成（5） ============
  {
    id: 'u3f-m1',
    practice: 'multistep',
    template: '一个三角形有 ____ 个角。',
    asks: [],
    formulas: ['3'],
    unit: '',
    slots: SIZE(),
    figure: (p) => trianglesFigure(['acute'], p.s),
  },
  {
    id: 'u3f-m2',
    practice: 'multistep',
    template: '一个四边形有 ____ 条边。',
    asks: [],
    formulas: ['4'],
    unit: '',
    slots: SIZE(),
    figure: (p) => quadsFigure(['rect'], p.s),
  },
  {
    id: 'u3f-m3',
    practice: 'multistep',
    template: '一个直角三角形有 ____ 个直角。',
    asks: [],
    formulas: ['1'],
    unit: '',
    slots: SIZE(),
    figure: (p) => trianglesFigure(['right'], p.s),
  },
  {
    id: 'u3f-m4',
    practice: 'multistep',
    template: '一个正方形有 ____ 个直角。',
    asks: [],
    formulas: ['4'],
    unit: '',
    slots: SIZE(),
    figure: (p) => quadsFigure(['square'], p.s),
  },
  {
    id: 'u3f-m5',
    practice: 'multistep',
    template: '一个长方形和一个三角形（如图），一共有 ____ 个角。',
    asks: [],
    formulas: ['7'],
    unit: '',
    slots: SIZE(),
    figure: (p) => mixedFigure(['rect', 'tri'], p.s),
  },

  // ============ 判断与验证（5） ============
  {
    id: 'u3f-j1',
    practice: 'judge',
    template: '下面的角是直角吗？____',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['是', '不是']],
    figure: (p) => anglesFigure(['right'], p.s),
  },
  {
    id: 'u3f-j2',
    practice: 'judge',
    template: '下面的三角形有直角吗？____',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['有', '没有']],
    figure: (p) => trianglesFigure(['right'], p.s),
  },
  {
    id: 'u3f-j3',
    practice: 'judge',
    template: '下面的图形是四边形吗？____',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['是', '不是']],
    figure: (p) => quadsFigure(['para'], p.s),
  },
  {
    id: 'u3f-j4',
    practice: 'judge',
    template: '三角形有 3 条边。____',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['对', '错']],
    figure: (p) => trianglesFigure(['acute'], p.s),
  },
  {
    id: 'u3f-j5',
    practice: 'judge',
    template: '下面的图形是三角形吗？____',
    asks: [],
    formulas: ['0'],
    unit: '',
    slots: SIZE(),
    answerChoices: [['是', '不是']],
    figure: (p) => trianglesFigure(['obtuse'], p.s),
  },
]
