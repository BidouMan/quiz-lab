import { QUESTIONS } from '../data/questions'
import type { Question } from '../types'
import type {
  AppType,
  BuildResult,
  FillPart,
  Grade,
  TypstItem,
  TypstPaperData,
  TypstSection,
} from './types'

/**
 * 题库 → Typst JSON。
 * 换算思路与 typst/gen-data.mjs 一致（LaTeX → Typst 数学、填空拆段），
 * 但不 import 该脚本（typst/ 目录由另一会话维护），也不修改题库内容。
 */

interface TypeSpec {
  name: string
  numbered: boolean
  note?: string
  weight: number
  /** 题库不足时可用于补题（静态小样本不参与循环补题） */
  refillable: boolean
}

const TYPE_ORDER: AppType[] = [
  'kousuan',
  'chushi',
  'tuoshi',
  'tiankong',
  'compare',
  'geom',
  'word',
]

const SPECS: Record<AppType, TypeSpec> = {
  kousuan: { name: '口算', numbered: false, weight: 0.35, refillable: true },
  chushi: { name: '竖式计算', numbered: false, weight: 0.2, refillable: true },
  tuoshi: { name: '脱式计算', numbered: false, weight: 0.2, refillable: true },
  tiankong: { name: '填空', numbered: true, weight: 0.15, refillable: true },
  compare: { name: '比大小', numbered: true, note: '在 ○ 里填 >、< 或 =', weight: 0.04, refillable: false },
  geom: { name: '图形与周长', numbered: true, weight: 0.03, refillable: false },
  word: { name: '讲讲算算', numbered: true, weight: 0.03, refillable: false },
}

export const TYPE_OPTIONS: { type: AppType; label: string }[] = TYPE_ORDER.map((type) => ({
  type,
  label: SPECS[type].name,
}))

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

// ---------- LaTeX → Typst 数学 ----------

/** 支持 \frac / \dfrac（display 样式）、\times、\div、\cdot 与转义空格 */
function toMath(source: string): string {
  let i = 0
  let out = ''

  const readGroup = (): string => {
    while (source[i] === ' ') i++
    if (source[i] === '{') {
      let depth = 1
      const start = ++i
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') depth--
        if (depth > 0) i++
      }
      const inner = source.slice(start, i)
      i++
      return inner
    }
    return source[i++] ?? ''
  }

  while (i < source.length) {
    const frac = /^\\(d?frac)/.exec(source.slice(i))
    if (frac) {
      i += frac[0].length
      const numerator = readGroup()
      const denominator = readGroup()
      out += `display(frac(${toMath(numerator)}, ${toMath(denominator)}))`
      continue
    }
    const command = /^\\([a-zA-Z]+)/.exec(source.slice(i))
    if (command) {
      i += command[0].length
      const map: Record<string, string> = { times: 'times', div: 'div', cdot: 'dot' }
      out += map[command[1]] ?? ''
      continue
    }
    if (source[i] === '\\' && [' ', ',', ';'].includes(source[i + 1])) {
      i += 2
      continue
    }
    out += source[i]
    i++
  }

  return out.trim()
}

