/**
 * 3A-U3 三角形与四边形 · 应用 · L2 / L3 变体。
 *
 * L2 都加“第二个对象/第二个条件”，L3 都进入“三图计数、剪拼后判断、说理判断”。
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
  twoTriangles,
  sameOpeningAngles,
  type QuadKind,
  type MixedKind,
} from './u3-figures.ts'

const SIZE = () => ({ s: R(80, 130) })
const WITH_K = (max: number) => ({ k: R(0, max), s: R(80, 130) })

const ANGLE_CHOICES = ['锐角', '直角', '钝角']
const TRI_CHOICES = ['锐角三角形', '直角三角形', '钝角三角形']

export const U3_SHAPES_WORD_BANDS: Record<string, { L2: SkeletonBand; L3: SkeletonBand }> = {
  'u3w-d1': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}画了两个角（如图）。',
      asks: ['比直角大的是几号？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => anglesFigure(p.k === 0 ? ['obtuse', 'acute'] : ['acute', 'obtuse'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}画了三个角（如图）。',
      asks: ['直角和钝角各几个？'],
      formulas: ['2', '1'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => anglesFigure(['right', 'right', 'obtuse'], p.s),
      workLines: 3,
    }),
  },

  'u3w-d2': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}拼了两个三角形（如图）。',
      asks: ['哪个有直角？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => trianglesFigure(p.k === 0 ? ['right', 'acute'] : ['acute', 'right'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}拼了三个三角形（如图）。',
      asks: ['锐角三角形和钝角三角形各几个？'],
      formulas: ['2', '1'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute', 'obtuse'], p.s),
      workLines: 3,
    }),
  },

  'u3w-d3': {
    L2: band(WITH_K(1), {
      template: '{person}在{place}摆了两个四边形（如图）。',
      asks: ['哪个图形的四条边都相等？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => quadsFigure(p.k === 0 ? ['square', 'rect'] : ['rect', 'square'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}摆了三个四边形（如图）。',
      asks: ['四条边都相等的和只有对边相等的各几个？'],
      formulas: ['1', '2'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => quadsFigure(['rect', 'square', 'rect'], p.s),
      workLines: 3,
    }),
  },

  'u3w-d4': {
    L2: band(SIZE(), {
      template: '{person}在{place}做了两块正方形杯垫（如图）。',
      asks: ['两块杯垫一共有几个直角？'],
      formulas: ['8'],
      unit: '个',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}把长方形纸板剪成两个正方形（如图）。',
      asks: ['两个正方形共有几个直角？原长方形有几个直角？'],
      formulas: ['8', '4'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
      workLines: 3,
    }),
  },

  'u3w-d5': {
    L2: band(SIZE(), {
      template: '{person}在{place}搭了一个三角形框架和一个四边形框架（如图）。',
      asks: ['一共用了几条边？'],
      formulas: ['7'],
      unit: '条',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把长方形框架沿对角线拆成两个三角形（如图）。',
      asks: ['两个三角形一共有几条边？'],
      formulas: ['6'],
      unit: '条',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 3,
    }),
  },

  'u3w-i1': {
    L2: band(SIZE(), {
      template: '{person}在{place}要剪一个比直角大的角和一个比直角小的角。',
      asks: ['分别是什么角？'],
      formulas: ['2', '0'],
      unit: '',
      answerChoices: [ANGLE_CHOICES, ANGLE_CHOICES],
      workLines: 3,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}要剪一个两条边张得比直角开的角，还要剪一个和直角一样开的角。',
      asks: ['分别是什么角？'],
      formulas: ['2', '1'],
      unit: '',
      answerChoices: [ANGLE_CHOICES, ANGLE_CHOICES],
      workLines: 3,
    }),
  },

  'u3w-i2': {
    L2: band(SIZE(), {
      template: '{person}在{place}要拼一个没有直角、三个角都比直角小的三角形。',
      asks: ['是什么三角形？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [TRI_CHOICES],
      workLines: 3,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}要拼一个有一个钝角、另外两个角是锐角的三角形。',
      asks: ['是什么三角形？'],
      formulas: ['2'],
      unit: '',
      answerChoices: [TRI_CHOICES],
      workLines: 3,
    }),
  },

  'u3w-i3': {
    L2: band(SIZE(), {
      template: '{person}在{place}要做只有对边相等、四个角都是直角的图形。',
      asks: ['做什么图形？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['正方形', '长方形', '平行四边形']],
      workLines: 3,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}要做两组对边都相等、四个角都不是直角的图形。',
      asks: ['做什么图形？'],
      formulas: ['2'],
      unit: '',
      answerChoices: [['正方形', '长方形', '平行四边形']],
      workLines: 3,
    }),
  },

  'u3w-i4': {
    L2: band(SIZE(), {
      template: '{person}在{place}有三张三角形卡（如图）。',
      asks: ['哪张是钝角三角形？哪张是锐角三角形？'],
      formulas: ['1', '2'],
      unit: '',
      answerChoices: [['①', '②', '③'], ['①', '②', '③']],
      figure: (p) => trianglesFigure(['right', 'obtuse', 'acute'], p.s),
      workLines: 3,
    }),
    L3: band(WITH_K(2), {
      template: '{person}在{place}有三张图形卡（如图）。',
      asks: ['哪张不是四边形？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: MixedKind[] = ['rect', 'para', 'square']
        lanes[p.k] = 'tri'
        return mixedFigure(lanes, p.s)
      },
      workLines: 2,
    }),
  },

  'u3w-i5': {
    L2: band(WITH_K(2), {
      template: '{person}在{place}有三块四边形拼板（如图）。',
      asks: ['哪块只有对边相等、四个角都是直角？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: QuadKind[] =
          p.k === 0 ? ['rect', 'square', 'para'] : p.k === 1 ? ['square', 'rect', 'para'] : ['square', 'para', 'rect']
        return quadsFigure(lanes, p.s)
      },
      workLines: 3,
    }),
    L3: band(WITH_K(2), {
      template: '{person}在{place}有三块四边形拼板（如图）。',
      asks: ['哪块四个角都不是直角？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②', '③']],
      figure: (p) => {
        const lanes: QuadKind[] =
          p.k === 0 ? ['para', 'rect', 'square'] : p.k === 1 ? ['rect', 'para', 'square'] : ['rect', 'square', 'para']
        return quadsFigure(lanes, p.s)
      },
      workLines: 2,
    }),
  },

  'u3w-c1': {
    L2: band(SIZE(), {
      template: '{person}在{place}画了两个角，①号是锐角，②号是钝角（如图）。',
      asks: ['哪个角大？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => anglesFigure(['acute', 'obtuse'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}画了三个大小不同的角（如图）。',
      asks: ['最大和最小的是几号？'],
      formulas: ['1', '0'],
      unit: '',
      answerChoices: [['①', '②', '③'], ['①', '②', '③']],
      figure: (p) => anglesFigure(['acute', 'obtuse', 'right'], p.s),
      workLines: 3,
    }),
  },

  'u3w-c2': {
    L2: band(SIZE(), {
      template: '{person}在{place}拼了两个三角形，①号是直角三角形，②号是钝角三角形（如图）。',
      asks: ['哪个有钝角？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => trianglesFigure(['right', 'obtuse'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}摆了三块三角形拼图（如图）。',
      asks: ['锐角三角形和直角三角形各几个？'],
      formulas: ['2', '1'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => trianglesFigure(['acute', 'acute', 'right'], p.s),
      workLines: 3,
    }),
  },

  'u3w-c3': {
    L2: band(SIZE(), {
      template: '{person}在{place}比较平行四边形和长方形（如图）。',
      asks: ['哪个图形的四个角都是直角？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['平行四边形', '长方形']],
      figure: (p) => quadsFigure(['para', 'rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}摆了三块四边形拼板（如图）。',
      asks: ['四条边都相等的和四个角都是直角的各几块？'],
      formulas: ['1', '3'],
      unit: '',
      answerUnits: ['块', '块'],
      answerChoices: [],
      figure: (p) => quadsFigure(['rect', 'square', 'rect'], p.s),
      workLines: 3,
    }),
  },

  'u3w-c4': {
    L2: band(SIZE(), {
      template: '{person}在{place}比较三角形和四边形（如图）。',
      asks: ['一共有几条边？'],
      formulas: ['7'],
      unit: '条',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}比较长方形和三角形（如图）。',
      asks: ['边数相差几条？角数相差几个？'],
      formulas: ['1', '1'],
      unit: '',
      answerUnits: ['条', '个'],
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'tri'], p.s),
      workLines: 3,
    }),
  },

  'u3w-c5': {
    L2: band(SIZE(), {
      template: '{person}在{place}摆了两个三角形和一个四边形（如图）。',
      asks: ['一共有几条边？'],
      formulas: ['10'],
      unit: '条',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'tri', 'rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}摆了一个三角形、一个四边形和一个长方形（如图）。',
      asks: ['一共有几条边？几个角？'],
      formulas: ['11', '11'],
      unit: '',
      answerUnits: ['条', '个'],
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect', 'rect'], p.s),
      workLines: 3,
    }),
  },

  'u3w-p1': {
    L2: band(SIZE(), {
      template: '{person}在{place}把长方形沿对角线剪开（如图）。',
      asks: ['得到两个什么三角形？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['锐角', '直角', '钝角']],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把长方形沿虚线剪开（如图）。',
      asks: ['一个三角形和一个什么图形？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['三角形', '四边形']],
      figure: (p) => rectCut(p.s),
      workLines: 3,
    }),
  },

  'u3w-p2': {
    L2: band(SIZE(), {
      template: '{person}在{place}把长方形剪成两个完全一样的图形（如图）。',
      asks: ['是什么图形？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['长方形', '正方形', '三角形']],
      figure: (p) => twoSquares(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}用 4 个小正方形拼成一个大正方形（如图）。',
      asks: ['大正方形每边有几个小正方形？'],
      formulas: ['2'],
      unit: '个',
      answerChoices: [],
      figure: (p) => grid2x2(p.s),
      workLines: 3,
    }),
  },

  'u3w-p3': {
    L2: band(SIZE(), {
      template: '{person}在{place}把正方形沿对角线剪开（如图）。',
      asks: ['两个三角形完全一样吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['一样', '不一样']],
      figure: (p) => squareWithDiagonal(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把正方形沿对角线剪开（如图）。',
      asks: ['每个三角形有几个直角？'],
      formulas: ['1'],
      unit: '个',
      answerChoices: [],
      figure: (p) => squareWithDiagonal(p.s),
      workLines: 2,
    }),
  },

  'u3w-p4': {
    L2: band(SIZE(), {
      template: '{person}在{place}把平行四边形沿对角线剪开（如图）。',
      asks: ['得到的两个三角形有直角吗？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['有', '没有']],
      figure: (p) => paraWithDiagonal(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把平行四边形沿对角线剪开（如图）。',
      asks: ['两个三角形一共有几条边？'],
      formulas: ['6'],
      unit: '条',
      answerChoices: [],
      figure: (p) => paraWithDiagonal(p.s),
      workLines: 3,
    }),
  },

  'u3w-p5': {
    L2: band(SIZE(), {
      template: '{person}在{place}把长方形纸板沿对角线剪开（如图）。',
      asks: ['图中三角形和四边形各几个？'],
      formulas: ['2', '1'],
      unit: '',
      answerUnits: ['个', '个'],
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 3,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把长方形沿对角线剪开（如图）。',
      asks: ['图中三角形、四边形各几个，一共有几个图形？'],
      formulas: ['2', '1', '3'],
      unit: '',
      answerUnits: ['个', '个', '个'],
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 3,
    }),
  },

  'u3w-m1': {
    L2: band(SIZE(), {
      template: '{person}在{place}做了一块长方形展板和一块直角三角形积木（如图）。',
      asks: ['一共有几个直角？'],
      formulas: ['5'],
      unit: '个',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rightTri'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}做了两块长方形展板和一块直角三角形积木（如图）。',
      asks: ['一共有几个直角？'],
      formulas: ['9'],
      unit: '个',
      answerChoices: [],
      figure: (p) => mixedFigure(['rect', 'rect', 'rightTri'], p.s),
      workLines: 3,
    }),
  },

  'u3w-m2': {
    L2: band(SIZE(), {
      template: '{person}在{place}用吸管搭了一个三角形和一个四边形（如图）。',
      asks: ['一共有几个角？'],
      formulas: ['7'],
      unit: '个',
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}搭了两个三角形框架和一个四边形框架（如图）。',
      asks: ['一共有几条边？几个角？'],
      formulas: ['10', '10'],
      unit: '',
      answerUnits: ['条', '个'],
      answerChoices: [],
      figure: (p) => mixedFigure(['tri', 'tri', 'rect'], p.s),
      workLines: 3,
    }),
  },

  'u3w-m3': {
    L2: band(SIZE(), {
      template: '{person}在{place}摆了两个三角形拼图（如图）。',
      asks: ['两个三角形一共有几条边？'],
      formulas: ['6'],
      unit: '条',
      answerChoices: [],
      figure: (p) => twoTriangles(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把两个三角形拼成一个长方形（如图）。',
      asks: ['拼成的长方形有几条边？'],
      formulas: ['4'],
      unit: '条',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 3,
    }),
  },

  'u3w-m4': {
    L2: band(SIZE(), {
      template: '{person}在{place}把长方形纸沿对角线剪开（如图）。',
      asks: ['每个三角形有几个直角？'],
      formulas: ['1'],
      unit: '个',
      answerChoices: [],
      figure: (p) => rectWithDiagonal(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把长方形纸沿虚线剪开（如图）。',
      asks: ['四边形比三角形多几条边？'],
      formulas: ['1'],
      unit: '条',
      answerChoices: [],
      figure: (p) => rectCut(p.s),
      workLines: 3,
    }),
  },

  'u3w-m5': {
    L2: band(SIZE(), {
      template: '{person}在{place}做了两块正方形手帕（如图）。',
      asks: ['两块手帕一共有几个直角？'],
      formulas: ['8'],
      unit: '个',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}把两块正方形手帕拼成一个长方形（如图）。',
      asks: ['拼成的长方形有几个直角？'],
      formulas: ['4'],
      unit: '个',
      answerChoices: [],
      figure: (p) => twoSquares(p.s),
      workLines: 3,
    }),
  },

  'u3w-j1': {
    L2: band(SIZE(), {
      template: '{person}在{place}画了两个角，①号是直角，②号比直角大（如图）。',
      asks: ['②号是钝角吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => anglesFigure(['right', 'obtuse'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}说：角的两条边越长，角就越大。（如图）',
      asks: ['他说得对吗？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => sameOpeningAngles(p.s),
      workLines: 3,
    }),
  },

  'u3w-j2': {
    L2: band(SIZE(), {
      template: '{person}在{place}拼出一个三角形（如图）。',
      asks: ['它是钝角三角形吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => trianglesFigure(['obtuse'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}说：一个三角形中只有一个直角。（如图）',
      asks: ['他说得对吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => trianglesFigure(['right'], p.s),
      workLines: 3,
    }),
  },

  'u3w-j3': {
    L2: band(SIZE(), {
      template: '{person}在{place}拼出一个四边形（如图）。',
      asks: ['四个角都是直角吗？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => quadsFigure(['para'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}说：平行四边形的四个角都是直角。（如图）',
      asks: ['他说得对吗？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['para'], p.s),
      workLines: 3,
    }),
  },

  'u3w-j4': {
    L2: band(SIZE(), {
      template: '{person}在{place}说：四边形有 4 个角。（如图）',
      asks: ['他说得对吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['rect'], p.s),
      workLines: 2,
    }),
    L3: band(SIZE(), {
      template: '{person}在{place}说：四边形有 4 条边，就一定有一个直角。（如图）',
      asks: ['他说得对吗？'],
      formulas: ['1'],
      unit: '',
      answerChoices: [['对', '错']],
      figure: (p) => quadsFigure(['para'], p.s),
      workLines: 3,
    }),
  },

  'u3w-j5': {
    L2: band(SIZE(), {
      template: '{person}在{place}拼出一个图形（如图）。',
      asks: ['它是平行四边形吗？'],
      formulas: ['0'],
      unit: '',
      answerChoices: [['是', '不是']],
      figure: (p) => quadsFigure(['para'], p.s),
      workLines: 2,
    }),
    L3: band(WITH_K(1), {
      template: '{person}在{place}有两张图形卡（如图）。',
      asks: ['哪张是正方形？'],
      formulas: ['k'],
      unit: '',
      answerChoices: [['①', '②']],
      figure: (p) => quadsFigure(p.k === 0 ? ['square', 'rect'] : ['rect', 'square'], p.s),
      workLines: 2,
    }),
  },
}
