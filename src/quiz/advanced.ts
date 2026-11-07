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
  /** 可出现的难度层；缺省按基础档位推导（T1→L1/L2，T2→L2/L3，T3→L3） */
  levels?: Level[]
  /** 同类别下的结构变体数（缺省 1），用于如实提示“有几类、几种结构” */
  variantCount?: number
  /** 同类别每卷上限：算式谜、抽屉原理在 beta 阶段每卷最多 1 道 */
  maxPerPaper?: number
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

// ---------- 22 类拓展题 ----------

const dCycle = (rng: Rng): AdvParams | null =>
  retry(() => {
    // 每个周期串里的符号互不重复，避免“直接猜出现两次的那个符号”就有一半概率
    const patterns = [
      { pattern: '△○□', kind: '图形' },
      { pattern: '○△□☆', kind: '图形' },
      { pattern: '红黄蓝', kind: '颜色' },
      { pattern: '红黄蓝绿', kind: '颜色' },
      { pattern: '☆○△□', kind: '图形' },
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
  sample: '按“△○□……”重复排列，第17个图形是什么？（写出算式和答句）',
  pool: '5 种周期串（符号互不重复）× 第 10–60 个 ≈ 255',
  workLines: 3,
  draw: dCycle,
  stem: (p) =>
    `按“${str(p, 'pattern')}……”这样的顺序重复排列，第${num(p, 'n')}个${str(p, 'kind')}是什么？（写出算式和答句）`,
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
    if (new Set(pattern).size !== pattern.length) return '周期串里有重复符号，答案可以靠猜'
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
      { big: '大箱', mid: '中箱', small: '水瓶', verb: '装', smallUnit: '瓶' },
      { big: '礼品盒', mid: '小盒', small: '糖果', verb: '装', smallUnit: '颗' },
    ]
    const combo = pick(rng, combos)
    const a = randInt(rng, 2, 6)
    const b = randInt(rng, 2, 6)
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
  pool: '4 组等量关系 × 2–6 × 2–6 ≈ 96（排除答案 4）',
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
    const count = randInt(rng, 2, 6)
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
  pool: '个数 2–6 × 边长 3–9 ≈ 44（周长上限 120）',
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

/** 逆向推理的 4 个变体：两个运算的先后顺序、加/减/乘/除的组合都不同 */
const REVERSE_VARIANTS = ['add-mul', 'sub-mul', 'add-div', 'mul-add'] as const
type ReverseVariant = (typeof REVERSE_VARIANTS)[number]

const dReverse = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, REVERSE_VARIANTS)
    if (variant === 'add-mul') {
      const start = randInt(rng, 2, 20)
      const add = randInt(rng, 2, 30)
      const mult = randInt(rng, 2, 9)
      const result = (start + add) * mult
      if (result > 999) return null
      return { variant, start, add, mult, result }
    }
    if (variant === 'sub-mul') {
      const sub = randInt(rng, 2, 9)
      const start = sub + randInt(rng, 2, 20)
      const mult = randInt(rng, 2, 9)
      const result = (start - sub) * mult
      if (result > 999) return null
      return { variant, start, sub, mult, result }
    }
    if (variant === 'add-div') {
      const divisor = randInt(rng, 2, 9)
      const quotient = randInt(rng, 2, 15)
      const add = randInt(rng, 2, 20)
      const start = quotient * divisor - add
      // 倒推第一步不能直接得到负数，否则三上不会写
      if (start < 2) return null
      return { variant, start, add, divisor, quotient }
    }
    const start = randInt(rng, 2, 20)
    const mult = randInt(rng, 2, 9)
    const add = randInt(rng, 2, 30)
    const result = start * mult + add
    if (result > 999) return null
    return { variant, start, mult, add, result }
  })

const reverseStem = (p: AdvParams): string => {
  const variant = str(p, 'variant') as ReverseVariant
  if (variant === 'add-mul') {
    return `一个数先加上${num(p, 'add')}，再乘${num(p, 'mult')}，结果是${num(p, 'result')}。这个数是多少？`
  }
  if (variant === 'sub-mul') {
    return `一个数先减去${num(p, 'sub')}，再乘${num(p, 'mult')}，结果是${num(p, 'result')}。这个数是多少？`
  }
  if (variant === 'add-div') {
    return `一个数先加上${num(p, 'add')}，再除以${num(p, 'divisor')}，商是${num(p, 'quotient')}。这个数是多少？`
  }
  return `一个数先乘${num(p, 'mult')}，再加上${num(p, 'add')}，结果是${num(p, 'result')}。这个数是多少？`
}

const reverseBuild = (p: AdvParams): {
  known: string[]
  unknown: string
  steps: AdvancedStep[]
  answer: string
} => {
  const variant = str(p, 'variant') as ReverseVariant
  const start = num(p, 'start')
  if (variant === 'add-mul') {
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
  }
  if (variant === 'sub-mul') {
    const sub = num(p, 'sub')
    const mult = num(p, 'mult')
    const result = num(p, 'result')
    const middle = result / mult
    return {
      known: [`先减${sub}，再乘${mult}`, `结果${result}`],
      unknown: '原来的数',
      steps: [
        {
          text: `从结果倒着想：${result}÷${mult}=${middle}`,
          kp: '3A-DIV-1',
          expr: `${result}/${mult}`,
          result: middle,
        },
        {
          text: `减去的要加回来：${middle}+${sub}=${start}`,
          kp: '3A-ADD-SUB',
          expr: `${middle}+${sub}`,
          result: start,
        },
        {
          text: `验算：(${start}-${sub})×${mult}=${result}`,
          kp: '3A-TWO-STEP',
          expr: `(${start}-${sub})*${mult}`,
          result,
        },
      ],
      answer: String(start),
    }
  }
  if (variant === 'add-div') {
    const add = num(p, 'add')
    const divisor = num(p, 'divisor')
    const quotient = num(p, 'quotient')
    const dividend = quotient * divisor
    return {
      known: [`先加${add}，再除以${divisor}`, `商是${quotient}`],
      unknown: '原来的数',
      steps: [
        {
          text: `被除数 = 商×除数：${quotient}×${divisor}=${dividend}`,
          kp: '3A-MUL-1',
          expr: `${quotient}*${divisor}`,
          result: dividend,
        },
        {
          text: `${dividend}-${add}=${start}`,
          kp: '3A-ADD-SUB',
          expr: `${dividend}-${add}`,
          result: start,
        },
        {
          text: `验算：(${start}+${add})÷${divisor}=${quotient}`,
          kp: '3A-DIV-1',
          expr: `(${start}+${add})/${divisor}`,
          result: quotient,
        },
      ],
      answer: String(start),
    }
  }
  const mult = num(p, 'mult')
  const add = num(p, 'add')
  const result = num(p, 'result')
  const product = result - add
  return {
    known: [`先乘${mult}，再加${add}`, `结果${result}`],
    unknown: '原来的数',
    steps: [
      {
        text: `先把后加上的减掉：${result}-${add}=${product}`,
        kp: '3A-ADD-SUB',
        expr: `${result}-${add}`,
        result: product,
      },
      {
        text: `${product}÷${mult}=${start}`,
        kp: '3A-DIV-1',
        expr: `${product}/${mult}`,
        result: start,
      },
      {
        text: `验算：${start}×${mult}+${add}=${result}`,
        kp: '3A-TWO-STEP',
        expr: `${start}*${mult}+${add}`,
        result,
      },
    ],
    answer: String(start),
  }
}

const reverse: AdvancedCategory = {
  id: 'adv-reverse',
  label: '逆向推理',
  tier: 'T2',
  units: ['3A-U1', '3A-U4'],
  primaryKp: '3A-TWO-STEP',
  kpKeys: ['3A-DIV-1', '3A-MUL-1', '3A-ADD-SUB', '3A-TWO-STEP'],
  sample: '一个数先加15，再乘3，结果是72，这个数是多少？',
  pool: '4 个变体（加→乘、减→乘、加→除、乘→加）× 各变体参数域',
  workLines: 4,
  variantCount: 4,
  draw: dReverse,
  stem: reverseStem,
  build: reverseBuild,
  recompute: (p) => {
    const variant = str(p, 'variant') as ReverseVariant
    const start = num(p, 'start')
    // 独立路径：从原数正向模拟，必须回到题面给出的结果
    const forward =
      variant === 'add-mul'
        ? (start + num(p, 'add')) * num(p, 'mult')
        : variant === 'sub-mul'
          ? (start - num(p, 'sub')) * num(p, 'mult')
          : variant === 'add-div'
            ? (start + num(p, 'add')) / num(p, 'divisor')
            : start * num(p, 'mult') + num(p, 'add')
    const expected =
      variant === 'add-div' ? num(p, 'quotient') : num(p, 'result')
    if (forward !== expected) throw new Error(`正向模拟得 ${forward}，与题面 ${expected} 不符`)
    return start
  },
  invariant: (p) => {
    const variant = str(p, 'variant') as ReverseVariant
    const start = num(p, 'start')
    if (start < 2) return '原来的数至少是 2'
    if (variant === 'add-mul') {
      const add = num(p, 'add')
      const mult = num(p, 'mult')
      const result = num(p, 'result')
      if (result % mult !== 0) return `结果 ${result} 不能被 ${mult} 整除`
      if (result / mult <= add) return '倒推第一步就减成非正数'
      if ((start + add) * mult !== result) return '正向结果与题面不符'
      return null
    }
    if (variant === 'sub-mul') {
      const sub = num(p, 'sub')
      const mult = num(p, 'mult')
      const result = num(p, 'result')
      if (sub >= start) return '原来的数必须大于减数'
      if (result % mult !== 0) return `结果 ${result} 不能被 ${mult} 整除`
      if ((start - sub) * mult !== result) return '正向结果与题面不符'
      return null
    }
    if (variant === 'add-div') {
      const add = num(p, 'add')
      const divisor = num(p, 'divisor')
      const quotient = num(p, 'quotient')
      if (divisor < 2 || divisor > 9) return `除数 ${divisor} 超出 2–9`
      if ((start + add) % divisor !== 0) return '倒推的被除数不能整除'
      if ((start + add) / divisor !== quotient) return '正向模拟与商不符'
      return null
    }
    const mult = num(p, 'mult')
    const add = num(p, 'add')
    const result = num(p, 'result')
    if (result <= add) return '先减后加的结果必须大于加数'
    if ((result - add) % mult !== 0) return '先减后加得到的积不能整除'
    if (start * mult + add !== result) return '正向结果与题面不符'
    return null
  },
}

