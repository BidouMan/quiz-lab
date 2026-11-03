/**
 * 3A-U7 马拉松路线 · 填空 · 三档数值域与题干
 * 基线（L2：分段求和或比较）在 u7-marathon-fill.ts；本文件补 L1 / L3。
 * L1：千米与米换算（含米→千米的逆向、复名数拆分）；
 * L3：多段路线综合或往返。
 * 单位口径：空位自带单位，答案与空位单位一致；复名数两空为「千米；米」。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U7_MARATHON_FILL_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  'u7f-d1': {
    L1: band(
      { a: R(1, 4) },
      { template: '{item}长 {a} 千米，合 ____ 米。', formulas: ['a*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(200, 900, 50), b: R(200, 900, 50), c: R(200, 900, 50) },
      { template: '先走 {a} 米，再走 {b} 米，最后走 {c} 米，共 ____ 米。', formulas: ['a+b+c'], guard: () => true },
    ),
  },
  'u7f-d2': {
    L1: band(
      { a: R(5, 9) },
      { template: '{item}全长 {a} 千米，也就是 ____ 米。', formulas: ['a*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(100, 400, 50), b: R(50, 300, 50), c: R(50, 250, 50) },
      {
        template: '第一段 {a} 米，第二段多 {b} 米，第三段再多 {c} 米，共 ____ 米。',
        formulas: ['3*a+2*b+c'],
        guard: () => true,
      },
    ),
  },
  'u7f-d3': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100) },
      { template: '{item}长 {a} 千米 {b} 米，合 ____ 米。', formulas: ['a*1000+b'], guard: () => true },
    ),
    L3: band(
      { a: R(100, 900, 100), b: R(100, 900, 100), c: R(100, 900, 100) },
      { template: '三段 {a} 米、{b} 米、{c} 米，共 ____ 米。', formulas: ['a+b+c'], guard: () => true },
    ),
  },
  'u7f-d4': {
    L1: band(
      { a: R(10000, 35000, 5000) },
      {
        template: '{item}共 {a} 米，合 ____ 千米。',
        formulas: ['a/1000'],
        unit: '千米',
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(200, 900, 50), b: R(200, 900, 50) },
      { template: '去时 {a} 米，回来 {b} 米，两趟共 ____ 米。', formulas: ['a+b'], guard: () => true },
    ),
  },
  'u7f-d5': {
    L1: band(
      { a: R(2, 6), b: R(100, 900, 100) },
      { template: '{person}每天走 {a} 千米 {b} 米，合 ____ 米。', formulas: ['a*1000+b'], guard: () => true },
    ),
    L3: band(
      { a: R(200, 800, 50), b: R(100, 500, 50) },
      {
        template: '第一段 {a} 米，第二段多 {b} 米，第二段长 ____ 米。',
        formulas: ['a+b'],
        guard: () => true,
      },
    ),
  },
  'u7f-d6': {
    L1: band(
      { a: R(2500, 6500, 500) },
      {
        template: '{item}共 {a} 米，合 ____ 千米 ____ 米。',
        formulas: ['quotientOf(a,1000)', 'remainderOf(a,1000)'],
        unit: '',
        answerUnits: ['千米', '米'],
        guard: (p) => p.a % 1000 !== 0,
      },
    ),
    L3: band(
      { a: R(200, 900, 50), b: R(100, 400, 50) },
      {
        template: '去时 {a} 米，回来多 {b} 米，往返共 ____ 米。',
        formulas: ['2*a+b'],
        guard: () => true,
      },
    ),
  },

  'u7f-i1': {
    L1: band(
      { a: R(10, 13) },
      { template: '____ 米 = {a} 千米。', formulas: ['a*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(1000, 2400, 100), b: R(200, 700, 50), c: R(200, 700, 50) },
      {
        template: '三段共 {a} 米，前两段 {b} 米和 {c} 米，第三段 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },
  'u7f-i2': {
    L1: band(
      { a: R(7, 9), b: R(100, 900, 100) },
      { template: '{a} 千米 {b} 米 = ____ 米。', formulas: ['a*1000+b'], guard: () => true },
    ),
    L3: band(
      { a: R(800, 2400, 100), b: R(200, 700, 50) },
      {
        template: '总长 {a} 米，前两段共 {b} 米，第三段 ____ 米。',
        formulas: ['a-b'],
        guard: (p) => p.a - p.b >= 100,
      },
    ),
  },
  'u7f-i3': {
    L1: band(
      { a: R(7500, 9500, 500) },
      {
        template: '{item}长 {a} 米，合 ____ 千米 ____ 米。',
        formulas: ['quotientOf(a,1000)', 'remainderOf(a,1000)'],
        unit: '',
        answerUnits: ['千米', '米'],
        guard: (p) => p.a % 1000 !== 0,
      },
    ),
    L3: band(
      { a: R(400, 1600, 100), b: R(100, 700, 50) },
      {
        template: '去和回共 {a} 米，去时 {b} 米，回来 ____ 米。',
        formulas: ['a-b'],
        guard: (p) => p.a - p.b >= 100,
      },
    ),
  },
  'u7f-i4': {
    L1: band(
      { a: R(12500, 18500, 500) },
      {
        template: '{item}全长 {a} 米，也就是 ____ 千米 ____ 米。',
        formulas: ['quotientOf(a,1000)', 'remainderOf(a,1000)'],
        unit: '',
        answerUnits: ['千米', '米'],
        guard: (p) => p.a % 1000 !== 0,
      },
    ),
    L3: band(
      { a: R(1400, 2600, 100), b: R(200, 800, 50), c: R(200, 800, 50) },
      {
        template: '全程 {a} 米，上午走 {b} 米，下午走 {c} 米，还剩 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },
  'u7f-i5': {
    L1: band(
      { a: R(2, 6), b: R(100, 900, 100) },
      { template: '{item}标着 {a} 千米 {b} 米，也就是 ____ 米。', formulas: ['a*1000+b'], guard: () => true },
    ),
    L3: band(
      { a: R(600, 1800, 100), b: R(200, 700, 50) },
      {
        template: '两条路共 {a} 米，一条 {b} 米，另一条 ____ 米。',
        formulas: ['a-b'],
        guard: (p) => p.a - p.b >= 100,
      },
    ),
  },
  'u7f-i6': {
    L1: band(
      { a: R(8, 9), b: R(100, 900, 100) },
      { template: '____ 米 = {a} 千米 {b} 米。', formulas: ['a*1000+b'], guard: () => true },
    ),
    L3: band(
      { a: R(1400, 2600, 100), b: R(200, 700, 50), c: R(200, 700, 50) },
      {
        template: '全程 {a} 米，已走 {b} 米和 {c} 米，还剩 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },

  'u7f-c1': {
    L1: band(
      { a: R(5, 9), b: R(1, 4) },
      { template: '两条路长 {a} 千米和 {b} 千米，相差 ____ 米。', formulas: ['a*1000-b*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(200, 700, 50), b: R(200, 700, 50), c: R(300, 900, 50) },
      {
        template: '三条路 {a} 米、{b} 米、{c} 米，前两条比第三条多 ____ 米。',
        formulas: ['a+b-c'],
        guard: (p) => p.a + p.b - p.c >= 100,
      },
    ),
  },
  'u7f-c2': {
    L1: band(
      { a: R(2, 4), b: R(200, 900, 100) },
      {
        template: '一段 {a} 千米，一段 {b} 米，长的一段多 ____ 米。',
        formulas: ['a*1000-b'],
        guard: (p) => p.a * 1000 > p.b,
      },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50) },
      {
        template: '去时 {a} 米，回来多 {b} 米，两趟共 ____ 米。',
        formulas: ['2*a+b'],
        guard: () => true,
      },
    ),
  },
  'u7f-c3': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 50) },
      {
        template: '{a} 千米的路比 {b} 米的路长 ____ 米。',
        formulas: ['a*1000-b'],
        guard: (p) => p.a * 1000 > p.b,
      },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50) },
      {
        template: '一条 {a} 米，比另一条短 {b} 米，两条共 ____ 米。',
        formulas: ['2*a+b'],
        guard: () => true,
      },
    ),
  },
  'u7f-c4': {
    L1: band(
      { a: R(1, 5), b: R(1, 5) },
      { template: '{a} 千米与 {b} 千米合起来是 ____ 米。', formulas: ['(a+b)*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(100, 500, 50), b: R(2, 6) },
      { template: '一天走 {a} 米，{b} 天共 ____ 米。', formulas: ['a*b'], guard: () => true },
    ),
  },
  'u7f-c5': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100), c: R(100, 900, 100) },
      {
        template: '{person}走了 {a} 千米 {b} 米，再走 {c} 米，共 ____ 米。',
        formulas: ['a*1000+b+c'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(220, 400, 20) },
      { template: '三段各 {a} 米，共 ____ 米。', formulas: ['3*a'], guard: () => true },
    ),
  },
  'u7f-c6': {
    L1: band(
      { a: R(100, 900, 100), b: R(100, 900, 100) },
      { template: '{a} 米加 {b} 米，共 ____ 米。', formulas: ['a+b'], guard: () => true },
    ),
    L3: band(
      { a: R(420, 600, 20) },
      { template: '四条路各 {a} 米，共 ____ 米。', formulas: ['4*a'], guard: () => true },
    ),
  },

  'u7f-p1': {
    L1: band(
      { a: R(3, 6), b: R(3, 6) },
      { template: '先走 {a} 千米，再走 {b} 千米，共 ____ 米。', formulas: ['(a+b)*1000'], guard: () => true },
    ),
    L3: band(
      { a: R(620, 800, 20) },
      { template: '五段各 {a} 米，共 ____ 米。', formulas: ['5*a'], guard: () => true },
    ),
  },
  'u7f-p2': {
    L1: band(
      { a: R(100, 900, 100), b: R(100, 900, 100) },
      {
        template: '{person}先走 {a} 米，再走 {b} 米，共 ____ 米。',
        formulas: ['a+b'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(200, 700, 50), b: R(50, 300, 50) },
      {
        template: '上午 {a} 米，下午多 {b} 米，一天共 ____ 米。',
        formulas: ['2*a+b'],
        guard: () => true,
      },
    ),
  },
  'u7f-p3': {
    L1: band(
      { a: R(100, 900, 100), b: R(100, 900, 100), c: R(100, 900, 100) },
      {
        template: '{a} 米加 {b} 米，再走 {c} 米，共 ____ 米。',
        formulas: ['a+b+c'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(300, 900, 50), b: R(50, 300, 50) },
      {
        template: '去时 {a} 米，回来少 {b} 米，往返共 ____ 米。',
        formulas: ['2*a-b'],
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u7f-p4': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100), c: R(100, 900, 100) },
      {
        template: '先去{place} {a} 千米 {b} 米，再走 {c} 米，共 ____ 米。',
        formulas: ['a*1000+b+c'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(200, 800, 50), b: R(200, 800, 50), c: R(200, 800, 50) },
      {
        template: '三天各走 {a} 米、{b} 米、{c} 米，共 ____ 米。',
        formulas: ['a+b+c'],
        guard: () => true,
      },
    ),
  },
  'u7f-p5': {
    L1: band(
      { a: R(1, 9), b: R(100, 900, 100), c: R(2, 6) },
      {
        template: '每天跑 {a} 千米 {b} 米，{c} 天共 ____ 米。',
        formulas: ['(a*1000+b)*c'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(100, 400, 50), b: R(3, 6), c: R(50, 200, 50) },
      {
        template: '每天 {a} 米，{b} 天，最后一天少 {c} 米，共 ____ 米。',
        formulas: ['a*b-c'],
        guard: (p) => p.c < p.a && p.a * p.b > p.c + 100,
      },
    ),
  },
  'u7f-p6': {
    L1: band(
      { a: R(100, 900, 100), b: R(2, 5) },
      { template: '每天走 {a} 米，{b} 天共 ____ 米。', formulas: ['a*b'], guard: () => true },
    ),
    L3: band(
      { a: R(100, 400, 100), b: R(2, 4) },
      {
        template: '单程 {a} 米，每天往返 {b} 次，共 ____ 米。',
        formulas: ['2*a*b'],
        guard: () => true,
      },
    ),
  },

  'u7f-m1': {
    L1: band(
      { a: R(5, 9), b: R(1, 4) },
      {
        template: '{item}长 {a} 千米，{person}跑了 {b} 千米，还剩 ____ 米。',
        formulas: ['(a-b)*1000'],
        guard: (p) => p.a > p.b,
      },
    ),
    L3: band(
      { a: R(1400, 2600, 100), b: R(200, 700, 50), c: R(200, 700, 50) },
      {
        template: '全程 {a} 米，已跑 {b} 米和 {c} 米，还剩 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },
  'u7f-m2': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100), c: R(100, 500, 100) },
      {
        template: '{item}长 {a} 千米 {b} 米，已跑 {c} 米，还剩 ____ 米。',
        formulas: ['a*1000+b-c'],
        guard: (p) => p.a * 1000 + p.b - p.c >= 100,
      },
    ),
    L3: band(
      { a: R(1400, 2600, 100), b: R(200, 700, 50), c: R(200, 700, 50) },
      {
        template: '全程 {a} 米，上午跑 {b} 米，下午跑 {c} 米，还剩 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },
  'u7f-m3': {
    L1: band(
      { a: R(2, 6), b: R(100, 900, 100) },
      {
        template: '{person}往返{place}，单程 {a} 千米 {b} 米，共 ____ 米。',
        formulas: ['2*a*1000+2*b'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50) },
      {
        template: '去时 {a} 米，回来多 {b} 米，来回共 ____ 米。',
        formulas: ['2*a+b'],
        guard: () => true,
      },
    ),
  },
  'u7f-m4': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100) },
      {
        template: '{item}长 {a} 千米，已走 {b} 米，还剩 ____ 米。',
        formulas: ['a*1000-b'],
        guard: (p) => p.a * 1000 > p.b,
      },
    ),
    L3: band(
      { a: R(1400, 2600, 100), b: R(200, 700, 50), c: R(200, 700, 50) },
      {
        template: '全程 {a} 米，第一段 {b} 米，第二段 {c} 米，第三段 ____ 米。',
        formulas: ['a-b-c'],
        guard: (p) => p.a - p.b - p.c >= 100,
      },
    ),
  },
  'u7f-m5': {
    L1: band(
      { a: R(5, 9), b: R(500, 900, 100) },
      {
        template: '去{place} {a} 千米，回来多绕 {b} 米，往返共 ____ 米。',
        formulas: ['2*a*1000+b'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(300, 900, 50), b: R(50, 300, 50) },
      {
        template: '去时 {a} 米，回来少 {b} 米，回来 ____ 米。',
        formulas: ['a-b'],
        guard: (p) => p.b < p.a,
      },
    ),
  },
  'u7f-m6': {
    L1: band(
      { a: R(6, 9), b: R(100, 900, 100) },
      {
        template: '{item}长 {a} 千米，比另一条短 {b} 米，另一条长 ____ 米。',
        formulas: ['a*1000+b'],
        guard: () => true,
      },
    ),
    L3: band(
      { a: R(100, 400, 50), b: R(50, 250, 50), c: R(50, 250, 50) },
      {
        template: '第一段 {a} 米，第二段多 {b} 米，第三段再多 {c} 米，三段共 ____ 米。',
        formulas: ['3*a+2*b+c'],
        guard: () => true,
      },
    ),
  },
}
