/**
 * 拓展题／提高题（三上，AppType = advanced）。
 *
 * 设计约束（与列式计算一致，但拓展题是“多绕一步”的应用/推理题）：
 *   1. 先定结构：每类题由 draw 抽出参数，再由类别模板渲染题干；
 *   2. 复核走两条独立路径：
 *      ① 独立重算：recompute 用与生成侧不同的算法（模拟/枚举/比例）重算答案；
 *      ② 结构与解法一致性：题干必须等于类别模板渲染结果；每一步都带知识点键，
 *         且键必须落在 ADV_3A_KP（三上允许集合）与类别的 kpKeys 内；
 *         带 expr 的步骤由独立的四则解析器重算，必须等于该步 result。
 *   3. 唯一解：数组答案一律由参数唯一确定；策略类（租船）在 invariant 内穷举确认
 *      最优方案唯一，存在并列最优即拒绝出题。
 *   4. 歧义词：题干禁止“大约/可能/一些/差不多/左右/若干”等模糊表述。
 *
 * 超纲红线：本文件不出现方程/未知数、乘法分配律/结合律、负数、小数分数、面积、
 * 菱形/梯形面积公式；verify 会扫描题干与步骤文本，命中即拒。
 */

import { MemoryStore } from './memory.ts'
import { createRng, pick, randInt, type Rng } from './rng.ts'
import type { Grade, Level } from './types.ts'

export type AdvancedTier = 'T1' | 'T2' | 'T3'

/** 三上允许的知识点键；每一步只能挂在这里面的键 */
export const ADV_3A_KP = {
  '3A-ADD-SUB': '万以内加减法与差不变',
  '3A-MUL-1': '一位数乘两位数/三位数',
  '3A-DIV-1': '一位数除两位数/三位数',
  '3A-DIV-REMAINDER': '有余数除法（商与余数）',
  '3A-TWO-STEP': '两步四则运算（含小括号）',
  '3A-TIME-ELAPSED': '经过时间（时、分）',
  '3A-CALENDAR': '年、月、日与星期推算',
  '3A-PERIMETER': '长方形、正方形周长',
  '3A-STRATEGY': '枚举方案并比较（策略选择）',
  '3A-PATTERN': '周期排列（找规律）',
  '3A-AGE-DIFF': '年龄差不变（差不变性质）',
} as const

export type AdvancedKp = keyof typeof ADV_3A_KP

export type AdvParams = Record<string, number | string>

export interface AdvancedStep {
  text: string
  kp: AdvancedKp
  /** 该步可独立验算的算式（+ - * / 与括号，整数运算） */
  expr?: string
  result?: number
}

export interface AdvancedCategory {
  id: string
  label: string
  tier: AdvancedTier
  /** 方案 A 单元归属：只从所选单元出题 */
  units: string[]
  /** 跨卷/同卷去重用的主知识点键 */
  primaryKp: AdvancedKp
  /** 该类题允许出现的所有知识点键（verify 逐键断言） */
  kpKeys: AdvancedKp[]
  sample: string
  pool: string
  /** 卷面作答留白行数（8.5mm/行）；按类别定，不按档位一刀切 */
  workLines: number
  draw: (rng: Rng) => AdvParams | null
  stem: (p: AdvParams) => string
  build: (p: AdvParams) => {
    known: string[]
    unknown: string
    steps: AdvancedStep[]
    answer: string
  }
  /** 独立重算路径：与 build 的实现不同（模拟 / 枚举 / 比例 / 反算） */
  recompute: (p: AdvParams) => number | string
  /** 结构约束；返回 null 表示通过，返回文字表示拒绝原因（含唯一性检查） */
  invariant: (p: AdvParams) => string | null
}

// ---------- 小工具 ----------

const num = (p: AdvParams, key: string): number => {
  const value = p[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`参数 ${key} 不是数字`)
  return value
}

const str = (p: AdvParams, key: string): string => {
  const value = p[key]
  if (typeof value !== 'string' || !value) throw new Error(`参数 ${key} 不是字符串`)
  return value
}

const retry = <T,>(make: () => T | null): T | null => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const value = make()
    if (value != null) return value
  }
  return null
}

const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'] as const
const MONTH_DAYS: Record<number, number> = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
}