const dCutPerimeter = (rng: Rng): AdvParams | null =>
  retry(() => {
    const w = randInt(rng, 3, 10)
    const l = w + randInt(rng, 2, 9)
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
  pool: '宽 3–10 × 长比宽多 2–9（排除长=2宽，周长≤60）≈ 58',
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
    // 前提：大船人均更便宜（否则“比较空位”的策略点消失，最优几乎总是全租小船）
    if (bigCost * smallCap >= smallCost * bigCap) return null
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
  sample: '18人去划船。大船限乘6人，租金30元；小船限乘4人，租金24元。不能超载，怎样租最省？最少多少元？',
  pool: '人数 12–30 × 大船 5–8 人 × 小船 3–4 人 × 两种租金 ≈ 4 万（唯一最优且方案 ≤5 后仍充足）',
  workLines: 8,
  draw: dRentPlan,
  stem: (p) =>
    `${num(p, 'people')}人去划船。大船限乘${num(p, 'bigCap')}人，租金${num(p, 'bigCost')}元；` +
    `小船限乘${num(p, 'smallCap')}人，租金${num(p, 'smallCost')}元。不能超载，怎样租最省？最少多少元？`,
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
    // 大船人均必须更便宜，否则“先坐大船再补空位”的策略前提不成立
    if (bigCost * smallCap >= smallCost * bigCap) return '大船人均不比小船便宜，策略前提不成立'
    return null
  },
}

const dArrangeRect = (rng: Rng): AdvParams | null =>
  retry(() => {
    const half = randInt(rng, 6, 20)
    const perimeter = 2 * half
    // 变体：正方形是否计入长方形。半周长为奇数时两种口径答案相同，只出“含正方形”
    const squareCounts = half % 2 === 0 ? randInt(rng, 0, 1) : 1
    return { perimeter, squareCounts, variant: squareCounts === 1 ? 'with-square' : 'no-square' }
  })

/** 兼容旧参数：未写 squareCounts 时按“正方形也算长方形”处理 */
const arrangeIncludesSquare = (p: AdvParams): boolean =>
  p.squareCounts === undefined ? true : num(p, 'squareCounts') === 1

const arrangeMaxWidth = (perimeter: number, includeSquare: boolean): number => {
  const half = perimeter / 2
  return includeSquare ? Math.floor(half / 2) : Math.floor((half - 1) / 2)
}

/** 长从大到小枚举，长不短于宽；按口径决定是否保留正方形那一组 */
const arrangePairs = (half: number, includeSquare: boolean): Array<[number, number]> => {
  const pairs: Array<[number, number]> = []
  for (let long = half - 1; includeSquare ? long * 2 >= half : long * 2 > half; long--) {
    pairs.push([long, half - long])
  }
  return pairs
}

const arrangePairText = (long: number, short: number): string =>
  long === short ? `长${long}宽${short}（正方形）` : `长${long}宽${short}`

const arrangeAnswer = (pairs: Array<[number, number]>): string =>
  `共${pairs.length}种：${pairs.map(([long, short]) => arrangePairText(long, short)).join('、')}`

const dCombinePerimeter = (rng: Rng): AdvParams | null =>
  retry(() => {
    const l = randInt(rng, 8, 15)
    const w = randInt(rng, 3, 6)
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
  pool: '长 8–15 × 宽 3–6（排除长=2宽）共 29 种',
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
  pool: '半周长 6–20（周长 12–40 共 15 种）× 2 种口径（含/不含正方形）≈ 23 种结构',
  workLines: 8,
  variantCount: 2,
  draw: dArrangeRect,
  stem: (p) => {
    const perimeter = num(p, 'perimeter')
    const includeSquare = arrangeIncludesSquare(p)
    return (
      `用${perimeter}根同样长的小棒首尾相接，沿边围一圈，围成一个长方形（每根算1厘米，` +
      `${includeSquare ? '正方形也算一种长方形' : '只数长和宽不一样的长方形，正方形不算'}），` +
      `长不短于宽。一共有几种围法？写出每种的长和宽。`
    )
  },
  build: (p) => {
    const perimeter = num(p, 'perimeter')
    const half = perimeter / 2
    const includeSquare = arrangeIncludesSquare(p)
    const pairs = arrangePairs(half, includeSquare)
    return {
      known: [
        `${perimeter}根小棒`,
        '每根算1厘米',
        '沿边围一圈',
        includeSquare ? '正方形也算一种长方形，长不短于宽' : '只数长和宽不一样的长方形，长不短于宽',
      ],
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
          text: `从长最大开始，长每次少1、宽每次多1，长不短于宽，正好不重复、不遗漏${
            includeSquare ? '' : '（长=宽的正方形不数）'
          }`,
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
    const includeSquare = arrangeIncludesSquare(p)
    // 独立路径：宽从小到大枚举，长 = 半周长 - 宽
    const pairs: Array<[number, number]> = []
    for (let width = 1; includeSquare ? width * 2 <= half : width * 2 < half; width++) {
      pairs.push([half - width, width])
    }
    return arrangeAnswer(pairs)
  },
  invariant: (p) => {
    const perimeter = num(p, 'perimeter')
    const includeSquare = arrangeIncludesSquare(p)
    if (perimeter % 2 !== 0) return '周长必须是偶数，长和宽才是整数'
    if (perimeter < 12 || perimeter > 40) return '周长限定 12–40'
    const half = perimeter / 2
    if (half < 6) return '半周长过小，凑不出至少一种长方形'
    if (arrangeMaxWidth(perimeter, includeSquare) > 10) return '拆出的长宽组合超过 10 组，答案写不下'
    if (arrangeMaxWidth(perimeter, includeSquare) < 2) return '围法少于 2 种，题目太薄'
    // 半周长为奇数时，正方形那一组本来就不存在，两种口径答案相同，失去变体意义
    if (!includeSquare && half % 2 !== 0) return '不含正方形时半周长必须是偶数'
    return null
  },
}

// ---------- P1 第一批：改围图形 / 月历牌推理 / 错中求解 / 积的位数 ----------

/**
 * 改围图形：同一根绳子改围成另一种图形，周长不变。
 * 三个变体的已知量不同（长宽 / 正方形边长+长 / 周长+长），不是换数字。
 */
const dReshape = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['rect-to-square', 'square-to-rect', 'perimeter-to-width'] as const)
    if (variant === 'rect-to-square') {
      const w = randInt(rng, 3, 9)
      const l = w + randInt(rng, 2, 9)
      const perimeter = 2 * (l + w)
      // 改围正方形要求周长能被 4 整除，否则边长不是整厘米
      if (perimeter % 4 !== 0) return null
      return { variant, l, w }
    }
    if (variant === 'square-to-rect') {
      const side = randInt(rng, 4, 12)
      const perimeter = 4 * side
      const l = randInt(rng, 5, 15)
      const w = perimeter / 2 - l
      if (w <= 0 || w >= l) return null
      // 宽只有 1–2 厘米的长方形太扁，不像课本里的图形
      if (w < 3) return null
      if (perimeter > 60) return null
      return { variant, side, l }
    }
    const w = randInt(rng, 3, 9)
    const l = w + randInt(rng, 2, 9)
    const perimeter = 2 * (l + w)
    if (perimeter > 60) return null
    return { variant, l, perimeter }
  })

