/**
 * U8 数学广场拆解后的「精选变式」分发层。
 *
 * U8 不再是独立单元：篱笆变式进 U6，七巧板/小棒进 U3，除法版进 U4，
 * 纯数列进 U2。每个目标包只取 2–8 条（两成左右），不整包搬迁。
 * 原 u8-math-plaza-fill / word 文件仅保留被选中的骨架与三档数据。
 */
import type { Level } from '../types.ts'
import type { Skeleton, SkeletonBand } from './types.ts'
import { U8_MATH_PLAZA_FILL_SKELETONS } from './u8-math-plaza-fill.ts'
import { U8_MATH_PLAZA_FILL_BANDS } from './u8-math-plaza-fill.bands.ts'
import { U8_MATH_PLAZA_WORD_SKELETONS } from './u8-math-plaza-word.ts'
import { U8_MATH_PLAZA_WORD_BANDS } from './u8-math-plaza-word.bands.ts'

type BandMap = Record<string, Partial<Record<Level, SkeletonBand>>>

function pickSkeletons(all: Skeleton[], ids: string[]): Skeleton[] {
  return ids.map((id) => {
    const item = all.find((skeleton) => skeleton.id === id)
    if (!item) throw new Error(`U8 变式骨架缺失：${id}`)
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
const U6_FENCE_FILL_IDS = ['u8f-d1', 'u8f-d3', 'u8f-i1', 'u8f-p5', 'u8f-p6', 'u8f-c4']
const U6_FENCE_WORD_IDS = ['u8w-d3', 'u8w-d4', 'u8w-d5', 'u8w-i1', 'u8w-i2', 'u8w-i4', 'u8w-c2', 'u8w-p1']

/** 七巧板：乘法/块数版进 U3；平均分与有余数版进 U4 */
const U3_TANGRAM_FILL_IDS = ['u8f-d4', 'u8f-d5', 'u8f-p2', 'u8f-p3']
const U3_TANGRAM_WORD_IDS = ['u8w-c5', 'u8w-p3', 'u8w-p4']
const U4_TANGRAM_FILL_IDS = ['u8f-i4', 'u8f-p4']
const U4_TANGRAM_WORD_IDS = ['u8w-d6', 'u8w-i5', 'u8w-m6']

/** 小棒：摆图形+乘加进 U3；纯「第 n 个」数值题进 U2 */
const U3_STICKS_FILL_IDS = ['u8f-d6', 'u8f-i5', 'u8f-m6', 'u8f-m2']
const U3_STICKS_WORD_IDS = ['u8w-c6', 'u8w-p5', 'u8w-p6', 'u8w-m5']
const U2_SEQ_FILL_IDS = ['u8f-m4', 'u8f-m5', 'u8f-m3']
const U2_SEQ_WORD_IDS = ['u8w-m1', 'u8w-m2', 'u8w-m3']

export const U6_FENCE_FILL_SKELETONS = pickSkeletons(U8_MATH_PLAZA_FILL_SKELETONS, U6_FENCE_FILL_IDS)
export const U6_FENCE_FILL_BANDS = pickBands(U8_MATH_PLAZA_FILL_BANDS, U6_FENCE_FILL_IDS)
export const U6_FENCE_WORD_SKELETONS = pickSkeletons(U8_MATH_PLAZA_WORD_SKELETONS, U6_FENCE_WORD_IDS)
export const U6_FENCE_WORD_BANDS = pickBands(U8_MATH_PLAZA_WORD_BANDS, U6_FENCE_WORD_IDS)

const U3_FILL_IDS = [...U3_TANGRAM_FILL_IDS, ...U3_STICKS_FILL_IDS]
const U3_WORD_IDS = [...U3_TANGRAM_WORD_IDS, ...U3_STICKS_WORD_IDS]

export const U3_SHAPES_FILL_VARIANTS = pickSkeletons(U8_MATH_PLAZA_FILL_SKELETONS, U3_FILL_IDS)
export const U3_SHAPES_FILL_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_FILL_BANDS, U3_FILL_IDS)
export const U3_SHAPES_WORD_VARIANTS = pickSkeletons(U8_MATH_PLAZA_WORD_SKELETONS, U3_WORD_IDS)
export const U3_SHAPES_WORD_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_WORD_BANDS, U3_WORD_IDS)

export const U4_DIVISION_FILL_VARIANTS = pickSkeletons(U8_MATH_PLAZA_FILL_SKELETONS, U4_TANGRAM_FILL_IDS)
export const U4_DIVISION_FILL_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_FILL_BANDS, U4_TANGRAM_FILL_IDS)
export const U4_DIVISION_WORD_VARIANTS = pickSkeletons(U8_MATH_PLAZA_WORD_SKELETONS, U4_TANGRAM_WORD_IDS)
export const U4_DIVISION_WORD_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_WORD_BANDS, U4_TANGRAM_WORD_IDS)

export const U2_SEQ_FILL_VARIANTS = pickSkeletons(U8_MATH_PLAZA_FILL_SKELETONS, U2_SEQ_FILL_IDS)
export const U2_SEQ_FILL_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_FILL_BANDS, U2_SEQ_FILL_IDS)
export const U2_SEQ_WORD_VARIANTS = pickSkeletons(U8_MATH_PLAZA_WORD_SKELETONS, U2_SEQ_WORD_IDS)
export const U2_SEQ_WORD_VARIANT_BANDS = pickBands(U8_MATH_PLAZA_WORD_BANDS, U2_SEQ_WORD_IDS)
