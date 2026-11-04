/**
 * 3A-U3 三角形与四边形 · 填空 · L2 / L3 变体。
 *
 * 分层不是换数字：
 * - L2 一律增加“第二个对象”或“第二个条件”（两图比较、按两条特征找图、两边/角相加）；
 * - L3 一律进入“三图计数 / 剪拼后判断 / 组合图形里数图形 / 说理判断”。
 */
import { band, R } from './bands.ts'
import type { SkeletonBand } from './types.ts'
import {
  anglesFigure,
  quadsFigure,
  trianglesFigure,
  mixedFigure,
  rectWithDiagonal,
  squareWithDiagonal,
  paraWithDiagonal,
  rectCut,
  grid2x2,
  twoSquares,
  mixedGridFigure,
  sameOpeningAngles,
  type QuadKind,
  type MixedKind,
} from './u3-figures.ts'

const SIZE = () => ({ s: R(80, 130) })
const WITH_K = (max: number) => ({ k: R(0, max), s: R(80, 130) })

const ANGLE_CHOICES = ['锐角', '直角', '钝角']
const TRI_CHOICES = ['锐角三角形', '直角三角形', '钝角三角形']

export const U3_SHAPES_FILL_BANDS: Record<string, { L2: SkeletonBand; L3: SkeletonBand }> = {
  'u3f-d1': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}画了两个角（如图），比直角大的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => anglesFigure(p.k === 0 ? ['obtuse', 'acute'] : ['acute', 'obtuse'], p.s),
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}画了三个角（如图），直角有 ____ 个，钝角有 ____ 个。',
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [],
      figure: (p) => anglesFigure(['right', 'right', 'obtuse'], p.s),
    }),
  },

  'u3f-d2': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}拼了两个三角形（如图），有直角的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => trianglesFigure(p.k === 0 ? ['right', 'acute'] : ['acute', 'right'], p.s),
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}拼了三个三角形（如图），锐角三角形有 ____ 个，钝角三角形有 ____ 个。',
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute', 'obtuse'], p.s),
    }),
  },

  'u3f-d3': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}摆了两个四边形（如图），四条边都相等的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => quadsFigure(p.k === 0 ? ['square', 'rect'] : ['rect', 'square'], p.s),
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}摆了三个四边形（如图），四条边都相等的有 ____ 个，只有对边相等的有 ____ 个。',
      formulas: ['1', '2'],
      unit: '',
      answerChoices: [],
      figure: (p) => quadsFigure(['rect', 'square', 'rect'], p.s),
    }),
  },

  'u3f-d4': {
    L2: band(SIZE(), {
      template: '{person}在{place}画了两个正方形（如图），一共有 ____ 个直角。',
      formulas: ['8'],
      unit: '',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}画了一个长方形和一个直角三角形（如图），一共有 ____ 个直角。',
      formulas: ['5'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rightTri'], p.s),
    }),
  },

  'u3f-d5': {
    L2: band(SIZE(), {
      template: '{person}在{place}围了一个三角形和一个四边形（如图），一共有 ____ 条边。',
      formulas: ['7'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把长方形沿对角线剪成两个三角形（如图），两个三角形一共有 ____ 条边。',
      formulas: ['6'],
      unit: '',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
    }),
  },

  'u3f-i1': {
    L2: band(SIZE(), {
      template: '一个角比直角大，它是 ____ 角；一个角比直角小，它是 ____ 角。',
      formulas: ['2', '0'],
      unit: '',
      answerChoices: [ANGLE_CHOICES, ANGLE_CHOICES],
    }),
    L3: band(SIZE(), {
      template: '一个角的两条边张得比直角开，它是 ____ 角；张得和直角一样开，它是 ____ 角。',
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [ANGLE_CHOICES, ANGLE_CHOICES],
    }),
  },

  'u3f-i2': {
    L2: band(SIZE(), {
      template: '一个三角形没有直角，三个角都比直角小，它是 ____ 三角形。',
      formulas: ['0'],
      unit: '',
      answerChoices: [TRI_CHOICES],
    }),
    L3: band(SIZE(), {
      template: '一个三角形有一个钝角，另外两个角都是锐角，它是 ____ 三角形。',
      formulas: ['2'],
      unit: '',
      answerChoices: [TRI_CHOICES],
    }),
  },

  'u3f-i3': {
    L2: band(SIZE(), {
      template: '一个四边形只有对边相等，四个角都是直角，它是 ____。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['正方形', '长方形', '平行四边形']],
    }),
    L3: band(SIZE(), {
      template: '一个四边形两组对边都相等，四个角都不是直角，它是 ____。',
      formulas: ['2'],
      unit: '',
      answerChoices: [['正方形', '长方形', '平行四边形']],
    }),
  },

  'u3f-i4': {
    L2: band(SIZE(), {
      template: '下面三个三角形中，钝角三角形是 ____ 号，锐角三角形是 ____ 号。',
      formulas: ['1', '2'],
      unit: '',
      answerChoices: [['①', '②', '③'], ['①', '②', '③']],
      figure: (p) => trianglesFigure(['right', 'obtuse', 'acute'], p.s),
    }),
    L3: band(WITH_K(2), {
      template: '下面三个图形中，不是四边形的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: MixedKind[] = ['rect', 'para', 'square']
        lanes[p.k] = 'tri'
        return mixedFigure(lanes, p.s)
      },
    }),
  },

  'u3f-i5': {
    L2: band(WITH_K(2), {
      template: '下面三个四边形中，相邻两边不相等、四个角都是直角的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: QuadKind[] =
          p.k === 0 ? ['rect', 'square', 'para'] : p.k === 1 ? ['square', 'rect', 'para'] : ['square', 'para', 'rect']
        return quadsFigure(lanes, p.s)
      },
    }),
    L3: band(WITH_K(2), {
      template: '下面三个四边形中，四个角都不是直角的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: QuadKind[] =
          p.k === 0 ? ['para', 'rect', 'square'] : p.k === 1 ? ['rect', 'para', 'square'] : ['rect', 'square', 'para']
        return quadsFigure(lanes, p.s)
      },
    }),
  },

  'u3f-c1': {
    L2: band(SIZE(), {
      template: '①号是锐角，②号是钝角（如图），较大的角是 ____ 号。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => anglesFigure(['acute', 'obtuse'], p.s),
    }),
    L3: band(SIZE(), {
      template: '三个角中（如图），最大的是 ____ 号，最小的是 ____ 号。',
      formulas: ['1', '0'],
      unit: '',
      answerChoices: [['①', '②', '③'], ['①', '②', '③']],
      figure: (p) => anglesFigure(['acute', 'obtuse', 'right'], p.s),
    }),
  },

  'u3f-c2': {
    L2: band(SIZE(), {
      template: '①号是直角三角形，②号是钝角三角形（如图），有钝角的是 ____ 号。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => trianglesFigure(['right', 'obtuse'], p.s),
    }),
    L3: band(SIZE(), {
      template: '三个三角形中（如图），锐角三角形有 ____ 个，直角三角形有 ____ 个。',
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute', 'right'], p.s),
    }),
  },

  'u3f-c3': {
    L2: band(SIZE(), {
      template: '平行四边形和长方形相比（如图），四个角都是直角的是 ____。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['平行四边形', '长方形']],
      figure: (p) => quadsFigure(['para', 'rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '三个四边形中（如图），四条边都相等的有 ____ 个，四个角都是直角的有 ____ 个。',
      formulas: ['1', '3'],
      unit: '',
      answerChoices: [],
      figure: (p) => quadsFigure(['rect', 'square', 'rect'], p.s),
    }),
  },

  'u3f-c4': {
    L2: band(SIZE(), {
      template: '一个三角形和一个四边形（如图），边一共有 ____ 条。',
      formulas: ['7'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '一个长方形和一个三角形（如图），边数相差 ____ 条，角数相差 ____ 个。',
      formulas: ['1', '1'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'tri'], p.s),
    }),
  },

  'u3f-c5': {
    L2: band(SIZE(), {
      template: '两个三角形和一个四边形（如图），一共有 ____ 条边。',
      formulas: ['10'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'tri', 'rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '一个三角形、一个四边形和一个长方形（如图），边一共有 ____ 条，角一共有 ____ 个。',
      formulas: ['11', '11'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect', 'rect'], p.s),
    }),
  },

  'u3f-p1': {
    L2: band(SIZE(), {
      template: '一个长方形沿对角线剪开（如图），得到两个完全一样的 ____ 三角形。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['锐角', '直角', '钝角']],
      figure: (p) => rectWithDiagonal(p.s),
    }),
    L3: band(SIZE(), {
      template: '一个长方形沿虚线剪成两个图形（如图），其中一个是三角形，另一个是 ____。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['三角形', '四边形']],
      figure: (p) => rectCut(p.s),
    }),
  },

  'u3f-p2': {
    L2: band(SIZE(), {
      template: '一个长方形照图剪成两个完全一样的 ____。',
      formulas: ['1'],
      unit: '',
      answerChoices: [['长方形', '正方形', '三角形']],
      figure: (p) => twoSquares(p.s),
    }),
    L3: band(SIZE(), {
      template: '照图拼成的大正方形中，一共有 ____ 个正方形。',
      formulas: ['5'],
      unit: '',
      answerChoices: [],
      figure: (p) => grid2x2(p.s),
    }),
  },

  'u3f-p3': {
    L2: band(SIZE(), {
      template: '一个正方形沿对角线剪开，得到的两个三角形完全一样吗？____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['一样', '不一样']],
      figure: (p) => squareWithDiagonal(p.s),
    }),
    L3: band(SIZE(), {
      template: '一个正方形沿对角线剪开，每个三角形有 ____ 个直角。',
      formulas: ['1'],
      unit: '',
      answerChoices: [],
      figure: (p) => squareWithDiagonal(p.s),
    }),
  },

  'u3f-p4': {
    L2: band(SIZE(), {
      template: '一个平行四边形沿对角线剪开，得到的每个三角形有 ____ 条边。',
      formulas: ['3'],
      unit: '',
      answerChoices: [],
      figure: (p) => paraWithDiagonal(p.s),
    }),
    L3: band(SIZE(), {
      template: '一个平行四边形沿对角线剪开，两个三角形一共有 ____ 条边。',
      formulas: ['6'],
      unit: '',
      answerChoices: [],
      figure: (p) => paraWithDiagonal(p.s),
    }),
  },

  'u3f-p5': {
    L2: band(SIZE(), {
      template: '图中三角形有 ____ 个，四边形有 ____ 个。',
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
    }),
    L3: band(SIZE(), {
      template: '图中三角形有 ____ 个，四边形有 ____ 个，一共有 ____ 个图形。',
      formulas: ['2', '1', '3'],
      unit: '',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
    }),
  },

  'u3f-m1': {
    L2: band(SIZE(), {
      template: '两个三角形（如图），一共有 ____ 个角。',
      formulas: ['6'],
      unit: '',
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute'], p.s),
    }),
    L3: band(SIZE(), {
      template: '三个三角形（如图），一共有 ____ 个角。',
      formulas: ['9'],
      unit: '',
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute', 'obtuse'], p.s),
    }),
  },

  'u3f-m2': {
    L2: band(SIZE(), {
      template: '一个三角形和一个四边形（如图），一共有 ____ 条边。',
      formulas: ['7'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '两个三角形和一个四边形（如图），一共有 ____ 条边。',
      formulas: ['10'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'tri', 'rect'], p.s),
    }),
  },

  'u3f-m3': {
    L2: band(SIZE(), {
      template: '一个长方形和一个直角三角形（如图），一共有 ____ 个直角。',
      formulas: ['5'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rightTri'], p.s),
    }),
    L3: band(SIZE(), {
      template: '两个长方形和一个直角三角形（如图），一共有 ____ 个直角。',
      formulas: ['9'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rect', 'rightTri'], p.s),
    }),
  },

  'u3f-m4': {
    L2: band(SIZE(), {
      template: '图中的两个正方形一共有 ____ 个直角。',
      formulas: ['8'],
      unit: '',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
    }),
    L3: band(SIZE(), {
      template: '图中的两个正方形拼成一个长方形，拼成的长方形有 ____ 个直角。',
      formulas: ['4'],
      unit: '',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
    }),
  },

  'u3f-m5': {
    L2: band(SIZE(), {
      template: '两个长方形和一个三角形（如图），一共有 ____ 个角。',
      formulas: ['11'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rect', 'tri'], p.s),
    }),
    L3: band(SIZE(), {
      template: '四个图形（如图），一共有 ____ 个角。',
      formulas: ['14'],
      unit: '',
      answerChoices: [],
      figure: (p) => mixedGridFigure(['rect', 'rect', 'tri', 'tri'], p.s, 2),
    }),
  },

  'u3f-j1': {
    L2: band(SIZE(), {
      template: '①号是直角，②号比直角大（如图），②号是钝角吗？____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => anglesFigure(['right', 'obtuse'], p.s),
    }),
    L3: band(SIZE(), {
      template: '下面的说法对吗？一个角的两条边越长，这个角就越大。____',
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => sameOpeningAngles(p.s),
    }),
  },

  'u3f-j2': {
    L2: band(SIZE(), {
      template: '下面的三角形是钝角三角形吗？____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => trianglesFigure(['obtuse'], p.s),
    }),
    L3: band(SIZE(), {
      template: '下面的说法对吗？一个三角形中只有一个直角。____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => trianglesFigure(['right'], p.s),
    }),
  },

  'u3f-j3': {
    L2: band(SIZE(), {
      template: '下面的图形四个角都是直角吗？____',
      formulas: ['1'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => quadsFigure(['para'], p.s),
    }),
    L3: band(SIZE(), {
      template: '下面的说法对吗？平行四边形的四个角都是直角。____',
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['para'], p.s),
    }),
  },

  'u3f-j4': {
    L2: band(SIZE(), {
      template: '四边形有 4 个角。____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['rect'], p.s),
    }),
    L3: band(SIZE(), {
      template: '一个四边形有 4 条边，就一定有一个直角。____',
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['para'], p.s),
    }),
  },

  'u3f-j5': {
    L2: band(SIZE(), {
      template: '下面的图形是平行四边形吗？____',
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => quadsFigure(['para'], p.s),
    }),
    L3: band(WITH_K(1), {
      template: '下面两个图形中，是正方形的是 ____ 号。',
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => quadsFigure(p.k === 0 ? ['square', 'rect'] : ['rect', 'square'], p.s),
    }),
  },
}