const reshape: AdvancedCategory = {
  id: 'adv-reshape',
  label: '改围图形',
  tier: 'T2',
  units: ['3A-U6'],
  primaryKp: '3A-PERIMETER',
  kpKeys: ['3A-PERIMETER', '3A-ADD-SUB'],
  sample: '一根铁丝正好围成长6厘米、宽4厘米的长方形。如果改围成一个正方形，边长是多少厘米？',
  pool: '3 个变体（长方形→正方形、正方形→长方形、周长+长→宽）× 长宽参数域',
  workLines: 4,
  variantCount: 3,
  draw: dReshape,
  stem: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'rect-to-square') {
      return `一根铁丝正好围成长${num(p, 'l')}厘米、宽${num(p, 'w')}厘米的长方形。如果把这根铁丝改围成一个正方形，边长是多少厘米？`
    }
    if (variant === 'square-to-rect') {
      return `一根铁丝正好围成一个边长${num(p, 'side')}厘米的正方形。如果把这根铁丝改围成长${num(p, 'l')}厘米的长方形，宽是多少厘米？`
    }
    return `一根铁丝正好围成一个长方形，长是${num(p, 'l')}厘米，周长是${num(p, 'perimeter')}厘米。这个长方形的宽是多少厘米？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'rect-to-square') {
      const l = num(p, 'l')
      const w = num(p, 'w')
      const perimeter = 2 * (l + w)
      const side = perimeter / 4
      return {
        known: [`长方形长${l}厘米、宽${w}厘米`, '改围成正方形'],
        unknown: '正方形的边长',
        steps: [
          {
            text: `先求铁丝的长，也就是长方形的周长：(${l}+${w})×2=${perimeter}（厘米）`,
            kp: '3A-PERIMETER',
            expr: `(${l}+${w})*2`,
            result: perimeter,
          },
          {
            text: `改围正方形，周长不变，4条边一样长：${perimeter}÷4=${side}（厘米）`,
            kp: '3A-PERIMETER',
            expr: `${perimeter}/4`,
            result: side,
          },
          {
            text: `验算：${side}×4=${perimeter}（厘米），和长方形的周长相同`,
            kp: '3A-PERIMETER',
            expr: `${side}*4`,
            result: perimeter,
          },
        ],
        answer: `${side}厘米`,
      }
    }
    if (variant === 'square-to-rect') {
      const side = num(p, 'side')
      const l = num(p, 'l')
      const perimeter = 4 * side
      const half = perimeter / 2
      const w = half - l
      return {
        known: [`正方形边长${side}厘米`, `改围成长${l}厘米的长方形`],
        unknown: '长方形的宽',
        steps: [
          {
            text: `正方形的周长就是铁丝的长：${side}×4=${perimeter}（厘米）`,
            kp: '3A-PERIMETER',
            expr: `${side}*4`,
            result: perimeter,
          },
          {
            text: `长方形长+宽是周长的一半：${perimeter}÷2=${half}（厘米）`,
            kp: '3A-PERIMETER',
            expr: `${perimeter}/2`,
            result: half,
          },
          {
            text: `宽：${half}-${l}=${w}（厘米）`,
            kp: '3A-ADD-SUB',
            expr: `${half}-${l}`,
            result: w,
          },
          {
            text: `验算：(${l}+${w})×2=${perimeter}（厘米），和原来的周长相同`,
            kp: '3A-PERIMETER',
            expr: `(${l}+${w})*2`,
            result: perimeter,
          },
        ],
        answer: `${w}厘米`,
      }
    }
    const l = num(p, 'l')
    const perimeter = num(p, 'perimeter')
    const half = perimeter / 2
    const w = half - l
    return {
      known: [`周长${perimeter}厘米`, `长${l}厘米`],
      unknown: '长方形的宽',
      steps: [
        {
          text: `长+宽是周长的一半：${perimeter}÷2=${half}（厘米）`,
          kp: '3A-PERIMETER',
          expr: `${perimeter}/2`,
          result: half,
        },
        {
          text: `宽：${half}-${l}=${w}（厘米）`,
          kp: '3A-ADD-SUB',
          expr: `${half}-${l}`,
          result: w,
        },
        {
          text: `验算：(${l}+${w})×2=${perimeter}（厘米），和题面的周长相同`,
          kp: '3A-PERIMETER',
          expr: `(${l}+${w})*2`,
          result: perimeter,
        },
      ],
      answer: `${w}厘米`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    // 独立路径：不套公式，按“四条边一条一条加起来”还原
    if (variant === 'rect-to-square') {
      const l = num(p, 'l')
      const w = num(p, 'w')
      const total = l + w + l + w
      let side = 0
      while (side * 4 < total) side++
      if (side * 4 !== total) throw new Error('四条边不能正好四等分')
      return `${side}厘米`
    }
    if (variant === 'square-to-rect') {
      const side = num(p, 'side')
      const l = num(p, 'l')
      let perimeter = 0
      for (let index = 0; index < 4; index++) perimeter += side
      let w = 0
      while (l + w + l + w < perimeter) w++
      if (l + w + l + w !== perimeter) throw new Error('宽无法凑成整厘米')
      return `${w}厘米`
    }
    const l = num(p, 'l')
    const perimeter = num(p, 'perimeter')
    // 独立路径：周长减去两条长，剩下的就是两条宽
    const twoWidths = perimeter - l - l
    if (twoWidths % 2 !== 0 || twoWidths <= 0) throw new Error('周长减两条长后不能平分')
    return `${twoWidths / 2}厘米`
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'rect-to-square') {
      const l = num(p, 'l')
      const w = num(p, 'w')
      const perimeter = 2 * (l + w)
      if (l <= w) return '长方形必须长大于宽'
      if (perimeter % 4 !== 0) return '周长不能被4整除，正方形边长不是整厘米'
      if (perimeter > 60) return '周长超过60厘米'
      return null
    }
    if (variant === 'square-to-rect') {
      const side = num(p, 'side')
      const l = num(p, 'l')
      const w = 2 * side - l
      if (w <= 0) return '改围后宽不能是0或负数'
      if (w >= l) return '改围后必须还是长方形（宽小于长）'
      if (w < 3) return '宽小于3厘米，题目太薄'
      if (4 * side > 60) return '周长超过60厘米'
      return null
    }
    const l = num(p, 'l')
    const perimeter = num(p, 'perimeter')
    const w = perimeter / 2 - l
    if (perimeter % 2 !== 0) return '周长必须是偶数'
    if (w <= 0) return '长已经吃掉整个半周长，宽为0'
    if (w >= l) return '宽不小于长，不是长方形'
    if (w < 3) return '宽小于3厘米，题目太薄'
    if (perimeter > 60) return '周长超过60厘米'
    return null
  },
}

/**
 * 月历牌推理：利用月历牌上“竖排差7、横排差1”的位置关系反求日期。
 * 三个变体分别覆盖竖排 3 个、横排 3 个（求最左）、十字 5 个。
 */
const dCalendarCard = (rng: Rng): AdvParams | null => {
  const months = Object.keys(MONTH_DAYS).map(Number)
  const month = pick(rng, months)
  const days = MONTH_DAYS[month]!
  const variant = pick(rng, ['vertical-3', 'horizontal-3', 'cross-5'] as const)
  if (variant === 'horizontal-3') {
    const first = randInt(rng, 1, days - 2)
    return { variant, month, first, sum: first + (first + 1) + (first + 2) }
  }
  // 中间日期下限 8：保证上方的日期至少是 1 号；上限 days-7：保证下方的日期不跨月
  const middle = randInt(rng, 8, days - 7)
  return { variant, month, middle, sum: variant === 'vertical-3' ? 3 * middle : 5 * middle }
}

const calendarCard: AdvancedCategory = {
  id: 'adv-calendar-card',
  label: '月历牌推理',
  tier: 'T2',
  units: ['3A-U5'],
  primaryKp: '3A-CALENDAR',
  kpKeys: ['3A-CALENDAR', '3A-DIV-1', '3A-ADD-SUB'],
  sample: '月历牌上竖着相邻的三个日期，加起来是33。中间那个是几号？',
  pool: '12 个月 × 竖排/横排/十字 3 个变体 × 日期位置',
  workLines: 4,
  variantCount: 3,
  draw: dCalendarCard,
  stem: (p) => {
    const variant = str(p, 'variant')
    const month = num(p, 'month')
    const sum = num(p, 'sum')
    if (variant === 'horizontal-3') {
      return `${month}月的月历牌上，横着相邻的三个日期加起来是${sum}。最左边一个是${month}月几日？`
    }
    if (variant === 'vertical-3') {
      return `${month}月的月历牌上，竖着相邻的三个日期加起来是${sum}。中间那个是${month}月几日？`
    }
    return `${month}月的月历牌上，中间一个日期和它上、下、左、右四个相邻日期加起来是${sum}。中间那个是${month}月几日？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    const month = num(p, 'month')
    const sum = num(p, 'sum')
    if (variant === 'vertical-3') {
      const middle = sum / 3
      return {
        known: [`${month}月月历牌`, '竖着相邻的三个日期', `和是${sum}`],
        unknown: `中间那个是${month}月几日`,
        steps: [
          {
            text: '月历牌上同一列竖着相邻的两个日期正好差7天，中间数的上面一个少7，下面一个多7',
            kp: '3A-CALENDAR',
          },
          {
            text: '上面一个和下面一个合起来正好是2个中间数，所以三个日期的和是中间数的3倍',
            kp: '3A-ADD-SUB',
          },
          {
            text: `${sum}÷3=${middle}（日）`,
            kp: '3A-DIV-1',
            expr: `${sum}/3`,
            result: middle,
          },
          {
            text: `验算：${middle - 7}+${middle}+${middle + 7}=${sum}`,
            kp: '3A-ADD-SUB',
            expr: `${middle - 7}+${middle}+${middle + 7}`,
            result: sum,
          },
        ],
        answer: `中间是${middle}日`,
      }
    }
    if (variant === 'horizontal-3') {
      const middle = sum / 3
      const first = middle - 1
      return {
        known: [`${month}月月历牌`, '横着相邻的三个日期', `和是${sum}`],
        unknown: `最左边一个是${month}月几日`,
        steps: [
          {
            text: '月历牌上横着相邻的两个日期正好差1天，中间数比左边大1、比右边小1',
            kp: '3A-CALENDAR',
          },
          {
            text: '三个日期的和是中间数的3倍',
            kp: '3A-ADD-SUB',
          },
          {
            text: `${sum}÷3=${middle}，中间是${middle}日`,
            kp: '3A-DIV-1',
            expr: `${sum}/3`,
            result: middle,
          },
          {
            text: `最左边比中间小1：${middle}-1=${first}（日）`,
            kp: '3A-ADD-SUB',
            expr: `${middle}-1`,
            result: first,
          },
          {
            text: `验算：${first}+${first + 1}+${first + 2}=${sum}`,
            kp: '3A-ADD-SUB',
            expr: `${first}+${first + 1}+${first + 2}`,
            result: sum,
          },
        ],
        answer: `最左边是${first}日`,
      }
    }
    const middle = sum / 5
    return {
      known: [`${month}月月历牌`, '十字形五个日期', `和是${sum}`],
      unknown: `中间那个是${month}月几日`,
      steps: [
        {
          text: '十字形里上、下两个日期和中间都差7，左、右两个日期和中间都差1',
          kp: '3A-CALENDAR',
        },
        {
          text: '上、下两个合起来是2个中间数，左、右两个合起来也是2个中间数，再加中间一共是5个中间数',
          kp: '3A-ADD-SUB',
        },
        {
          text: `${sum}÷5=${middle}（日）`,
          kp: '3A-DIV-1',
          expr: `${sum}/5`,
          result: middle,
        },
        {
          text: `验算：${middle - 7}+${middle + 7}+${middle - 1}+${middle + 1}+${middle}=${sum}`,
          kp: '3A-ADD-SUB',
          expr: `${middle - 7}+${middle + 7}+${middle - 1}+${middle + 1}+${middle}`,
          result: sum,
        },
      ],
      answer: `中间是${middle}日`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const month = num(p, 'month')
    const sum = num(p, 'sum')
    const days = MONTH_DAYS[month]!
    // 独立路径：把月历牌上每一组可能的位置都试一遍，看哪一组正好等于题面的和
    if (variant === 'horizontal-3') {
      for (let first = 1; first + 2 <= days; first++) {
        if (first + (first + 1) + (first + 2) === sum) return `最左边是${first}日`
      }
      throw new Error('横排三个日期找不到唯一解')
    }
    for (let middle = 8; middle + 7 <= days; middle++) {
      if (variant === 'vertical-3' && (middle - 7) + middle + (middle + 7) === sum) return `中间是${middle}日`
      if (variant === 'cross-5' && 5 * middle === sum) return `中间是${middle}日`
    }
    throw new Error('竖排或十字形找不到唯一解')
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const month = num(p, 'month')
    const sum = num(p, 'sum')
    const days = MONTH_DAYS[month]
    if (!days) return '月份不合法'
    if (variant === 'horizontal-3') {
      if (sum % 3 !== 0) return '三个日期的和必须是3的倍数'
      const first = sum / 3 - 1
      if (first < 1) return '最左边日期跨到上个月了'
      if (first + 2 > days) return '最右边日期跨到下个月了'
      return null
    }
    const divisor = variant === 'vertical-3' ? 3 : 5
    if (sum % divisor !== 0) return `和不是${divisor}的倍数`
    const middle = sum / divisor
    if (middle < 8) return '中间日期上方没有日期了'
    if (middle + 7 > days) return '中间日期下方跨到下个月了'
    return null
  },
}

