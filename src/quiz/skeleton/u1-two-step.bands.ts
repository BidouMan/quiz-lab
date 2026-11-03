/**
 * 3A-U1 两步四则运算 · 应用题 · 三档数值域
 * 基线（L1）在 u1-two-step.ts 的 slots 里；本文件补 L2 / L3。
 * P0 红线不变：只用加、减、乘，乘法全在表内（≤9×9），不出现除法。
 * 三档只放大加减数量与总价，句式和场景池不动。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U1_TWO_STEP_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u1-d1': {
    L2: band(
      { a: R(20, 60), b: R(10, 35), c: R(10, 35) },
      { guard: (p) => p.a + p.b <= 120 && p.a + p.b - p.c >= 5 },
    ),
    L3: band(
      { a: R(80, 300), b: R(30, 100), c: R(30, 100) },
      { guard: (p) => p.a + p.b <= 600 && p.a + p.b - p.c >= 5 },
    ),
  },
  'u1-d2': {
    L2: band({ a: R(2, 9), b: R(3, 9) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(2, 9), b: R(3, 9) }, { guard: (p) => p.a * p.b <= 81 }),
  },
  'u1-d3': {
    L2: band({ a: R(2, 9), b: R(3, 9) }),
    L3: band({ a: R(2, 9), b: R(3, 9) }),
  },
  'u1-d4': {
    L2: band({ a: R(2, 6), b: R(3, 9), c: R(30, 90) }),
    L3: band({ a: R(2, 6), b: R(3, 9), c: R(50, 80) }),
  },
  'u1-d5': {
    L2: band({ a: R(40, 120), b: R(10, 35), c: R(10, 35) }),
    L3: band({ a: R(80, 150), b: R(30, 80), c: R(30, 80) }),
  },

  // ---------- 逆向求 ----------
  'u1-i1': {
    L2: band({ a: R(10, 40), b: R(20, 70) }, { guard: (p) => p.a + p.b <= 120 }),
    L3: band({ a: R(15, 80), b: R(30, 150) }, { guard: (p) => p.a + p.b <= 300 }),
  },
  'u1-i2': {
    L2: band({ a: R(20, 50), b: R(10, 70) }, { guard: (p) => p.a + p.b <= 150 }),
    L3: band({ a: R(30, 80), b: R(20, 200) }, { guard: (p) => p.a + p.b <= 400 }),
  },
  'u1-i3': {
    L2: band({ a: R(5, 20), b: R(5, 25), c: R(50, 150) }),
    L3: band({ a: R(10, 40), b: R(10, 50), c: R(100, 300) }),
  },
  'u1-i4': {
    L2: band({ a: R(10, 35), c: R(50, 120) }),
    L3: band({ a: R(20, 80), c: R(100, 350) }),
  },
  'u1-i5': {
    L2: band({ a: R(50, 150), b: R(10, 40), c: R(10, 40) }),
    L3: band({ a: R(100, 400), b: R(20, 100), c: R(20, 100) }),
  },

  // ---------- 比较与最值 ----------
  'u1-c1': {
    L2: band({ a: R(2, 6), b: R(1, 8), c: R(3, 9) }, { guard: (p) => p.b * p.c <= 72 }),
    L3: band({ a: R(2, 6), b: R(1, 8), c: R(3, 9) }, { guard: (p) => p.b * p.c <= 81 }),
  },
  'u1-c2': {
    L2: band(
      { a: R(20, 60), b: R(5, 30) },
      { guard: (p) => p.a - p.b >= 2 && 2 * p.a - p.b <= 150 },
    ),
    L3: band(
      { a: R(40, 150), b: R(10, 60) },
      { guard: (p) => p.a - p.b >= 2 && 2 * p.a - p.b <= 400 },
    ),
  },
  'u1-c3': {
    L2: band({ a: R(8, 12), b: R(30, 45), c: R(5, 15) }, { guard: (p) => p.a + p.b + p.c <= 90 }),
    L3: band({ a: R(8, 12), b: R(30, 45), c: R(10, 30) }, { guard: (p) => p.a + p.b + p.c <= 100 }),
  },
  'u1-c4': {
    L2: band({ a: R(30, 50), b: R(5, 15) }, { guard: (p) => 2 * p.a + p.b <= 110 }),
    L3: band({ a: R(36, 50), b: R(8, 18) }, { guard: (p) => 2 * p.a + p.b <= 110 }),
  },
  'u1-c5': {
    L2: band({ a: R(20, 60), b: R(5, 30) }, { guard: (p) => 2 * p.a + p.b <= 150 }),
    L3: band({ a: R(40, 150), b: R(10, 60) }, { guard: (p) => 2 * p.a + p.b <= 350 }),
  },

  // ---------- 组合与拆分 ----------
  'u1-p1': {
    L2: band(
      { a: R(40, 100), b: R(10, 30), c: R(10, 40) },
      { guard: (p) => p.a - p.b >= 2 && p.a - p.b + p.c <= 150 },
    ),
    L3: band(
      { a: R(60, 250), b: R(30, 100), c: R(30, 100) },
      { guard: (p) => p.a - p.b >= 2 && p.a - p.b + p.c <= 400 },
    ),
  },
  'u1-p2': {
    L2: band(
      { a: R(2, 6), b: R(15, 50), c: R(3, 9) },
      { guard: (p) => p.a * p.c + p.b <= 150 },
    ),
    L3: band(
      { a: R(2, 6), b: R(20, 60), c: R(3, 9) },
      { guard: (p) => p.a * p.c + p.b <= 250 },
    ),
  },
  'u1-p3': {
    L2: band({ a: R(4, 9), b: R(3, 9), c: R(4, 30) }),
    L3: band({ a: R(4, 9), b: R(3, 9), c: R(5, 40) }),
  },
  'u1-p4': {
    L2: band(
      { a: R(4, 9), b: R(3, 9), c: R(3, 30) },
      { guard: (p) => p.a * p.b + p.c <= 150 },
    ),
    L3: band(
      { a: R(4, 9), b: R(3, 9), c: R(5, 50) },
      { guard: (p) => p.a * p.b + p.c <= 180 },
    ),
  },
  'u1-p5': {
    L2: band(
      { a: R(50, 150), b: R(2, 9), c: R(2, 6) },
      {
        guard: (p) => {
          const left = p.a - p.b * p.c
          return left >= 1 && left <= 40
        },
      },
    ),
    L3: band(
      { a: R(100, 500), b: R(2, 9), c: R(2, 6) },
      {
        guard: (p) => {
          const left = p.a - p.b * p.c
          return left >= 1 && left <= 60
        },
      },
    ),
  },

  // ---------- 多步合成 ----------
  'u1-m1': {
    L2: band(
      { a: R(30, 80), b: R(20, 60), c: R(10, 30) },
      { guard: (p) => p.a + p.b <= 150 && p.a + p.b - p.c >= 5 },
    ),
    L3: band(
      { a: R(60, 200), b: R(40, 150), c: R(30, 80) },
      { guard: (p) => p.a + p.b <= 500 && p.a + p.b - p.c >= 5 },
    ),
  },
  'u1-m2': {
    L2: band(
      { a: R(5, 9), b: R(3, 9), c: R(10, 60) },
      { guard: (p) => p.a * p.b + p.c <= 150 },
    ),
    L3: band(
      { a: R(5, 9), b: R(3, 9), c: R(20, 100) },
      { guard: (p) => p.a * p.b + p.c <= 250 },
    ),
  },
  'u1-m3': {
    L2: band({ a: R(3, 9), b: R(4, 9), c: R(15, 60) }),
    L3: band({ a: R(3, 9), b: R(4, 9), c: R(20, 81) }),
  },
  'u1-m4': {
    L2: band({ a: R(50, 150), b: R(60, 180), c: R(50, 150) }, { guard: (p) => p.a + p.b + p.c <= 400 }),
    L3: band(
      { a: R(100, 400), b: R(150, 600), c: R(100, 400) },
      { guard: (p) => p.a + p.b + p.c <= 1500 },
    ),
  },
  'u1-m5': {
    L2: band({ a: R(80, 250), b: R(10, 60), c: R(10, 60) }),
    L3: band({ a: R(200, 600), b: R(30, 150), c: R(10, 40) }),
  },

  // ---------- 判断与验证 ----------
  'u1-j1': {
    L2: band({ a: R(2, 6), b: R(50, 100), c: R(3, 9) }),
    L3: band({ a: R(2, 6), b: R(50, 100), c: R(3, 9) }),
  },
  'u1-j2': {
    L2: band({ a: R(20, 150), b: R(10, 80), c: R(10, 100), d: R(10, 150) }),
    L3: band({ a: R(15, 150), b: R(10, 80), c: R(10, 100), d: R(10, 150) }),
  },
  'u1-j3': {
    L2: band({ a: R(5, 9), b: R(3, 9), c: R(50, 81) }, { guard: (p) => p.a * p.b <= 81 }),
    L3: band({ a: R(5, 9), b: R(3, 9), c: R(50, 81) }, { guard: (p) => p.a * p.b <= 81 }),
  },
  'u1-j4': {
    L2: band({ a: R(2, 6), b: R(2, 9), c: R(50, 100) }),
    L3: band({ a: R(2, 6), b: R(2, 9), c: R(50, 100) }),
  },
  'u1-j5': {
    L2: band({ a: R(50, 200), b: R(10, 50), c: R(10, 50) }, { guard: (p) => p.b + p.c <= 200 }),
    L3: band({ a: R(50, 200), b: R(10, 50), c: R(10, 50) }, { guard: (p) => p.b + p.c <= 200 }),
  },
}
