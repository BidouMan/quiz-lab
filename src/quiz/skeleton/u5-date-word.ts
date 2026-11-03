/**
 * 3A-U5 年、月、日 · 应用题 · L2（经过时间两步）
 * 5 个做法 × 6 条句式 = 30 条骨架；L1 单步时刻计算、L3 跨课间/提前/反求在 bands 里覆盖。
 *
 * 口径：
 * - 一律用 24 时记时法；只有“下午几时”换算题显式标注下午，不与 24 时制混写。
 * - 不跨零点：所有时刻落在 8:00–18:00。
 * - 出发时刻用“最迟”，提前量用“至少”。
 * - 每问都写明所求（几时几分 / 经过多少分钟 / 多少小时）。
 */
import type { Skeleton } from './types.ts'
import { elapsedMinutes } from './expr.ts'

const at = (h: number, m: number): number => h * 60 + m

export const U5_DATE_WORD_SKELETONS: Skeleton[] = [
  // ---------- 直接求 ----------
  {
    id: 'u5w-d1',
    practice: 'direct',
    template: '{item}从 {h1} 时 {m1} 分到 {h2} 时 {m2} 分，中间休息 {r} 分钟。',
    asks: ['实际进行了多少分钟？'],
    formulas: ['elapsedMinutes(h1,m1,h2,m2)-r'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 15 },
      m1: { min: 0, max: 55, step: 5 },
      h2: { min: 9, max: 17, gt: 'h1' },
      m2: { min: 0, max: 55, step: 5 },
      r: { min: 10, max: 30, step: 5 },
    },
    guard: (p) => {
      const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
      return total >= 40 && total <= 170 && total - p.r >= 20
    },
  },
  {
    id: 'u5w-d2',
    practice: 'direct',
    template: '{person}在{place}，从 {h1} 时 {m1} 分到 {h2} 时 {m2} 分。',
    asks: ['活动持续多少分钟？'],
    formulas: ['elapsedMinutes(h1,m1,h2,m2)'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 15 },
      m1: { min: 0, max: 55, step: 5 },
      h2: { min: 9, max: 17, gt: 'h1' },
      m2: { min: 0, max: 55, step: 5 },
    },
    guard: (p) => {
      const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
      return total >= 30 && total <= 150
    },
  },
  {
    id: 'u5w-d3',
    practice: 'direct',
    template: '{item}下午 {h} 时 {m} 分开始。',
    asks: ['用 24 时记时法表示是几时几分？'],
    formulas: ['h+12', 'm'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: { h: { min: 2, max: 6 }, m: { min: 5, max: 55, step: 5 } },
  },
  {
    id: 'u5w-d4',
    practice: 'direct',
    template: '{item}从 {h1} 时 {m1} 分到 {h2} 时。',
    asks: ['{item}一共进行了多少分钟？'],
    formulas: ['elapsedMinutes(h1,m1,h2,0)'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 14 },
      m1: { min: 5, max: 55, step: 5 },
      h2: { min: 10, max: 17, gt: 'h1' },
    },
  },
  {
    id: 'u5w-d5',
    practice: 'direct',
    template: '{item}一共用了 {n} 分钟。',
    asks: ['合几时几分？'],
    formulas: ['hourOf(n)', 'minuteOf(n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: { n: { min: 70, max: 200 } },
    guard: (p) => p.n % 60 !== 0,
  },
  {
    id: 'u5w-d6',
    practice: 'direct',
    template: '{item} {h} 时 {m} 分开始，进行 {n} 分钟后结束。',
    asks: ['几时几分结束？'],
    formulas: ['hourOf(h*60+m+n)', 'minuteOf(h*60+m+n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h: { min: 8, max: 15 },
      m: { min: 5, max: 55, step: 5 },
      n: { min: 20, max: 120, step: 5 },
    },
    guard: (p) => at(p.h, p.m) + p.n <= 18 * 60 && (at(p.h, p.m) + p.n) % 60 !== 0,
  },

  // ---------- 逆向求 ----------
  {
    id: 'u5w-i1',
    practice: 'inverse',
    template: '{item} {h2} 时 {m2} 分结束，一共用了 {n} 分钟。',
    asks: ['几时几分开始的？'],
    formulas: ['hourOf(h2*60+m2-n)', 'minuteOf(h2*60+m2-n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h2: { min: 10, max: 17 },
      m2: { min: 5, max: 55, step: 5 },
      n: { min: 20, max: 120, step: 5 },
    },
    guard: (p) => at(p.h2, p.m2) - p.n >= 8 * 60 && (at(p.h2, p.m2) - p.n) % 60 !== 0,
  },
  {
    id: 'u5w-i2',
    practice: 'inverse',
    template: '{item} {h1} 时 {m1} 分开始，{h2} 时 {m2} 分结束，比计划多用了 {r} 分钟。',
    asks: ['计划用多少分钟？'],
    formulas: ['elapsedMinutes(h1,m1,h2,m2)-r'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 14 },
      m1: { min: 0, max: 55, step: 5 },
      h2: { min: 10, max: 17, gt: 'h1' },
      m2: { min: 0, max: 55, step: 5 },
      r: { min: 5, max: 30, step: 5 },
    },
    guard: (p) => {
      const total = elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
      return total >= 40 && total - p.r >= 20
    },
  },
  {
    id: 'u5w-i3',
    practice: 'inverse',
    template: '{person}从家到{place}要走 {n} 分钟，已经走了 {k} 分钟。',
    asks: ['至少还要走多少分钟？'],
    formulas: ['n-k'],
    unit: '分钟',
    slots: { n: { min: 20, max: 90, step: 5 }, k: { min: 5, max: 45, step: 5 } },
    guard: (p) => p.n - p.k >= 5,
  },
  {
    id: 'u5w-i4',
    practice: 'inverse',
    template: '{item} {h} 时 {m} 分开始，进行 {n} 分钟后休息 {r} 分钟。',
    asks: ['休息结束时几时几分？'],
    formulas: ['hourOf(h*60+m+n+r)', 'minuteOf(h*60+m+n+r)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h: { min: 8, max: 14 },
      m: { min: 5, max: 55, step: 5 },
      n: { min: 15, max: 60, step: 5 },
      r: { min: 5, max: 20, step: 5 },
    },
    guard: (p) => at(p.h, p.m) + p.n + p.r <= 18 * 60 && (at(p.h, p.m) + p.n + p.r) % 60 !== 0,
  },
  {
    id: 'u5w-i5',
    practice: 'inverse',
    template: '{item} {h2} 时 {m2} 分结束，比计划提前 {r} 分钟。',
    asks: ['计划几时几分结束？'],
    formulas: ['hourOf(h2*60+m2+r)', 'minuteOf(h2*60+m2+r)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h2: { min: 9, max: 16 },
      m2: { min: 5, max: 55, step: 5 },
      r: { min: 5, max: 30, step: 5 },
    },
    guard: (p) => at(p.h2, p.m2) + p.r <= 18 * 60 && (at(p.h2, p.m2) + p.r) % 60 !== 0,
  },
  {
    id: 'u5w-i6',
    practice: 'inverse',
    template: '一个时刻用 24 时记时法表示是 {h} 时。',
    asks: ['是下午几时？'],
    formulas: ['h-12'],
    unit: '时',
    slots: { h: { min: 13, max: 22 } },
  },

  // ---------- 比较与最值 ----------
  {
    id: 'u5w-c1',
    practice: 'compare',
    template: '第一次 {h1} 时 {m1} 分到 {h2} 时 {m2} 分，第二次 {h3} 时 {m3} 分到 {h4} 时 {m4} 分。',
    asks: ['第二次多用多少分钟？'],
    formulas: ['elapsedMinutes(h3,m3,h4,m4)-elapsedMinutes(h1,m1,h2,m2)'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 13 },
      m1: { min: 0, max: 55, step: 5 },
      h2: { min: 10, max: 14, gt: 'h1' },
      m2: { min: 0, max: 55, step: 5 },
      h3: { min: 14, max: 16 },
      m3: { min: 0, max: 55, step: 5 },
      h4: { min: 16, max: 18, gt: 'h3' },
      m4: { min: 0, max: 55, step: 5 },
    },
    guard: (p) => {
      const diff =
        elapsedMinutes(p.h3, p.m3, p.h4, p.m4) - elapsedMinutes(p.h1, p.m1, p.h2, p.m2)
      return diff >= 10 && diff <= 180
    },
  },
  {
    id: 'u5w-c2',
    practice: 'compare',
    template: '去{place}用了 {n1} 分钟，回来用了 {n2} 分钟。',
    asks: ['往返一共多少分钟？'],
    formulas: ['n1+n2'],
    unit: '分钟',
    slots: { n1: { min: 15, max: 60, step: 5 }, n2: { min: 20, max: 80, step: 5 } },
  },
  {
    id: 'u5w-c3',
    practice: 'compare',
    template: '上午活动 {n1} 分钟，下午活动 {n2} 分钟。',
    asks: ['下午比上午多多少分钟？'],
    formulas: ['n2-n1'],
    unit: '分钟',
    slots: { n1: { min: 20, max: 60, step: 5 }, n2: { min: 30, max: 90, step: 5, gt: 'n1' } },
    guard: (p) => p.n2 - p.n1 >= 10,
  },
  {
    id: 'u5w-c4',
    practice: 'compare',
    template: '{item} {h1} 时开始，第二次比第一次晚 {d} 分钟开始。',
    asks: ['第二次几时几分开始？'],
    formulas: ['hourOf(h1*60+d)', 'minuteOf(h1*60+d)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: { h1: { min: 8, max: 15 }, d: { min: 10, max: 90, step: 5 } },
    guard: (p) => at(p.h1, 0) + p.d <= 18 * 60 && (at(p.h1, 0) + p.d) % 60 !== 0,
  },
  {
    id: 'u5w-c5',
    practice: 'compare',
    template: '第一次 {h1} 时 {m1} 分开始，第二次 {h3} 时 {m3} 分开始。',
    asks: ['两次开始时刻相差多少分钟？'],
    formulas: ['elapsedMinutes(h1,m1,h3,m3)'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 13 },
      m1: { min: 0, max: 55, step: 5 },
      h3: { min: 9, max: 16, gt: 'h1' },
      m3: { min: 0, max: 55, step: 5 },
    },
    guard: (p) => { const t = elapsedMinutes(p.h1, p.m1, p.h3, p.m3); return t >= 30 && t <= 150 },
  },
  {
    id: 'u5w-c6',
    practice: 'compare',
    template: '第一次{item}用了 {n1} 分钟，第二次比第一次多 {d} 分钟。',
    asks: ['两次一共多少分钟？'],
    formulas: ['2*n1+d'],
    unit: '分钟',
    slots: { n1: { min: 15, max: 50, step: 5 }, d: { min: 10, max: 40, step: 5 } },
  },

  // ---------- 组合与拆分 ----------
  {
    id: 'u5w-p1',
    practice: 'compose',
    template: '{item}用了 {a} 时 {b} 分。',
    asks: ['一共是多少分钟？'],
    formulas: ['a*60+b'],
    unit: '分钟',
    slots: { a: { min: 1, max: 3 }, b: { min: 5, max: 55, step: 5 } },
  },
  {
    id: 'u5w-p2',
    practice: 'compose',
    template: '上午活动 {n1} 分钟，下午也活动了 {n2} 分钟。',
    asks: ['一天一共多少分钟？'],
    formulas: ['n1+n2'],
    unit: '分钟',
    slots: { n1: { min: 20, max: 50, step: 5 }, n2: { min: 30, max: 70, step: 5 } },
  },
  {
    id: 'u5w-p3',
    practice: 'compose',
    template: '{item}每次 {n} 分钟，共 {c} 次。',
    asks: ['一共多少分钟？'],
    formulas: ['n*c'],
    unit: '分钟',
    slots: { n: { min: 10, max: 35, step: 5 }, c: { min: 3, max: 8 } },
  },
  {
    id: 'u5w-p4',
    practice: 'compose',
    template: '{item}上午用了 {a} 时 {b} 分，下午用了 {c} 时 {d} 分。',
    asks: ['一共多少分钟？'],
    formulas: ['(a+c)*60+b+d'],
    unit: '分钟',
    slots: {
      a: { min: 1, max: 3 },
      b: { min: 5, max: 55, step: 5 },
      c: { min: 1, max: 2 },
      d: { min: 5, max: 55, step: 5 },
    },
  },
  {
    id: 'u5w-p5',
    practice: 'compose',
    template: '{item}每天 {n} 分钟，连续 {c} 天。',
    asks: ['一共多少分钟？'],
    formulas: ['n*c'],
    unit: '分钟',
    slots: { n: { min: 15, max: 35, step: 5 }, c: { min: 3, max: 7 } },
  },
  {
    id: 'u5w-p6',
    practice: 'compose',
    template: '去{place}用 {n1} 分钟，回来多用 {r} 分钟。',
    asks: ['往返一共多少分钟？'],
    formulas: ['2*n1+r'],
    unit: '分钟',
    slots: { n1: { min: 15, max: 50, step: 5 }, r: { min: 10, max: 30, step: 5 } },
  },

  // ---------- 多步合成 ----------
  {
    id: 'u5w-m1',
    practice: 'multistep',
    template: '{item} {h} 时开始，{person}提前 {r} 分钟到{place}。',
    asks: ['最迟几时几分到？'],
    formulas: ['hourOf(h*60-r)', 'minuteOf(h*60-r)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: { h: { min: 9, max: 16 }, r: { min: 10, max: 40, step: 5 } },
    guard: (p) => at(p.h, 0) - p.r >= 8 * 60 && (at(p.h, 0) - p.r) % 60 !== 0,
  },
  {
    id: 'u5w-m2',
    practice: 'multistep',
    template: '{person}要在 {h} 时 {m} 分前到{place}，路上要走 {n} 分钟。',
    asks: ['最迟几时几分出发？'],
    formulas: ['hourOf(h*60+m-n)', 'minuteOf(h*60+m-n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h: { min: 10, max: 17 },
      m: { min: 5, max: 55, step: 5 },
      n: { min: 20, max: 90, step: 5 },
    },
    guard: (p) => at(p.h, p.m) - p.n >= 8 * 60 && (at(p.h, p.m) - p.n) % 60 !== 0,
  },
  {
    id: 'u5w-m3',
    practice: 'multistep',
    template: '{item}第一部分 {n1} 分钟，休息 {r} 分钟，第二部分 {n2} 分钟。',
    asks: ['一共多少分钟？'],
    formulas: ['n1+r+n2'],
    unit: '分钟',
    slots: {
      n1: { min: 10, max: 30, step: 5 },
      r: { min: 5, max: 20, step: 5 },
      n2: { min: 10, max: 30, step: 5 },
    },
  },
  {
    id: 'u5w-m4',
    practice: 'multistep',
    template: '{person} {h1} 时到 {h2} 时、{h3} 时到 {h4} 时都在{place}。',
    asks: ['一天共多少分钟？'],
    formulas: ['(h2-h1)*60+(h4-h3)*60'],
    unit: '分钟',
    slots: {
      h1: { min: 8, max: 11 },
      h2: { min: 9, max: 12, gt: 'h1' },
      h3: { min: 13, max: 15 },
      h4: { min: 15, max: 17, gt: 'h3' },
    },
  },
  {
    id: 'u5w-m5',
    practice: 'multistep',
    template: '{item}第一次 {h} 时开始，进行 {n} 分钟后休息 {r} 分钟。',
    asks: ['第二次几时几分开始？'],
    formulas: ['hourOf(h*60+n+r)', 'minuteOf(h*60+n+r)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h: { min: 8, max: 14 },
      n: { min: 15, max: 60, step: 5 },
      r: { min: 5, max: 20, step: 5 },
    },
    guard: (p) => at(p.h, 0) + p.n + p.r <= 18 * 60 && (at(p.h, 0) + p.n + p.r) % 60 !== 0,
  },
  {
    id: 'u5w-m6',
    practice: 'multistep',
    template: '{person}要在 {h} 时前到{place}，现在 {h0} 时 {m0} 分，路上 {n} 分钟。',
    asks: ['会提前多少分钟到达？'],
    formulas: ['h*60-(h0*60+m0)-n'],
    unit: '分钟',
    slots: {
      h: { min: 10, max: 17 },
      h0: { min: 8, max: 15 },
      m0: { min: 0, max: 55, step: 5 },
      n: { min: 10, max: 60, step: 5 },
    },
    guard: (p) => p.h * 60 - at(p.h0, p.m0) - p.n >= 5 && p.h0 * 60 + p.m0 + p.n <= 18 * 60,
  },
]