/**
 * 错中求解：别人把运算看错了，先用错误结果还原原来的数，再算正确结果。
 * 两个变体分别是看错因数、把乘看成除。
 */
const dMisread = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['factor', 'op-swap'] as const)
    if (variant === 'factor') {
      const a = randInt(rng, 2, 9)
      const b = randInt(rng, 2, 9)
      if (a === b) return null
      // 原数取两位数，才配得上“一位数乘两位数”这一单元
      const x = randInt(rng, 11, 29)
      return { variant, a, b, x, wrong: x * b, correct: x * a }
    }
    const a = randInt(rng, 2, 9)
    const q = randInt(rng, 2, 9)
    const x = q * a
    if (x < 10) return null
    return { variant, a, q, x, correct: x * a }
  })

const misread: AdvancedCategory = {
  id: 'adv-misread',
  label: '错中求解',
  tier: 'T2',
  units: ['3A-U2', '3A-U4'],
  primaryKp: '3A-MUL-1',
  kpKeys: ['3A-MUL-1', '3A-DIV-1'],
  sample: '小明算一个数乘6，把6看成了9，算出的积是54。正确的积是多少？',
  pool: '2 个变体（看错因数、把乘看成除）× 因数 2–9 × 原数 11–29',
  workLines: 4,
  variantCount: 2,
  draw: dMisread,
  stem: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    if (variant === 'factor') {
      return `小明算一个数乘${a}，把${a}看成了${num(p, 'b')}，算出的积是${num(p, 'wrong')}。正确的积是多少？`
    }
    return `小明算一个数乘${a}，却算成了除以${a}，得到商${num(p, 'q')}。正确的积是多少？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    if (variant === 'factor') {
      const b = num(p, 'b')
      const x = num(p, 'x')
      const wrong = num(p, 'wrong')
      const correct = num(p, 'correct')
      return {
        known: [`把乘${a}看成乘${b}`, `算出的积是${wrong}`],
        unknown: '正确的积',
        steps: [
          {
            text: `先照着别人的错算还原这个数：${wrong}÷${b}=${x}`,
            kp: '3A-DIV-1',
            expr: `${wrong}/${b}`,
            result: x,
          },
          {
            text: `再用这个数算正确的积：${x}×${a}=${correct}`,
            kp: '3A-MUL-1',
            expr: `${x}*${a}`,
            result: correct,
          },
          {
            text: `验算：${x}×${b}=${wrong}，正好是别人算出的积`,
            kp: '3A-MUL-1',
            expr: `${x}*${b}`,
            result: wrong,
          },
        ],
        answer: String(correct),
      }
    }
    const q = num(p, 'q')
    const x = num(p, 'x')
    const correct = num(p, 'correct')
    return {
      known: [`把乘${a}算成除以${a}`, `得到商${q}`],
      unknown: '正确的积',
      steps: [
        {
          text: `除以${a}得到${q}，说明原来的数是${q}个${a}相加：${q}×${a}=${x}`,
          kp: '3A-MUL-1',
          expr: `${q}*${a}`,
          result: x,
        },
        {
          text: `正确的积：${x}×${a}=${correct}`,
          kp: '3A-MUL-1',
          expr: `${x}*${a}`,
          result: correct,
        },
        {
          text: `验算：${x}÷${a}=${q}，和题面的商一样`,
          kp: '3A-DIV-1',
          expr: `${x}/${a}`,
          result: q,
        },
      ],
      answer: String(correct),
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    if (variant === 'factor') {
      const b = num(p, 'b')
      const wrong = num(p, 'wrong')
      // 独立路径：不用除法，逐个试乘找出原来的数
      for (let x = 1; x <= 99; x++) if (x * b === wrong) return x * a
      throw new Error('试乘找不到原来的数')
    }
    const q = num(p, 'q')
    // 独立路径：用连加还原和求积，而不是直接背口诀
    let x = 0
    for (let index = 0; index < a; index++) x += q
    let correct = 0
    for (let index = 0; index < a; index++) correct += x
    return correct
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    if (a < 2 || a > 9) return `乘数 ${a} 超出 2–9`
    if (variant === 'factor') {
      const b = num(p, 'b')
      const x = num(p, 'x')
      if (b < 2 || b > 9) return `看错的乘数 ${b} 超出 2–9`
      if (a === b) return '看错前后是同一个乘数，题目无意义'
      if (x < 11 || x > 29) return '原来的数超出两位数范围'
      if (x * b !== num(p, 'wrong')) return '错算的积与参数不符'
      if (x * a !== num(p, 'correct')) return '正确的积与参数不符'
      return null
    }
    const q = num(p, 'q')
    if (q < 2 || q > 9) return `商 ${q} 超出 2–9`
    if (q * a !== num(p, 'x')) return '商乘除数还原不出原数'
    if (num(p, 'x') * a !== num(p, 'correct')) return '正确的积与参数不符'
    if (num(p, 'correct') > 999) return '正确的积超过三位数'
    return null
  },
}

/**
 * 积的位数：一位数乘两位数，反求“积是两位数时最大能填几 / 积是三位数时最小填几”。
 * 两条路径：试乘枚举 vs 99÷a、100÷a 的除法估算。
 */
const dDigitCount = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['two-digit-max', 'three-digit-min'] as const)
    const a = randInt(rng, 2, 9)
    if (variant === 'two-digit-max') {
      const m = Math.floor(99 / a)
      if (m < 10) return null
      return { variant, a, m, product: a * m }
    }
    const m = Math.ceil(100 / a)
    if (m > 99) return null
    if (a * m > 999) return null
    return { variant, a, m, product: a * m }
  })

const digitCount: AdvancedCategory = {
  id: 'adv-digit-count',
  label: '积的位数',
  tier: 'T2',
  units: ['3A-U2'],
  primaryKp: '3A-MUL-1',
  kpKeys: ['3A-MUL-1', '3A-DIV-1', '3A-DIV-REMAINDER', '3A-STRATEGY', '3A-ADD-SUB'],
  sample: '一个数乘8，积是两位数，这个数最大是几？',
  pool: '2 个变体（积两位数求最大、积三位数求最小）× 乘数 2–9',
  workLines: 4,
  variantCount: 2,
  draw: dDigitCount,
  stem: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    return variant === 'two-digit-max'
      ? `一个数乘${a}，积是两位数，这个数最大是几？`
      : `一个数乘${a}，积是三位数，这个数最小是几？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const m = num(p, 'm')
    if (variant === 'two-digit-max') {
      const q = Math.floor(99 / a)
      const r = 99 % a
      return {
        known: [`乘${a}`, '积是两位数'],
        unknown: '这个数最大是几',
        steps: [
          {
            text: `先试乘：${a}×${q}=${a * q} 还是两位数，这个数再加1，积就满三位数了`,
            kp: '3A-STRATEGY',
            expr: `${a}*${q}`,
            result: a * q,
          },
          {
            text:
              r > 0
                ? `用除法找上限：99÷${a}=${q}……${r}，所以最大只能填${q}`
                : `用除法找上限：99÷${a}=${q}，正好整除，所以最大能填${q}`,
            kp: '3A-DIV-REMAINDER',
            expr: `${99 - r}/${a}`,
            result: q,
          },
          {
            text: `验算：${a}×${m}=${a * m} 是两位数；${a}×${m + 1}=${a * (m + 1)} 已经是三位数`,
            kp: '3A-MUL-1',
            expr: `${a}*${m + 1}`,
            result: a * (m + 1),
          },
        ],
        answer: String(m),
      }
    }
    const q = Math.floor(100 / a)
    const r = 100 % a
    return {
      known: [`乘${a}`, '积是三位数'],
      unknown: '这个数最小是几',
      steps: [
        {
          text:
            r > 0
              ? `100÷${a}=${q}……${r}，说明这个数填${q}时积还不到100`
              : `100÷${a}=${q}，${a}×${q}=100，正好是三位数`,
          kp: '3A-DIV-REMAINDER',
          expr: r > 0 ? `${a}*${q}` : `100/${a}`,
          result: r > 0 ? a * q : q,
        },
        {
          text: r > 0 ? `这个数还要再大1：${q}+1=${m}` : `所以这个数最小是${m}`,
          kp: '3A-ADD-SUB',
          ...(r > 0 ? { expr: `${q}+1`, result: m } : {}),
        },
        {
          text: `验算：${a}×${m}=${a * m} 是三位数；${a}×${m - 1}=${a * (m - 1)} 还是两位数`,
          kp: '3A-MUL-1',
          expr: `${a}*${m - 1}`,
          result: a * (m - 1),
        },
      ],
      answer: String(m),
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    // 独立路径：从小到大逐个试乘，不借用除法
    if (variant === 'two-digit-max') {
      let m = 10
      while (a * (m + 1) <= 99) m++
      return m
    }
    let m = 10
    while (a * m < 100) m++
    return m
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const m = num(p, 'm')
    if (a < 2 || a > 9) return `乘数 ${a} 超出 2–9`
    if (variant === 'two-digit-max') {
      if (m !== Math.floor(99 / a)) return '最大值不是 99 除以乘数的整数商'
      if (m < 10 || m > 99) return '这个数不是两位数'
      if (a * m > 99) return '积已经是三位数'
      if (a * (m + 1) < 100) return '再乘一个仍然是两位数，没取到最大'
      return null
    }
    if (m !== Math.ceil(100 / a)) return '最小值不是 100 除以乘数向上取整'
    if (m < 10 || m > 99) return '这个数不是两位数'
    if (a * m < 100) return '积还不是三位数'
    if (a * (m - 1) >= 100) return '再少一个仍是三位数，没取到最小'
    return null
  },
}

// ---------- P1 第二批：倍数问题 / 抽屉原理 / 算式谜 / 时刻反求 / 路线长度 ----------

const clockText = (minutes: number): string => timeText(Math.floor(minutes / 60), minutes % 60)

/**
 * 倍数问题（和倍、差倍）：把小数看作 1 份，大数就是 k 份。
 * 两条路径：公式（和÷(k+1)、差÷(k−1)）vs 从小到大枚举小数，确认解唯一。
 */
