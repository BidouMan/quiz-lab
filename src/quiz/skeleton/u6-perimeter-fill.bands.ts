/**
 * 3A-U6 周长 · 填空 · 三档数值域与题干
 * 基线（L2）在 u6-perimeter-fill.ts；本文件补 L1 / L3。
 * L1：长度单位换算与基础周长（厘米→毫米、米→分米/厘米，只做大单位化小单位，单口径不混算）；
 * L3：组合图形或边长变化。
 * 尺寸 guard 与应用题包一致：宽严格小于长、边长在合理区间。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U6_PERIMETER_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ================= 厘米组 L1 =================
  'u6f-d1': {
    L1: band(
      { a: R(8, 30, 2), b: R(4, 18, 2, 'a') },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，周长 ____ 厘米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 40,
      },
    ),
    L3: band(
      { a: R(16, 40, 2), b: R(8, 24, 2, 'a') },
      {
        template: '两个长 {a} 厘米、宽 {b} 厘米的长方形沿宽边拼，大长方形周长 ____ 厘米。',
        formulas: ['(a*2+b)*2'],
      },
    ),
  },
  'u6f-d2': {
    L1: band(
      { a: R(24, 25) },
      { template: '正方形边长 {a} 厘米，周长 ____ 厘米。', formulas: ['a*4'] },
    ),
    L3: band(
      { a: R(20, 60, 2), b: R(8, 26, 2, 'a') },
      {
        template: '一{cls}长 {a} 厘米、宽 {b} 厘米的长方形，沿长的中点剪成两个，每个周长 ____ 厘米。',
        formulas: ['(a/2+b)*2'],
        guard: (p) => p.a % 2 === 0,
      },
    ),
  },
  'u6f-d3': {
    L1: band(
      { a: R(8, 26, 2), b: R(4, 14, 2, 'a') },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，四条边共 ____ 厘米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 35,
      },
    ),
    L3: band(
      { a: R(10, 35) },
      { template: '两个边长 {a} 厘米的正方形拼成一个长方形，周长 ____ 厘米。', formulas: ['a*6'], guard: () => true },
    ),
  },
  'u6f-i1': {
    L1: band(
      { a: R(27, 28) },
      { template: '正方形边长 {a} 厘米，围一圈要 ____ 厘米。', formulas: ['a*4'], guard: () => true },
    ),
    L3: band(
      { a: R(16, 40, 2), b: R(8, 22, 2, 'a') },
      {
        template: '两个长 {a} 厘米、宽 {b} 厘米的长方形沿长边拼，大长方形周长 ____ 厘米。',
        formulas: ['(a+b*2)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-i2': {
    L1: band(
      { a: R(20, 22) },
      {
        template: '一{cls}{item}长 {a} 厘米，合 ____ 毫米。',
        formulas: ['a*10'],
        unit: '毫米',
        sceneUnit: '厘米',
      },
    ),
    L3: band(
      { a: R(10, 30), c: R(2, 10) },
      {
        template: '正方形边长 {a} 厘米，边长增加 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a+c)*4'],
      },
    ),
  },
  'u6f-c1': {
    L1: band(
      { a: R(3, 4) },
      {
        template: '一{cls}{item}长 {a} 分米，合 ____ 厘米。',
        formulas: ['a*10'],
        unit: '厘米',
        sceneUnit: '厘米',
      },
    ),
    L3: band(
      { a: R(10, 30), c: R(2, 10) },
      {
        template: '正方形边长 {a} 厘米，边长增加 {c} 厘米，周长增加 ____ 厘米。',
        formulas: ['c*4'],
      },
    ),
  },
  'u6f-c2': {
    L1: band(
      { a: R(47, 48) },
      {
        template: '____ 厘米 = {a} 分米。',
        formulas: ['a*10'],
        unit: '厘米',
        sceneUnit: '厘米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(20, 50, 2), b: R(10, 26, 2, 'a'), c: R(2, 10) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，长增加 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a+c+b)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-c3': {
    L1: band(
      { a: R(30, 31) },
      { template: '边长 {a} 厘米的正方形，周长 ____ 厘米。', formulas: ['a*4'], guard: () => true },
    ),
    L3: band(
      { a: R(20, 50, 2), b: R(10, 26, 2, 'a'), c: R(2, 10) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，宽增加 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a+b+c)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-p1': {
    L1: band(
      { a: R(10, 36), b: R(4, 16, undefined, 'a') },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，周长是 ____ 厘米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 45,
      },
    ),
    L3: band(
      { a: R(16, 40, 2), b: R(8, 20, 2, 'a'), c: R(2, 8) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，长和宽都增加 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a+b+c*2)*2'],
      },
    ),
  },
  'u6f-p2': {
    L1: band(
      { a: R(33, 34) },
      { template: '正方形边长 {a} 厘米，四条边共 ____ 厘米。', formulas: ['a*4'] },
    ),
    L3: band(
      { a: R(30, 60, 2), b: R(10, 26, 2, 'a'), c: R(4, 14, 2) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，长减少 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a-c+b)*2'],
        guard: (p) => p.c <= p.a - 10 && p.a - p.c > p.b + 2,
      },
    ),
  },
  'u6f-p3': {
    L1: band(
      { a: R(40, 44) },
      {
        template: '{a} 厘米 = ____ 毫米。',
        formulas: ['a*10'],
        unit: '毫米',
        sceneUnit: '厘米',
      },
    ),
    L3: band(
      { a: R(24, 56, 2), b: R(12, 30, 2, 'a'), c: R(4, 12, 2) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，宽减少 {c} 厘米后，周长 ____ 厘米。',
        formulas: ['(a+b-c)*2'],
        guard: (p) => p.b > p.c + 2,
      },
    ),
  },
  'u6f-p4': {
    L1: band(
      { a: R(1, 2) },
      {
        template: '一{cls}{item}长 {a} 分米，合 ____ 毫米。',
        formulas: ['a*100'],
        unit: '毫米',
        sceneUnit: '厘米',
      },
    ),
    L3: band(
      { a: R(10, 30) },
      { template: '正方形边长 {a} 厘米，边长乘 2 后，周长 ____ 厘米。', formulas: ['a*8'] },
    ),
  },
  'u6f-m1': {
    L1: band(
      { a: R(12, 40, 2), b: R(5, 18, 2, 'a') },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，围一圈 ____ 厘米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 50,
      },
    ),
    L3: band(
      { b: R(8, 20) },
      {
        template: '宽 {b} 厘米的长方形正好剪成两个正方形，每个周长 ____ 厘米。',
        formulas: ['b*4'],
      },
    ),
  },
  'u6f-m2': {
    L1: band(
      { a: R(50, 52) },
      {
        template: '{a} 分米 = ____ 厘米。',
        formulas: ['a*10'],
        unit: '厘米',
        sceneUnit: '厘米',
      },
    ),
    L3: band(
      { a: R(10, 30) },
      { template: '正方形边长 {a} 厘米，围两圈花边共 ____ 厘米。', formulas: ['a*8'] },
    ),
  },
  'u6f-m3': {
    L1: band(
      { a: R(36, 37) },
      { template: '正方形边长 {a} 厘米，周长比边长多 ____ 厘米。', formulas: ['a*3'] },
    ),
    L3: band(
      { a: R(20, 50, 2), b: R(8, 24, 2) },
      {
        template: '长 {a} 厘米、宽 {b} 厘米的长方形，沿宽的中点剪成两个，每个周长 ____ 厘米。',
        formulas: ['(a+b/2)*2'],
        guard: (p) => p.b % 2 === 0 && p.b < p.a,
      },
    ),
  },

  // ================= 米组 L1 =================
  'u6f-d4': {
    L1: band(
      { a: R(4, 14, 2), b: R(2, 8, 2, 'a') },
      {
        template: '长方形长 {a} 米、宽 {b} 米，周长 ____ 米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 20,
      },
    ),
    L3: band(
      { a: R(8, 22, 2), b: R(4, 14, 2, 'a') },
      {
        template: '两个长 {a} 米、宽 {b} 米的长方形沿宽边拼，大长方形周长 ____ 米。',
        formulas: ['(a*2+b)*2'],
      },
    ),
  },
  'u6f-d5': {
    L1: band(
      { a: R(9, 10) },
      { template: '正方形边长 {a} 米，周长 ____ 米。', formulas: ['a*4'] },
    ),
    L3: band(
      { a: R(12, 32, 2), b: R(4, 14, 2, 'a') },
      {
        template: '一{cls}长 {a} 米、宽 {b} 米的长方形，沿长的中点剪成两个，每个周长 ____ 米。',
        formulas: ['(a/2+b)*2'],
        guard: (p) => p.a % 2 === 0,
      },
    ),
  },
  'u6f-d6': {
    L1: band(
      { a: R(4, 12, 2), b: R(2, 6, 2, 'a') },
      {
        template: '长方形长 {a} 米、宽 {b} 米，四条边共 ____ 米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 16,
      },
    ),
    L3: band(
      { a: R(5, 18) },
      { template: '两个边长 {a} 米的正方形拼成一个长方形，周长 ____ 米。', formulas: ['a*6'], guard: () => true },
    ),
  },
  'u6f-i3': {
    L1: band(
      { a: R(11, 12) },
      { template: '正方形边长 {a} 米，围一圈要 ____ 米。', formulas: ['a*4'], guard: () => true },
    ),
    L3: band(
      { a: R(8, 22, 2), b: R(4, 12, 2, 'a') },
      {
        template: '两个长 {a} 米、宽 {b} 米的长方形沿长边拼，大长方形周长 ____ 米。',
        formulas: ['(a+b*2)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-i4': {
    L1: band(
      { a: R(5, 6) },
      {
        template: '一{cls}{item}长 {a} 米，合 ____ 分米。',
        formulas: ['a*10'],
        unit: '分米',
        sceneUnit: '米',
      },
    ),
    L3: band(
      { a: R(5, 20), c: R(2, 8) },
      {
        template: '正方形边长 {a} 米，边长增加 {c} 米后，周长 ____ 米。',
        formulas: ['(a+c)*4'],
      },
    ),
  },
  'u6f-i5': {
    L1: band(
      { a: R(7, 8) },
      {
        template: '一{cls}{item}长 {a} 米，合 ____ 厘米。',
        formulas: ['a*100'],
        unit: '厘米',
        sceneUnit: '米',
      },
    ),
    L3: band(
      { a: R(5, 20), c: R(2, 8) },
      {
        template: '正方形边长 {a} 米，边长增加 {c} 米，周长增加 ____ 米。',
        formulas: ['c*4'],
      },
    ),
  },
  'u6f-c4': {
    L1: band(
      { a: R(38, 39) },
      {
        template: '____ 分米 = {a} 米。',
        formulas: ['a*10'],
        unit: '分米',
        sceneUnit: '米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(10, 30, 2), b: R(6, 18, 2, 'a'), c: R(2, 8) },
      {
        template: '长方形长 {a} 米、宽 {b} 米，长增加 {c} 米后，周长 ____ 米。',
        formulas: ['(a+c+b)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-c5': {
    L1: band(
      { a: R(45, 46) },
      {
        template: '____ 厘米 = {a} 米。',
        formulas: ['a*100'],
        unit: '厘米',
        sceneUnit: '米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(10, 30, 2), b: R(6, 18, 2, 'a'), c: R(2, 8) },
      {
        template: '长方形长 {a} 米、宽 {b} 米，宽增加 {c} 米后，周长 ____ 米。',
        formulas: ['(a+b+c)*2'],
        guard: () => true,
      },
    ),
  },
  'u6f-c6': {
    L1: band(
      { a: R(13, 14) },
      { template: '边长 {a} 米的正方形，周长 ____ 米。', formulas: ['a*4'] },
    ),
    L3: band(
      { a: R(10, 28, 2), b: R(6, 16, 2, 'a'), c: R(2, 6) },
      {
        template: '长方形长 {a} 米、宽 {b} 米，长和宽都增加 {c} 米后，周长 ____ 米。',
        formulas: ['(a+b+c*2)*2'],
      },
    ),
  },
  'u6f-p5': {
    L1: band(
      { a: R(6, 25, 2), b: R(3, 12, 2, 'a') },
      {
        template: '长方形长 {a} 米、宽 {b} 米，周长是 ____ 米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 32,
      },
    ),
    L3: band(
      { a: R(16, 40, 2), b: R(6, 18, 2, 'a'), c: R(2, 8) },
      {
        template: '长方形长 {a} 米、宽 {b} 米，长减少 {c} 米后，周长 ____ 米。',
        formulas: ['(a-c+b)*2'],
        guard: (p) => p.c <= p.a - 6 && p.a - p.c > p.b + 2,
      },
    ),
  },
  'u6f-p6': {
    L1: band(
      { a: R(15, 16) },
      { template: '正方形边长 {a} 米，四条边共 ____ 米。', formulas: ['a*4'] },
    ),
    L3: band(
      { a: R(14, 36, 2), b: R(8, 20, 2, 'a'), c: R(2, 8) },
      {
        template: '长方形长 {a} 米、宽 {b} 米，宽减少 {c} 米后，周长 ____ 米。',
        formulas: ['(a+b-c)*2'],
        guard: (p) => p.b > p.c + 2,
      },
    ),
  },
  'u6f-m4': {
    L1: band(
      { a: R(53, 54) },
      {
        template: '{a} 米 = ____ 分米。',
        formulas: ['a*10'],
        unit: '分米',
        sceneUnit: '米',
      },
    ),
    L3: band(
      { a: R(5, 20) },
      { template: '正方形边长 {a} 米，边长乘 2 后，周长 ____ 米。', formulas: ['a*8'] },
    ),
  },
  'u6f-m5': {
    L1: band(
      { a: R(55, 56) },
      {
        template: '{a} 米 = ____ 厘米。',
        formulas: ['a*100'],
        unit: '厘米',
        sceneUnit: '米',
      },
    ),
    L3: band(
      { b: R(4, 12) },
      {
        template: '宽 {b} 米的长方形正好剪成两个正方形，每个周长 ____ 米。',
        formulas: ['b*4'],
      },
    ),
  },
  'u6f-m6': {
    L1: band(
      { a: R(8, 30, 2), b: R(3, 14, 2, 'a') },
      {
        template: '长方形长 {a} 米、宽 {b} 米，围一圈 ____ 米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.a + p.b <= 42,
      },
    ),
    L3: band(
      { a: R(5, 20) },
      { template: '正方形边长 {a} 米，围两圈花边共 ____ 米。', formulas: ['a*8'] },
    ),
  },
  'u6f-m7': {
    L1: band(
      { a: R(17, 18) },
      { template: '正方形边长 {a} 米，周长比边长多 ____ 米。', formulas: ['a*3'] },
    ),
    L3: band(
      { a: R(12, 36, 2), b: R(4, 14, 2) },
      {
        template: '长 {a} 米、宽 {b} 米的长方形，沿宽的中点剪成两个，每个周长 ____ 米。',
        formulas: ['(a+b/2)*2'],
        guard: (p) => p.b % 2 === 0 && p.b < p.a,
      },
    ),
  },
}
