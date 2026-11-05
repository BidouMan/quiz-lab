import { CURRICULUM, findKp, findUnit } from '../data/curriculum.ts'
import type {
  FillDraft,
  FillFormName,
  FillQuestion,
  FillRuleSpec,
  GenerateFillOptions,
  KnowledgePoint,
  Level,
  ParamMap,
  Unit,
} from './types.ts'
import { MemoryStore } from './memory.ts'
import { createRng, pick, randInt, type Rng } from './rng.ts'
import { unitGuardProblem } from './unitGuards.ts'
import { angleFillForms, buildAngleFill, verifyAngleFill, angleUnitSupported } from './angle.ts'

/**
 * 填空题生成器。
 *
 * 约定：
 * - 题干里的空位写成连续下划线（`____`），一个题干可含多个空；
 * - answers 与空位一一对应，参考答案用“；”拼接；
 * - 每个形态额外提供 verifyFill：只依赖 params 重新推算，不复用生成时的中间结果，
 *   用于独立求值自检。
 */

const BLANK = '____'

type FillBuilder = (rng: Rng, level: Level) => FillDraft | null

interface Target {
  unit: Unit
  kp: KnowledgePoint
  specs: FillRuleSpec[]
  /** 角与图形计数形态：合并进填空后参与 1/3 占比上限 */
  angle?: boolean
}

const asSpecs = (value: FillRuleSpec | FillRuleSpec[] | undefined): FillRuleSpec[] => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