const dMultiple = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['sum', 'diff'] as const)
    const k = randInt(rng, 2, 6)
    const small = randInt(rng, 3, 20)
    const big = small * k
    if (big > 99) return null
    if (variant === 'sum') {
      const sum = small + big
      if (sum > 100) return null
      return { variant, k, small, big, sum }
    }
    // 2 倍时“差”正好等于小数本身，太薄；差倍只出 3–6 倍
    if (k < 3) return null
    const diff = big - small
    if (diff > 80) return null
    return { variant, k, small, big, diff }
  })

const multiple: AdvancedCategory = {
  id: 'adv-multiple',
  label: '倍数问题',
  tier: 'T2',
  units: ['3A-U4'],
  primaryKp: '3A-MUL-1',
  kpKeys: ['3A-MUL-1', '3A-DIV-1', '3A-TWO-STEP', '3A-ADD-SUB'],
  sample: '小丽和妈妈一共折了24只纸鹤，妈妈折的只数是小丽的3倍。两人各折了多少只？',
  pool: '2 个变体（和倍、差倍）× 倍数 2–6 × 小数 3–20',
  workLines: 4,
  variantCount: 2,
  draw: dMultiple,
  stem: (p) =>
    str(p, 'variant') === 'sum'
      ? `小丽和妈妈一共折了${num(p, 'sum')}只纸鹤，妈妈折的只数是小丽的${num(p, 'k')}倍。小丽折了多少只？妈妈折了多少只？`
      : `妈妈折的纸鹤比小丽多${num(p, 'diff')}只，妈妈折的只数是小丽的${num(p, 'k')}倍。小丽折了多少只？妈妈折了多少只？`,
  build: (p) => {
    const variant = str(p, 'variant')
    const k = num(p, 'k')
    const small = num(p, 'small')
    const big = num(p, 'big')
    if (variant === 'sum') {
      const sum = num(p, 'sum')
      return {
        known: [`两人一共${sum}只`, `妈妈是小丽的${k}倍`],
        unknown: '两人各折了多少只',
        steps: [
          {
            text: `把小丽折的只数看作1份，妈妈就是${k}份，合起来${k}+1=${k + 1}份`,
            kp: '3A-TWO-STEP',
            expr: `${k}+1`,
            result: k + 1,
          },
          {
            text: `1份是：${sum}÷(${k}+1)=${small}（只），就是小丽折的只数`,
            kp: '3A-DIV-1',
            expr: `${sum}/(${k}+1)`,
            result: small,
          },
          {
            text: `妈妈折的只数：${small}×${k}=${big}（只）`,
            kp: '3A-MUL-1',
            expr: `${small}*${k}`,
            result: big,
          },
          {
            text: `验算：${small}+${big}=${sum}（只），正好是两人一共折的只数`,
            kp: '3A-ADD-SUB',
            expr: `${small}+${big}`,
            result: sum,
          },
        ],
        answer: `小丽${small}只，妈妈${big}只`,
      }
    }
    const diff = num(p, 'diff')
    return {
      known: [`妈妈比小丽多${diff}只`, `妈妈是小丽的${k}倍`],
      unknown: '两人各折了多少只',
      steps: [
        {
          text: `把小丽折的只数看作1份，妈妈就是${k}份，比小丽多${k}-1=${k - 1}份`,
          kp: '3A-TWO-STEP',
          expr: `${k}-1`,
          result: k - 1,
        },
        {
          text: `这${k - 1}份就是多出来的${diff}只，1份是：${diff}÷(${k}-1)=${small}（只）`,
          kp: '3A-DIV-1',
          expr: `${diff}/(${k}-1)`,
          result: small,
        },
        {
          text: `妈妈折的只数：${small}×${k}=${big}（只）`,
          kp: '3A-MUL-1',
          expr: `${small}*${k}`,
          result: big,
        },
        {
          text: `验算：${big}-${small}=${diff}（只），正好是妈妈比小丽多的只数`,
          kp: '3A-ADD-SUB',
          expr: `${big}-${small}`,
          result: diff,
        },
      ],
      answer: `小丽${small}只，妈妈${big}只`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const k = num(p, 'k')
    const target = num(p, variant === 'sum' ? 'sum' : 'diff')
    // 独立路径：不套公式，从小到大枚举小丽的只数，看能有几组满足条件
    const hits: number[] = []
    for (let small = 1; small <= 99; small++) {
      const big = small * k
      const ok = variant === 'sum' ? small + big === target : big - small === target
      if (ok) hits.push(small)
    }
    if (hits.length !== 1) throw new Error(`满足条件的只数不唯一：${hits.join('、')}`)
    const small = hits[0]!
    return `小丽${small}只，妈妈${small * k}只`
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const k = num(p, 'k')
    const small = num(p, 'small')
    const big = num(p, 'big')
    if (k < 2 || k > 6) return `倍数 ${k} 超出 2–6`
    if (small < 3 || small > 20) return `小数 ${small} 超出 3–20`
    if (big !== small * k) return '大数不是小数的整数倍'
    if (big > 99) return '大数超过两位数'
    if (variant === 'sum') {
      const sum = num(p, 'sum')
      if (sum !== small + big) return '一共的只数与两份之和不符'
      if (sum > 100) return '一共的只数超过100'
      return null
    }
    if (k < 3) return '差倍的倍数至少是3'
    const diff = num(p, 'diff')
    if (diff !== big - small) return '多出来的只数与两份之差不符'
    if (diff > 80) return '多出来的只数超过80'
    return null
  },
}

/**
 * 抽屉原理直观版：n 件东西放进 m 个抽屉，总有一个抽屉至少放 ceil(n/m) 件。
 * 两条路径：有余数除法（q 余 r → q+1）vs 不等式搜索 / 最坏情况累加。
 */
const dPigeonhole = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['forward', 'backward'] as const)
    if (variant === 'forward') {
      const m = randInt(rng, 3, 6)
      const q = randInt(rng, 2, 9)
      const r = randInt(rng, 1, m - 1)
      const n = m * q + r
      if (n > 60) return null
      return { variant, n, m, q, r, atLeast: q + 1 }
    }
    const k = randInt(rng, 2, 3)
    const m = randInt(rng, 2, 6)
    const need = m * (k - 1) + 1
    if (need > 20) return null
    return { variant, k, m, need }
  })

const pigeonhole: AdvancedCategory = {
  id: 'adv-pigeonhole',
  label: '抽屉原理',
  tier: 'T2',
  units: ['3A-U4'],
  primaryKp: '3A-STRATEGY',
  kpKeys: ['3A-STRATEGY', '3A-DIV-REMAINDER', '3A-MUL-1', '3A-ADD-SUB'],
  sample: '把7支铅笔放进3个笔筒，不管怎么放，总有一个笔筒里至少放几支铅笔？',
  pool: '2 个变体（正推至少几支、反推至少摸几只）× 抽屉 2–6 × 商 2–9',
  workLines: 4,
  variantCount: 2,
  maxPerPaper: 1,
  draw: dPigeonhole,
  stem: (p) =>
    str(p, 'variant') === 'forward'
      ? `把${num(p, 'n')}支铅笔放进${num(p, 'm')}个笔筒里，不管怎么放，总有一个笔筒里至少放了几支铅笔？`
      : `一个袋子里有${num(p, 'm')}种颜色的袜子，每种颜色的袜子都很多。闭上眼睛摸袜子，至少摸出几只，才能保证有${num(p, 'k')}只袜子颜色相同？`,
  build: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'forward') {
      const n = num(p, 'n')
      const m = num(p, 'm')
      const q = num(p, 'q')
      const r = num(p, 'r')
      const atLeast = num(p, 'atLeast')
      return {
        known: [`${n}支铅笔`, `${m}个笔筒`],
        unknown: '总有一个笔筒至少放几支',
        steps: [
          {
            text: `先让每个笔筒都放${q}支：${m}×${q}=${m * q}（支）`,
            kp: '3A-MUL-1',
            expr: `${m}*${q}`,
            result: m * q,
          },
          {
            text: `还剩${n}-${m * q}=${r}（支），这${r}支不管放进哪个笔筒，那个笔筒就有${q}+1=${atLeast}（支）`,
            kp: '3A-DIV-REMAINDER',
            expr: `${n}-${m * q}`,
            result: r,
          },
          {
            text: `所以总有一个笔筒至少放${atLeast}支，也就是${n}÷${m}=${q}……${r}，商加1`,
            kp: '3A-STRATEGY',
            expr: `${q}+1`,
            result: atLeast,
          },
          {
            text: `验算：如果每个笔筒都不超过${q}支，${m}个笔筒最多放${m}×${q}=${m * q}（支），装不下${n}支`,
            kp: '3A-STRATEGY',
            expr: `${m}*${q}`,
            result: m * q,
          },
        ],
        answer: `${atLeast}支`,
      }
    }
    const k = num(p, 'k')
    const m = num(p, 'm')
    const need = num(p, 'need')
    const worst = m * (k - 1)
    return {
      known: [`${m}种颜色`, `每种颜色都很多`],
      unknown: `至少摸出几只，才能保证有${k}只同色`,
      steps: [
        {
          text: `最不凑巧的情况：每种颜色都先摸到${k - 1}只，${m}种颜色一共${m}×(${k}-1)=${worst}（只）`,
          kp: '3A-MUL-1',
          expr: `${m}*(${k}-1)`,
          result: worst,
        },
        {
          text: `这时还凑不出${k}只同色，再多摸1只，一定有${k}只颜色相同：${worst}+1=${need}（只）`,
          kp: '3A-ADD-SUB',
          expr: `${worst}+1`,
          result: need,
        },
        {
          text: `所以至少摸${need}只`,
          kp: '3A-STRATEGY',
        },
        {
          text: `验算：摸${need - 1}只时，正好${m}种颜色各${k - 1}只，没有${k}只同色，说明${need - 1}只不够`,
          kp: '3A-STRATEGY',
          expr: `${m}*(${k}-1)`,
          result: worst,
        },
      ],
      answer: `${need}只`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'forward') {
      const n = num(p, 'n')
      const m = num(p, 'm')
      // 独立路径：不用除法，从 1 往上找“每个抽屉最多 t 支就装得下”的最小 t
      let t = 1
      while (m * t < n) t++
      return `${t}支`
    }
    const k = num(p, 'k')
    const m = num(p, 'm')
    // 独立路径：把最坏情况一份一份加上去，再多加 1 只
    let worst = 0
    for (let index = 0; index < m; index++) worst += k - 1
    if (worst !== m * (k - 1)) throw new Error('最坏情况累加与乘法不符')
    return `${worst + 1}只`
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'forward') {
      const n = num(p, 'n')
      const m = num(p, 'm')
      const q = num(p, 'q')
      const r = num(p, 'r')
      if (m < 3 || m > 6) return `抽屉数 ${m} 超出 3–6`
      if (q < 2 || q > 9) return `商 ${q} 超出 2–9`
      if (r < 1 || r > m - 1) return `余数 ${r} 不在 1–${m - 1}`
      if (n !== m * q + r) return '总数与商、余数不符'
      if (n > 60) return '总数超过60，心算太累'
      if (num(p, 'atLeast') !== q + 1) return '至少放的支数不是商加1'
      return null
    }
    const k = num(p, 'k')
    const m = num(p, 'm')
    const need = num(p, 'need')
    if (k < 2 || k > 3) return `同色只数 ${k} 超出 2–3`
    if (m < 2 || m > 6) return `颜色数 ${m} 超出 2–6`
    if (need !== m * (k - 1) + 1) return '保证摸出的只数不是 m×(k−1)+1'
    if (need > 20) return '要摸的只数超过20'
    return null
  },
}