/** 填空文本：$...$ 转数学片段，连续 2 个以上下划线转 18mm 留白 */
function splitFill(text: string): FillPart[] {
  const parts: FillPart[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) parts.push({ t: buffer })
    buffer = ''
  }

  while (i < text.length) {
    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1)
      if (end > i) {
        flush()
        parts.push({ m: toMath(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    if (text[i] === '_') {
      let end = i
      while (text[end] === '_') end++
      if (end - i >= 2) {
        flush()
        parts.push({ b: 18 })
        i = end
        continue
      }
    }
    if (text[i] === '\\' && text[i + 1] === ' ') {
      buffer += ' '
      i += 2
      continue
    }
    buffer += text[i]
    i++
  }

  flush()
  return parts
}

// ---------- 静态小样本（比大小 / 图形 / 讲讲算算） ----------

const COMPARE_ITEMS: TypstItem[] = [
  {
    id: 'c1',
    kind: 'compare',
    pre: 'display(frac(2, 5))',
    post: 'display(frac(3, 5))',
    display: true,
  },
  { id: 'c2', kind: 'compare', pre: '45 times 3', post: '54 times 3', display: false },
]

const GEOM_ITEMS: TypstItem[] = [
  {
    id: 'g1',
    kind: 'geom',
    fig: 'rect',
    text: '左图长方形的长是 8 cm，宽是 5 cm。它的周长是多少厘米？',
    blank: 15,
  },
  {
    id: 'g2',
    kind: 'geom',
    fig: 'square',
    text: '左图正方形的边长是 6 cm。它的周长是多少厘米？',
    blank: 15,
  },
]

const WORD_ITEMS: TypstItem[] = [
  {
    id: 'w1',
    kind: 'word',
    text: '学校操场一圈长 400 米。小明每天早上沿操场跑 2 圈，从周一到周五天天如此。他这一个星期一共跑了多少米？',
    workLines: 3,
  },
  {
    id: 'w2',
    kind: 'word',
    text: '三年级同学去科技馆参观，每张门票 8 元。李老师带了 200 元，要给 23 名同学每人买一张门票。买完门票后，李老师还剩多少元？',
    workLines: 3,
  },
]

// ---------- 题库取样 ----------

const VERT_SYMBOL: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: 'times',
  div: 'div',
}

const BANK_TYPES: AppType[] = ['kousuan', 'chushi', 'tuoshi', 'tiankong']

function poolFor(type: AppType, grade: Grade): (Question | TypstItem)[] {
  if (type === 'compare') return COMPARE_ITEMS
  if (type === 'geom') return GEOM_ITEMS
  if (type === 'word') return WORD_ITEMS
  if (!BANK_TYPES.includes(type)) return []
  return QUESTIONS.filter((question) => question.grade === grade && question.type === type)
}

function toTypstItem(type: AppType, source: Question | TypstItem, index: number): TypstItem | null {
  if (type === 'compare' || type === 'geom' || type === 'word') {
    return { ...(source as TypstItem), id: `${(source as TypstItem).id}-${index}` }
  }

  const question = source as Question

  if (type === 'kousuan') {
    if (!question.latex) return null
    const expr = toMath(question.latex)
    return { id: question.id, kind: 'kousuan', expr, display: expr.includes('display(frac') }
  }

  if (type === 'chushi') {
    if (!question.operands || !question.op) return null
    const [left, right] = question.operands
    return {
      id: question.id,
      kind: 'chushi',
      expr: `${left} ${VERT_SYMBOL[question.op]} ${right} =`,
      blank: 30,
    }
  }

  if (type === 'tuoshi') {
    const latex = question.latex ?? question.answerLines?.[0]
    if (!latex) return null
    const expr = toMath(latex)
    return { id: question.id, kind: 'tuoshi', expr, lines: 3, display: false }
  }

  if (type === 'tiankong') {
    if (!question.text) return null
    return { id: question.id, kind: 'fill', parts: splitFill(question.text) }
  }

  return null
}

function rotate<T>(pool: T[], offset: number): T[] {
  if (pool.length === 0) return []
  const start = ((offset % pool.length) + pool.length) % pool.length
  return pool.slice(start).concat(pool.slice(0, start))
}

/** 按权重分配题量；题量足够时保证每种已选题型至少 1 题 */
function allocate(count: number, types: AppType[]): Map<AppType, number> {
  const quotas = new Map<AppType, number>()
  for (const type of types) quotas.set(type, 0)
  if (types.length === 0) return quotas

  let remaining = count
  if (count >= types.length) {
    for (const type of types) {
      quotas.set(type, 1)
      remaining--
    }
  }

  const totalWeight = types.reduce((sum, type) => sum + SPECS[type].weight, 0)
  const shares = types.map((type) => ({ type, exact: (remaining * SPECS[type].weight) / totalWeight }))
  for (const share of shares) {
    const n = Math.floor(share.exact)
    quotas.set(share.type, (quotas.get(share.type) ?? 0) + n)
    remaining -= n
  }
  const byRemainder = [...shares].sort(
    (a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)),
  )
  let cursor = 0
  while (remaining > 0 && byRemainder.length > 0) {
    const share = byRemainder[cursor % byRemainder.length]
    quotas.set(share.type, (quotas.get(share.type) ?? 0) + 1)
    remaining--
    cursor++
  }
  return quotas
}

export function buildTypstPaper(
  config: { grade: Grade; types: AppType[]; count: number },
  supported: Record<AppType, boolean>,
  seed: number,
): BuildResult {
  const requested = Math.min(100, Math.max(1, Math.round(config.count) || 1))
  const selected = TYPE_ORDER.filter((type) => config.types.includes(type))
  const active = selected.filter((type) => supported[type])
  const skipped = selected.filter((type) => !supported[type])

  const byType = new Map<AppType, TypstItem[]>()
  for (const type of active) byType.set(type, [])
  if (active.length === 0) {
    return {
      data: { title: '三年级数学每日一练', sections: [] },
      count: 0,
      shortage: false,
      skipped,
    }
  }

  const quotas = allocate(requested, active)
  const pools = new Map<AppType, TypstItem[]>()
  for (const [order, type] of active.entries()) {
    const pool = poolFor(type, config.grade)
    if (pool.length === 0) continue
    const quota = quotas.get(type) ?? 0
    const ordered = rotate(pool, seed * 7 + order * 11)
    const candidates: TypstItem[] = []
    for (let i = 0; i < ordered.length; i++) {
      const item = toTypstItem(type, ordered[i], i)
      if (item) candidates.push(item)
    }
    pools.set(type, candidates)
    byType.set(type, candidates.slice(0, Math.min(quota, candidates.length)))
  }

  let produced = 0
  for (const items of byType.values()) produced += items.length

  // 先用各题型尚未使用的题目补足题量，同一份卷子内不重复出题
  let leftover = requested - produced
  const refillTypes = active.filter(
    (type) => SPECS[type].refillable && (pools.get(type)?.length ?? 0) > 0,
  )
  let progressed = true
  while (leftover > 0 && progressed) {
    progressed = false
    for (const type of refillTypes) {
      const all = pools.get(type) ?? []
      const current = byType.get(type) ?? []
      if (current.length < all.length) {
        current.push(all[current.length])
        byType.set(type, current)
        leftover--
        progressed = true
        if (leftover === 0) break
      }
    }
  }

  const sections: TypstSection[] = []
  for (const type of TYPE_ORDER) {
    const items = byType.get(type) ?? []
    if (items.length === 0) continue
    const spec = SPECS[type]
    const section: TypstSection = {
      title: `${CN_NUM[sections.length] ?? '?'}、${spec.name}`,
      kind: type,
      numbered: spec.numbered,
      items,
    }
    if (spec.note) section.note = spec.note
    sections.push(section)
  }

  const data: TypstPaperData = { title: '三年级数学每日一练', sections }
  const count = sections.reduce((sum, section) => sum + section.items.length, 0)

  return { data, count, shortage: count < requested, skipped }
}
