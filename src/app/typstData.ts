import type { CalcType } from '../quiz/types.ts'
import type { AppType, FillPart, TypstItem } from './types'

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
  word: '应用题',
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

/** 空位宽度随答案长度伸缩：短答案 12mm，长答案最多 34mm */
const blankWidth = (answer?: string): number => {
  if (!answer) return 18
  const width = answer.replace(/\s+/g, '').length
  return Math.min(34, Math.max(12, 6 + width * 4))
}

/** 填空文本：$...$ 转数学片段，连续 2 个以上下划线转留白；传入 answers 时按答案长度定宽 */
export function splitFill(text: string, answers?: string[]): FillPart[] {
  const parts: FillPart[] = []
  let buffer = ''
  let i = 0
  let blankIndex = 0

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
        parts.push({ b: blankWidth(answers?.[blankIndex]) })
        blankIndex++
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
}


