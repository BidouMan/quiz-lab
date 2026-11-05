/**
 * 数学广场拆解后的「精选变式」分发层。
 *
 * 数学广场不再是独立单元：篱笆变式进 U6，七巧板/小棒进 U3，除法版进 U4，
 * 纯数列进 U2。每个目标包只取 2–8 条（两成左右），不整包搬迁。
 * 原 math-plaza-fill / word 文件仅保留被选中的骨架与三档数据。
 */
import type { Level } from '../types.ts'
import type { Skeleton, SkeletonBand } from './types.ts'
import { MATH_PLAZA_FILL_SKELETONS } from './math-plaza-fill.ts'
import { MATH_PLAZA_FILL_BANDS } from './math-plaza-fill.bands.ts'
import { MATH_PLAZA_WORD_SKELETONS } from './math-plaza-word.ts'
import { MATH_PLAZA_WORD_BANDS } from './math-plaza-word.bands.ts'

type BandMap = Record<string, Partial<Record<Level, SkeletonBand>>>

function pickSkeletons(all: Skeleton[], ids: string[]): Skeleton[] {
  return ids.map((id) => {
    const item = all.find((skeleton) => skeleton.id === id)
    if (!item) throw new Error(`变式骨架缺失：${id}`)
    return item
  })
}

function pickBands(all: BandMap, ids: string[]): BandMap {
  const out: BandMap = {}
  for (const id of ids) {
    if (all[id]) out[id] = all[id]
  }
  return out
}

/** 篱笆：只取靠墙/留门/两面靠墙/改围/并排，丢弃与 U6 现有周长题最同式的「宽边靠墙」「同式逆推」 */
const U6_FENCE_FILL_IDS = ['mpf-d1', 'mpf-d3', 'mpf-i1', 'mpf-p5', 'mpf-p6', 'mpf-c4']
const U6_FENCE_WORD_IDS = ['mpw-d3', 'mpw-d4', 'mpw-d5', 'mpw-i1', 'mpw-i2', 'mpw-i4', 'mpw-c2', 'mpw-p1']

/** 七巧板：乘法/块数版进 U3；平均分与有余数版进 U4 */
const U3_TANGRAM_FILL_IDS = ['mpf-d4', 'mpf-d5', 'mpf-p2', 'mpf-p3']
const U3_TANGRAM_WORD_IDS = ['mpw-c5', 'mpw-p3', 'mpw-p4']
const U4_TANGRAM_FILL_IDS = ['mpf-i4', 'mpf-p4']
const U4_TANGRAM_WORD_IDS = ['mpw-d6', 'mpw-i5', 'mpw-m6']

/** 小棒：摆图形+乘加进 U3；纯「第 n 个」数值题进 U2 */
const U3_STICKS_FILL_IDS = ['mpf-d6', 'mpf-i5', 'mpf-m6', 'mpf-m2']
const U3_STICKS_WORD_IDS = ['mpw-c6', 'mpw-p5', 'mpw-p6', 'mpw-m5']
const U2_SEQ_FILL_IDS = ['mpf-m4', 'mpf-m5', 'mpf-m3']
const U2_SEQ_WORD_IDS = ['mpw-m1', 'mpw-m2', 'mpw-m3']

export const U6_FENCE_FILL_SKELETONS = pickSkeletons(MATH_PLAZA_FILL_SKELETONS, U6_FENCE_FILL_IDS)
export const U6_FENCE_FILL_BANDS = pickBands(MATH_PLAZA_FILL_BANDS, U6_FENCE_FILL_IDS)
export const U6_FENCE_WORD_SKELETONS = pickSkeletons(MATH_PLAZA_WORD_SKELETONS, U6_FENCE_WORD_IDS)
export const U6_FENCE_WORD_BANDS = pickBands(MATH_PLAZA_WORD_BANDS, U6_FENCE_WORD_IDS)

const U3_FILL_IDS = [...U3_TANGRAM_FILL_IDS, ...U3_STICKS_FILL_IDS]
const U3_WORD_IDS = [...U3_TANGRAM_WORD_IDS, ...U3_STICKS_WORD_IDS]

export const U3_SHAPES_FILL_VARIANTS = pickSkeletons(MATH_PLAZA_FILL_SKELETONS, U3_FILL_IDS)
export const U3_SHAPES_FILL_VARIANT_BANDS = pickBands(MATH_PLAZA_FILL_BANDS, U3_FILL_IDS)
export const U3_SHAPES_WORD_VARIANTS = pickSkeletons(MATH_PLAZA_WORD_SKELETONS, U3_WORD_IDS)
export const U3_SHAPES_WORD_VARIANT_BANDS = pickBands(MATH_PLAZA_WORD_BANDS, U3_WORD_IDS)

export const U4_DIVISION_FILL_VARIANTS = pickSkeletons(MATH_PLAZA_FILL_SKELETONS, U4_TANGRAM_FILL_IDS)
export const U4_DIVISION_FILL_VARIANT_BANDS = pickBands(MATH_PLAZA_FILL_BANDS, U4_TANGRAM_FILL_IDS)
export const U4_DIVISION_WORD_VARIANTS = pickSkeletons(MATH_PLAZA_WORD_SKELETONS, U4_TANGRAM_WORD_IDS)
export const U4_DIVISION_WORD_VARIANT_BANDS = pickBands(MATH_PLAZA_WORD_BANDS, U4_TANGRAM_WORD_IDS)

export const U2_SEQ_FILL_VARIANTS = pickSkeletons(MATH_PLAZA_FILL_SKELETONS, U2_SEQ_FILL_IDS)
export const U2_SEQ_FILL_VARIANT_BANDS = pickBands(MATH_PLAZA_FILL_BANDS, U2_SEQ_FILL_IDS)
export const U2_SEQ_WORD_VARIANTS = pickSkeletons(MATH_PLAZA_WORD_SKELETONS, U2_SEQ_WORD_IDS)
export const U2_SEQ_WORD_VARIANT_BANDS = pickBands(MATH_PLAZA_WORD_BANDS, U2_SEQ_WORD_IDS)
