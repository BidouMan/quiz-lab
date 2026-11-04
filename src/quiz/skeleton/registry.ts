/**
 * 骨架包注册表：一个包 = 一个「单元 × 题型」× 30 条骨架 × 场景池 × 三档数值域。
 * 包按三档展开成三个 Combo，供 pilot-drill 单独跑；尚未升包的旧组合暂按单档保留。
 */
import type { Level } from '../types.ts'
import type { Combo, Scene, Skeleton, SkeletonBand } from './types.ts'
import { DIVISION_SCENES, PERIMETER_SCENES, DATE_SCENES, TWO_STEP_SCENES, MULDIV_SCENES, AREA_SCENES, MULTIPLICATION_SCENES, DIVISION_FILL_SCENES, MULTIPLICATION_FILL_SCENES, ROUTE_SCENES, MATH_PLAZA_SCENES, REVIEW_SCENES, SHAPE_SCENES } from './scenes.ts'
import { U6_PERIMETER_SKELETONS } from './u6-perimeter.ts'
import { U4_DIVISION_SKELETONS } from './u4-division.ts'
import { U5_DATE_SKELETONS } from './u5-date.ts'
import { U5_DATE_WORD_SKELETONS } from './u5-date-word.ts'
import { U1_TWO_STEP_SKELETONS } from './u1-two-step.ts'
import { U2_MULTIPLICATION_SKELETONS } from './u2-multiplication.ts'
import { U2_MULD_SKELETONS } from './u2-muld.ts'
import { U6_AREA_SKELETONS } from './u6-area.ts'
import { U6_PERIMETER_BANDS } from './u6-perimeter.bands.ts'
import { U4_DIVISION_BANDS } from './u4-division.bands.ts'
import { U1_TWO_STEP_BANDS } from './u1-two-step.bands.ts'
import { U5_DATE_BANDS } from './u5-date.bands.ts'
import { U5_DATE_WORD_BANDS } from './u5-date-word.bands.ts'
import { U2_MULTIPLICATION_BANDS } from './u2-multiplication.bands.ts'
import { U4_DIVISION_FILL_SKELETONS } from './u4-division-fill.ts'
import { U4_DIVISION_FILL_BANDS } from './u4-division-fill.bands.ts'
import { U2_MULTIPLICATION_FILL_SKELETONS } from './u2-multiplication-fill.ts'
import { U2_MULTIPLICATION_FILL_BANDS } from './u2-multiplication-fill.bands.ts'
import { U1_TWO_STEP_FILL_SKELETONS } from './u1-two-step-fill.ts'
import { U1_TWO_STEP_FILL_BANDS } from './u1-two-step-fill.bands.ts'
import { U6_PERIMETER_FILL_SKELETONS } from './u6-perimeter-fill.ts'
import { U6_PERIMETER_FILL_BANDS } from './u6-perimeter-fill.bands.ts'
import { U7_MARATHON_FILL_SKELETONS } from './u7-marathon-fill.ts'
import { U7_MARATHON_FILL_BANDS } from './u7-marathon-fill.bands.ts'
import { U8_MATH_PLAZA_FILL_SKELETONS } from './u8-math-plaza-fill.ts'
import { U8_MATH_PLAZA_FILL_BANDS } from './u8-math-plaza-fill.bands.ts'
import { U9_REVIEW_FILL_SKELETONS } from './u9-review-fill.ts'
import { U9_REVIEW_FILL_BANDS } from './u9-review-fill.bands.ts'
import { U7_MARATHON_WORD_SKELETONS } from './u7-marathon-word.ts'
import { U7_MARATHON_WORD_BANDS } from './u7-marathon-word.bands.ts'
import { U8_MATH_PLAZA_WORD_SKELETONS } from './u8-math-plaza-word.ts'
import { U8_MATH_PLAZA_WORD_BANDS } from './u8-math-plaza-word.bands.ts'
import { U9_REVIEW_WORD_SKELETONS } from './u9-review-word.ts'
import { U9_REVIEW_WORD_BANDS } from './u9-review-word.bands.ts'
import { U3_SHAPES_FILL_SKELETONS } from './u3-shapes-fill.ts'
import { U3_SHAPES_FILL_BANDS } from './u3-shapes-fill.bands.ts'
import { U3_SHAPES_WORD_SKELETONS } from './u3-shapes-word.ts'
import { U3_SHAPES_WORD_BANDS } from './u3-shapes-word.bands.ts'
import { attachBands } from './bands.ts'

