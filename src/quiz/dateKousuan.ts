import { pick, randInt, type Rng } from './rng.ts'
import type { DateKousuanKind, Level } from './types.ts'

/**
 * 三年级上册第五单元（年、月、日）的口算素材。
 *
 * 口算区没有算式可解析，因此这里单独提供“生成 + 独立复核”：
 * 生成器把月份、起止时刻、起始日期等原始参数写进 features，
 * 复核器只凭这些参数重新算一遍，不读取生成器算好的答案。
 */

export interface DateKousuanPiece {
  latex: string
  answer: string
  values: number[]
  features: Record<string, number | string | boolean>
}

const BLANK = '（　　）'

/** 各月天数（生成侧用查表；复核侧用另一套规则推算，避免共用同一实现）。 */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function monthDaysInTable(month: number, leap: boolean): number {
  if (month === 2) return leap ? 29 : 28
  return MONTH_DAYS[month - 1]!
}

function makeMonthDays(rng: Rng): DateKousuanPiece {
  const month = randInt(rng, 1, 12)
  if (month === 2) {
    // 2 月必须写明平年 / 闰年，避免同一题面出现 28 或 29 两个答案
    const leap = rng() < 0.5
    const days = monthDaysInTable(2, leap)
    return {
      latex: `"${leap ? '闰年' : '平年'}2月有${BLANK}天"`,
      answer: String(days),
      values: [2, days],
      features: { result: days, kind: 'monthDays', month: 2, leap: leap ? 1 : 0 },
    }
  }
  const days = monthDaysInTable(month, false)
  return {
    latex: `"${month}月有${BLANK}天"`,
    answer: String(days),
    values: [month, days],
    features: { result: days, kind: 'monthDays', month, leap: 0 },
  }
}

function makeBigMonths(): DateKousuanPiece {
  return {
    latex: `"一年有${BLANK}个大月"`,
    answer: '7',
    values: [12, 7],
    features: { result: 7, kind: 'bigMonths' },
  }
}

function makeElapsedHour(rng: Rng, level: Level): DateKousuanPiece {
  const maxSpan = level === 'L1' ? 2 : level === 'L2' ? 4 : 6
  const span = randInt(rng, 1, maxSpan)
  const start = randInt(rng, 6, 24 - span)
  const end = start + span
  return {
    latex: `"${start}时到${end}时经过${BLANK}小时"`,
    answer: String(span),
    values: [start, end, span],
    features: { result: span, kind: 'elapsedHour', start, end },
  }
}

function makeDateOffset(rng: Rng, level: Level): DateKousuanPiece {
  const maxOffset = level === 'L1' ? 3 : level === 'L2' ? 5 : 7
  // 只在不跨月的范围内取，答案才唯一是“几号”
  const month = pick(rng, [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const days = monthDaysInTable(month, false)
  const offset = randInt(rng, 1, maxOffset)
  const base = randInt(rng, 1, days - offset)
  const day = base + offset
  return {
    latex: `"${month}月${base}日往后${offset}天是${BLANK}号"`,
    answer: String(day),
    values: [month, base, offset, day],
    features: { result: day, kind: 'dateOffset', month, base, offset },
  }
}

export function buildDateKousuan(kind: DateKousuanKind, rng: Rng, level: Level): DateKousuanPiece {
  switch (kind) {
    case 'monthDays':
      return makeMonthDays(rng)
    case 'bigMonths':
      return makeBigMonths()
    case 'elapsedHour':
      return makeElapsedHour(rng, level)
    case 'dateOffset':
      return makeDateOffset(rng, level)
  }
}

/** 复核侧：用“大月 / 小月 / 二月”规则推断天数，与生成侧的查表实现相互独立。 */
function inferMonthDays(month: number): number | null {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31
  if ([4, 6, 9, 11].includes(month)) return 30
  if (month === 2) return null
  return null
}

/** 只凭 features 里的原始参数重新算答案；参数不合法时返回 null。 */
export function recomputeDateKousuan(features: Record<string, number | string | boolean>): number | null {
  const kind = String(features['kind'] ?? '')
  switch (kind) {
    case 'monthDays': {
      const month = Number(features['month'])
      if (!Number.isInteger(month) || month < 1 || month > 12) return null
      if (month === 2) {
        const leap = Number(features['leap']) === 1
        return leap ? 29 : 28
      }
      return inferMonthDays(month)
    }
    case 'bigMonths':
      // 1、3、5、7、8、10、12 共 7 个大月
      return 7
    case 'elapsedHour': {
      const start = Number(features['start'])
      const end = Number(features['end'])
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null
      if (start < 0 || end > 24 || end <= start) return null
      return end - start
    }
    case 'dateOffset': {
      const month = Number(features['month'])
      const base = Number(features['base'])
      const offset = Number(features['offset'])
      if (!Number.isInteger(month) || !Number.isInteger(base) || !Number.isInteger(offset)) return null
      if (month === 2) return null
      const days = inferMonthDays(month)
      if (!days) return null
      // 必须“往后 1 天及以上”，且不跨月，答案才是唯一的“几号”
      if (offset < 1 || base < 1 || base + offset > days) return null
      return base + offset
    }
    default:
      return null
  }
}

/** 独立复核：参数与题面自洽 + 答案可复算。返回问题描述，通过则返回 null。 */
export function verifyDateKousuan(
  features: Record<string, number | string | boolean>,
  latex: string,
): string | null {
  const expected = recomputeDateKousuan(features)
  if (expected === null) return '口算题参数不合法，无法独立重算'
  if (Number(features['result']) !== expected) {
    return `口算答案不符：独立重算得 ${expected}，标注为 ${String(features['result'])}`
  }
  const kind = String(features['kind'] ?? '')
  if (kind === 'monthDays') {
    const month = Number(features['month'])
    if (!latex.includes(`${month}月`)) return '口算题面缺少月份'
  } else if (kind === 'bigMonths') {
    if (!latex.includes('大月')) return '口算题面缺少“大月”'
  } else if (kind === 'elapsedHour') {
    const start = Number(features['start'])
    const end = Number(features['end'])
    if (!latex.includes(`${start}时到${end}时`)) return '口算题面起止时刻与参数不符'
  } else if (kind === 'dateOffset') {
    const month = Number(features['month'])
    const base = Number(features['base'])
    const offset = Number(features['offset'])
    if (!latex.includes(`${month}月${base}日往后${offset}天`)) return '口算题面日期与参数不符'
  } else {
    return '未知的口算类型'
  }
  return null
}
