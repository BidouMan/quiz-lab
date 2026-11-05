import { CURRICULUM, findKp, findUnit } from '../data/curriculum.ts'
import type {
  GenerateWordOptions,
  KnowledgePoint,
  Level,
  ParamMap,
  Unit,
  WordFormName,
  WordQuestion,
  WordRuleSpec,
  WordStep,
} from './types.ts'
import { MemoryStore } from './memory.ts'
import { createRng, pick, randInt, type Rng } from './rng.ts'
import { evalLatex } from './expr.ts'
import { unitGuardProblem } from './unitGuards.ts'

/**
 * 应用题生成器。
 *
 * 设计要点：
 * - 先定“整数量”（人数、条数、块数），再反推总数，保证不出现半个人、除不尽；
 * - 题干只描述情境与问句，不写“先算/再算”这类步骤台词；
 * - 每题带分步解答（参考页用）；生成后用 verifyWord 从 params 重算一遍，
 *   并对每个算术步骤独立求值，验证答案与结论一致。
 */

const BLOCK_LEAK = /先算|再算|然后|接着|第一步|第二步|因此|所以|求出|算出/

const NAMES = ['小明', '小红', '小华', '丁丁', '冬冬', '乐乐']
const SHOPS = [
  { noun: '铅笔', unit: '支' },
  { noun: '练习本', unit: '本' },
  { noun: '橡皮', unit: '块' },
  { noun: '尺子', unit: '把' },
  { noun: '水彩笔', unit: '盒' },
]
interface WordDraft {
  stem: string
  questions: string[]
  answers: string[]
  steps: WordStep[]
  params: ParamMap
  features: Record<string, number | string | boolean>
}

type WordBuilder = (rng: Rng, level: Level) => WordDraft | null

interface Target {
  unit: Unit
  kp: KnowledgePoint
  specs: WordRuleSpec[]
}

const asSpecs = (value: WordRuleSpec | WordRuleSpec[] | undefined): WordRuleSpec[] => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const timeText = (hour: number, minute: number): string =>
  minute === 0 ? `${hour} 时` : `${hour} 时 ${minute} 分`

const answerTime = (hour: number, minute: number): string => `${hour} 时 ${minute} 分`

const step = (
  q: number,
  expr: string,
  result: number,
  line: string,
  remainder?: number,
): WordStep => ({
  q,
  expr,
  result,
  line,
  ...(remainder === undefined ? {} : { remainder }),
})

const judgeStep = (q: number, line: string, pass: boolean): WordStep => ({
  q,
  expr: pass ? '够' : '不够',
  result: pass ? 1 : 0,
  line,
  judge: true,
})

/**
 * 作答留白同时受“分几问”和“写几步”约束：
 * 1 问 2–3 行、2 问 4–5 行、3 问 6–7 行（判断问多留 1 行）；
 * 五步满减题即使只有 2 问，也必须给到 6 行（每步一个算式行 + 结论行）。
 */
const workLinesOf = (questions: number, judge: boolean, steps: number): number =>
  Math.min(7, Math.max(2, 2 * questions + (judge ? 1 : 0), steps + 1))

/** 付款金额取整：三年级现实付款只用整十/整百，避免“付 81 元买 36 元” */
const paidRounded = (total: number): number => Math.ceil(total / 10) * 10

/** 预算金额取整：整十或整百，且保证“够/不够”的判断差额有意义 */
const budgetRounded = (total: number, enough: boolean): number => {
  const up = Math.ceil(total / 100) * 100
  if (enough) return up === total ? total + 100 : up
  return Math.max(100, up - 100)
}

// ---------- 购物 ----------

const buildShopping: WordBuilder = (rng, level) => {
  const name = pick(rng, NAMES)
  const item = pick(rng, SHOPS)
  if (level === 'L1') {
    const price = randInt(rng, 2, 9)
    const quantity = randInt(rng, 2, 9)
    const total = price * quantity
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `文具店里每${item.unit}${item.noun} ${price} 元，${name} 买了 ${quantity} ${item.unit}。一共要付多少元？`
        : variant === 1
          ? `${name} 买了 ${quantity} ${item.unit}${item.noun}，每${item.unit} ${price} 元。一共花了多少元？`
          : `${item.noun}每${item.unit} ${price} 元，买 ${quantity} ${item.unit}这样的${item.noun}，一共需要多少元？`
    return {
      stem,
      questions: ['一共要付多少元？'],
      answers: [String(total)],
      steps: [step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`)],
      params: { price, quantity, mode: 'single' },
      features: { form: 'shopping', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const price = randInt(rng, 4, 12)
    const quantity = randInt(rng, 3, 9)
    const total = price * quantity
    // 付款金额取整十，找回的钱必须是正数
    const paid = paidRounded(total + 1)
    const change = paid - total
    return {
      stem: `每${item.unit}${item.noun} ${price} 元，${name} 买了 ${quantity} ${item.unit}，付给收银员 ${paid} 元。①一共要付多少元？②应找回多少元？`,
      questions: ['一共要付多少元？', '应找回多少元？'],
      answers: [String(total), String(change)],
      steps: [
        step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`),
        step(2, `${paid} - ${total}`, change, `${paid} - ${total} = ${change}（元）`),
      ],
      params: { price, quantity, paid, mode: 'change' },
      features: { form: 'shopping', level, questions: 2, steps: 2, judge: false },
    }
  }
  // 两样不同商品：单价必须不同，比较/合计才有意义
  const idx1 = randInt(rng, 0, SHOPS.length - 1)
  let idx2 = randInt(rng, 0, SHOPS.length - 1)
  while (idx2 === idx1) idx2 = randInt(rng, 0, SHOPS.length - 1)
  const item1 = SHOPS[idx1]
  const item2 = SHOPS[idx2]
  const price1 = randInt(rng, 3, 9)
  let price2 = randInt(rng, 4, 12)
  while (price2 === price1) price2 = randInt(rng, 4, 12)
  const quantity1 = randInt(rng, 2, 6)
  let quantity2 = randInt(rng, 2, 6)
  // 两种商品的数量也要不同，否则“比较/合计”仍可能退化成同一种结构
  if (quantity2 === quantity1) quantity2 = quantity1 === 6 ? 5 : quantity1 + 1
  const part1 = price1 * quantity1
  const part2 = price2 * quantity2
  const total = part1 + part2
  const enough = rng() < 0.5
  // 预算取整十，保证差额至少 10 元
  const money = enough ? paidRounded(total + 1) : Math.max(10, paidRounded(total) - 10)
  return {
    stem: `文具店里每${item1.unit}${item1.noun} ${price1} 元，每${item2.unit}${item2.noun} ${price2} 元。${name} 买了 ${quantity1} ${item1.unit}${item1.noun}和 ${quantity2} ${item2.unit}${item2.noun}，带 ${money} 元。①一共要付多少元？②带的钱够不够？`,
    questions: ['一共要付多少元？', '带的钱够不够？'],
    answers: [String(total), enough ? '够' : '不够'],
    steps: [
      step(1, `${price1} × ${quantity1}`, part1, `${price1} × ${quantity1} = ${part1}（元）`),
      step(1, `${price2} × ${quantity2}`, part2, `${price2} × ${quantity2} = ${part2}（元）`),
      step(1, `${part1} + ${part2}`, total, `${part1} + ${part2} = ${total}（元）`),
      judgeStep(
        2,
        enough
          ? `${money} 元 > ${total} 元，带的钱够`
          : `${money} 元 < ${total} 元，带的钱不够`,
        enough,
      ),
    ],
    params: {
      price1,
      quantity1,
      price2,
      quantity2,
      money,
      noun1: item1.noun,
      noun2: item2.noun,
      mode: 'budget',
    },
    features: { form: 'shopping', level, questions: 2, steps: 4, judge: true },
  }
}

// ---------- 三种商品合计（3A-U1 L3 的推理形态） ----------

const buildShop3: WordBuilder = (rng, level) => {
  if (level !== 'L3') return null
  const name = pick(rng, NAMES)
  const indices: number[] = []
  while (indices.length < 3) {
    const i = randInt(rng, 0, SHOPS.length - 1)
    if (!indices.includes(i)) indices.push(i)
  }
  const [i1, i2, i3] = indices
  const items = [SHOPS[i1], SHOPS[i2], SHOPS[i3]]
  // 三种商品单价必须两两不同，否则“三种商品合计”会退化成两种商品
  const prices: number[] = []
  while (prices.length < 3) {
    const price = randInt(rng, 2, 9)
    if (!prices.includes(price)) prices.push(price)
  }
  const quantities = items.map(() => randInt(rng, 2, 5))
  const parts = prices.map((p, i) => p * quantities[i])
  const total = parts.reduce((s, v) => s + v, 0)
  const enough = rng() < 0.5
  const money = enough ? paidRounded(total + 1) : Math.max(10, paidRounded(total) - 10)
  return {
    stem: `文具店里${items[0].noun}每${items[0].unit} ${prices[0]} 元，${items[1].noun}每${items[1].unit} ${prices[1]} 元，${items[2].noun}每${items[2].unit} ${prices[2]} 元。${name} 买了 ${quantities[0]} ${items[0].unit}${items[0].noun}、${quantities[1]} ${items[1].unit}${items[1].noun}和 ${quantities[2]} ${items[2].unit}${items[2].noun}，带 ${money} 元。①一共要付多少元？②带的钱够不够？`,
    questions: ['一共要付多少元？', '带的钱够不够？'],
    answers: [String(total), enough ? '够' : '不够'],
    steps: [
      step(1, `${prices[0]} × ${quantities[0]}`, parts[0], `${prices[0]} × ${quantities[0]} = ${parts[0]}（元）`),
      step(1, `${prices[1]} × ${quantities[1]}`, parts[1], `${prices[1]} × ${quantities[1]} = ${parts[1]}（元）`),
      step(1, `${prices[2]} × ${quantities[2]}`, parts[2], `${prices[2]} × ${quantities[2]} = ${parts[2]}（元）`),
      step(1, `${parts[0]} + ${parts[1]} + ${parts[2]}`, total, `${parts[0]} + ${parts[1]} + ${parts[2]} = ${total}（元）`),
      judgeStep(
        2,
        enough
          ? `${money} 元 > ${total} 元，带的钱够`
          : `${money} 元 < ${total} 元，带的钱不够`,
        enough,
      ),
    ],
    params: {
      price1: prices[0],
      quantity1: quantities[0],
      price2: prices[1],
      quantity2: quantities[1],
      price3: prices[2],
      quantity3: quantities[2],
      money,
      mode: 'shop3',
    },
    features: { form: 'shop3', level, questions: 2, steps: 5, judge: true },
  }
}

// ---------- 两种商品的花费比较（3A-U1 L3 的推理形态） ----------

const buildShopCompare: WordBuilder = (rng, level) => {
  if (level !== 'L3') return null
  const name = pick(rng, NAMES)
  const idx1 = randInt(rng, 0, SHOPS.length - 1)
  let idx2 = randInt(rng, 0, SHOPS.length - 1)
  while (idx2 === idx1) idx2 = randInt(rng, 0, SHOPS.length - 1)
  const item1 = SHOPS[idx1]
  const item2 = SHOPS[idx2]
  const price1 = randInt(rng, 3, 9)
  let price2 = randInt(rng, 3, 9)
  while (price2 === price1) price2 = randInt(rng, 3, 9)
  let quantity1 = randInt(rng, 2, 7)
  let quantity2 = randInt(rng, 2, 7)
  let part1 = price1 * quantity1
  let part2 = price2 * quantity2
  // 两种商品的花费必须不同，比较才有意义
  while (part1 === part2) {
    quantity2 = quantity2 === 7 ? 2 : quantity2 + 1
    part2 = price2 * quantity2
  }
  const more = part1 > part2
  const diff = Math.abs(part1 - part2)
  return {
    stem: `文具店里${item1.noun}每${item1.unit} ${price1} 元，${item2.noun}每${item2.unit} ${price2} 元。${name} 买了 ${quantity1} ${item1.unit}${item1.noun}和 ${quantity2} ${item2.unit}${item2.noun}。①买${item1.noun}花了多少元？②买${item2.noun}花了多少元？③哪种商品花得多？多多少元？`,
    questions: [`买${item1.noun}花了多少元？`, `买${item2.noun}花了多少元？`, '哪种商品花得多？多多少元？'],
    answers: [String(part1), String(part2), `${more ? item1.noun : item2.noun}，${diff}`],
    steps: [
      step(1, `${price1} × ${quantity1}`, part1, `${price1} × ${quantity1} = ${part1}（元）`),
      step(2, `${price2} × ${quantity2}`, part2, `${price2} × ${quantity2} = ${part2}（元）`),
      step(3, `${Math.max(part1, part2)} - ${Math.min(part1, part2)}`, diff, `${Math.max(part1, part2)} - ${Math.min(part1, part2)} = ${diff}（元），${more ? item1.noun : item2.noun}花得多`),
    ],
    params: {
      price1,
      quantity1,
      price2,
      quantity2,
      part1,
      part2,
      more: more ? 1 : 0,
      noun1: item1.noun,
      noun2: item2.noun,
      mode: 'compare',
    },
    features: { form: 'shopCompare', level, questions: 3, steps: 3, judge: false },
  }
}