// ---------- 基础工具 ----------

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const monthDays = (month: number, year: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

const timeText = (hour: number, minute: number): string =>
  minute === 0 ? `${hour} 时` : `${hour} 时 ${minute} 分`

const countBlanks = (stem: string): number => (stem.match(/__+/g) ?? []).length

// ---------- 各形态：生成 ----------

const buildLeapYear: FillBuilder = (rng, level) => {
  const year = randInt(rng, 2000, 2032)
  const leap = isLeapYear(year)
  if (level === 'L1') {
    return {
      stem: `${year} 年是闰年还是平年？${BLANK}`,
      answers: [leap ? '闰年' : '平年'],
      params: { year, mode: 'judge' },
      values: [year],
      features: { form: 'leapYear', level, leap, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    return {
      stem: `${year} 年二月有 ${BLANK} 天。`,
      answers: [String(monthDays(2, year))],
      params: { year, mode: 'feb' },
      values: [year, monthDays(2, year)],
      features: { form: 'leapYear', level, leap, reverse: false, blanks: 1 },
    }
  }
  const firstQuarter = 31 + monthDays(2, year) + 31
  return {
    stem: `${year} 年第一季度（1、2、3 月）一共有 ${BLANK} 天，全年一共有 ${BLANK} 天。`,
    answers: [String(firstQuarter), String(leap ? 366 : 365)],
    params: { year, mode: 'quarter' },
    values: [year, firstQuarter, leap ? 366 : 365],
    features: { form: 'leapYear', level, leap, reverse: false, blanks: 2 },
  }
}

const MONTHS_NO_FEB = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const buildMonthDays: FillBuilder = (rng, level) => {
  if (level === 'L3') {
    // 7 月和 8 月是唯一一对相邻大月（12 月和 1 月跨年，题干已排除）
    return {
      stem: `一年中（12 月和 1 月除外）连续的两个大月是 ${BLANK} 月和 ${BLANK} 月。`,
      answers: ['7', '8'],
      params: { first: 7, second: 8, mode: 'bigPair' },
      values: [7, 8],
      features: { form: 'monthDays', level, reverse: true, blanks: 2 },
    }
  }
  const month = pick(rng, MONTHS_NO_FEB)
  const days = monthDays(month, 2024)
  if (level === 'L2') {
    return {
      stem: `${month} 月有 ${BLANK} 天，它是 ${BLANK} 月（填“大”或“小”）。`,
      answers: [String(days), days === 31 ? '大' : '小'],
      params: { month, days, mode: 'size' },
      values: [month, days],
      features: { form: 'monthDays', level, reverse: false, blanks: 2 },
    }
  }
  return {
    stem: `${month} 月有 ${BLANK} 天。`,
    answers: [String(days)],
    params: { month, days, mode: 'days' },
    values: [month, days],
    features: { form: 'monthDays', level, reverse: false, blanks: 1 },
  }
}

const buildTimeHour: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const hour = randInt(rng, 1, 11)
    const period = hour <= 6 ? '下午' : '晚上'
    return {
      stem: `${period} ${hour} 时用 24 时计时法表示是 ${BLANK} 时。`,
      answers: [String(hour + 12)],
      params: { hour, minute: 0, mode: 'to24' },
      values: [hour, hour + 12],
      features: { form: 'timeHour', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const hour = randInt(rng, 7, 11)
    const minute = randInt(rng, 1, 11) * 5
    return {
      stem: `晚上 ${hour} 时 ${minute} 分用 24 时计时法表示是 ${BLANK} 时 ${BLANK} 分。`,
      answers: [String(hour + 12), String(minute)],
      params: { hour, minute, mode: 'to24' },
      values: [hour, minute, hour + 12],
      features: { form: 'timeHour', level, reverse: false, blanks: 2 },
    }
  }
  const hour = randInt(rng, 19, 23)
  const minute = randInt(rng, 1, 11) * 5
  return {
    stem: `${hour} 时 ${minute} 分是晚上 ${BLANK} 时 ${BLANK} 分。`,
    answers: [String(hour - 12), String(minute)],
    params: { hour, minute, mode: 'to12' },
    values: [hour, minute, hour - 12],
    features: { form: 'timeHour', level, reverse: true, blanks: 2 },
  }
}

const buildElapsed: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const hour = randInt(rng, 8, 11)
    const startMinute = randInt(rng, 0, 5) * 10
    const duration = randInt(rng, 2, 5) * 10
    const totalEnd = hour * 60 + startMinute + duration
    const endHour = Math.floor(totalEnd / 60)
    const endMinute = totalEnd % 60
    return {
      stem: `小明 ${timeText(hour, startMinute)} 开始写作业，${timeText(endHour, endMinute)} 写完。他一共用了 ${BLANK} 分钟。`,
      answers: [String(duration)],
      params: { hour, startMinute, endHour, endMinute, duration, mode: 'duration' },
      values: [hour, startMinute, endHour, endMinute, duration],
      features: { form: 'elapsed', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const hour = randInt(rng, 8, 10)
    const startMinute = randInt(rng, 1, 11) * 5
    const duration = randInt(rng, 3, 8) * 5
    const endMinute = startMinute + duration
    const endHour = endMinute >= 60 ? hour + 1 : hour
    return {
      stem: `从 ${timeText(hour, startMinute)} 开始，经过 ${duration} 分钟，结束时刻是 ${BLANK} 时 ${BLANK} 分。`,
      answers: [String(endHour), String(endMinute % 60)],
      params: { hour, startMinute, duration, mode: 'end' },
      values: [hour, startMinute, duration, endHour, endMinute % 60],
      features: { form: 'elapsed', level, reverse: false, blanks: 2 },
    }
  }
  const hour = randInt(rng, 9, 11)
  const endMinute = randInt(rng, 1, 11) * 5
  const duration = randInt(rng, 3, 8) * 5
  const startTotal = hour * 60 + endMinute - duration
  const startHour = Math.floor(startTotal / 60)
  const startMinute = startTotal % 60
  return {
    stem: `一节课上了 ${duration} 分钟，${timeText(hour, endMinute)} 下课。这节课是 ${BLANK} 时 ${BLANK} 分开始的。`,
    answers: [String(startHour), String(startMinute)],
    params: { hour, endMinute, duration, mode: 'start' },
    values: [hour, endMinute, duration, startHour, startMinute],
    features: { form: 'elapsed', level, reverse: true, blanks: 2 },
  }
}

const buildLengthUnits: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const metres = randInt(rng, 2, 20)
    return {
      stem: `${metres} 米 = ${BLANK} 厘米。`,
      answers: [String(metres * 100)],
      params: { metres, mode: 'm2cm' },
      values: [metres, metres * 100],
      features: { form: 'lengthUnits', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const centimetres = randInt(rng, 1, 9) * 10 + randInt(rng, 1, 9)
    return {
      stem: `1 米 ${centimetres} 厘米 = ${BLANK} 厘米。`,
      answers: [String(100 + centimetres)],
      params: { centimetres, mode: 'mixed2cm' },
      values: [centimetres, 100 + centimetres],
      features: { form: 'lengthUnits', level, reverse: false, blanks: 1 },
    }
  }
  const metres = randInt(rng, 1, 9)
  const decimetres = randInt(rng, 1, 9)
  return {
    stem: `${metres * 100 + decimetres * 10} 厘米 = ${BLANK} 米 ${BLANK} 分米。`,
    answers: [String(metres), String(decimetres)],
    params: { metres, decimetres, mode: 'cm2md' },
    values: [metres, decimetres, metres * 100 + decimetres * 10],
    features: { form: 'lengthUnits', level, reverse: true, blanks: 2 },
  }
}

const buildKmM: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const roll = randInt(rng, 0, 4)
    if (roll === 3) {
      // 比长短：两条路都用到“千米”，差值有意义
      const longer = randInt(rng, 4, 10)
      const shorter = randInt(rng, 1, longer - 1)
      return {
        stem: `一条路长 ${longer} 千米，另一条路长 ${shorter} 千米。长的一条比短的一条多 ${BLANK} 千米。`,
        answers: [String(longer - shorter)],
        params: { kilometres: longer, metres: shorter, mode: 'kmDiff' },
        values: [longer, shorter, longer - shorter],
        features: { form: 'kmM', level, reverse: false, blanks: 1 },
      }
    }
    if (roll === 4) {
      // 填合适的单位：在“千米/米”之间做选择，而不是再换算一次
      if (rng() < 0.5) {
        const kilometres = randInt(rng, 2, 6)
        return {
          stem: `从家到学校大约有 ${kilometres} ${BLANK}（填“千米”或“米”）。`,
          answers: ['千米'],
          params: { kilometres, metres: 0, unit: '千米', mode: 'unitChoice' },
          values: [kilometres],
          features: { form: 'kmM', level, reverse: false, blanks: 1 },
        }
      }
      const metres = randInt(rng, 6, 9)
      return {
        stem: `教室的长大约是 ${metres} ${BLANK}（填“米”或“千米”）。`,
        answers: ['米'],
        params: { kilometres: 0, metres, unit: '米', mode: 'unitChoice' },
        values: [metres],
        features: { form: 'kmM', level, reverse: false, blanks: 1 },
      }
    }
    const kilometres = randInt(rng, 1, 9)
    const variant = roll
    const stem =
      variant === 0
        ? `${kilometres} 千米 = ${BLANK} 米。`
        : variant === 1
          ? `小明家到学校有 ${kilometres} 千米，合 ${BLANK} 米。`
          : `一条公路长 ${kilometres} 千米，合 ${BLANK} 米。`
    return {
      stem,
      answers: [String(kilometres * 1000)],
      params: { kilometres, metres: 0, mode: 'km2m' },
      values: [kilometres, kilometres * 1000],
      features: { form: 'kmM', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const kilometres = randInt(rng, 1, 5)
    const metres = randInt(rng, 1, 9) * 100
    const total = kilometres * 1000 + metres
    // 按数值轮换句式，避免同一模板占比过高
    const variant = total % 3
    const stem =
      variant === 0
        ? `${kilometres} 千米 ${metres} 米 = ${BLANK} 米。`
        : variant === 1
          ? `从公园到超市有 ${kilometres} 千米 ${metres} 米，合 ${BLANK} 米。`
          : `一段路长 ${kilometres} 千米 ${metres} 米，也就是 ${BLANK} 米。`
    return {
      stem,
      answers: [String(total)],
      params: { kilometres, metres, mode: 'mixed2m' },
      values: [kilometres, metres, total],
      features: { form: 'kmM', level, reverse: false, blanks: 1 },
    }
  }
  const kilometres = randInt(rng, 1, 5)
  const metres = randInt(rng, 1, 9) * 100
  const total = kilometres * 1000 + metres
  const variant = total % 3
  const stem =
    variant === 0
      ? `${total} 米 = ${BLANK} 千米 ${BLANK} 米。`
      : variant === 1
        ? `全长 ${total} 米的路，合 ${BLANK} 千米 ${BLANK} 米。`
        : `田径场到校门口有 ${total} 米，也就是 ${BLANK} 千米 ${BLANK} 米。`
  return {
    stem,
    answers: [String(kilometres), String(metres)],
    params: { kilometres, metres, mode: 'm2km' },
    values: [kilometres, metres, total],
    features: { form: 'kmM', level, reverse: true, blanks: 2 },
  }
}

const buildRouteSum: FillBuilder = (rng, level) => {
  const a = randInt(rng, 2, 5) * 100
  const b = randInt(rng, 2, 6) * 100
  if (level === 'L2') {
    const total = a + b
    const variant = randInt(rng, 0, 1)
    const stem =
      variant === 0
        ? `小明从家到学校要走 ${a} 米，从学校到图书馆要走 ${b} 米。他从家经过学校到图书馆，一共要走 ${BLANK} 米。`
        : `从公园到超市是 ${a} 米，从超市到少年宫是 ${b} 米。从公园经过超市到少年宫一共 ${BLANK} 米。`
    return {
      stem,
      answers: [String(total)],
      params: { a, b, mode: 'twoLegs' },
      values: [a, b, total],
      features: { form: 'routeSum', level, reverse: false, blanks: 1 },
    }
  }
  const oneWay = a + b
  const variant = (a + b) % 3
  if (variant === 1) {
    const extra = randInt(rng, 1, 9) * 100
    return {
      stem: `小明从家到学校，先走 ${a} 米到超市，再走 ${b} 米到学校。回家时走另一条路，比去时多 ${extra} 米。回家走了 ${BLANK} 米。`,
      answers: [String(oneWay + extra)],
      params: { a, b, extra, mode: 'compareMore' },
      values: [a, b, oneWay, oneWay + extra],
      features: { form: 'routeSum', level, reverse: true, blanks: 1 },
    }
  }
  if (variant === 2) {
    const extra = randInt(rng, 1, Math.max(1, Math.floor((oneWay - 100) / 100))) * 100
    return {
      stem: `小明从家到学校，先走 ${a} 米到超市，再走 ${b} 米到学校。回家时走另一条路，比去时少 ${extra} 米。回家走了 ${BLANK} 米。`,
      answers: [String(oneWay - extra)],
      params: { a, b, extra, mode: 'compareLess' },
      values: [a, b, oneWay, oneWay - extra],
      features: { form: 'routeSum', level, reverse: true, blanks: 1 },
    }
  }
  const extra = randInt(rng, 1, 9) * 100
  const otherWay = rng() < 0.5 ? oneWay + extra : Math.max(100, oneWay - extra)
  const diff = Math.abs(oneWay - otherWay)
  return {
    stem: `小明从家到学校，先走 ${a} 米到超市，再走 ${b} 米到学校。回家时走另一条路，全长 ${otherWay} 米。两条路线相差 ${BLANK} 米。`,
    answers: [String(diff)],
    params: { a, b, otherWay, mode: 'compareRoute' },
    values: [a, b, oneWay, otherWay, diff],
    features: { form: 'routeSum', level, reverse: true, blanks: 1 },
  }
}

const FENCE_SCENES = ['菜地', '花圃', '苗圃', '果园']

const buildWallFence: FillBuilder = (rng, level) => {
  const siteOf = (length: number, width: number) => FENCE_SCENES[(length + width) % FENCE_SCENES.length]
  if (level === 'L1') {
    const mode = randInt(rng, 0, 3)
    const width = randInt(rng, 2, 6)
    const length = randInt(rng, width + 2, width + 8)
    const scene = siteOf(length, width)
    if (mode === 0) {
      const fence = length + width * 2
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。长边靠墙，三面围上篱笆。篱笆长 ${BLANK} 米。`,
        answers: [String(fence)],
        params: { length, width, fence, unit: '米', mode: 'longSideWall' },
        values: [length, width, fence],
        features: { form: 'wallFence', level, reverse: false, blanks: 1 },
      }
    }
    if (mode === 1) {
      const fence = length * 2 + width
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。宽边靠墙，三面围上篱笆。篱笆长 ${BLANK} 米。`,
        answers: [String(fence)],
        params: { length, width, fence, unit: '米', mode: 'shortSideWall' },
        values: [length, width, fence],
        features: { form: 'wallFence', level, reverse: false, blanks: 1 },
      }
    }
    if (mode === 2) {
      const fence = length + width
      return {
        stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。相邻的两边靠墙，只围另外两边，篱笆长 ${BLANK} 米。`,
        answers: [String(fence)],
        params: { length, width, fence, unit: '米', mode: 'twoSidesWall' },
        values: [length, width, fence],
        features: { form: 'wallFence', level, reverse: false, blanks: 1 },
      }
    }
    const gate = randInt(rng, 2, 4)
    const fence = 2 * (length + width) - gate
    return {
      stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。四周围上篱笆，留一个 ${gate} 米宽的门。篱笆长 ${BLANK} 米。`,
      answers: [String(fence)],
      params: { length, width, gate, fence, unit: '米', mode: 'gate' },
      values: [length, width, gate, fence],
      features: { form: 'wallFence', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const mode = randInt(rng, 0, 3)
    const length = randInt(rng, 6, 12)
    const width = randInt(rng, 2, length - 2)
    const scene = siteOf(length, width)
    const unitPrice = randInt(rng, 4, 9)
    let fence: number
    let desc: string
    const gate = randInt(rng, 2, 4)
    if (mode === 0) {
      fence = length + width * 2
      desc = `长边靠墙，三面围上篱笆`
    } else if (mode === 1) {
      fence = length * 2 + width
      desc = `宽边靠墙，三面围上篱笆`
    } else if (mode === 2) {
      fence = length + width
      desc = `相邻的两边靠墙，只围另外两边`
    } else {
      fence = 2 * (length + width) - gate
      desc = `四周围上篱笆，留一个 ${gate} 米宽的门`
    }
    return {
      stem: `一块长方形${scene}长 ${length} 米，宽 ${width} 米。${desc}。篱笆长 ${BLANK} 米；如果每米篱笆 ${unitPrice} 元，一共要 ${BLANK} 元。`,
      answers: [String(fence), String(fence * unitPrice)],
      params: { length, width, gate, unitPrice, fence, unit: '米', mode: ['longSideWall', 'shortSideWall', 'twoSidesWall', 'gate'][mode] },
      values: [length, width, fence, fence * unitPrice],
      features: { form: 'wallFence', level, reverse: false, blanks: 2 },
    }
  }
  const mode = randInt(rng, 0, 3)
  const width = randInt(rng, 3, 8)
  const length = randInt(rng, width + 2, width + 9)
  const scene = siteOf(length, width)
  if (mode === 0) {
    const fence = length + width * 2
    return {
      stem: `一块长方形${scene}长边靠墙，三面围上篱笆，一共用去 ${fence} 米。已知${scene}长 ${length} 米，${scene}宽 ${BLANK} 米。`,
      answers: [String(width)],
      params: { length, width, fence, unit: '米', mode: 'reverseLongWidth' },
      values: [length, width, fence],
      features: { form: 'wallFence', level, reverse: true, blanks: 1 },
    }
  }
  if (mode === 1) {
    const fence = length * 2 + width
    return {
      stem: `一块长方形${scene}宽边靠墙，三面围上篱笆，一共用去 ${fence} 米。已知${scene}宽 ${width} 米，${scene}长 ${BLANK} 米。`,
      answers: [String(length)],
      params: { length, width, fence, unit: '米', mode: 'reverseShortLength' },
      values: [length, width, fence],
      features: { form: 'wallFence', level: 'L3', reverse: true, blanks: 1 },
    }
  }
  if (mode === 2) {
    const gate = randInt(rng, 2, 4)
    const fence = 2 * (length + width) - gate
    return {
      stem: `一块长方形${scene}四周围上篱笆，留一个 ${gate} 米宽的门，一共用去 ${fence} 米。已知${scene}宽 ${width} 米，${scene}长 ${BLANK} 米。`,
      answers: [String(length)],
      params: { length, width, gate, fence, unit: '米', mode: 'reverseGateLength' },
      values: [length, width, gate, fence],
      features: { form: 'wallFence', level, reverse: true, blanks: 1 },
    }
  }
  const fence = length + width
  return {
    stem: `一块长方形${scene}相邻的两边靠墙，只围另外两边，一共用去 ${fence} 米。已知${scene}长 ${length} 米，${scene}宽 ${BLANK} 米。`,
    answers: [String(width)],
    params: { length, width, fence, unit: '米', mode: 'reverseTwoSides' },
    values: [length, width, fence],
    features: { form: 'wallFence', level, reverse: true, blanks: 1 },
  }
}

const buildRectPerimeter: FillBuilder = (rng, level) => {
  const length = randInt(rng, 5, 15)
  const width = randInt(rng, 2, length - 1)
  const perimeter = 2 * (length + width)
  if (level === 'L1') {
    const variant = randInt(rng, 0, 2)
    const unit = variant === 1 ? '米' : '厘米'
    const stem =
      variant === 0
        ? `一个长方形，长 ${length} 厘米，宽 ${width} 厘米，周长是 ${BLANK} 厘米。`
        : variant === 1
          ? `一块长方形菜地长 ${length} 米，宽 ${width} 米，沿四周围一圈要走 ${BLANK} 米。`
          : `一个长方形相框长 ${length} 厘米，宽 ${width} 厘米，四周装上花边，花边长 ${BLANK} 厘米。`
    return {
      stem,
      answers: [String(perimeter)],
      params: { length, width, unit, mode: 'perimeter' },
      values: [length, width, perimeter],
      features: { form: 'rectPerimeter', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const variant = randInt(rng, 0, 2)
    if (variant === 0) {
      return {
        stem: `一个长方形，长 ${length} 分米，宽 ${width} 分米。它的长与宽的和是 ${BLANK} 分米，周长是 ${BLANK} 分米。`,
        answers: [String(length + width), String(perimeter)],
        params: { length, width, unit: '分米', mode: 'sumThenPerimeter' },
        values: [length, width, length + width, perimeter],
        features: { form: 'rectPerimeter', level, reverse: false, blanks: 2 },
      }
    }
    if (variant === 1) {
      const diff = randInt(rng, 1, width - 1)
      const realWidth = width - diff
      const realPerimeter = 2 * (length + realWidth)
      return {
        stem: `一个长方形长 ${length} 厘米，宽比长少 ${diff} 厘米。它的周长是 ${BLANK} 厘米。`,
        answers: [String(realPerimeter)],
        params: { length, width: realWidth, diff, unit: '厘米', mode: 'widthLess' },
        values: [length, realWidth, diff, realPerimeter],
        features: { form: 'rectPerimeter', level, reverse: false, blanks: 1 },
      }
    }
    const realLength = width * 2
    if (realLength <= 15) {
      const realPerimeter = 2 * (realLength + width)
      return {
        stem: `一个长方形宽 ${width} 分米，长是宽的 2 倍。它的周长是 ${BLANK} 分米。`,
        answers: [String(realPerimeter)],
        params: { length: realLength, width, unit: '分米', mode: 'doubleLength' },
        values: [realLength, width, realPerimeter],
        features: { form: 'rectPerimeter', level, reverse: false, blanks: 1 },
      }
    }
    return {
      stem: `一个长方形，长 ${length} 分米，宽 ${width} 分米。它的长与宽的和是 ${BLANK} 分米，周长是 ${BLANK} 分米。`,
      answers: [String(length + width), String(perimeter)],
      params: { length, width, unit: '分米', mode: 'sumThenPerimeter' },
      values: [length, width, length + width, perimeter],
      features: { form: 'rectPerimeter', level, reverse: false, blanks: 2 },
    }
  }
  const variant = randInt(rng, 0, 1)
  if (variant === 0) {
    return {
      stem: `一个长方形的周长是 ${perimeter} 厘米，长是 ${length} 厘米，宽是 ${BLANK} 厘米。`,
      answers: [String(width)],
      params: { length, width, perimeter, unit: '厘米', mode: 'reverseSide' },
      values: [length, width, perimeter],
      features: { form: 'rectPerimeter', level, reverse: true, blanks: 1 },
    }
  }
  return {
    stem: `一根铁丝正好围成一个长方形，周长是 ${perimeter} 分米，宽是 ${width} 分米，长是 ${BLANK} 分米。`,
    answers: [String(length)],
    params: { length, width, perimeter, unit: '分米', mode: 'reverseLength' },
    values: [length, width, perimeter],
    features: { form: 'rectPerimeter', level, reverse: true, blanks: 1 },
  }
}

const buildSquarePerimeter: FillBuilder = (rng, level) => {
  if (level === 'L2') {
    const side = randInt(rng, 2, 9)
    return {
      stem: `一个正方形的边长是 ${side} 分米，它的周长是 ${BLANK} 分米。`,
      answers: [String(side * 4)],
      params: { side, unit: '分米', mode: 'perimeter' },
      values: [side, side * 4],
      features: { form: 'squarePerimeter', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L3') {
    const side = randInt(rng, 4, 18)
    return {
      stem: `一个正方形的周长是 ${side * 4} 厘米，它的边长是 ${BLANK} 厘米。`,
      answers: [String(side)],
      params: { side, unit: '厘米', mode: 'reverseSide' },
      values: [side, side * 4],
      features: { form: 'squarePerimeter', level, reverse: true, blanks: 1 },
    }
  }
  const side = randInt(rng, 3, 15)
  return {
    stem: `一个正方形的边长是 ${side} 厘米，周长是 ${BLANK} 厘米。`,
    answers: [String(side * 4)],
    params: { side, unit: '厘米', mode: 'perimeter' },
    values: [side, side * 4],
    features: { form: 'squarePerimeter', level, reverse: false, blanks: 1 },
  }
}

const PRICE_ITEMS = [
  { noun: '铅笔', unit: '支' },
  { noun: '练习本', unit: '本' },
  { noun: '橡皮', unit: '块' },
]

const PRICE_NAMES = ['小明', '小红', '小华', '丁丁']

const buildPriceQty: FillBuilder = (rng, level) => {
  const item = pick(rng, PRICE_ITEMS)
  if (level === 'L1') {
    const price = randInt(rng, 2, 9)
    const quantity = randInt(rng, 3, 9)
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `每${item.unit}${item.noun} ${price} 元，买 ${quantity} ${item.unit}一共 ${BLANK} 元。`
        : variant === 1
          ? `${item.noun}每${item.unit} ${price} 元，${quantity} ${item.unit}要付 ${BLANK} 元。`
          : `买 ${quantity} ${item.unit}${item.noun}，每${item.unit} ${price} 元，一共花了 ${BLANK} 元。`
    return {
      stem,
      answers: [String(price * quantity)],
      params: { price, quantity, mode: 'total' },
      values: [price, quantity, price * quantity],
      features: { form: 'priceQty', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const price = randInt(rng, 4, 12)
    const quantity = randInt(rng, 3, 9)
    const total = price * quantity
    // 付款金额取整十，找回的钱为正数
    const paid = Math.ceil((total + 1) / 10) * 10
    const change = paid - total
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `每${item.unit}${item.noun} ${price} 元，买 ${quantity} ${item.unit}一共 ${BLANK} 元；付给收银员 ${paid} 元，应找回 ${BLANK} 元。`
        : variant === 1
          ? `${item.noun}每${item.unit} ${price} 元，${pick(rng, PRICE_NAMES)} 买了 ${quantity} ${item.unit}，付 ${paid} 元。一共要 ${BLANK} 元，应找回 ${BLANK} 元。`
          : `买 ${quantity} ${item.unit}${item.noun}，每${item.unit} ${price} 元，付给收银员 ${paid} 元。一共 ${BLANK} 元，找回 ${BLANK} 元。`
    return {
      stem,
      answers: [String(total), String(change)],
      params: { price, quantity, paid, mode: 'totalThenChange' },
      values: [price, quantity, total, paid, change],
      features: { form: 'priceQty', level, reverse: false, blanks: 2 },
    }
  }
  const quantity = randInt(rng, 4, 9)
  const price = randInt(rng, 3, 9)
  const total = price * quantity
  const paid = Math.ceil((total + 1) / 10) * 10
  const change = paid - total
  const variant = (price + quantity) % 4
  if (variant === 0) {
    return {
      stem: `买 ${quantity} 个同样的皮球一共用了 ${total} 元，每个皮球 ${BLANK} 元。`,
      answers: [String(price)],
      params: { price, quantity, total, mode: 'reverseUnitPrice' },
      values: [price, quantity, total],
      features: { form: 'priceQty', level, reverse: true, blanks: 1 },
    }
  }
  if (variant === 1) {
    return {
      stem: `每个毽子 ${price} 元，${total} 元可以买 ${BLANK} 个毽子。`,
      answers: [String(quantity)],
      params: { price, quantity, total, mode: 'reverseQuantity' },
      values: [price, quantity, total],
      features: { form: 'priceQty', level, reverse: true, blanks: 1 },
    }
  }
  if (variant === 2) {
    return {
      stem: `买 ${quantity} 本同样的练习本，付给收银员 ${paid} 元，找回 ${change} 元。每本练习本 ${BLANK} 元。`,
      answers: [String(price)],
      params: { price, quantity, total, paid, change, mode: 'reverseUnitByChange' },
      values: [price, quantity, total, paid, change],
      features: { form: 'priceQty', level, reverse: true, blanks: 1 },
    }
  }
  return {
    stem: `买 ${quantity} 个同样的${item.noun}，付给收银员 ${paid} 元，找回 ${change} 元。一共要 ${BLANK} 元。`,
    answers: [String(total)],
    params: { price, quantity, total, paid, change, mode: 'reverseTotalByChange' },
    values: [price, quantity, total, paid, change],
    features: { form: 'priceQty', level, reverse: true, blanks: 1 },
  }
}

const buildAreaUnit: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const count = randInt(rng, 1, 9)
    const large = rng() < 0.5
    return {
      stem: `${count} ${large ? '平方米' : '平方分米'} = ${BLANK} ${large ? '平方分米' : '平方厘米'}。`,
      answers: [String(count * 100)],
      params: { count, direction: large ? 1 : 0, mode: 'basic' },
      values: [count, count * 100],
      features: { form: 'areaUnit', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const count = randInt(rng, 2, 20)
    return {
      stem: `${count} 平方米 = ${BLANK} 平方分米。`,
      answers: [String(count * 100)],
      params: { count, mode: 'm2dm' },
      values: [count, count * 100],
      features: { form: 'areaUnit', level, reverse: false, blanks: 1 },
    }
  }
  const count = randInt(rng, 2, 20)
  return {
    stem: `${count * 100} 平方分米 = ${BLANK} 平方米。`,
    answers: [String(count)],
    params: { count, mode: 'dm2m' },
    values: [count, count * 100],
    features: { form: 'areaUnit', level, reverse: true, blanks: 1 },
  }
}

const buildRectArea: FillBuilder = (rng, level) => {
  const length = randInt(rng, 5, 12)
  const width = randInt(rng, 2, length - 1)
  const area = length * width
  if (level === 'L1') {
    return {
      stem: `长 ${length} 米、宽 ${width} 米的长方形，面积是 ${BLANK} 平方米。`,
      answers: [String(area)],
      params: { length, width, unit: '米', mode: 'area' },
      values: [length, width, area],
      features: { form: 'rectArea', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const unitPrice = randInt(rng, 2, 6)
    return {
      stem: `长 ${length} 分米、宽 ${width} 分米的长方形，面积是 ${BLANK} 平方分米；如果每平方分米铺 ${unitPrice} 元，一共需要 ${BLANK} 元。`,
      answers: [String(area), String(area * unitPrice)],
      params: { length, width, unitPrice, unit: '分米', mode: 'areaThenCost' },
      values: [length, width, area, area * unitPrice],
      features: { form: 'rectArea', level, reverse: false, blanks: 2 },
    }
  }
  return {
    stem: `一个长方形的面积是 ${area} 平方米，长是 ${length} 米，宽是 ${BLANK} 米。`,
    answers: [String(width)],
    params: { length, width, area, unit: '米', mode: 'reverseSide' },
    values: [length, width, area],
    features: { form: 'rectArea', level, reverse: true, blanks: 1 },
  }
}

const buildSquareArea: FillBuilder = (rng, level) => {
  if (level === 'L2') {
    const side = randInt(rng, 3, 12)
    return {
      stem: `边长 ${side} 分米的正方形，面积是 ${BLANK} 平方分米。`,
      answers: [String(side * side)],
      params: { side, unit: '分米', mode: 'area' },
      values: [side, side * side],
      features: { form: 'squareArea', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L3') {
    const side = randInt(rng, 3, 15)
    return {
      stem: `一个正方形的面积是 ${side * side} 平方厘米，它的边长是 ${BLANK} 厘米。`,
      answers: [String(side)],
      params: { side, unit: '厘米', mode: 'reverseSide' },
      values: [side, side * side],
      features: { form: 'squareArea', level, reverse: true, blanks: 1 },
    }
  }
  const side = randInt(rng, 3, 12)
  return {
    stem: `边长 ${side} 厘米的正方形，面积是 ${BLANK} 平方厘米。`,
    answers: [String(side * side)],
    params: { side, unit: '厘米', mode: 'area' },
    values: [side, side * side],
    features: { form: 'squareArea', level, reverse: false, blanks: 1 },
  }
}

// 数学广场：找规律摆图形，U8 的独立玩法之一
const buildPattern: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const count = randInt(rng, 2, 8)
    const sticks = 4 + 3 * (count - 1)
    return {
      stem: `用同样长的小棒摆正方形：摆 1 个正方形要 4 根，以后每多摆 1 个就多 3 根。照这样摆 ${count} 个正方形，一共要 ${BLANK} 根小棒。`,
      answers: [String(sticks)],
      params: { count, sticks, mode: 'squareSticks' },
      values: [count, sticks],
      features: { form: 'pattern', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const count = randInt(rng, 3, 12)
    const sticks = 4 + 3 * (count - 1)
    return {
      stem: `用同样长的小棒摆正方形：摆 1 个正方形要 4 根，以后每多摆 1 个就多 3 根。照这样摆正方形，一共用了 ${sticks} 根小棒，摆成了 ${BLANK} 个正方形。`,
      answers: [String(count)],
      params: { count, sticks, mode: 'squareSticksReverse' },
      values: [count, sticks],
      features: { form: 'pattern', level, reverse: true, blanks: 1 },
    }
  }
  const count = randInt(rng, 3, 12)
  const sticks = 3 + 2 * (count - 1)
  return {
    stem: `用同样长的小棒摆三角形：摆 1 个三角形要 3 根，以后每多摆 1 个就多 2 根。①摆 ${count} 个三角形要 ${BLANK} 根小棒；②用 ${sticks} 根小棒，照这样一共能摆 ${BLANK} 个三角形。`,
    answers: [String(sticks), String(count)],
    params: { count, sticks, mode: 'triangleSticks' },
    values: [count, sticks],
    features: { form: 'pattern', level, reverse: false, blanks: 2 },
  }
}

// 数学广场：围成正方形时面积最大（U8 的独立玩法之二）
const buildMaxArea: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const side = randInt(rng, 3, 12)
    const wire = side * 4
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `用 ${wire} 根 1 米长的小棒摆成一个正方形，边长是 ${BLANK} 米，面积是 ${BLANK} 平方米。`
        : variant === 1
          ? `一根长 ${wire} 米的铁丝正好围成一个正方形，边长是 ${BLANK} 米，面积是 ${BLANK} 平方米。`
          : `一根长 ${wire} 米的绳子正好围成一个正方形，边长是 ${BLANK} 米，面积是 ${BLANK} 平方米。`
    return {
      stem,
      answers: [String(side), String(side * side)],
      params: { side, wire, unit: '米', mode: 'wireSquare' },
      values: [side, wire, side * side],
      features: { form: 'maxArea', level, reverse: false, blanks: 2 },
    }
  }
  if (level === 'L2') {
    const side = randInt(rng, 4, 12)
    const wire = side * 4
    const variant = randInt(rng, 0, 2)
    const noun = variant === 0 ? '绳子' : variant === 1 ? '篱笆' : '铁丝'
    return {
      stem: `用长 ${wire} 米的${noun}围成一个正方形，面积最大是 ${BLANK} 平方米。`,
      answers: [String(side * side)],
      params: { side, wire, unit: '米', mode: 'ropeMaxArea', noun },
      values: [side, wire, side * side],
      features: { form: 'maxArea', level, reverse: false, blanks: 1 },
    }
  }
  const side = randInt(rng, 4, 12)
  const area = side * side
  const variant = randInt(rng, 0, 2)
  const tail =
    variant === 0
      ? `周长是 ${BLANK} 米。`
      : variant === 1
        ? `在四周围一圈篱笆，篱笆至少长 ${BLANK} 米。`
        : `在四周贴一圈花边，花边一共长 ${BLANK} 米。`
  return {
    stem: `一个正方形的面积是 ${area} 平方米，它的边长是 ${BLANK} 米，${tail}`,
    answers: [String(side), String(side * 4)],
    params: { side, area, unit: '米', mode: 'squareFromArea' },
    values: [side, area, side * 4],
    features: { form: 'maxArea', level, reverse: true, blanks: 2 },
  }
}

// 数学广场：七巧板拼摆（U8 的独立玩法之三）
const buildTangram: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const mode = randInt(rng, 0, 2)
    if (mode === 0) {
      const pieces = randInt(rng, 2, 6) * 2
      const groups = pieces / 2
      return {
        stem: `用七巧板拼摆：2 块同样的小三角形可以拼成 1 个正方形。有 ${pieces} 块小三角形，可以拼成 ${BLANK} 个正方形。`,
        answers: [String(groups)],
        params: { pieces, per: 2, mode: 'triToSquare' },
        values: [pieces, groups],
        features: { form: 'tangram', level, reverse: false, blanks: 1 },
      }
    }
    if (mode === 1) {
      const pieces = randInt(rng, 2, 5) * 3
      const groups = pieces / 3
      return {
        stem: `用七巧板拼摆：3 块同样的小三角形可以拼成 1 个梯形。有 ${pieces} 块小三角形，可以拼成 ${BLANK} 个梯形。`,
        answers: [String(groups)],
        params: { pieces, per: 3, mode: 'triToTrapezoid' },
        values: [pieces, groups],
        features: { form: 'tangram', level, reverse: false, blanks: 1 },
      }
    }
    const sets = randInt(rng, 2, 5)
    return {
      stem: `一副七巧板有 7 块。${sets} 副七巧板一共有 ${BLANK} 块。`,
      answers: [String(sets * 7)],
      params: { sets, mode: 'pieceCount' },
      values: [sets, sets * 7],
      features: { form: 'tangram', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const mode = randInt(rng, 0, 2)
    if (mode === 0) {
      const groups = randInt(rng, 2, 6)
      return {
        stem: `用七巧板拼摆：每 2 块小三角形拼成 1 个正方形。拼成 ${groups} 个正方形要用 ${BLANK} 块小三角形。`,
        answers: [String(groups * 2)],
        params: { groups, per: 2, mode: 'triToSquareReverse' },
        values: [groups, groups * 2],
        features: { form: 'tangram', level, reverse: true, blanks: 1 },
      }
    }
    if (mode === 1) {
      const sets = randInt(rng, 2, 6)
      return {
        stem: `每副七巧板中有 5 块三角形。${sets} 副七巧板中三角形一共有 ${BLANK} 块。`,
        answers: [String(sets * 5)],
        params: { sets, mode: 'groupTriangle' },
        values: [sets, sets * 5],
        features: { form: 'tangram', level, reverse: false, blanks: 1 },
      }
    }
    const sets = randInt(rng, 2, 6)
    return {
      stem: `每副七巧板中有 1 块正方形和 1 块平行四边形。${sets} 副七巧板中，正方形和平行四边形一共有 ${BLANK} 块。`,
      answers: [String(sets * 2)],
      params: { sets, mode: 'groupFlat' },
      values: [sets, sets * 2],
      features: { form: 'tangram', level, reverse: false, blanks: 1 },
    }
  }
  const mode = randInt(rng, 0, 2)
  if (mode === 0) {
    const sets = randInt(rng, 3, 8)
    return {
      stem: `一副七巧板有 7 块，其中 5 块是三角形。${sets} 副七巧板一共有 ${BLANK} 块，其中三角形一共有 ${BLANK} 块。`,
      answers: [String(sets * 7), String(sets * 5)],
      params: { sets, mode: 'pieceTwoQuestions' },
      values: [sets, sets * 7, sets * 5],
      features: { form: 'tangram', level, reverse: false, blanks: 2 },
    }
  }
  if (mode === 1) {
    const pieces = randInt(rng, 5, 9) * 2 + 1
    const groups = Math.floor(pieces / 2)
    return {
      stem: `有 ${pieces} 块同样的小三角形，每 2 块拼成 1 个正方形。最多能拼成 ${BLANK} 个正方形，还剩 ${BLANK} 块。`,
      answers: [String(groups), String(pieces % 2)],
      params: { pieces, per: 2, mode: 'remainderSquare' },
      values: [pieces, groups, pieces % 2],
      features: { form: 'tangram', level, reverse: false, blanks: 2 },
    }
  }
  const groups = randInt(rng, 3, 8)
  const pieces = groups * 3
  return {
    stem: `用七巧板拼摆：3 块同样的小三角形可以拼成 1 个梯形。有 ${pieces} 块小三角形，一共可以拼成 ${BLANK} 个梯形。`,
    answers: [String(groups)],
    params: { pieces, per: 3, mode: 'triToTrapezoidReverse' },
    values: [pieces, groups],
    features: { form: 'tangram', level, reverse: true, blanks: 1 },
  }
}

const FRACTION_CONTEXTS = [
  { whole: '一张纸', part: '这张纸' },
  { whole: '一块饼', part: '这块饼' },
  { whole: '一根绳子', part: '这根绳子' },
  { whole: '一个蛋糕', part: '这个蛋糕' },
]

const buildFractionUnit: FillBuilder = (rng, level) => {
  const context = randInt(rng, 0, FRACTION_CONTEXTS.length - 1)
  const { whole, part } = FRACTION_CONTEXTS[context]
  if (level === 'L1') {
    const denominator = randInt(rng, 2, 10)
    return {
      stem: `把${whole}平均分成 ${denominator} 份，每份是${part}的 ${BLANK}。`,
      answers: [`1/${denominator}`],
      params: { denominator, numerator: 1, context, mode: 'unit' },
      values: [denominator, 1],
      features: { form: 'fractionUnit', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    // 仍然只问“几分之一”，但分母更大、换成生活情境
    const denominator = randInt(rng, 5, 12)
    return {
      stem: `把${whole}平均分成 ${denominator} 份，其中的 1 份是${part}的 ${BLANK}，读作${BLANK}分之一。`,
      answers: [`1/${denominator}`, String(denominator)],
      params: { denominator, numerator: 1, context, mode: 'unitL2' },
      values: [denominator, 1],
      features: { form: 'fractionUnit', level, reverse: false, blanks: 2 },
    }
  }
  const denominator = randInt(rng, 4, 12)
  return {
    stem: `把${whole}平均分成若干份，每份是${part}的 $\\frac{1}{${denominator}}$，一共分成了 ${BLANK} 份。`,
    answers: [String(denominator)],
    params: { denominator, numerator: 1, context, mode: 'reverseDenominator' },
    values: [denominator, 1],
    features: { form: 'fractionUnit', level, reverse: true, blanks: 1 },
  }
}

const buildFractionPart: FillBuilder = (rng, level) => {
  const context = randInt(rng, 0, FRACTION_CONTEXTS.length - 1)
  if (level === 'L2') {
    const denominator = randInt(rng, 5, 9)
    const numerator = randInt(rng, 2, denominator - 1)
    return {
      stem: `把${FRACTION_CONTEXTS[context].whole}平均分成 ${denominator} 份，其中 ${numerator} 份是${FRACTION_CONTEXTS[context].part}的 ${BLANK}。`,
      answers: [`${numerator}/${denominator}`],
      params: { denominator, numerator, context, mode: 'part' },
      values: [denominator, numerator],
      features: { form: 'fractionPart', level, reverse: false, blanks: 1 },
    }
  }
  const denominator = randInt(rng, 5, 9)
  let first = randInt(rng, 2, denominator - 1)
  let second = randInt(rng, 2, denominator - 1)
  if (first === second) second = ((second + 2) % denominator) || 2
  const larger = Math.max(first, second)
  const variant = randInt(rng, 0, 2)
  const stem =
    variant === 0
      ? `$\\frac{${first}}{${denominator}}$ 和 $\\frac{${second}}{${denominator}}$ 中，比较大的是 ${BLANK}。`
      : variant === 1
        ? `比较 $\\frac{${first}}{${denominator}}$ 和 $\\frac{${second}}{${denominator}}$，大的分数是 ${BLANK}。`
        : `在 $\\frac{${first}}{${denominator}}$ 与 $\\frac{${second}}{${denominator}}$ 中，哪一个大？答：${BLANK}。`
  return {
    stem,
    answers: [`${larger}/${denominator}`],
    params: { denominator, first, second, mode: 'compare' },
    values: [denominator, first, second],
    features: { form: 'fractionPart', level, reverse: true, blanks: 1 },
  }
}

const buildFraction: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const denominator = randInt(rng, 2, 10)
    const context = randInt(rng, 0, FRACTION_CONTEXTS.length - 1)
    return {
      stem: `把${FRACTION_CONTEXTS[context].whole}平均分成 ${denominator} 份，每份是${FRACTION_CONTEXTS[context].part}的 ${BLANK}。`,
      answers: [`1/${denominator}`],
      params: { denominator, numerator: 1, context, mode: 'unit' },
      values: [denominator, 1],
      features: { form: 'fraction', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const denominator = randInt(rng, 3, 9)
    const numerator = randInt(rng, 1, denominator - 1)
    return {
      stem: `一根绳子平均分成 ${denominator} 段，其中 ${numerator} 段是这根绳子的 ${BLANK}。`,
      answers: [`${numerator}/${denominator}`],
      params: { denominator, numerator, mode: 'part' },
      values: [denominator, numerator],
      features: { form: 'fraction', level, reverse: false, blanks: 1 },
    }
  }
  const denominator = randInt(rng, 5, 9)
  let first = randInt(rng, 1, denominator - 1)
  let second = randInt(rng, 1, denominator - 1)
  if (first === second) second = ((second + 2) % denominator) || 1
  const larger = Math.max(first, second)
  return {
    stem: `$\\frac{${first}}{${denominator}}$ 和 $\\frac{${second}}{${denominator}}$ 中，比较大的是 ${BLANK}。`,
    answers: [`${larger}/${denominator}`],
    params: { denominator, first, second, mode: 'compare' },
    values: [denominator, first, second],
    features: { form: 'fraction', level, reverse: true, blanks: 1 },
  }
}

const buildSpeed: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const speed = randInt(rng, 4, 9) * 10
    const hours = randInt(rng, 2, 5)
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `一辆汽车每小时行 ${speed} 千米，${hours} 小时一共行 ${BLANK} 千米。`
        : variant === 1
          ? `一辆货车平均每小时行 ${speed} 千米，行驶 ${hours} 小时后行 ${BLANK} 千米。`
          : `客车每小时行驶 ${speed} 千米，${hours} 小时能行 ${BLANK} 千米。`
    return {
      stem,
      answers: [String(speed * hours)],
      params: { speed, hours, mode: 'distance' },
      values: [speed, hours, speed * hours],
      features: { form: 'speed', level, reverse: false, blanks: 1 },
    }
  }
  if (level === 'L2') {
    const speed = randInt(rng, 4, 9) * 10
    const hours = randInt(rng, 2, 5)
    const distance = speed * hours
    const variant = randInt(rng, 0, 2)
    const stem =
      variant === 0
        ? `甲、乙两地相距 ${distance} 千米，汽车 ${hours} 小时行完全程，平均每小时行 ${BLANK} 千米。`
        : variant === 1
          ? `一辆汽车 ${hours} 小时行了 ${distance} 千米，平均每小时行 ${BLANK} 千米。`
          : `小明骑车 ${hours} 小时骑了 ${distance} 千米，平均每小时骑 ${BLANK} 千米。`
    return {
      stem,
      answers: [String(speed)],
      params: { speed, hours, distance, mode: 'reverseSpeed' },
      values: [speed, hours, distance],
      features: { form: 'speed', level, reverse: true, blanks: 1 },
    }
  }
  const speed = randInt(rng, 4, 9) * 10
  const hours = randInt(rng, 2, 4)
  const distance = speed * hours
  const variant = randInt(rng, 0, 2)
  const departHour = variant === 0 ? 9 : variant === 1 ? 8 : 10
  const vehicle = variant === 0 ? '汽车' : variant === 1 ? '火车' : '汽车'
  return {
    stem: `${vehicle} ${variant === 2 ? '上午 ' : ''}${departHour} 时出发，每小时行 ${speed} 千米，行驶 ${distance} 千米后到达目的地。到达时是 ${BLANK} 时。`,
    answers: [String(departHour + hours)],
    params: { speed, hours, distance, departHour, mode: 'arrival' },
    values: [speed, hours, distance, departHour + hours],
    features: { form: 'speed', level, reverse: true, blanks: 1 },
  }
}

// ---------- 两位数乘除（3B-U2 核心） ----------

const buildMul2x2: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const price = randInt(rng, 12, 39)
    const quantity = randInt(rng, 12, 19)
    return {
      stem: `每盒彩笔 ${price} 元，买 ${quantity} 盒一共要付 ${BLANK} 元。`,
      answers: [String(price * quantity)],
      params: { price, quantity, mode: 'single2' },
      values: [price, quantity, price * quantity],
      features: { form: 'mul2x2', level, reverse: false, blanks: 1, twoDigitStep: true },
    }
  }
  if (level === 'L2') {
    const perBox = randInt(rng, 12, 39)
    const boxes = randInt(rng, 12, 19)
    const unitPrice = randInt(rng, 2, 6)
    const total = perBox * boxes
    return {
      stem: `每箱牛奶 ${perBox} 瓶，${boxes} 箱一共有 ${BLANK} 瓶；每瓶 ${unitPrice} 元，这些牛奶一共要付 ${BLANK} 元。`,
      answers: [String(total), String(total * unitPrice)],
      params: { perBox, boxes, unitPrice, mode: 'twoStage2' },
      values: [perBox, boxes, unitPrice, total, total * unitPrice],
      features: { form: 'mul2x2', level, reverse: false, blanks: 2, twoDigitStep: true },
    }
  }
  const boxes = randInt(rng, 12, 29)
  const perBox = randInt(rng, 12, 29)
  const total = boxes * perBox
  return {
    stem: `${boxes} 盒彩笔一共 ${total} 支，平均每盒 ${BLANK} 支。`,
    answers: [String(perBox)],
    params: { boxes, perBox, total, mode: 'reverseBox2' },
    values: [boxes, perBox, total],
    features: { form: 'mul2x2', level, reverse: true, blanks: 1, twoDigitStep: true },
  }
}

const buildMul2x3: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const price = randInt(rng, 108, 399)
    const quantity = randInt(rng, 12, 24)
    return {
      stem: `每套校服 ${price} 元，买 ${quantity} 套一共要付 ${BLANK} 元。`,
      answers: [String(price * quantity)],
      params: { price, quantity, mode: 'single3' },
      values: [price, quantity, price * quantity],
      features: { form: 'mul2x3', level, reverse: false, blanks: 1, twoDigitStep: true },
    }
  }
  if (level === 'L2') {
    const price = randInt(rng, 105, 399)
    const quantity = randInt(rng, 12, 24)
    const freight = randInt(rng, 5, 15)
    const total = price * quantity
    return {
      stem: `每台学习机 ${price} 元，买 ${quantity} 台一共要付 ${BLANK} 元；每台运费 ${freight} 元，运费一共 ${BLANK} 元。`,
      answers: [String(total), String(quantity * freight)],
      params: { price, quantity, freight, mode: 'freight3' },
      values: [price, quantity, freight, total, quantity * freight],
      features: { form: 'mul2x3', level, reverse: false, blanks: 2, twoDigitStep: true },
    }
  }
  const price = randInt(rng, 105, 399)
  const quantity = randInt(rng, 12, 24)
  const total = price * quantity
  return {
    stem: `买 ${quantity} 套校服一共付了 ${total} 元，平均每套 ${BLANK} 元。`,
    answers: [String(price)],
    params: { price, quantity, total, mode: 'reverse3' },
    values: [price, quantity, total],
    features: { form: 'mul2x3', level, reverse: true, blanks: 1, twoDigitStep: true },
  }
}

const buildDiv2x2: FillBuilder = (rng, level) => {
  if (level === 'L1') {
    const perBox = randInt(rng, 12, 24)
    const boxes = randInt(rng, 10, 19)
    return {
      stem: `有 ${perBox * boxes} 个苹果，每 ${perBox} 个装一箱，可以装 ${BLANK} 箱。`,
      answers: [String(boxes)],
      params: { perBox, boxes, total: perBox * boxes, mode: 'boxes2' },
      values: [perBox, boxes, perBox * boxes],
      features: { form: 'div2x2', level, reverse: false, blanks: 1, twoDigitStep: true },
    }
  }
  if (level === 'L2') {
    const perBox = randInt(rng, 24, 39)
    const boxes = randInt(rng, 10, 24)
    const rest = randInt(rng, 1, perBox - 1)
    const total = perBox * boxes + rest
    return {
      stem: `${total} 个苹果，每 ${perBox} 个装一箱，最多能装满 ${BLANK} 箱，还剩 ${BLANK} 个。`,
      answers: [String(boxes), String(rest)],
      params: { perBox, boxes, rest, total, mode: 'remainder2' },
      values: [perBox, boxes, rest, total],
      features: { form: 'div2x2', level, reverse: false, blanks: 2, twoDigitStep: true },
    }
  }
  const perBox = randInt(rng, 12, 39)
  const boxes = randInt(rng, 10, 24)
  const rest = randInt(rng, 1, perBox - 1)
  return {
    stem: `每箱装 ${perBox} 个苹果，装了 ${boxes} 箱后还剩 ${rest} 个，一共有 ${BLANK} 个苹果。`,
    answers: [String(perBox * boxes + rest)],
    params: { perBox, boxes, rest, mode: 'reverseTotal' },
    values: [perBox, boxes, rest, perBox * boxes + rest],
    features: { form: 'div2x2', level, reverse: true, blanks: 1, twoDigitStep: true },
  }
}

const BUILDERS: Record<FillFormName, FillBuilder> = {
  leapYear: buildLeapYear,
  monthDays: buildMonthDays,
  timeHour: buildTimeHour,
  elapsed: buildElapsed,
  lengthUnits: buildLengthUnits,
  kmM: buildKmM,
  routeSum: buildRouteSum,
  wallFence: buildWallFence,
  rectPerimeter: buildRectPerimeter,
  squarePerimeter: buildSquarePerimeter,
  priceQty: buildPriceQty,
  areaUnit: buildAreaUnit,
  rectArea: buildRectArea,
  squareArea: buildSquareArea,
  pattern: buildPattern,
  maxArea: buildMaxArea,
  tangram: buildTangram,
  fraction: buildFraction,
  fractionUnit: buildFractionUnit,
  fractionPart: buildFractionPart,
  speed: buildSpeed,
  mul2x2: buildMul2x2,
  mul2x3: buildMul2x3,
  div2x2: buildDiv2x2,
  'angle-count': (rng, level) => buildAngleFill('angle-count', rng, level),
  'angle-classify': (rng, level) => buildAngleFill('angle-classify', rng, level),
  'angle-add-line': (rng, level) => buildAngleFill('angle-add-line', rng, level),
}

// ---------- 独立求值：只看 params 重算答案 ----------

const reversed = (answer: string): string => answer.replace(/\s+/g, '')

/** 与生成路径分离的复核：返回按 params 重新推算的答案 */
export function verifyFill(form: FillFormName, params: ParamMap): string[] {
  const n = (key: string): number => {
    const value = params[key]
    if (typeof value !== 'number') throw new Error(`参数 ${key} 不是数字`)
    return value
  }
  const text = (key: string): string => {
    const value = params[key]
    if (typeof value !== 'string') throw new Error(`参数 ${key} 不是字符串`)
    return value
  }

  switch (form) {
    case 'angle-count':
    case 'angle-classify':
    case 'angle-add-line':
      return verifyAngleFill(form, params)
    case 'leapYear': {
      const year = n('year')
      const leap = (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0)
      const mode = text('mode')
      if (mode === 'judge') return [leap ? '闰年' : '平年']
      if (mode === 'feb') return [String(leap ? 29 : 28)]
      return [String(31 + (leap ? 29 : 28) + 31), String(leap ? 366 : 365)]
    }
    case 'monthDays': {
      const mode = text('mode')
      if (mode === 'bigPair') {
        const first = n('first')
        const second = n('second')
        const big = (x: number) => [1, 3, 5, 7, 8, 10, 12].includes(x)
        if (!big(first) || !big(second)) throw new Error('不是大月')
        const consecutive = (first + 1) % 12 === second % 12 || (first === 12 && second === 1)
        if (!consecutive) throw new Error('不是连续大月')
        return [String(first), String(second)]
      }
      const month = n('month')
      const days = month === 2 ? 28 : [4, 6, 9, 11].includes(month) ? 30 : 31
      if (mode === 'days') return [String(days)]
      return [String(days), days === 31 ? '大' : '小']
    }
    case 'timeHour': {
      const hour = n('hour')
      const minute = n('minute')
      const mode = text('mode')
      if (mode === 'to24') return minute === 0 ? [String(hour + 12)] : [String(hour + 12), String(minute)]
      return [String(hour - 12), String(minute)]
    }
    case 'elapsed': {
      const hour = n('hour')
      const mode = text('mode')
      const duration = n('duration')
      if (mode === 'duration') {
        const minutes = n('endHour') * 60 + n('endMinute') - (hour * 60 + n('startMinute'))
        if (minutes <= 0) throw new Error('结束时刻早于开始时刻')
        return [String(minutes)]
      }
      if (mode === 'end') {
        const total = hour * 60 + n('startMinute') + duration
        return [String(Math.floor(total / 60)), String(total % 60)]
      }
      const startTotal = hour * 60 + n('endMinute') - duration
      if (startTotal < 0) throw new Error('出发时间早于 0 时')
      return [String(Math.floor(startTotal / 60)), String(startTotal % 60)]
    }
    case 'lengthUnits': {
      const mode = text('mode')
      if (mode === 'm2cm') return [String(n('metres') * 100)]
      if (mode === 'mixed2cm') return [String(100 + n('centimetres'))]
      return [String(n('metres')), String(n('decimetres'))]
    }
    case 'kmM': {
      const mode = text('mode')
      const kilometres = n('kilometres')
      const metres = n('metres')
      if (mode === 'km2m') return [String(kilometres * 1000)]
      if (mode === 'kmDiff') return [String(kilometres - metres)]
      if (mode === 'unitChoice') return [text('unit')]
      if (mode === 'mixed2m') return [String(kilometres * 1000 + metres)]
      return [String(kilometres), String(metres)]
    }
    case 'routeSum': {
      const mode = text('mode')
      if (mode === 'twoLegs') return [String(n('a') + n('b'))]
      const oneWay = n('a') + n('b')
      if (mode === 'compareMore') return [String(oneWay + n('extra'))]
      if (mode === 'compareLess') return [String(oneWay - n('extra'))]
      return [String(Math.abs(oneWay - n('otherWay')))]
    }
    case 'wallFence': {
      const mode = text('mode')
      const width = n('width')
      const length = n('length')
      const fence = n('fence')
      const gate = typeof params.gate === 'number' ? n('gate') : 0
      const expectFence = (): number => {
        if (mode === 'longSideWall' || mode === 'reverseLongWidth') return length + 2 * width
        if (mode === 'shortSideWall' || mode === 'reverseShortLength') return 2 * length + width
        if (mode === 'twoSidesWall' || mode === 'reverseTwoSides') return length + width
        if (mode === 'gate' || mode === 'reverseGateLength') return 2 * (length + width) - gate
        throw new Error(`未知篱笆形态: ${mode}`)
      }
      if (expectFence() !== fence) throw new Error('篱笆长度与参数不一致')
      if (length <= width) throw new Error('长方形的长必须大于宽')
      if (mode === 'reverseLongWidth') return [String(fence - 2 * length)]
      if (mode === 'reverseShortLength') return [String(fence - 2 * width)]
      if (mode === 'reverseTwoSides') return [String(fence - length)]
      if (mode === 'reverseGateLength') {
        const got = (fence + gate) / 2 - width
        if (!Number.isInteger(got)) throw new Error('反求出的长不是整数')
        if (got !== length) throw new Error('反求出的长不成立')
        return [String(got)]
      }
      if (typeof params.unitPrice === 'number') {
        return [String(fence), String(fence * n('unitPrice'))]
      }
      return [String(fence)]
    }
    case 'pattern': {
      const mode = text('mode')
      const count = n('count')
      if (mode === 'squareSticks') {
        const sticks = n('sticks')
        if (sticks !== 4 + 3 * (count - 1)) throw new Error('正方形小棒数不成立')
        return [String(sticks)]
      }
      if (mode === 'squareSticksReverse') {
        const sticks = n('sticks')
        if ((sticks - 4) % 3 !== 0) throw new Error('小棒根数不能对应整数个正方形')
        return [String((sticks - 4) / 3 + 1)]
      }
      const sticks = n('sticks')
      if (sticks !== 3 + 2 * (count - 1)) throw new Error('三角形小棒数不成立')
      return [String(sticks), String(count)]
    }
    case 'maxArea': {
      const mode = text('mode')
      if (mode === 'ropeMaxArea') {
        const side = n('side')
        if (n('wire') !== side * 4) throw new Error('绳子长度不能围成该正方形')
        return [String(side * side)]
      }
      if (mode === 'squareFromArea') {
        const side = n('side')
        if (n('area') !== side * side) throw new Error('面积与边长不匹配')
        return [String(side), String(side * 4)]
      }
      const side = n('side')
      if (n('wire') !== side * 4) throw new Error('小棒根数不能围成该正方形')
      return [String(side), String(side * side)]
    }
    case 'tangram': {
      const mode = text('mode')
      if (mode === 'triToSquare' || mode === 'triToTrapezoid' || mode === 'triToTrapezoidReverse') {
        const pieces = n('pieces')
        const per = n('per')
        if (pieces % per !== 0) throw new Error('小三角形块数不能正好拼成整数个图形')
        return [String(pieces / per)]
      }
      if (mode === 'pieceCount') {
        const sets = n('sets')
        return [String(sets * 7)]
      }
      if (mode === 'triToSquareReverse') {
        const groups = n('groups')
        return [String(groups * 2)]
      }
      if (mode === 'groupTriangle') {
        const sets = n('sets')
        return [String(sets * 5)]
      }
      if (mode === 'groupFlat') {
        const sets = n('sets')
        return [String(sets * 2)]
      }
      if (mode === 'pieceTwoQuestions') {
        const sets = n('sets')
        return [String(sets * 7), String(sets * 5)]
      }
      const pieces = n('pieces')
      const per = n('per')
      return [String(Math.floor(pieces / per)), String(pieces % per)]
    }
    case 'rectPerimeter': {
      const length = n('length')
      const width = n('width')
      const mode = text('mode')
      if (mode === 'perimeter') return [String((length + width) * 2)]
      if (mode === 'sumThenPerimeter') return [String(length + width), String((length + width) * 2)]
      if (mode === 'widthLess' || mode === 'doubleLength') return [String((length + width) * 2)]
      const perimeter = n('perimeter')
      if (perimeter !== (length + width) * 2) throw new Error('周长与长宽不符')
      if (mode === 'reverseLength') return [String(length)]
      return [String(perimeter / 2 - length)]
    }
    case 'squarePerimeter': {
      const side = n('side')
      const mode = text('mode')
      if (mode === 'perimeter') return [String(side * 4)]
      return [String(side)]
    }
    case 'priceQty': {
      const mode = text('mode')
      const price = n('price')
      const quantity = n('quantity')
      if (mode === 'total') return [String(price * quantity)]
      if (mode === 'totalThenChange') {
        const paid = n('paid')
        if (paid % 10 !== 0) throw new Error('付款金额不是整十')
        return [String(price * quantity), String(paid - price * quantity)]
      }
      if (mode === 'reverseQuantity') {
        const total = n('total')
        if (total % price !== 0) throw new Error('总价除不尽')
        return [String(total / price)]
      }
      if (mode === 'reverseUnitByChange') {
        const paid = n('paid')
        if (paid % 10 !== 0) throw new Error('付款金额不是整十')
        const priceByChange = (paid - n('change')) / n('quantity')
        if (!Number.isInteger(priceByChange)) throw new Error('单价除不尽')
        return [String(priceByChange)]
      }
      if (mode === 'reverseTotalByChange') {
        const paid = n('paid')
        if (paid % 10 !== 0) throw new Error('付款金额不是整十')
        return [String(paid - n('change'))]
      }
      const total = n('total')
      if (total % quantity !== 0) throw new Error('总价除不尽')
      return [String(total / quantity)]
    }
    case 'areaUnit': {
      const mode = text('mode')
      if (mode === 'basic') return [String(n('count') * 100)]
      if (mode === 'm2dm') return [String(n('count') * 100)]
      return [String(n('count'))]
    }
    case 'rectArea': {
      const mode = text('mode')
      const length = n('length')
      const width = n('width')
      if (mode === 'area') return [String(length * width)]
      if (mode === 'areaThenCost') {
        const area = length * width
        return [String(area), String(area * n('unitPrice'))]
      }
      const area = n('area')
      if (area % length !== 0) throw new Error('面积除不尽')
      return [String(area / length)]
    }
    case 'squareArea': {
      const side = n('side')
      const mode = text('mode')
      if (mode === 'area') return [String(side * side)]
      return [String(side)]
    }
    case 'fractionUnit': {
      const mode = text('mode')
      if (mode === 'reverseDenominator') return [String(n('denominator'))]
      if (mode === 'unitL2') return [`1/${n('denominator')}`, String(n('denominator'))]
      return [`1/${n('denominator')}`]
    }
    case 'fractionPart': {
      const mode = text('mode')
      if (mode === 'part') return [`${n('numerator')}/${n('denominator')}`]
      const first = n('first')
      const second = n('second')
      if (first === second) throw new Error('两个分数相等，无法比较')
      return [`${Math.max(first, second)}/${n('denominator')}`]
    }
    case 'fraction': {
      const mode = text('mode')
      if (mode === 'unit') return [`1/${n('denominator')}`]
      if (mode === 'part') return [`${n('numerator')}/${n('denominator')}`]
      const first = n('first')
      const second = n('second')
      if (first === second) throw new Error('两个分数相等，无法比较')
      return [`${Math.max(first, second)}/${n('denominator')}`]
    }
    case 'speed': {
      const speed = n('speed')
      const hours = n('hours')
      const mode = text('mode')
      if (mode === 'distance') return [String(speed * hours)]
      if (mode === 'reverseSpeed') {
        const distance = n('distance')
        if (distance % hours !== 0) throw new Error('路程除不尽')
        return [String(distance / hours)]
      }
      const distance = n('distance')
      if (distance % speed !== 0) throw new Error('行驶时间除不尽')
      return [String(n('departHour') + distance / speed)]
    }
    case 'mul2x2': {
      const mode = text('mode')
      if (mode === 'single2') return [String(n('price') * n('quantity'))]
      if (mode === 'twoStage2') {
        const total = n('perBox') * n('boxes')
        return [String(total), String(total * n('unitPrice'))]
      }
      const total = n('total')
      const boxes = n('boxes')
      if (total % boxes !== 0) throw new Error('总数除不尽')
      return [String(total / boxes)]
    }
    case 'mul2x3': {
      const mode = text('mode')
      if (mode === 'single3') return [String(n('price') * n('quantity'))]
      if (mode === 'freight3') {
        return [String(n('price') * n('quantity')), String(n('quantity') * n('freight'))]
      }
      const total = n('total')
      const quantity = n('quantity')
      if (total % quantity !== 0) throw new Error('总价除不尽')
      return [String(total / quantity)]
    }
    case 'div2x2': {
      const mode = text('mode')
      const perBox = n('perBox')
      if (mode === 'boxes2') {
        const total = n('total')
        if (total % perBox !== 0) throw new Error('总数不能正好装箱')
        return [String(total / perBox)]
      }
      if (mode === 'remainder2') {
        const total = n('total')
        return [String(Math.floor(total / perBox)), String(total % perBox)]
      }
      return [String(perBox * n('boxes') + n('rest'))]
    }
  }
}

/** 周长/面积类填空的单位自检（P0-N1）：空位所问单位必须与 params.unit 同族 */
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
const BLANK_UNIT_RE = new RegExp(`_+\\s*(${UNIT_ALT})`, 'g')
const SQUARE_OF: Record<string, string> = {
  毫米: '平方毫米',
  厘米: '平方厘米',
  分米: '平方分米',
  米: '平方米',
  千米: '平方千米',
}

function checkFillUnitConsistency(input: {
  stem: string
  params: ParamMap
  features: Record<string, number | string | boolean>
}): string | null {
  const form = String(input.features.form ?? '')
  if (!['rectPerimeter', 'squarePerimeter', 'wallFence', 'rectArea', 'squareArea', 'maxArea'].includes(form)) {
    return null
  }
  const unit = input.params.unit
  if (typeof unit !== 'string' || !(DIM_UNITS as readonly string[]).includes(unit)) {
    return '缺少或非法的单位参数'
  }
  for (const match of input.stem.matchAll(BLANK_UNIT_RE)) {
    const ask = match[1]
    if (ask === unit || SQUARE_OF[unit] === ask) {
      continue
    }
    return `空位问“${ask}”，但单位参数是“${unit}”`
  }
  return null
}

export function verifyFillQuestion(question: FillQuestion): string | null {
  const form = String(question.features.form ?? '') as FillFormName
  if (!(form in BUILDERS)) return `未知填空形态: ${form}`
  try {
    const expected = verifyFill(form, question.params)
    if (expected.length !== question.answers.length) return '答案个数与空位个数不一致'
    for (const [index, value] of expected.entries()) {
      if (reversed(value) !== reversed(question.answers[index])) {
        return `第 ${index + 1} 空独立求值不一致：期望 ${value}，实际 ${question.answers[index]}`
      }
    }
    if (countBlanks(question.stem) !== question.answers.length) return '题干空位与答案个数不一致'
    // 有余数的装箱题问“最多能装满”，是上界语义；不能写成“至少”或漏掉“最多”
    if (form === 'div2x2' && String(question.params.mode) === 'remainder2') {
      if (!question.stem.includes('最多')) return '有余数装箱题必须写“最多能装满”'
      if (question.stem.includes('至少') || question.stem.includes('最迟')) return '上界题不能写成“至少/最迟”'
    }
    return checkFillUnitConsistency(question)
  } catch (error) {
    return `独立求值失败: ${(error as Error).message}`
  }
}

// ---------- 目标解析 ----------

function resolveTargets(options: GenerateFillOptions): Target[] {
  const { grade, unitId, kpId, level } = options
  const targets: Target[] = []
  const pushUnit = (unit: Unit) => {
    for (const kp of unit.kps) {
      const specs = asSpecs(kp.rules.tiankong?.[level])
      if (specs.length > 0) targets.push({ unit, kp, specs })
    }
  }
  /** 角与图形计数已并入填空：只有 U3 且有角形态时追加一个角目标 */
  const pushAngle = (unit: Unit) => {
    if (!angleUnitSupported(unit.unitId)) return
    const forms = angleFillForms(level)
    if (forms.length === 0) return
    const kp = unit.kps.find((item) => item.kpName.includes('角')) ?? unit.kps[0]
    if (!kp) return
    targets.push({ unit, kp, specs: forms.map((form) => ({ form })), angle: true })
  }

  if (kpId) {
    const found = findKp(kpId)
    if (!found) throw new Error(`找不到知识点: ${kpId}`)
    if (found.unit.grade !== grade) throw new Error(`${kpId} 不属于 ${grade}`)
    if (unitId && found.unit.unitId !== unitId) throw new Error(`${kpId} 不属于 ${unitId}`)
    const specs = asSpecs(found.kp.rules.tiankong?.[level])
    if (specs.length === 0) throw new Error(`${kpId} 不支持填空/${level}`)
    targets.push({ unit: found.unit, kp: found.kp, specs })
  } else if (unitId) {
    const unit = findUnit(unitId)
    if (!unit) throw new Error(`找不到单元: ${unitId}`)
    if (unit.grade !== grade) throw new Error(`${unitId} 不属于 ${grade}`)
    pushUnit(unit)
    pushAngle(unit)
  } else {
    for (const unit of CURRICULUM.units) {
      if (unit.grade === grade) {
        pushUnit(unit)
        pushAngle(unit)
      }
    }
  }

  if (targets.length === 0) {
    throw new Error(`${unitId ?? grade} 没有填空/${level} 的生成规则`)
  }
  return targets
}

function fingerprint(form: string, params: ParamMap): string {
  const keys = Object.keys(params).sort()
  return `${form}|${keys.map((key) => `${key}=${params[key]}`).join('&')}`
}

// ---------- 主入口 ----------

export function generateFill(options: GenerateFillOptions): {
  questions: FillQuestion[]
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
  const questions: FillQuestion[] = []
  const failures: string[] = []
  let crossReused = 0
  // 角与图形计数并入填空后限占 1/3；本卷由组卷侧传入上限，缺省按 count/3
  const angleCap = options.maxAngle != null ? Math.max(0, Math.floor(options.maxAngle)) : Math.floor(count / 3)
  let angleUsed = 0
  let plainCursor = 0

  for (let index = 0; index < count; index++) {
    let target = targets[index % targets.length]!
    if (target.angle && angleUsed >= angleCap) {
      const plain = targets.filter((item) => !item.angle)
      if (plain.length === 0) break
      target = plain[plainCursor++ % plain.length]!
    }
    const candidates: { draft: FillDraft; spec: FillRuleSpec; fp: string }[] = []
    /** 记忆池轮转候选：最近窗口内的题，取 lastPaper 最小（最久未用）的那道 */
    let stale: { draft: FillDraft; spec: FillRuleSpec; fp: string } | null = null

    for (let attempt = 0; attempt < 500 && candidates.length < 8; attempt++) {
      const spec = pick(rng, target.specs)
      const draft = BUILDERS[spec.form](rng, level)
      if (!draft) continue
      const fp = fingerprint(spec.form, draft.params)
      if (usedFp.has(fp)) continue
      const stemKey = draft.stem.replace(/\s+/g, '')
      if (usedStem.has(stemKey)) continue
      let problem: string | null = null
      try {
        const expected = verifyFill(spec.form, draft.params)
        if (expected.length !== draft.answers.length) problem = '答案个数不符'
        else if (expected.some((value, i) => reversed(value) !== reversed(draft.answers[i])))
          problem = '独立求值不一致'
        else if (countBlanks(draft.stem) !== draft.answers.length) problem = '空位个数不符'
      } catch (error) {
        problem = `独立求值失败: ${(error as Error).message}`
      }
      if (!problem) {
        problem = unitGuardProblem(target.unit.unitId, [draft.stem, ...draft.answers])
      }
      if (!problem) {
        problem = checkFillUnitConsistency({
          stem: draft.stem,
          params: draft.params,
          features: draft.features,
        })
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
        `填空生成失败：${target.unit.unitId}/${target.kp.kpId} ${level} 连续 500 次没有合格题` +
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
    if (target.angle) angleUsed++
    questions.push({
      id: `${target.unit.unitId}-${target.kp.kpId}-tiankong-${level}-${String(index + 1).padStart(2, '0')}`,
      grade,
      unitId: target.unit.unitId,
      unitName: target.unit.unitName,
      kpId: target.kp.kpId,
      kpName: target.kp.kpName,
      type: 'tiankong',
      level,
      stem: chosen.draft.stem,
      answers: chosen.draft.answers,
      answer: chosen.draft.answers.join('；'),
      params: chosen.draft.params,
      fingerprint: chosen.fp,
      values: chosen.draft.values,
      features: chosen.draft.features,
      fig: chosen.draft.fig,
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

/** 某单元是否有任意难度的填空规则 */
export function hasFillRules(unitId: string): boolean {
  const unit = findUnit(unitId)
  if (!unit) return false
  if (angleUnitSupported(unitId)) return true
  return unit.kps.some((kp) => asSpecs(kp.rules.tiankong?.L1).length > 0 || asSpecs(kp.rules.tiankong?.L2).length > 0 || asSpecs(kp.rules.tiankong?.L3).length > 0)
}

/** 某单元在指定难度是否有填空规则（含已并入填空的角与图形计数） */
export function fillSupports(unitId: string, level: Level): boolean {
  const unit = findUnit(unitId)
  if (!unit) return false
  if (angleUnitSupported(unitId) && angleFillForms(level).length > 0) return true
  return unit.kps.some((kp) => asSpecs(kp.rules.tiankong?.[level]).length > 0)
}

export function fillLevelsFor(unitId: string): Level[] {
  const unit = findUnit(unitId)
  if (!unit) return []
  if (angleUnitSupported(unitId)) return ['L1', 'L2', 'L3']
  const levels = new Set<Level>()
  for (const kp of unit.kps) {
    for (const level of ['L1', 'L2', 'L3'] as Level[]) {
      if (asSpecs(kp.rules.tiankong?.[level]).length > 0) levels.add(level)
    }
  }
  return [...levels].sort()
}
