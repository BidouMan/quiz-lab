/**
 * 3A-U6 周长 · 填空 · L2
 * 6 个做法中的 5 类 × 15 条句式 × 厘米/米两组 = 30 条骨架。
 * 场景池沿用 PERIMETER_SCENES（15 张厘米 + 15 张米），尺寸 guard 沿用应用题包：
 * 长 > 宽、边长区间不放开，避免填空出现「宽比长大」的荒谬尺寸。
 *
 * 三档结构不同，题干由各档 template 覆盖：
 * - L1 长度单位换算与基础周长（小数域，米/分米/厘米单口径，不混算）；
 * - L2 长方形/正方形周长（含反求边长，本文件为基线）；
 * - L3 组合图形或边长变化。
 * 单空题 unit 写进答案；空位后的单位与答案同口径。
 */
import type { Skeleton } from './types.ts'

export const U6_PERIMETER_FILL_SKELETONS: Skeleton[] = [
  // ================= 厘米组（15） =================
  // ---------- 直接求 ----------
  {
    id: 'u6f-d1',
    practice: 'direct',
    template: '一{cls}{item}长 {a} 厘米、宽 {b} 厘米，周长是 ____ 厘米。',
    asks: [],
    formulas: ['(a+b)*2'],
    unit: '厘米',
    slots: { a: { min: 20, max: 60, step: 2 }, b: { min: 10, max: 38, step: 2, lt: 'a' } },
  },
  {
    id: 'u6f-d2',
    practice: 'direct',
    template: '{person}有一{cls}正方形{item}，边长 {a} 厘米，周长 ____ 厘米。',
    asks: [],
    formulas: ['a*4'],
    unit: '厘米',
    slots: { a: { min: 12, max: 45 } },
  },
  {
    id: 'u6f-d3',
    practice: 'direct',
    template: '一{cls}长方形{item}长 {a} 厘米，宽比长少 {c} 厘米，周长 ____ 厘米。',
    asks: [],
    formulas: ['(a+a-c)*2'],
    unit: '厘米',
    slots: { a: { min: 24, max: 58, step: 2 }, c: { min: 4, max: 12, step: 2 } },
    guard: (p) => p.c <= p.a - 10,
  },

  // ---------- 逆向求 ----------
  {
    id: 'u6f-i1',
    practice: 'inverse',
    template: '一{cls}长方形{item}的周长是 {p} 厘米，长 {a} 厘米，宽 ____ 厘米。',
    asks: [],
    formulas: ['(p-a*2)/2'],
    unit: '厘米',
    slots: { p: { min: 60, max: 160, step: 2 }, a: { min: 14, max: 40, step: 2 } },
    guard: (p) => p.p > p.a * 2 + 20 && p.p < p.a * 4 && (p.p - p.a * 2) % 2 === 0,
  },
  {
    id: 'u6f-i2',
    practice: 'inverse',
    template: '一{cls}正方形{item}的周长是 {p} 厘米，边长 ____ 厘米。',
    asks: [],
    formulas: ['p/4'],
    unit: '厘米',
    slots: { p: { min: 24, max: 120, step: 4 } },
  },

  // ---------- 比较与最值 ----------
  {
    id: 'u6f-c1',
    practice: 'compare',
    template: '一根 {p} 厘米长的铁丝正好围成一个正方形，边长 ____ 厘米。',
    asks: [],
    formulas: ['p/4'],
    unit: '厘米',
    slots: { p: { min: 24, max: 120, step: 4 } },
  },
  {
    id: 'u6f-c2',
    practice: 'compare',
    template: '一根 {p} 厘米长的绳子正好围成一个长方形，宽 {b} 厘米，长 ____ 厘米。',
    asks: [],
    formulas: ['(p-b*2)/2'],
    unit: '厘米',
    slots: { p: { min: 36, max: 96, step: 2 }, b: { min: 8, max: 22, step: 2 } },
    guard: (p) => p.p > p.b * 4 && (p.p - p.b * 2) % 2 === 0,
  },
  {
    id: 'u6f-c3',
    practice: 'compare',
    template: '甲长方形 {a}×{b} 厘米，乙长方形 {c}×{d} 厘米，甲周长比乙长 ____ 厘米。',
    asks: [],
    formulas: ['(a+b)*2-(c+d)*2'],
    unit: '厘米',
    slots: {
      a: { min: 24, max: 60, step: 2 },
      b: { min: 10, max: 30, step: 2, lt: 'a' },
      c: { min: 16, max: 40, step: 2 },
      d: { min: 8, max: 24, step: 2, lt: 'c' },
    },
    guard: (p) => (p.a + p.b) * 2 > (p.c + p.d) * 2,
  },

  // ---------- 组合与拆分 ----------
  {
    id: 'u6f-p1',
    practice: 'compose',
    template: '一{cls}长方形{item}相邻两边和是 {s} 厘米，周长 ____ 厘米。',
    asks: [],
    formulas: ['s*2'],
    unit: '厘米',
    slots: { s: { min: 10, max: 60, step: 2 } },
  },
  {
    id: 'u6f-p2',
    practice: 'compose',
    template: '一{cls}长方形{item}长 {a} 厘米、宽 {b} 厘米，周长比长多 ____ 厘米。',
    asks: [],
    formulas: ['(a+b)*2-a'],
    unit: '厘米',
    slots: { a: { min: 20, max: 50, step: 2 }, b: { min: 10, max: 28, step: 2, lt: 'a' } },
  },
  {
    id: 'u6f-p3',
    practice: 'compose',
    template: '一{cls}长方形{item}长 {a} 厘米、宽 {b} 厘米，周长比宽多 ____ 厘米。',
    asks: [],
    formulas: ['(a+b)*2-b'],
    unit: '厘米',
    slots: { a: { min: 20, max: 50, step: 2 }, b: { min: 10, max: 26, step: 2, lt: 'a' } },
  },
  {
    id: 'u6f-p4',
    practice: 'compose',
    template: '一{cls}长方形{item}宽 {b} 厘米，长比宽多 {c} 厘米，周长 ____ 厘米。',
    asks: [],
    formulas: ['(b+c+b)*2'],
    unit: '厘米',
    slots: { b: { min: 10, max: 30, step: 2 }, c: { min: 4, max: 14, step: 2 } },
  },

  // ---------- 多步合成 ----------
  {
    id: 'u6f-m1',
    practice: 'multistep',
    template: '一{cls}正方形{item}边长 {a} 厘米，周长比边长多 ____ 厘米。',
    asks: [],
    formulas: ['a*4-a'],
    unit: '厘米',
    slots: { a: { min: 12, max: 45 } },
  },
  {
    id: 'u6f-m2',
    practice: 'multistep',
    template: '两个正方形边长分别是 {a} 厘米 和 {b} 厘米，周长共 ____ 厘米。',
    asks: [],
    formulas: ['a*4+b*4'],
    unit: '厘米',
    slots: { a: { min: 10, max: 30 }, b: { min: 10, max: 30 } },
    guard: (p) => p.a !== p.b,
  },
  {
    id: 'u6f-m3',
    practice: 'multistep',
    template: '一{cls}长方形{item}长 {a} 厘米、宽 {b} 厘米，周长的一半是 ____ 厘米。',
    asks: [],
    formulas: ['a+b'],
    unit: '厘米',
    slots: { a: { min: 20, max: 50, step: 2 }, b: { min: 10, max: 26, step: 2, lt: 'a' } },
  },

  // ================= 米组（15） =================
  // ---------- 直接求 ----------
  {
    id: 'u6f-d4',
    practice: 'direct',
    template: '一{cls}{item}长 {a} 米、宽 {b} 米，周长是 ____ 米。',
    asks: [],
    formulas: ['(a+b)*2'],
    unit: '米',
    slots: { a: { min: 8, max: 30, step: 2 }, b: { min: 4, max: 18, step: 2, lt: 'a' } },
  },
  {
    id: 'u6f-d5',
    practice: 'direct',
    template: '{person}有一{cls}正方形{item}，边长 {a} 米，周长 ____ 米。',
    asks: [],
    formulas: ['a*4'],
    unit: '米',
    slots: { a: { min: 5, max: 20 } },
  },
  {
    id: 'u6f-d6',
    practice: 'direct',
    template: '一{cls}长方形{item}长 {a} 米，宽比长少 {c} 米，周长 ____ 米。',
    asks: [],
    formulas: ['(a+a-c)*2'],
    unit: '米',
    slots: { a: { min: 10, max: 28, step: 2 }, c: { min: 2, max: 8, step: 2 } },
    guard: (p) => p.c <= p.a - 4,
  },

  // ---------- 逆向求 ----------
  {
    id: 'u6f-i3',
    practice: 'inverse',
    template: '一{cls}长方形{item}的周长是 {p} 米，长 {a} 米，宽 ____ 米。',
    asks: [],
    formulas: ['(p-a*2)/2'],
    unit: '米',
    slots: { p: { min: 30, max: 100, step: 2 }, a: { min: 8, max: 24, step: 2 } },
    guard: (p) => p.p > p.a * 2 + 8 && p.p < p.a * 4 && (p.p - p.a * 2) % 2 === 0,
  },
  {
    id: 'u6f-i4',
    practice: 'inverse',
    template: '一{cls}正方形{item}的周长是 {p} 米，边长 ____ 米。',
    asks: [],
    formulas: ['p/4'],
    unit: '米',
    slots: { p: { min: 16, max: 80, step: 4 } },
  },
  {
    id: 'u6f-i5',
    practice: 'inverse',
    template: '一根 {p} 米长的铁丝正好围成一个正方形，边长 ____ 米。',
    asks: [],
    formulas: ['p/4'],
    unit: '米',
    slots: { p: { min: 16, max: 80, step: 4 } },
  },

  // ---------- 比较与最值 ----------
  {
    id: 'u6f-c4',
    practice: 'compare',
    template: '一根 {p} 米长的绳子正好围成一个长方形，宽 {b} 米，长 ____ 米。',
    asks: [],
    formulas: ['(p-b*2)/2'],
    unit: '米',
    slots: { p: { min: 24, max: 80, step: 2 }, b: { min: 4, max: 14, step: 2 } },
    guard: (p) => p.p > p.b * 4 && (p.p - p.b * 2) % 2 === 0,
  },
  {
    id: 'u6f-c5',
    practice: 'compare',
    template: '甲长方形 {a}×{b} 米，乙长方形 {c}×{d} 米，甲周长比乙长 ____ 米。',
    asks: [],
    formulas: ['(a+b)*2-(c+d)*2'],
    unit: '米',
    slots: {
      a: { min: 10, max: 28, step: 2 },
      b: { min: 6, max: 18, step: 2, lt: 'a' },
      c: { min: 8, max: 22, step: 2 },
      d: { min: 4, max: 14, step: 2, lt: 'c' },
    },
    guard: (p) => (p.a + p.b) * 2 > (p.c + p.d) * 2,
  },
  {
    id: 'u6f-c6',
    practice: 'compare',
    template: '一{cls}长方形{item}相邻两边和是 {s} 米，周长 ____ 米。',
    asks: [],
    formulas: ['s*2'],
    unit: '米',
    slots: { s: { min: 6, max: 40, step: 2 } },
  },

  // ---------- 组合与拆分 ----------
  {
    id: 'u6f-p5',
    practice: 'compose',
    template: '一{cls}长方形{item}长 {a} 米、宽 {b} 米，周长比长多 ____ 米。',
    asks: [],
    formulas: ['(a+b)*2-a'],
    unit: '米',
    slots: { a: { min: 8, max: 24, step: 2 }, b: { min: 4, max: 14, step: 2, lt: 'a' } },
  },
  {
    id: 'u6f-p6',
    practice: 'compose',
    template: '一{cls}长方形{item}长 {a} 米、宽 {b} 米，周长比宽多 ____ 米。',
    asks: [],
    formulas: ['(a+b)*2-b'],
    unit: '米',
    slots: { a: { min: 8, max: 24, step: 2 }, b: { min: 4, max: 14, step: 2, lt: 'a' } },
  },

  // ---------- 多步合成 ----------
  {
    id: 'u6f-m4',
    practice: 'multistep',
    template: '一{cls}长方形{item}宽 {b} 米，长比宽多 {c} 米，周长 ____ 米。',
    asks: [],
    formulas: ['(b+c+b)*2'],
    unit: '米',
    slots: { b: { min: 4, max: 14, step: 2 }, c: { min: 2, max: 8, step: 2 } },
  },
  {
    id: 'u6f-m5',
    practice: 'multistep',
    template: '一{cls}正方形{item}边长 {a} 米，周长比边长多 ____ 米。',
    asks: [],
    formulas: ['a*4-a'],
    unit: '米',
    slots: { a: { min: 5, max: 20 } },
  },
  {
    id: 'u6f-m6',
    practice: 'multistep',
    template: '两个正方形边长分别是 {a} 米 和 {b} 米，周长共 ____ 米。',
    asks: [],
    formulas: ['a*4+b*4'],
    unit: '米',
    slots: { a: { min: 5, max: 20 }, b: { min: 5, max: 20 } },
    guard: (p) => p.a !== p.b,
  },
  {
    id: 'u6f-m7',
    practice: 'multistep',
    template: '一{cls}长方形{item}长 {a} 米、宽 {b} 米，周长的一半是 ____ 米。',
    asks: [],
    formulas: ['a+b'],
    unit: '米',
    slots: { a: { min: 8, max: 24, step: 2 }, b: { min: 4, max: 14, step: 2, lt: 'a' } },
  },
]
