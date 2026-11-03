/**
 * 3A-U2 用一位数乘 · 应用题 · 三档数值域
 * 基线（L2）在 u2-multiplication.ts；本文件补 L1 与 L3。
 *
 * L1：两个因数都在乘法口诀表内（≤9），积 ≤81；L3：三位数 × 一位数，积 ≤9999。
 * 全程不出现除法 / 平均分 / 余数；单价按场景标签分 cheap（2–9 元）、mid（12–99 元）、high（100–300 元）。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U2_MULTIPLICATION_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u2-d1': {
    L1: band({ a: R(2, 9), b: R(4, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(2, 6), b: R(120, 360) }, { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b <= 2160 }),
  },
  'u2-d2': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(3, 6), b: R(105, 160) }, { guard: (p) => p.a * p.b <= 960 }),
  },
  'u2-d3': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { sceneTags: ['cheap'], guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 300), b: R(2, 5) }, { sceneTags: ['high'], guard: (p) => p.a * p.b <= 1500 }),
  },
  'u2-d4': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 260), b: R(2, 5) }, { guard: (p) => p.a * p.b <= 1300 }),
  },
  'u2-d5': {
    L1: band({ a: R(4, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 240), b: R(2, 6) }, { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b <= 1440 }),
  },

  // ---------- 每份数 × 份数 ----------
  'u2-i1': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 180), b: R(2, 5) }, { guard: (p) => p.a * p.b <= 900 }),
  },
  'u2-i2': {
    L1: band({ a: R(4, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 300), b: R(2, 6) }, { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b <= 1800 }),
  },
  'u2-i3': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 300), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 1800 }),
  },
  'u2-i4': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 260), b: R(2, 5) }, { guard: (p) => p.a * p.b <= 1300 }),
  },
  'u2-i5': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 180), b: R(4, 6) }, { guard: (p) => p.a * p.b <= 1080 }),
  },

  // ---------- 比较与差 ----------
  'u2-c1': {
    L1: band(
      { a: R(3, 9), b: R(2, 8, undefined, 'a'), c: R(4, 9) },
      { guard: (p) => p.a > p.b && (p.a - p.b) * p.c <= 36 },
    ),
    L3: band(
      { a: R(4, 10), b: R(2, 9, undefined, 'a'), c: R(105, 240) },
      { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a > p.b && (p.a - p.b) * p.c <= 800 },
    ),
  },
  'u2-c2': {
    L1: band({ a: R(4, 9), b: R(2, 5) }, { guard: (p) => p.a * (p.b - 1) <= 36 }),
    L3: band({ a: R(105, 300), b: R(2, 4) }, { guard: (p) => p.a * (p.b - 1) <= 900 }),
  },
  'u2-c3': {
    L1: band({ a: R(2, 6), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 36 }),
    L3: band({ a: R(105, 240), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 1200 }),
  },
  'u2-c4': {
    L1: band(
      { a: R(2, 8), b: R(3, 9, undefined, undefined, 'a'), c: R(2, 6) },
      { sceneTags: ['cheap'], guard: (p) => (p.b - p.a) * p.c <= 40 },
    ),
    L3: band(
      { a: R(105, 180), b: R(120, 260, undefined, undefined, 'a'), c: R(2, 4) },
      { sceneTags: ['high'], guard: (p) => (p.b - p.a) * p.c <= 160 },
    ),
  },
  'u2-c5': {
    L1: band({ a: R(4, 9), b: R(2, 4) }, { guard: (p) => p.a * (p.b + 1) <= 45 }),
    L3: band({ a: R(105, 300), b: R(2, 3) }, { guard: (p) => p.a * (p.b + 1) <= 1200 }),
  },

  // ---------- 组合与拆分 ----------
  'u2-p1': {
    L1: band({ a: R(4, 9), b: R(2, 6), c: R(2, 9) }, { guard: (p) => p.a * p.b + p.c <= 63 }),
    L3: band({ a: R(105, 240), b: R(2, 5), c: R(2, 9) }, { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b + p.c <= 1210 }),
  },
  'u2-p2': {
    L1: band({ a: R(2, 4), b: R(2, 4), c: R(4, 5) }, { guard: (p) => p.a * p.b * p.c <= 80 }),
    L3: band({ a: R(2, 6), b: R(2, 6), c: R(105, 200) }, { sceneTags: ['smallbox', 'packer', 'hundred'], guard: (p) => p.a * p.b * p.c <= 3000 }),
  },
  'u2-p3': {
    L1: band(
      { a: R(2, 9), b: R(2, 6), c: R(10, 90) },
      { sceneTags: ['cheap'], guard: (p) => p.c - p.a * p.b >= 1 && p.c - p.a * p.b <= 20 },
    ),
    L3: band(
      { a: R(105, 240), b: R(2, 4), c: R(300, 1200) },
      { sceneTags: ['high'], guard: (p) => p.c - p.a * p.b >= 1 && p.c - p.a * p.b <= 30 },
    ),
  },
  'u2-p4': {
    L1: band({ a: R(2, 9), b: R(2, 9), c: R(2, 9) }, { guard: (p) => p.a * p.b + p.c <= 90 }),
    L3: band({ a: R(4, 6), b: R(105, 180), c: R(2, 30) }, { guard: (p) => p.a * p.b + p.c <= 1110 }),
  },
  'u2-p5': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(105, 300), b: R(2, 9) }, { sceneTags: ['batch'], guard: (p) => p.a * p.b <= 2700 }),
  },

  // ---------- 多步合成 ----------
  'u2-m1': {
    L1: band(
      { a: R(2, 6), b: R(4, 9), c: R(2, 9) },
      { guard: (p) => p.a * p.b - p.c >= 2 },
    ),
    L3: band(
      { a: R(2, 5), b: R(105, 240), c: R(2, 30) },
      { sceneTags: ['food', 'hundred'], guard: (p) => p.a * p.b - p.c >= 2 && p.a * p.b <= 1200 },
    ),
  },
  'u2-m2': {
    L1: band(
      { a: R(2, 9), b: R(2, 6), c: R(2, 9) },
      { guard: (p) => p.a * p.b + p.c <= 81 },
    ),
    L3: band(
      { a: R(105, 240), b: R(2, 5), c: R(2, 40) },
      { guard: (p) => p.a * p.b <= 1200 },
    ),
  },
  'u2-m3': {
    L1: band(
      { a: R(10, 80), b: R(2, 4), c: R(2, 9) },
      { sceneTags: ['cheap'], guard: (p) => p.a - p.b * p.c >= 1 && p.a - p.b * p.c <= 20 },
    ),
    L3: band(
      { a: R(400, 1500), b: R(2, 4), c: R(105, 240) },
      { sceneTags: ['high'], guard: (p) => p.a - p.b * p.c >= 1 && p.a - p.b * p.c <= 30 },
    ),
  },
  'u2-m4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 9) },
      { guard: (p) => p.a * p.b - p.c >= 2 },
    ),
    L3: band(
      { a: R(4, 6), b: R(105, 180), c: R(2, 40) },
      { guard: (p) => p.a * p.b <= 1080 && p.a * p.b - p.c >= 2 },
    ),
  },
  'u2-m5': {
    L1: band(
      { a: R(2, 9), b: R(2, 6), c: R(4, 9) },
      { guard: (p) => (p.a + p.b) * p.c <= 81 },
    ),
    L3: band(
      { a: R(2, 6), b: R(2, 6), c: R(105, 240) },
      { sceneTags: ['smallbox', 'packer', 'hundred'], guard: (p) => (p.a + p.b) * p.c <= 1800 },
    ),
  },

  // ---------- 信息筛选 ----------
  'u2-f1': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), d: R(5, 30) },
      { guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(105, 300), b: R(2, 6), d: R(5, 30) },
      { guard: (p) => p.a * p.b <= 1800 },
    ),
  },
  'u2-f2': {
    L1: band(
      { a: R(4, 9), b: R(2, 6), d: R(5, 20) },
      { guard: (p) => p.a * p.b <= 63 },
    ),
    L3: band(
      { a: R(105, 240), b: R(2, 6), d: R(5, 20) },
      { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b <= 1440 },
    ),
  },
  'u2-f3': {
    L1: band(
      { a: R(4, 9), b: R(2, 9), d: R(5, 25) },
      { guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(105, 240), b: R(2, 6), d: R(5, 25) },
      { sceneTags: ['worker', 'carton', 'hundred'], guard: (p) => p.a * p.b <= 1440 },
    ),
  },
  'u2-f4': {
    L1: band(
      { a: R(4, 9), b: R(2, 6), d: R(2, 9) },
      { guard: (p) => p.a * p.b <= 63 },
    ),
    L3: band(
      { a: R(105, 240), b: R(2, 6), d: R(2, 9) },
      { sceneTags: ['smallbox', 'hundred'], guard: (p) => p.a * p.b <= 1440 },
    ),
  },
  'u2-f5': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), d: R(2, 8) },
      { guard: (p) => p.a * p.b <= 81 && p.d <= p.b },
    ),
    L3: band(
      { a: R(4, 6), b: R(105, 180), d: R(2, 8) },
      { guard: (p) => p.a * p.b <= 1080 },
    ),
  },
}
