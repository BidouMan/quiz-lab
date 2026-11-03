/**
 * 3A-U1 两步四则运算 · 填空 · 三档数值域与题干
 * 基线（L2）在 u1-two-step-fill.ts；本文件补 L1 / L3。
 * 三档结构不同，题干由 template 覆盖：
 * - L1：单步加、减、乘，数值以两位加减与表内乘法为主；
 * - L2：带括号两步（基线）；
 * - L3：三步或含括号，答案控制在三年级可算范围。
 * 全程只用加、减、乘，不出现除法、余数与平均分。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U1_TWO_STEP_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u1f-d1': {
    L1: band(
      { a: R(25, 68), b: R(12, 31) },
      { template: '计算：{a} 加 {b} = ____。', formulas: ['a+b'], guard: (p) => p.a + p.b <= 99 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 9), d: R(10, 40) },
      {
        template: '计算：（{a} 加 {b}）乘 {c} 加 {d} = ____。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 200,
      },
    ),
  },
  'u1f-d2': {
    L1: band(
      { a: R(40, 95), b: R(8, 35) },
      { template: '计算：{a} 减 {b} = ____。', formulas: ['a-b'], guard: (p) => p.a > p.b },
    ),
    L3: band(
      { a: R(10, 19), b: R(2, 8), c: R(3, 9), d: R(5, 30) },
      {
        template: '计算：（{a} 减 {b}）乘 {c} 再减 {d} = ____。',
        formulas: ['(a-b)*c-d'],
        guard: (p) => p.a > p.b && (p.a - p.b) * p.c - p.d >= 2 && (p.a - p.b) * p.c - p.d <= 200,
      },
    ),
  },
  'u1f-d3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '计算：{a} 乘 {b} = ____。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 9), d: R(5, 40) },
      {
        template: '计算：{a} 乘（{b} 加 {c}）再减 {d} = ____。',
        formulas: ['a*(b+c)-d'],
        guard: (p) => p.a * (p.b + p.c) - p.d >= 2,
      },
    ),
  },
  'u1f-d4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} 的 {b} 倍是 ____。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 9), d: R(5, 40) },
      {
        template: '{a} 的（{b} 加 {c}）倍与 {d} 的和是 ____。',
        formulas: ['a*(b+c)+d'],
        guard: (p) => p.a * (p.b + p.c) + p.d <= 250,
      },
    ),
  },
  'u1f-d5': {
    L1: band(
      { a: R(15, 60), b: R(8, 35) },
      { template: '比 {a} 多 {b} 的数是 ____。', formulas: ['a+b'], guard: (p) => p.a + p.b <= 99 },
    ),
    L3: band(
      { a: R(20, 45), b: R(10, 30), c: R(8, 25), d: R(2, 5) },
      {
        template: '计算：（{a} 加 {b} 减 {c}）乘 {d} = ____。',
        formulas: ['(a+b-c)*d'],
        guard: (p) => p.a + p.b - p.c >= 5 && (p.a + p.b - p.c) * p.d <= 300,
      },
    ),
  },

  // ---------- 每份数 ----------
  'u1f-p1': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} 个装一袋，{b} 袋共 ____ 个。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 8), b: R(2, 8), c: R(2, 8), d: R(2, 20) },
      {
        template: '每袋装（{a} 加 {b}）个，{c} 袋，另装 {d} 个，共 ____ 个。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 200,
      },
    ),
  },
  'u1f-p2': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每排 {a} 人，{b} 排共 ____ 人。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 8), d: R(2, 30) },
      {
        template: '每排（{a} 加 {b}）人，{c} 排，另加 {d} 人，共 ____ 人。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 250,
      },
    ),
  },
  'u1f-p3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每天写 {a} 个，{b} 天共 ____ 个。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 8), d: R(2, 30) },
      {
        template: '每天写（{a} 加 {b}）个，{c} 天后再写 {d} 个，共 ____ 个。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 250,
      },
    ),
  },
  'u1f-p4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每{cls}{item} {a} 元，{b} {cls}共 ____ 元。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 6), b: R(2, 6), c: R(2, 9), d: R(5, 30) },
      {
        template: '{a} {cls}{item}和 {b} {cls}{item}，每{cls} {c} 元，再买 {d} 元的书，共 ____ 元。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => p.a !== p.b && (p.a + p.b) * p.c + p.d <= 999,
      },
    ),
  },
  'u1f-p5': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每{cls}{item} {a} 元，{b} {cls}要 ____ 元。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 6), c: R(2, 6), d: R(2, 20) },
      {
        template: '每{cls}{item} {a} 元，{b} {cls}和 {c} {cls}共 ____ 元，再付 {d} 元运费，共 ____ 元。',
        formulas: ['(b+c)*a', '(b+c)*a+d'],
        guard: (p) => (p.b + p.c) * p.a <= 99 && (p.b + p.c) * p.a + p.d <= 150,
      },
    ),
  },

  // ---------- 比较 ----------
  'u1f-c1': {
    L1: band(
      { a: R(20, 70), b: R(5, 30) },
      { template: '{a} 比 {b} 多 ____。', formulas: ['a-b'], guard: (p) => p.a > p.b },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 15), d: R(2, 9) },
      {
        template: '（{a} 加 {b}）比 {c} 多的数乘 {d}，得 ____。',
        formulas: ['(a+b-c)*d'],
        guard: (p) => p.a + p.b > p.c + 2 && (p.a + p.b - p.c) * p.d <= 150,
      },
    ),
  },
  'u1f-c2': {
    L1: band(
      { a: R(10, 40), b: R(20, 80) },
      { template: '{a} 比 {b} 少 ____。', formulas: ['b-a'], guard: (p) => p.b > p.a },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(20, 60), d: R(5, 30) },
      {
        template: '（{a} 乘 {b}）比 {c} 少的数再加 {d}，得 ____。',
        formulas: ['c-a*b+d'],
        guard: (p) => p.c > p.a * p.b && p.c - p.a * p.b + p.d <= 200,
      },
    ),
  },
  'u1f-c3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} 个 {b} 是 ____。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 9), d: R(5, 30) },
      {
        template: '{a} 的（{b} 加 {c}）倍减去 {a} 与 {d} 的和，得 ____。',
        formulas: ['a*(b+c)-(a+d)'],
        guard: (p) => p.a * (p.b + p.c) > p.a + p.d + 2,
      },
    ),
  },
  'u1f-c4': {
    L1: band(
      { a: R(20, 70), b: R(5, 30) },
      { template: '{a} 和 {b} 相差 ____。', formulas: ['a-b'], guard: (p) => p.a > p.b },
    ),
    L3: band(
      { a: R(10, 30), b: R(2, 8), c: R(5, 20), d: R(10, 60) },
      {
        template: '（{a} 减 {b}）与 {c} 的和，比 {d} 多 ____。',
        formulas: ['a-b+c-d'],
        guard: (p) => p.a > p.b && p.a - p.b + p.c > p.d + 2,
      },
    ),
  },
  'u1f-c5': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} 个 {b} 相加是 ____。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 20), d: R(2, 6) },
      {
        template: '{a} 的 {b} 倍与 {c} 的和再乘 {d}，得 ____。',
        formulas: ['(a*b+c)*d'],
        guard: (p) => (p.a * p.b + p.c) * p.d <= 400,
      },
    ),
  },

  // ---------- 组合与拆分 ----------
  'u1f-k1': {
    L1: band(
      { a: R(5, 40), b: R(5, 30) },
      { template: '{a} 个和 {b} 个合起来是 ____ 个。', formulas: ['a+b'], guard: (p) => p.a + p.b <= 60 },
    ),
    L3: band(
      { a: R(5, 20), b: R(5, 20), c: R(3, 15), d: R(2, 15) },
      {
        template: '{a} 个与 {b} 个合起来，拿走 {c} 个，再添 {d} 个，现有 ____ 个。',
        formulas: ['a+b-c+d'],
        guard: (p) => p.a + p.b - p.c >= 2 && p.a + p.b - p.c + p.d <= 60,
      },
    ),
  },
  'u1f-k2': {
    L1: band(
      { a: R(20, 80), b: R(5, 30) },
      { template: '从 {a} 里去掉 {b}，还剩 ____。', formulas: ['a-b'], guard: (p) => p.a > p.b },
    ),
    L3: band(
      { a: R(10, 40), b: R(5, 20), c: R(5, 30), d: R(2, 6) },
      {
        template: '从（{a} 加 {b}）里去掉 {c} 后乘 {d}，得 ____。',
        formulas: ['(a+b-c)*d'],
        guard: (p) => p.a + p.b > p.c + 2 && (p.a + p.b - p.c) * p.d <= 250,
      },
    ),
  },
  'u1f-k3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} 个一堆，{b} 堆共 ____ 个。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 8), b: R(2, 8), c: R(2, 8), d: R(2, 20) },
      {
        template: '（{a} 加 {b}）个一堆，{c} 堆，再添 {d} 个，共 ____ 个。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 200,
      },
    ),
  },
  'u1f-k4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '{a} {cls}装一袋，{b} 袋共 ____ {cls}。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 8), b: R(2, 8), c: R(2, 8), d: R(2, 20) },
      {
        template: '（{a} 加 {b}）{cls}装一袋，{c} 袋，另加 {d} {cls}，共 ____ {cls}。',
        formulas: ['(a+b)*c+d'],
        guard: (p) => (p.a + p.b) * p.c + p.d <= 200,
      },
    ),
  },
  'u1f-k5': {
    L1: band(
      { a: R(10, 60), b: R(5, 30) },
      { template: '{a} 加 {b} 的和是 ____。', formulas: ['a+b'], guard: (p) => p.a + p.b <= 90 },
    ),
    L3: band(
      { a: R(10, 45), b: R(5, 25), c: R(5, 30), d: R(2, 5) },
      {
        template: '（{a} 加 {b}）的和再减 {c} 后乘 {d}，得 ____。',
        formulas: ['(a+b-c)*d'],
        guard: (p) => p.a + p.b > p.c + 2 && (p.a + p.b - p.c) * p.d <= 250,
      },
    ),
  },

  // ---------- 多步合成 ----------
  'u1f-m1': {
    L1: band(
      { a: R(5, 40), b: R(5, 30) },
      { template: '{a} {cls}和 {b} {cls}一共 ____ {cls}。', formulas: ['a+b'], guard: (p) => p.a + p.b <= 60 },
    ),
    L3: band(
      { a: R(5, 20), b: R(5, 20), c: R(2, 10), d: R(2, 10) },
      {
        template: '{a} {cls}和 {b} {cls}共 ____ {cls}，送出 {c} {cls}后又添 {d} {cls}，现 ____ {cls}。',
        formulas: ['a+b', 'a+b-c+d'],
        guard: (p) => p.a + p.b - p.c >= 2 && p.a + p.b - p.c + p.d <= 60,
      },
    ),
  },
  'u1f-m2': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每天读 {a} 页，{b} 天共 ____ 页。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(5, 30) },
      {
        template: '每天读 {a} 页，{b} 天读了 ____ 页，还剩 {c} 页，全书 ____ 页。',
        formulas: ['a*b', 'a*b+c'],
        guard: (p) => p.a * p.b + p.c <= 120,
      },
    ),
  },
  'u1f-m3': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每盒 {a} 支，{b} 盒共 ____ 支。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 20), d: R(2, 20) },
      {
        template: '每盒 {a} 支，{b} 盒，又添 {c} 支，再送出 {d} 支，共 ____ 支。',
        formulas: ['a*b+c-d'],
        guard: (p) => p.a * p.b + p.c - p.d >= 2,
      },
    ),
  },
  'u1f-m4': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每箱 {a} 个，{b} 箱共 ____ 个。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(5, 30), d: R(5, 20) },
      {
        template: '每箱 {a} 个，{b} 箱共 ____ 个，卖掉 {c} 个，又添 {d} 个，现 ____ 个。',
        formulas: ['a*b', 'a*b-c+d'],
        guard: (p) => p.a * p.b >= p.c + 2 && p.a * p.b - p.c + p.d <= 120,
      },
    ),
  },
  'u1f-m5': {
    L1: band(
      { a: R(2, 9), b: R(2, 9) },
      { template: '每捆 {a} 本，{b} 捆共 ____ 本。', formulas: ['a*b'], guard: (p) => p.a * p.b <= 81 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 6), c: R(2, 6), d: R(5, 20) },
      {
        template: '每捆 {a} 本，上午捆 {b} 捆，下午捆 {c} 捆，共 ____ 本，送出 {d} 本，剩 ____ 本。',
        formulas: ['(b+c)*a', '(b+c)*a-d'],
        guard: (p) => (p.b + p.c) * p.a > p.d + 2,
      },
    ),
  },

  // ---------- 逆向求 ----------
  'u1f-i1': {
    L1: band(
      { a: R(5, 20), b: R(20, 60) },
      { template: '____ 加 {a} 得 {b}。', formulas: ['b-a'], guard: (p) => p.b > p.a + 2 },
    ),
    L3: band(
      { a: R(3, 9), b: R(3, 9), c: R(5, 30), d: R(30, 80) },
      {
        template: '____ 减去（{a} 加 {b}）再加 {c} 得 {d}。',
        formulas: ['d-c+a+b'],
        guard: (p) => p.d - p.c + p.a + p.b >= 2 && p.d - p.c + p.a + p.b <= 120,
      },
    ),
  },
  'u1f-i2': {
    L1: band(
      { a: R(5, 30), b: R(20, 60) },
      { template: '____ 减 {a} 得 {b}。', formulas: ['b+a'], guard: (p) => p.a + p.b <= 99 },
    ),
    L3: band(
      { a: R(5, 15), b: R(2, 8), c: R(5, 20), d: R(20, 60) },
      {
        template: '____ 加（{a} 减 {b}）再减 {c} 得 {d}。',
        formulas: ['d+c-a+b'],
        guard: (p) => p.a > p.b && p.d + p.c - p.a + p.b >= 2 && p.d + p.c - p.a + p.b <= 120,
      },
    ),
  },
  'u1f-i3': {
    L1: band(
      { a: R(10, 40), b: R(20, 70) },
      { template: '{a} 加 ____ 得 {b}。', formulas: ['b-a'], guard: (p) => p.b > p.a + 2 },
    ),
    L3: band(
      { a: R(5, 20), b: R(2, 8), c: R(5, 20), d: R(30, 80) },
      {
        template: '{a} 加（____ 减 {b}）再加 {c} 得 {d}。',
        formulas: ['d-c-a+b'],
        guard: (p) => p.d - p.c - p.a + p.b >= 2,
      },
    ),
  },
  'u1f-i4': {
    L1: band(
      { a: R(20, 80), b: R(5, 30) },
      { template: '{a} 减 ____ 得 {b}。', formulas: ['a-b'], guard: (p) => p.a > p.b },
    ),
    L3: band(
      { a: R(10, 40), b: R(5, 20), c: R(5, 20), d: R(30, 80) },
      {
        template: '（{a} 加 {b}）减 ____ 再加 {c} 得 {d}。',
        formulas: ['a+b+c-d'],
        guard: (p) => p.a + p.b + p.c > p.d + 2,
      },
    ),
  },
  'u1f-i5': {
    L1: band(
      { a: R(20, 70), b: R(5, 30) },
      { template: '{a} 比 ____ 多 {b}。', formulas: ['a-b'], guard: (p) => p.a > p.b + 2 },
    ),
    L3: band(
      { a: R(2, 9), b: R(2, 9), c: R(2, 15), d: R(2, 9) },
      {
        template: '（{a} 加 {b}）比 ____ 多 {c}，这个数再乘 {d} 得 ____。',
        formulas: ['a+b-c', '(a+b-c)*d'],
        guard: (p) => p.a + p.b > p.c + 2 && (p.a + p.b - p.c) * p.d <= 200,
      },
    ),
  },
}