const durationText = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}分钟`
  if (rest === 0) return `${hours}小时`
  return `${hours}小时${rest}分钟`
}

/** 规范读法：分钟为 0 时只写“X时”，不写“X时0分” */
const timeText = (hour: number, minute: number): string =>
  minute === 0 ? `${hour}时` : `${hour}时${minute}分`

/** 答案统一为一种写法：不足 1 小时只写分钟，满 1 小时写“X小时Y分钟” */
const elapsedAnswer = (minutes: number): string => durationText(minutes)

const UNIT_NAME: Record<string, string> = {
  '3A-U1': '两步四则运算与应用题',
  '3A-U2': '用一位数乘',
  '3A-U3': '三角形与四边形',
  '3A-U4': '用一位数除',
  '3A-U5': '年、月、日的秘密',
  '3A-U6': '周长',
  '3A-U7': '马拉松的路线设计',
}

// ---------- 四则解析器（复核用，独立于生成侧） ----------

/** 只接受非负整数、+ - * / 与括号；除法必须整除 */
export function evalArithmetic(source: string): number {
  let i = 0
  const skip = (): void => {
    while (source[i] === ' ') i++
  }
  function primary(): number {
    skip()
    if (source[i] === '(') {
      i++
      const value = expression()
      skip()
      if (source[i] !== ')') throw new Error(`括号未闭合：${source}`)
      i++
      return value
    }
    const start = i
    while (i < source.length && /[0-9]/.test(source[i]!)) i++
    if (start === i) throw new Error(`非法字符：${source.slice(i, i + 1)}`)
    return Number(source.slice(start, i))
  }
  function term(): number {
    let value = primary()
    while (true) {
      skip()
      const ch = source[i]
      if (ch !== '*' && ch !== '/') break
      i++
      const right = primary()
      if (ch === '/') {
        if (right === 0 || value % right !== 0) throw new Error(`除法不是整数：${value}÷${right}`)
        value /= right
      } else {
        value *= right
      }
    }
    return value
  }
  function expression(): number {
    let value = term()
    while (true) {
      skip()
      const ch = source[i]
      if (ch !== '+' && ch !== '-') break
      i++
      const right = term()
      value = ch === '+' ? value + right : value - right
    }
    return value
  }
  const value = expression()
  skip()
  if (i !== source.length) throw new Error(`算式有多余字符：${source}`)
  if (!Number.isInteger(value) || value < 0) throw new Error(`结果不是非负整数：${value}`)
  return value
}

// ---------- 12 类拓展题 ----------

const dCycle = (rng: Rng): AdvParams | null =>
  retry(() => {
    const patterns = [
      { pattern: '△○□', kind: '图形' },
      { pattern: '○△○□', kind: '图形' },
      { pattern: '红黄蓝', kind: '颜色' },
      { pattern: '红黄蓝绿', kind: '颜色' },
      { pattern: 'ABCD', kind: '字母' },
    ]
    const item = pick(rng, patterns)
    return { pattern: item.pattern, kind: item.kind, n: randInt(rng, 10, 60) }
  })

const cycle: AdvancedCategory = {
  id: 'adv-cycle',
  label: '周期排列',
  tier: 'T1',
  units: ['3A-U4'],
  primaryKp: '3A-DIV-REMAINDER',
  kpKeys: ['3A-DIV-REMAINDER', '3A-PATTERN'],
  sample: '按“△○□……”重复排列，第17个图形是什么？',
  pool: '5 种周期串 × 第 10–60 个 ≈ 255',
  workLines: 3,
  draw: dCycle,
  stem: (p) => `按“${str(p, 'pattern')}……”这样的顺序重复排列，第${num(p, 'n')}个${str(p, 'kind')}是什么？`,
  build: (p) => {
    const pattern = str(p, 'pattern')
    const n = num(p, 'n')
    const period = pattern.length
    const quotient = Math.floor(n / period)
    const remainder = n % period
    const index = remainder === 0 ? period - 1 : remainder - 1
    const answer = pattern[index]!
    const remainderText =
      remainder === 0
        ? `第${n}个是第${quotient}组的最后一个`
        : `第${n}个是第${quotient + 1}组的第${remainder}个`
    return {
      known: [`每组${period}个，依次是：${pattern}`],
      unknown: `第${n}个${str(p, 'kind')}`,
      steps: [
        {
          text: `${n}÷${period}=${quotient}${remainder === 0 ? '（整除）' : `……${remainder}`}`,
          kp: '3A-DIV-REMAINDER',
        },
        { text: `${remainderText}，是“${answer}”`, kp: '3A-PATTERN' },
      ],
      answer,
    }
  },
  recompute: (p) => {
    const pattern = str(p, 'pattern')
    const n = num(p, 'n')
    if (pattern.length === 0) throw new Error('周期串为空')
    let sequence = ''
    while (sequence.length < n) sequence += pattern
    const answer = sequence[n - 1]
    if (answer == null) throw new Error('模拟取不到第 n 个')
    return answer
  },
  invariant: (p) => {
    const pattern = str(p, 'pattern')
    const n = num(p, 'n')
    if (pattern.length < 3) return '周期串少于 3 个'
    if (n < 1 || n > 60) return `第 n 个超出范围：${n}`
    return null
  },
}

const dNormalize = (rng: Rng): AdvParams | null =>
  retry(() => {
    const items = [
      { item: '笔', measure: '支', min: 2, max: 9 },
      { item: '本子', measure: '本', min: 2, max: 9 },
      { item: '橡皮', measure: '块', min: 1, max: 5 },
      { item: '尺子', measure: '把', min: 2, max: 9 },
    ]
    const choice = pick(rng, items)
    const count = randInt(rng, 2, 8)
    const unitPrice = randInt(rng, choice.min, choice.max)
    const total = count * unitPrice
    if (total > 99) return null
    const newCount = randInt(rng, 3, 9)
    if (newCount === count) return null
    if (unitPrice * newCount > 99) return null
    return {
      count,
      total,
      newCount,
      item: choice.item,
      measure: choice.measure,
      unit: '元',
    }
  })

const normalize: AdvancedCategory = {
  id: 'adv-normalize',
  label: '归一问题',
  tier: 'T1',
  units: ['3A-U4', '3A-U1'],
  primaryKp: '3A-DIV-1',
  kpKeys: ['3A-DIV-1', '3A-MUL-1'],
  sample: '3支同样的笔共12元，买7支要多少元？',
  pool: '4 种物品 × 数量 2–8 × 单价 1–9 × 新数量 3–9 ≈ 600',
  workLines: 3,
  draw: dNormalize,
  stem: (p) =>
    `${num(p, 'count')}${str(p, 'measure')}${str(p, 'item')}一共${num(p, 'total')}${str(p, 'unit')}，照这样计算，买${num(p, 'newCount')}${str(p, 'measure')}${str(p, 'item')}要多少${str(p, 'unit')}？`,
  build: (p) => {
    const count = num(p, 'count')
    const total = num(p, 'total')
    const newCount = num(p, 'newCount')
    const item = str(p, 'item')
    const measure = str(p, 'measure')
    const unit = str(p, 'unit')
    const unitPrice = total / count
    const answer = unitPrice * newCount
    return {
      known: [`${count}${measure}${item}共${total}${unit}`],
      unknown: `${newCount}${measure}${item}的价钱`,
      steps: [
        {
          text: `${total}÷${count}=${unitPrice}（${unit}），每${measure}${item}${unitPrice}${unit}`,
          kp: '3A-DIV-1',
          expr: `${total}/${count}`,
          result: unitPrice,
        },
        {
          text: `${unitPrice}×${newCount}=${answer}（${unit}）`,
          kp: '3A-MUL-1',
          expr: `${unitPrice}*${newCount}`,
          result: answer,
        },
      ],
      answer: String(answer),
    }
  },
  recompute: (p) => {
    const count = num(p, 'count')
    const total = num(p, 'total')
    const newCount = num(p, 'newCount')
    // 比例路径：先扩大再缩小，与生成侧的“先求单价再乘”不同
    const value = (total * newCount) / count
    if (!Number.isInteger(value)) throw new Error(`比例重算不是整数：${value}`)
    return value
  },
  invariant: (p) => {
    const count = num(p, 'count')
    const total = num(p, 'total')
    const newCount = num(p, 'newCount')
    if (count <= 0 || newCount <= 0) return '数量必须为正'
    if (total % count !== 0) return `总价 ${total} 不能被数量 ${count} 整除`
    if (total / count * newCount > 999) return '答案超过 999'
    if (newCount === count) return '新旧数量相同，题目没有拓展价值'
    return null
  },
}

const dSubstitute = (rng: Rng): AdvParams | null =>
  retry(() => {
    const combos = [
      { big: '西瓜', mid: '菠萝', small: '苹果', verb: '换', smallUnit: '个' },
      { big: '书包', mid: '文具盒', small: '铅笔', verb: '装', smallUnit: '支' },
    ]
    const combo = pick(rng, combos)
    const a = randInt(rng, 2, 5)
    const b = randInt(rng, 2, 5)
    // 答案 4 太容易（2×2），T1 里没有拓展价值
    if (a * b === 4) return null
    if (a * b > 99) return null
    return { ...combo, a, b }
  })

const substitute: AdvancedCategory = {
  id: 'adv-substitute',
  label: '等量代换',
  tier: 'T1',
  units: ['3A-U2', '3A-U4'],
  primaryKp: '3A-MUL-1',
  kpKeys: ['3A-MUL-1'],
  sample: '1个书包能装3个文具盒，1个文具盒能装4支铅笔，1个书包能装多少支铅笔？',
  pool: '2 组等量关系 × 2–5 × 2–5 ≈ 40（排除答案 4；低频）',
  workLines: 3,
  draw: dSubstitute,
  stem: (p) =>
    `1个${str(p, 'big')}能${str(p, 'verb')}${num(p, 'a')}个${str(p, 'mid')}，1个${str(p, 'mid')}能${str(p, 'verb')}${num(p, 'b')}${str(p, 'smallUnit')}${str(p, 'small')}。1个${str(p, 'big')}能${str(p, 'verb')}多少${str(p, 'smallUnit')}${str(p, 'small')}？`,
  build: (p) => {
    const a = num(p, 'a')
    const b = num(p, 'b')
    const answer = a * b
    const big = str(p, 'big')
    const mid = str(p, 'mid')
    const small = str(p, 'small')
    const verb = str(p, 'verb')
    return {
      known: [
        `1个${big}能${verb}${a}个${mid}`,
        `1个${mid}能${verb}${b}${str(p, 'smallUnit')}${small}`,
      ],
      unknown: `1个${big}能${verb}?${str(p, 'smallUnit')}${small}`,
      steps: [
        {
          text:
            verb === '换'
              ? `1个${big}换成${a}个${mid}`
              : `1个${big}里能装${a}个${mid}`,
          kp: '3A-MUL-1',
        },
        {
          text: `${a}×${b}=${answer}，1个${big}能${verb}${answer}${str(p, 'smallUnit')}${small}`,
          kp: '3A-MUL-1',
          expr: `${a}*${b}`,
          result: answer,
        },
      ],
      answer: String(answer),
    }
  },
  recompute: (p) => {
    const a = num(p, 'a')
    const b = num(p, 'b')
    // 模拟路径：逐个数小盒，而不是直接相乘
    let count = 0
    for (let mid = 0; mid < a; mid++) {
      for (let small = 0; small < b; small++) count++
    }
    return count
  },
  invariant: (p) => {
    const a = num(p, 'a')
    const b = num(p, 'b')
    if (a < 2 || b < 2) return '每一级至少要换 2 个'
    if (a * b === 4) return '答案为 4 太容易，没有拓展价值'
    if (a * b > 99) return '答案超过 99'
    return null
  },
}

const dElapsed = (rng: Rng): AdvParams | null =>
  retry(() => {
    // 5 分钟步进，与 U5 既有口径一致
    const startMin = randInt(rng, 84, 138) * 5
    const duration = randInt(rng, 6, 30) * 5
    const endMin = startMin + duration
    if (endMin > 17 * 60) return null
    return {
      sh: Math.floor(startMin / 60),
      sm: startMin % 60,
      eh: Math.floor(endMin / 60),
      em: endMin % 60,
    }
  })

const elapsed: AdvancedCategory = {
  id: 'adv-elapsed',
  label: '经过时间',
  tier: 'T1',
  units: ['3A-U5'],
  primaryKp: '3A-TIME-ELAPSED',
  kpKeys: ['3A-TIME-ELAPSED'],
  sample: '8时40分开始读书，9时25分读完，一共用了多长时间？（用几小时几分钟表示）',
  pool: '起点 7:00–11:30（5 分钟步进）× 时长 30–150 分 ≈ 400',
  workLines: 4,
  draw: dElapsed,
  stem: (p) =>
    `丽丽${timeText(num(p, 'sh'), num(p, 'sm'))}开始读书，${timeText(num(p, 'eh'), num(p, 'em'))}读完。` +
    `她读书用了多长时间？（用几小时几分钟表示，不满1小时的只写分钟）`,
  build: (p) => {
    const sh = num(p, 'sh')
    const sm = num(p, 'sm')
    const eh = num(p, 'eh')
    const em = num(p, 'em')
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    const duration = endMin - startMin
    const hours = Math.floor(duration / 60)
    const rest = duration % 60
    const startText = timeText(sh, sm)
    const endText = timeText(eh, em)
    const steps: AdvancedStep[] = []
    if (sh === eh) {
      // 同一小时内只处理分钟部分，两个操作数都小于 60，不出现绝对分钟相减
      steps.push({
        text: `开始和结束都在${sh}时内，只看分钟：${em}-${sm}=${duration}（分）`,
        kp: '3A-TIME-ELAPSED',
        expr: `${em}-${sm}`,
        result: duration,
      })
      steps.push({
        text: `所以用了${durationText(duration)}`,
        kp: '3A-TIME-ELAPSED',
      })
    } else if (hours === 0) {
      // 跨过整点但不足 1 小时：以整点为界分成两段，每段都不超过 60 分钟
      const anchor = eh * 60
      const first = anchor - startMin
      const second = endMin - anchor
      steps.push({
        text:
          second === 0
            ? `跨过整点，分段算：${startText}到${endText}正好是${first}分钟`
            : `跨过整点，分段算：${startText}到${eh}时是${first}分钟，${eh}时到${endText}是${second}分钟`,
        kp: '3A-TIME-ELAPSED',
      })
      if (second === 0) {
        steps.push({
          text: `所以用了${durationText(duration)}`,
          kp: '3A-TIME-ELAPSED',
        })
      } else {
        steps.push({
          text: `${first}+${second}=${duration}（分），就是${durationText(duration)}`,
          kp: '3A-TIME-ELAPSED',
          expr: `${first}+${second}`,
          result: duration,
        })
      }
    } else {
      // 满 1 小时：先数整小时，再数剩下的分钟，分别处理
      const midHour = sh + hours
      const midText = timeText(midHour, sm)
      steps.push({
        text: `先算整小时：${startText}到${midText}是${hours}小时`,
        kp: '3A-TIME-ELAPSED',
      })
      if (rest > 0) {
        steps.push({
          text: `再算分钟：${midText}到${endText}是${rest}分钟`,
          kp: '3A-TIME-ELAPSED',
        })
      }
      steps.push({
        text: `合起来：${durationText(duration)}`,
        kp: '3A-TIME-ELAPSED',
      })
    }
    return {
      known: [`开始：${startText}`, `结束：${endText}`],
      unknown: '一共用了多长时间（用几小时几分钟表示）',
      steps,
      answer: elapsedAnswer(duration),
    }
  },
  recompute: (p) => {
    const sh = num(p, 'sh')
    const sm = num(p, 'sm')
    const eh = num(p, 'eh')
    const em = num(p, 'em')
    // 模拟路径：从开始时刻逐分钟走到结束时刻
    let minutes = sh * 60 + sm
    const target = eh * 60 + em
    let count = 0
    while (minutes < target) {
      minutes++
      count++
    }
    if (minutes !== target) throw new Error('结束时刻不在同一天')
    return elapsedAnswer(count)
  },
  invariant: (p) => {
    const sh = num(p, 'sh')
    const sm = num(p, 'sm')
    const eh = num(p, 'eh')
    const em = num(p, 'em')
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    if (endMin <= startMin) return '结束时刻必须晚于开始时刻'
    if (endMin - startMin > 300) return '经过时间超过 5 小时'
    if (startMin % 5 !== 0 || endMin % 5 !== 0) return '起止时刻必须是 5 分钟步进'
    return null
  },
}

const dAgeDiff = (rng: Rng): AdvParams | null =>
  retry(() => {
    const kid = randInt(rng, 6, 11)
    const dad = kid + randInt(rng, 20, 34)
    if (dad > 60) return null
    return { dad, kid, years: randInt(rng, 3, 10) }
  })

const ageDiff: AdvancedCategory = {
  id: 'adv-age-diff',
  label: '年龄差不变',
  tier: 'T1',
  units: ['3A-U1'],
  primaryKp: '3A-AGE-DIFF',
  kpKeys: ['3A-ADD-SUB', '3A-AGE-DIFF'],
  sample: '爸爸今年36岁，小明9岁，5年后爸爸比小明大多少岁？',
  pool: '孩子 6–11 岁 × 年龄差 20–34 × 年数 3–10 ≈ 600',
  workLines: 3,
  draw: dAgeDiff,
  stem: (p) =>
    `爸爸今年${num(p, 'dad')}岁，小明今年${num(p, 'kid')}岁。${num(p, 'years')}年后，爸爸比小明大多少岁？`,
  build: (p) => {
    const dad = num(p, 'dad')
    const kid = num(p, 'kid')
    const years = num(p, 'years')
    const diff = dad - kid
    return {
      known: [`爸爸${dad}岁`, `小明${kid}岁`, `再过${years}年`],
      unknown: '几年后两人的年龄差',
      steps: [
        {
          text: `今年相差：${dad}-${kid}=${diff}（岁）`,
          kp: '3A-ADD-SUB',
          expr: `${dad}-${kid}`,
          result: diff,
        },
        { text: `两人都长${years}岁，年龄差不变，${years}年后仍相差${diff}岁`, kp: '3A-AGE-DIFF' },
      ],
      answer: String(diff),
    }
  },
  recompute: (p) => {
    const dad = num(p, 'dad')
    const kid = num(p, 'kid')
    const years = num(p, 'years')
    // 独立路径：直接算两人若干年后的年龄，再相减
    return dad + years - (kid + years)
  },
  invariant: (p) => {
    const dad = num(p, 'dad')
    const kid = num(p, 'kid')
    const years = num(p, 'years')
    if (dad <= kid) return '爸爸年龄必须大于小明'
    if (years <= 0) return '年数必须为正'
    if (dad > 70 || kid > 12) return '年龄不符合三年级常识'
    return null
  },
}

const dJoinPerimeter = (rng: Rng): AdvParams | null =>
  retry(() => {
    const count = randInt(rng, 2, 4)
    const side = randInt(rng, 3, 9)
    const answer = 2 * (count + 1) * side
    if (answer > 120) return null
    return { count, side }
  })

const joinPerimeter: AdvancedCategory = {
  id: 'adv-join-perimeter',
  label: '拼图形后的周长',
  tier: 'T1',
  units: ['3A-U6'],
  primaryKp: '3A-PERIMETER',
  kpKeys: ['3A-PERIMETER'],
  sample: '把2个边长5厘米的正方形拼成一排，拼成的长方形的周长是多少？',
  pool: '个数 2–4 × 边长 3–9 ≈ 21（低频）',
  workLines: 3,
  draw: dJoinPerimeter,
  stem: (p) =>
    `把${num(p, 'count')}个边长${num(p, 'side')}厘米的正方形拼成一排，拼成的长方形的周长是多少厘米？`,
  build: (p) => {
    const count = num(p, 'count')
    const side = num(p, 'side')
    const answer = 2 * (count * side + side)
    return {
      known: [`${count}个正方形`, `边长${side}厘米`],
      unknown: '拼成的长方形的周长',
      steps: [
        {
          text: `拼成一排后，长：${count}×${side}=${count * side}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `${count}*${side}`,
          result: count * side,
        },
        {
          text: `宽${side}厘米，周长：(${count * side}+${side})×2=${answer}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `(${count * side}+${side})*2`,
          result: answer,
        },
      ],
      answer: String(answer),
    }
  },
  recompute: (p) => {
    const count = num(p, 'count')
    const side = num(p, 'side')
    // 独立路径：按“总边数减去被拼住的边”逐边算
    const totalEdges = 4 * side * count
    const hiddenEdges = 2 * side * (count - 1)
    return totalEdges - hiddenEdges
  },
  invariant: (p) => {
    const count = num(p, 'count')
    const side = num(p, 'side')
    if (count < 2) return '至少要拼 2 个'
    if (side <= 0) return '边长必须为正'
    if (2 * (count + 1) * side > 120) return '周长超过 120 厘米'
    return null
  },
}

const dTotalize = (rng: Rng): AdvParams | null =>
  retry(() => {
    const perDay = randInt(rng, 4, 12)
    const days = randInt(rng, 3, 9)
    const total = perDay * days
    if (total > 99) return null
    const newPerDay = randInt(rng, 3, 9)
    if (newPerDay === perDay || total % newPerDay !== 0) return null
    const newDays = total / newPerDay
    if (newDays < 2) return null
    return { perDay, days, newPerDay }
  })

const totalize: AdvancedCategory = {
  id: 'adv-totalize',
  label: '归总问题',
  tier: 'T1',
  units: ['3A-U1', '3A-U2', '3A-U4'],
  primaryKp: '3A-MUL-1',
  kpKeys: ['3A-MUL-1', '3A-DIV-1'],
  sample: '每天读6页，8天读完；每天读8页，几天读完？',
  pool: '每天 4–12 页 × 3–9 天 × 新每天 3–9 页 ≈ 180',
  workLines: 3,
  draw: dTotalize,
  stem: (p) =>
    `小华每天读${num(p, 'perDay')}页，${num(p, 'days')}天读完一本书。如果他每天读${num(p, 'newPerDay')}页，几天能读完？`,
  build: (p) => {
    const perDay = num(p, 'perDay')
    const days = num(p, 'days')
    const newPerDay = num(p, 'newPerDay')
    const total = perDay * days
    const answer = total / newPerDay
    return {
      known: [`每天${perDay}页，读了${days}天`],
      unknown: `每天${newPerDay}页要读几天`,
      steps: [
        {
          text: `${perDay}×${days}=${total}（页）`,
          kp: '3A-MUL-1',
          expr: `${perDay}*${days}`,
          result: total,
        },
        {
          text: `${total}÷${newPerDay}=${answer}（天）`,
          kp: '3A-DIV-1',
          expr: `${total}/${newPerDay}`,
          result: answer,
        },
      ],
      answer: String(answer),
    }
  },
  recompute: (p) => {
    const perDay = num(p, 'perDay')
    const days = num(p, 'days')
    const newPerDay = num(p, 'newPerDay')
    // 比例路径：先算天数比，再乘原天数
    const value = days * perDay / newPerDay
    if (!Number.isInteger(value)) throw new Error(`比例重算不是整数：${value}`)
    return value
  },
  invariant: (p) => {
    const perDay = num(p, 'perDay')
    const days = num(p, 'days')
    const newPerDay = num(p, 'newPerDay')
    const total = perDay * days
    if (newPerDay <= 0) return '新每天页数必须为正'
    if (total % newPerDay !== 0) return `总页数 ${total} 不能被 ${newPerDay} 整除`
    if (newPerDay === perDay) return '新旧每天页数相同'
    if (total / newPerDay < 2) return '新天数小于 2，题目不成立'
    return null
  },
}

const dReverse = (rng: Rng): AdvParams | null =>
  retry(() => {
    const start = randInt(rng, 2, 20)
    const add = randInt(rng, 2, 30)
    const mult = randInt(rng, 2, 9)
    const result = (start + add) * mult
    if (result > 999) return null
    return { start, add, mult, result }
  })

const reverse: AdvancedCategory = {
  id: 'adv-reverse',
  label: '逆向推理',
  tier: 'T2',
  units: ['3A-U1', '3A-U4'],
  primaryKp: '3A-TWO-STEP',
  kpKeys: ['3A-DIV-1', '3A-ADD-SUB', '3A-TWO-STEP'],
  sample: '一个数先加15，再乘3，得72，这个数是多少？',
  pool: '起点 2–20 × 加数 2–30 × 倍数 2–9 ≈ 4000',
  workLines: 4,
  draw: dReverse,
  stem: (p) =>
    `一个数先加上${num(p, 'add')}，再乘${num(p, 'mult')}，结果是${num(p, 'result')}。这个数是多少？`,
  build: (p) => {
    const start = num(p, 'start')
    const add = num(p, 'add')
    const mult = num(p, 'mult')
    const result = num(p, 'result')
    const middle = result / mult
    return {
      known: [`先加${add}，再乘${mult}`, `结果${result}`],
      unknown: '原来的数',
      steps: [
        {
          text: `从结果倒着想：${result}÷${mult}=${middle}`,
          kp: '3A-DIV-1',
          expr: `${result}/${mult}`,
          result: middle,
        },
        {
          text: `${middle}-${add}=${start}`,
          kp: '3A-ADD-SUB',
          expr: `${middle}-${add}`,
          result: start,
        },
        {
          text: `验算：(${start}+${add})×${mult}=${result}`,
          kp: '3A-TWO-STEP',
          expr: `(${start}+${add})*${mult}`,
          result,
        },
      ],
      answer: String(start),
    }
  },
  recompute: (p) => {
    const start = num(p, 'start')
    const add = num(p, 'add')
    const mult = num(p, 'mult')
    const result = num(p, 'result')
    // 独立路径：从原数正向模拟，必须回到题面结果
    const forward = (start + add) * mult
    if (forward !== result) throw new Error(`正向模拟得 ${forward}，与题面 ${result} 不符`)
    return start
  },
  invariant: (p) => {
    const start = num(p, 'start')
    const add = num(p, 'add')
    const mult = num(p, 'mult')
    const result = num(p, 'result')
    if (result % mult !== 0) return `结果 ${result} 不能被 ${mult} 整除`
    if (result / mult <= add) return '倒推第一步就减成非正数'
    if ((start + add) * mult !== result) return '正向结果与题面不符'
    return null
  },
}

const dCutPerimeter = (rng: Rng): AdvParams | null =>
  retry(() => {
    const w = randInt(rng, 3, 9)
    const l = w + randInt(rng, 2, 8)
    // 长=2 宽时剩下的正好是正方形，教学点“剩下一个长方形”失效，直接排除
    if (l === 2 * w) return null
    if (2 * l > 60) return null
    return { l, w }
  })

const cutPerimeter: AdvancedCategory = {
  id: 'adv-cut-perimeter',
  label: '剪拼后的周长',
  tier: 'T2',
  units: ['3A-U6'],
  primaryKp: '3A-PERIMETER',
  kpKeys: ['3A-PERIMETER'],
  sample: '长8厘米、宽5厘米的长方形纸，从一端剪下一个最大的正方形，剩下图形的周长是多少？',
  pool: '宽 3–9 × 长比宽多 2–8（排除长=2宽）≈ 40',
  workLines: 4,
  draw: dCutPerimeter,
  stem: (p) =>
    `一张长${num(p, 'l')}厘米、宽${num(p, 'w')}厘米的长方形纸，从一端剪下一个最大的正方形。剩下图形的周长是多少厘米？`,
  build: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    const rest = l - w
    const longSide = Math.max(rest, w)
    const shortSide = Math.min(rest, w)
    const answer = 2 * (rest + w)
    const original = 2 * (l + w)
    return {
      known: [`长${l}厘米`, `宽${w}厘米`, `从一端剪下最大的正方形`],
      unknown: '剩下图形的周长',
      steps: [
        {
          text: `最大的正方形边长最多是${w}厘米（不能超过宽）；从一端剪下后，剩下部分长${longSide}厘米、宽${shortSide}厘米`,
          kp: '3A-PERIMETER',
        },
        {
          text: `(${longSide}+${shortSide})×2=${answer}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `(${longSide}+${shortSide})*2`,
          result: answer,
        },
        {
          text: `验算：原周长(${l}+${w})×2=${original}（厘米），减去剪口处的2个宽：${original}-${w}×2=${answer}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `(${l}+${w})*2-${w}*2`,
          result: answer,
        },
      ],
      answer: String(answer),
    }
  },
  recompute: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    // 独立路径：剩下长方形的周长等于原长的 2 倍（短边正好抵消）
    const value = 2 * l
    const direct = 2 * (l - w) + 2 * w
    if (value !== direct) throw new Error('两种周长算法不一致')
    return value
  },
  invariant: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    if (l <= w) return '长必须大于宽'
    if (l === 2 * w) return '长正好是宽的 2 倍，剩下的是正方形而非长方形'
    if (2 * l > 60) return '周长超过 60 厘米'
    return null
  },
}

const dWeekday = (rng: Rng): AdvParams | null =>
  retry(() => {
    const months = Object.keys(MONTH_DAYS).map(Number)
    const month = pick(rng, months)
    // 日期下限 8：保证“经过了 ≥7 天”，不出现商 0 的除法，也不退化成“第二天”
    const day = randInt(rng, 8, MONTH_DAYS[month]!)
    const start = randInt(rng, 0, 6)
    return { month, day, start }
  })

const weekday: AdvancedCategory = {
  id: 'adv-weekday',
  label: '星期几推算',
  tier: 'T2',
  units: ['3A-U5'],
  primaryKp: '3A-CALENDAR',
  kpKeys: ['3A-CALENDAR', '3A-DIV-REMAINDER'],
  sample: '5月1日是星期二，5月20日是星期几？',
  pool: '12 个月 × 日期 8–月末 × 起始星期 7 ≈ 1600',
  workLines: 4,
  draw: dWeekday,
  stem: (p) =>
    `${num(p, 'month')}月1日是${WEEKDAYS[num(p, 'start')]!}，从1日算起，${num(p, 'month')}月${num(p, 'day')}日是星期几？（写出算式和答句）`,
  build: (p) => {
    const month = num(p, 'month')
    const day = num(p, 'day')
    const start = num(p, 'start')
    const passed = day - 1
    const quotient = Math.floor(passed / 7)
    const remainder = passed % 7
    const answer = WEEKDAYS[(start + passed) % 7]!
    const steps: AdvancedStep[] = [
      { text: `从1日到${day}日，经过了${passed}天（1日算第1天）`, kp: '3A-CALENDAR' },
      {
        text:
          remainder === 0
            ? `${passed}÷7=${quotient}（正好${quotient}周，没有余数）`
            : `${passed}÷7=${quotient}……${remainder}`,
        kp: '3A-DIV-REMAINDER',
      },
    ]
    if (remainder === 0) {
      steps.push({
        text: `过了${quotient}周，星期不变，所以${month}月${day}日还是${answer}`,
        kp: '3A-CALENDAR',
      })
    } else {
      const days = Array.from(
        { length: remainder },
        (_, index) => `第${index + 1}天是${WEEKDAYS[(start + index + 1) % 7]}`,
      )
      steps.push({
        text: `${WEEKDAYS[start]!}之后：${days.join('，')}，所以${month}月${day}日是${answer}`,
        kp: '3A-CALENDAR',
      })
    }
    return {
      known: [`${month}月1日是${WEEKDAYS[start]!}`, `问${month}月${day}日`],
      unknown: `${month}月${day}日是星期几`,
      steps,
      answer,
    }
  },
  recompute: (p) => {
    const day = num(p, 'day')
    const start = num(p, 'start')
    // 独立路径：从1日逐天往后数
    let index = start
    for (let current = 2; current <= day; current++) index = (index + 1) % 7
    return WEEKDAYS[index]!
  },
  invariant: (p) => {
    const month = num(p, 'month')
    const day = num(p, 'day')
    const start = num(p, 'start')
    if (MONTH_DAYS[month] == null) return `不支持 ${month} 月`
    if (day < 8 || day > MONTH_DAYS[month]!) return `日期 ${day} 超出 ${month} 月可用范围（8–${MONTH_DAYS[month]}）`
    if (start < 0 || start > 6) return '起始星期越界'
    return null
  },
}

interface RentPlan {
  big: number
  small: number
  cost: number
  seats: number
}

const rentPlanBest = (p: AdvParams): { plan: RentPlan; ties: number } => {
  const people = num(p, 'people')
  const bigCap = num(p, 'bigCap')
  const bigCost = num(p, 'bigCost')
  const smallCap = num(p, 'smallCap')
  const smallCost = num(p, 'smallCost')
  const maxBig = Math.ceil(people / bigCap)
  const plans: RentPlan[] = []
  for (let big = 0; big <= maxBig; big++) {
    const rest = Math.max(0, people - big * bigCap)
    const small = Math.ceil(rest / smallCap)
    plans.push({
      big,
      small,
      cost: big * bigCost + small * smallCost,
      seats: big * bigCap + small * smallCap,
    })
  }
  let best = plans[0]!
  for (const plan of plans) if (plan.cost < best.cost) best = plan
  return { plan: best, ties: plans.filter((plan) => plan.cost === best.cost).length }
}

const dRentPlan = (rng: Rng): AdvParams | null =>
  retry(() => {
    const people = randInt(rng, 12, 30)
    const bigCap = randInt(rng, 5, 8)
    const smallCap = randInt(rng, 3, 4)
    const bigCost = randInt(rng, 30, 50)
    const smallCost = randInt(rng, 18, 30)
    const params = { people, bigCap, bigCost, smallCap, smallCost }
    // 方案数 = 大船 0..maxBig，控制在 ≤5 行，孩子才写得下
    if (Math.ceil(people / bigCap) > 4) return null
    const result = rentPlanBest(params)
    if (result.ties !== 1) return null
    if (result.plan.seats < people) return null
    return params
  })

const rentPlan: AdvancedCategory = {
  id: 'adv-rent-plan',
  label: '策略选择（怎样租最省）',
  tier: 'T3',
  units: ['3A-U1', '3A-U2', '3A-U4'],
  primaryKp: '3A-STRATEGY',
  kpKeys: ['3A-STRATEGY', '3A-MUL-1'],
  sample: '大船限乘6人、30元，小船限乘4人、24元，18人怎样租最省？',
  pool: '人数 12–30 × 大船 5–8 人 × 小船 3–4 人 × 两种租金 ≈ 4 万（唯一最优且方案 ≤5 后仍充足）',
  workLines: 8,
  draw: dRentPlan,
  stem: (p) =>
    `有${num(p, 'people')}人去划船。大船限乘${num(p, 'bigCap')}人，每条租金${num(p, 'bigCost')}元；小船限乘${num(p, 'smallCap')}人，每条租金${num(p, 'smallCost')}元。不能超载，怎样租最省？最少要多少元？`,
  build: (p) => {
    const result = rentPlanBest(p)
    const { big, small, cost, seats } = result.plan
    const people = num(p, 'people')
    const maxBig = Math.ceil(people / num(p, 'bigCap'))
    const answer =
      big === 0
        ? `只租小船${small}条，最少${cost}元`
        : small === 0
          ? `只租大船${big}条，最少${cost}元`
          : `${big}条大船、${small}条小船，最少${cost}元`
    return {
      known: [
        `共${people}人`,
        `大船限乘${num(p, 'bigCap')}人、每条${num(p, 'bigCost')}元`,
        `小船限乘${num(p, 'smallCap')}人、每条${num(p, 'smallCost')}元`,
      ],
      unknown: '最省钱的租船方案和最少租金',
      steps: [
        {
          text: `大船可以租0条到${maxBig}条，把每种方案的小船条数和租金列成表`,
          kp: '3A-STRATEGY',
        },
        {
          text: '逐行比较租金，找出最少的一种',
          kp: '3A-STRATEGY',
        },
        {
          text:
            big === 0
              ? `只租小船${small}条最省，共${cost}元`
              : small === 0
                ? `只租大船${big}条最省，共${cost}元`
                : `${big}条大船、${small}条小船最省，共${cost}元`,
          kp: '3A-STRATEGY',
        },
        {
          text: `检验：${big}×${num(p, 'bigCap')}+${small}×${num(p, 'smallCap')}=${seats}（人），${seats}≥${people}`,
          kp: '3A-MUL-1',
          expr: `${big}*${num(p, 'bigCap')}+${small}*${num(p, 'smallCap')}`,
          result: seats,
        },
        { text: `答：最少要${cost}元`, kp: '3A-STRATEGY' },
      ],
      answer,
    }
  },
  recompute: (p) => {
    const people = num(p, 'people')
    const bigCap = num(p, 'bigCap')
    const bigCost = num(p, 'bigCost')
    const smallCap = num(p, 'smallCap')
    const smallCost = num(p, 'smallCost')
    const maxBig = Math.ceil(people / bigCap)
    const maxSmall = Math.ceil(people / smallCap)
    // 独立路径：二维穷举（大船、小船都从 0 开始），只保留能坐下所有人的方案
    let bestCost = Number.POSITIVE_INFINITY
    let bestBig = 0
    let bestSmall = 0
    let ties = 0
    for (let big = 0; big <= maxBig; big++) {
      for (let small = 0; small <= maxSmall; small++) {
        if (big * bigCap + small * smallCap < people) continue
        const cost = big * bigCost + small * smallCost
        if (cost < bestCost) {
          bestCost = cost
          bestBig = big
          bestSmall = small
          ties = 1
        } else if (cost === bestCost) {
          ties++
        }
      }
    }
    if (!Number.isFinite(bestCost)) throw new Error('没有能坐下所有人的方案')
    if (ties !== 1) throw new Error(`最优方案有 ${ties} 个并列，违反唯一解约束`)
    return bestBig === 0
      ? `只租小船${bestSmall}条，最少${bestCost}元`
      : bestSmall === 0
        ? `只租大船${bestBig}条，最少${bestCost}元`
        : `${bestBig}条大船、${bestSmall}条小船，最少${bestCost}元`
  },
  invariant: (p) => {
    const people = num(p, 'people')
    const bigCap = num(p, 'bigCap')
    const smallCap = num(p, 'smallCap')
    const bigCost = num(p, 'bigCost')
    const smallCost = num(p, 'smallCost')
    if (people <= 0 || bigCap <= 0 || smallCap <= 0) return '人数与限乘必须为正'
    if (bigCost <= 0 || smallCost <= 0) return '租金必须为正'
    if (Math.ceil(people / bigCap) > 4) return '方案超过 5 种，表格写不下'
    const result = rentPlanBest(p)
    if (result.plan.seats < people) return '最优方案坐不下所有人'
    if (result.ties !== 1) return `最优方案有 ${result.ties} 个并列，不能保证唯一解`
    return null
  },
}

const dArrangeRect = (rng: Rng): AdvParams | null =>
  retry(() => {
    const perimeter = 2 * randInt(rng, 6, 12)
    // 周长 12–24 的偶数，保证长、宽都是整数；正方形也算长方形，题干里写死
    return { perimeter }
  })

const arrangePairText = (long: number, short: number): string =>
  long === short ? `长${long}厘米、宽${short}厘米（正方形）` : `长${long}厘米、宽${short}厘米`

const arrangeAnswer = (pairs: Array<[number, number]>): string =>
  `共${pairs.length}种：${pairs.map(([long, short]) => arrangePairText(long, short)).join('、')}`

const dCombinePerimeter = (rng: Rng): AdvParams | null =>
  retry(() => {
    const l = randInt(rng, 8, 12)
    const w = randInt(rng, 3, 5)
    // 长=宽时两种拼法周长并列；长=2宽时拼出正方形，称呼有争议，均排除
    if (l <= w || l === 2 * w) return null
    return { l, w }
  })

const combineAnswer = (l: number, w: number): string => {
  const alongLong = 2 * (2 * l + w)
  const alongShort = 2 * (l + 2 * w)
  const best = Math.min(alongLong, alongShort)
  return (
    `2种；长边相接：长${2 * l}厘米、宽${w}厘米，周长${alongLong}厘米；` +
    `宽边相接：长${l}厘米、宽${2 * w}厘米，周长${alongShort}厘米；最短${best}厘米`
  )
}

const combinePerimeter: AdvancedCategory = {
  id: 'adv-combine-perimeter',
  label: '拼成大长方形，周长最短',
  tier: 'T3',
  units: ['3A-U6'],
  primaryKp: '3A-PERIMETER',
  kpKeys: ['3A-PERIMETER', '3A-STRATEGY'],
  sample:
    '有两个长8厘米、宽3厘米的长方形纸片。把它们不重叠地拼成一个大长方形（正方形也算长方形），有几种拼法？哪种拼法的周长最短？',
  pool: '长 8–12 × 宽 3–5（排除长=2宽）共 13 种',
  workLines: 6,
  draw: dCombinePerimeter,
  stem: (p) =>
    `有两个长${num(p, 'l')}厘米、宽${num(p, 'w')}厘米的长方形纸片。` +
    `把它们不重叠地拼成一个大长方形（正方形也算长方形），有几种拼法？哪种拼法的周长最短？`,
  build: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    const alongLong = 2 * (2 * l + w)
    const alongShort = 2 * (l + 2 * w)
    return {
      known: [`两个长${l}厘米、宽${w}厘米的长方形`, '不重叠地拼成一个大长方形'],
      unknown: '有几种拼法，哪种拼法周长最短',
      steps: [
        {
          text: `长边相接：长${l}+${l}=${2 * l}（厘米），宽${w}厘米，周长(${2 * l}+${w})×2=${alongLong}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `(${2 * l}+${w})*2`,
          result: alongLong,
        },
        {
          text: `宽边相接：长${l}厘米，宽${w}+${w}=${2 * w}（厘米），周长(${l}+${2 * w})×2=${alongShort}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `(${l}+${2 * w})*2`,
          result: alongShort,
        },
        {
          text: `比较：${alongLong}>${alongShort}，宽边相接的周长短`,
          kp: '3A-STRATEGY',
        },
        {
          text: `答：共有2种拼法，宽边相接的周长最短，是${alongShort}厘米`,
          kp: '3A-STRATEGY',
        },
      ],
      answer: combineAnswer(l, w),
    }
  },
  recompute: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    // 独立路径：按四条边逐条相加，不复用生成侧的中间量
    const alongLong = (2 * l + w) + (2 * l + w)
    const alongShort = (l + 2 * w) + (l + 2 * w)
    if (alongLong === alongShort) throw new Error('两种拼法周长并列，答案不唯一')
    return (
      `2种；长边相接：长${2 * l}厘米、宽${w}厘米，周长${alongLong}厘米；` +
      `宽边相接：长${l}厘米、宽${2 * w}厘米，周长${alongShort}厘米；最短${Math.min(alongLong, alongShort)}厘米`
    )
  },
  invariant: (p) => {
    const l = num(p, 'l')
    const w = num(p, 'w')
    if (l <= w) return '长必须大于宽'
    if (l === 2 * w) return '长正好是宽的2倍，拼出来是正方形，称呼有争议'
    if (2 * (2 * l + w) === 2 * (l + 2 * w)) return '两种拼法周长并列，答案不唯一'
    return null
  },
}

const arrangeRect: AdvancedCategory = {
  id: 'adv-arrange-rect',
  label: '固定周长摆长方形',
  tier: 'T3',
  units: ['3A-U6'],
  primaryKp: '3A-PERIMETER',
  kpKeys: ['3A-PERIMETER', '3A-STRATEGY'],
  sample: '用12根同样长的小棒沿边围一圈，围成一个长方形（每根算1厘米，正方形也算长方形），长不短于宽。一共有几种围法？',
  pool: '周长 12–24 的偶数 7 种（每种 2–6 个组合，低频）',
  workLines: 8,
  draw: dArrangeRect,
  stem: (p) =>
    `用${num(p, 'perimeter')}根同样长的小棒首尾相接，沿边围一圈，围成一个长方形（每根算1厘米，正方形也算长方形），长不短于宽。一共有几种围法？写出每种的长和宽。`,
  build: (p) => {
    const perimeter = num(p, 'perimeter')
    const half = perimeter / 2
    const pairs: Array<[number, number]> = []
    for (let long = half - 1; long * 2 >= half; long--) {
      pairs.push([long, half - long])
    }
    return {
      known: [`${perimeter}根小棒`, `每根算1厘米`, `沿边围一圈`, `正方形也算长方形，长不短于宽`],
      unknown: '一共有几种围法（写出每种的长和宽）',
      steps: [
        {
          text: `长+宽=周长÷2：${perimeter}÷2=${half}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `${perimeter}/2`,
          result: half,
        },
        {
          text: `有序枚举长和宽：${pairs.map(([long, short]) => arrangePairText(long, short)).join('；')}`,
          kp: '3A-STRATEGY',
        },
        {
          text: `从长最大开始，长每次少1、宽每次多1，长不短于宽，正好不重复、不遗漏`,
          kp: '3A-STRATEGY',
        },
        {
          text: `数一数：长和宽的组数共${pairs.length}种`,
          kp: '3A-STRATEGY',
        },
      ],
      answer: arrangeAnswer(pairs),
    }
  },
  recompute: (p) => {
    const perimeter = num(p, 'perimeter')
    const half = perimeter / 2
    // 独立路径：宽从 1 往上枚举，长 = 半周长 - 宽，只保留长 ≥ 宽（含正方形）
    const pairs: Array<[number, number]> = []
    for (let width = 1; width * 2 <= half; width++) {
      pairs.push([half - width, width])
    }
    return arrangeAnswer(pairs)
  },
  invariant: (p) => {
    const perimeter = num(p, 'perimeter')
    if (perimeter % 2 !== 0) return '周长必须是偶数，长和宽才是整数'
    if (perimeter < 12 || perimeter > 24) return '周长限定 12–24'
    const half = perimeter / 2
    if (half < 6) return '半周长过小，凑不出至少一种长方形'
    return null
  },
}