export interface SkeletonPackage {
  /** 包 id：单元|题型，如 3A-U6|word */
  id: string
  slug: string
  grade: '3A' | '3B'
  unitId: string
  unitName: string
  type: 'tiankong' | 'word'
  title: string
  scenes: Scene[]
  skeletons: Skeleton[]
  bands: Record<string, Partial<Record<Level, SkeletonBand>>>
  matchSceneUnit: boolean
}

const LEVELS: Level[] = ['L1', 'L2', 'L3']

function expandPackage(pkg: SkeletonPackage): Combo[] {
  const skeletons = attachBands(pkg.skeletons, pkg.bands)
  return LEVELS.map((level) => ({
    id: `${pkg.id}|${level}`,
    slug: `${pkg.slug}-${level.toLowerCase()}`,
    grade: pkg.grade,
    unitId: pkg.unitId,
    unitName: pkg.unitName,
    type: pkg.type,
    level,
    title: pkg.title,
    scenes: pkg.scenes,
    skeletons,
    matchSceneUnit: pkg.matchSceneUnit,
  }))
}

export const PACKAGES: SkeletonPackage[] = [
  {
    id: '3A-U6|word',
    slug: 'u6-perimeter',
    grade: '3A',
    unitId: '3A-U6',
    unitName: '周长',
    type: 'word',
    title: '长方形和正方形的周长',
    scenes: PERIMETER_SCENES,
    skeletons: U6_PERIMETER_SKELETONS,
    bands: U6_PERIMETER_BANDS,
    matchSceneUnit: true,
  },
  {
    id: '3A-U4|word',
    slug: 'u4-division',
    grade: '3A',
    unitId: '3A-U4',
    unitName: '用一位数除',
    type: 'word',
    title: '用一位数除法解决问题',
    scenes: DIVISION_SCENES,
    skeletons: U4_DIVISION_SKELETONS,
    bands: U4_DIVISION_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U1|word',
    slug: 'u1-two-step',
    grade: '3A',
    unitId: '3A-U1',
    unitName: '两步四则运算',
    type: 'word',
    title: '两步计算解决问题',
    scenes: TWO_STEP_SCENES,
    skeletons: U1_TWO_STEP_SKELETONS,
    bands: U1_TWO_STEP_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U5|tiankong',
    slug: 'u5-date',
    grade: '3A',
    unitId: '3A-U5',
    unitName: '年、月、日',
    type: 'tiankong',
    title: '年、月、日与经过时间',
    scenes: DATE_SCENES,
    skeletons: U5_DATE_SKELETONS,
    bands: U5_DATE_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U5|word',
    slug: 'u5-date-word',
    grade: '3A',
    unitId: '3A-U5',
    unitName: '年、月、日',
    type: 'word',
    title: '经过时间应用题',
    scenes: DATE_SCENES,
    skeletons: U5_DATE_WORD_SKELETONS,
    bands: U5_DATE_WORD_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U2|word',
    slug: 'u2-multiplication',
    grade: '3A',
    unitId: '3A-U2',
    unitName: '用一位数乘',
    type: 'word',
    title: '用一位数乘解决问题',
    scenes: MULTIPLICATION_SCENES,
    skeletons: U2_MULTIPLICATION_SKELETONS,
    bands: U2_MULTIPLICATION_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U4|tiankong',
    slug: 'u4-division-fill',
    grade: '3A',
    unitId: '3A-U4',
    unitName: '用一位数除',
    type: 'tiankong',
    title: '用一位数除法填空',
    scenes: DIVISION_FILL_SCENES,
    skeletons: U4_DIVISION_FILL_SKELETONS,
    bands: U4_DIVISION_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U2|tiankong',
    slug: 'u2-multiplication-fill',
    grade: '3A',
    unitId: '3A-U2',
    unitName: '用一位数乘',
    type: 'tiankong',
    title: '用一位数乘法填空',
    scenes: MULTIPLICATION_FILL_SCENES,
    skeletons: U2_MULTIPLICATION_FILL_SKELETONS,
    bands: U2_MULTIPLICATION_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U1|tiankong',
    slug: 'u1-two-step-fill',
    grade: '3A',
    unitId: '3A-U1',
    unitName: '两步四则运算',
    type: 'tiankong',
    title: '两步四则运算填空',
    scenes: TWO_STEP_SCENES,
    skeletons: U1_TWO_STEP_FILL_SKELETONS,
    bands: U1_TWO_STEP_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U6|tiankong',
    slug: 'u6-perimeter-fill',
    grade: '3A',
    unitId: '3A-U6',
    unitName: '周长',
    type: 'tiankong',
    title: '周长填空',
    scenes: PERIMETER_SCENES,
    skeletons: U6_PERIMETER_FILL_SKELETONS,
    bands: U6_PERIMETER_FILL_BANDS,
    matchSceneUnit: true,
  },
  {
    id: '3A-U7|tiankong',
    slug: 'u7-marathon-fill',
    grade: '3A',
    unitId: '3A-U7',
    unitName: '马拉松路线',
    type: 'tiankong',
    title: '千米与米·路线填空',
    scenes: ROUTE_SCENES,
    skeletons: U7_MARATHON_FILL_SKELETONS,
    bands: U7_MARATHON_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U8|tiankong',
    slug: 'u8-math-plaza-fill',
    grade: '3A',
    unitId: '3A-U8',
    unitName: '数学广场',
    type: 'tiankong',
    title: '数学广场·综合填空',
    scenes: MATH_PLAZA_SCENES,
    skeletons: U8_MATH_PLAZA_FILL_SKELETONS,
    bands: U8_MATH_PLAZA_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U9|tiankong',
    slug: 'u9-review-fill',
    grade: '3A',
    unitId: '3A-U9',
    unitName: '复习',
    type: 'tiankong',
    title: '三上复习·综合填空',
    scenes: REVIEW_SCENES,
    skeletons: U9_REVIEW_FILL_SKELETONS,
    bands: U9_REVIEW_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U7|word',
    slug: 'u7-marathon-word',
    grade: '3A',
    unitId: '3A-U7',
    unitName: '马拉松路线',
    type: 'word',
    title: '马拉松路线·解决问题',
    scenes: ROUTE_SCENES,
    skeletons: U7_MARATHON_WORD_SKELETONS,
    bands: U7_MARATHON_WORD_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U8|word',
    slug: 'u8-math-plaza-word',
    grade: '3A',
    unitId: '3A-U8',
    unitName: '数学广场',
    type: 'word',
    title: '数学广场·解决问题',
    scenes: MATH_PLAZA_SCENES,
    skeletons: U8_MATH_PLAZA_WORD_SKELETONS,
    bands: U8_MATH_PLAZA_WORD_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U9|word',
    slug: 'u9-review-word',
    grade: '3A',
    unitId: '3A-U9',
    unitName: '复习',
    type: 'word',
    title: '复习·解决问题',
    scenes: REVIEW_SCENES,
    skeletons: U9_REVIEW_WORD_SKELETONS,
    bands: U9_REVIEW_WORD_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U3|tiankong',
    slug: 'u3-shapes',
    grade: '3A',
    unitId: '3A-U3',
    unitName: '三角形与四边形',
    type: 'tiankong',
    title: '三角形、四边形与角',
    scenes: SHAPE_SCENES,
    skeletons: U3_SHAPES_FILL_SKELETONS,
    bands: U3_SHAPES_FILL_BANDS,
    matchSceneUnit: false,
  },
  {
    id: '3A-U3|word',
    slug: 'u3-shapes-word',
    grade: '3A',
    unitId: '3A-U3',
    unitName: '三角形与四边形',
    type: 'word',
    title: '图形手工里的三角形与四边形',
    scenes: SHAPE_SCENES,
    skeletons: U3_SHAPES_WORD_SKELETONS,
    bands: U3_SHAPES_WORD_BANDS,
    matchSceneUnit: false,
  },
]

/** 尚未升包的单档组合，保留回归入口 */
const LEGACY_COMBOS: Combo[] = [
  {
    id: '3B-U2|word|L3',
    slug: 'u2-muld',
    grade: '3B',
    unitId: '3B-U2',
    unitName: '用两位数乘除',
    type: 'word',
    level: 'L3',
    title: '两位数乘除解决问题',
    scenes: MULDIV_SCENES,
    skeletons: U2_MULD_SKELETONS,
    matchSceneUnit: false,
  },
  {
    id: '3B-U6|word|L2',
    slug: 'u6-area',
    grade: '3B',
    unitId: '3B-U6',
    unitName: '面积',
    type: 'word',
    level: 'L2',
    title: '面积解决问题',
    scenes: AREA_SCENES,
    skeletons: U6_AREA_SKELETONS,
    matchSceneUnit: true,
  },
]

export const COMBOS: Combo[] = [...PACKAGES.flatMap(expandPackage), ...LEGACY_COMBOS]

export function getCombo(id: string): Combo {
  const combo = COMBOS.find((item) => item.id === id)
  if (!combo) throw new Error(`未注册的组合: ${id}（已注册：${COMBOS.map((item) => item.id).join(' / ')}）`)
  return combo
}
