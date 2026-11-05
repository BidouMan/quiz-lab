import type { CalcType, GeneratedQuestion } from './types.ts'

export interface TypstItem {
  id: string
  kind: 'kousuan' | 'chushi' | 'tuoshi'
  expr: string
  display: boolean
  blank?: number
  lines?: number
}

export interface TypstSection {
  title: string
  kind: CalcType
  numbered: boolean
  items: TypstItem[]
}

export interface TypstPaper {
  title: string
  sections: TypstSection[]
  meta: {
    grade: string
    unitId: string
    level: string
    count: number
  }
}

const TITLES: Record<CalcType, string> = {
  kousuan: '口算',
  chushi: '竖式计算',
  tuoshi: '递等式计算',
  jianbian: '简便运算',
}

const CN_ORDINAL = ['一', '二', '三', '四', '五', '六']

/** 只转换本题库会出现的 LaTeX 记号，保持 paper.typ 的 eval(mode: "math") 可用 */
export function latexToTypst(latex: string): string {
  return latex.replace(/\\times/g, 'times').replace(/\\div/g, 'div').replace(/\\left/g, '').replace(/\\right/g, '')
}

export function toTypstPaper(questions: GeneratedQuestion[], title: string): TypstPaper {
  const order: CalcType[] = ['kousuan', 'chushi', 'tuoshi', 'jianbian']
  const sections: TypstSection[] = []
  for (const type of order) {
    const group = questions.filter((q) => q.type === type)
    if (group.length === 0) continue
    sections.push({
      title: `${CN_ORDINAL[sections.length]}、${TITLES[type]}`,
      kind: type,
      numbered: false,
      items: group.map((q) => {
        const expr = latexToTypst(q.latex)
        if (type === 'kousuan') {
          return { id: q.id, kind: 'kousuan', expr, display: false }
        }
        if (type === 'chushi') {
          return { id: q.id, kind: 'chushi', expr, display: false, blank: 30 }
        }
        return { id: q.id, kind: 'tuoshi', expr, display: false, lines: 3 }
      }),
    })
  }

  const first = questions[0]
  return {
    title,
    sections,
    meta: {
      grade: first?.grade ?? '',
      unitId: first?.unitId ?? '',
      level: first?.level ?? '',
      count: questions.length,
    },
  }
}
