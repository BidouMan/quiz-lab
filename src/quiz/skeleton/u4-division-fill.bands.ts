/**
 * 3A-U4 用一位数除 · 填空 · 三档数值域
 * 基线（L2）在 u4-division-fill.ts 的 slots 里；本文件补 L1 / L3。
 * L1：表内除法（被除数 ≤81、商 ≤9、整除或表内有余数）；L2：两位数÷一位数（含余数）；
 * L3：三位数÷一位数，部分骨架要求商中间或末尾带 0。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

const hasZero = (n: number): boolean => String(n).slice(1).includes('0')

export const U4_DIVISION_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u4f-d1': {
    L1: band({ a: R(6, 81), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band(
      { a: R(108, 972, 6), b: R(2, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 10 && hasZero(p.a / p.b) },
    ),
  },
  'u4f-d2': {
    L1: band({ a: R(6, 81), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band(
      { a: R(108, 972, 6), b: R(2, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 10 && p.a / p.b <= 200 },
    ),
  },
  'u4f-d3': {
    L1: band(
      { a: R(6, 72), b: R(2, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(108, 432, 4), b: R(2, 9) },
      {
        guard: (p) => p.a % p.b === 0 && p.a / p.b >= 12 && p.a / p.b <= 48,
        sceneTags: ['mid'],
      },
    ),
  },
  'u4f-d4': {
    L1: band({ a: R(8, 72, 4), b: R(2, 8) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band({ a: R(120, 960, 8), b: R(2, 8) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 15 && p.a / p.b <= 120 }),
  },
  'u4f-d5': {
    L1: band({ a: R(8, 72, 2), b: R(2, 6) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band({ a: R(120, 960, 8), b: R(2, 8) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 15 && p.a / p.b <= 160 }),
  },

  // ---------- 逆向求 ----------
  'u4f-i1': {
    L1: band({ a: R(6, 81), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band({ a: R(108, 972, 6), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 10 && p.a / p.b <= 200 }),
  },
  'u4f-i2': {
    L1: band({ a: R(6, 81), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band({ a: R(108, 972, 6), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 10 && p.a / p.b <= 200 }),
  },
  'u4f-i3': {
    L1: band(
      { a: R(6, 72), b: R(2, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(105, 960, 5), b: R(2, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 12 && p.a / p.b <= 200 },
    ),
  },
  'u4f-i4': {
    L1: band({ a: R(6, 81), b: R(2, 9) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band(
      { a: R(120, 540, 6), b: R(3, 9) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 20 && p.a / p.b <= 60 },
    ),
  },
  'u4f-i5': {
    L1: band({ a: R(8, 72, 2), b: R(2, 6) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9 }),
    L3: band({ a: R(120, 960, 8), b: R(2, 8) }, { guard: (p) => p.a % p.b === 0 && p.a / p.b >= 15 && p.a / p.b <= 160 }),
  },

  // ---------- 比较与最值 ----------
  'u4f-c1': {
    L1: band(
      { a: R(12, 81, 3), b: R(2, 6), c: R(6, 72, 3, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 9 &&
          p.c / p.b <= 9 &&
          p.a / p.b - p.c / p.b >= 2,
      },
    ),
    L3: band(
      { a: R(120, 960, 4), b: R(2, 8), c: R(40, 900, 4, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 200 &&
          p.a / p.b - p.c / p.b >= 2,
      },
    ),
  },
  'u4f-c2': {
    L1: band(
      { a: R(12, 81, 3), b: R(2, 9), c: R(6, 72, 3, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 9 &&
          p.c / p.b >= 2 &&
          p.a / p.b - p.c / p.b >= 2,
      },
    ),
    L3: band(
      { a: R(108, 432, 4), b: R(2, 9), c: R(36, 430, 4, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b >= 12 &&
          p.a / p.b <= 48 &&
          p.c / p.b >= 2 &&
          p.a / p.b - p.c / p.b >= 2,
        sceneTags: ['mid'],
      },
    ),
  },
  'u4f-c3': {
    L1: band(
      { a: R(12, 81, 3), b: R(2, 8), c: R(6, 72, 3, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 9 &&
          p.c / p.b <= 9 &&
          p.a / p.b - p.c / p.b >= 1,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(2, 8), c: R(40, 900, 8, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 200 &&
          p.a / p.b - p.c / p.b >= 1,
      },
    ),
  },
  'u4f-c4': {
    L1: band(
      { a: R(24, 72, 12), b: R(2, 4), c: R(3, 4, undefined, undefined, 'b') },
      {
        guard: (p) => p.a % p.b === 0 && p.a % p.c === 0 && p.a / p.b <= 9 && p.a / p.b - p.a / p.c >= 1,
      },
    ),
    L3: band(
      { a: R(120, 960, 12), b: R(2, 4), c: R(3, 4, undefined, undefined, 'b') },
      {
        guard: (p) => p.a % p.b === 0 && p.a % p.c === 0 && p.a / p.b <= 200 && p.a / p.b - p.a / p.c >= 1,
      },
    ),
  },
  'u4f-c5': {
    L1: band(
      { a: R(12, 81, 3), b: R(2, 6), c: R(6, 72, 3, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 9 &&
          p.c / p.b <= 9 &&
          p.a / p.b - p.c / p.b >= 2,
      },
    ),
    L3: band(
      { a: R(120, 960, 4), b: R(2, 8), c: R(40, 900, 4, 'a') },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.c % p.b === 0 &&
          p.a / p.b <= 200 &&
          p.a / p.b - p.c / p.b >= 2,
      },
    ),
  },

  // ---------- 组合与拆分 ----------
  'u4f-p1': {
    L1: band(
      { a: R(12, 81, 3), b: R(6, 48, 3), c: R(2, 8) },
      {
        guard: (p) =>
          p.a > p.b &&
          (p.a - p.b) % p.c === 0 &&
          (p.a - p.b) / p.c >= 2 &&
          (p.a - p.b) / p.c <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 6), b: R(18, 240, 6), c: R(2, 8) },
      {
        guard: (p) =>
          p.a > p.b &&
          p.a - p.b >= 100 &&
          (p.a - p.b) % p.c === 0 &&
          (p.a - p.b) / p.c >= 10 &&
          (p.a - p.b) / p.c <= 200,
      },
    ),
  },
  'u4f-p2': {
    L1: band(
      { a: R(12, 81, 3), b: R(6, 36, 3), c: R(2, 9) },
      {
        guard: (p) =>
          p.a > p.b &&
          (p.a - p.b) % p.c === 0 &&
          (p.a - p.b) / p.c >= 1 &&
          (p.a - p.b) / p.c <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 6), b: R(18, 144, 6), c: R(2, 9) },
      {
        guard: (p) =>
          p.a > p.b &&
          p.a - p.b >= 100 &&
          (p.a - p.b) % p.c === 0 &&
          (p.a - p.b) / p.c >= 2 &&
          (p.a - p.b) / p.c <= 200,
      },
    ),
  },
  'u4f-p3': {
    L1: band(
      { a: R(12, 72, 4), b: R(2, 4), c: R(2, 3) },
      { guard: (p) => p.a % (p.b * p.c) === 0 && p.a / (p.b * p.c) >= 2 && p.a / (p.b * p.c) <= 9 },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(2, 5), c: R(2, 4) },
      { guard: (p) => p.a % (p.b * p.c) === 0 && p.a / (p.b * p.c) >= 10 && p.a / (p.b * p.c) <= 200 },
    ),
  },
  'u4f-p4': {
    L1: band(
      { a: R(12, 72, 4), b: R(2, 4), c: R(2, 4) },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.a / p.b >= 2 &&
          (p.a / p.b) % p.c === 0 &&
          p.a / p.b / p.c <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(2, 6), c: R(2, 6) },
      {
        guard: (p) =>
          p.a % p.b === 0 &&
          p.a / p.b >= 2 &&
          (p.a / p.b) % p.c === 0 &&
          p.a / p.b / p.c <= 200,
      },
    ),
  },
  'u4f-p5': {
    L1: band(
      { a: R(12, 72, 4), b: R(2, 4), c: R(2, 6) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b > p.c && p.a / p.b - p.c <= 9 },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(2, 6), c: R(5, 40) },
      { guard: (p) => p.a % p.b === 0 && p.a / p.b > p.c && p.a / p.b - p.c <= 200 },
    ),
  },

  // ---------- 多步合成 ----------
  'u4f-m1': {
    L1: band(
      { a: R(8, 81), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(112, 980, 7), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 12 && p.a / p.b <= 200 },
    ),
  },
  'u4f-m2': {
    L1: band(
      { a: R(8, 81), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(112, 900, 7), b: R(4, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 12 && p.a / p.b <= 100 },
    ),
  },
  'u4f-m3': {
    L1: band(
      { a: R(12, 81, 3), b: R(3, 9), c: R(2, 6) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 1 &&
          (p.a - p.b * p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(4, 9), c: R(2, 10) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          p.a - p.b * p.c >= 100 &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 10 &&
          (p.a - p.b * p.c) / p.b <= 200,
      },
    ),
  },
  'u4f-m4': {
    L1: band(
      { a: R(8, 81), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(112, 980, 7), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 12 && p.a / p.b <= 200 },
    ),
  },
  'u4f-m5': {
    L1: band(
      { a: R(8, 81), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 2 && p.a / p.b <= 9 },
    ),
    L3: band(
      { a: R(112, 980, 7), b: R(3, 9) },
      { guard: (p) => p.a % p.b !== 0 && p.a / p.b >= 12 && p.a / p.b <= 200 },
    ),
  },

  // ---------- 信息筛选 ----------
  'u4f-f1': {
    L1: band(
      { a: R(12, 81, 3), b: R(3, 9), c: R(2, 6) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 1 &&
          (p.a - p.b * p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(3, 9), c: R(2, 6) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          p.a - p.b * p.c >= 100 &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 10 &&
          (p.a - p.b * p.c) / p.b <= 200,
      },
    ),
  },
  'u4f-f2': {
    L1: band(
      { a: R(12, 81, 3), b: R(4, 9), c: R(2, 4) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          (p.a - p.b * p.c) / p.b >= 1 &&
          (p.a - p.b * p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(4, 9), c: R(2, 10) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          p.a - p.b * p.c >= 100 &&
          (p.a - p.b * p.c) / p.b >= 10 &&
          (p.a - p.b * p.c) / p.b <= 200,
      },
    ),
  },
  'u4f-f3': {
    L1: band(
      { a: R(12, 81, 3), b: R(3, 9), c: R(2, 4) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 1 &&
          (p.a - p.b * p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(3, 9), c: R(2, 10) },
      {
        guard: (p) =>
          p.a > p.b * p.c &&
          p.a - p.b * p.c >= 100 &&
          (p.a - p.b * p.c) % p.b === 0 &&
          (p.a - p.b * p.c) / p.b >= 10 &&
          (p.a - p.b * p.c) / p.b <= 200,
      },
    ),
  },
  'u4f-f4': {
    L1: band(
      { a: R(12, 81, 3), b: R(3, 9), c: R(6, 60, 3) },
      {
        guard: (p) =>
          p.a > p.c &&
          (p.a - p.c) % p.b === 0 &&
          (p.a - p.c) / p.b >= 1 &&
          (p.a - p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(3, 9), c: R(30, 600, 6) },
      {
        guard: (p) =>
          p.a > p.c &&
          p.a - p.c >= 100 &&
          (p.a - p.c) % p.b === 0 &&
          (p.a - p.c) / p.b >= 10 &&
          (p.a - p.c) / p.b <= 200,
      },
    ),
  },
  'u4f-f5': {
    L1: band(
      { a: R(12, 72, 4), b: R(2, 6), c: R(4, 40, 4) },
      {
        guard: (p) =>
          p.a > p.c &&
          (p.a - p.c) % p.b === 0 &&
          (p.a - p.c) / p.b >= 1 &&
          (p.a - p.c) / p.b <= 9,
      },
    ),
    L3: band(
      { a: R(120, 960, 8), b: R(2, 8), c: R(20, 400, 8) },
      {
        guard: (p) =>
          p.a > p.c &&
          p.a - p.c >= 100 &&
          (p.a - p.c) % p.b === 0 &&
          (p.a - p.c) / p.b >= 10 &&
          (p.a - p.c) / p.b <= 200,
      },
    ),
  },
}
