/**
 * 【已拆解】U8 已并入 U6/U3/U4/U2；本文件仅作 u8-variants.ts 的数据源，不再注册为骨架包。
 * 3A-U8 数学广场 · 填空 · 三档
 * 基线（L2）在 u8-math-plaza-fill.ts；本文件补 L1（单点辨认/直接求）与 L3（最值/判断）。
 * 尺寸沿用周长包 guard：宽 < 长；篱笆题一律同一单位（米），不混厘米。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U8_MATH_PLAZA_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u8f-d1': {
    L1: band(
      { a: R(6, 12, 2), b: R(3, 6) },
      {
        template: '一块长方形菜地四周围篱笆，长 {a} 米、宽 {b} 米，共 ____ 米。',
        formulas: ['(a+b)*2'],
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(18, 28, 2), b: R(4, 9) },
      {
        template: '长边靠墙，用 {a} 米篱笆围长方形，长 {b} 米，宽 ____ 米。',
        formulas: ['(a-b)/2'],
        guard: (p) => p.a > p.b + 2 && (p.a - p.b) % 2 === 0 && p.a < 3 * p.b,
      },
    ),
  },
  'u8f-d2': {
    L1: band(
      { a: R(4, 9), b: R(10, 16) },
      {
        template: '一块正方形菜地边长 {a} 米，围一圈 ____ 米；边长 {b} 米，围一圈 ____ 米。',
        formulas: ['4*a', '4*b'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(16, 26, 2), b: R(5, 9) },
      {
        template: '宽边靠墙，用 {a} 米篱笆围长方形，宽 {b} 米，长 ____ 米。',
        formulas: ['(a-b)/2'],
        guard: (p) => p.a > p.b + 2 && (p.a - p.b) % 2 === 0 && p.a > 3 * p.b,
      },
    ),
  },
  'u8f-d3': {
    L1: band(
      { a: R(6, 12, 2), b: R(3, 6) },
      {
        template: '一块长方形菜地长 {a} 米、宽 {b} 米，少一条长边不围，其余三边共 ____ 米。',
        formulas: ['a+2*b'],
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(20, 30, 2), b: R(6, 11), c: R(4, 8) },
      {
        template: '四周留门，用 {a} 米篱笆围长 {b} 米、宽 {c} 米的长方形，门宽 ____ 米。',
        formulas: ['(b+c)*2-a'],
        guard: (p) => p.c < p.b && (p.b + p.c) * 2 > p.a,
      },
    ),
  },
  'u8f-d4': {
    L1: band(
      { a: R(2, 5), b: R(6, 10) },
      {
        template: '一副七巧板 7 块，{a} 副共 ____ 块；{b} 副共 ____ 块。',
        formulas: ['7*a', '7*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(2, 4) },
      {
        template: '一副七巧板有 5 块三角形，{a} 副最多拼 ____ 个正方形（每 2 块 1 个），还剩 ____ 块。',
        formulas: ['quotientOf(5*a,2)', 'remainderOf(5*a,2)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => (5 * p.a) % 2 !== 0,
      },
    ),
  },
  'u8f-d5': {
    L1: band(
      { a: R(2, 5), b: R(6, 10) },
      {
        template: '一副七巧板 5 块三角形，{a} 副共 ____ 块；{b} 副共 ____ 块。',
        formulas: ['5*a', '5*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(5, 7) },
      {
        template: '每副七巧板有 5 块三角形，{a} 副最多拼 ____ 个梯形（每 3 块 1 个），还剩 ____ 块。',
        formulas: ['quotientOf(5*a,3)', 'remainderOf(5*a,3)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => (5 * p.a) % 3 !== 0,
      },
    ),
  },
  'u8f-d6': {
    L1: band(
      { a: R(2, 6), b: R(7, 11) },
      {
        template: '摆 1 个正方形要 4 根，摆 {a} 个要 ____ 根；摆 {b} 个要 ____ 根。',
        formulas: ['4*a', '4*b'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(14, 30), b: R(34, 44) },
      {
        template: '用 {a} 根按 4、7、10… 最多摆 ____ 个正方形，{b} 根最多摆 ____ 个。',
        formulas: ['quotientOf(a-1,3)', 'quotientOf(b-1,3)'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: (p) => p.a > 3 && p.b > 3,
      },
    ),
  },

  // ---------- 逆向求 ----------
  'u8f-i1': {
    L1: band(
      { a: R(10, 20, 2), b: R(3, 6) },
      {
        template: '长边靠墙围篱笆共 {a} 米，宽 {b} 米，两条宽边共 ____ 米。',
        formulas: ['2*b'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b,
      },
    ),
    L3: band(
      { a: R(18, 28, 2), b: R(5, 10) },
      {
        template: '长边靠墙，篱笆共 {a} 米，长 {b} 米，宽 ____ 米。',
        formulas: ['(a-b)/2'],
        guard: (p) => p.a > p.b + 2 && (p.a - p.b) % 2 === 0 && p.a < 3 * p.b,
      },
    ),
  },
  'u8f-i2': {
    L1: band(
      { a: R(16, 30, 2), b: R(4, 10) },
      {
        template: '四周围篱笆共 {a} 米，长 {b} 米，两条长边共 ____ 米。',
        formulas: ['2*b'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b,
      },
    ),
    L3: band(
      { a: R(24, 34, 2), b: R(6, 10), c: R(4, 7) },
      {
        template: '四周围篱笆留门共 {a} 米，长 {b} 米、宽 {c} 米，门宽 ____ 米。',
        formulas: ['(b+c)*2-a'],
        guard: (p) => p.c < p.b && (p.b + p.c) * 2 > p.a,
      },
    ),
  },
  'u8f-i3': {
    L1: band(
      { a: R(4, 12, 2), b: R(14, 20, 2) },
      {
        template: '每 2 块小三角形拼 1 个正方形，{a} 块拼 ____ 个；{b} 块拼 ____ 个。',
        formulas: ['a/2', 'b/2'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(9, 12) },
      {
        template: '每 2 块小三角形拼 1 个正方形，{a} 块最多拼 ____ 个，还剩 ____ 块。',
        formulas: ['quotientOf(a,2)', 'remainderOf(a,2)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => p.a % 2 !== 0,
      },
    ),
  },
  'u8f-i4': {
    L1: band(
      { a: R(9, 15, 3), b: R(18, 24, 3) },
      {
        template: '{a} 块小三角形每 3 块拼 1 个梯形，能拼 ____ 个；{b} 块能拼 ____ 个。',
        formulas: ['a/3', 'b/3'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(13, 16) },
      {
        template: '{a} 块小三角形每 3 块拼 1 个梯形，最多拼 ____ 个，剩 ____ 块。',
        formulas: ['quotientOf(a,3)', 'remainderOf(a,3)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => p.a % 3 !== 0,
      },
    ),
  },
  'u8f-i5': {
    L1: band(
      { a: R(4, 22), b: R(25, 40) },
      {
        template: '照 4、7、10… 摆正方形，{a} 根摆了 ____ 个；{b} 根摆了 ____ 个。',
        formulas: ['(a-1)/3', '(b-1)/3'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: (p) => (p.a - 1) % 3 === 0 && (p.b - 1) % 3 === 0,
      },
    ),
    L3: band(
      { a: R(14, 30), b: R(34, 48) },
      {
        template: '用 {a} 根小棒最多摆 ____ 个正方形，用 {b} 根最多摆 ____ 个（4、7、10…）。',
        formulas: ['quotientOf(a-1,3)', 'quotientOf(b-1,3)'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: (p) => p.a > 3 && p.b > 3,
      },
    ),
  },
  'u8f-i6': {
    L1: band(
      { a: R(10, 20, 2), b: R(4, 8) },
      {
        template: '长边靠墙围篱笆共 {a} 米，长 {b} 米，两条宽边共 ____ 米。',
        formulas: ['a-b'],
        unit: '米',
        guard: (p) => p.a > p.b && p.a < 3 * p.b,
      },
    ),
    L3: band(
      { a: R(12, 18, 2), b: R(4, 7) },
      {
        template: '一块长方形菜地长 {a} 米、宽 {b} 米，长边靠墙，至少用 ____ 米篱笆。',
        formulas: ['a+2*b'],
        guard: (p) => p.b < p.a,
      },
    ),
  },

  // ---------- 比较与最值 ----------
  'u8f-c1': {
    L1: band(
      { a: R(4, 9), b: R(10, 16) },
      {
        template: '边长 {a} 米的正方形围一圈 ____ 米；边长 {b} 米，围一圈 ____ 米。',
        formulas: ['4*a', '4*b'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(16, 32, 4), b: R(36, 52, 4) },
      {
        template: '用 {a} 米篱笆围长方形，长最大 ____ 米；用 {b} 米，长最大 ____ 米。',
        formulas: ['a/2-1', 'b/2-1'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
  },
  'u8f-c2': {
    L1: band(
      { a: R(20, 36, 2), b: R(4, 10, 2) },
      {
        template: '用 {a} 米篱笆围长方形，长 {b} 米，宽 ____ 米。',
        formulas: ['a/2-b'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b + 2 && p.a < 4 * p.b,
      },
    ),
    L3: band(
      { a: R(16, 32, 4), b: R(36, 52, 4) },
      {
        template: '用 {a} 米篱笆围长方形，宽最大 ____ 米；用 {b} 米，宽最大 ____ 米。',
        formulas: ['quotientOf(a/2-1,2)', 'quotientOf(b/2-1,2)'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
  },
  'u8f-c3': {
    L1: band(
      { a: R(6, 14, 2), b: R(15, 21, 2) },
      {
        template: '{a} 米和 {b} 米的篱笆各围一个正方形，边长相差 ____ 米。',
        formulas: ['(b-a)/4'],
        unit: '米',
        guard: (p) => p.b > p.a && (p.b - p.a) % 4 === 0,
      },
    ),
    L3: band(
      { a: R(18, 33), b: R(34, 48) },
      {
        template: '长边靠墙，{a} 米篱笆围出的宽最大 ____ 米；{b} 米围出的宽最大 ____ 米。',
        formulas: ['quotientOf(a-1,3)', 'quotientOf(b-1,3)'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
  },
  'u8f-c4': {
    L1: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '一块长方形菜地长 {a} 米、宽 {b} 米，长边靠墙围篱笆要 ____ 米。',
        formulas: ['a+2*b'],
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '一块长方形菜地长 {a} 米、宽 {b} 米，改围正方形，边长比原来的宽多 ____ 米。',
        formulas: ['(a+b)/2-b'],
        guard: (p) => (p.a + p.b) % 2 === 0,
      },
    ),
  },
  'u8f-c5': {
    L1: band(
      { a: R(20, 32, 4), b: R(36, 48, 4) },
      {
        template: '用 {a} 米篱笆正好围正方形，边长 ____ 米；用 {b} 米，边长 ____ 米。',
        formulas: ['a/4', 'b/4'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(8, 14, 2), b: R(5, 9, 1) },
      {
        template: '同样长的篱笆围正方形和长方形，长方形长 {a} 米、宽 {b} 米，正方形边长 ____ 米。',
        formulas: ['(a+b)/2'],
        unit: '米',
        guard: (p) => p.b < p.a && (p.a + p.b) % 2 === 0,
      },
    ),
  },
  'u8f-c6': {
    L1: band(
      { a: R(20, 36, 4), b: R(4, 10, 2) },
      {
        template: '{person}用 {a} 米篱笆围长方形，长 {b} 米，宽 ____ 米。',
        formulas: ['a/2-b'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b + 2 && p.a < 4 * p.b,
      },
    ),
    L3: band(
      { a: R(20, 36, 4), d: R(2, 8, 2) },
      {
        template: '用 {a} 米篱笆围长方形，长比宽多 {d} 米，宽 ____ 米，长 ____ 米。',
        formulas: ['(a/2-d)/2', '(a/2-d)/2+d'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: (p) => p.a / 2 > p.d && (p.a / 2 - p.d) % 2 === 0,
      },
    ),
  },

  // ---------- 组合与拆分 ----------
  'u8f-p1': {
    L1: band(
      { a: R(2, 6), b: R(7, 12) },
      {
        template: '一副七巧板有 1 块正方形和 1 块平行四边形，{a} 副共 ____ 块；{b} 副共 ____ 块。',
        formulas: ['2*a', '2*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(2, 6) },
      {
        template: '一副七巧板 7 块，{a} 副共 ____ 块，其中三角形 ____ 块。',
        formulas: ['7*a', '5*a'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
  },
  'u8f-p2': {
    L1: band(
      { a: R(2, 6), b: R(7, 12) },
      {
        template: '每副七巧板三角形比正方形多 4 块，{a} 副多 ____ 块；{b} 副多 ____ 块。',
        formulas: ['4*a', '4*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(2, 6), b: R(7, 12) },
      {
        template: '每副七巧板三角形比正方形多 4 块，{a} 副多 ____ 块；{b} 副多 ____ 块。',
        formulas: ['4*a', '4*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
  },
  'u8f-p3': {
    L1: band(
      { a: R(3, 9), b: R(10, 16) },
      {
        template: '2 块小三角形拼 1 个正方形，拼 {a} 个用 ____ 块；拼 {b} 个用 ____ 块。',
        formulas: ['2*a', '2*b'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(17, 20) },
      {
        template: '2 块小三角形拼 1 个正方形，{a} 块最多拼 ____ 个，还剩 ____ 块。',
        formulas: ['quotientOf(a,2)', 'remainderOf(a,2)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => p.a % 2 !== 0,
      },
    ),
  },
  'u8f-p4': {
    L1: band(
      { a: R(9, 24, 3), b: R(27, 36, 3) },
      {
        template: '{a} 块小三角形每 3 块放一起，能放 ____ 组；{b} 块放 ____ 组。',
        formulas: ['a/3', 'b/3'],
        unit: '',
        answerUnits: ['组', '组'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(21, 24) },
      {
        template: '把 {a} 块小三角形每 3 块拼成梯形，最多拼 ____ 个，剩 ____ 块。',
        formulas: ['quotientOf(a,3)', 'remainderOf(a,3)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => p.a % 3 !== 0,
      },
    ),
  },
  'u8f-p5': {
    L1: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '一块长方形菜地相邻两边靠墙，长 {a} 米、宽 {b} 米，只围另外两边要 ____ 米。',
        formulas: ['a+2*b'],
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '两块长方形菜地各相邻两边靠墙，各长 {a} 米、宽 {b} 米，两处篱笆共 ____ 米。',
        formulas: ['2*(a+b)'],
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u8f-p6': {
    L1: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '一块长方形菜地相邻两边靠墙，其余两边长 {a} 米、{b} 米，篱笆长 ____ 米。',
        formulas: ['a+b'],
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(16, 32, 8), b: R(40, 56, 8) },
      {
        template: '用 {a} 米篱笆给两个同样的正方形菜地各围一圈，边长 ____ 米；用 {b} 米，边长 ____ 米。',
        formulas: ['a/8', 'b/8'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: () => true,
      },
    ),
  },

  // ---------- 找规律 ----------
  'u8f-m1': {
    L1: band(
      { a: R(2, 6), b: R(7, 11) },
      {
        template: '摆 1 个正方形要 4 根，每多 1 个多 3 根，摆 {a} 个 ____ 根；摆 {b} 个 ____ 根。',
        formulas: ['3*a+1', '3*b+1'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(25, 28) },
      {
        template: '用 {a} 根小棒按 4、7、10… 摆正方形，最多摆 ____ 个，还剩 ____ 根。',
        formulas: ['quotientOf(a-1,3)', 'remainderOf(a-1,3)'],
        unit: '',
        answerUnits: ['个', '根'],
        guard: (p) => p.a > 3 && (p.a - 1) % 3 !== 0,
      },
    ),
  },
  'u8f-m2': {
    L1: band(
      { a: R(2, 6), b: R(7, 12) },
      {
        template: '摆 1 个三角形要 3 根，每多 1 个多 2 根，摆 {a} 个 ____ 根；摆 {b} 个 ____ 根。',
        formulas: ['2*a+1', '2*b+1'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(29, 32) },
      {
        template: '用 {a} 根小棒按 3、5、7… 摆三角形，最多摆 ____ 个，还剩 ____ 根。',
        formulas: ['quotientOf(a-1,2)', 'remainderOf(a-1,2)'],
        unit: '',
        answerUnits: ['个', '根'],
        guard: (p) => p.a > 1 && (p.a - 1) % 2 !== 0,
      },
    ),
  },
  'u8f-m3': {
    L1: band(
      { a: R(2, 5), b: R(6, 9) },
      {
        template: '摆 1 个六边形要 6 根，摆 {a} 个 ____ 根；摆 {b} 个 ____ 根。',
        formulas: ['6*a', '6*b'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(8, 14), b: R(2, 6) },
      {
        template: '摆正方形，摆 {a} 个和摆 {b} 个相差 ____ 根。',
        formulas: ['3*(a-b)'],
        unit: '',
        answerUnits: ['根'],
        guard: (p) => p.a > p.b,
      },
    ),
  },
  'u8f-m4': {
    L1: band(
      { a: R(8, 12), b: R(13, 20) },
      {
        template: '照 4、7、10… 第 {a} 个是 ____ 根；第 {b} 个是 ____ 根。',
        formulas: ['3*a+1', '3*b+1'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(2, 6), b: R(2, 6) },
      {
        template: '摆 {a} 个正方形和 {b} 个三角形连排，一共用 ____ 根小棒。',
        formulas: ['3*a+2*b+2'],
        unit: '',
        answerUnits: ['根'],
        guard: () => true,
      },
    ),
  },
  'u8f-m5': {
    L1: band(
      { a: R(8, 14), b: R(15, 22) },
      {
        template: '摆三角形按 3、5、7… 排，第 {a} 个是 ____ 根；第 {b} 个是 ____ 根。',
        formulas: ['2*a+1', '2*b+1'],
        unit: '',
        answerUnits: ['根', '根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(8, 14), b: R(2, 6) },
      {
        template: '摆三角形，摆 {a} 个和摆 {b} 个相差 ____ 根。',
        formulas: ['2*(a-b)'],
        unit: '',
        answerUnits: ['根'],
        guard: (p) => p.a > p.b,
      },
    ),
  },
  'u8f-m6': {
    L1: band(
      { a: R(2, 6), b: R(2, 6) },
      {
        template: '{a} 个正方形和 {b} 个三角形连排，共 ____ 根。',
        formulas: ['3*a+2*b+2'],
        unit: '',
        answerUnits: ['根'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(6, 11), b: R(16, 26) },
      {
        template: '用 {a} 根小棒最多摆 ____ 个六边形，用 {b} 根最多摆 ____ 个（6、11、16…）。',
        formulas: ['quotientOf(a-1,5)', 'quotientOf(b-1,5)'],
        unit: '',
        answerUnits: ['个', '个'],
        guard: (p) => p.a > 5 && p.b > 5 && (p.a - 1) % 5 !== 0 && (p.b - 1) % 5 !== 0,
      },
    ),
  },
}