/**
 * 算式谜（只做加减填数字）：把竖式里两个数字换成 □ 和 △，按进位/退位反求。
 * 两条路径：按个位、十位逐位推理 vs 把两个图形从 0–9 全枚举，确认只有一组解。
 */
const dCryptarithm = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['add-carry', 'sub-borrow'] as const)
    if (variant === 'add-carry') {
      const b = randInt(rng, 1, 7)
      const c = randInt(rng, b + 2, 9)
      const a = randInt(rng, 2, 9)
      const d = randInt(rng, 0, a - 1)
      const box = c - b - 1
      const tri = d + 10 - a
      if (box < 1 || box > 9 || tri < 0 || tri > 9) return null
      if (box === tri) return null
      return { variant, a, b, c, d, box, tri }
    }
    const b = randInt(rng, 1, 7)
    const c = randInt(rng, 1, 7)
    const box = c + b + 1
    if (box > 9) return null
    const a = randInt(rng, 0, 8)
    const d = randInt(rng, a + 1, 9)
    const tri = a + 10 - d
    if (tri < 1 || tri > 9) return null
    if (box === tri) return null
    return { variant, a, b, c, d, box, tri }
  })

const cryptarithm: AdvancedCategory = {
  id: 'adv-cryptarithm',
  label: '算式谜',
  tier: 'T2',
  units: ['3A-U2'],
  primaryKp: '3A-ADD-SUB',
  kpKeys: ['3A-ADD-SUB', '3A-STRATEGY'],
  sample: '□7＋4△＝83，□和△各代表几？',
  pool: '2 个变体（加法进位、减法退位）× 各位数字 0–9',
  workLines: 4,
  variantCount: 2,
  maxPerPaper: 1,
  draw: dCryptarithm,
  stem: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const b = num(p, 'b')
    const c = num(p, 'c')
    const d = num(p, 'd')
    const sign = variant === 'add-carry' ? '＋' : '－'
    return (
      '下面的算式中，相同的图形代表相同的数字，不同的图形代表不同的数字，首位不能是0：' +
      `□${a}${sign}${b}△＝${c}${d}。□和△各代表几？`
    )
  },
  build: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const b = num(p, 'b')
    const c = num(p, 'c')
    const d = num(p, 'd')
    const box = num(p, 'box')
    const tri = num(p, 'tri')
    if (variant === 'add-carry') {
      return {
        known: [`□${a}＋${b}△＝${c}${d}`],
        unknown: '□和△各代表几',
        steps: [
          {
            text: `先看个位：${a}加△要写${d}，说明满10向十位进1，△=${d}+10-${a}=${tri}`,
            kp: '3A-ADD-SUB',
            expr: `${d}+10-${a}`,
            result: tri,
          },
          {
            text: `再看十位：□加${b}，再加上进位的1，得${c}，□=${c}-${b}-1=${box}`,
            kp: '3A-ADD-SUB',
            expr: `${c}-${b}-1`,
            result: box,
          },
          {
            text: `验算：把图形换回数字，${box}${a}＋${b}${tri}就是${box * 10 + a}＋${b * 10 + tri}=${c * 10 + d}`,
            kp: '3A-ADD-SUB',
            expr: `${box * 10 + a}+${b * 10 + tri}`,
            result: c * 10 + d,
          },
          {
            text: `换个数字试试：个位换成别的数就凑不出${d}，十位换成别的数也凑不出${c}，所以只有这一组`,
            kp: '3A-STRATEGY',
          },
        ],
        answer: `□=${box}，△=${tri}`,
      }
    }
    return {
      known: [`□${a}－${b}△＝${c}${d}`],
      unknown: '□和△各代表几',
      steps: [
        {
          text: `先看个位：${a}不够减△，要向十位借1，${a}+10-△=${d}，所以△=${a}+10-${d}=${tri}`,
          kp: '3A-ADD-SUB',
          expr: `${a}+10-${d}`,
          result: tri,
        },
        {
          text: `再看十位：□借走1后减去${b}得${c}，□=${c}+${b}+1=${box}`,
          kp: '3A-ADD-SUB',
          expr: `${c}+${b}+1`,
          result: box,
        },
        {
          text: `验算：把图形换回数字，${box}${a}－${b}${tri}就是${box * 10 + a}-${b * 10 + tri}=${c * 10 + d}`,
          kp: '3A-ADD-SUB',
          expr: `${box * 10 + a}-${b * 10 + tri}`,
          result: c * 10 + d,
        },
        {
          text: `换个数字试试：个位换成别的数就凑不出${d}，十位换成别的数也凑不出${c}，所以只有这一组`,
          kp: '3A-STRATEGY',
        },
      ],
      answer: `□=${box}，△=${tri}`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const b = num(p, 'b')
    const c = num(p, 'c')
    const d = num(p, 'd')
    // 独立路径：不按数位推理，把两个图形 0–9 全枚举，筛出满足算式的组合
    const hits: string[] = []
    for (let box = 1; box <= 9; box++) {
      for (let tri = 0; tri <= 9; tri++) {
        if (box === tri) continue
        const left = box * 10 + a
        const right = b * 10 + tri
        const total = variant === 'add-carry' ? left + right : left - right
        if (total === c * 10 + d) hits.push(`□=${box}，△=${tri}`)
      }
    }
    if (hits.length !== 1) throw new Error(`算式谜解不唯一：${hits.join('；')}`)
    return hits[0]!
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const a = num(p, 'a')
    const b = num(p, 'b')
    const c = num(p, 'c')
    const d = num(p, 'd')
    const box = num(p, 'box')
    const tri = num(p, 'tri')
    for (const [name, value] of [['a', a], ['b', b], ['c', c], ['d', d]] as const) {
      if (value < 0 || value > 9) return `${name}=${value} 不是一位数字`
    }
    if (b < 1) return '十位上的已知数字不能是0'
    if (c < 1) return '结果的十位不能是0'
    if (box < 1 || box > 9) return `□=${box} 不是首位上的有效数字`
    if (tri < 0 || tri > 9) return `△=${tri} 不是一位数字`
    if (box === tri) return '□和△代表不同的数字，不能相同'
    if (variant === 'add-carry') {
      if (a + tri < 10) return '加法个位没有进位，题目失去进位推理'
      if (tri !== d + 10 - a) return '△不是由个位进位推出来的'
      if (box !== c - b - 1) return '□不是由十位加进位推出来的'
      if (box + b + 1 !== c) return '十位相加得不到结果的十位'
      return null
    }
    if (a >= tri) return '减法个位没有退位，题目失去退位推理'
    if (tri !== a + 10 - d) return '△不是由个位退位推出来的'
    if (box !== c + b + 1) return '□不是由十位退位推出来的'
    if (box - 1 - b !== c) return '十位相减得不到结果的十位'
    return null
  },
}

/**
 * 时刻反求与中途休息：给两端时刻与其中一段，求另一段。
 * 两条路径：时分拆分（借1小时=60分）vs 从某一刻起逐分钟走。
 */
const dTimeReverse = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['start-reverse', 'duration-with-break', 'break-length'] as const)
    if (variant === 'start-reverse') {
      const endMin = randInt(rng, 96, 168) * 5
      const busyMin = randInt(rng, 6, 18) * 5
      const startMin = endMin - busyMin
      if (startMin < 7 * 60) return null
      return { variant, startMin, endMin, busyMin, breakMin: 0 }
    }
    const startMin = randInt(rng, 84, 150) * 5
    const busyMin = randInt(rng, 6, 18) * 5
    const breakMin = randInt(rng, 2, 8) * 5
    const endMin = startMin + busyMin + breakMin
    if (endMin > 16 * 60) return null
    return { variant, startMin, endMin, busyMin, breakMin }
  })