export const ADV_CATEGORIES: AdvancedCategory[] = [
  cycle,
  normalize,
  substitute,
  elapsed,
  ageDiff,
  joinPerimeter,
  totalize,
  reverse,
  cutPerimeter,
  weekday,
  rentPlan,
  combinePerimeter,
  arrangeRect,
]

export const advancedCategory = (id: string): AdvancedCategory | undefined =>
  ADV_CATEGORIES.find((category) => category.id === id)

// ---------- 难度档与单元映射 ----------

const LEVEL_TIER: Record<Level, AdvancedTier> = { L1: 'T1', L2: 'T2', L3: 'T3' }

export const tierForLevel = (level: Level): AdvancedTier => LEVEL_TIER[level]

export const levelForTier = (tier: AdvancedTier): Level =>
  tier === 'T1' ? 'L1' : tier === 'T2' ? 'L2' : 'L3'

export function advancedCategoriesFor(level: Level, unitIds: string[]): AdvancedCategory[] {
  const tier = tierForLevel(level)
  const selected = new Set(unitIds)
  return ADV_CATEGORIES.filter(
    (category) => category.tier === tier && category.units.some((unitId) => selected.has(unitId)),
  )
}

export function advancedSupports(grade: Grade, unitIds: string[], level: Level): boolean {
  if (grade !== '3A') return false
  return advancedCategoriesFor(level, unitIds).length > 0
}