// ---------- 满减（3A-U1 L3 的推理形态） ----------

const buildDiscount: WordBuilder = (rng, level) => {
  if (level !== 'L3') return null
  const name = pick(rng, NAMES)
  const idx1 = randInt(rng, 0, SHOPS.length - 1)
  let idx2 = randInt(rng, 0, SHOPS.length - 1)
  while (idx2 === idx1) idx2 = randInt(rng, 0, SHOPS.length - 1)
  const item1 = SHOPS[idx1]
  const item2 = SHOPS[idx2]
  const price1 = randInt(rng, 10, 15)
  let price2 = randInt(rng, 10, 15)
  while (price2 === price1) price2 = randInt(rng, 10, 15)
  const quantity1 = randInt(rng, 3, 6)
  let quantity2 = randInt(rng, 3, 6)
  if (quantity2 === quantity1) quantity2 = quantity1 === 6 ? 5 : quantity1 + 1
  const part1 = price1 * quantity1
  const part2 = price2 * quantity2
  const total = part1 + part2
  const discount = Math.floor(total / 50) * 5
  const actual = total - discount
  return {
    stem: `文具店开展“每满 50 元减 5 元”的活动。${item1.noun}每${item1.unit} ${price1} 元，${item2.noun}每${item2.unit} ${price2} 元。${name} 买了 ${quantity1} ${item1.unit}${item1.noun}和 ${quantity2} ${item2.unit}${item2.noun}。①按原价一共多少元？②实际要付多少元？`,
    questions: ['按原价一共多少元？', '实际要付多少元？'],
    answers: [String(total), String(actual)],
    steps: [
      step(1, `${price1} × ${quantity1}`, part1, `${price1} × ${quantity1} = ${part1}（元）`),
      step(1, `${price2} × ${quantity2}`, part2, `${price2} × ${quantity2} = ${part2}（元）`),
      step(1, `${part1} + ${part2}`, total, `${part1} + ${part2} = ${total}（元）`),
      step(2, `${total} - ${discount}`, actual, `${total} - ${discount} = ${actual}（元）`),
    ],
    params: { total, discount, actual, mode: 'discount' },
    features: { form: 'discount', level, questions: 2, steps: 4, judge: false },
  }
}

// ---------- 行程 ----------

const buildTrip: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const speed = randInt(rng, 4, 8) * 10
    const hours = randInt(rng, 2, 5)
    const distance = speed * hours
    const variant = randInt(rng, 0, 2)
    const vehicle = ['汽车', '客车', '货车'][variant]
    const stem =
      variant === 0
        ? `一辆${vehicle}每小时行 ${speed} 千米，${hours} 小时一共行多少千米？`
        : variant === 1
          ? `${vehicle}在高速公路上每小时行驶 ${speed} 千米，行驶 ${hours} 小时后，一共行驶了多少千米？`
          : `一辆${vehicle}从甲地开往乙地，平均每小时行 ${speed} 千米，${hours} 小时到达。甲、乙两地相距多少千米？`
    return {
      stem,
      questions: ['一共行多少千米？'],
      answers: [String(distance)],
      steps: [step(1, `${speed} × ${hours}`, distance, `${speed} × ${hours} = ${distance}（千米）`)],
      params: { speed, hours, mode: 'distance' },
      features: { form: 'trip', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const speed = randInt(rng, 1, 3) * 10
    const hours = randInt(rng, 2, 4)
    const distance = speed * hours
    const total = distance * 2
    return {
      stem: `小明骑自行车每小时行 ${speed} 千米，去时用了 ${hours} 小时，原路返回也用了 ${hours} 小时。①去时骑了多少千米？②往返一共骑了多少千米？`,
      questions: ['去时骑了多少千米？', '往返一共骑了多少千米？'],
      answers: [String(distance), String(total)],
      steps: [
        step(1, `${speed} × ${hours}`, distance, `${speed} × ${hours} = ${distance}（千米）`),
        step(2, `${distance} × 2`, total, `${distance} × 2 = ${total}（千米）`),
      ],
      params: { speed, hours, mode: 'roundTrip' },
      features: { form: 'trip', level, questions: 2, steps: 2, judge: false },
    }
  }
  const speed = randInt(rng, 4, 9) * 10 // 都是整十数，折半后仍是整千米
  const hours = randInt(rng, 2, 4)
  const departHour = 8
  const arriveHour = departHour + hours
  const distance = speed * hours
  const need = distance / (hours - 1)
  return {
    stem: `一辆汽车 ${departHour} 时从甲地出发，每小时行 ${speed} 千米，${arriveHour} 时到达乙地。①甲、乙两地相距多少千米？②如果要在 ${arriveHour - 1} 时到达，平均每小时至少要行多少千米？`,
    questions: ['甲、乙两地相距多少千米？', '平均每小时至少要行多少千米？'],
    answers: [String(distance), String(need)],
    steps: [
      step(1, `${speed} × ${hours}`, distance, `${speed} × ${hours} = ${distance}（千米）`),
      step(2, `${distance} ÷ ${hours - 1}`, need, `${distance} ÷ ${hours - 1} = ${need}（千米）`),
    ],
    params: { speed, hours, mode: 'deadline' },
    features: { form: 'trip', level, questions: 2, steps: 2, judge: false },
  }
}

// ---------- 时间安排 ----------

