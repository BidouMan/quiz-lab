/**
 * 3A-U5 年、月、日 · 填空 · 三档数值域
 * 基线（L2）写在 u5-date.ts 的 slots 里；本文件补 L1 / L3。
 * 三档共用同一句式与场景池，只换年份跨度、时长、天数与月份区间。
 *
 * 口径：
 * - 时间题一律不跨零点；出发时刻用“最迟”，12 时制与 24 时制不混用；
 * - L1 以整十/整五分钟、个位数年份跨度、短时段为主；L3 拉长到小时级、月级、年级跨度；
 * - 所有题答案唯一：不给“连续两个大月”这类多解题。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'
import { isLeap, monthDays, yearDays, daysBetween, elapsedMinutes } from './expr.ts'

export const U5_DATE_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u5-d1': {
    L1: band({ m: R(1, 12) }, { guard: (p) => p.m !== 2 }),
    L3: band({ m: R(1, 12) }, { guard: (p) => p.m !== 2 }),
  },
  'u5-d2': {
    L1: band({ y: R(2015, 2030) }),
    L3: band({ y: R(1990, 2030) }),
  },
  'u5-d3': {
    L1: band({ h: R(1, 6) }),
    L3: band({ h: R(4, 11) }),
  },
  'u5-d4': {
    L1: band(
      {
        h1: R(8, 17),
        m1: R(0, 55, 5),
        h2: R(9, 19, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
      },
      {
        guard: (p) => {
          const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
          return total >= 20 && total <= 90
        },
      },
    ),
    L3: band(
      {
        h1: R(8, 17),
        m1: R(0, 55, 5),
        h2: R(10, 21, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
      },
      {
        guard: (p) => {
          const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
          return total >= 60 && total <= 180
        },
      },
    ),
  },
  'u5-d5': {
    L1: band(
      {
        m1: R(3, 11),
        d1: R(1, 28),
        m2: R(4, 12, undefined, undefined, 'm1'),
        d2: R(1, 28),
      },
      {
        guard: (p) => {
          if (p.m2 - p.m1 !== 1) return false
          const days = daysBetween(p.m1, p.d1, p.m2, p.d2)
          return days >= 3 && days <= 15
        },
      },
    ),
    L3: band(
      {
        m1: R(3, 10),
        d1: R(1, 28),
        m2: R(4, 12, undefined, undefined, 'm1'),
        d2: R(1, 28),
      },
      {
        guard: (p) => {
          if (p.m2 - p.m1 > 2) return false
          const days = daysBetween(p.m1, p.d1, p.m2, p.d2)
          return days >= 12 && days <= 45
        },
      },
    ),
  },

  // ---------- 逆向求 ----------
  'u5-i1': {
    L1: band({ h1: R(8, 17), m1: R(0, 55, 5), n: R(20, 60, 5) }),
    L3: band({ h1: R(8, 18), m1: R(0, 55, 5), n: R(40, 150, 5) }),
  },
  'u5-i2': {
    L1: band({ h2: R(10, 19), m2: R(0, 55, 5), n: R(20, 60, 5) }),
    L3: band({ h2: R(11, 20), m2: R(0, 55, 5), n: R(40, 150, 5) }),
  },
  'u5-i3': {
    L1: band({ n: R(10, 20) }, { guard: (p) => p.n % 7 !== 0 }),
    L3: band({ n: R(21, 49) }, { guard: (p) => p.n % 7 !== 0 }),
  },
  'u5-i4': {
    L1: band(
      { m1: R(1, 10), m2: R(2, 12, undefined, undefined, 'm1') },
      { guard: (p) => p.m2 - p.m1 >= 2 && p.m2 - p.m1 <= 4 },
    ),
    L3: band(
      { m1: R(1, 10), m2: R(2, 12, undefined, undefined, 'm1') },
      { guard: (p) => p.m2 - p.m1 >= 5 && p.m2 - p.m1 <= 11 },
    ),
  },
  'u5-i5': {
    L1: band({ n: R(75, 140) }, { guard: (p) => p.n % 60 !== 0 }),
    L3: band({ n: R(100, 300) }, { guard: (p) => p.n % 60 !== 0 }),
  },

  // ---------- 比较与最值 ----------
  'u5-c1': {
    L1: band({
      m1: R(1, 6),
      m2: R(2, 12, undefined, undefined, 'm1'),
    }),
    L3: band({
      m1: R(5, 11),
      m2: R(6, 12, undefined, undefined, 'm1'),
    }),
  },
  'u5-c2': {
    L1: band({ y1: R(2015, 2025), y2: R(2016, 2026, undefined, undefined, 'y1') }),
    L3: band({ y1: R(1990, 2028), y2: R(1991, 2030, undefined, undefined, 'y1') }),
  },
  'u5-c3': {
    L1: band({ n1: R(20, 50, 5), n2: R(25, 70, 5, undefined, 'n1') }),
    L3: band({ n1: R(30, 90, 5), n2: R(45, 120, 5, undefined, 'n1') }),
  },
  'u5-c4': {
    L1: band({
      m1: R(1, 12),
      m2: R(1, 12),
    }),
    L3: band({
      m1: R(1, 12),
      m2: R(1, 12),
    }),
  },
  'u5-c5': {
    L1: band({ h1: R(9, 11), h: R(2, 5) }),
    L3: band({ h1: R(8, 11), h: R(2, 6) }),
  },

  // ---------- 组合与拆分 ----------
  'u5-p1': {
    L1: band({ a: R(1, 2), b: R(10, 50, 5) }),
    L3: band({ a: R(2, 3), b: R(5, 55, 5) }),
  },
  'u5-p2': {
    L1: band({ n: R(3, 9) }),
    L3: band({ n: R(8, 12) }),
  },
  'u5-p3': {
    L1: band({ y: R(2015, 2030) }),
    L3: band({ y: R(1990, 2030) }),
  },
  'u5-p4': {
    L1: band({ m: R(3, 12) }, { guard: (p) => p.m !== 2 }),
    L3: band({ m: R(1, 12) }, { guard: (p) => p.m !== 2 }),
  },
  'u5-p5': {
    L1: band({ y: R(2015, 2030) }),
    L3: band({ y: R(1990, 2030) }),
  },

  // ---------- 多步合成 ----------
  'u5-m1': {
    L1: band(
      { h2: R(10, 17), m2: R(0, 55, 5), n: R(20, 60, 5) },
      {
        guard: (p) => {
          const start = p.h2 * 60 + p.m2 - p.n
          return start >= 8 * 60 && start <= 21 * 60
        },
      },
    ),
    L3: band(
      { h2: R(11, 18), m2: R(0, 55, 5), n: R(40, 120, 5) },
      {
        guard: (p) => {
          const start = p.h2 * 60 + p.m2 - p.n
          return start >= 8 * 60 && start <= 21 * 60
        },
      },
    ),
  },
  'u5-m2': {
    L1: band(
      { h: R(2, 4), n: R(15, 30, 5) },
      {
        guard: (p) => {
          const arrive = (p.h + 12) * 60 - p.n
          return arrive >= 13 * 60 && arrive <= 17 * 60 + 55
        },
      },
    ),
    L3: band(
      { h: R(3, 5), n: R(20, 45, 5) },
      {
        guard: (p) => {
          const arrive = (p.h + 12) * 60 - p.n
          return arrive >= 13 * 60 && arrive <= 17 * 60 + 55
        },
      },
    ),
  },
  'u5-m3': {
    L1: band(
      {
        m1: R(3, 10),
        d1: R(1, 28),
        m2: R(4, 12, undefined, undefined, 'm1'),
        d2: R(1, 28),
        b: R(8, 12),
      },
      {
        guard: (p) => {
          if (p.m2 - p.m1 !== 1) return false
          const days = daysBetween(p.m1, p.d1, p.m2, p.d2)
          return days >= 4 && days <= 10
        },
      },
    ),
    L3: band(
      {
        m1: R(3, 10),
        d1: R(1, 28),
        m2: R(4, 12, undefined, undefined, 'm1'),
        d2: R(1, 28),
        b: R(12, 20),
      },
      {
        guard: (p) => {
          if (p.m2 - p.m1 > 2) return false
          const days = daysBetween(p.m1, p.d1, p.m2, p.d2)
          return days >= 7 && days <= 21
        },
      },
    ),
  },
  'u5-m4': {
    L1: band({ b: R(10, 25, 5), c: R(4, 7) }),
    L3: band({ b: R(20, 35, 5), c: R(6, 10) }),
  },
  'u5-m5': {
    L1: band(
      {
        h1: R(8, 16),
        m1: R(0, 55, 5),
        h2: R(10, 18, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
        n: R(10, 25, 5),
      },
      {
        guard: (p) => {
          const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
          return total >= 40 && total <= 120
        },
      },
    ),
    L3: band(
      {
        h1: R(8, 17),
        m1: R(0, 55, 5),
        h2: R(11, 20, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
        n: R(20, 45, 5),
      },
      {
        guard: (p) => {
          const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
          return total >= 90 && total <= 180
        },
      },
    ),
  },

  // ---------- 判断与验证 ----------
  'u5-j1': {
    L1: band({ y: R(2015, 2030) }, { guard: (p) => isLeap(p.y) }),
    L3: band({ y: R(1990, 2030) }, { guard: (p) => isLeap(p.y) }),
  },
  'u5-j2': {
    L1: band({ m: R(1, 12) }, { guard: (p) => monthDays(p.m) === 31 }),
    L3: band({ m: R(1, 12) }, { guard: (p) => monthDays(p.m) === 31 }),
  },
  'u5-j3': {
    L1: band({ m: R(1, 12) }, { guard: (p) => monthDays(p.m) === 30 }),
    L3: band({ m: R(1, 12) }, { guard: (p) => monthDays(p.m) === 30 }),
  },
  'u5-j4': {
    L1: band(
      { h1: R(8, 16), h2: R(9, 20, undefined, undefined, 'h1') },
      { guard: (p) => p.h2 - p.h1 >= 1 && p.h2 - p.h1 <= 4 },
    ),
    L3: band(
      { h1: R(8, 16), h2: R(11, 20, undefined, undefined, 'h1') },
      { guard: (p) => p.h2 - p.h1 >= 1 && p.h2 - p.h1 <= 8 },
    ),
  },
  'u5-j5': {
    L1: band({ y: R(2015, 2030) }, { guard: (p) => isLeap(p.y) }),
    L3: band({ y: R(1990, 2030) }, { guard: (p) => isLeap(p.y) }),
  },
}

/** 供自检用：档内最大结果，确认没有把“年”算成四位数以外的量级 */
export const U5_BAND_LIMITS = {
  maxYear: 2030,
  maxSpanDays: 45,
  maxMinutes: 300,
  yearDaysMax: yearDays(2000),
}