export function advancedLevelsFor(grade: Grade, unitIds: string[]): Level[] {
  if (grade !== '3A') return []
  return (['L1', 'L2', 'L3'] as Level[]).filter((level) => advancedSupports(grade, unitIds, level))
}

export function advancedUnitSupported(grade: Grade, unitId: string, level: Level): boolean {
  return advancedSupports(grade, [unitId], level)
}

// ---------- 结构化去重键 ----------

/** 同卷/跨卷统一去重键：结构（类别 + 参数）+ 知识点，不是题干字符串 */
export function advancedKey(categoryId: string, primaryKp: string, params: AdvParams): string {
  const structure = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('|')
  return `advanced:${primaryKp}:${categoryId}:${structure}`
}

// ---------- 单题结构与双路径复核 ----------

export interface AdvancedRecord {
  categoryId: string
  tier: AdvancedTier
  level: Level
  unitId: string
  kpKey: AdvancedKp
  kpKeys: AdvancedKp[]
  params: AdvParams
  known: string[]
  unknown: string
  stem: string
  steps: AdvancedStep[]
  answer: string
  key: string
}

const FORBIDDEN_TERMS = [
  '方程',
  '未知数',
  '负数',
  '小数',
  '分数',
  '分配律',
  '结合律',
  '面积',
  '菱形',
  '梯形',
  '平均数',
  '植树',
  '鸡兔',
]

