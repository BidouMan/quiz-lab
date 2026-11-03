/**
 * 3A-U7 马拉松路线 · 应用 · 三档
 * L1：单段路程或千米/米换算（不跨段）。
 * L3：多段综合或往返，至少含一处“少走 / 多走 / 少跑 / 多跑”。
 * 所有答案与问句单位同口径，禁止“问米答千米”。
 */
import type { Level } from '../types.ts'
import type { SkeletonBand } from './types.ts'
import { band, R } from './bands.ts'

export const U7_MARATHON_WORD_BANDS: Record<string, Partial<Record<Level, SkeletonBand>>> = {
  'u7w-d1': {
    L1: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      { template: '{item}全长 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 700, 50), b: R(100, 500, 50), c: R(50, 300, 50) },
      {
        template: '第一天走 {a} 米，第二天走 {b} 米，第三天多走 {c} 米。',
        asks: ['第三天多少米？', '三天共走多少米？'],
        formulas: ['b+c', 'a+2*b+c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-d2': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '{person}沿{item}跑了 {a} 千米 {b} 米。', asks: ['跑了多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 700, 50), b: R(100, 400, 50) },
      {
        template: '{person}上午沿{item}跑 {a} 米，下午多跑 {b} 米。',
        asks: ['下午跑多少米？', '一天共跑多少米？'],
        formulas: ['a+b', '2*a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-d3': {
    L1: band(
      { a: R(1, 5), b: R(100, 800, 100) },
      { template: '{person}从家到{place}的距离是 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(400, 1200, 50), b: R(100, 400, 50) },
      {
        template: '{person}去{place}走 {a} 米，回来少走 {b} 米。',
        asks: ['回来走了多少米？', '往返共走多少米？'],
        formulas: ['a-b', '2*a-b'],
        unit: '米',
        guard: (p) => p.a > p.b + 100,
        workLines: 4,
      },
    ),
  },
  'u7w-d4': {
    L1: band(
      { a: R(2000, 4000, 1000) },
      { template: '{item}全长 {a} 米。', asks: ['合多少千米？'], formulas: ['a/1000'], unit: '千米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(150, 400, 50), b: R(3, 6), c: R(50, 200, 50) },
      {
        template: '{person}每天沿{item}跑 {a} 米，连续 {b} 天，最后一天少跑 {c} 米。',
        asks: ['这些天一共跑了多少米？'],
        formulas: ['a*b-c'],
        unit: '米',
        guard: (p) => p.c < p.a,
        workLines: 4,
      },
    ),
  },
  'u7w-d5': {
    L1: band(
      { a: R(2, 4) },
      { template: '{place}附近有一条 {a} 千米长的路。', asks: ['这条路合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(100, 400, 50), c: R(50, 300, 50) },
      {
        template: '先跑 {a} 米，再跑 {b} 米，最后一段少 {c} 米。',
        asks: ['最后一段多少米？', '全程多少米？'],
        formulas: ['a+b-c', '2*(a+b)-c'],
        unit: '米',
        guard: (p) => p.c < p.a + p.b - 100,
        workLines: 4,
      },
    ),
  },
  'u7w-d6': {
    L1: band(
      { a: R(1, 6), b: R(100, 900, 100) },
      { template: '{item}的路牌上写着 {a} 千米 {b} 米。', asks: ['实际是多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(800, 1600, 50), b: R(300, 700, 50) },
      {
        template: '全程 {a} 米，已经跑了 {b} 米。',
        asks: ['还剩多少米？', '剩下的比已跑的少多少米？'],
        formulas: ['a-b', 'b-(a-b)'],
        unit: '米',
        guard: (p) => p.a > p.b + 100 && p.a < 2 * p.b,
        workLines: 4,
      },
    ),
  },

  'u7w-i1': {
    L1: band(
      { a: R(5500, 9500, 500) },
      {
        template: '{item}长 {a} 米。',
        asks: ['合多少千米多少米？'],
        formulas: ['quotientOf(a,1000)', 'remainderOf(a,1000)'],
        unit: '',
        answerUnits: ['千米', '米'],
        guard: (p) => p.a % 1000 !== 0,
        workLines: 2,
      },
    ),
    L3: band(
      { a: R(900, 2400, 50), b: R(100, 700, 50), c: R(100, 700, 50) },
      {
        template: '三段路共 {a} 米，第一段 {b} 米，第二段 {c} 米。',
        asks: ['第三段长多少米？'],
        formulas: ['a-b-c'],
        unit: '米',
        guard: (p) => p.a > p.b + p.c + 100,
        workLines: 4,
      },
    ),
  },
  'u7w-i2': {
    L1: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      { template: '{person}把 {a} 千米 {b} 米的路记成全米数。', asks: ['是多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(900, 2400, 50), b: R(100, 700, 50), c: R(100, 700, 50) },
      {
        template: '全程 {a} 米，上午 {b} 米，下午 {c} 米。',
        asks: ['还剩多少米？', '剩下的比上午少多少米？'],
        formulas: ['a-b-c', 'b-(a-b-c)'],
        unit: '米',
        guard: (p) => p.a > p.b + p.c + 100 && p.a - p.b - p.c < p.b,
        workLines: 4,
      },
    ),
  },
  'u7w-i3': {
    L1: band(
      { a: R(10000, 13000, 1000) },
      { template: '{person}单程走 {a} 米。', asks: ['合多少千米？'], formulas: ['a/1000'], unit: '千米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(400, 1400, 100), b: R(100, 400, 50) },
      {
        template: '{person}往返共 {a} 米，去时多走 {b} 米。',
        asks: ['去时走多少米？', '回来走多少米？'],
        formulas: ['(a+b)/2', '(a-b)/2'],
        unit: '米',
        guard: (p) => p.b < p.a && (p.a + p.b) % 2 === 0,
        workLines: 4,
      },
    ),
  },
  'u7w-i4': {
    L1: band(
      { a: R(1, 6), b: R(100, 900, 100) },
      { template: '一块路牌写着 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(900, 2400, 50), b: R(100, 700, 50), c: R(100, 700, 50) },
      {
        template: '全程 {a} 米，上午跑 {b} 米，下午跑 {c} 米。',
        asks: ['还剩多少米？', '剩下的比上午少多少米？'],
        formulas: ['a-b-c', 'b-(a-b-c)'],
        unit: '米',
        guard: (p) => p.a > p.b + p.c + 100 && p.a - p.b - p.c < p.b,
        workLines: 4,
      },
    ),
  },
  'u7w-i5': {
    L1: band(
      { a: R(5, 9) },
      { template: '{person}的{item}是 {a} 千米。', asks: ['合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(900, 2400, 50), b: R(200, 900, 50) },
      {
        template: '两条路线共 {a} 米，第一条 {b} 米。',
        asks: ['第二条长多少米？', '第二条比第一条多多少米？'],
        formulas: ['a-b', 'a-2*b'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b + 100,
        workLines: 4,
      },
    ),
  },
  'u7w-i6': {
    L1: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      { template: '{person}从{place}回家要走 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(800, 1600, 50), b: R(300, 700, 50) },
      {
        template: '从{place}回家要走 {a} 米，已经走了 {b} 米。',
        asks: ['还要走多少米？', '剩下的比已走的少多少米？'],
        formulas: ['a-b', 'b-(a-b)'],
        unit: '米',
        guard: (p) => p.a > p.b + 100 && p.a < 2 * p.b,
        workLines: 4,
      },
    ),
  },

  'u7w-c1': {
    L1: band(
      { a: R(5, 9), b: R(2, 4) },
      { template: '甲路线长 {a} 千米，乙路线长 {b} 千米。', asks: ['甲比乙长多少米？'], formulas: ['(a-b)*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(300, 900, 50), b: R(100, 400, 50) },
      {
        template: '甲路线长 {a} 米，乙路线比甲长 {b} 米。',
        asks: ['乙路线长多少米？', '两条路线共多少米？'],
        formulas: ['a+b', '2*a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-c2': {
    L1: band(
      { a: R(10, 15) },
      { template: '{item}的显示牌写着 {a} 千米。', asks: ['是多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50) },
      {
        template: '{person}去{place}时走 {a} 米，回来比去时多走 {b} 米。',
        asks: ['回来走多少米？', '往返共走多少米？'],
        formulas: ['a+b', '2*a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-c3': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '{person}周一沿{item}跑了 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50), c: R(50, 300, 50) },
      {
        template: '周一跑 {a} 米，周二多 {b} 米，周三再多 {c} 米。',
        asks: ['周三跑多少米？', '三天共跑多少米？'],
        formulas: ['a+b+c', '3*a+2*b+c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-c4': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '计划走 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(300, 700, 50), b: R(50, 300, 50), c: R(100, 500, 50) },
      {
        template: '计划走 {a} 米，第一天多走 {b} 米，第二天 {c} 米。',
        asks: ['两天共多少米？', '比计划多走多少米？'],
        formulas: ['a+b+c', 'b+c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-c5': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '{person}的{item}长 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 700, 50), b: R(100, 400, 50) },
      {
        template: '{item}长 {a} 米，{place}那条比它长 {b} 米。',
        asks: ['{place}那条长多少米？', '两条共多少米？'],
        formulas: ['a+b', '2*a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-c6': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '{item}第一段是 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50), c: R(50, 300, 50) },
      {
        template: '三段路：第一段 {a} 米，第二段多 {b} 米，第三段少 {c} 米。',
        asks: ['第三段多少米？', '共长多少米？'],
        formulas: ['a+b-c', '3*a+2*b-c'],
        unit: '米',
        guard: (p) => p.b > p.c,
        workLines: 4,
      },
    ),
  },

  'u7w-p1': {
    L1: band(
      { a: R(16, 20) },
      { template: '{person}从家到{place}单程 {a} 千米。', asks: ['合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(2, 5) },
      {
        template: '{person}从家到{place}单程 {a} 米，每天往返 {b} 次。',
        asks: ['往返一次多少米？', '一天共走多少米？'],
        formulas: ['2*a', '2*a*b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-p2': {
    L1: band(
      { a: R(1, 4), b: R(200, 900, 100) },
      { template: '{person}每天跑 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(150, 400, 50), b: R(3, 6), c: R(50, 200, 50) },
      {
        template: '{person}每天跑 {a} 米，共 {b} 天，最后一天多跑 {c} 米。',
        asks: ['这些天共跑多少米？'],
        formulas: ['a*b+c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-p3': {
    L1: band(
      { a: R(14000, 17000, 1000) },
      { template: '{person}沿{item}跑一圈是 {a} 米。', asks: ['合多少千米？'], formulas: ['a/1000'], unit: '千米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(150, 400, 50), b: R(3, 6), c: R(50, 200, 50) },
      {
        template: '{person}每天沿{item}跑 {a} 米，{b} 天里周末两天共少跑 {c} 米。',
        asks: ['这些天共跑多少米？'],
        formulas: ['a*b-c'],
        unit: '米',
        guard: (p) => p.c < 2 * p.a,
        workLines: 4,
      },
    ),
  },
  'u7w-p4': {
    L1: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      { template: '{person}的{item}一共 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50), c: R(100, 500, 50) },
      {
        template: '去{place}走 {a} 米，回来多 {b} 米，第二天走 {c} 米。',
        asks: ['两天共多少米？', '回来走多少米？'],
        formulas: ['2*a+b+c', 'a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-p5': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100) },
      { template: '一段路长 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 500, 50), b: R(150, 400, 50), c: R(100, 300, 50), d: R(50, 200, 50) },
      {
        template: '三段路 {a}、{b}、{c} 米，第四段少 {d} 米。',
        asks: ['第四段多少米？', '四段共多少米？'],
        formulas: ['a+b+c-d', '2*(a+b+c)-d'],
        unit: '米',
        guard: (p) => p.d < p.a + p.b + p.c - 100,
        workLines: 4,
      },
    ),
  },
  'u7w-p6': {
    L1: band(
      { a: R(1, 4), b: R(100, 900, 100) },
      { template: '{person}上午走了 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50), c: R(50, 250, 50) },
      {
        template: '上午 {a} 米，下午多 {b} 米，晚上少 {c} 米。',
        asks: ['晚上走多少米？', '一天共多少米？'],
        formulas: ['a+b-c', '3*a+2*b-c'],
        unit: '米',
        guard: (p) => p.b > p.c && p.a > p.c - p.b,
        workLines: 4,
      },
    ),
  },

  'u7w-m1': {
    L1: band(
      { a: R(21, 23) },
      { template: '{item}全长 {a} 千米。', asks: ['合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(900, 2400, 50), b: R(100, 700, 50), c: R(100, 700, 50) },
      {
        template: '全程 {a} 米，第一段 {b} 米，第二段 {c} 米。',
        asks: ['还剩多少米？', '比第一段少多少米？'],
        formulas: ['a-b-c', 'b-(a-b-c)'],
        unit: '米',
        guard: (p) => p.a > p.b + p.c + 100 && p.a - p.b - p.c < p.b,
        workLines: 4,
      },
    ),
  },
  'u7w-m2': {
    L1: band(
      { a: R(1, 5), b: R(100, 900, 100) },
      { template: '{person}把 {a} 千米 {b} 米换算成米。', asks: ['是多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(150, 400, 50), b: R(3, 6), c: R(100, 500, 50) },
      {
        template: '{person}每天跑 {a} 米，跑了 {b} 天，比计划少跑 {c} 米。',
        asks: ['实际跑了多少米？', '计划跑多少米？'],
        formulas: ['a*b', 'a*b+c'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-m3': {
    L1: band(
      { a: R(24, 26) },
      { template: '{person}从家到{place}是 {a} 千米。', asks: ['合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(300, 900, 50), b: R(100, 400, 50) },
      {
        template: '{person}从家到{place}走 {a} 米，再到学校多走 {b} 米。',
        asks: ['家到学校多少米？', '往返共多少米？'],
        formulas: ['2*a+b', '4*a+2*b'],
        unit: '米',
        guard: () => true,
        workLines: 6,
      },
    ),
  },
  'u7w-m4': {
    L1: band(
      { a: R(1, 6), b: R(100, 900, 100) },
      { template: '{person}昨天跑了 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50), c: R(50, 250, 50) },
      {
        template: '今天 {a} 米，昨天多 {b} 米，明天少 {c} 米。',
        asks: ['昨天跑多少米？', '三天共跑多少米？'],
        formulas: ['a+b', '3*a+b-c'],
        unit: '米',
        guard: (p) => p.c < p.a,
        workLines: 4,
      },
    ),
  },
  'u7w-m5': {
    L1: band(
      { a: R(27, 29) },
      { template: '{person}单程走 {a} 千米。', asks: ['合多少米？'], formulas: ['a*1000'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(200, 600, 50), b: R(50, 300, 50) },
      {
        template: '单程 {a} 米，往返后再单程 {b} 米。',
        asks: ['一共走了多少米？', '比单程多走多少米？'],
        formulas: ['3*a+b', '2*a+b'],
        unit: '米',
        guard: () => true,
        workLines: 4,
      },
    ),
  },
  'u7w-m6': {
    L1: band(
      { a: R(1, 6), b: R(100, 900, 100) },
      { template: '{item}标着 {a} 千米 {b} 米。', asks: ['合多少米？'], formulas: ['a*1000+b'], unit: '米', guard: () => true, workLines: 2 },
    ),
    L3: band(
      { a: R(900, 2000, 50), b: R(200, 700, 50), c: R(100, 400, 50) },
      {
        template: '全程 {a} 米，上午跑 {b} 米，下午比上午多跑 {c} 米。',
        asks: ['下午跑多少米？', '还剩多少米？'],
        formulas: ['b+c', 'a-2*b-c'],
        unit: '米',
        guard: (p) => p.a > 2 * p.b + p.c + 100,
        workLines: 4,
      },
    ),
  },
}
