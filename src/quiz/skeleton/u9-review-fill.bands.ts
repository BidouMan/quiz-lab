/**
 * 3A-U9 复习 · 填空 · 三档
 * 基线（L2）在 u9-review-fill.ts；本文件补 L1（基础复习）与 L3（三步/综合判断）。
 * 口径：长度只用厘米/米/千米，时间只走当天；U1/U2 口吻的题不出现除法。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'
import { elapsedMinutes, febDays, monthDays, yearDays } from './expr.ts'

export const U9_REVIEW_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  // ---------- 基础复习 ----------
  'u9f-d1': {
    L1: band(
      { y: R(2012, 2024) },
      {
        template: '{y} 年 2 月有 ____ 天，这一年全年有 ____ 天。',
        formulas: ['febDays(y)', 'yearDays(y)'],
        unit: '天',
        answerUnits: ['天', '天'],
        guard: () => true,
      },
    ),
    L3: band(
      { y1: R(2010, 2018), y2: R(2016, 2024) },
      {
        template: '{y1} 年二月比 {y2} 年二月少 ____ 天。',
        formulas: ['febDays(y2)-febDays(y1)'],
        unit: '天',
        guard: (p) => febDays(p.y2) > febDays(p.y1),
      },
    ),
  },
  'u9f-d2': {
    L1: band(
      { m: R(1, 6), n: R(7, 12) },
      {
        template: '{m} 月有 ____ 天，{n} 月有 ____ 天。',
        formulas: ['monthDays(m)', 'monthDays(n)'],
        unit: '天',
        answerUnits: ['天', '天'],
        guard: () => true,
      },
    ),
    L3: band(
      { m: R(1, 12) },
      {
        template: '{m} 月有 ____ 天，比 30 天多 ____ 天。',
        formulas: ['monthDays(m)', 'monthDays(m)-30'],
        unit: '天',
        answerUnits: ['天', '天'],
        guard: (p) => monthDays(p.m) > 30,
      },
    ),
  },
  'u9f-d3': {
    L1: band(
      { y: R(2014, 2030) },
      {
        template: '{y} 年有 ____ 个月，31 天的月份有 ____ 个。',
        formulas: ['12', '7'],
        unit: '个',
        answerUnits: ['个', '个'],
        guard: () => true,
      },
    ),
    L3: band(
      { y: R(2012, 2024) },
      {
        template: '{y} 年全年有 ____ 天，比平年多 ____ 天。',
        formulas: ['yearDays(y)', 'yearDays(y)-365'],
        unit: '天',
        answerUnits: ['天', '天'],
        guard: (p) => yearDays(p.y) > 365,
      },
    ),
  },
  'u9f-d4': {
    L1: band(
      { a: R(8, 16, 2), b: R(3, 7) },
      {
        template: '{person}的长方形纸片长 {a} 厘米、宽 {b} 厘米，两条长边共 ____ 厘米。',
        formulas: ['2*a'],
        unit: '厘米',
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(8, 16, 2), b: R(3, 7) },
      {
        template: '{person}的长方形纸片长 {a} 厘米、宽 {b} 厘米，围一圈 ____ 厘米；长宽各加 1，新周长 ____ 厘米。',
        formulas: ['(a+b)*2', '(a+b+2)*2'],
        unit: '厘米',
        answerUnits: ['厘米', '厘米'],
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u9f-d5': {
    L1: band(
      { a: R(12, 48, 6), b: R(3, 8) },
      {
        template: '{person}每盒 {a} 支笔，{b} 盒共 ____ 支。',
        formulas: ['a*b'],
        unit: '支',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(12, 48, 6), b: R(3, 8), c: R(6, 30, 6) },
      {
        template: '{person}每盒 {a} 支笔，买 {b} 盒，送出 {c} 支，还剩 ____ 支。',
        formulas: ['a*b-c'],
        unit: '支',
        guard: (p) => p.a * p.b > p.c,
      },
    ),
  },
  'u9f-d6': {
    L1: band(
      { a: R(24, 96, 12), b: R(3, 8) },
      {
        template: '{person}把 {a} 块橡皮每 {b} 块装一盒，能装 ____ 盒。',
        formulas: ['a/b'],
        unit: '盒',
        guard: (p) => p.a % p.b === 0,
      },
    ),
    L3: band(
      { a: R(60, 120, 12), b: R(4, 9) },
      {
        template: '{person}把 {a} 块橡皮平均放进 {b} 盒，每盒 ____ 块，还剩 ____ 块。',
        formulas: ['quotientOf(a,b)', 'remainderOf(a,b)'],
        unit: '',
        answerUnits: ['块', '块'],
        guard: (p) => p.a > p.b && p.a % p.b !== 0,
      },
    ),
  },

  // ---------- 逆向复习 ----------
  'u9f-i1': {
    L1: band(
      { a: R(6, 15) },
      {
        template: '正方形边长 {a} 厘米，围一圈 ____ 厘米。',
        formulas: ['4*a'],
        unit: '厘米',
        guard: () => true,
      },
    ),
    L3: band(
      { p: R(24, 60, 4), c: R(1, 4) },
      {
        template: '正方形围一圈 {p} 厘米，边长 ____ 厘米；边长再加 {c} 厘米，新周长 ____ 厘米。',
        formulas: ['p/4', '(p/4+c)*4'],
        unit: '厘米',
        answerUnits: ['厘米', '厘米'],
        guard: () => true,
      },
    ),
  },
  'u9f-i2': {
    L1: band(
      { a: R(10, 22, 2), b: R(3, 8) },
      {
        template: '长方形长 {a} 厘米、宽 {b} 厘米，两条宽边共 ____ 厘米。',
        formulas: ['2*b'],
        unit: '厘米',
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { p: R(30, 60, 2), a: R(10, 22, 2) },
      {
        template: '长方形围一圈 {p} 厘米，长 {a} 厘米，宽 ____ 厘米，宽比长少 ____ 厘米。',
        formulas: ['p/2-a', 'a-(p/2-a)'],
        unit: '厘米',
        answerUnits: ['厘米', '厘米'],
        guard: (p) => p.p / 2 > p.a && 2 * p.a > p.p / 2,
      },
    ),
  },
  'u9f-i3': {
    L1: band(
      { h: R(8, 15), m: R(0, 50, 10), n: R(10, 50, 10) },
      {
        template: '{person} {h} 时 {m} 分开始看动画片，经过 {n} 分钟，结束是 ____ 时 ____ 分。',
        formulas: ['hourOf(h*60+m+n)', 'minuteOf(h*60+m+n)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h * 60 + p.m + p.n < 18 * 60 && (p.h * 60 + p.m + p.n) % 60 !== 0 && p.m !== 0,
      },
    ),
    L3: band(
      { h1: R(8, 15), m1: R(0, 50, 10), h2: R(10, 17), m2: R(0, 50, 10), r: R(5, 25, 5) },
      {
        template: '{person}看动画片 {h1} 时 {m1} 分开始，{h2} 时 {m2} 分结束，中途休息 {r} 分钟，实际用 ____ 分钟。',
        formulas: ['elapsedMinutes(h1,m1,h2,m2)-r'],
        unit: '分钟',
        answerUnits: ['分钟'],
        guard: (p) => p.m1 !== 0 && p.m2 !== 0 && elapsedMinutes(p.h1, p.m1, p.h2, p.m2) > p.r + 5,
      },
    ),
  },
  'u9f-i4': {
    L1: band(
      { h: R(9, 17), m: R(0, 50, 10), n: R(10, 50, 10) },
      {
        template: '{person}做手工 {h} 时 {m} 分结束，用了 {n} 分钟，开始是 ____ 时 ____ 分。',
        formulas: ['hourOf(h*60+m-n)', 'minuteOf(h*60+m-n)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h * 60 + p.m - p.n >= 8 * 60 && (p.h * 60 + p.m - p.n) % 60 !== 0 && p.m !== 0,
      },
    ),
    L3: band(
      { h2: R(10, 17), m2: R(0, 50, 10), n: R(20, 60, 10), r: R(5, 20, 5) },
      {
        template: '{person}做手工 {h2} 时 {m2} 分结束，先做 {n} 分钟，休息 {r} 分钟，开始是 ____ 时 ____ 分。',
        formulas: ['hourOf(h2*60+m2-n-r)', 'minuteOf(h2*60+m2-n-r)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h2 * 60 + p.m2 - p.n - p.r >= 8 * 60 && (p.h2 * 60 + p.m2 - p.n - p.r) % 60 !== 0 && p.m2 !== 0,
      },
    ),
  },
  'u9f-i5': {
    L1: band(
      { a: R(12, 48, 6), b: R(5, 30, 5) },
      {
        template: '{person}有一些苹果，送出 {a} 个，还剩 {b} 个，原来有 ____ 个。',
        formulas: ['a+b'],
        unit: '个',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(12, 48, 6), b: R(5, 30, 5), c: R(50, 90, 10) },
      {
        template: '{person}有一些苹果，送出 {a} 个，又买 {b} 个，现在 {c} 个，原来有 ____ 个。',
        formulas: ['c+a-b'],
        unit: '个',
        guard: (p) => p.c + p.a > p.b,
      },
    ),
  },
  'u9f-i6': {
    L1: band(
      { a: R(2, 6) },
      {
        template: '{a} 千米合 ____ 米。',
        formulas: ['a*1000'],
        unit: '米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      {
        template: '{a} 千米 {b} 米，比 2 千米少 ____ 米。',
        formulas: ['2000-(a*1000+b)'],
        unit: '米',
        guard: (p) => p.a * 1000 + p.b < 2000,
      },
    ),
  },

  // ---------- 比较 ----------
  'u9f-c1': {
    L1: band(
      { a: R(9, 16), b: R(3, 8) },
      {
        template: '甲正方形边长 {a} 厘米，乙正方形边长 {b} 厘米，围一圈相差 ____ 厘米。',
        formulas: ['4*(a-b)'],
        unit: '厘米',
        guard: (p) => p.a > p.b,
      },
    ),
    L3: band(
      { p: R(24, 60, 4), a: R(8, 16, 2) },
      {
        template: '{p} 厘米铁丝围正方形和长方形，长方形长 {a} 厘米，宽 ____ 厘米，正方形边长 ____ 厘米。',
        formulas: ['p/2-a', 'p/4'],
        unit: '厘米',
        answerUnits: ['厘米', '厘米'],
        guard: (p) => p.p / 2 > p.a && p.p < 4 * p.a && p.p % 4 === 0,
      },
    ),
  },
  'u9f-c2': {
    L1: band(
      { y1: R(2010, 2016), y2: R(2017, 2023) },
      {
        template: '{y1} 年和 {y2} 年的二月共有 ____ 天。',
        formulas: ['febDays(y1)+febDays(y2)'],
        unit: '天',
        guard: () => true,
      },
    ),
    L3: band(
      { y1: R(2010, 2018), y2: R(2016, 2024) },
      {
        template: '{y1} 年和 {y2} 年的二月相差 ____ 天（{y1} 较早）。',
        formulas: ['febDays(y2)-febDays(y1)'],
        unit: '天',
        guard: (p) => febDays(p.y2) > febDays(p.y1),
      },
    ),
  },
  'u9f-c3': {
    L1: band(
      { a: R(2, 4), c: R(3, 8), b: R(5, 8) },
      {
        template: '{person}买 {a} 本笔记本，每本 {c} 元；买 {b} 本同样的，第二次多花 ____ 元。',
        formulas: ['(b-a)*c'],
        unit: '元',
        guard: (p) => p.b > p.a,
      },
    ),
    L3: band(
      { a: R(2, 6), c: R(3, 8), b: R(7, 12) },
      {
        template: '{person}第一次买 {a} 本笔记本，第二次买 {b} 本，每本 {c} 元，两次共花 ____ 元。',
        formulas: ['(a+b)*c'],
        unit: '元',
        guard: () => true,
      },
    ),
  },
  'u9f-c4': {
    L1: band(
      { n1: R(20, 60, 5), n2: R(20, 60, 5) },
      {
        template: '{person}做手工第一次用 {n1} 分钟，第二次用 {n2} 分钟，两次共 ____ 分钟。',
        formulas: ['n1+n2'],
        unit: '分钟',
        guard: () => true,
      },
    ),
    L3: band(
      { n1: R(30, 60, 5), n2: R(5, 20, 5), n3: R(10, 30, 5) },
      {
        template: '{person}做手工第一次用 {n1} 分钟，第二次少 {n2} 分钟，第三次用 {n3} 分钟，三次共 ____ 分钟。',
        formulas: ['2*n1-n2+n3'],
        unit: '分钟',
        guard: (p) => p.n2 < p.n1,
      },
    ),
  },
  'u9f-c5': {
    L1: band(
      { a: R(300, 700, 50), b: R(750, 1100, 50) },
      {
        template: '{person}上学走 {a} 米，绕路走 {b} 米，绕路多走 ____ 米。',
        formulas: ['b-a'],
        unit: '米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(300, 700, 50), b: R(750, 1100, 50) },
      {
        template: '{person}上学走 {a} 米，绕路走 {b} 米，往返各一次，共走 ____ 米。',
        formulas: ['2*(a+b)'],
        unit: '米',
        guard: () => true,
      },
    ),
  },
  'u9f-c6': {
    L1: band(
      { a: R(9, 16), b: R(3, 8) },
      {
        template: '两个正方形边长 {a} 厘米、{b} 厘米，围一圈共 ____ 厘米。',
        formulas: ['4*(a+b)'],
        unit: '厘米',
        guard: (p) => p.a > p.b,
      },
    ),
    L3: band(
      { a: R(9, 16), b: R(3, 8) },
      {
        template: '两个正方形边长 {a} 厘米、{b} 厘米，边长都加 1 厘米，围一圈共 ____ 厘米。',
        formulas: ['4*(a+1)+4*(b+1)'],
        unit: '厘米',
        guard: (p) => p.a > p.b,
      },
    ),
  },

  // ---------- 两单元组合 ----------
  'u9f-p1': {
    L1: band(
      { a: R(3, 8), c: R(2, 6) },
      {
        template: '{person}买 {a} 支彩笔，每支 {c} 元，共 ____ 元。',
        formulas: ['a*c'],
        unit: '元',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(3, 8), c: R(2, 6), t: R(20, 60, 10) },
      {
        template: '{person}买 {a} 支彩笔，每支 {c} 元，付 {t} 元，找回 ____ 元。',
        formulas: ['t-a*c'],
        unit: '元',
        guard: (p) => p.t > p.a * p.c,
      },
    ),
  },
  'u9f-p2': {
    L1: band(
      { a: R(8, 14, 2), b: R(4, 7) },
      {
        template: '{person}给一块长方形菜地围篱笆，长 {a} 米、宽 {b} 米，共 ____ 米。',
        formulas: ['(a+b)*2'],
        unit: '米',
        guard: (p) => p.b < p.a,
      },
    ),
    L3: band(
      { a: R(8, 14, 2), b: R(4, 7), c: R(2, 8) },
      {
        template: '{person}围一块长方形菜地，长 {a} 米、宽 {b} 米，每米 {c} 元，再留 1 米门，可少付 ____ 元。',
        formulas: ['c'],
        unit: '元',
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u9f-p3': {
    L1: band(
      { h: R(8, 15), n: R(10, 50, 10) },
      {
        template: '{person} {h} 时开始做手工，经过 {n} 分钟，结束是 ____ 时 ____ 分。',
        formulas: ['hourOf(h*60+n)', 'minuteOf(h*60+n)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h * 60 + p.n < 18 * 60 && (p.h * 60 + p.n) % 60 !== 0,
      },
    ),
    L3: band(
      { h1: R(8, 14), m1: R(0, 40, 10), n: R(10, 40, 10), r: R(5, 20, 5), s: R(10, 30, 10) },
      {
        template: '{person} {h1} 时 {m1} 分开始，先做 {n} 分钟，休息 {r} 分钟，再做 {s} 分钟，结束 ____ 时 ____ 分。',
        formulas: ['hourOf(h1*60+m1+n+r+s)', 'minuteOf(h1*60+m1+n+r+s)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h1 * 60 + p.m1 + p.n + p.r + p.s < 18 * 60 && (p.h1 * 60 + p.m1 + p.n + p.r + p.s) % 60 !== 0 && p.m1 !== 0,
      },
    ),
  },
  'u9f-p4': {
    L1: band(
      { a: R(25, 90), b: R(4, 9) },
      {
        template: '{person}有 {a} 块橡皮，每 {b} 块装一盒，能装 ____ 盒。',
        formulas: ['a/b'],
        unit: '盒',
        guard: (p) => p.a % p.b === 0,
      },
    ),
    L3: band(
      { a: R(25, 90), b: R(4, 9) },
      {
        template: '{person}有 {a} 块橡皮，每 {b} 块装一盒，装满 ____ 盒，还剩 ____ 块。',
        formulas: ['quotientOf(a,b)', 'remainderOf(a,b)'],
        unit: '',
        answerUnits: ['盒', '块'],
        guard: (p) => p.a > p.b && p.a % p.b !== 0,
      },
    ),
  },
  'u9f-p5': {
    L1: band(
      { a: R(2, 5), b: R(100, 800, 100) },
      {
        template: '{a} 千米 {b} 米合 ____ 米。',
        formulas: ['a*1000+b'],
        unit: '米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(1, 4), b: R(100, 700, 100), c: R(120, 400, 60) },
      {
        template: '{person}走了 {a} 千米 {b} 米，又走 {c} 米，共 ____ 米；再走 ____ 米到 2 千米。',
        formulas: ['a*1000+b+c', '2000-(a*1000+b+c)'],
        unit: '米',
        answerUnits: ['米', '米'],
        guard: (p) => p.a * 1000 + p.b + p.c < 2000,
      },
    ),
  },
  'u9f-p6': {
    L1: band(
      { m1: R(1, 5), d1: R(1, 15), m2: R(6, 9), d2: R(1, 20) },
      {
        template: '从 {m1} 月 {d1} 日到 {m2} 月 {d2} 日，共 ____ 天。',
        formulas: ['daysBetween(m1,d1,m2,d2)'],
        unit: '天',
        guard: (p) => p.m2 > p.m1,
      },
    ),
    L3: band(
      { m1: R(1, 4), d1: R(1, 12), m2: R(5, 8), d2: R(1, 15), p: R(2, 8) },
      {
        template: '从 {m1} 月 {d1} 日到 {m2} 月 {d2} 日共 ____ 天；每天读 {p} 页，共读 ____ 页。',
        formulas: ['daysBetween(m1,d1,m2,d2)', 'daysBetween(m1,d1,m2,d2)*p'],
        unit: '天',
        answerUnits: ['天', '页'],
        guard: (p) => p.m2 > p.m1,
      },
    ),
  },

  // ---------- 三步综合 ----------
  'u9f-m1': {
    L1: band(
      { a: R(12, 48, 6), b: R(2, 8) },
      {
        template: '{person}有 {a} 块橡皮，平均分给 {b} 人，每人 ____ 块。',
        formulas: ['a/b'],
        unit: '块',
        guard: (p) => p.a % p.b === 0,
      },
    ),
    L3: band(
      { a: R(2, 6), b: R(4, 9), c: R(3, 8) },
      {
        template: '{person}买 {a} 盒彩笔，每盒 {b} 支，分给 {c} 人，每人 ____ 支，还剩 ____ 支。',
        formulas: ['quotientOf(a*b,c)', 'remainderOf(a*b,c)'],
        unit: '',
        answerUnits: ['支', '支'],
        guard: (p) => p.a * p.b > p.c && (p.a * p.b) % p.c !== 0,
      },
    ),
  },
  'u9f-m2': {
    L1: band(
      { a: R(3, 12), b: R(4, 20) },
      {
        template: '{person}先买 {a} 个，再买 {b} 个，共 ____ 个。',
        formulas: ['a+b'],
        unit: '个',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(8, 14, 2), b: R(4, 7), c: R(2, 8) },
      {
        template: '{person}围一块长方形菜地，长 {a} 米、宽 {b} 米，每米 {c} 元，围两圈要 ____ 元。',
        formulas: ['(a+b)*2*c*2'],
        unit: '元',
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u9f-m3': {
    L1: band(
      { h: R(8, 15), n: R(10, 40, 10) },
      {
        template: '{person} {h} 时出发，走 {n} 分钟到{place}，到达 ____ 时 ____ 分。',
        formulas: ['hourOf(h*60+n)', 'minuteOf(h*60+n)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h * 60 + p.n < 18 * 60 && (p.h * 60 + p.n) % 60 !== 0,
      },
    ),
    L3: band(
      { h1: R(8, 13), m1: R(0, 40, 10), n: R(10, 30, 10), r: R(20, 50, 10), d: R(5, 15, 5) },
      {
        template: '{person} {h1} 时 {m1} 分出发，到{place}用 {n} 分钟，办事 {r} 分钟，回程多 {d} 分钟，到家 ____ 时 ____ 分。',
        formulas: ['hourOf(h1*60+m1+n+r+n+d)', 'minuteOf(h1*60+m1+n+r+n+d)'],
        unit: '时',
        answerUnits: ['时', '分'],
        guard: (p) => p.h1 * 60 + p.m1 + 2 * p.n + p.r + p.d < 18 * 60 && (p.h1 * 60 + p.m1 + 2 * p.n + p.r + p.d) % 60 !== 0 && p.m1 !== 0,
      },
    ),
  },
  'u9f-m4': {
    L1: band(
      { a: R(20, 60, 10), b: R(3, 12) },
      {
        template: '{person}有 {a} 元，买一个 {b} 元的文具盒，还剩 ____ 元。',
        formulas: ['a-b'],
        unit: '元',
        guard: (p) => p.a > p.b,
      },
    ),
    L3: band(
      { a: R(50, 100, 10), b: R(3, 8), c: R(4, 9) },
      {
        template: '{person}有 {a} 元，买 {b} 本笔记本，每本 {c} 元，还剩 ____ 元；再买 1 本剩 ____ 元。',
        formulas: ['a-b*c', 'a-b*c-c'],
        unit: '元',
        answerUnits: ['元', '元'],
        guard: (p) => p.a > p.b * p.c + p.c,
      },
    ),
  },
  'u9f-m5': {
    L1: band(
      { a: R(24, 72, 12), b: R(3, 8) },
      {
        template: '{person}把 {a} 块橡皮平均装进 {b} 盒，每盒 ____ 块。',
        formulas: ['a/b'],
        unit: '块',
        guard: (p) => p.a % p.b === 0,
      },
    ),
    L3: band(
      { a: R(20, 60, 10), n: R(2, 6), r: R(3, 9) },
      {
        template: '{person}每天读 {a} 页，{n} 天读完，还剩 {r} 页，这本书共 ____ 页，已读 ____ 页。',
        formulas: ['a*n+r', 'a*n'],
        unit: '页',
        answerUnits: ['页', '页'],
        guard: () => true,
      },
    ),
  },
  'u9f-m6': {
    L1: band(
      { m: R(2, 9) },
      {
        template: '一个月 30 天，{m} 个月共 ____ 天。',
        formulas: ['30*m'],
        unit: '天',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(365, 365), b: R(366, 366) },
      {
        template: '平年全年 {a} 天，闰年比平年多 ____ 天，两个平年共 ____ 天。',
        formulas: ['b-a', '2*a'],
        unit: '天',
        answerUnits: ['天', '天'],
        guard: () => true,
      },
    ),
  },
}