const AMBIGUOUS_TERMS = ['大约', '可能', '一些', '差不多', '左右', '若干', '大概', '也许']

export function advancedTextIssue(text: string): string | null {
  for (const term of FORBIDDEN_TERMS) {
    if (text.includes(term)) return `题干/步骤出现超纲词：${term}`
  }
  return null
}

export function ambiguousIssue(text: string): string | null {
  for (const term of AMBIGUOUS_TERMS) {
    if (text.includes(term)) return `题干出现模糊词：${term}`
  }
  return null
}

/** 教材写法禁区：三年级不该出现的除法形式、口语化表述与省略号算式 */
const STYLE_GUARDS: Array<[RegExp, string]> = [
  [/时0分/, '“X时0分”不是规范读法，应写“X时”'],
  [/÷7=0……/, '有余数除法不写商 0'],
  [/……0/, '有余数除法不写“……0”'],
  [/往后数0天/, '“往后数0天”不是数学语言'],
  [/中间过了/, '“中间过了”应写“经过了”'],
  [/1\+2\+…/, '“1+2+…”不是孩子会写的算式'],
  [/大杯能装/, '“大杯能装中杯”语义不当'],
]

export function advancedStyleIssue(text: string): string | null {
  for (const [pattern, reason] of STYLE_GUARDS) {
    if (pattern.test(text)) return reason
  }
  return null
}

