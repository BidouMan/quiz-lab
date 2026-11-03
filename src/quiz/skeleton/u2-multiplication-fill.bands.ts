/**
 * 3A-U2 用一位数乘 · 填空 · 三档数值域
 * 基线（L2）在 u2-multiplication-fill.ts 的 slots 里；本文件补 L1 / L3。
 * L1：表内乘法（两个因数都在 2–9，积 ≤81）；L2：两位数×一位数；
 * L3：三位数×一位数。三位数尽量落在「箱数 / 产量 / 张数 / 人数」这类
 * 天然可以上百的量上，单位量保持 2–9，避免「每盒 594 瓶」这类荒谬句。
 * 三档都不用除法与平均分。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U2_MULTIPLICATION_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u2f-d1': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 999), b: R(4, 6) }, { guard: (p) => p.a * p.b <= 5994 }),
  },
  'u2f-d2': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(2, 9), b: R(100, 150) }, { guard: (p) => p.a * p.b <= 1350 }),
  },
  'u2f-d3': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(2, 9), b: R(100, 999) }, { guard: (p) => p.a * p.b <= 8991 }),
  },
  'u2f-d4': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 300), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 1800 }),
  },
  'u2f-d5': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(6, 9), b: R(100, 999) }, { guard: (p) => p.a * p.b <= 8991 }),
  },

  // ---------- 每份数相乘 ----------
  'u2f-i1': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 150), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 1350 }),
  },
  'u2f-i2': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(4, 9), b: R(100, 999) }, { guard: (p) => p.a * p.b <= 8991 }),
  },
  'u2f-i3': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 999), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 8991 }),
  },
  'u2f-i4': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 300), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 1800 }),
  },
  'u2f-i5': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 200), b: R(2, 8) }, { guard: (p) => p.a * p.b <= 1600 }),
  },

  // ---------- 比较与最值 ----------
  'u2f-c1': {
    L1: band(
      { a: R(2, 9), b: R(2, 8, undefined, 'a'), c: R(2, 9) },
      { guard: (p) => p.a > p.b && (p.a - p.b) * p.c <= 81 },
    ),
    L3: band(
      { a: R(100, 999), b: R(100, 999, undefined, 'a'), c: R(2, 6) },
      { guard: (p) => p.a > p.b && (p.a - p.b) * p.c <= 5994 },
    ),
  },
  'u2f-c2': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 300), b: R(2, 6) }, { guard: (p) => p.a * p.b <= 1800 }),
  },
  'u2f-c3': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * (p.b - 1) <= 81 }),
    L3: band({ a: R(100, 999), b: R(2, 6) }, { guard: (p) => p.a * (p.b - 1) <= 4995 }),
  },
  'u2f-c4': {
    L1: band(
      { a: R(2, 6), b: R(5, 9), c: R(2, 9) },
      { guard: (p) => p.b - p.a >= 3 && (p.b - p.a) * p.c <= 81 },
    ),
    L3: band(
      { a: R(2, 6), b: R(5, 9), c: R(100, 999) },
      { guard: (p) => p.b - p.a >= 3 && (p.b - p.a) * p.c <= 6993 },
    ),
  },
  'u2f-c5': {
    L1: band({ a: R(2, 9), b: R(2, 6) }, { guard: (p) => p.a * (p.b - 1) <= 81 }),
    L3: band({ a: R(100, 300), b: R(2, 6) }, { guard: (p) => p.a * (p.b - 1) <= 1500 }),
  },

  // ---------- 组合与拆分 ----------
  'u2f-p1': {
    L1: band({ a: R(2, 9), b: R(2, 9), c: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(4, 6), b: R(100, 999), c: R(2, 9) }, { guard: (p) => p.a * p.b <= 5994 }),
  },
  'u2f-p2': {
    L1: band({ a: R(2, 3), b: R(2, 3), c: R(2, 9) }, { guard: (p) => p.a * p.b * p.c <= 81 }),
    L3: band({ a: R(100, 999), b: R(2, 3), c: R(4, 9) }, { guard: (p) => p.a * p.b * p.c <= 9999 }),
  },
  'u2f-p3': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(2, 9), b: R(100, 999) }, { guard: (p) => p.a * p.b <= 8991 }),
  },
  'u2f-p4': {
    L1: band({ a: R(2, 6), b: R(2, 9), c: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band(
      { a: R(2, 6), b: R(100, 200), c: R(2, 9) },
      { guard: (p) => p.a * p.b <= 1200, sceneTags: ['rowed', 'rowmany'] },
    ),
  },
  'u2f-p5': {
    L1: band({ a: R(2, 9), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 200), b: R(2, 9) }, { guard: (p) => p.a * p.b <= 1800 }),
  },

  // ---------- 多步合成 ----------
  'u2f-m1': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 30) },
      { guard: (p) => p.a * p.b <= 81 && p.a * p.b - p.c >= 2 },
    ),
    L3: band(
      { a: R(100, 999), b: R(4, 9), c: R(10, 300) },
      { guard: (p) => p.a * p.b <= 5994 && p.a * p.b - p.c >= 2 },
    ),
  },
  'u2f-m2': {
    L1: band(
      { a: R(2, 9), b: R(2, 6), c: R(2, 30) },
      { guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(100, 300), b: R(2, 6), c: R(10, 300) },
      { guard: (p) => p.a * p.b <= 1800 },
    ),
  },
  'u2f-m3': {
    L1: band(
      { a: R(20, 99, 5), b: R(2, 9), c: R(2, 6) },
      { guard: (p) => p.a - p.b * p.c >= 1 && p.a - p.b * p.c <= 9 },
    ),
    L3: band(
      { a: R(300, 9000, 10), b: R(100, 999), c: R(2, 6) },
      { guard: (p) => p.a - p.b * p.c >= 5 && p.a - p.b * p.c <= 500 },
    ),
  },
  'u2f-m4': {
    L1: band(
      { a: R(2, 6), b: R(2, 9), c: R(2, 40) },
      { guard: (p) => p.a * p.b <= 81 && p.a * p.b - p.c >= 2 },
    ),
    L3: band(
      { a: R(2, 6), b: R(100, 200), c: R(10, 300) },
      { guard: (p) => p.a * p.b <= 1200 && p.a * p.b - p.c >= 2 },
    ),
  },
  'u2f-m5': {
    L1: band(
      { a: R(2, 5), b: R(2, 4), c: R(2, 9) },
      { guard: (p) => p.a + p.b <= 9 && (p.a + p.b) * p.c <= 81 },
    ),
    L3: band(
      { a: R(2, 6), b: R(2, 6), c: R(100, 200) },
      { guard: (p) => p.a + p.b <= 9 && (p.a + p.b) * p.c <= 1800 },
    ),
  },

  // ---------- 信息筛选 ----------
  'u2f-f1': {
    L1: band({ a: R(2, 9), b: R(2, 9), d: R(2, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(100, 999), b: R(2, 6), d: R(2, 9) }, { guard: (p) => p.a * p.b <= 5994 }),
  },
  'u2f-f2': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), d: R(8, 20) },
      { guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(100, 999), b: R(4, 9), d: R(8, 20) },
      { guard: (p) => p.a * p.b <= 8991 },
    ),
  },
  'u2f-f3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), d: R(3, 20) },
      { guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(4, 9), b: R(100, 999), d: R(3, 20) },
      { guard: (p) => p.a * p.b <= 8991 },
    ),
  },
  'u2f-f4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9), d: R(2, 3) },
      { guard: (p) => p.a * p.b * p.d <= 81 },
    ),
    L3: band(
      { a: R(6, 9), b: R(100, 400), d: R(2, 6) },
      { guard: (p) => p.a * p.b * p.d <= 9999 },
    ),
  },
  'u2f-f5': {
    L1: band(
      { a: R(2, 6), b: R(2, 9), d: R(2, 8) },
      { guard: (p) => p.d <= p.b && p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 6), b: R(100, 200), d: R(2, 8) },
      { guard: (p) => p.d <= p.b && p.a * p.b <= 1200 },
    ),
  },
}
