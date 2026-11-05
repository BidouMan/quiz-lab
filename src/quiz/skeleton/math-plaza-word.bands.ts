/**
 * 【已拆解】数学广场已并入 U6/U3/U4/U2；本文件仅作 variants.ts 的数据源，不再注册为骨架包。
 * 数学广场 · 应用 · 三档
 * L1：单点辨认或直接求（周长、边长、块数、根数）。
 * L3：最值或判断（“最多/省多少”方向明确），并保留靠墙、七巧板、找规律的综合。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const MATH_PLAZA_WORD_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  'mpw-d1': {
    L1: band(
      { a: R(4, 5) },
      { template: '{place}有一块正方形{item}，边长 {a} 米，围一圈篱笆。', asks: ['篱笆长多少米？'], formulas: ['4*a'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { p: R(16, 40, 2) },
      {
        template: '用 {p} 米篱笆围一块长方形{item}，长、宽都是整米数，宽至少 1 米。',
        asks: ['长最多多少米？'],
        formulas: ['p/2-1'],
        unit: '米',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-d2': {
    L1: band(
      { a: R(10, 50, 2), b: R(3, 24, 2) },
      { template: '长方形{item}长 {a} 米、宽 {b} 米，只围一条长边和一条宽边。', asks: ['篱笆长多少米？'], formulas: ['a+b'], unit: '米', guard: (p) => p.a > p.b, workLines: 2 },
    ),
    L3: band(
      { a: R(3, 20), c: R(1, 3) },
      {
        template: '两个边长 {a} 米的正方形{item}并排拼成一个长方形，外框围 {c} 圈。',
        asks: ['外框篱笆共多少米？'],
        formulas: ['6*a*c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'mpw-d3': {
    L1: band(
      { a: R(12, 50, 2), b: R(3, 24, 2) },
      { template: '{place}的长方形{item}长 {a} 米、宽 {b} 米。', asks: ['长比宽多多少米？'], formulas: ['a-b'], unit: '米', guard: (p) => p.a > p.b + 2, workLines: 2 },
    ),
    L3: band(
      { p: R(42, 60, 2) },
      {
        template: '用 {p} 米篱笆给长方形{item}围三边，长边靠墙，宽至少 1 米。',
        asks: ['长最多多少米？'],
        formulas: ['p-2'],
        unit: '米',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-d4': {
    L1: band(
      { a: R(6, 7) },
      { template: '{person}的长方形{item}长 {a} 米。', asks: ['两条长边共多少米？'], formulas: ['2*a'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { p: R(62, 80, 2) },
      {
        template: '用 {p} 米篱笆给长方形{item}围三边，宽边靠墙，宽至少 1 米。',
        asks: ['长最多多少米？'],
        formulas: ['p/2-1'],
        unit: '米',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-d5': {
    L1: band(
      { a: R(8, 9) },
      { template: '正方形{item}边长 {a} 米，只围三条边（一边留门）。', asks: ['篱笆长多少米？'], formulas: ['3*a'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { p: R(17, 57, 2), c: R(1, 3) },
      {
        template: '用 {p} 米篱笆围正方形{item}，再留一个 {c} 米宽的门。',
        asks: ['边长多少米？'],
        formulas: ['(p+c)/4'],
        unit: '米',
        guard: (p) => (p.p + p.c) % 4 === 0,
        workLines: 2,
      },
    ),
  },
  'mpw-d6': {
    L1: band(
      { a: R(2, 3) },
      { template: '一副七巧板有 7 块，{person}有 {a} 副。', asks: ['共多少块？'], formulas: ['7*a'], unit: '块', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { n: R(11, 35, 2), m: R(1, 3) },
      {
        template: '{person}用 {n} 块七巧板三角形拼正方形，每 2 块拼 1 个，先用掉 {m} 块。',
        asks: ['最多拼几个？', '还剩几块？'],
        formulas: ['quotientOf(n-m,2)', 'remainderOf(n-m,2)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => (p.n - p.m) % 2 === 1,
        workLines: 2,
      },
    ),
  },

  'mpw-i1': {
    L1: band(
      { a: R(48, 52, 4) },
      { template: '{person}用 {a} 米篱笆正好围一圈正方形{item}。', asks: ['边长多少米？'], formulas: ['a/4'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(24, 100, 4), b: R(4, 30, 2) },
      {
        template: '{person}用 {a} 米篱笆围长方形{item}，长 {b} 米。',
        asks: ['宽多少米？'],
        formulas: ['a/2-b'],
        unit: '米',
        guard: (p) => p.a / 2 > p.b + 2,
        workLines: 2,
      },
    ),
  },
  'mpw-i2': {
    L1: band(
      { b: R(10, 11) },
      { template: '{place}的长方形{item}两条宽边各 {b} 米。', asks: ['两条宽边共多少米？'], formulas: ['2*b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(24, 100, 2), b: R(5, 24, 2) },
      {
        template: '用 {a} 米篱笆围着长方形{item}，长边靠墙，长 {b} 米。',
        asks: ['宽多少米？'],
        formulas: ['(a-b)/2'],
        unit: '米',
        guard: (p) => (p.a - p.b) % 2 === 0 && p.a > p.b + 4,
        workLines: 2,
      },
    ),
  },
  'mpw-i3': {
    L1: band(
      { a: R(40, 44, 4) },
      { template: '一根 {a} 米长的绳子正好围成正方形。', asks: ['边长多少米？'], formulas: ['a/4'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(24, 80, 4), b: R(3, 24) },
      {
        template: '{person}用 {a} 米篱笆围正方形，改围成长为 {b} 米的长方形。',
        asks: ['宽多少米？'],
        formulas: ['a/2-b'],
        unit: '米',
        guard: (p) => p.a / 2 > p.b + 1,
        workLines: 2,
      },
    ),
  },
  'mpw-i4': {
    L1: band(
      { a: R(12, 13) },
      { template: '{person}给正方形{item}围三边篱笆，每边 {a} 米。', asks: ['篱笆长多少米？'], formulas: ['3*a'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(12, 60, 6) },
      {
        template: '正方形{item}一边靠墙，另外三边共用 {a} 米篱笆。',
        asks: ['边长多少米？'],
        formulas: ['a/3'],
        unit: '米',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-i5': {
    L1: band(
      { a: R(20, 24, 4) },
      { template: '每 2 块三角形拼 1 个正方形，{person}有 {a} 块。', asks: ['能拼几个？'], formulas: ['a/2'], unit: '个', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { n: R(11, 31, 2), m: R(1, 3) },
      {
        template: '{person}用 {n} 块三角形拼正方形，每 2 块拼 1 个，先用掉 {m} 块。',
        asks: ['最多拼几个？', '还剩几块？'],
        formulas: ['quotientOf(n-m,2)', 'remainderOf(n-m,2)'],
        unit: '',
        answerUnits: ['个', '块'],
        guard: (p) => (p.n - p.m) % 2 === 1,
        workLines: 2,
      },
    ),
  },
  'mpw-i6': {
    L1: band(
      { a: R(14, 15) },
      { template: '摆 1 个正方形用 4 根小棒，单独摆 {a} 个。', asks: ['用多少根？'], formulas: ['4*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { n: R(16, 60, 2), m: R(1, 2) },
      {
        template: '{person}用小棒连排摆正方形，共 {n} 根，用掉 {m} 根。',
        asks: ['最多摆几个？', '剩几根？'],
        formulas: ['quotientOf(n-m-1,3)', 'remainderOf(n-m-1,3)'],
        unit: '',
        answerUnits: ['个', '根'],
        guard: (p) => (p.n - p.m - 1) % 3 !== 0,
        workLines: 2,
      },
    ),
  },

  'mpw-c1': {
    L1: band(
      { a: R(8, 30), b: R(2, 20) },
      { template: '两个正方形边长 {a} 米、{b} 米。', asks: ['周长相差多少米？'], formulas: ['4*(a-b)'], unit: '米', guard: (p) => p.a > p.b + 2, workLines: 2 },
    ),
    L3: band(
      { a: R(8, 30), b: R(2, 20) },
      {
        template: '两个正方形边长 {a} 米、{b} 米，把大的改成小的。',
        asks: ['可少用多少米篱笆？'],
        formulas: ['4*(a-b)'],
        unit: '米',
        guard: (p) => p.a > p.b + 2,
        workLines: 2,
      },
    ),
  },
  'mpw-c2': {
    L1: band(
      { a: R(12, 50, 2), b: R(3, 24, 2) },
      { template: '长方形{item}长 {a} 米、宽 {b} 米，长边靠墙只围三边。', asks: ['三边篱笆共多少米？'], formulas: ['a+2*b'], unit: '米', guard: (p) => p.a > p.b + 2, workLines: 2 },
    ),
    L3: band(
      { a: R(14, 50, 2), b: R(4, 24, 2) },
      {
        template: '长方形{item}长 {a} 米、宽 {b} 米。',
        asks: ['长边靠墙比围四边省多少米？'],
        formulas: ['a'],
        unit: '米',
        guard: (p) => p.a > p.b + 2,
        workLines: 2,
      },
    ),
  },
  'mpw-c3': {
    L1: band(
      { a: R(28, 32, 4) },
      { template: '正方形篱笆共 {a} 米。', asks: ['边长多少米？'], formulas: ['a/4'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(20, 80, 4), b: R(6, 30), c: R(3, 20) },
      {
        template: '用 {a} 米篱笆围正方形；长方形长 {b} 米、宽 {c} 米。',
        asks: ['正方形边长多少米？', '长方形周长多少米？'],
        formulas: ['a/4', '2*(b+c)'],
        unit: '米',
        guard: (p) => p.b > p.c,
        workLines: 4,
      },
    ),
  },
  'mpw-c4': {
    L1: band(
      { a: R(14, 50, 2), b: R(4, 24, 2) },
      { template: '长方形{item}长 {a} 米、宽 {b} 米。', asks: ['长边靠墙比宽边靠墙省多少米？'], formulas: ['a-b'], unit: '米', guard: (p) => p.a > p.b + 2, workLines: 2 },
    ),
    L3: band(
      { a: R(14, 50, 2), b: R(4, 24, 2) },
      {
        template: '长方形{item}长 {a} 米、宽 {b} 米，靠墙围三边有两种围法。',
        asks: ['靠长边比靠宽边省多少米？'],
        formulas: ['a-b'],
        unit: '米',
        guard: (p) => p.a > p.b + 2,
        workLines: 2,
      },
    ),
  },
  'mpw-c5': {
    L1: band(
      { a: R(2, 8), b: R(1, 5) },
      { template: '{person}有 {a} 副七巧板，同伴只有 {b} 副，每副 7 块。', asks: ['多多少块？'], formulas: ['7*(a-b)'], unit: '块', guard: (p) => p.a > p.b, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8) },
      {
        template: '{person}有 {a} 副七巧板，每副 5 块三角形。',
        asks: ['三角形共多少块？'],
        formulas: ['5*a'],
        unit: '块',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-c6': {
    L1: band(
      { a: R(16, 17) },
      { template: '单独摆 {a} 个正方形，每个 4 根。', asks: ['连排摆同样多可少多少根？'], formulas: ['a-1'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(3, 20), b: R(3, 20) },
      {
        template: '{person}单独摆 {a} 个正方形，连排摆 {b} 个。',
        asks: ['连排比单独少多少根？'],
        formulas: ['4*a-(3*b+1)'],
        unit: '根',
        guard: (p) => 4 * p.a > 3 * p.b + 1,
        workLines: 2,
      },
    ),
  },

  'mpw-p1': {
    L1: band(
      { a: R(10, 50, 2), b: R(3, 24, 2) },
      { template: '长方形{item}长 {a} 米、宽 {b} 米，只围相邻两边。', asks: ['篱笆长多少米？'], formulas: ['a+b'], unit: '米', guard: (p) => p.a > p.b, workLines: 2 },
    ),
    L3: band(
      { a: R(10, 50, 2), b: R(3, 24, 2) },
      {
        template: '长方形{item}长 {a} 米、宽 {b} 米，两面靠墙，相邻两边围 2 圈。',
        asks: ['篱笆共多少米？'],
        formulas: ['2*(a+b)'],
        unit: '米',
        guard: (p) => p.a > p.b,
        workLines: 2,
      },
    ),
  },
  'mpw-p2': {
    L1: band(
      { a: R(18, 19) },
      { template: '两个边长 {a} 米的正方形并排。', asks: ['外框共多少米？'], formulas: ['6*a'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(3, 20), b: R(2, 6) },
      {
        template: '边长 {a} 米的正方形 {b} 个并排拼在一起。',
        asks: ['外框比分开围少多少米？'],
        formulas: ['2*a*(b-1)'],
        unit: '米',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-p3': {
    L1: band(
      { a: R(25, 27) },
      { template: '每 2 块三角形拼 1 个正方形，拼 {a} 个。', asks: ['用多少块三角形？'], formulas: ['2*a'], unit: '块', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8), m: R(1, 3) },
      {
        template: '{person}有 {a} 副七巧板，每副 5 块三角形，用掉 {m} 块。',
        asks: ['还剩多少块三角形？'],
        formulas: ['5*a-m'],
        unit: '块',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-p4': {
    L1: band(
      { a: R(33, 35) },
      { template: '{place}有 {a} 副七巧板，每副 7 块。', asks: ['共多少块？'], formulas: ['7*a'], unit: '块', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 6), b: R(2, 7) },
      {
        template: '每副七巧板 7 块，{person}拿来 {a} 副，平均分给 {b} 人。',
        asks: ['每人分多少块？'],
        formulas: ['7*a/b'],
        unit: '块',
        guard: (p) => (7 * p.a) % p.b === 0,
        workLines: 2,
      },
    ),
  },
  'mpw-p5': {
    L1: band(
      { a: R(36, 37) },
      { template: '单独摆 {a} 个正方形，每个用 4 根小棒。', asks: ['共多少根？'], formulas: ['4*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8), b: R(2, 8) },
      {
        template: '连排摆 {a} 个正方形，再连排摆 {b} 个三角形。',
        asks: ['一共用多少根小棒？'],
        formulas: ['3*a+2*b+2'],
        unit: '根',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-p6': {
    L1: band(
      { a: R(38, 39) },
      { template: '摆 1 个三角形用 3 根小棒，单独摆 {a} 个。', asks: ['用多少根？'], formulas: ['3*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { n: R(15, 45, 2), m: R(1, 3) },
      {
        template: '{person}用小棒连排摆三角形，共 {n} 根，再添 {m} 根。',
        asks: ['最多摆几个？', '剩几根？'],
        formulas: ['quotientOf(n+m-1,2)', 'remainderOf(n+m-1,2)'],
        unit: '',
        answerUnits: ['个', '根'],
        guard: (p) => (p.n + p.m - 1) % 2 !== 0,
        workLines: 2,
      },
    ),
  },

  'mpw-m1': {
    L1: band(
      { a: R(45, 47) },
      { template: '单独摆 {a} 个正方形，每个 4 根。', asks: ['共多少根？'], formulas: ['4*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8), b: R(4, 12) },
      {
        template: '按 4、7、10…的规律连排摆正方形，第 {a} 个和第 {b} 个。',
        asks: ['第 {b} 个比第 {a} 个多用多少根？'],
        formulas: ['3*(b-a)'],
        unit: '根',
        guard: (p) => p.b > p.a,
        workLines: 2,
      },
    ),
  },
  'mpw-m2': {
    L1: band(
      { a: R(53, 55) },
      { template: '单独摆 {a} 个三角形，每个 3 根。', asks: ['共多少根？'], formulas: ['3*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8), b: R(4, 12) },
      {
        template: '按 3、5、7…的规律连排摆三角形，第 {a} 个和第 {b} 个。',
        asks: ['第 {b} 个比第 {a} 个多用多少根？'],
        formulas: ['2*(b-a)'],
        unit: '根',
        guard: (p) => p.b > p.a,
        workLines: 2,
      },
    ),
  },
  'mpw-m3': {
    L1: band(
      { a: R(56, 57) },
      { template: '单独摆 {a} 个六边形，每个 6 根。', asks: ['共多少根？'], formulas: ['6*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(1, 6), b: R(3, 10) },
      {
        template: '按 6、11、16…的规律连排摆六边形，第 {a} 个和第 {b} 个。',
        asks: ['第 {b} 个比第 {a} 个多用多少根？'],
        formulas: ['5*(b-a)'],
        unit: '根',
        guard: (p) => p.b > p.a,
        workLines: 2,
      },
    ),
  },
  'mpw-m4': {
    L1: band(
      { n: R(58, 60, 2) },
      { template: '有 {n} 根小棒，摆 1 个正方形用 4 根。', asks: ['还剩多少根？'], formulas: ['n-4'], unit: '根', guard: (p) => p.n > 5, workLines: 2 },
    ),
    L3: band(
      { n: R(20, 60, 2), a: R(2, 10) },
      {
        template: '有 {n} 根小棒，摆一个正方形用 4 根，摆了 {a} 个。',
        asks: ['还剩多少根？'],
        formulas: ['n-4*a'],
        unit: '根',
        guard: (p) => p.n > 4 * p.a + 1,
        workLines: 2,
      },
    ),
  },
  'mpw-m5': {
    L1: band(
      { a: R(29, 30) },
      { template: '摆正方形每个 4 根，{a} 个。', asks: ['共用多少根？'], formulas: ['4*a'], unit: '根', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(2, 8), b: R(2, 8) },
      {
        template: '连排摆 {a} 个正方形，再单独摆 {b} 个三角形。',
        asks: ['一共用多少根？'],
        formulas: ['3*a+3*b+1'],
        unit: '根',
        guard: () => true,
        workLines: 2,
      },
    ),
  },
  'mpw-m6': {
    L1: band(
      { n: R(21, 23) },
      { template: '有 {n} 根小棒，每 4 根摆 1 个正方形。', asks: ['还剩多少根？'], formulas: ['n-4'], unit: '根', answerUnits: [], guard: (p) => p.n > 5, workLines: 2 },
    ),
    L3: band(
      { n: R(13, 41), m: R(1, 3) },
      {
        template: '有 {n} 根小棒，每 4 根摆 1 个正方形，再添 {m} 根。',
        asks: ['最多摆几个？', '还剩几根？'],
        formulas: ['quotientOf(n+m,4)', 'remainderOf(n+m,4)'],
        unit: '',
        answerUnits: ['个', '根'],
        guard: (p) => (p.n + p.m) % 4 !== 0,
        workLines: 2,
      },
    ),
  },
}