const MIN_STEPS: Record<AdvancedTier, number> = { T1: 2, T2: 3, T3: 4 }

export function verifyAdvancedRecord(record: AdvancedRecord): string[] {
  const issues: string[] = []
  const category = advancedCategory(record.categoryId)
  if (!category) return [`未知拓展题类别：${record.categoryId}`]
  if (category.tier !== record.tier) {
    issues.push(`类别 ${category.id} 属于 ${category.tier}，记录写成 ${record.tier}`)
  }
  if (levelForTier(category.tier) !== record.level) {
    issues.push(`类别 ${category.id} 的难度档与 level ${record.level} 不一致`)
  }
  if (!category.units.includes(record.unitId)) {
    issues.push(`类别 ${category.id} 不属于单元 ${record.unitId}`)
  }
  if (record.kpKey !== category.primaryKp) {
    issues.push(`主知识点 ${record.kpKey} 与类别 ${category.primaryKp} 不一致`)
  }
  if (!record.known.length) issues.push('缺少已知条件')
  if (!record.unknown.trim()) issues.push('缺少所求问题')
  if (!record.stem.trim()) issues.push('题干为空')

  const ambiguous = ambiguousIssue(record.stem)
  if (ambiguous) issues.push(ambiguous)
  for (const text of [record.stem, ...record.steps.map((step) => step.text)]) {
    const forbidden = advancedTextIssue(text)
    if (forbidden) {
      issues.push(forbidden)
      break
    }
    const style = advancedStyleIssue(text)
    if (style) {
      issues.push(style)
      break
    }
  }
  if (record.categoryId === 'adv-cut-perimeter' && !record.stem.includes('从一端剪下')) {
    issues.push('剪拼题必须写明“从一端剪下”，否则从中间剪会得到第二个答案')
  }

  // 路径 2：题干必须由类别模板渲染，防止“题干与结构不一致”
  let expectedStem = ''
  try {
    expectedStem = category.stem(record.params)
  } catch (error) {
    issues.push(`题干模板渲染失败：${(error as Error).message}`)
  }
  if (expectedStem && expectedStem.replace(/\s+/g, '') !== record.stem.replace(/\s+/g, '')) {
    issues.push(`题干与类别模板不符：${record.stem}`)
  }

  // 结构可验：每一步的知识点键必须在三上集合与类别集合内
  if (record.steps.length < MIN_STEPS[record.tier]) {
    issues.push(`${record.tier} 至少需要 ${MIN_STEPS[record.tier]} 步，实际 ${record.steps.length} 步`)
  }
  record.steps.forEach((step, index) => {
    if (!ADV_3A_KP[step.kp]) {
      issues.push(`第 ${index + 1} 步使用非三上知识点：${step.kp}`)
    } else if (!category.kpKeys.includes(step.kp)) {
      issues.push(`第 ${index + 1} 步知识点 ${step.kp} 不在类别 ${category.id} 的知识点集合内`)
    }
    if (!step.text.trim()) issues.push(`第 ${index + 1} 步为空`)
    if (step.expr != null) {
      let value: number
      try {
        value = evalArithmetic(step.expr)
      } catch (error) {
        issues.push(`第 ${index + 1} 步算式无法验算：${(error as Error).message}`)
        return
      }
      if (step.result == null || value !== step.result) {
        issues.push(`第 ${index + 1} 步算式验算不符：${step.expr}=${value}，标注 ${String(step.result)}`)
      }
    }
  })

  // 路径 1：独立重算答案，不看生成侧中间值
  let recomputed: number | string
  try {
    recomputed = category.recompute(record.params)
  } catch (error) {
    issues.push(`独立重算失败：${(error as Error).message}`)
    return issues
  }
  if (String(recomputed) !== record.answer) {
    issues.push(`独立重算不符：算出 ${String(recomputed)}，答案 ${record.answer}`)
  }
  if (!record.answer.trim()) issues.push('答案为空')
  if (/^-|\d\.\d/.test(record.answer)) issues.push(`答案不是非负整数/文字：${record.answer}`)

  // 结构约束 + 唯一解（策略类在 invariant 内穷举确认唯一最优）
  const invalid = category.invariant(record.params)
  if (invalid) issues.push(`结构约束不通过：${invalid}`)

  // 去重键必须与结构 + 知识点一致
  const expectedKey = advancedKey(category.id, category.primaryKp, record.params)
  if (record.key !== expectedKey) issues.push(`去重键与结构不符：${record.key}`)

  // 数值答案至少要有一个步骤的结果与它一致（末步可能是验算，不能硬性要求末步）
  if (/^\d+$/.test(record.answer)) {
    const numericAnswer = Number(record.answer)
    if (!record.steps.some((step) => step.result === numericAnswer)) {
      issues.push(`没有任何步骤的结果等于答案 ${record.answer}`)
    }
  }
  return issues
}

