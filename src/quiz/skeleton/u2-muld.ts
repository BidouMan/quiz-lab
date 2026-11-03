/**
 * 3B-U2 用两位数乘除 · 应用题 · L3
 * 6 个做法 × 5 条句式 = 30 条骨架。
 *
 * L3 口径：
 * - 乘法一律两位数 × 两位数（两个因数 12–48，且都不能是整十数），必须有“分两层相乘”的步骤；
 * - 除法一律两位数除三位数（被除数 100–999，除数 12–48 且非整十数），商 2–9，保证是真实试商；
 * - 带余数 / 至少 / 最多分别写 remainder / ceil / floor，余数在问句或答案里显式给出；
 * - 单价与总价控制在四位数以内，不出现五位数。
 */
import type { Skeleton } from './types.ts'

const twoDigit = (n: number): boolean => n >= 10 && n <= 99
const noTen = (n: number): boolean => n % 10 !== 0
const divideOk = (a: number, b: number, qMax = 9): boolean =>
  b >= 10 && noTen(b) && a % b === 0 && a / b >= 2 && a / b <= qMax

export const U2_MULD_SKELETONS: Skeleton[] = [
  // ---------- 直接求 ----------
  {
    id: 'u2-d1',
    practice: 'direct',
    template: '{place}有 {b} 排{item}，每排 {a} {cls}。',
    asks: ['一共有多少{cls}？'],
    formulas: ['a*b'],
    unit: '{cls}',
    sceneTags: ['rowed'],
    slots: { a: { min: 12, max: 48 }, b: { min: 12, max: 24 } },
    guard: (p) => twoDigit(p.a) && twoDigit(p.b) && noTen(p.a) && noTen(p.b) && p.a * p.b <= 1600,
  },
  {
    id: 'u2-d2',
    practice: 'direct',
    template: '{b} 箱{item}，每箱装 {a} {cls}。',
    asks: ['一共有多少{cls}？'],
    formulas: ['a*b'],
    unit: '{cls}',
    sceneTags: ['boxed'],
    slots: { a: { min: 12, max: 48 }, b: { min: 12, max: 24 } },
    guard: (p) => twoDigit(p.a) && twoDigit(p.b) && noTen(p.a) && noTen(p.b) && p.a * p.b <= 1600,
  },
  {
    id: 'u2-d3',
    practice: 'direct',
    template: '{a} {cls}{item}，平均分给 {b} 个班。',
    asks: ['每班分到多少{cls}？'],
    formulas: ['a/b'],
    unit: '{cls}',
    sceneTags: ['class'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => divideOk(p.a, p.b),
  },
  {
    id: 'u2-d4',
    practice: 'direct',
    template: '每{cls}{item} {a} 元，买 {b} {cls}。',
    asks: ['一共要多少元？'],
    formulas: ['a*b'],
    unit: '元',
    sceneTags: ['price'],
    slots: { a: { min: 12, max: 48 }, b: { min: 12, max: 24 } },
    guard: (p) => twoDigit(p.a) && twoDigit(p.b) && noTen(p.a) && noTen(p.b) && p.a * p.b <= 1600,
  },
  {
    id: 'u2-d5',
    practice: 'direct',
    template: '{a} {cls}{item}，每 {b} {cls}装一箱。',
    asks: ['能装多少箱？'],
    formulas: ['a/b'],
    unit: '箱',
    sceneTags: ['boxed'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => divideOk(p.a, p.b),
  },

  // ---------- 逆向求 ----------
  {
    id: 'u2-i1',
    practice: 'inverse',
    template: '{a} {cls}{item}，每排 {b} {cls}。',
    asks: ['能摆多少排？'],
    formulas: ['a/b'],
    unit: '排',
    sceneTags: ['rowed'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => divideOk(p.a, p.b),
  },
  {
    id: 'u2-i2',
    practice: 'inverse',
    template: '{a} 千克{item}，每箱装 {b} 千克。',
    asks: ['能装多少箱？'],
    formulas: ['a/b'],
    unit: '箱',
    sceneTags: ['care'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 45 } },
    guard: (p) => divideOk(p.a, p.b),
  },
  {
    id: 'u2-i3',
    practice: 'inverse',
    template: '{person}买了{cls}{item}，共花 {a} 元，每{cls} {b} 元。',
    asks: ['买了多少{cls}？'],
    formulas: ['a/b'],
    unit: '{cls}',
    sceneTags: ['price'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => divideOk(p.a, p.b),
  },
  {
    id: 'u2-i4',
    practice: 'inverse',
    template: '{a} 千克{item}，正好装 {b} 箱。',
    asks: ['每箱重多少千克？'],
    formulas: ['a/b'],
    unit: '千克',
    sceneTags: ['care'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 45 } },
    guard: (p) => divideOk(p.a, p.b),
  },
  {
    id: 'u2-i5',
    practice: 'inverse',
    template: '{a} {cls}{item}，正好摆成 {b} 排。',
    asks: ['每排多少{cls}？'],
    formulas: ['a/b'],
    unit: '{cls}',
    sceneTags: ['rowed'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => divideOk(p.a, p.b),
  },

  // ---------- 比较与最值 ----------
  {
    id: 'u2-c1',
    practice: 'compare',
    template: '{place}新到两批{item}：第一批 {b} 箱，每箱 {a} {cls}；第二批 {d} 箱，每箱 {c} {cls}。',
    asks: ['两批相差多少{cls}？'],
    formulas: ['a*b-c*d'],
    unit: '{cls}',
    sceneTags: ['boxed'],
    slots: {
      a: { min: 12, max: 36 },
      b: { min: 12, max: 24 },
      c: { min: 12, max: 36 },
      d: { min: 12, max: 24 },
    },
    guard: (p) =>
      twoDigit(p.a) &&
      twoDigit(p.b) &&
      twoDigit(p.c) &&
      twoDigit(p.d) &&
      noTen(p.a) &&
      noTen(p.b) &&
      noTen(p.c) &&
      noTen(p.d) &&
      p.a * p.b > p.c * p.d &&
      p.b !== p.d &&
      p.a * p.b <= 1200 &&
      p.c * p.d <= 1200,
  },
  {
    id: 'u2-c2',
    practice: 'compare',
    template: '甲店每{cls}{item} {a} 元，乙店每{cls} {b} 元，各买 {c} {cls}。',
    asks: ['甲店比乙店多花多少元？'],
    formulas: ['(a-b)*c'],
    unit: '元',
    sceneTags: ['price'],
    slots: {
      a: { min: 24, max: 48 },
      b: { min: 12, max: 36 },
      c: { min: 12, max: 24 },
    },
    guard: (p) =>
      twoDigit(p.a) && twoDigit(p.b) && twoDigit(p.c) && noTen(p.a) && noTen(p.b) && noTen(p.c) && p.a > p.b && p.a - p.b >= 12 && (p.a - p.b) * p.c <= 1200,
  },
  {
    id: 'u2-c3',
    practice: 'compare',
    template: '{a} {cls}{item}，平均分给 {b} 个班，改成平均分给 {c} 个班。',
    asks: ['每班少多少{cls}？'],
    formulas: ['a/b-a/c'],
    unit: '{cls}',
    sceneTags: ['class'],
    slots: {
      a: { min: 100, max: 432 },
      b: { min: 12, max: 24 },
      c: { min: 18, max: 48 },
    },
    guard: (p) => {
      if (p.b >= p.c) return false
      const q1 = p.a / p.b
      const q2 = p.a / p.c
      if (!Number.isInteger(q1) || !Number.isInteger(q2)) return false
      if (!noTen(p.b) || !noTen(p.c)) return false
      return q1 >= 2 && q2 >= 2 && q1 <= 12 && q2 <= 12 && q1 % 10 !== 0 && q2 % 10 !== 0
    },
  },
  {
    id: 'u2-c4',
    practice: 'compare',
    template: '{place}甲区每排 {a} {cls}，有 {b} 排；乙区每排 {c} {cls}，有 {d} 排。',
    asks: ['甲区比乙区多多少{cls}？'],
    formulas: ['a*b-c*d'],
    unit: '{cls}',
    sceneTags: ['rowed'],
    slots: {
      a: { min: 12, max: 36 },
      b: { min: 12, max: 24 },
      c: { min: 12, max: 36 },
      d: { min: 12, max: 24 },
    },
    guard: (p) =>
      twoDigit(p.a) &&
      twoDigit(p.b) &&
      twoDigit(p.c) &&
      twoDigit(p.d) &&
      noTen(p.a) &&
      noTen(p.b) &&
      noTen(p.c) &&
      noTen(p.d) &&
      p.a * p.b > p.c * p.d &&
      p.a * p.b <= 1200 &&
      p.c * p.d <= 1200,
  },
  {
    id: 'u2-c5',
    practice: 'compare',
    template: '{place}两个方阵，甲队每排 {a} 人，乙队每排 {c} 人，都站 {b} 排。',
    asks: ['甲队比乙队多多少人？'],
    formulas: ['a*b-c*b'],
    unit: '人',
    sceneTags: ['team'],
    slots: {
      a: { min: 12, max: 45 },
      c: { min: 12, max: 40 },
      b: { min: 12, max: 24 },
    },
    guard: (p) =>
      twoDigit(p.a) && twoDigit(p.b) && twoDigit(p.c) && noTen(p.a) && noTen(p.b) && noTen(p.c) && p.a > p.c && p.a * p.b <= 1600,
  },

  // ---------- 组合与拆分 ----------
  {
    id: 'u2-p1',
    practice: 'compose',
    template: '{person}买 {b} {cls}{item}，每{cls} {a} 元，付了 {c} 元。',
    asks: ['应找回多少元？'],
    formulas: ['c-a*b'],
    unit: '元',
    sceneTags: ['price'],
    slots: {
      a: { min: 12, max: 48 },
      b: { min: 12, max: 24 },
      c: { min: 100, max: 1300 },
    },
    guard: (p) => {
      if (!twoDigit(p.a) || !twoDigit(p.b) || !noTen(p.a) || !noTen(p.b)) return false
      const total = p.a * p.b
      return total <= 1200 && p.c > total && p.c - total <= 60
    },
  },
  {
    id: 'u2-p2',
    practice: 'compose',
    template: '{a} {cls}{item}，每 {b} {cls}装一箱，装了 {c} 箱。',
    asks: ['还剩多少{cls}？'],
    formulas: ['a-b*c'],
    unit: '{cls}',
    sceneTags: ['boxed'],
    slots: {
      a: { min: 100, max: 960 },
      b: { min: 12, max: 48 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => {
      if (!twoDigit(p.b) || !twoDigit(p.c) || !noTen(p.b) || !noTen(p.c)) return false
      const rest = p.a - p.b * p.c
      return rest >= 1 && rest < p.b
    },
  },
  {
    id: 'u2-p3',
    practice: 'compose',
    template: '{person}买 {b} {cls}{item}，每{cls} {a} 元，又买了一个 {c} 元的水壶。',
    asks: ['一共花了多少元？'],
    formulas: ['a*b+c'],
    unit: '元',
    sceneTags: ['price'],
    slots: {
      a: { min: 12, max: 48 },
      b: { min: 12, max: 24 },
      c: { min: 10, max: 48 },
    },
    guard: (p) => twoDigit(p.a) && twoDigit(p.b) && noTen(p.a) && noTen(p.b) && p.a * p.b + p.c <= 1600,
  },
  {
    id: 'u2-p4',
    practice: 'compose',
    template: '{a} {cls}{item}，平均分给 {b} 个班，每班再平均分给 {c} 个组。',
    asks: ['每组多少{cls}？'],
    formulas: ['a/b/c'],
    unit: '{cls}',
    sceneTags: ['class'],
    slots: {
      a: { min: 100, max: 960 },
      b: { min: 12, max: 48 },
      c: { min: 2, max: 5 },
    },
    guard: (p) => divideOk(p.a, p.b, 40) && (p.a / p.b) % p.c === 0 && p.a / p.b / p.c >= 2,
  },
  {
    id: 'u2-p5',
    practice: 'compose',
    template: '{a} 千克{item}，正好装 {b} 箱，每箱卖 {c} 元。',
    asks: ['一共能卖多少元？'],
    formulas: ['a/b*c'],
    unit: '元',
    sceneTags: ['care'],
    slots: {
      a: { min: 100, max: 432 },
      b: { min: 12, max: 45 },
      c: { min: 12, max: 48 },
    },
    guard: (p) => divideOk(p.a, p.b) && twoDigit(p.c) && (p.a / p.b) * p.c <= 600,
  },

  // ---------- 多步合成 ----------
  {
    id: 'u2-m1',
    practice: 'multistep',
    template: '{a} {cls}{item}，每箱装 {b} {cls}。',
    asks: ['能装满多少箱，还剩多少{cls}？'],
    formulas: ['a/b'],
    unit: '箱',
    remainderUnit: '{cls}',
    askModes: ['remainder'],
    sceneTags: ['boxed'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => p.b >= 12 && noTen(p.b) && p.a % p.b !== 0 && Math.floor(p.a / p.b) >= 2 && Math.floor(p.a / p.b) <= 9,
  },
  {
    id: 'u2-m2',
    practice: 'multistep',
    template: '{person}把 {a} 人分组，每 {b} 人一组。',
    asks: ['至少分成多少组？'],
    formulas: ['a/b'],
    unit: '组',
    askModes: ['ceil'],
    sceneTags: ['team'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 45 } },
    guard: (p) => p.b >= 12 && noTen(p.b) && p.a % p.b !== 0 && Math.floor(p.a / p.b) >= 2 && Math.floor(p.a / p.b) <= 9,
  },
  {
    id: 'u2-m3',
    practice: 'multistep',
    template: '{person}带 {a} 元，每{cls}{item} {b} 元。',
    asks: ['最多能买多少{cls}，还剩多少元？'],
    formulas: ['a/b'],
    unit: '{cls}',
    remainderUnit: '元',
    askModes: ['floor'],
    sceneTags: ['price'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => p.b >= 12 && noTen(p.b) && p.a % p.b !== 0 && Math.floor(p.a / p.b) >= 2 && Math.floor(p.a / p.b) <= 9,
  },
  {
    id: 'u2-m4',
    practice: 'multistep',
    template: '{a} 千克{item}，每 {b} 千克装一箱。',
    asks: ['最多能装多少箱，还剩多少千克？'],
    formulas: ['a/b'],
    unit: '箱',
    remainderUnit: '千克',
    askModes: ['floor'],
    sceneTags: ['care'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 45 } },
    guard: (p) => p.b >= 12 && noTen(p.b) && p.a % p.b !== 0 && Math.floor(p.a / p.b) >= 2 && Math.floor(p.a / p.b) <= 9,
  },
  {
    id: 'u2-m5',
    practice: 'multistep',
    template: '{a} {cls}{item}，每盒装 {b} {cls}。',
    asks: ['至少要多少个盒子？'],
    formulas: ['a/b'],
    unit: '个',
    askModes: ['ceil'],
    sceneTags: ['boxed'],
    slots: { a: { min: 100, max: 432 }, b: { min: 12, max: 48 } },
    guard: (p) => p.b >= 12 && noTen(p.b) && p.a % p.b !== 0 && Math.floor(p.a / p.b) >= 2 && Math.floor(p.a / p.b) <= 9,
  },

  // ---------- 判断与验证 ----------
  {
    id: 'u2-j1',
    practice: 'judge',
    template: '{place}开会，{a} 人参加，每排坐 {b} 人，有 {c} 排座位。',
    asks: ['够不够？'],
    formulas: ['a<=b*c'],
    unit: '',
    judge: ['够', '不够'],
    sceneTags: ['hall'],
    slots: {
      a: { min: 100, max: 900 },
      b: { min: 20, max: 45 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => twoDigit(p.b) && twoDigit(p.c) && noTen(p.b) && noTen(p.c) && p.b * p.c <= 1200,
  },
  {
    id: 'u2-j2',
    practice: 'judge',
    template: '{person}带 {a} 元，买 {c} {cls}{item}，每{cls} {b} 元。',
    asks: ['钱够不够？'],
    formulas: ['b*c<=a'],
    unit: '',
    judge: ['够', '不够'],
    sceneTags: ['price'],
    slots: {
      a: { min: 100, max: 1600 },
      b: { min: 12, max: 48 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => twoDigit(p.b) && twoDigit(p.c) && noTen(p.b) && noTen(p.c) && p.b * p.c <= 1600,
  },
  {
    id: 'u2-j3',
    practice: 'judge',
    template: '{person}带 {a} 人去参观，每辆车坐 {b} 人，有 {c} 辆车。',
    asks: ['坐得下吗？'],
    formulas: ['a<=b*c'],
    unit: '',
    judge: ['坐得下', '坐不下'],
    sceneTags: ['team'],
    slots: {
      a: { min: 100, max: 600 },
      b: { min: 20, max: 45 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => twoDigit(p.b) && twoDigit(p.c) && noTen(p.b) && noTen(p.c) && p.b * p.c <= 1152,
  },
  {
    id: 'u2-j4',
    practice: 'judge',
    template: '{a} {cls}{item}，每箱装 {b} {cls}，有 {c} 个箱子。',
    asks: ['箱子够不够？'],
    formulas: ['a<=b*c'],
    unit: '',
    judge: ['够', '不够'],
    sceneTags: ['boxed'],
    slots: {
      a: { min: 100, max: 600 },
      b: { min: 12, max: 48 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => twoDigit(p.b) && twoDigit(p.c) && noTen(p.b) && noTen(p.c) && p.b * p.c <= 1152,
  },
  {
    id: 'u2-j5',
    practice: 'judge',
    template: '{a} 箱{item}，每辆车装 {b} 箱，有 {c} 辆车。',
    asks: ['一次能运完吗？'],
    formulas: ['a<=b*c'],
    unit: '',
    judge: ['能', '不能'],
    sceneTags: ['care'],
    slots: {
      a: { min: 100, max: 600 },
      b: { min: 12, max: 48 },
      c: { min: 12, max: 24 },
    },
    guard: (p) => twoDigit(p.b) && twoDigit(p.c) && noTen(p.b) && noTen(p.c) && p.b * p.c <= 1152,
  },
]