const timeReverse: AdvancedCategory = {
  id: 'adv-time-reverse',
  label: '时刻反求与中途休息',
  tier: 'T2',
  units: ['3A-U5'],
  primaryKp: '3A-TIME-ELAPSED',
  kpKeys: ['3A-TIME-ELAPSED', '3A-ADD-SUB'],
  sample: '小华9时5分做完作业，做作业一共用了40分钟。他是什么时候开始做作业的？',
  pool: '3 个变体（反求开始时刻、含休息求实际用时、含休息求休息时长）× 5 分钟步进',
  workLines: 4,
  variantCount: 3,
  draw: dTimeReverse,
  stem: (p) => {
    const variant = str(p, 'variant')
    const startText = clockText(num(p, 'startMin'))
    const endText = clockText(num(p, 'endMin'))
    const busyText = durationText(num(p, 'busyMin'))
    if (variant === 'start-reverse') {
      return `小华${endText}做完作业，做作业一共用了${busyText}。他是什么时候开始做作业的？`
    }
    if (variant === 'duration-with-break') {
      return `小丽${startText}开始练琴，${endText}练完。中间休息了${durationText(num(p, 'breakMin'))}，她实际练了多长时间？`
    }
    return `小刚${startText}开始读书，${endText}读完，中间一共读了${busyText}，剩下的时间在休息。他休息了多长时间？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    const startMin = num(p, 'startMin')
    const endMin = num(p, 'endMin')
    const busyMin = num(p, 'busyMin')
    const breakMin = num(p, 'breakMin')
    const startText = clockText(startMin)
    const endText = clockText(endMin)
    if (variant === 'start-reverse') {
      const eh = Math.floor(endMin / 60)
      const em = endMin % 60
      const busyHours = Math.floor(busyMin / 60)
      const busyRest = busyMin % 60
      const steps: AdvancedStep[] = []
      if (busyRest > 0) {
        const borrowed = em < busyRest
        steps.push({
          text: borrowed
            ? `分钟不够退：${endText}向小时借1，${em}+60-${busyRest}=${em + 60 - busyRest}（分）`
            : `先从${endText}往回退${busyRest}分钟，到${clockText(endMin - busyRest)}`,
          kp: borrowed ? '3A-ADD-SUB' : '3A-TIME-ELAPSED',
          expr: borrowed ? `${em}+60-${busyRest}` : `${em}-${busyRest}`,
          result: borrowed ? em + 60 - busyRest : em - busyRest,
        })
      }
      if (busyHours > 0) {
        const borrowed = busyRest > 0 && em < busyRest ? 1 : 0
        steps.push({
          text: borrowed
            ? `小时再往回退：${eh}时借走1小时，还要退${busyHours}小时，到${clockText(startMin)}`
            : `再往回退${busyHours}小时，到${clockText(startMin)}`,
          kp: '3A-TIME-ELAPSED',
          expr: borrowed ? `${eh}-1-${busyHours}` : `${eh}-${busyHours}`,
          result: Math.floor(startMin / 60),
        })
      }
      steps.push({ text: `所以开始做作业的时刻是${startText}`, kp: '3A-TIME-ELAPSED' })
      steps.push({
        text: `验算：从${startText}到${endText}，正好经过${durationText(busyMin)}`,
        kp: '3A-TIME-ELAPSED',
        expr: `${endMin}-${startMin}`,
        result: busyMin,
      })
      return {
        known: [`${endText}做完`, `一共用了${durationText(busyMin)}`],
        unknown: '开始做作业的时刻',
        steps,
        answer: startText,
      }
    }
    const grossMin = endMin - startMin
    const grossText = durationText(grossMin)
    const busyText = durationText(busyMin)
    const breakText = durationText(breakMin)
    return {
      known: [`${startText}开始`, `${endText}结束`],
      unknown: variant === 'duration-with-break' ? '实际练习了多长时间' : '休息了多长时间',
      steps: [
        {
          text: `从${startText}到${endText}，一共经过了${grossText}`,
          kp: '3A-TIME-ELAPSED',
          expr: `${endMin}-${startMin}`,
          result: grossMin,
        },
        {
          text:
            variant === 'duration-with-break'
              ? `休息的${breakText}不算，${grossText}减去${breakText}，实际练了${busyText}`
              : `读书的${busyText}不算休息，${grossText}减去${busyText}，休息了${breakText}`,
          kp: '3A-TIME-ELAPSED',
          expr:
            variant === 'duration-with-break'
              ? `${grossMin}-${breakMin}`
              : `${grossMin}-${busyMin}`,
          result: variant === 'duration-with-break' ? busyMin : breakMin,
        },
        {
          text: `验算：${busyText}加休息${breakText}，正好是${grossText}`,
          kp: '3A-TIME-ELAPSED',
          expr: `${busyMin}+${breakMin}`,
          result: grossMin,
        },
      ],
      answer: variant === 'duration-with-break' ? busyText : breakText,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    const startMin = num(p, 'startMin')
    const endMin = num(p, 'endMin')
    if (variant === 'start-reverse') {
      // 独立路径：从结束时刻一分钟一分钟往回走
      let minute = endMin
      let left = num(p, 'busyMin')
      while (left > 0) {
        minute--
        left--
      }
      return clockText(minute)
    }
    // 独立路径：从开始时刻一分钟一分钟往前走到结束，再逐分钟扣掉休息/读书
    let minute = startMin
    let gross = 0
    while (minute < endMin) {
      minute++
      gross++
    }
    let part = variant === 'duration-with-break' ? num(p, 'breakMin') : num(p, 'busyMin')
    let rest = gross
    while (part > 0) {
      rest--
      part--
    }
    return durationText(rest)
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    const startMin = num(p, 'startMin')
    const endMin = num(p, 'endMin')
    const busyMin = num(p, 'busyMin')
    const breakMin = num(p, 'breakMin')
    if (startMin % 5 !== 0 || endMin % 5 !== 0 || busyMin % 5 !== 0 || breakMin % 5 !== 0) {
      return '时刻与时长必须是 5 分钟步进'
    }
    if (startMin < 7 * 60 || endMin > 16 * 60) return '时刻超出 7:00–16:00'
    if (endMin <= startMin) return '结束时刻必须晚于开始时刻'
    if (endMin - startMin > 180) return '经过时间超过 3 小时'
    if (variant === 'start-reverse') {
      if (breakMin !== 0) return '反求开始时刻不该有休息时长'
      if (busyMin !== endMin - startMin) return '用时与两端时刻之差不符'
      if (busyMin < 30) return '用时少于 30 分钟，题目太薄'
      return null
    }
    if (busyMin + breakMin !== endMin - startMin) return '实际用时加休息不等于两端之差'
    if (busyMin < 30) return '实际用时少于 30 分钟，题目太薄'
    if (breakMin < 10) return '休息不到 10 分钟，题目太薄'
    return null
  },
}

/**
 * 路线长度（U7 马拉松路线设计）：来回一律按 2 倍口径。
 * 三个变体：同一条路来回求总长、两段路来回求总长、知来回总长求单程。
 */
const dRoute = (rng: Rng): AdvParams | null =>
  retry((): AdvParams | null => {
    const variant = pick(rng, ['round-trip', 'two-legs-round', 'one-way-reverse'] as const)
    if (variant === 'round-trip') {
      const d = randInt(rng, 2, 9) * 50
      return { variant, d, total: 2 * d }
    }
    if (variant === 'two-legs-round') {
      const a = randInt(rng, 2, 9) * 50
      const b = randInt(rng, 1, 9) * 50
      if (a === b) return null
      if (a + b > 450) return null
      return { variant, a, b, total: 2 * (a + b) }
    }
    const total = randInt(rng, 4, 18) * 50
    return { variant, total, d: total / 2 }
  })

const route: AdvancedCategory = {
  id: 'adv-route',
  label: '路线长度',
  tier: 'T2',
  units: ['3A-U7'],
  primaryKp: '3A-ADD-SUB',
  kpKeys: ['3A-ADD-SUB', '3A-MUL-1', '3A-DIV-1', '3A-STRATEGY'],
  sample: '小华家到学校有200米。他从家走到学校，放学后沿原路回家。这一天来回一共走了多少米？',
  pool: '3 个变体（单段来回、两段来回、知来回求单程）× 每段 100–450 米',
  workLines: 4,
  variantCount: 3,
  draw: dRoute,
  stem: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'round-trip') {
      return `小华家到学校有${num(p, 'd')}米。早晨他从家走到学校，放学后沿原路回家。他这一天来回一共走了多少米？`
    }
    if (variant === 'two-legs-round') {
      return `从家到书店有${num(p, 'a')}米，从书店到学校有${num(p, 'b')}米。小丽早晨从家先到书店，再到学校；放学后沿原路回家。她这一天一共走了多少米？`
    }
    return `小刚从家到学校，来回都走同一条路，一共走了${num(p, 'total')}米。他家到学校有多少米？`
  },
  build: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'round-trip') {
      const d = num(p, 'd')
      const total = num(p, 'total')
      return {
        known: [`家到学校${d}米`, '来回沿同一条路'],
        unknown: '来回一共走了多少米',
        steps: [
          {
            text: `去一趟是${d}米，来回走的是同一条路，也就是2个${d}米`,
            kp: '3A-STRATEGY',
          },
          {
            text: `来回总长：${d}×2=${total}（米）`,
            kp: '3A-MUL-1',
            expr: `${d}*2`,
            result: total,
          },
          {
            text: `也可以把两趟加起来：${d}+${d}=${total}（米）`,
            kp: '3A-ADD-SUB',
            expr: `${d}+${d}`,
            result: total,
          },
          {
            text: `验算：${total}÷2=${d}（米），正好是家到学校的路程`,
            kp: '3A-DIV-1',
            expr: `${total}/2`,
            result: d,
          },
        ],
        answer: `${total}米`,
      }
    }
    if (variant === 'two-legs-round') {
      const a = num(p, 'a')
      const b = num(p, 'b')
      const oneWay = a + b
      const total = num(p, 'total')
      return {
        known: [`家到书店${a}米`, `书店到学校${b}米`, '来回沿原路'],
        unknown: '一天一共走了多少米',
        steps: [
          {
            text: `先去书店再到学校，一趟是${a}+${b}=${oneWay}（米）`,
            kp: '3A-ADD-SUB',
            expr: `${a}+${b}`,
            result: oneWay,
          },
          {
            text: `沿原路回家又是一趟${oneWay}米，来回一共是2个${oneWay}米`,
            kp: '3A-STRATEGY',
          },
          {
            text: `来回总长：${oneWay}×2=${total}（米）`,
            kp: '3A-MUL-1',
            expr: `${oneWay}*2`,
            result: total,
          },
          {
            text: `验算：${total}÷2=${oneWay}（米），正好是一趟的路程`,
            kp: '3A-DIV-1',
            expr: `${total}/2`,
            result: oneWay,
          },
        ],
        answer: `${total}米`,
      }
    }
    const total = num(p, 'total')
    const d = num(p, 'd')
    return {
      known: [`来回一共${total}米`, '来回沿同一条路'],
      unknown: '家到学校有多少米',
      steps: [
        {
          text: `来回走的是同一条路，来回总长就是单程的2倍`,
          kp: '3A-STRATEGY',
        },
        {
          text: `单程：${total}÷2=${d}（米）`,
          kp: '3A-DIV-1',
          expr: `${total}/2`,
          result: d,
        },
        {
          text: `验算：${d}×2=${total}（米），正好是来回总长`,
          kp: '3A-MUL-1',
          expr: `${d}*2`,
          result: total,
        },
      ],
      answer: `${d}米`,
    }
  },
  recompute: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'round-trip') {
      const d = num(p, 'd')
      const parts = [d, d]
      let sum = 0
      for (const part of parts) sum += part
      return `${sum}米`
    }
    if (variant === 'two-legs-round') {
      const a = num(p, 'a')
      const b = num(p, 'b')
      const parts = [a, b, b, a]
      let sum = 0
      for (const part of parts) sum += part
      return `${sum}米`
    }
    const total = num(p, 'total')
    // 独立路径：不用除法，从 1 往上找“单程×2 正好等于来回总长”
    let oneWay = 1
    while (oneWay * 2 < total) oneWay++
    if (oneWay * 2 !== total) throw new Error('来回总长不是单程的2倍')
    return `${oneWay}米`
  },
  invariant: (p) => {
    const variant = str(p, 'variant')
    if (variant === 'round-trip') {
      const d = num(p, 'd')
      const total = num(p, 'total')
      if (d < 100 || d > 450) return `单程 ${d} 米超出 100–450`
      if (d % 50 !== 0) return '单程不是 50 米的整倍数'
      if (total !== 2 * d) return '来回总长不是单程的2倍'
      if (total > 900) return '来回总长超过900米'
      return null
    }
    if (variant === 'two-legs-round') {
      const a = num(p, 'a')
      const b = num(p, 'b')
      const total = num(p, 'total')
      if (a < 100 || a > 450 || b < 50 || b > 450) return '单段路程超出范围'
      if (a % 50 !== 0 || b % 50 !== 0) return '单段路程不是 50 米的整倍数'
      if (a === b) return '两段一样长，退化成单段来回'
      if (total !== 2 * (a + b)) return '来回总长不是一趟的2倍'
      if (total > 900) return '来回总长超过900米'
      return null
    }
    const total = num(p, 'total')
    const d = num(p, 'd')
    if (total < 200 || total > 900) return `来回总长 ${total} 米超出 200–900`
    if (total % 2 !== 0) return '来回总长不是偶数，单程不是整米'
    if (d !== total / 2) return '单程不是来回总长的一半'
    if (d < 100 || d > 450) return `单程 ${d} 米超出 100–450`
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
  reshape,
  calendarCard,
  misread,
  digitCount,
  multiple,
  pigeonhole,
  cryptarithm,
  timeReverse,
  route,
]

export const advancedCategory = (id: string): AdvancedCategory | undefined =>
  ADV_CATEGORIES.find((category) => category.id === id)

// ---------- 难度档与单元映射 ----------

const LEVEL_TIER: Record<Level, AdvancedTier> = { L1: 'T1', L2: 'T2', L3: 'T3' }

/** 每个基础档位默认可出现的难度层：低档题可下探到上一档，避免单单元只剩一类 */
const LEVELS_BY_TIER: Record<AdvancedTier, Level[]> = {
  T1: ['L1', 'L2'],
  T2: ['L2', 'L3'],
  T3: ['L3'],
}

const TIER_RANK: Record<AdvancedTier, number> = { T1: 1, T2: 2, T3: 3 }

export const tierForLevel = (level: Level): AdvancedTier => LEVEL_TIER[level]

export const levelForTier = (tier: AdvancedTier): Level =>
  tier === 'T1' ? 'L1' : tier === 'T2' ? 'L2' : 'L3'

/** 类别可出现的难度层；新增类别可用 levels 覆盖默认映射 */
export const categoryLevels = (category: AdvancedCategory): Level[] =>
  category.levels ?? LEVELS_BY_TIER[category.tier]

/** 低一档的类别只作补充，不进主力 */
export const isSupplementCategory = (category: AdvancedCategory, level: Level): boolean =>
  TIER_RANK[category.tier] < TIER_RANK[LEVEL_TIER[level]]

export function advancedCategoriesFor(level: Level, unitIds: string[]): AdvancedCategory[] {
  const selected = new Set(unitIds)
  return ADV_CATEGORIES.filter(
    (category) =>
      categoryLevels(category).includes(level) &&
      category.units.some((unitId) => selected.has(unitId)),
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

/** 同卷"同模板同变体"判定：同类别且同变体只允许出现 1 次，换数字不算新题 */
export function advancedStructureKey(categoryId: string, params: AdvParams): string {
  return `${categoryId}:${String(params.variant ?? '')}`
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
  if (!categoryLevels(category).includes(record.level)) {
    issues.push(`类别 ${category.id} 不支持 level ${record.level}`)
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

function makeCandidate(
  category: AdvancedCategory,
  params: AdvParams,
  unitId: string,
  level: Level,
): Candidate | null {
  try {
    const built = category.build(params)
    const stem = category.stem(params)
    const record: AdvancedRecord = {
      categoryId: category.id,
      tier: category.tier,
      level,
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

/** 单元指纹：同一 seed 下换单元必须换题；与单元顺序无关 */
const unitFingerprint = (unitIds: string[]): number => {
  let hash = 0
  for (const unitId of unitIds) {
    for (let index = 0; index < unitId.length; index++) {
      hash = (hash * 31 + unitId.charCodeAt(index)) % 1000003
    }
  }
  return hash
}

export function generateAdvanced(options: GenerateAdvancedOptions): AdvancedResult {
  const { grade, level, count } = options
  // 统一排序：同一组单元不因传入顺序不同而换题
  const unitIds = [...new Set(options.unitIds)].sort()
  const seed = (options.seed ?? 20260101) + unitFingerprint(unitIds)
  const memory = options.memory
  const questions: AdvancedQuestion[] = []
  const notes: string[] = []
  if (!Number.isInteger(count) || count <= 0) return { questions, notes, crossReused: 0 }
  if (grade !== '3A') {
    return { questions, notes: ['拓展题：本版只覆盖三年级上册'], crossReused: 0 }
  }

  const categories = advancedCategoriesFor(level, unitIds)
  if (categories.length === 0) {
    const levels = advancedLevelsFor(grade, unitIds)
    return {
      questions,
      notes: [
        `拓展题：所选单元在 ${level}（${tierForLevel(level)}）没有可用类别${
          levels.length > 0 ? `，可切到 ${levels.join('/')}` : ''
        }（现有类别：${ADV_CATEGORIES.map((category) => `${category.tier} ${category.label}`).join('；')}）`,
      ],
      crossReused: 0,
    }
  }

  const rng = createRng(seed + 3313)
  const seen = new Set<string>()
  const structureSeen = new Set<string>()
  const unitCounts = new Map<string, number>()
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
    structureSeen.add(advancedStructureKey(category.id, candidate.params))
    unitCounts.set(candidate.unitId, (unitCounts.get(candidate.unitId) ?? 0) + 1)
    options.sourceUsed?.add(candidate.key)
    memory?.record(candidate.key)
    if (reused) crossReused++
  }

  /** 单元轮转：优先补零题单元，其余按已出题量最少者优先 */
  const chooseUnit = (eligible: string[], preferredUnit?: string): string => {
    if (preferredUnit != null && eligible.includes(preferredUnit)) return preferredUnit
    const rotated = shuffle(rng, eligible)
    return rotated.reduce(
      (best, current) =>
        (unitCounts.get(current) ?? 0) < (unitCounts.get(best) ?? 0) ? current : best,
      rotated[0]!,
    )
  }

  const pickCategory = (category: AdvancedCategory, preferredUnit?: string): number => {
    const eligible = category.units.filter((unitId) => unitIds.includes(unitId))
    if (eligible.length === 0) return 0
    // beta 阶段：算式谜、抽屉原理每卷最多 1 道
    const limit = category.maxPerPaper ?? Number.POSITIVE_INFINITY
    const used = questions.reduce((count, question) => count + (question.categoryId === category.id ? 1 : 0), 0)
    if (used >= limit) return 0
    const budget = 1
    let added = 0
    let misses = 0
    for (let attempt = 0; attempt < 400 && added < budget && questions.length < count; attempt++) {
      if (misses > 120) break
      const params = category.draw(rng)
      if (!params) {
        misses++
        continue
      }
      const structure = advancedStructureKey(category.id, params)
      if (structureSeen.has(structure)) {
        misses++
        continue
      }
      const unitId = chooseUnit(eligible, preferredUnit)
      const candidate = makeCandidate(category, params, unitId, level)
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

  const primary = shuffle(rng, categories.filter((category) => !isSupplementCategory(category, level)))
  const supplement = shuffle(rng, categories.filter((category) => isSupplementCategory(category, level)))
  const ordered = [...primary, ...supplement]

  // 第 0 轮：每个被选单元至少落 1 题（有可用类别时）
  for (const unitId of unitIds) {
    if (questions.length >= count) break
    if ((unitCounts.get(unitId) ?? 0) > 0) continue
    for (const category of ordered) {
      if (questions.length >= count) break
      if (!category.units.includes(unitId)) continue
      if (pickCategory(category, unitId) > 0) break
    }
  }

  // 第一轮：主力档位每个类别先出 1 题；低档类别排在其后，只用来补缺口
  for (const category of ordered) {
    if (questions.length >= count) break
    pickCategory(category)
  }

  // 第二轮：还有缺口时继续尝试（同类别同变体每卷只允许 1 次，换数字不算新题）
  for (let round = 0; round < 20 && questions.length < count; round++) {
    const before = questions.length
    for (const category of shuffle(rng, ordered)) {
      if (questions.length >= count) break
      pickCategory(category)
    }
    if (questions.length === before) break
  }

  for (const candidate of stale) {
    if (questions.length >= count) break
    if (seen.has(candidate.key)) continue
    if (structureSeen.has(advancedStructureKey(candidate.category.id, candidate.params))) continue
    accept(candidate, true)
  }

  if (questions.length < count) {
    // 家长需要分清“没出满”是缺题型，还是同模板不重复的上限，不能只说“如实出 X/Y 题”
    const levelCategories = ADV_CATEGORIES.filter((category) => categoryLevels(category).includes(level))
    const missing = levelCategories.filter((category) => !categories.includes(category))
    const scope = unitIds.length > 1 ? `所选 ${unitIds.length} 个单元` : '本单元'
    const availableText = `拓展题：${scope}该档目前只有 ${categories.length} 类（${categories
      .map((category) => category.label)
      .join('、')}），实际可用 ${structureSeen.size} 种结构`
    const missingText =
      missing.length > 0
        ? `；本档另有 ${missing.length} 类（${missing.map((category) => category.label).join('、')}）没有映射到${scope}`
        : '；本档题型已全部映射到当前单元，再想多出只能加新结构'
    notes.push(
      `${availableText}${missingText}。受“同模板同变体不重复”限制，只能如实出 ${questions.length}/${count} 题，不用换数字的重复题凑数`,
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