export function verifyAdvancedItem(item: {
  text?: string
  answers?: string[]
  adv?: AdvancedRecord
}): string[] {
  if (!item.adv) return ['缺少拓展题复核字段']
  return verifyAdvancedRecord({
    ...item.adv,
    stem: item.text ?? item.adv.stem,
    answer: item.answers?.[0] ?? item.adv.answer,
  })
}

// ---------- 生成 ----------

export interface AdvancedQuestion {
  id: string
  grade: Grade
  unitId: string
  unitName: string
  kpName: string
  tier: AdvancedTier
  level: Level
  categoryId: string
  categoryLabel: string
  kpKey: AdvancedKp
  kpKeys: AdvancedKp[]
  stem: string
  known: string[]
  unknown: string
  steps: AdvancedStep[]
  answer: string
  params: AdvParams
  key: string
  workLines: number
  reused?: boolean
}

export interface GenerateAdvancedOptions {
  grade: Grade
  unitIds: string[]
  level: Level
  count: number
  seed?: number
  memory?: MemoryStore
  /** 同卷统一去重集合（与其它题型共用） */
  sourceUsed?: Set<string>
}

export interface AdvancedResult {
  questions: AdvancedQuestion[]
  notes: string[]
  crossReused: number
}

interface Candidate {
  category: AdvancedCategory
  unitId: string
  params: AdvParams
  stem: string
  known: string[]
  unknown: string
  steps: AdvancedStep[]
  answer: string
  key: string
}

