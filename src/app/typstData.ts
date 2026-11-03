import { QUESTIONS } from '../data/questions.ts'
import type { Question, QuestionType } from '../types.ts'
import type { CalcType } from '../quiz/types.ts'
import type { AppType, FillPart, Grade, TypstItem } from './types'

/**
 * 旧静态题库 → Typst 题目。仅作为兜底：当选中单元在本版没有生成规则时，
 * 才从这里取题，并在界面说明“旧题库兜底”。
 */

export const TYPE_ORDER: AppType[] = [
  'kousuan',
  'chushi',
  'tuoshi',
  'jianbian',
  'tiankong',
  'compare',
  'geom',
  'word',
]

const TYPE_LABELS: Record<AppType, string> = {
  kousuan: '口算',
  chushi: '竖式计算',
  tuoshi: '脱式计算',
  jianbian: '简便运算',
  tiankong: '填空',
  compare: '比大小',
  geom: '图形与周长',
  word: '讲讲算算',
}

export const TYPE_OPTIONS: { type: AppType; label: string }[] = TYPE_ORDER.map((type) => ({
  type,
  label: TYPE_LABELS[type],
}))

export const typeLabel = (type: AppType): string => TYPE_LABELS[type]

/** 计算类题型：由生成器产出 */
export const CALC_TYPES: CalcType[] = ['kousuan', 'chushi', 'tuoshi', 'jianbian']

// ---------- LaTeX → Typst 数学 ----------

/** 支持 \frac / \dfrac（display 样式）、\times、\div、\cdot 与转义空格 */
export function toMath(source: string): string {
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
export function splitFill(text: string): FillPart[] {
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

// ---------- 模板未接入题的静态样例 ----------

export const STATIC_SAMPLES: Partial<Record<AppType, TypstItem[]>> = {
  compare: [
    {
      id: 'c1',
      kind: 'compare',
      pre: 'display(frac(2, 5))',
      post: 'display(frac(3, 5))',
      display: true,
    },
    { id: 'c2', kind: 'compare', pre: '45 times 3', post: '54 times 3', display: false },
  ],
  geom: [
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
  ],
  word: [
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
  ],
}

// ---------- 旧题库兜底 ----------

/** 旧题库单元 ID → 2024 修订版单元 ID（两套目录编号不同） */
const LEGACY_UNIT_MAP: Record<string, string> = {
  '3A-U1': '3A-U1',
  '3A-U2': '3A-U2',
  '3A-U3': '3A-U4', // 旧“用一位数除” → 新 3A-U4
  '3A-U4': '3A-U5', // 旧“年、月、日” → 新 3A-U5
  '3A-U5': '3A-U6', // 旧“周长” → 新 3A-U6
  '3B-U1': '3B-U2', // 旧“两位数乘除” → 新 3B-U2
  '3B-U2': '3B-U4', // 旧“分数” → 新 3B-U4
  '3B-U3': '3B-U6', // 旧“面积” → 新 3B-U6
}

const VERT_SYMBOL: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: 'times',
  div: 'div',
}

function toStaticItem(source: Question, type: QuestionType, index: number): TypstItem | null {
  if (type === 'kousuan') {
    if (!source.latex) return null
    const expr = toMath(source.latex)
    return { id: `${source.id}-f${index}`, kind: 'kousuan', expr, display: expr.includes('display(frac') }
  }

  if (type === 'chushi') {
    if (!source.operands || !source.op) return null
    const [left, right] = source.operands
    const expr = `${left} ${VERT_SYMBOL[source.op]} ${right} =`
    return { id: `${source.id}-f${index}`, kind: 'chushi', expr, blank: 30 }
  }

  if (type === 'tuoshi' || type === 'jianbian') {
    if (!source.latex) return null
    return { id: `${source.id}-f${index}`, kind: 'tuoshi', expr: toMath(source.latex), lines: 3 }
  }

  if (type === 'tiankong') {
    if (!source.text) return null
    return { id: `${source.id}-f${index}`, kind: 'fill', parts: splitFill(source.text) }
  }

  return null
}

/** 某单元可用的旧题库兜底题（按 2024 修订版单元 ID 对齐） */
export function staticItemsFor(grade: Grade, unitId: string, type: AppType): TypstItem[] {
  if (!['kousuan', 'chushi', 'tuoshi', 'jianbian', 'tiankong'].includes(type)) return []
  const items: TypstItem[] = []
  for (const [index, question] of QUESTIONS.entries()) {
    if (question.grade !== grade) continue
    if (LEGACY_UNIT_MAP[question.unitId] !== unitId) continue
    if (question.type !== type) continue
    const item = toStaticItem(question, question.type, index)
    if (item) items.push(item)
  }
  return items
}

/** 旧题库某题型是否有题（用于界面提示是否可兜底） */
export function staticCountFor(grade: Grade, unitIds: string[], type: AppType): number {
  return unitIds.reduce((sum, unitId) => sum + staticItemsFor(grade, unitId, type).length, 0)
}
