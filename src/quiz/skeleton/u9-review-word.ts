/**
 * 3A-U9 复习 · 应用题（基线档 = L2：跨单元两到三步）
 * 全册综合复习：每题至少融合两个知识点，知识点全部来自 3A 已学范围。
 * 30 条骨架，5 类做法各 6 条；L1（基础复习，数值收窄）与 L3（综合提高，数值放大）在 .bands.ts。
 *
 * 口径：
 * - 长度只用厘米/米/千米；时间只走当天，结果落在 8:00–18:00。
 * - 涉及 U1（两步四则）/U2（一位数乘）的题一律不出现除法；除法只出现在 U4 为知识点之一的题里。
 * - 每题融合的两个知识点写在注释里，供复核对照。
 */
import type { Skeleton } from './types.ts'

export const U9_REVIEW_WORD_SKELETONS: Skeleton[] = [
  // ---------- 直接求（两个知识点各取一条） ----------
  {
    id: 'u9w-d1',
    practice: 'direct',
    // 长方形周长（U6）+ 每米价钱（U2）
    template: '{person}给一块长方形花坛围一圈篱笆，长 {a} 米、宽 {b} 米，每米 {c} 元。',
    asks: ['篱笆共多少元？'],
    formulas: ['(a+b)*2*c'],
    unit: '元',
    slots: { a: { min: 10, max: 40, step: 2 }, b: { min: 4, max: 12 }, c: { min: 2, max: 8 } },
    guard: (p) => p.b < p.a - 2 && (p.a + p.b) * 2 * p.c <= 900,
    workLines: 4,
  },
  {
    id: 'u9w-d2',
    practice: 'direct',
    // 4 月有 30 天（U5）+ 一位数乘（U2）
    template: '{person} 4 月每天读 {a} 页课外书。',
    asks: ['4 月共读多少页？'],
    formulas: ['30*a'],
    unit: '页',
    slots: { a: { min: 3, max: 9 } },
    workLines: 2,
  },
  {
    id: 'u9w-d3',
    practice: 'direct',
    // 千米与米换算（U7）+ 加法（U1）
    template: '{person}上午走 {a} 千米 {b} 米，下午走 {c} 米。',
    asks: ['一天共走多少米？'],
    formulas: ['a*1000+b+c'],
    unit: '米',
    slots: {
      a: { min: 2, max: 5 },
      b: { min: 100, max: 900, step: 100 },
      c: { min: 100, max: 800, step: 50 },
    },
    workLines: 4,
  },
  {
    id: 'u9w-d4',
    practice: 'direct',
    // 七巧板三角形（U8）+ 一位数除（U4）
    template: '{person}有 {a} 块三角形七巧板，每 2 块拼 1 个正方形。',
    asks: ['能拼几个正方形？'],
    formulas: ['a/2'],
    unit: '个',
    slots: { a: { min: 10, max: 20, step: 2 } },
    workLines: 2,
  },
  {
    id: 'u9w-d5',
    practice: 'direct',
    // 经过时间（U5）+ 加法（U1）
    template: '{person} {h} 时 {m} 分开始做手工，做了 {n} 分钟。',
    asks: ['几时几分结束？'],
    formulas: ['hourOf(h*60+m+n)', 'minuteOf(h*60+m+n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h: { min: 8, max: 15 },
      m: { min: 0, max: 55, step: 5 },
      n: { min: 20, max: 90, step: 10 },
    },
    guard: (p) => {
      const end = p.h * 60 + p.m + p.n
      return end <= 18 * 60 && end % 60 !== 0
    },
    workLines: 2,
  },
  {
    id: 'u9w-d6',
    practice: 'direct',
    // 找规律（U8）+ 乘加（U2）
    template: '按 4、7、10…的规律连排摆正方形，第 {n} 个。',
    asks: ['要用多少根小棒？'],
    formulas: ['3*n+1'],
    unit: '根',
    slots: { n: { min: 21, max: 27 } },
    workLines: 2,
  },

  // ---------- 逆向求 ----------
  {
    id: 'u9w-i1',
    practice: 'inverse',
    // 正方形周长（U6）+ 一位数除（U4）
    template: '{person}用 {p} 厘米长的铁丝正好围成一个正方形。',
    asks: ['边长多少厘米？'],
    formulas: ['p/4'],
    unit: '厘米',
    slots: { p: { min: 28, max: 40, step: 4 } },
    workLines: 2,
  },
  {
    id: 'u9w-i2',
    practice: 'inverse',
    // 长方形周长（U6）+ 减法逆推（U1）
    template: '一个长方形相框围一圈是 {p} 厘米，长 {a} 厘米。',
    asks: ['宽多少厘米？'],
    formulas: ['p/2-a'],
    unit: '厘米',
    slots: { p: { min: 30, max: 100, step: 2 }, a: { min: 8, max: 30, step: 2 } },
    guard: (p) => p.p / 2 > p.a + 2 && p.p / 2 - p.a < p.a - 2,
    workLines: 2,
  },
  {
    id: 'u9w-i3',
    practice: 'inverse',
    // 千米与米（U7）+ 减法（U1）
    template: '{person}从家到{place}全程 {a} 千米，已经走了 {b} 米。',
    asks: ['还剩多少米？'],
    formulas: ['a*1000-b'],
    unit: '米',
    slots: { a: { min: 2, max: 6 }, b: { min: 200, max: 900, step: 100 } },
    guard: (p) => p.a * 1000 > p.b + 100,
    workLines: 2,
  },
  {
    id: 'u9w-i4',
    practice: 'inverse',
    // 经过时间（U5）+ 减法逆推（U1）
    template: '{person} {h2} 时 {m2} 分做完作业，一共用了 {n} 分钟。',
    asks: ['几时几分开始？'],
    formulas: ['hourOf(h2*60+m2-n)', 'minuteOf(h2*60+m2-n)'],
    unit: '',
    answerUnits: ['时', '分'],
    slots: {
      h2: { min: 10, max: 17 },
      m2: { min: 5, max: 55, step: 5 },
      n: { min: 20, max: 90, step: 10 },
    },
    guard: (p) => {
      const start = p.h2 * 60 + p.m2 - p.n
      return start >= 8 * 60 && start % 60 !== 0
    },
    workLines: 2,
  },
  {
    id: 'u9w-i5',
    practice: 'inverse',
    // 一位数除（U4）+ 先减后分（U1）
    template: '{person}有 {a} 个{item}，送出 {b} 个，剩下的平均分给 {c} 人。',
    asks: ['每人分多少个？'],
    formulas: ['(a-b)/c'],
    unit: '个',
    slots: {
      a: { min: 40, max: 90, step: 5 },
      b: { min: 5, max: 20, step: 5 },
      c: { min: 3, max: 8 },
    },
    guard: (p) => p.a > p.b + p.c && (p.a - p.b) % p.c === 0,
    workLines: 6,
  },
  {
    id: 'u9w-i6',
    practice: 'inverse',
    // 年月日（U5）+ 减法与一位数乘（U1/U2）
    template: '从 5 月 {d1} 日到 5 月 {d2} 日，{person}每天折 {a} 只纸鹤。',
    asks: ['一共折多少只？'],
    formulas: ['(d2-d1+1)*a'],
    unit: '只',
    slots: {
      d1: { min: 1, max: 12 },
      d2: { min: 20, max: 28 },
      a: { min: 3, max: 9 },
    },
    guard: (p) => p.d2 > p.d1 && (p.d2 - p.d1 + 1) * p.a <= 1000,
    workLines: 4,
  },

  // ---------- 比较 ----------
  {
    id: 'u9w-c1',
    practice: 'compare',
    // 长方形周长（U6）+ 比较（U1）
    template: '甲长方形长 {a} 厘米、宽 {b} 厘米，乙长方形长 {c} 厘米、宽 {d} 厘米。',
    asks: ['甲的周长比乙多多少厘米？'],
    formulas: ['(a+b)*2-(c+d)*2'],
    unit: '厘米',
    slots: {
      a: { min: 10, max: 20, step: 2 },
      b: { min: 3, max: 8 },
      c: { min: 4, max: 9 },
      d: { min: 2, max: 5 },
    },
    guard: (p) => p.a > p.b + 2 && p.c > p.d + 2 && (p.a + p.b) > p.c + p.d + 2,
    workLines: 6,
  },
  {
    id: 'u9w-c2',
    practice: 'compare',
    // 单价乘数量（U2）+ 比较（U1）
    template: '第一种笔记本每本 {c} 元，买 {a} 本；第二种每本 {d} 元，买 {b} 本。',
    asks: ['第一种比第二种多花多少元？'],
    formulas: ['a*c-b*d'],
    unit: '元',
    slots: {
      a: { min: 4, max: 8 },
      c: { min: 4, max: 9 },
      b: { min: 2, max: 4 },
      d: { min: 3, max: 6 },
    },
    guard: (p) => p.a * p.c > p.b * p.d + 5,
    workLines: 6,
  },
  {
    id: 'u9w-c3',
    practice: 'compare',
    // 经过时间（U5）+ 求和与比较（U1）
    template: '第一次活动 {n1} 分钟，第二次活动 {n2} 分钟。',
    asks: ['两次一共多少分钟？', '第二次比第一次多多少分钟？'],
    formulas: ['n1+n2', 'n2-n1'],
    unit: '分钟',
    slots: { n1: { min: 20, max: 60, step: 5 }, n2: { min: 20, max: 90, step: 5 } },
    guard: (p) => p.n2 > p.n1 + 10,
    workLines: 4,
  },
  {
    id: 'u9w-c4',
    practice: 'compare',
    // 千米与米（U7）+ 比较（U1）
    template: '走路线一用 {a} 千米 {b} 米，走路线二用 {c} 米。',
    asks: ['路线二比路线一少走多少米？'],
    formulas: ['a*1000+b-c'],
    unit: '米',
    slots: {
      a: { min: 2, max: 5 },
      b: { min: 200, max: 900, step: 100 },
      c: { min: 300, max: 1200, step: 50 },
    },
    guard: (p) => p.a * 1000 + p.b > p.c + 100,
    workLines: 4,
  },
  {
    id: 'u9w-c5',
    practice: 'compare',
    // 七巧板（U8）+ 一位数除与比较（U4/U1）
    template: '甲有 {a} 块三角形，乙有 {c} 块三角形，每 2 块拼 1 个正方形。',
    asks: ['甲比乙多拼几个正方形？'],
    formulas: ['(a-c)/2'],
    unit: '个',
    slots: { a: { min: 30, max: 60, step: 2 }, c: { min: 10, max: 20, step: 2 } },
    guard: (p) => p.a > p.c + 2,
    workLines: 4,
  },
  {
    id: 'u9w-c6',
    practice: 'compare',
    // 平年/闰年 2 月（U5）+ 一位数乘（U2）
    template: '闰年 2 月 29 天，平年 2 月 28 天，{person}每天写 {a} 个字。',
    asks: ['两年 2 月共写多少个字？'],
    formulas: ['57*a'],
    unit: '个',
    slots: { a: { min: 41, max: 47 } },
    workLines: 2,
  },

  // ---------- 组合与拆分 ----------
  {
    id: 'u9w-p1',
    practice: 'compose',
    // 长方形周长（U6）+ 单价（U2）+ 找零（U1）
    template: '长方形花坛长 {a} 米、宽 {b} 米，围篱笆每米 {c} 元，付 {t} 元。',
    asks: ['找回多少元？'],
    formulas: ['t-(a+b)*2*c'],
    unit: '元',
    slots: {
      a: { min: 8, max: 16, step: 2 },
      b: { min: 3, max: 7 },
      c: { min: 2, max: 5 },
      t: { min: 150, max: 300, step: 10 },
    },
    guard: (p) => p.t > (p.a + p.b) * 2 * p.c && p.t - (p.a + p.b) * 2 * p.c <= 200,
    workLines: 6,
  },
  {
    id: 'u9w-p2',
    practice: 'compose',
    // 千米与米（U7）+ 一位数乘（U2）
    template: '{person}每天走 {a} 千米 {b} 米，连续走 3 天。',
    asks: ['3 天共走多少米？'],
    formulas: ['(a*1000+b)*3'],
    unit: '米',
    slots: { a: { min: 1, max: 2 }, b: { min: 300, max: 700, step: 100 } },
    workLines: 4,
  },
  {
    id: 'u9w-p3',
    practice: 'compose',
    // 七巧板（U8）+ 一位数乘与减法（U2/U1）
    template: '每副七巧板 7 块，{person}有 {a} 副，用掉 {b} 块。',
    asks: ['还剩多少块？'],
    formulas: ['7*a-b'],
    unit: '块',
    slots: { a: { min: 3, max: 8 }, b: { min: 5, max: 20, step: 5 } },
    guard: (p) => 7 * p.a > p.b + 5,
    workLines: 4,
  },
  {
    id: 'u9w-p4',
    practice: 'compose',
    // 年月日（U5）+ 一位数乘（U2）
    template: '从 6 月 {d1} 日到 6 月 {d2} 日，{person}每天读 {n} 分钟。',
    asks: ['一共读多少分钟？'],
    formulas: ['(d2-d1+1)*n'],
    unit: '分钟',
    slots: {
      d1: { min: 1, max: 10 },
      d2: { min: 15, max: 28 },
      n: { min: 10, max: 30, step: 10 },
    },
    guard: (p) => p.d2 > p.d1,
    workLines: 4,
  },
  {
    id: 'u9w-p5',
    practice: 'compose',
    // 一位数除（U4）+ 加法（U1）
    template: '{person}把 {a} 块糖果平均分给 {b} 人，每人又多吃 {c} 块。',
    asks: ['每人一共吃多少块？'],
    formulas: ['a/b+c'],
    unit: '块',
    slots: {
      a: { min: 24, max: 60, step: 6 },
      b: { min: 3, max: 6 },
      c: { min: 2, max: 5 },
    },
    guard: (p) => p.a % p.b === 0,
    workLines: 4,
  },
  {
    id: 'u9w-p6',
    practice: 'compose',
    // 找规律（U8）+ 有余数除法（U4）
    template: '{person}用 {n} 根小棒连排摆正方形。',
    asks: ['最多摆几个？', '还剩几根？'],
    formulas: ['quotientOf(n-1,3)', 'remainderOf(n-1,3)'],
    unit: '',
    answerUnits: ['个', '根'],
    slots: { n: { min: 48, max: 53 } },
    guard: (p) => (p.n - 1) % 3 !== 0,
    workLines: 2,
  },

  // ---------- 多步综合 ----------
  {
    id: 'u9w-m1',
    practice: 'multistep',
    // 长方形周长（U6）+ 留门减法（U1）+ 单价（U2）
    template: '长方形花坛长 {a} 米、宽 {b} 米，留 {c} 米宽的门，篱笆每米 {d} 元。',
    asks: ['篱笆共多少元？'],
    formulas: ['((a+b)*2-c)*d'],
    unit: '元',
    slots: {
      a: { min: 8, max: 16, step: 2 },
      b: { min: 3, max: 7 },
      c: { min: 1, max: 3 },
      d: { min: 2, max: 6 },
    },
    guard: (p) => (p.a + p.b) * 2 > p.c + 2,
    workLines: 6,
  },
  {
    id: 'u9w-m2',
    practice: 'multistep',
    // 经过时间（U5）+ 一位数乘与加法（U2/U1）
    template: '{person}每天读 {a} 分钟，一周读 7 天，又读了 {b} 分钟。',
    asks: ['一共读多少分钟？'],
    formulas: ['7*a+b'],
    unit: '分钟',
    slots: { a: { min: 15, max: 30, step: 5 }, b: { min: 20, max: 60, step: 10 } },
    workLines: 4,
  },
  {
    id: 'u9w-m3',
    practice: 'multistep',
    // 千米与米（U7）+ 一位数乘（U2）
    template: '从家到{place}是 {a} 千米 {b} 米，{person}每天往返一次。',
    asks: ['每天走多少米？'],
    formulas: ['(a*1000+b)*2'],
    unit: '米',
    slots: {
      a: { min: 1, max: 3 },
      b: { min: 100, max: 800, step: 100 },
    },
    workLines: 4,
  },
  {
    id: 'u9w-m4',
    practice: 'multistep',
    // 有余数除法（U4）+ 取整与剩余（U8 最值）
    template: '{person}有 {n} 个{item}，每盒装 {a} 个。',
    asks: ['最多装满几盒？', '还剩几个？'],
    formulas: ['quotientOf(n,a)', 'remainderOf(n,a)'],
    unit: '',
    answerUnits: ['盒', '个'],
    slots: { n: { min: 50, max: 90 }, a: { min: 4, max: 9 } },
    guard: (p) => p.n % p.a !== 0 && Math.floor(p.n / p.a) >= 3,
    workLines: 4,
  },
  {
    id: 'u9w-m5',
    practice: 'multistep',
    // 正方形周长（U6）+ 一位数除（U4）
    template: '正方形花坛边长 {a} 米，沿四周每隔 {c} 米摆 1 盆花，四个角都摆。',
    asks: ['一共摆多少盆？'],
    formulas: ['4*a/c'],
    unit: '盆',
    slots: { a: { min: 6, max: 15 }, c: { min: 2, max: 5 } },
    guard: (p) => p.a % p.c === 0,
    workLines: 4,
  },
  {
    id: 'u9w-m6',
    practice: 'multistep',
    // 一位数乘（U2）+ 减法（U1）+ 一位数除（U4）
    template: '{person}买 {a} 盒彩笔，每盒 {b} 支，送出 {c} 支，剩下平均分给 {d} 人。',
    asks: ['每人分多少支？'],
    formulas: ['(a*b-c)/d'],
    unit: '支',
    slots: {
      a: { min: 3, max: 6 },
      b: { min: 6, max: 9 },
      c: { min: 3, max: 10 },
      d: { min: 3, max: 8 },
    },
    guard: (p) => p.a * p.b > p.c + p.d && (p.a * p.b - p.c) % p.d === 0,
    workLines: 6,
  },
]
