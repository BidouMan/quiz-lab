/**
 * 3A-U5 年、月、日 · 应用题三档覆盖
 * L1 单步时刻计算；L2（基线）经过时间两步；L3 跨课间 / 提前出发 / 反求出发时刻。
 * 每档显式给 guard，避免继承基线 guard 里不存在的槽位。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { R, band } from './bands.ts'

const at = (h: number, m: number): number => h * 60 + m
const el = 'elapsedMinutes'

export const U5_DATE_WORD_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 直接求 ----------
  'u5w-d1': {
    L1: band(
      { h1: R(8, 14), m1: R(0, 55, 5), h2: R(9, 16, undefined, undefined, 'h1'), m2: R(0, 55, 5) },
      {
        template: '{item}从 {h1} 时 {m1} 分到 {h2} 时 {m2} 分。',
        asks: ['一共经过多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const t = (p.h2 * 60 + p.m2) - (p.h1 * 60 + p.m1)
          return t >= 20 && t <= 120
        },
      },
    ),
    L3: band(
      {
        h1: R(8, 10),
        m1: R(0, 55, 5),
        h2: R(10, 11, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
        h3: R(13, 15),
        m3: R(0, 55, 5),
        h4: R(15, 17, undefined, undefined, 'h3'),
        m4: R(0, 55, 5),
      },
      {
        template: '{item}上午 {h1} 时 {m1} 分到 {h2} 时 {m2} 分，下午 {h3} 时 {m3} 分到 {h4} 时 {m4} 分。',
        asks: ['共多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)+${el}(h3,m3,h4,m4)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) =>
          (p.h2 * 60 + p.m2) - (p.h1 * 60 + p.m1) >= 30 &&
          (p.h4 * 60 + p.m4) - (p.h3 * 60 + p.m3) >= 30,
      },
    ),
  },

  'u5w-d2': {
    L1: band(
      { h1: R(8, 14), h2: R(9, 17, undefined, undefined, 'h1') },
      {
        template: '{item}从 {h1} 时到 {h2} 时。',
        asks: ['一共多少小时？'],
        formulas: ['h2-h1'],
        unit: '小时',
        answerUnits: ['小时'],
        guard: () => true,
      },
    ),
    L3: band(
      { h1: R(8, 14), m1: R(0, 55, 5), h2: R(10, 17, undefined, undefined, 'h1'), m2: R(0, 55, 5), r: R(10, 30, 5) },
      {
        template: '{person}在{place}，提前 {r} 分钟到场，活动从 {h1} 时 {m1} 分到 {h2} 时 {m2} 分。',
        asks: ['待了多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)+r`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const t = (p.h2 * 60 + p.m2) - (p.h1 * 60 + p.m1)
          return t >= 30 && t + p.r <= 180
        },
      },
    ),
  },

  'u5w-d3': {
    L1: band(
      { h: R(1, 3) },
      {
        template: '下午 {h} 时。',
        asks: ['用 24 时记时法表示是几时？'],
        formulas: ['h+12'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => p.h + 12 >= 13 && p.h + 12 <= 15,
      },
    ),
    L3: band(
      { h: R(2, 5), m: R(5, 55, 5), n: R(20, 80, 5) },
      {
        template: '{person}下午 {h} 时 {m} 分出发去{place}，走 {n} 分钟后到达。',
        asks: ['到达是几时几分？'],
        formulas: ['hourOf(h*60+720+m+n)', 'minuteOf(h*60+720+m+n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => ((p.h + 12) * 60 + p.m + p.n) <= 19 * 60 && (((p.h + 12) * 60 + p.m + p.n) % 60) !== 0,
      },
    ),
  },

  'u5w-d4': {
    L1: band(
      { h1: R(8, 14), m1: R(5, 55, 5), h2: R(10, 17, undefined, undefined, 'h1') },
      {
        template: '{item}从 {h1} 时 {m1} 分到 {h2} 时。',
        asks: ['经过多少分钟？'],
        formulas: [`${el}(h1,m1,h2,0)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const t = p.h2 * 60 - (p.h1 * 60 + p.m1)
          return t >= 20 && t <= 120
        },
      },
    ),
    L3: band(
      { h1: R(8, 13), n: R(15, 50, 5), r: R(5, 15, 5) },
      {
        template: '{item} {h1} 时开始，每次 {n} 分钟，休息 {r} 分钟。',
        asks: ['第二次几时几分开始？'],
        formulas: ['hourOf(h1*60+n+r)', 'minuteOf(h1*60+n+r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h1 * 60 + p.n + p.r) <= 18 * 60 && ((p.h1 * 60 + p.n + p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-d5': {
    L1: band(
      { n: R(70, 140) },
      {
        template: '{item}用了 {n} 分钟。',
        asks: ['合几时几分？'],
        formulas: ['hourOf(n)', 'minuteOf(n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => p.n % 60 !== 0,
      },
    ),
    L3: band(
      { n: R(90, 200) },
      {
        template: '{item}从 8 时开始，一共 {n} 分钟。',
        asks: ['几时几分结束？'],
        formulas: ['hourOf(480+n)', 'minuteOf(480+n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => p.n % 60 !== 0,
      },
    ),
  },

  'u5w-d6': {
    L1: band(
      { h: R(8, 15), n: R(20, 120, 5) },
      {
        template: '{item} {h} 时开始，{n} 分钟后结束。',
        asks: ['几时结束？'],
        formulas: ['hourOf(h*60+n)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h * 60 + p.n) <= 18 * 60 && ((p.h * 60 + p.n) % 60) === 0,
      },
    ),
    L3: band(
      { h: R(2, 5), m: R(5, 55, 5), n: R(20, 80, 5) },
      {
        template: '{item}下午 {h} 时 {m} 分开始，{n} 分钟后结束。',
        asks: ['用 24 时记时法表示是几时几分？'],
        formulas: ['hourOf(h*60+720+m+n)', 'minuteOf(h*60+720+m+n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => ((p.h + 12) * 60 + p.m + p.n) <= 19 * 60 && (((p.h + 12) * 60 + p.m + p.n) % 60) !== 0,
      },
    ),
  },

  // ---------- 逆向求 ----------
  'u5w-i1': {
    L1: band(
      { h2: R(10, 17), n: R(20, 120, 5) },
      {
        template: '{item} {h2} 时结束，用了 {n} 分钟。',
        asks: ['几时开始？'],
        formulas: ['hourOf(h2*60-n)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h2 * 60 - p.n) >= 8 * 60 && ((p.h2 * 60 - p.n) % 60) === 0,
      },
    ),
    L3: band(
      { h2: R(11, 17), m2: R(5, 55, 5), n: R(20, 90, 5) },
      {
        template: '{person}要在 {h2} 时 {m2} 分前到{place}，路上 {n} 分钟。',
        asks: ['最迟几时几分出发？'],
        formulas: ['hourOf(h2*60+m2-n)', 'minuteOf(h2*60+m2-n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h2 * 60 + p.m2 - p.n) >= 8 * 60 && ((p.h2 * 60 + p.m2 - p.n) % 60) !== 0,
      },
    ),
  },

  'u5w-i2': {
    L1: band(
      { h1: R(8, 14), h2: R(10, 17, undefined, undefined, 'h1'), r: R(5, 30, 5) },
      {
        template: '{item} {h1} 时到 {h2} 时，比计划多 {r} 分钟。',
        asks: ['计划多少分钟？'],
        formulas: ['(h2-h1)*60-r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => (p.h2 - p.h1) * 60 >= 40 && (p.h2 - p.h1) * 60 - p.r >= 20,
      },
    ),
    L3: band(
      { h1: R(8, 13), m1: R(0, 55, 5), h2: R(10, 16, undefined, undefined, 'h1'), m2: R(0, 55, 5), r: R(5, 25, 5) },
      {
        template: '{item} {h1} 时 {m1} 分到 {h2} 时 {m2} 分，比计划少用 {r} 分钟。',
        asks: ['计划多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)-r`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const t = (p.h2 * 60 + p.m2) - (p.h1 * 60 + p.m1)
          return t >= 40 && t - p.r >= 20
        },
      },
    ),
  },

  'u5w-i3': {
    L1: band(
      { n: R(20, 90, 5), k: R(5, 45, 5) },
      {
        template: '{person}从家到{place}要走 {n} 分钟，已经走了 {k} 分钟。',
        asks: ['至少还要走多少分钟？'],
        formulas: ['n-k'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => p.n - p.k >= 5,
      },
    ),
    L3: band(
      { n: R(30, 90, 5), k: R(5, 40, 5), h: R(10, 17) },
      {
        template: '{person}从家到{place}要走 {n} 分钟，已走 {k} 分钟，要在 {h} 时前到。',
        asks: ['最迟几时几分出发？'],
        formulas: ['hourOf(h*60-n+k)', 'minuteOf(h*60-n+k)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) =>
          p.n - p.k >= 10 &&
          p.h * 60 - (p.n - p.k) >= 8 * 60 &&
          (p.h * 60 - (p.n - p.k)) % 60 !== 0,
      },
    ),
  },

  'u5w-i4': {
    L1: band(
      { h: R(8, 14), n: R(15, 60, 5), r: R(5, 20, 5) },
      {
        template: '{item} {h} 时开始，{n} 分钟后休息 {r} 分钟。',
        asks: ['休息结束是几时？'],
        formulas: ['hourOf(h*60+n+r)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h * 60 + p.n + p.r) <= 18 * 60 && ((p.h * 60 + p.n + p.r) % 60) === 0,
      },
    ),
    L3: band(
      { h: R(8, 13), m: R(5, 55, 5), n: R(15, 50, 5), r: R(5, 15, 5) },
      {
        template: '{item} {h} 时 {m} 分开始，进行 {n} 分钟后休息 {r} 分钟。',
        asks: ['休息结束是几时几分？'],
        formulas: ['hourOf(h*60+m+n+r)', 'minuteOf(h*60+m+n+r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (at(p.h, p.m) + p.n + p.r) <= 18 * 60 && ((at(p.h, p.m) + p.n + p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-i5': {
    L1: band(
      { h2: R(9, 16), r: R(5, 30, 5) },
      {
        template: '{item} {h2} 时结束，比计划提前 {r} 分钟。',
        asks: ['计划几时几分结束？'],
        formulas: ['hourOf(h2*60+r)', 'minuteOf(h2*60+r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h2 * 60 + p.r) <= 18 * 60,
      },
    ),
    L3: band(
      { h2: R(9, 15), m2: R(5, 55, 5), r: R(5, 25, 5) },
      {
        template: '{item} {h2} 时 {m2} 分结束，比计划提前 {r} 分钟。',
        asks: ['计划几时几分结束？'],
        formulas: ['hourOf(h2*60+m2+r)', 'minuteOf(h2*60+m2+r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (at(p.h2, p.m2) + p.r) <= 18 * 60 && ((at(p.h2, p.m2) + p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-i6': {
    L1: band(
      { h: R(17, 19) },
      {
        template: '下午的时刻用 24 时记时法表示是 {h} 时。',
        asks: ['是下午几时？'],
        formulas: ['h-12'],
        unit: '时',
        answerUnits: ['时'],
        guard: () => true,
      },
    ),
    L3: band(
      { h: R(16, 21), m: R(5, 55, 5) },
      {
        template: '24 时记时法的 {h} 时 {m} 分。',
        asks: ['是下午几时几分？'],
        formulas: ['h-12', 'm'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: () => true,
      },
    ),
  },

  // ---------- 比较与最值 ----------
  'u5w-c1': {
    L1: band(
      { n1: R(15, 50, 5), n2: R(25, 80, 5) },
      {
        template: '第一次{item} {n1} 分钟，第二次 {n2} 分钟。',
        asks: ['第二次比第一次多多少分钟？'],
        formulas: ['n2-n1'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => p.n2 - p.n1 >= 10,
      },
    ),
    L3: band(
      {
        h1: R(8, 11),
        m1: R(0, 55, 5),
        h2: R(10, 13, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
        h3: R(13, 15),
        m3: R(0, 55, 5),
        h4: R(15, 17, undefined, undefined, 'h3'),
        m4: R(0, 55, 5),
      },
      {
        template: '第一次 {h1} 时 {m1} 分到 {h2} 时 {m2} 分，第二次 {h3} 时 {m3} 分到 {h4} 时 {m4} 分。',
        asks: ['第二次多用多少分钟？'],
        formulas: [`${el}(h3,m3,h4,m4)-${el}(h1,m1,h2,m2)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const diff = (p.h4 * 60 + p.m4 - p.h3 * 60 - p.m3) - (p.h2 * 60 + p.m2 - p.h1 * 60 - p.m1)
          return diff >= 10 && diff <= 90
        },
      },
    ),
  },

  'u5w-c2': {
    L1: band(
      { n1: R(15, 50, 5), n2: R(20, 70, 5) },
      {
        template: '去{place}用 {n1} 分钟，回来用 {n2} 分钟。',
        asks: ['一共多少分钟？'],
        formulas: ['n1+n2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(15, 50, 5), r: R(10, 30, 5) },
      {
        template: '去{place}用 {n1} 分钟，回来多用 {r} 分钟。',
        asks: ['往返共多少分钟？'],
        formulas: ['2*n1+r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-c3': {
    L1: band(
      { n1: R(20, 60, 5), n2: R(30, 90, 5, undefined, 'n1') },
      {
        template: '上午活动 {n1} 分钟，下午活动 {n2} 分钟。',
        asks: ['下午比上午多多少分钟？'],
        formulas: ['n2-n1'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => p.n2 - p.n1 >= 10,
      },
    ),
    L3: band(
      { n1: R(20, 50, 5), d: R(10, 30, 5) },
      {
        template: '上午活动 {n1} 分钟，下午比上午多 {d} 分钟。',
        asks: ['一天共多少分钟？'],
        formulas: ['2*n1+d'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-c4': {
    L1: band(
      { h1: R(8, 15), d: R(10, 90, 5) },
      {
        template: '{item} {h1} 时开始，第二次晚 {d} 分钟开始。',
        asks: ['第二次几时开始？'],
        formulas: ['hourOf(h1*60+d)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h1 * 60 + p.d) <= 18 * 60 && ((p.h1 * 60 + p.d) % 60) === 0,
      },
    ),
    L3: band(
      { h1: R(8, 13), m1: R(5, 55, 5), d: R(15, 85, 5) },
      {
        template: '{item} {h1} 时 {m1} 分开始，第二次晚 {d} 分钟开始。',
        asks: ['第二次几时几分开始？'],
        formulas: ['hourOf(h1*60+m1+d)', 'minuteOf(h1*60+m1+d)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (at(p.h1, p.m1) + p.d) <= 18 * 60 && ((at(p.h1, p.m1) + p.d) % 60) !== 0,
      },
    ),
  },

  'u5w-c5': {
    L1: band(
      { h1: R(8, 13), m1: R(0, 55, 5), h3: R(9, 16, undefined, undefined, 'h1'), m3: R(0, 55, 5) },
      {
        template: '第一次 {h1} 时 {m1} 分开始，第二次 {h3} 时 {m3} 分开始。',
        asks: ['两次开始时刻相差多少分钟？'],
        formulas: [`${el}(h1,m1,h3,m3)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => { const t = (p.h3 * 60 + p.m3) - (p.h1 * 60 + p.m1); return t >= 30 && t <= 150 },
      },
    ),
    L3: band(
      { h1: R(8, 13), m1: R(0, 55, 5), h2: R(10, 16, undefined, undefined, 'h1'), m2: R(0, 55, 5), r: R(10, 30, 5) },
      {
        template: '{person}去{place}，{h1} 时 {m1} 分出发，{h2} 时 {m2} 分到达，回来少用 {r} 分钟。',
        asks: ['回来用多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)-r`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => (p.h2 * 60 + p.m2 - p.h1 * 60 - p.m1) >= p.r + 15,
      },
    ),
  },

  'u5w-c6': {
    L1: band(
      { n1: R(15, 50, 5), d: R(10, 40, 5) },
      {
        template: '第一次 {n1} 分钟，第二次比第一次多 {d} 分钟。',
        asks: ['第二次多少分钟？'],
        formulas: ['n1+d'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(10, 40, 5), d: R(5, 20, 5), d2: R(5, 20, 5) },
      {
        template: '第一次 {n1} 分钟，第二次多 {d} 分钟，第三次再多 {d2} 分钟。',
        asks: ['三次共多少分钟？'],
        formulas: ['3*n1+2*d+d2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  // ---------- 组合与拆分 ----------
  'u5w-p1': {
    L1: band(
      { a: R(1, 3), b: R(5, 55, 5) },
      {
        template: '{a} 时 {b} 分是一个时长。',
        asks: ['一共多少分钟？'],
        formulas: ['a*60+b'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(1, 3), b: R(5, 55, 5), c: R(1, 2), d: R(5, 55, 5) },
      {
        template: '{item}先用了 {a} 时 {b} 分，又用了 {c} 时 {d} 分。',
        asks: ['一共多少分钟？'],
        formulas: ['(a+c)*60+b+d'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-p2': {
    L1: band(
      { n1: R(20, 50, 5), n2: R(30, 70, 5) },
      {
        template: '上午 {n1} 分钟，下午 {n2} 分钟。',
        asks: ['一天一共多少分钟？'],
        formulas: ['n1+n2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(20, 45, 5), r: R(10, 30, 5), n2: R(25, 50, 5) },
      {
        template: '上午 {n1} 分钟，中午休息 {r} 分钟，下午 {n2} 分钟。',
        asks: ['一天共多少分钟？'],
        formulas: ['n1+r+n2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-p3': {
    L1: band(
      { n: R(10, 35, 5), c: R(3, 8) },
      {
        template: '{item}每次 {n} 分钟，共 {c} 次。',
        asks: ['一共多少分钟？'],
        formulas: ['n*c'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n: R(10, 30, 5), c: R(3, 6), r: R(5, 15, 5) },
      {
        template: '{item}每次 {n} 分钟，休息 {r} 分钟，共 {c} 次。',
        asks: ['共多少分钟？'],
        formulas: ['n*c+r*(c-1)'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-p4': {
    L1: band(
      { a: R(1, 4), b: R(2, 6) },
      {
        template: '{item}用了 {a} 时，又用了 {b} 时。',
        asks: ['一共多少小时？'],
        formulas: ['a+b'],
        unit: '小时',
        answerUnits: ['小时'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(1, 3), b: R(5, 55, 5), c: R(15, 50, 5) },
      {
        template: '{item}用了 {a} 时 {b} 分，又延长 {c} 分钟。',
        asks: ['一共多少分钟？'],
        formulas: ['a*60+b+c'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-p5': {
    L1: band(
      { n: R(15, 35, 5), c: R(3, 7) },
      {
        template: '{item}每天 {n} 分钟，{c} 天。',
        asks: ['一共多少分钟？'],
        formulas: ['n*c'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n: R(15, 30, 5), c: R(3, 6), r: R(5, 15, 5) },
      {
        template: '{item}每天 {n} 分钟，连续 {c} 天，最后一天少 {r} 分钟。',
        asks: ['共多少分钟？'],
        formulas: ['n*c-r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
  },

  'u5w-p6': {
    L1: band(
      { n1: R(15, 50, 5), r: R(10, 30, 5) },
      {
        template: '去{place}用 {n1} 分钟，回来多用 {r} 分钟。',
        asks: ['回来用多少分钟？'],
        formulas: ['n1+r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(15, 50, 5), r: R(5, 20, 5) },
      {
        template: '去{place}用 {n1} 分钟，回来少用 {r} 分钟。',
        asks: ['往返共多少分钟？'],
        formulas: ['2*n1-r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => 2 * p.n1 - p.r >= 20,
      },
    ),
  },

  // ---------- 多步合成 ----------
  'u5w-m1': {
    L1: band(
      { h: R(9, 16), r: R(10, 40, 5) },
      {
        template: '{item} {h} 时开始，{person}提前 {r} 分钟到{place}。',
        asks: ['最迟几时几分到？'],
        formulas: ['hourOf(h*60-r)', 'minuteOf(h*60-r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h * 60 - p.r) >= 8 * 60,
      },
    ),
    L3: band(
      { h: R(10, 16), m: R(5, 55, 5), r: R(10, 30, 5) },
      {
        template: '{item} {h} 时 {m} 分开始，{person}提前 {r} 分钟到{place}。',
        asks: ['最迟几时几分到？'],
        formulas: ['hourOf(h*60+m-r)', 'minuteOf(h*60+m-r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (at(p.h, p.m) - p.r) >= 8 * 60 && ((at(p.h, p.m) - p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-m2': {
    L1: band(
      { h: R(10, 17), n: R(20, 90, 5) },
      {
        template: '{person} {h} 时前到{place}，路上 {n} 分钟。',
        asks: ['最迟几时出发？'],
        formulas: ['hourOf(h*60-n)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h * 60 - p.n) >= 8 * 60 && ((p.h * 60 - p.n) % 60) === 0,
      },
    ),
    L3: band(
      { h: R(10, 17), n: R(20, 60, 5), r: R(5, 20, 5) },
      {
        template: '{person}要在 {h} 时前到{place}，路上 {n} 分钟，等车 {r} 分钟。',
        asks: ['最迟几时几分出发？'],
        formulas: ['hourOf(h*60-n-r)', 'minuteOf(h*60-n-r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h * 60 - p.n - p.r) >= 8 * 60 && ((p.h * 60 - p.n - p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-m3': {
    L1: band(
      { n1: R(10, 30, 5), r: R(5, 20, 5), n2: R(10, 30, 5) },
      {
        template: '第一部分 {n1} 分钟，休息 {r} 分钟，第二部分 {n2} 分钟。',
        asks: ['一共多少分钟？'],
        formulas: ['n1+r+n2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(15, 35, 5), r: R(10, 25, 5), n2: R(15, 35, 5), h: R(8, 14) },
      {
        template: '第一部分 {n1} 分钟，休息 {r} 分钟，第二部分 {n2} 分钟，{item} {h} 时开始。',
        asks: ['几时几分结束？'],
        formulas: ['hourOf(h*60+n1+r+n2)', 'minuteOf(h*60+n1+r+n2)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h * 60 + p.n1 + p.r + p.n2) <= 18 * 60 && ((p.h * 60 + p.n1 + p.r + p.n2) % 60) !== 0,
      },
    ),
  },

  'u5w-m4': {
    L1: band(
      { n1: R(20, 40, 5), r: R(5, 15, 5), n2: R(20, 40, 5) },
      {
        template: '上午活动 {n1} 分钟，中午休息 {r} 分钟，下午活动 {n2} 分钟。',
        asks: ['一共多少分钟？'],
        formulas: ['n1+r+n2'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: () => true,
      },
    ),
    L3: band(
      {
        h1: R(8, 10),
        m1: R(0, 55, 5),
        h2: R(10, 12, undefined, undefined, 'h1'),
        m2: R(0, 55, 5),
        h3: R(13, 15),
        m3: R(0, 55, 5),
        h4: R(15, 17, undefined, undefined, 'h3'),
        m4: R(0, 55, 5),
      },
      {
        template: '{person} {h1} 时 {m1} 分到 {h2} 时 {m2} 分、{h3} 时 {m3} 分到 {h4} 时 {m4} 分都在{place}。',
        asks: ['共多少分钟？'],
        formulas: [`${el}(h1,m1,h2,m2)+${el}(h3,m3,h4,m4)`],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) =>
          (p.h2 * 60 + p.m2) - (p.h1 * 60 + p.m1) >= 30 &&
          (p.h4 * 60 + p.m4) - (p.h3 * 60 + p.m3) >= 30,
      },
    ),
  },

  'u5w-m5': {
    L1: band(
      { h: R(8, 14), n: R(15, 60, 5), r: R(5, 20, 5) },
      {
        template: '第一次 {h} 时开始，用 {n} 分钟，休息 {r} 分钟。',
        asks: ['第二次几时开始？'],
        formulas: ['hourOf(h*60+n+r)'],
        unit: '时',
        answerUnits: ['时'],
        guard: (p) => (p.h * 60 + p.n + p.r) <= 18 * 60 && ((p.h * 60 + p.n + p.r) % 60) === 0,
      },
    ),
    L3: band(
      { h: R(8, 13), m: R(5, 55, 5), n: R(15, 50, 5), r: R(5, 15, 5) },
      {
        template: '第一次 {h} 时 {m} 分开始，进行 {n} 分钟，休息 {r} 分钟。',
        asks: ['第二次几时几分开始？'],
        formulas: ['hourOf(h*60+m+n+r)', 'minuteOf(h*60+m+n+r)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (at(p.h, p.m) + p.n + p.r) <= 18 * 60 && ((at(p.h, p.m) + p.n + p.r) % 60) !== 0,
      },
    ),
  },

  'u5w-m6': {
    L1: band(
      { h: R(10, 17), h0: R(8, 15), m0: R(0, 55, 5) },
      {
        template: '{item} {h} 时开始，现在 {h0} 时 {m0} 分。',
        asks: ['还有多少分钟？'],
        formulas: ['h*60-(h0*60+m0)'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => {
          const left = p.h * 60 - at(p.h0, p.m0)
          return left >= 10 && left <= 120
        },
      },
    ),
    L3: band(
      { h: R(11, 17), h0: R(8, 15), m0: R(0, 55, 5), n: R(20, 60, 5) },
      {
        template: '{person}现在 {h0} 时 {m0} 分，要在 {h} 时前到{place}，路上要走 {n} 分钟。',
        asks: ['最迟几时几分出发？'],
        formulas: ['hourOf(h*60-n)', 'minuteOf(h*60-n)'],
        unit: '',
        answerUnits: ['时', '分'],
        guard: (p) => (p.h * 60 - p.n) >= 8 * 60 && ((p.h * 60 - p.n) % 60) !== 0 && p.h * 60 - p.n > at(p.h0, p.m0),
      },
    ),
  },
}