const buildTimePlan: WordBuilder = (rng, level) => {
  const name = pick(rng, NAMES)
  if (level === 'L1') {
    const startHour = randInt(rng, 8, 17)
    const startMinute = randInt(rng, 0, 5) * 10
    const duration = randInt(rng, 2, 5) * 10
    const total = startHour * 60 + startMinute + duration
    const endHour = Math.floor(total / 60)
    const endMinute = total % 60
    return {
      stem: `${name} ${timeText(startHour, startMinute)} 开始做作业，做了 ${duration} 分钟。什么时候做完？`,
      questions: ['什么时候做完？'],
      answers: [answerTime(endHour, endMinute)],
      steps: [
        step(
          1,
          `${startHour} 时 ${startMinute} 分 + ${duration} 分`,
          total,
          `${timeText(startHour, startMinute)} + ${duration} 分 = ${answerTime(endHour, endMinute)}`,
        ),
      ],
      params: { startHour, startMinute, duration, mode: 'endTime' },
      features: { form: 'timePlan', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const startHour = pick(rng, [8, 9])
    const startMinute = randInt(rng, 0, 2) * 10
    const lesson = randInt(rng, 7, 9) * 5
    const rest = pick(rng, [10, 15])
    // 同一难度至少 4 个上课场景，避免整档只有“学校上课”一句
    const place = pick(rng, ['学校', '少年宫', '培训中心', '游泳馆', '图书馆', '科技馆'])
    const firstEnd = startHour * 60 + startMinute + lesson
    const secondStart = firstEnd + rest
    const e1h = Math.floor(firstEnd / 60)
    const e1m = firstEnd % 60
    const s2h = Math.floor(secondStart / 60)
    const s2m = secondStart % 60
    return {
      stem: `${place} ${timeText(startHour, startMinute)} 开始上第一节课，一节课 ${lesson} 分钟，课间休息 ${rest} 分钟。①第一节课什么时候下课？②第二节课什么时候上课？`,
      questions: ['第一节课什么时候下课？', '第二节课什么时候上课？'],
      answers: [answerTime(e1h, e1m), answerTime(s2h, s2m)],
      steps: [
        step(
          1,
          `第一节课 ${lesson} 分钟`,
          firstEnd,
          `${timeText(startHour, startMinute)} + ${lesson} 分 = ${answerTime(e1h, e1m)}`,
        ),
        step(2, `课间休息 ${rest} 分钟`, secondStart, `${answerTime(e1h, e1m)} + ${rest} 分 = ${answerTime(s2h, s2m)}`),
      ],
      params: { startHour, startMinute, lesson, rest, place, mode: 'lesson' },
      features: { form: 'timePlan', level, questions: 2, steps: 2, judge: false },
    }
  }
  const classHour = 8
  const classMinute = randInt(rng, 0, 3) * 10
  const duration = randInt(rng, 2, 4) * 10
  const early = pick(rng, [5, 10])
  // 同一难度至少 4 个场景，避免整档只有“去学校上课”一句
  const scene = pick(rng, [
    { place: '学校', event: '上课' },
    { place: '少年宫', event: '活动' },
    { place: '图书馆', event: '开馆' },
    { place: '电影院', event: '放映' },
  ])
  const { place, event } = scene
  const departure = classHour * 60 + classMinute - duration - early
  const departureHour = Math.floor(departure / 60)
  const departureMinute = departure % 60
  return {
    // “最迟”是上界语义：再晚就赶不上；不能用“至少”
    stem: `${place} ${timeText(classHour, classMinute)} 开始${event}，从家到${place}要走 ${duration} 分钟。${name} 想提前 ${early} 分钟到${place}，${name}最迟要在几时几分从家出发？`,
    questions: ['最迟要在几时几分从家出发？'],
    answers: [answerTime(departureHour, departureMinute)],
    steps: [
      step(
        1,
        `${classHour} 时 ${classMinute} 分 - ${duration} 分 - ${early} 分`,
        departure,
        `${classHour} 时 ${classMinute} 分 - ${duration} 分 - ${early} 分 = ${answerTime(departureHour, departureMinute)}`,
      ),
    ],
    params: { classHour, classMinute, duration, early, place, event, mode: 'latestDeparture' },
    features: { form: 'timePlan', level, questions: 1, steps: 1, judge: true },
  }
}

// ---------- 长度与周长 ----------

const buildPerimeter: WordBuilder = (rng, level) => {
  if (level === 'L3') {
    // 四个变式轮换，避免单模板占比过高；所有尺寸与所求单位一致
    const variant = randInt(rng, 0, 3)
    if (variant === 0) {
      const side = randInt(rng, 6, 15)
      const offset = randInt(rng, 1, 3)
      const length = side + offset
      const width = side - offset
      const wire = side * 4
      const noun = pick(rng, ['铁丝', '彩带'])
      return {
        stem: `用一根长 ${wire} 厘米的${noun}正好围成一个长方形，长是 ${length} 厘米。①宽是多少厘米？②如果把同样长的${noun}改围成一个正方形，边长是多少厘米？`,
        questions: ['宽是多少厘米？', '边长是多少厘米？'],
        answers: [String(width), String(side)],
        steps: [
          step(1, `${wire} ÷ 2 - ${length}`, width, `${wire} ÷ 2 = ${wire / 2}（厘米），${wire / 2} - ${length} = ${width}（厘米）`),
          step(2, `${wire} ÷ 4`, side, `${wire} ÷ 4 = ${side}（厘米）`),
        ],
        params: { length, width, wire, unit: '厘米', mode: 'rectangleAndSquare' },
        features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
      }
    }
    if (variant === 1) {
      const width = randInt(rng, 4, 12)
      const length = width + randInt(rng, 2, 6)
      const wire = 2 * (length + width)
      const noun = pick(rng, ['铁丝', '绳子'])
      return {
        stem: `一根长 ${wire} 厘米的${noun}正好围成一个长方形，宽是 ${width} 厘米。这个长方形的长是多少厘米？`,
        questions: ['这个长方形的长是多少厘米？'],
        answers: [String(length)],
        steps: [
          step(1, `${wire} ÷ 2 - ${width}`, length, `${wire} ÷ 2 = ${wire / 2}（厘米），${wire / 2} - ${width} = ${length}（厘米）`),
        ],
        params: { length, width, wire, unit: '厘米', mode: 'wireReverseLength' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 2) {
      const side = randInt(rng, 5, 12)
      const width = randInt(rng, 2, side - 1)
      const length = side * 2 - width
      const wire = side * 4
      const noun = pick(rng, ['铁丝', '绳子'])
      return {
        stem: `用一根长 ${wire} 分米的${noun}围成一个正方形。如果改围成一个宽 ${width} 分米的长方形，长是多少分米？`,
        questions: ['长是多少分米？'],
        answers: [String(length)],
        steps: [
          step(1, `${wire} ÷ 2 - ${width}`, length, `${wire} ÷ 2 = ${wire / 2}（分米），${wire / 2} - ${width} = ${length}（分米）`),
        ],
        params: { length, width, wire, unit: '分米', mode: 'squareToRectangle' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    const width = randInt(rng, 3, 9)
    const diff = randInt(rng, 2, 6)
    const length = width + diff
    const wire = 2 * (length + width)
    const noun = pick(rng, ['铁丝', '绳子'])
    return {
      stem: `一根长 ${wire} 米的${noun}围成一个长方形，长比宽多 ${diff} 米。①宽是多少米？②长是多少米？`,
      questions: ['宽是多少米？', '长是多少米？'],
      answers: [String(width), String(length)],
      steps: [
        step(1, `(${wire} ÷ 2 - ${diff}) ÷ 2`, width, `${wire} ÷ 2 = ${wire / 2}（米），${wire / 2} - ${diff} = ${wire / 2 - diff}（米），${wire / 2 - diff} ÷ 2 = ${width}（米）`),
        step(2, `${width} + ${diff}`, length, `${width} + ${diff} = ${length}（米）`),
      ],
      params: { length, width, diff, wire, unit: '米', mode: 'wireDiff' },
      features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (level === 'L1') {
    // 本单元以“四周围一圈”为主，靠墙/留门/改围等变式也已归并到本单元，按两成上限取样
    const variant = randInt(rng, 0, 5)
    if (variant === 2) {
      const lengthCm = randInt(rng, 16, 30)
      const widthCm = randInt(rng, 10, lengthCm - 1)
      const perimeterCm = 2 * (lengthCm + widthCm)
      return {
        stem: `一个长方形相框长 ${lengthCm} 厘米，宽 ${widthCm} 厘米。在相框四周装一圈花边，一共要多少厘米？`,
        questions: ['一共要多少厘米？'],
        answers: [String(perimeterCm)],
        steps: [step(1, `(${lengthCm} + ${widthCm}) × 2`, perimeterCm, `(${lengthCm} + ${widthCm}) × 2 = ${perimeterCm}（厘米）`)],
        params: { length: lengthCm, width: widthCm, scene: '相框', unit: '厘米', mode: 'perimeter' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 3) {
      const width = randInt(rng, 2, 6)
      const length = randInt(rng, width + 2, width + 8)
      const perimeterDm = 2 * (length + width)
      return {
        stem: `一块长方形桌布长 ${length} 分米，宽 ${width} 分米。在桌布四周缝一圈花边，一共要多少分米？`,
        questions: ['一共要多少分米？'],
        answers: [String(perimeterDm)],
        steps: [step(1, `(${length} + ${width}) × 2`, perimeterDm, `(${length} + ${width}) × 2 = ${perimeterDm}（分米）`)],
        params: { length, width, scene: '桌布', unit: '分米', mode: 'perimeter' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 4) {
      const length = randInt(rng, 8, 18)
      const width = randInt(rng, 3, 7)
      const perimeter = 2 * (length + width)
      return {
        stem: `一块长方形黑板长 ${length} 分米，宽 ${width} 分米。给黑板四周装一圈边框，一共要多少分米？`,
        questions: ['一共要多少分米？'],
        answers: [String(perimeter)],
        steps: [step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（分米）`)],
        params: { length, width, scene: '黑板', unit: '分米', mode: 'perimeter' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 5) {
      const length = randInt(rng, 10, 20)
      const width = randInt(rng, 6, length - 1)
      const perimeter = 2 * (length + width)
      return {
        stem: `一块长方形手帕长 ${length} 厘米，宽 ${width} 厘米。在手帕四周缝一圈花边，一共要多少厘米？`,
        questions: ['一共要多少厘米？'],
        answers: [String(perimeter)],
        steps: [step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（厘米）`)],
        params: { length, width, scene: '手帕', unit: '厘米', mode: 'perimeter' },
        features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
      }
    }
    const scene = variant === 0
      ? { measure: '一个', noun: '长方形花坛', ask: '绕花坛走一周，一共要走多少米？', answer: '一共要走多少米？' }
      : { measure: '一块', noun: '长方形宣传栏', ask: '给它的四周贴一圈彩带，一共要多少米？', answer: '一共要多少米？' }
    const length = randInt(rng, 5, 12)
    const width = randInt(rng, 2, length - 1)
    const perimeter = 2 * (length + width)
    return {
      stem: `${scene.measure}${scene.noun}长 ${length} 米，宽 ${width} 米。${scene.ask}`,
      questions: [scene.answer],
      answers: [String(perimeter)],
      steps: [step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（米）`)],
      params: { length, width, scene: scene.noun, unit: '米', mode: 'perimeter' },
      features: { form: 'perimeter', level, questions: 1, steps: 1, judge: false },
    }
  }
  // L2：六种场景按数值轮换，保持题干骨架各不相同
  const variant = randInt(rng, 0, 5)
  if (variant === 1) {
    const lengthCm = randInt(rng, 12, 24)
    const widthCm = randInt(rng, 8, lengthCm - 1)
    const perimeterCm = 2 * (lengthCm + widthCm)
    const unitPrice = randInt(rng, 2, 5)
    return {
      stem: `一个长方形相框长 ${lengthCm} 厘米，宽 ${widthCm} 厘米。①花边长多少厘米？②如果每厘米花边 ${unitPrice} 元，一共要多少元？`,
      questions: ['花边长多少厘米？', '一共要多少元？'],
      answers: [String(perimeterCm), String(perimeterCm * unitPrice)],
      steps: [
        step(1, `(${lengthCm} + ${widthCm}) × 2`, perimeterCm, `(${lengthCm} + ${widthCm}) × 2 = ${perimeterCm}（厘米）`),
        step(2, `${perimeterCm} × ${unitPrice}`, perimeterCm * unitPrice, `${perimeterCm} × ${unitPrice} = ${perimeterCm * unitPrice}（元）`),
      ],
      params: { length: lengthCm, width: widthCm, unit: '厘米', unitPrice, mode: 'frameCost' },
      features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (variant === 2) {
    const length = randInt(rng, 6, 14)
    const width = randInt(rng, 3, length - 1)
    const perimeter = 2 * (length + width)
    const unitPrice = randInt(rng, 2, 6)
    return {
      stem: `一块长方形展板长 ${length} 分米，宽 ${width} 分米。①边框长多少分米？②如果每分米边框 ${unitPrice} 元，一共要多少元？`,
      questions: ['边框长多少分米？', '一共要多少元？'],
      answers: [String(perimeter), String(perimeter * unitPrice)],
      steps: [
        step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（分米）`),
        step(2, `${perimeter} × ${unitPrice}`, perimeter * unitPrice, `${perimeter} × ${unitPrice} = ${perimeter * unitPrice}（元）`),
      ],
      params: { length, width, unit: '分米', unitPrice, mode: 'boardCost' },
      features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (variant === 4) {
    const lengthCm = randInt(rng, 12, 24)
    const widthCm = randInt(rng, 8, lengthCm - 1)
    const perimeterCm = 2 * (lengthCm + widthCm)
    const unitPrice = randInt(rng, 2, 5)
    return {
      stem: `一个长方形画框长 ${lengthCm} 厘米，宽 ${widthCm} 厘米。①画框的边框长多少厘米？②如果每厘米边框 ${unitPrice} 元，一共要多少元？`,
      questions: ['画框的边框长多少厘米？', '一共要多少元？'],
      answers: [String(perimeterCm), String(perimeterCm * unitPrice)],
      steps: [
        step(1, `(${lengthCm} + ${widthCm}) × 2`, perimeterCm, `(${lengthCm} + ${widthCm}) × 2 = ${perimeterCm}（厘米）`),
        step(2, `${perimeterCm} × ${unitPrice}`, perimeterCm * unitPrice, `${perimeterCm} × ${unitPrice} = ${perimeterCm * unitPrice}（元）`),
      ],
      params: { length: lengthCm, width: widthCm, unit: '厘米', unitPrice, mode: 'frameCost' },
      features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (variant === 5) {
    const length = randInt(rng, 6, 14)
    const width = randInt(rng, 3, length - 1)
    const perimeter = 2 * (length + width)
    const unitPrice = randInt(rng, 3, 8)
    return {
      stem: `一块长方形地毯长 ${length} 米，宽 ${width} 米。①地毯四周的包边长多少米？②如果每米包边 ${unitPrice} 元，一共要多少元？`,
      questions: ['地毯四周的包边长多少米？', '一共要多少元？'],
      answers: [String(perimeter), String(perimeter * unitPrice)],
      steps: [
        step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（米）`),
        step(2, `${perimeter} × ${unitPrice}`, perimeter * unitPrice, `${perimeter} × ${unitPrice} = ${perimeter * unitPrice}（元）`),
      ],
      params: { length, width, unit: '米', unitPrice, scene: '地毯', mode: 'fenceCost' },
      features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
    }
  }
  const length = randInt(rng, 5, 12)
  const width = randInt(rng, 2, length - 1)
  const perimeter = 2 * (length + width)
  const unitPrice = randInt(rng, 3, 8)
  const cost = perimeter * unitPrice
  const scene = variant === 3
    ? { measure: '一块', noun: '长方形菜地', thing: '围栏' }
    : { measure: '一个', noun: '长方形花坛', thing: '护栏' }
  return {
    stem: `${scene.measure}${scene.noun}长 ${length} 米，宽 ${width} 米。工人师傅要给它的四周围一圈${scene.thing}。①${scene.thing}长多少米？②如果每米${scene.thing} ${unitPrice} 元，一共要多少元？`,
    questions: [`${scene.thing}长多少米？`, '一共要多少元？'],
    answers: [String(perimeter), String(cost)],
    steps: [
      step(1, `(${length} + ${width}) × 2`, perimeter, `(${length} + ${width}) × 2 = ${perimeter}（米）`),
      step(2, `${perimeter} × ${unitPrice}`, cost, `${perimeter} × ${unitPrice} = ${cost}（元）`),
    ],
    params: { length, width, unit: '米', unitPrice, scene: scene.noun, mode: 'fenceCost' },
    features: { form: 'perimeter', level, questions: 2, steps: 2, judge: false },
  }
}

// ---------- 一面靠墙的篱笆（原 3A-U8，已并入 U6） ----------

const WALL_SCENES = ['菜地', '花圃', '苗圃', '果园']

const buildWallFence: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const variant = randInt(rng, 0, 3)
    const width = randInt(rng, 2, 6)
    const length = randInt(rng, width + 2, width + 8)
    const scene = WALL_SCENES[(length + width) % WALL_SCENES.length]
    if (variant === 0) {
      const fence = length + width * 2
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。长边靠墙，三面围上篱笆。篱笆一共长多少米？`,
        questions: ['篱笆一共长多少米？'],
        answers: [String(fence)],
        steps: [step(1, `${width} × 2 + ${length}`, fence, `${width} × 2 = ${width * 2}（米），${width * 2} + ${length} = ${fence}（米）`)],
        params: { length, width, fence, unit: '米', mode: 'longSideWall' },
        features: { form: 'wallFence', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 1) {
      const fence = length * 2 + width
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。宽边靠墙，三面围上篱笆。篱笆一共长多少米？`,
        questions: ['篱笆一共长多少米？'],
        answers: [String(fence)],
        steps: [step(1, `${length} × 2 + ${width}`, fence, `${length} × 2 = ${length * 2}（米），${length * 2} + ${width} = ${fence}（米）`)],
        params: { length, width, fence, unit: '米', mode: 'shortSideWall' },
        features: { form: 'wallFence', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (variant === 2) {
      const fence = length + width
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。它相邻的长边和宽边正好靠墙，只围另外两边。篱笆一共长多少米？`,
        questions: ['篱笆一共长多少米？'],
        answers: [String(fence)],
        steps: [step(1, `${length} + ${width}`, fence, `${length} + ${width} = ${fence}（米）`)],
        params: { length, width, fence, unit: '米', mode: 'twoSidesWall' },
        features: { form: 'wallFence', level, questions: 1, steps: 1, judge: false },
      }
    }
    const gate = randInt(rng, 1, 2)
    const fence = 2 * (length + width) - gate
    return {
      stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。四周围上篱笆，留一个 ${gate} 米宽的门。篱笆一共长多少米？`,
      questions: ['篱笆一共长多少米？'],
      answers: [String(fence)],
      steps: [step(1, `(${length} + ${width}) × 2 - ${gate}`, fence, `(${length} + ${width}) × 2 = ${2 * (length + width)}（米），${2 * (length + width)} - ${gate} = ${fence}（米）`)],
      params: { length, width, gate, fence, unit: '米', mode: 'gate' },
      features: { form: 'wallFence', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const variant = randInt(rng, 0, 3)
    const length = randInt(rng, 6, 12)
    const width = randInt(rng, 2, length - 2)
    const scene = WALL_SCENES[(length + width) % WALL_SCENES.length]
    const unitPrice = randInt(rng, 4, 9)
    if (variant === 1) {
      const fence = length * 2 + width
      const cost = fence * unitPrice
      return {
        stem: `一个长方形${scene}长 ${length} 米，宽 ${width} 米。宽边靠墙，三面围上篱笆。①篱笆长多少米？②如果每米篱笆 ${unitPrice} 元，一共要多少元？`,
        questions: ['篱笆长多少米？', '一共要多少元？'],
        answers: [String(fence), String(cost)],
        steps: [
          step(1, `${length} × 2 + ${width}`, fence, `${length} × 2 = ${length * 2}（米），${length * 2} + ${width} = ${fence}（米）`),
          step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
        ],
        params: { length, width, fence, unit: '米', unitPrice, mode: 'shortSideWall' },
        features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
      }
    }
    if (variant === 2) {
      const fence = length + width
      const cost = fence * unitPrice
      return {
        stem: `一个长方形${scene}长 ${length} 米，宽 ${width} 米。相邻的长边和宽边靠墙，只围另外两边。①篱笆长多少米？②如果每米篱笆 ${unitPrice} 元，一共要多少元？`,
        questions: ['篱笆长多少米？', '一共要多少元？'],
        answers: [String(fence), String(cost)],
        steps: [
          step(1, `${length} + ${width}`, fence, `${length} + ${width} = ${fence}（米）`),
          step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
        ],
        params: { length, width, fence, unit: '米', unitPrice, mode: 'twoSidesWall' },
        features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
      }
    }
    if (variant === 3) {
      const gate = randInt(rng, 1, 2)
      const fence = 2 * (length + width) - gate
      const cost = fence * unitPrice
      return {
        stem: `一个长方形${scene}长 ${length} 米，宽 ${width} 米。四周围上篱笆，留一个 ${gate} 米宽的门。①篱笆长多少米？②如果每米篱笆 ${unitPrice} 元，一共要多少元？`,
        questions: ['篱笆长多少米？', '一共要多少元？'],
        answers: [String(fence), String(cost)],
        steps: [
          step(1, `(${length} + ${width}) × 2 - ${gate}`, fence, `(${length} + ${width}) × 2 = ${2 * (length + width)}（米），${2 * (length + width)} - ${gate} = ${fence}（米）`),
          step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
        ],
        params: { length, width, gate, fence, unit: '米', unitPrice, mode: 'gate' },
        features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
      }
    }
    const fence = length + width * 2
    const cost = fence * unitPrice
    return {
      stem: `一个长方形${scene}长 ${length} 米，宽 ${width} 米。长边靠墙，三面围上篱笆。①篱笆长多少米？②如果每米篱笆 ${unitPrice} 元，一共要多少元？`,
      questions: ['篱笆长多少米？', '一共要多少元？'],
      answers: [String(fence), String(cost)],
      steps: [
        step(1, `${width} × 2 + ${length}`, fence, `${width} × 2 = ${width * 2}（米），${width * 2} + ${length} = ${fence}（米）`),
        step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
      ],
      params: { length, width, fence, unit: '米', unitPrice, mode: 'longSideWall' },
      features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
    }
  }
  const variant = randInt(rng, 0, 2)
  const width = randInt(rng, 3, 8)
  const length = randInt(rng, width + 2, width + 9)
  const scene = WALL_SCENES[(length + width) % WALL_SCENES.length]
  const unitPrice = randInt(rng, 4, 9)
  if (variant === 1) {
    const fence = length * 2 + width
    const cost = fence * unitPrice
    return {
      stem: `一块长方形${scene}宽边靠墙，三面围上篱笆，一共用去 ${fence} 米。已知${scene}长 ${length} 米。①${scene}宽多少米？②如果每米篱笆 ${unitPrice} 元，这些篱笆一共要多少元？`,
      questions: [`${scene}宽多少米？`, '这些篱笆一共要多少元？'],
      answers: [String(width), String(cost)],
      steps: [
        step(1, `(${fence} - ${length} × 2)`, width, `${length} × 2 = ${length * 2}（米），${fence} - ${length * 2} = ${width}（米）`),
        step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
      ],
      params: { length, width, fence, unit: '米', unitPrice, mode: 'reverseWidth' },
      features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (variant === 2) {
    const gate = randInt(rng, 1, 2)
    const fence = 2 * (length + width) - gate
    return {
      stem: `一块长方形${scene}四周围上篱笆，留一个 ${gate} 米宽的门，篱笆一共长 ${fence} 米。已知${scene}宽 ${width} 米。${scene}长多少米？`,
      questions: [`${scene}长多少米？`],
      answers: [String(length)],
      steps: [
        step(1, `(${fence} + ${gate}) ÷ 2 - ${width}`, length, `${fence} + ${gate} = ${fence + gate}（米），${fence + gate} ÷ 2 = ${(fence + gate) / 2}（米），${(fence + gate) / 2} - ${width} = ${length}（米）`),
      ],
      params: { length, width, gate, fence, unit: '米', mode: 'gateReverse' },
      features: { form: 'wallFence', level, questions: 1, steps: 1, judge: false },
    }
  }
  const fence = length + width * 2
  const cost = fence * unitPrice
  return {
    stem: `一块长方形${scene}长边靠墙，三面围上篱笆，一共用去 ${fence} 米。已知${scene}宽 ${width} 米。①${scene}长多少米？②如果每米篱笆 ${unitPrice} 元，这些篱笆一共要多少元？`,
    questions: [`${scene}长多少米？`, '这些篱笆一共要多少元？'],
    answers: [String(length), String(cost)],
    steps: [
      step(1, `${fence} - ${width} × 2`, length, `${width} × 2 = ${width * 2}（米），${fence} - ${width * 2} = ${length}（米）`),
      step(2, `${fence} × ${unitPrice}`, cost, `${fence} × ${unitPrice} = ${cost}（元）`),
    ],
    params: { length, width, fence, unit: '米', unitPrice, mode: 'fenceReverse' },
    features: { form: 'wallFence', level, questions: 2, steps: 2, judge: false },
  }
}

// ---------- 面积 ----------

const buildArea: WordBuilder = (rng, level) => {
  if (level === 'L3') {
    const length = randInt(rng, 6, 12)
    const width = randInt(rng, 3, length - 1)
    const area = length * width
    const unitPrice = randInt(rng, 20, 40)
    const total = area * unitPrice
    const enough = rng() < 0.5
    // 整百预算，差额至少 100 元，避免“带 666 元”这类非现实付款
    const money = budgetRounded(total, enough)
    // 8 个真实情境轮换，避免“草坪占 41%”这类单模板集中
    const scenes = [
      { measure: '一块', noun: '草坪', material: '草皮', action: '铺满' },
      { measure: '一块', noun: '花坛', material: '草皮', action: '铺满' },
      { measure: '一块', noun: '菜地', material: '地膜', action: '铺满' },
      { measure: '一块', noun: '绿地', material: '草皮', action: '铺满' },
      { measure: '一块', noun: '球场', material: '塑胶', action: '铺满' },
      { measure: '一块', noun: '麦田', material: '地膜', action: '铺满' },
      { measure: '一间', noun: '教室地面', material: '地砖', action: '铺满' },
      { measure: '一面', noun: '墙面', material: '墙纸', action: '贴满' },
    ]
    const scene = scenes[randInt(rng, 0, scenes.length - 1)]
    return {
      stem: `${scene.measure}长方形${scene.noun}长 ${length} 米，宽 ${width} 米。①${scene.noun}的面积是多少平方米？②如果每平方米${scene.material} ${unitPrice} 元，${scene.action}${scene.noun}一共要多少元？③带 ${money} 元够不够？`,
      questions: [`${scene.noun}的面积是多少平方米？`, `${scene.action}${scene.noun}一共要多少元？`, '带这些钱够不够？'],
      answers: [String(area), String(total), enough ? '够' : '不够'],
      steps: [
        step(1, `${length} × ${width}`, area, `${length} × ${width} = ${area}（平方米）`),
        step(2, `${area} × ${unitPrice}`, total, `${area} × ${unitPrice} = ${total}（元）`),
        judgeStep(
          3,
          enough
            ? `${money} 元 > ${total} 元，带的钱够`
            : `${money} 元 < ${total} 元，带的钱不够`,
          enough,
        ),
      ],
      params: { length, width, unitPrice, money, scene: scene.noun, unit: '米', mode: 'lawnBudget' },
      features: { form: 'area', level, questions: 3, steps: 3, judge: true },
    }
  }
  const length = randInt(rng, 5, 12)
  const width = randInt(rng, 2, length - 1)
  const area = length * width
  if (level === 'L1') {
    // 按长宽组合轮换场景，避免随机抽到同一句式占多数（评审 F1 要求模板轮换）
    const scenes = [
      { measure: '一块', noun: '长方形菜地', ask: '它的面积是多少平方米？' },
      { measure: '一块', noun: '长方形黑板', ask: '黑板的面积是多少平方米？' },
      { measure: '一块', noun: '长方形草坪', ask: '草坪的面积是多少平方米？' },
      { measure: '一个', noun: '长方形花坛', ask: '给花坛铺草皮，一共需要多少平方米草皮？' },
      { measure: '一块', noun: '长方形广告牌', ask: '做这块广告牌需要多少平方米材料？' },
    ]
    const scene = scenes[(length + width) % scenes.length]
    return {
      stem: `${scene.measure}${scene.noun}长 ${length} 米，宽 ${width} 米。${scene.ask}`,
      questions: [scene.ask],
      answers: [String(area)],
      steps: [step(1, `${length} × ${width}`, area, `${length} × ${width} = ${area}（平方米）`)],
      params: { length, width, unit: '米', mode: 'area' },
      features: { form: 'area', level, questions: 1, steps: 1, judge: false },
    }
  }
  const tile = pick(rng, [4, 5, 10, 20, 25])
  const areaDm2 = area * 100
  const tiles = areaDm2 / tile
  const scenes = [
    { noun: '教室地面', measure: '间' },
    { noun: '客厅地面', measure: '间' },
    { noun: '走廊地面', measure: '条' },
    { noun: '厨房地面', measure: '间' },
    { noun: '书房地面', measure: '间' },
  ]
  const scene = scenes[(length + width) % scenes.length]
  return {
    stem: `${scene.measure === '条' ? '一条' : '一间'}${scene.noun}长 ${length} 米，宽 ${width} 米。用面积是 ${tile} 平方分米的方砖铺地。①地面面积是多少平方分米？②至少需要多少块方砖？`,
    questions: ['地面面积是多少平方分米？', '至少需要多少块方砖？'],
    answers: [String(areaDm2), String(tiles)],
    steps: [
      step(1, `${length} × ${width}`, area, `${length} × ${width} = ${area}（平方米）`),
      step(1, `${area} × 100`, areaDm2, `${area} 平方米 = ${areaDm2} 平方分米`),
      step(2, `${areaDm2} ÷ ${tile}`, tiles, `${areaDm2} ÷ ${tile} = ${tiles}（块）`),
    ],
    params: { length, width, tile, unit: '米', mode: 'tiles' },
    features: { form: 'area', level, questions: 2, steps: 3, judge: false },
  }
}

// ---------- 平均分与装袋 ----------

const buildShare: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const plates = randInt(rng, 3, 6)
    const each = randInt(rng, 3, 8)
    const apples = plates * each
    return {
      stem: `有 ${apples} 个苹果，平均放进 ${plates} 个盘子里，每个盘子放几个？`,
      questions: ['每个盘子放几个？'],
      answers: [String(each)],
      steps: [step(1, `${apples} ÷ ${plates}`, each, `${apples} ÷ ${plates} = ${each}（个）`)],
      params: { apples, plates, each, mode: 'equalShare' },
      features: { form: 'share', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const capacity = randInt(rng, 4, 8)
    const full = randInt(rng, 3, 9)
    const rest = randInt(rng, 1, capacity - 1)
    const students = capacity * full + rest
    return {
      stem: `三年级 ${students} 名同学去划船，每条船最多坐 ${capacity} 人。①至少需要几条船？②最后一条船坐几人？`,
      questions: ['至少需要几条船？', '最后一条船坐几人？'],
      answers: [String(full + 1), String(rest)],
      steps: [
        step(
          1,
          `${students} ÷ ${capacity}`,
          full,
          `${students} ÷ ${capacity} = ${full}（条）……${rest}（人）`,
          rest,
        ),
        step(1, `${full} + 1`, full + 1, `${full} + 1 = ${full + 1}（条）`),
        // 第二问“最后一条船坐几人”单独对应一步，不能只停留在第一步的余数里
        step(2, `${students} - ${capacity} × ${full}`, rest, `${capacity} × ${full} = ${capacity * full}（人），${students} - ${capacity * full} = ${rest}（人）`),
      ],
      params: { students, capacity, full, rest, mode: 'boats' },
      features: { form: 'share', level, questions: 2, steps: 3, judge: true },
    }
  }
  const price = randInt(rng, 6, 12)
  const count = randInt(rng, 5, 20)
  const rest = randInt(rng, 1, price - 1)
  const money = price * count + rest
  return {
    stem: `老师带 ${money} 元去买跳绳，每根跳绳 ${price} 元。①最多能买几根？②还剩多少元？`,
    questions: ['最多能买几根？', '还剩多少元？'],
    answers: [String(count), String(rest)],
    steps: [
      step(
        1,
        `${money} ÷ ${price}`,
        count,
        `${money} ÷ ${price} = ${count}（根）……${rest}（元）`,
        rest,
      ),
      // 第②问“还剩多少元”必须由“带的钱 - 已用钱”得出，不能写成“根数 × 单价”
      step(2, `${money} - ${count * price}`, rest, `${money} - ${count * price} = ${rest}（元）`),
    ],
    params: { price, count, rest, money, mode: 'maxBuy' },
    features: { form: 'share', level, questions: 2, steps: 2, judge: true },
  }
}

// ---------- 两位数乘除（3B-U2 核心） ----------

const SHOPS2 = [
  { noun: '水彩笔', unit: '盒' },
  { noun: '故事书', unit: '套' },
  { noun: '拼图', unit: '盒' },
  { noun: '笔记本', unit: '本' },
]

const SHOPS3 = [
  { noun: '故事书', unit: '套' },
  { noun: '书包', unit: '个' },
  { noun: '学具', unit: '套' },
  { noun: '台灯', unit: '盏' },
]

const buildShopping2: WordBuilder = (rng, level) => {
  const name = pick(rng, NAMES)
  const item1 = pick(rng, SHOPS2)
  if (level === 'L1') {
    const price = randInt(rng, 12, 39)
    const quantity = randInt(rng, 12, 29)
    const total = price * quantity
    return {
      stem: `文具店里每${item1.unit}${item1.noun} ${price} 元，${name} 买了 ${quantity} ${item1.unit}。一共要付多少元？`,
      questions: ['一共要付多少元？'],
      answers: [String(total)],
      steps: [step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`)],
      params: { price, quantity, mode: 'single2' },
      features: { form: 'shopping2', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const price = randInt(rng, 12, 39)
    const quantity = randInt(rng, 12, 29)
    const total = price * quantity
    const paid = Math.ceil((total + 1) / 10) * 10
    const change = paid - total
    return {
      stem: `每${item1.unit}${item1.noun} ${price} 元，${name} 买了 ${quantity} ${item1.unit}，付给收银员 ${paid} 元。①一共要付多少元？②应找回多少元？`,
      questions: ['一共要付多少元？', '应找回多少元？'],
      answers: [String(total), String(change)],
      steps: [
        step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`),
        step(2, `${paid} - ${total}`, change, `${paid} - ${total} = ${change}（元）`),
      ],
      params: { price, quantity, paid, mode: 'change2' },
      features: { form: 'shopping2', level, questions: 2, steps: 2, judge: false },
    }
  }
  const others = SHOPS2.filter((item) => item.noun !== item1.noun)
  const item2 = pick(rng, others)
  const price1 = randInt(rng, 12, 39)
  const quantity1 = randInt(rng, 12, 19)
  const price2 = randInt(rng, 20, 49)
  const quantity2 = randInt(rng, 12, 19)
  const part1 = price1 * quantity1
  const part2 = price2 * quantity2
  const total = part1 + part2
  const rounded = Math.ceil(total / 100) * 100
  const enough = rng() < 0.5
  const money = enough ? rounded : Math.max(100, rounded - 100)
  const conclusion = money >= total ? '够' : '不够'
  return {
    stem: `文具店里每${item1.unit}${item1.noun} ${price1} 元，每${item2.unit}${item2.noun} ${price2} 元。${name} 要买 ${quantity1} ${item1.unit}${item1.noun}和 ${quantity2} ${item2.unit}${item2.noun}，带 ${money} 元。①一共要付多少元？②带的钱够不够？`,
    questions: ['一共要付多少元？', '带的钱够不够？'],
    answers: [String(total), conclusion],
    steps: [
      step(1, `${price1} × ${quantity1}`, part1, `${price1} × ${quantity1} = ${part1}（元）`),
      step(1, `${price2} × ${quantity2}`, part2, `${price2} × ${quantity2} = ${part2}（元）`),
      step(1, `${part1} + ${part2}`, total, `${part1} + ${part2} = ${total}（元）`),
      judgeStep(
        2,
        money >= total ? `${money} 元 > ${total} 元，带的钱够` : `${money} 元 < ${total} 元，带的钱不够`,
        money >= total,
      ),
    ],
    params: { price1, quantity1, price2, quantity2, money, mode: 'budget2' },
    features: { form: 'shopping2', level, questions: 2, steps: 4, judge: true },
  }
}

const buildBulk: WordBuilder = (rng, level) => {
  const name = pick(rng, NAMES)
  if (level === 'L1') {
    const item = pick(rng, SHOPS3)
    const price = randInt(rng, 108, 399)
    const quantity = randInt(rng, 12, 29)
    const total = price * quantity
    return {
      stem: `学校买奖品，每${item.unit}${item.noun} ${price} 元，买了 ${quantity} ${item.unit}。一共要付多少元？`,
      questions: ['一共要付多少元？'],
      answers: [String(total)],
      steps: [step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`)],
      params: { price, quantity, mode: 'single3' },
      features: { form: 'bulk', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const item = pick(rng, SHOPS3)
    const price = randInt(rng, 108, 399)
    const quantity = randInt(rng, 12, 29)
    const total = price * quantity
    const enough = rng() < 0.5
    let money = enough ? Math.ceil(total / 1000) * 1000 : Math.floor(total / 1000) * 1000
    if (!enough && money >= total) money = Math.max(1000, money - 1000)
    return {
      stem: `每${item.unit}${item.noun} ${price} 元，学校买了 ${quantity} ${item.unit}，带 ${money} 元。①一共要付多少元？②带的钱够不够？`,
      questions: ['一共要付多少元？', '带的钱够不够？'],
      answers: [String(total), money >= total ? '够' : '不够'],
      steps: [
        step(1, `${price} × ${quantity}`, total, `${price} × ${quantity} = ${total}（元）`),
        judgeStep(
          2,
          money >= total ? `${money} 元 > ${total} 元，带的钱够` : `${money} 元 < ${total} 元，带的钱不够`,
          money >= total,
        ),
      ],
      params: { price, quantity, money, mode: 'budget3' },
      features: { form: 'bulk', level, questions: 2, steps: 2, judge: true },
    }
  }
  const item1 = pick(rng, SHOPS3)
  const others = SHOPS3.filter((item) => item.noun !== item1.noun)
  const item2 = pick(rng, others)
  const price1 = randInt(rng, 108, 199)
  const quantity1 = randInt(rng, 10, 15)
  const price2 = randInt(rng, 205, 299)
  const quantity2 = randInt(rng, 10, 15)
  const part1 = price1 * quantity1
  const part2 = price2 * quantity2
  const total = part1 + part2
  const discount = Math.floor(total / 1000) * 50
  const actual = total - discount
  return {
    stem: `书店里每${item1.unit}${item1.noun} ${price1} 元，每${item2.unit}${item2.noun} ${price2} 元。${name} 要买 ${quantity1} ${item1.unit}${item1.noun}和 ${quantity2} ${item2.unit}${item2.noun}。①一共要付多少元？②每满 1000 元减 50 元，实际要付多少元？`,
    questions: ['一共要付多少元？', '实际要付多少元？'],
    answers: [String(total), String(actual)],
    steps: [
      step(1, `${price1} × ${quantity1}`, part1, `${price1} × ${quantity1} = ${part1}（元）`),
      step(1, `${price2} × ${quantity2}`, part2, `${price2} × ${quantity2} = ${part2}（元）`),
      step(1, `${part1} + ${part2}`, total, `${part1} + ${part2} = ${total}（元）`),
      step(
        2,
        `${Math.floor(total / 1000)} × 50`,
        discount,
        `${total} 元里有 ${Math.floor(total / 1000)} 个 1000 元，${Math.floor(total / 1000)} × 50 = ${discount}（元）`,
      ),
      step(2, `${total} - ${discount}`, actual, `${total} - ${discount} = ${actual}（元）`),
    ],
    params: { price1, quantity1, price2, quantity2, mode: 'pairDiscount' },
    features: { form: 'bulk', level, questions: 2, steps: 5, judge: false },
  }
}

const buildPack: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const perBox = randInt(rng, 12, 39)
    const boxes = randInt(rng, 10, 24)
    const total = perBox * boxes
    return {
      stem: `果园里有 ${total} 个苹果，每 ${perBox} 个装一箱，可以装多少箱？`,
      questions: ['可以装多少箱？'],
      answers: [String(boxes)],
      steps: [step(1, `${total} ÷ ${perBox}`, boxes, `${total} ÷ ${perBox} = ${boxes}（箱）`)],
      params: { perBox, boxes, total, mode: 'boxes' },
      features: { form: 'pack', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const perBox = randInt(rng, 12, 39)
    const boxes = randInt(rng, 10, 24)
    const rest = randInt(rng, 1, perBox - 1)
    const total = perBox * boxes + rest
    return {
      stem: `果园里有 ${total} 个苹果，每 ${perBox} 个装一箱。①最多能装满几箱？②还剩几个？`,
      questions: ['最多能装满几箱？', '还剩几个？'],
      answers: [String(boxes), String(rest)],
      steps: [
        step(1, `${total} ÷ ${perBox}`, boxes, `${total} ÷ ${perBox} = ${boxes}（箱）……${rest}（个）`, rest),
        step(2, `${total} - ${perBox} × ${boxes}`, rest, `${perBox} × ${boxes} = ${perBox * boxes}（个），${total} - ${perBox * boxes} = ${rest}（个）`),
      ],
      params: { perBox, boxes, rest, total, mode: 'remainderBoxes' },
      features: { form: 'pack', level, questions: 2, steps: 2, judge: false },
    }
  }
  const perBox = randInt(rng, 12, 39)
  const boxes = randInt(rng, 10, 24)
  const total = perBox * boxes
  const freight = randInt(rng, 6, 15)
  const fee = boxes * freight
  return {
    stem: `果园里有 ${total} 个苹果，每 ${perBox} 个装一箱。①可以装多少箱？②每箱运费 ${freight} 元，一共要付运费多少元？`,
    questions: ['可以装多少箱？', '一共要付运费多少元？'],
    answers: [String(boxes), String(fee)],
    steps: [
      step(1, `${total} ÷ ${perBox}`, boxes, `${total} ÷ ${perBox} = ${boxes}（箱）`),
      step(2, `${boxes} × ${freight}`, fee, `${boxes} × ${freight} = ${fee}（元）`),
    ],
    params: { perBox, boxes, freight, total, mode: 'boxFreight' },
    features: { form: 'pack', level, questions: 2, steps: 2, judge: false },
  }
}

// ---------- 数学广场：找规律 ----------

const buildPattern: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const count = randInt(rng, 3, 8)
    const sticks = 4 + 3 * (count - 1)
    return {
      stem: `用小棒摆正方形。摆 1 个正方形用 4 根小棒，以后每多摆 1 个正方形就多用 3 根。摆 ${count} 个正方形要用多少根小棒？`,
      questions: ['要用多少根小棒？'],
      answers: [String(sticks)],
      steps: [step(1, `4 + 3 × (${count} - 1)`, sticks, `3 × (${count} - 1) = ${3 * (count - 1)}（根），4 + ${3 * (count - 1)} = ${sticks}（根）`)],
      params: { count, sticks, unit: '根', mode: 'squareSticks' },
      features: { form: 'pattern', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const count = randInt(rng, 5, 12)
    const sticks = 4 + 3 * (count - 1)
    return {
      stem: `用小棒摆正方形。摆 1 个用 4 根，以后每多摆 1 个就多用 3 根。一共用了 ${sticks} 根小棒，摆了多少个正方形？`,
      questions: ['摆了多少个正方形？'],
      answers: [String(count)],
      steps: [step(1, `(${sticks} - 4) ÷ 3 + 1`, count, `${sticks} - 4 = ${sticks - 4}（根），${sticks - 4} ÷ 3 = ${(sticks - 4) / 3}（个），${(sticks - 4) / 3} + 1 = ${count}（个）`)],
      params: { count, sticks, unit: '个', mode: 'squareSticksReverse' },
      features: { form: 'pattern', level, questions: 1, steps: 1, judge: false },
    }
  }
  const count = randInt(rng, 4, 9)
  const sticks = 3 + 2 * (count - 1)
  return {
    stem: `用小棒摆三角形。摆 1 个三角形用 3 根小棒，以后每多摆 1 个三角形就多用 2 根。①摆 ${count} 个三角形要用多少根？②用 ${sticks} 根小棒能摆几个这样的三角形？`,
    questions: [`摆 ${count} 个三角形要用多少根？`, `用 ${sticks} 根小棒能摆几个？`],
    answers: [String(sticks), String(count)],
    steps: [
      step(1, `3 + 2 × (${count} - 1)`, sticks, `2 × (${count} - 1) = ${2 * (count - 1)}（根），3 + ${2 * (count - 1)} = ${sticks}（根）`),
      step(2, `(${sticks} - 3) ÷ 2 + 1`, count, `${sticks} - 3 = ${sticks - 3}（根），${sticks - 3} ÷ 2 = ${(sticks - 3) / 2}（个），${(sticks - 3) / 2} + 1 = ${count}（个）`),
    ],
    params: { count, sticks, unit: '根', mode: 'triangleSticks' },
    features: { form: 'pattern', level, questions: 2, steps: 2, judge: false },
  }
}

// ---------- 数学广场：七巧板拼摆 ----------

const buildTangram: WordBuilder = (rng, level) => {
  if (level === 'L1') {
    const mode = randInt(rng, 0, 2)
    if (mode === 0) {
      const pieces = randInt(rng, 2, 6) * 2
      const groups = pieces / 2
      return {
        stem: `用七巧板拼摆：2 块同样的小三角形可以拼成 1 个正方形。有 ${pieces} 块小三角形，可以拼成多少个正方形？`,
        questions: ['可以拼成多少个正方形？'],
        answers: [String(groups)],
        steps: [step(1, `${pieces} ÷ 2`, groups, `${pieces} ÷ 2 = ${groups}（个）`)],
        params: { pieces, per: 2, mode: 'triToSquare' },
        features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (mode === 1) {
      const pieces = randInt(rng, 2, 5) * 3
      const groups = pieces / 3
      return {
        stem: `用七巧板拼摆：3 块同样的小三角形可以拼成 1 个梯形。有 ${pieces} 块小三角形，可以拼成多少个梯形？`,
        questions: ['可以拼成多少个梯形？'],
        answers: [String(groups)],
        steps: [step(1, `${pieces} ÷ 3`, groups, `${pieces} ÷ 3 = ${groups}（个）`)],
        params: { pieces, per: 3, mode: 'triToTrapezoid' },
        features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
      }
    }
    const sets = randInt(rng, 2, 5)
    return {
      stem: `一副七巧板有 7 块。${sets} 副七巧板一共有多少块？`,
      questions: ['一共有多少块？'],
      answers: [String(sets * 7)],
      steps: [step(1, `7 × ${sets}`, sets * 7, `7 × ${sets} = ${sets * 7}（块）`)],
      params: { sets, mode: 'pieceCount' },
      features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
    }
  }
  if (level === 'L2') {
    const mode = randInt(rng, 0, 2)
    if (mode === 0) {
      const groups = randInt(rng, 2, 6)
      return {
        stem: `用七巧板拼摆：每 2 块小三角形拼成 1 个正方形。拼成 ${groups} 个正方形要用多少块小三角形？`,
        questions: ['要用多少块小三角形？'],
        answers: [String(groups * 2)],
        steps: [step(1, `2 × ${groups}`, groups * 2, `2 × ${groups} = ${groups * 2}（块）`)],
        params: { groups, per: 2, mode: 'triToSquareReverse' },
        features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
      }
    }
    if (mode === 1) {
      const sets = randInt(rng, 2, 6)
      return {
        stem: `每副七巧板中有 5 块三角形。${sets} 副七巧板中三角形一共有多少块？`,
        questions: ['三角形一共有多少块？'],
        answers: [String(sets * 5)],
        steps: [step(1, `5 × ${sets}`, sets * 5, `5 × ${sets} = ${sets * 5}（块）`)],
        params: { sets, mode: 'groupTriangle' },
        features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
      }
    }
    const sets = randInt(rng, 2, 6)
    return {
      stem: `每副七巧板中有 1 块正方形和 1 块平行四边形。${sets} 副七巧板中，正方形和平行四边形一共有多少块？`,
      questions: ['正方形和平行四边形一共有多少块？'],
      answers: [String(sets * 2)],
      steps: [step(1, `2 × ${sets}`, sets * 2, `2 × ${sets} = ${sets * 2}（块）`)],
      params: { sets, mode: 'groupFlat' },
      features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
    }
  }
  const mode = randInt(rng, 0, 2)
  if (mode === 0) {
    const sets = randInt(rng, 3, 8)
    return {
      stem: `一副七巧板有 7 块，其中 5 块是三角形。①${sets} 副七巧板一共有多少块？②其中三角形一共有多少块？`,
      questions: [`${sets} 副七巧板一共有多少块？`, '其中三角形一共有多少块？'],
      answers: [String(sets * 7), String(sets * 5)],
      steps: [
        step(1, `7 × ${sets}`, sets * 7, `7 × ${sets} = ${sets * 7}（块）`),
        step(2, `5 × ${sets}`, sets * 5, `5 × ${sets} = ${sets * 5}（块）`),
      ],
      params: { sets, mode: 'pieceTwoQuestions' },
      features: { form: 'tangram', level, questions: 2, steps: 2, judge: false },
    }
  }
  if (mode === 1) {
    const pieces = randInt(rng, 6, 9) * 2 + 1
    const groups = Math.floor(pieces / 2)
    return {
      stem: `有 ${pieces} 块同样的小三角形，每 2 块拼成 1 个正方形。①最多能拼成多少个正方形？②还剩多少块？`,
      questions: ['最多能拼成多少个正方形？', '还剩多少块？'],
      answers: [String(groups), String(pieces % 2)],
      steps: [
        step(1, `${pieces} ÷ 2`, groups, `${pieces} ÷ 2 = ${groups}（个）……${pieces % 2}（块）`),
        step(2, `${pieces} - ${groups} × 2`, pieces % 2, `${groups} × 2 = ${groups * 2}（块），${pieces} - ${groups * 2} = ${pieces % 2}（块）`),
      ],
      params: { pieces, per: 2, mode: 'remainderSquare' },
      features: { form: 'tangram', level, questions: 2, steps: 2, judge: false },
    }
  }
  const groups = randInt(rng, 3, 8)
  const pieces = groups * 3
  return {
    stem: `用七巧板拼摆：3 块同样的小三角形可以拼成 1 个梯形。有 ${pieces} 块小三角形，一共可以拼成多少个梯形？`,
    questions: ['一共可以拼成多少个梯形？'],
    answers: [String(groups)],
    steps: [step(1, `${pieces} ÷ 3`, groups, `${pieces} ÷ 3 = ${groups}（个）`)],
    params: { pieces, per: 3, mode: 'triToTrapezoidReverse' },
    features: { form: 'tangram', level, questions: 1, steps: 1, judge: false },
  }
}

const BUILDERS: Record<WordFormName, WordBuilder> = {
  shopping: buildShopping,
  trip: buildTrip,
  timePlan: buildTimePlan,
  perimeter: buildPerimeter,
  area: buildArea,
  share: buildShare,
  shopping2: buildShopping2,
  bulk: buildBulk,
  pack: buildPack,
  wallFence: buildWallFence,
  shop3: buildShop3,
  shopCompare: buildShopCompare,
  discount: buildDiscount,
  pattern: buildPattern,
  tangram: buildTangram,
}

// ---------- 独立复核 ----------

interface WordCheck {
  questions: number
  answers: string[]
  steps: number
}

const n = (params: ParamMap, key: string): number => {
  const value = params[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`参数 ${key} 不是整数`)
  return value
}

/**
 * 从 params 重算答案与步骤数，不复用生成时算出的中间量。
 * 形式与生成器里的实现分开写，便于发现“生成时顺手算错”的问题。
 */
export function verifyWord(form: WordFormName, params: ParamMap): WordCheck {
  switch (form) {
    case 'shopping': {
      const mode = String(params.mode)
      if (mode === 'single') {
        return { questions: 1, answers: [String(n(params, 'price') * n(params, 'quantity'))], steps: 1 }
      }
      if (mode === 'change') {
        const total = n(params, 'price') * n(params, 'quantity')
        const paid = n(params, 'paid')
        const change = paid - total
        if (change <= 0) throw new Error('找零不是正数')
        return { questions: 2, answers: [String(total), String(change)], steps: 2 }
      }
      const price1 = n(params, 'price1')
      const quantity1 = n(params, 'quantity1')
      const price2 = n(params, 'price2')
      const quantity2 = n(params, 'quantity2')
      const money = n(params, 'money')
      const total = price1 * quantity1 + price2 * quantity2
      return {
        questions: 2,
        answers: [String(total), money >= total ? '够' : '不够'],
        steps: 4,
      }
    }
    case 'trip': {
      const mode = String(params.mode)
      const speed = n(params, 'speed')
      if (mode === 'distance') {
        return { questions: 1, answers: [String(speed * n(params, 'hours'))], steps: 1 }
      }
      if (mode === 'roundTrip') {
        const distance = speed * n(params, 'hours')
        return { questions: 2, answers: [String(distance), String(distance * 2)], steps: 2 }
      }
      const hours = n(params, 'hours')
      if (hours < 2) throw new Error('行驶时间不足 2 小时')
      const distance = speed * hours
      if (distance % (hours - 1) !== 0) throw new Error('提前到达后除不尽')
      return {
        questions: 2,
        answers: [String(distance), String(distance / (hours - 1))],
        steps: 2,
      }
    }
    case 'timePlan': {
      const mode = String(params.mode)
      if (mode === 'endTime') {
        const total = n(params, 'startHour') * 60 + n(params, 'startMinute') + n(params, 'duration')
        return {
          questions: 1,
          answers: [answerTime(Math.floor(total / 60), total % 60)],
          steps: 1,
        }
      }
      if (mode === 'lesson') {
        const first = n(params, 'startHour') * 60 + n(params, 'startMinute') + n(params, 'lesson')
        const second = first + n(params, 'rest')
        return {
          questions: 2,
          answers: [
            answerTime(Math.floor(first / 60), first % 60),
            answerTime(Math.floor(second / 60), second % 60),
          ],
          steps: 2,
        }
      }
      const departure =
        n(params, 'classHour') * 60 - n(params, 'duration') - n(params, 'early') + n(params, 'classMinute')
      if (departure < 0) throw new Error('出发时间早于 0 时')
      return {
        questions: 1,
        answers: [answerTime(Math.floor(departure / 60), departure % 60)],
        steps: 1,
      }
    }
    case 'perimeter': {
      const mode = String(params.mode)
      const length = n(params, 'length')
      const width = n(params, 'width')
      const perimeter = 2 * (length + width)
      if (mode === 'perimeter') return { questions: 1, answers: [String(perimeter)], steps: 1 }
      if (mode === 'frameCost' || mode === 'boardCost' || mode === 'fenceCost') {
        const unitPrice = n(params, 'unitPrice')
        return { questions: 2, answers: [String(perimeter), String(perimeter * unitPrice)], steps: 2 }
      }
      const wire = n(params, 'wire')
      if (mode === 'rectangleAndSquare') {
        if (wire % 4 !== 0) throw new Error('铁丝不能正好围成正方形')
        if (wire / 2 - length !== width) throw new Error('长方形的宽与周长不匹配')
        return { questions: 2, answers: [String(width), String(wire / 4)], steps: 2 }
      }
      if (mode === 'wireReverseLength' || mode === 'squareToRectangle') {
        if (wire % 2 !== 0) throw new Error('铁丝长度不是偶数，半周长不是整数')
        const got = wire / 2 - width
        if (got !== length) throw new Error('反求出的长不成立')
        return { questions: 1, answers: [String(length)], steps: 1 }
      }
      // wireDiff：已知半周长与长宽差，反求长和宽
      const diff = n(params, 'diff')
      if ((wire / 2 - diff) / 2 !== width) throw new Error('反求出的宽不成立')
      if (width + diff !== length) throw new Error('反求出的长不成立')
      return { questions: 2, answers: [String(width), String(length)], steps: 2 }
    }
    case 'area': {
      const mode = String(params.mode)
      const area = n(params, 'length') * n(params, 'width')
      if (mode === 'area') return { questions: 1, answers: [String(area)], steps: 1 }
      if (mode === 'tiles') {
        const tile = n(params, 'tile')
        const areaDm2 = area * 100
        if (areaDm2 % tile !== 0) throw new Error('方砖块数不是整数')
        return { questions: 2, answers: [String(areaDm2), String(areaDm2 / tile)], steps: 3 }
      }
      const total = area * n(params, 'unitPrice')
      const money = n(params, 'money')
      return {
        questions: 3,
        answers: [String(area), String(total), money >= total ? '够' : '不够'],
        steps: 3,
      }
    }
    case 'shopping2': {
      const mode = String(params.mode)
      if (mode === 'single2') {
        return { questions: 1, answers: [String(n(params, 'price') * n(params, 'quantity'))], steps: 1 }
      }
      if (mode === 'change2') {
        const total = n(params, 'price') * n(params, 'quantity')
        const paid = n(params, 'paid')
        const change = paid - total
        if (change <= 0) throw new Error('找零不是正数')
        return { questions: 2, answers: [String(total), String(change)], steps: 2 }
      }
      const price1 = n(params, 'price1')
      const quantity1 = n(params, 'quantity1')
      const price2 = n(params, 'price2')
      const quantity2 = n(params, 'quantity2')
      const money = n(params, 'money')
      const total = price1 * quantity1 + price2 * quantity2
      return {
        questions: 2,
        answers: [String(total), money >= total ? '够' : '不够'],
        steps: 4,
      }
    }
    case 'bulk': {
      const mode = String(params.mode)
      if (mode === 'single3') {
        return { questions: 1, answers: [String(n(params, 'price') * n(params, 'quantity'))], steps: 1 }
      }
      if (mode === 'budget3') {
        const total = n(params, 'price') * n(params, 'quantity')
        const money = n(params, 'money')
        return {
          questions: 2,
          answers: [String(total), money >= total ? '够' : '不够'],
          steps: 2,
        }
      }
      const price1 = n(params, 'price1')
      const quantity1 = n(params, 'quantity1')
      const price2 = n(params, 'price2')
      const quantity2 = n(params, 'quantity2')
      const total = price1 * quantity1 + price2 * quantity2
      const discount = Math.floor(total / 1000) * 50
      return {
        questions: 2,
        answers: [String(total), String(total - discount)],
        steps: 5,
      }
    }
    case 'pack': {
      const mode = String(params.mode)
      if (mode === 'boxes') {
        const perBox = n(params, 'perBox')
        if (n(params, 'total') % perBox !== 0) throw new Error('苹果不能正好装箱')
        return { questions: 1, answers: [String(n(params, 'total') / perBox)], steps: 1 }
      }
      if (mode === 'remainderBoxes') {
        const perBox = n(params, 'perBox')
        const total = n(params, 'total')
        return {
          questions: 2,
          answers: [String(Math.floor(total / perBox)), String(total % perBox)],
          steps: 2,
        }
      }
      const perBox = n(params, 'perBox')
      const total = n(params, 'total')
      if (total % perBox !== 0) throw new Error('苹果不能正好装箱')
      const boxes = total / perBox
      return { questions: 2, answers: [String(boxes), String(boxes * n(params, 'freight'))], steps: 2 }
    }
    case 'share': {
      const mode = String(params.mode)
      if (mode === 'equalShare') {
        const apples = n(params, 'apples')
        const plates = n(params, 'plates')
        if (apples % plates !== 0) throw new Error('苹果不能平均分')
        return { questions: 1, answers: [String(apples / plates)], steps: 1 }
      }
      if (mode === 'boats') {
        const students = n(params, 'students')
        const capacity = n(params, 'capacity')
        const rest = students % capacity
        if (rest === 0) throw new Error('没有剩余人数，不能体现“至少”')
        return {
          questions: 2,
          answers: [String(Math.floor(students / capacity) + 1), String(rest)],
          steps: 3,
        }
      }
      const money = n(params, 'money')
      const price = n(params, 'price')
      const rest = money % price
      if (rest === 0) throw new Error('没有剩余钱数，不能体现“最多”')
      return {
        questions: 2,
        answers: [String(Math.floor(money / price)), String(rest)],
        steps: 2,
      }
    }
    case 'wallFence': {
      const mode = String(params.mode)
      const width = n(params, 'width')
      const length = n(params, 'length')
      const hasPrice = typeof params.unitPrice === 'number'
      // 三种围法：长边靠墙 / 宽边靠墙 / 相邻两边靠墙 / 转角留门
      const fenceOf = (): number => {
        if (mode === 'longSideWall' || mode === 'fenceReverse') return length + 2 * width
        if (mode === 'shortSideWall' || mode === 'reverseWidth') return 2 * length + width
        if (mode === 'twoSidesWall') return length + width
        if (mode === 'gate' || mode === 'gateReverse') return 2 * (length + width) - n(params, 'gate')
        throw new Error(`未知篱笆形态: ${mode}`)
      }
      const fence = fenceOf()
      if (fence !== n(params, 'fence')) throw new Error('篱笆长度与参数不一致')
      if (length <= width) throw new Error('长方形的长必须大于宽')
      if (mode === 'gateReverse') {
        const got = (n(params, 'fence') + n(params, 'gate')) / 2 - width
        if (got !== length) throw new Error('反求出的长不成立')
        return { questions: 1, answers: [String(length)], steps: 1 }
      }
      if (mode === 'reverseWidth') {
        const got = n(params, 'fence') - 2 * length
        if (got !== width) throw new Error('反求出的宽不成立')
        return {
          questions: 2,
          answers: [String(width), String(fence * n(params, 'unitPrice'))],
          steps: 2,
        }
      }
      if (mode === 'fenceReverse') {
        const got = n(params, 'fence') - 2 * width
        if (got !== length) throw new Error('反求出的长不成立')
        return {
          questions: 2,
          answers: [String(length), String(fence * n(params, 'unitPrice'))],
          steps: 2,
        }
      }
      if (!hasPrice) return { questions: 1, answers: [String(fence)], steps: 1 }
      return {
        questions: 2,
        answers: [String(fence), String(fence * n(params, 'unitPrice'))],
        steps: 2,
      }
    }
    case 'pattern': {
      const mode = String(params.mode)
      const count = n(params, 'count')
      if (mode === 'squareSticks') {
        return { questions: 1, answers: [String(4 + 3 * (count - 1))], steps: 1 }
      }
      if (mode === 'squareSticksReverse') {
        const sticks = n(params, 'sticks')
        if ((sticks - 4) % 3 !== 0) throw new Error('小棒根数不能对应整数个正方形')
        return { questions: 1, answers: [String((sticks - 4) / 3 + 1)], steps: 1 }
      }
      const sticks = n(params, 'sticks')
      const forward = 3 + 2 * (count - 1)
      if (forward !== sticks) throw new Error('三角形小棒数不成立')
      if ((sticks - 3) % 2 !== 0) throw new Error('小棒根数不能对应整数个三角形')
      if ((sticks - 3) / 2 + 1 !== count) throw new Error('三角形反求个数不一致')
      return { questions: 2, answers: [String(sticks), String(count)], steps: 2 }
    }
    case 'tangram': {
      const mode = String(params.mode)
      if (mode === 'triToSquare' || mode === 'triToTrapezoid' || mode === 'triToTrapezoidReverse') {
        const pieces = n(params, 'pieces')
        const per = n(params, 'per')
        if (pieces % per !== 0) throw new Error('小三角形块数不能正好拼成整数个图形')
        return { questions: 1, answers: [String(pieces / per)], steps: 1 }
      }
      if (mode === 'pieceCount') {
        return { questions: 1, answers: [String(n(params, 'sets') * 7)], steps: 1 }
      }
      if (mode === 'triToSquareReverse') {
        return { questions: 1, answers: [String(n(params, 'groups') * 2)], steps: 1 }
      }
      if (mode === 'groupTriangle') {
        return { questions: 1, answers: [String(n(params, 'sets') * 5)], steps: 1 }
      }
      if (mode === 'groupFlat') {
        return { questions: 1, answers: [String(n(params, 'sets') * 2)], steps: 1 }
      }
      if (mode === 'pieceTwoQuestions') {
        const sets = n(params, 'sets')
        return { questions: 2, answers: [String(sets * 7), String(sets * 5)], steps: 2 }
      }
      const pieces = n(params, 'pieces')
      const per = n(params, 'per')
      return {
        questions: 2,
        answers: [String(Math.floor(pieces / per)), String(pieces % per)],
        steps: 2,
      }
    }
    case 'shop3': {
      const total =
        n(params, 'price1') * n(params, 'quantity1') +
        n(params, 'price2') * n(params, 'quantity2') +
        n(params, 'price3') * n(params, 'quantity3')
      const money = n(params, 'money')
      return { questions: 2, answers: [String(total), money >= total ? '够' : '不够'], steps: 5 }
    }
    case 'discount': {
      const total = n(params, 'total')
      const actual = total - Math.floor(total / 50) * 5
      return { questions: 2, answers: [String(total), String(actual)], steps: 4 }
    }
    case 'shopCompare': {
      const part1 = n(params, 'part1')
      const part2 = n(params, 'part2')
      const more = part1 > part2
      return {
        questions: 3,
        answers: [String(part1), String(part2), `${more ? params.noun1 : params.noun2}，${Math.abs(part1 - part2)}`],
        steps: 3,
      }
    }
  }
}

/** 校验分步解答：算术步骤逐个独立求值，判断步骤只看 0/1 */
function checkSteps(steps: WordStep[]): string | null {
  if (steps.length === 0) return '缺少解答步骤'
  for (const item of steps) {
    if (!Number.isInteger(item.result) || item.result < 0) return '步骤结果不是非负整数'
    if (item.judge) continue
    if (!/^[0-9 ()\-+×÷]+$/.test(item.expr)) continue
    if (item.remainder !== undefined) {
      const match = /^(\d+) ÷ (\d+)$/.exec(item.expr)
      if (!match) return `带余除法写法不合法: ${item.expr}`
      const dividend = Number(match[1])
      const divisor = Number(match[2])
      const quotient = Math.floor(dividend / divisor)
      const remainder = dividend % divisor
      if (quotient !== item.result || remainder !== item.remainder) {
        return `带余除法不成立：${item.expr} 应为 ${quotient} 余 ${remainder}`
      }
      continue
    }
    let value: number
    try {
      value = evalLatex(item.expr)
    } catch (error) {
      return `步骤算式无法求值: ${(error as Error).message}`
    }
    if (value !== item.result) return `步骤 ${item.expr} 应为 ${value}，实际写成 ${item.result}`
  }
  return null
}

/**
 * 统计“两位数乘除”步骤数：两位数×两位/三位数，或两位数的除数。
 * 3B-U2 的单元覆盖度自检用它，避免应用题整题都是表内乘除。
 */
export function countTwoDigitSteps(steps: WordStep[]): number {
  const isTwo = (value: number): boolean => value >= 10 && value <= 99
  const isTwoOrThree = (value: number): boolean => value >= 10 && value <= 999
  let count = 0
  for (const item of steps) {
    if (item.judge) continue
    const expr = item.expr.replace(/\s+/g, '')
    let hit = false
    for (const match of expr.matchAll(/(\d+)×(\d+)/g)) {
      const a = Number(match[1])
      const b = Number(match[2])
      if ((isTwo(a) && isTwoOrThree(b)) || (isTwo(b) && isTwoOrThree(a))) hit = true
    }
    for (const match of expr.matchAll(/(\d+)÷(\d+)/g)) {
      const divisor = Number(match[2])
      if (divisor >= 11 && divisor <= 99) hit = true
    }
    if (hit) count++
  }
  return count
}

function stepAnswerMatches(item: WordStep, answer: string): boolean {
  if (item.judge) return answer === '够' || answer === '不够' ? item.line.includes(answer) : false
  if (answer === String(item.result)) return true
  // “哪种商品花得多，多多少元”这类答案形如“铅笔，12”
  const tail = answer.match(/，(\d+)$/)
  if (tail && Number(tail[1]) === item.result) return true
  // 时间类答案以“X 时 Y 分”呈现，步骤结果是当天分钟数
  if (/^\d+ 时 \d+ 分$/.test(answer)) {
    return answerTime(Math.floor(item.result / 60), item.result % 60) === answer
  }
  return false
}

/** 步骤与小问的对应关系：每步落到某一问，每问都有步骤，且每问最后一步给出该问答案 */
function checkQuestionMapping(question: WordQuestion): string | null {
  const total = question.questions.length
  for (const item of question.steps) {
    if (!Number.isInteger(item.q) || (item.q as number) < 1 || (item.q as number) > total) {
      return `步骤没有对应到小问: ${item.line}`
    }
  }
  for (let index = 1; index <= total; index++) {
    const own = question.steps.filter((item) => item.q === index)
    if (own.length === 0) return `第 ${index} 问没有对应的解答步骤`
    const last = own[own.length - 1]
    if (!stepAnswerMatches(last, question.answers[index - 1])) {
      return `第 ${index} 问的结论与答案不一致: ${last.line}`
    }
  }
  // 购物找零这类“一问一步”的形态，步骤数必须等于小问数
  const oneStepPerQuestion = ['maxBuy', 'equalShare']
  if (oneStepPerQuestion.includes(String(question.params.mode)) && question.steps.length !== total) {
    return '一步一问的题型，步骤数必须等于小问数'
  }
  return null
}

/** 语义自检：措辞方向、比较对象、付款金额 */
function checkWordSemantics(form: string, params: ParamMap, answers: string[]): string | null {
  const mode = String(params.mode ?? '')
  if (mode === 'latestDeparture') {
    if (!answers.length) return '求出发时刻缺少答案'
  }
  // 比较/合计类题目，两边单价必须不同
  if (form === 'shopping' && mode === 'budget') {
    if (params.price1 === params.price2) return '两种商品单价相同，比较失去意义'
    if (params.noun1 === params.noun2) return '两种商品名称相同，情境失效'
    if (params.quantity1 === params.quantity2) return '两种商品数量相同，合计结构退化'
  }
  if (mode === 'shop3') {
    // 三种商品必须单价两两不同，否则“三种商品合计”退化成两种商品
    const prices = [params.price1, params.price2, params.price3].map(Number)
    if (new Set(prices).size !== 3) return '三种商品出现同价，情境退化'
  }
  // 付款/预算必须是整十或整百，且“够/不够”的差额非零
  if (mode === 'change' || mode === 'change2') {
    const paid = Number(params.paid)
    if (paid % 10 !== 0) return '付款金额不是整十'
  }
  if (mode === 'budget' || mode === 'shop3' || mode === 'budget2') {
    const money = Number(params.money)
    if (money % 10 !== 0) return '预算金额不是整十'
    const total = Number(answers[0])
    if (answers[1] === '够' && !(money > total)) return '“够”应满足带的钱多于总价'
    if (answers[1] === '不够' && !(money < total)) return '“不够”应满足带的钱少于总价'
  }
  if (mode === 'lawnBudget') {
    const money = Number(params.money)
    if (money % 100 !== 0) return '预算金额不是整百'
  }
  if (mode === 'budget3') {
    const money = Number(params.money)
    if (money % 1000 !== 0) return '大额预算金额不是整千'
  }
  // 三下的满减题总价控制在万以内，避免 21700 这类五位数
  if (mode === 'pairDiscount') {
    const total = Number(answers[0])
    if (total > 9999) return '满减题总价超过万以内'
  }
  return null
}

/** 数量词自检：题干里的“至少/最多/最迟”必须与该题的数学关系一致 */
function checkBoundWording(form: WordFormName, params: ParamMap, stem: string): string | null {
  const mode = String(params.mode)
  // 上界：要在某时刻前到达，出发时刻越晚越紧，必须写“最迟”
  if (mode === 'latestDeparture') {
    if (!stem.includes('最迟')) return '求出发时刻必须用“最迟”（上界语义）'
    if (stem.includes('至少')) return '“最迟”题不能写成“至少”'
  }
  // 下界：需要几条船 / 至少几块砖，都是“不能更少”
  if ((form === 'share' && mode === 'boats') || (form === 'area' && mode === 'tiles')) {
    if (!stem.includes('至少')) return '下界题必须用“至少”'
    if (stem.includes('最迟')) return '下界题不能写成“最迟”'
  }
  // 上界：最多买几根 / 最多装满几箱
  if ((form === 'share' && mode === 'maxBuy') || (form === 'pack' && mode === 'remainderBoxes')) {
    if (!stem.includes('最多')) return '上界题必须用“最多”'
    if (stem.includes('最迟')) return '上界题不能写成“最迟”'
  }
  // 提速反求也是下界：平均每小时至少要行多少千米
  if (form === 'trip' && mode === 'deadline') {
    if (!stem.includes('至少')) return '提速题必须用“至少每小时”'
    if (stem.includes('最迟')) return '提速题不能写成“最迟”'
  }
  return null
}

/** 单位词：长的平方单位必须排在前面，否则“平方米”会被“米”抢先匹配 */
const DIM_UNITS = [
  '平方千米',
  '平方毫米',
  '平方厘米',
  '平方分米',
  '平方米',
  '千米',
  '毫米',
  '厘米',
  '分米',
  '米',
] as const
const UNIT_ALT = DIM_UNITS.join('|')
const ASK_UNIT_RE = new RegExp(`多少(?:要|需要|能|可以|一共要|一共需要)?(${UNIT_ALT})`)
const MEASURE_RE = new RegExp(`(\\d+)\\s*(${UNIT_ALT})`, 'g')
const SQUARE_OF: Record<string, string> = {
  毫米: '平方毫米',
  厘米: '平方厘米',
  分米: '平方分米',
  米: '平方米',
  千米: '平方千米',
}

const stepUnitOf = (line: string): string | null => {
  const paren = line.match(new RegExp(`（(${UNIT_ALT})）`))
  if (paren) return paren[1]
  const tail = line.match(new RegExp(`(${UNIT_ALT})$`))
  return tail ? tail[1] : null
}

/**
 * 单位一致性自检（P0-N1）：题干给的尺寸单位、所求单位、解答结论单位三者必须一致。
 * - 每问“多少 X”的 X 必须等于该问最后一步写出的单位；
 * - 所求单位必须是题干给出的单位，或题干基本单位的平方单位
 *   （例如题干“长 8 米”问“多少平方米”是合法的；题干“长 11 米”问“多少厘米”不合法）。
 */
function checkUnitConsistency(input: {
  stem: string
  questions: string[]
  steps: WordStep[]
  params: ParamMap
  features: Record<string, number | string | boolean>
}): string | null {
  const form = String(input.features.form ?? '')
  if (!['perimeter', 'wallFence', 'area'].includes(form)) return null
  const unit = input.params.unit
  if (typeof unit !== 'string' || !(DIM_UNITS as readonly string[]).includes(unit)) {
    return '缺少或非法的单位参数'
  }
  const stemUnits = new Set<string>()
  for (const match of input.stem.matchAll(MEASURE_RE)) stemUnits.add(match[2])
  for (let index = 0; index < input.questions.length; index++) {
    const ask = input.questions[index].match(ASK_UNIT_RE)?.[1]
    if (!ask) continue
    const own = input.steps.filter((item) => item.q === index + 1)
    const last = own[own.length - 1]
    if (!last) return `第 ${index + 1} 问缺少解答步骤`
    if (last.judge) continue
    const stepUnit = stepUnitOf(last.line)
    if (stepUnit !== ask) {
      return `第 ${index + 1} 问问“${ask}”，解答却按“${stepUnit ?? '未标单位'}”写：${last.line}`
    }
    if (ask === unit || SQUARE_OF[unit] === ask) continue
    if (stemUnits.has(ask)) continue
    return `题干单位 ${[...stemUnits].join('/') || '无'} 与所求单位 ${ask} 不一致`
  }
  return null
}

export function verifyWordQuestion(question: WordQuestion): string | null {
  const form = String(question.features.form ?? '') as WordFormName
  if (!(form in BUILDERS)) return `未知应用题形态: ${form}`
  try {
    const check = verifyWord(form, question.params)
    if (check.questions !== question.questions.length) return '小问数量不符'
    if (check.answers.length !== question.answers.length) return '答案数量不符'
    for (const [index, value] of check.answers.entries()) {
      if (value !== question.answers[index]) {
        return `第 ${index + 1} 问答案不一致：期望 ${value}，实际 ${question.answers[index]}`
      }
    }
    if (check.steps !== question.steps.length) return '解答步骤数量不符'
    const steps = checkSteps(question.steps)
    if (steps) return steps
    const mapping = checkQuestionMapping(question)
    if (mapping) return mapping
    const semantics = checkWordSemantics(form, question.params, question.answers)
    if (semantics) return semantics
    const wording = checkBoundWording(form, question.params, question.stem)
    if (wording) return wording
    const unitProblem = checkUnitConsistency(question)
    if (unitProblem) return unitProblem
    if (BLOCK_LEAK.test(question.stem)) return '题干出现泄露步骤的表述'
    if (!question.stem.includes('？')) return '题干缺少问句'
    if (question.stem.includes('__')) return '应用题题干不应带填空线'
    if (question.answer.split('\n').length !== question.steps.length) return '参考解答行数与步骤不符'
    return null
  } catch (error) {
    return `独立复核失败: ${(error as Error).message}`
  }
}

// ---------- 目标解析 ----------

function resolveTargets(options: GenerateWordOptions): Target[] {
  const { grade, unitId, kpId, level } = options
  const targets: Target[] = []
  const pushUnit = (unit: Unit) => {
    for (const kp of unit.kps) {
      const specs = asSpecs(kp.rules.word?.[level])
      if (specs.length > 0) targets.push({ unit, kp, specs })
    }
  }

  if (kpId) {
    const found = findKp(kpId)
    if (!found) throw new Error(`找不到知识点: ${kpId}`)
    if (found.unit.grade !== grade) throw new Error(`${kpId} 不属于 ${grade}`)
    if (unitId && found.unit.unitId !== unitId) throw new Error(`${kpId} 不属于 ${unitId}`)
    const specs = asSpecs(found.kp.rules.word?.[level])
    if (specs.length === 0) throw new Error(`${kpId} 不支持应用题/${level}`)
    targets.push({ unit: found.unit, kp: found.kp, specs })
  } else if (unitId) {
    const unit = findUnit(unitId)
    if (!unit) throw new Error(`找不到单元: ${unitId}`)
    if (unit.grade !== grade) throw new Error(`${unitId} 不属于 ${grade}`)
    pushUnit(unit)
  } else {
    for (const unit of CURRICULUM.units) {
      if (unit.grade === grade) pushUnit(unit)
    }
  }

  if (targets.length === 0) {
    throw new Error(`${unitId ?? grade} 没有应用题/${level} 的生成规则`)
  }
  // 3B-U2 的核心是两/三位数乘除（购物、批量、包装），行程只是铺垫。
  // 小配额（2–3 题）时若按课本章节顺序轮询，核心比例会跌到 50%–67%，这里把核心排在前面。
  if (unitId === '3B-U2') {
    const coreOrder = ['3B-U2-K3', '3B-U2-K4', '3B-U2-K6', '3B-U2-K1']
    targets.sort((a, b) => coreOrder.indexOf(a.kp.kpId) - coreOrder.indexOf(b.kp.kpId))
  }
  return targets
}

const fingerprint = (form: string, params: ParamMap): string =>
  `${form}|${Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')}`

// ---------- 主入口 ----------

export function generateWord(options: GenerateWordOptions): {
  questions: WordQuestion[]
  count: number
  targets: { unitId: string; kpId: string; kpName: string }[]
  crossReused: number
} {
  const { count, level, grade } = options
  if (!Number.isInteger(count) || count <= 0) throw new Error('题量必须是正整数')
  const targets = resolveTargets(options)
  const rng = createRng(options.seed ?? 20261103)
  const memory = options.memory ?? new MemoryStore()

  const usedFp = new Set<string>()
  const usedStem = new Set<string>()
  const questions: WordQuestion[] = []
  const failures: string[] = []
  let crossReused = 0

  for (let index = 0; index < count; index++) {
    const target = targets[index % targets.length]
    const candidates: { draft: WordDraft; spec: WordRuleSpec; fp: string }[] = []
    /** 记忆池轮转候选：最近窗口内的题，取 lastPaper 最小（最久未用）的那道 */
    let stale: { draft: WordDraft; spec: WordRuleSpec; fp: string } | null = null

    for (let attempt = 0; attempt < 600 && candidates.length < 8; attempt++) {
      const spec = pick(rng, target.specs)
      const draft = BUILDERS[spec.form](rng, level)
      if (!draft) continue
      const fp = fingerprint(spec.form, draft.params)
      if (usedFp.has(fp)) continue
      const stemKey = draft.stem.replace(/\s+/g, '')
      if (usedStem.has(stemKey)) continue

      let problem: string | null = null
      try {
        const check = verifyWord(spec.form, draft.params)
        if (check.answers.length !== draft.answers.length) problem = '答案数量不符'
        else if (check.answers.some((value, i) => value !== draft.answers[i]))
          problem = '独立复核答案不一致'
        else if (check.steps !== draft.steps.length) problem = '步骤数量不符'
        else problem = checkSteps(draft.steps)
      } catch (error) {
        problem = `独立复核失败: ${(error as Error).message}`
      }
      if (!problem && BLOCK_LEAK.test(draft.stem)) problem = '题干泄露步骤'
      if (!problem) {
        problem = unitGuardProblem(target.unit.unitId, [
          draft.stem,
          ...draft.questions,
          ...draft.answers,
          ...draft.steps.map((item) => item.line),
        ])
        if (!problem) problem = checkWordSemantics(spec.form, draft.params, draft.answers)
        if (!problem) problem = checkBoundWording(spec.form, draft.params, draft.stem)
        if (!problem) {
          problem = checkUnitConsistency({
            stem: draft.stem,
            questions: draft.questions,
            steps: draft.steps,
            params: draft.params,
            features: draft.features,
          })
        }
      }
      if (problem) {
        if (failures.length < 8) failures.push(problem)
        continue
      }
      if (memory.recentlyUsed(fp)) {
        if (stale == null || memory.lastPaper(fp) < memory.lastPaper(stale.fp)) {
          stale = { draft, spec, fp }
        }
        continue
      }
      candidates.push({ draft, spec, fp })
    }

    if (candidates.length === 0 && stale != null) candidates.push(stale)

    if (candidates.length === 0) {
      throw new Error(
        `应用题生成失败：${target.unit.unitId}/${target.kp.kpId} ${level} 连续 600 次没有合格题` +
          (failures.length ? `；最近原因: ${failures.slice(-3).join(' / ')}` : ''),
      )
    }

    let bestUsage = Number.POSITIVE_INFINITY
    let best = candidates
    for (const candidate of candidates) {
      const usage = memory.usage(candidate.fp)
      if (usage < bestUsage) {
        bestUsage = usage
        best = [candidate]
      } else if (usage === bestUsage) {
        best.push(candidate)
      }
    }
    const chosen = pick(rng, best)
    if (memory.crossPaperUsed(chosen.fp)) crossReused++
    memory.record(chosen.fp)
    usedFp.add(chosen.fp)
    usedStem.add(chosen.draft.stem.replace(/\s+/g, ''))
    questions.push({
      id: `${target.unit.unitId}-${target.kp.kpId}-word-${level}-${String(index + 1).padStart(2, '0')}`,
      grade,
      unitId: target.unit.unitId,
      unitName: target.unit.unitName,
      kpId: target.kp.kpId,
      kpName: target.kp.kpName,
      type: 'word',
      level,
      stem: chosen.draft.stem,
      questions: chosen.draft.questions,
      answers: chosen.draft.answers,
      answer: chosen.draft.steps.map((item) => item.line).join('\n'),
      steps: chosen.draft.steps,
      workLines: workLinesOf(
        chosen.draft.questions.length,
        Boolean(chosen.draft.features.judge),
        chosen.draft.steps.length,
      ),
      params: chosen.draft.params,
      fingerprint: chosen.fp,
      values: chosen.draft.steps.flatMap((item) => [item.result]),
      features: {
        ...chosen.draft.features,
        twoDigitSteps: countTwoDigitSteps(chosen.draft.steps),
      },
    })
  }

  return {
    questions,
    count: questions.length,
    targets: targets.map((t) => ({
      unitId: t.unit.unitId,
      kpId: t.kp.kpId,
      kpName: t.kp.kpName,
    })),
    crossReused,
  }
}

export function hasWordRules(unitId: string): boolean {
  const unit = findUnit(unitId)
  if (!unit) return false
  return unit.kps.some(
    (kp) =>
      asSpecs(kp.rules.word?.L1).length > 0 ||
      asSpecs(kp.rules.word?.L2).length > 0 ||
      asSpecs(kp.rules.word?.L3).length > 0,
  )
}

export function wordSupports(unitId: string, level: Level): boolean {
  const unit = findUnit(unitId)
  if (!unit) return false
  return unit.kps.some((kp) => asSpecs(kp.rules.word?.[level]).length > 0)
}

export function wordLevelsFor(unitId: string): Level[] {
  const unit = findUnit(unitId)
  if (!unit) return []
  const levels = new Set<Level>()
  for (const kp of unit.kps) {
    for (const level of ['L1', 'L2', 'L3'] as Level[]) {
      if (asSpecs(kp.rules.word?.[level]).length > 0) levels.add(level)
    }
  }
  return [...levels].sort()
}