function makeCandidate(category: AdvancedCategory, params: AdvParams, unitId: string): Candidate | null {
  try {
    const built = category.build(params)
    const stem = category.stem(params)
    const record: AdvancedRecord = {
      categoryId: category.id,
      tier: category.tier,
      level: levelForTier(category.tier),
      unitId,
      kpKey: category.primaryKp,
      kpKeys: category.kpKeys,
      params,
      known: built.known,
      unknown: built.unknown,
      stem,
      steps: built.steps,
      answer: built.answer,
      key: advancedKey(category.id, category.primaryKp, params),
    }
    if (verifyAdvancedRecord(record).length > 0) return null
    return {
      category,
      unitId,
      params,
      stem,
      known: built.known,
      unknown: built.unknown,
      steps: built.steps,
      answer: built.answer,
      key: record.key,
    }
  } catch {
    return null
  }
}

const shuffle = <T,>(rng: Rng, list: T[]): T[] => {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = randInt(rng, 0, index)
    const value = copy[index]!
    copy[index] = copy[swap]!
    copy[swap] = value
  }
  return copy
}

export function generateAdvanced(options: GenerateAdvancedOptions): AdvancedResult {
  const { grade, unitIds, level, count } = options
  const seed = options.seed ?? 20260101
  const memory = options.memory
  const questions: AdvancedQuestion[] = []
  const notes: string[] = []
  if (!Number.isInteger(count) || count <= 0) return { questions, notes, crossReused: 0 }
  if (grade !== '3A') {
    return { questions, notes: ['拓展题：本版只覆盖三年级上册'], crossReused: 0 }
  }

  const categories = advancedCategoriesFor(level, unitIds)
  if (categories.length === 0) {
    const tier = tierForLevel(level)
    return {
      questions,
      notes: [
        `拓展题：所选单元在 ${level}（${tier}）没有可用类别（T1 周期/归一/等量代换/时间/年龄差/拼周长/归总；T2 逆向/剪拼/星期几；T3 租船/拼成大长方形/固定周长摆长方形）`,
      ],
      crossReused: 0,
    }
  }

  const rng = createRng(seed + 3313)
  const seen = new Set<string>()
  const stale: Candidate[] = []
  const staleKeys = new Set<string>()
  let crossReused = 0

  const accept = (candidate: Candidate, reused: boolean): void => {
    const category = candidate.category
    questions.push({
      id: `adv-${questions.length + 1}-${category.id}`,
      grade,
      unitId: candidate.unitId,
      unitName: UNIT_NAME[candidate.unitId] ?? candidate.unitId,
      kpName: ADV_3A_KP[category.primaryKp],
      tier: category.tier,
      level,
      categoryId: category.id,
      categoryLabel: category.label,
      kpKey: category.primaryKp,
      kpKeys: category.kpKeys,
      stem: candidate.stem,
      known: candidate.known,
      unknown: candidate.unknown,
      steps: candidate.steps,
      answer: candidate.answer,
      params: candidate.params,
      key: candidate.key,
      workLines: category.workLines,
      ...(reused ? { reused: true } : {}),
    })
    seen.add(candidate.key)
    options.sourceUsed?.add(candidate.key)
    memory?.record(candidate.key)
    if (reused) crossReused++
  }

  const pickCategory = (category: AdvancedCategory, budget: number): number => {
    const units = category.units.filter((unitId) => unitIds.includes(unitId))
    if (units.length === 0) return 0
    let added = 0
    let misses = 0
    for (let attempt = 0; attempt < 400 && added < budget && questions.length < count; attempt++) {
      if (misses > 120) break
      const params = category.draw(rng)
      if (!params) {
        misses++
        continue
      }
      const candidate = makeCandidate(category, params, units[0]!)
      if (!candidate) {
        misses++
        continue
      }
      if (seen.has(candidate.key)) {
        misses++
        continue
      }
      const reused = memory?.recentlyUsed(candidate.key) ?? false
      if (reused) {
        if (!staleKeys.has(candidate.key)) {
          staleKeys.add(candidate.key)
          stale.push(candidate)
        }
        misses++
        continue
      }
      accept(candidate, false)
      added++
      misses = 0
    }
    return added
  }

  // 第一轮：每个类别至少出 1 题，保证同档内类别覆盖
  for (const category of shuffle(rng, categories)) {
    if (questions.length >= count) break
    pickCategory(category, 1)
  }

  // 第二轮：按类别均额填充，避免某一类占比过高
  const perCategory = Math.max(1, Math.ceil(count / categories.length) - 1)
  for (const category of shuffle(rng, categories)) {
    if (questions.length >= count) break
    pickCategory(category, perCategory)
  }

  // 第三轮：还有缺口时，让参数池未用尽的类别继续补足（如可用类别少于所需题量）
  for (let round = 0; round < 40 && questions.length < count; round++) {
    const before = questions.length
    for (const category of shuffle(rng, categories)) {
      if (questions.length >= count) break
      pickCategory(category, Math.max(1, Math.ceil((count - questions.length) / categories.length)))
    }
    if (questions.length === before) break
  }

  for (const candidate of stale) {
    if (questions.length >= count) break
    if (seen.has(candidate.key)) continue
    accept(candidate, true)
  }

  if (questions.length < count) {
    notes.push(
      `拓展题：本档可用类别 ${categories.length} 种，参数池用尽后如实出 ${questions.length}/${count} 题（同结构不重复，不用重复题凑数）`,
    )
  }
  if (crossReused > 0) {
    notes.push(`拓展题：题池不足，${crossReused} 道按 LRU 跨卷复用（同卷仍不重复）`)
  }
  return { questions, notes, crossReused }
}

/** 卷级校验：逐题双路径复核 + 同卷结构/知识点重复 */
export function validateAdvancedPaper(questions: AdvancedQuestion[]): string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  for (const question of questions) {
    const record: AdvancedRecord = {
      categoryId: question.categoryId,
      tier: question.tier,
      level: question.level,
      unitId: question.unitId,
      kpKey: question.kpKey,
      kpKeys: question.kpKeys,
      params: question.params,
      known: question.known,
      unknown: question.unknown,
      stem: question.stem,
      steps: question.steps,
      answer: question.answer,
      key: question.key,
    }
    issues.push(...verifyAdvancedRecord(record).map((issue) => `${question.id}：${issue}`))
    if (seen.has(question.key)) issues.push(`同卷重复：${question.key}`)
    seen.add(question.key)
  }
  return issues
}
