import type { Question } from '../types'

/**
 * 分页引擎（屏幕与打印共用同一套结果）。
 * 单位：CSS px @96dpi，A4 = 794 × 1123。
 * 排布为「行优先」：每节内从左到右两题一行，第 n 行 = 第 2n-1、2n 题，
 * 行高取左右两题较大值，两题顶部对齐。
 */

export const PAGE_W = 794
export const PAGE_H = 1123
/** 页边距 48px ≈ 12.7mm，屏幕与打印几何一致 */
export const PAGE_PADDING = 48
/** 页眉 28px（仅标题 + 细分隔线）+ 与正文间距 4px */
export const HEADER_H = 32
export const FOOTER_H = 30
export const COL_GAP = 24
export const CONTENT_W = PAGE_W - PAGE_PADDING * 2
export const COL_W = Math.floor((CONTENT_W - COL_GAP) / 2)
export const CONTENT_H = PAGE_H - PAGE_PADDING * 2 - HEADER_H - FOOTER_H

const SECTION_H = 32

/** 口算 / 填空 / 竖式的基准高度（含书写留白） */
const FIXED_H: Partial<Record<Question['type'], number>> = {
  kousuan: 34,
  tiankong: 60,
  chushi: 140, // 题干行 27 + 纯空白书写区 ~104 + 内边距
}

/** 脱式书写行：每行 28px，行距 8px */
export const WORK_LINE_H = 28
export const WORK_LINE_GAP = 8

/** 递等式步数 = 题干运算符个数（夹紧到 2–3 行） */
export function workSteps(latex?: string): number {
  const ops = (latex?.match(/\+|-|\\times|\\div/g) || []).length
  return Math.min(3, Math.max(2, ops))
}

/** 题目在卷面上的估算高度；脱式/简便按实际步数计算，不用固定值 */
export function itemHeight(q: Question): number {
  const fixed = FIXED_H[q.type]
  if (fixed !== undefined) return fixed
  const n = workSteps(q.latex)
  // 题干行 27 + 首行上间距 6 + n 行书写 + 行距 + 底部 4
  return 27 + 6 + n * WORK_LINE_H + (n - 1) * WORK_LINE_GAP + 4
}

/** 页面块：节标题（通栏）或一行两题 */
export type Block<T> =
  | { kind: 'section'; title: string }
  | { kind: 'row'; left: T; right?: T }

export interface PageModel<T> {
  blocks: Block<T>[]
}

interface Sec<T> {
  title: string
  items: { payload: T; h: number }[]
}

/** 通用行优先贪心分页：节标题与首行作为原子块，行高取两题最大 */
function paginate<T>(sections: Sec<T>[], pageH: number): PageModel<T>[] {
  const pages: PageModel<T>[] = []
  let blocks: Block<T>[] = []
  let used = 0
  const flush = () => {
    if (blocks.length > 0) pages.push({ blocks })
    blocks = []
    used = 0
  }
  for (const sec of sections) {
    let firstRow = true
    for (let i = 0; i < sec.items.length; i += 2) {
      const l = sec.items[i]
      const r = sec.items[i + 1]
      const need = (firstRow ? SECTION_H : 0) + Math.max(l.h, r ? r.h : 0)
      if (used + need > pageH && blocks.length > 0) flush()
      if (firstRow) blocks.push({ kind: 'section', title: sec.title })
      blocks.push(r ? { kind: 'row', left: l.payload, right: r.payload } : { kind: 'row', left: l.payload })
      used += need
      firstRow = false
    }
  }
  flush()
  return pages
}

// ---------- 卷面 ----------

const TYPE_ORDER: Question['type'][] = ['kousuan', 'chushi', 'tuoshi', 'jianbian', 'tiankong']
const TYPE_SECTION: Record<Question['type'], string> = {
  kousuan: '口算',
  chushi: '竖式计算',
  tuoshi: '脱式计算',
  jianbian: '简便运算',
  tiankong: '填空',
}
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八']

export interface PaperPayload {
  q: Question
}
export type PaperPageModel = PageModel<PaperPayload>

export interface PaperModel {
  pages: PaperPageModel[]
  /** 行高缩放系数（为达到目标页数而压缩，1 为不缩放） */
  scale: number
}

/** 按题型聚节（一、口算 / 二、竖式计算 …），节内保持原顺序；卷面无题号 */
function toSections(questions: Question[], scale: number): Sec<PaperPayload>[] {
  const secs: Sec<PaperPayload>[] = []
  let secIdx = 0
  for (const t of TYPE_ORDER) {
    const items = questions
      .filter((q) => q.type === t)
      .map((q) => ({ payload: { q }, h: Math.round(itemHeight(q) * scale) }))
    if (items.length > 0) {
      secs.push({ title: `${CN_NUM[secIdx]}、${TYPE_SECTION[t]}`, items })
      secIdx++
    }
  }
  return secs
}

function countPages(questions: Question[], scale: number): number {
  return paginate(toSections(questions, scale), CONTENT_H).length
}

/**
 * 生成卷面分页。
 * pages 为目标卷面页数：内容超出目标时按 2% 步长压缩行高（下限 0.6），
 * 压缩到底仍超出则按实际页数输出；内容不足时不强行凑页。
 */
export function buildPaper(questions: Question[], targetPages: number): PaperModel {
  let scale = 1
  const target = Math.max(1, targetPages)
  if (questions.length > 0 && countPages(questions, 1) > target) {
    scale = 0.6
    for (let s = 98; s >= 60; s -= 2) {
      if (countPages(questions, s / 100) <= target) {
        scale = s / 100
        break
      }
    }
  }
  return { pages: paginate(toSections(questions, scale), CONTENT_H), scale }
}

// ---------- 答案页 ----------

/** 答案行内容：latex 单行全式 / lines 多行递等 / text 纯文本（填空） */
export interface AnswerPayload {
  latex?: string
  text?: string
  lines?: string[]
}
export type AnswerPageModel = PageModel<AnswerPayload>

/** 单行答案高 24 + 题间距 16；多行递等每行 24 + 题间距 16 */
function answerHeight(p: AnswerPayload): number {
  return (p.lines ? p.lines.length * 24 : 24) + 16
}

const OP_SYM: Record<string, string> = { add: '+', sub: '-', mul: '\\times', div: '\\div' }

/** 拼出完整答案：脱式/简便给完整递等式，其余给「题干 = 结果」全式 */
function fullAnswer(q: Question): AnswerPayload {
  if (q.answerLines) return { lines: q.answerLines }
  if (q.type === 'chushi' && q.operands && q.op) {
    return { latex: `${q.operands[0]} ${OP_SYM[q.op]} ${q.operands[1]} = ${q.answer}` }
  }
  if (q.latex) return { latex: `${q.latex} ${q.answer.replace(/\$/g, '')}` }
  return { text: q.answer }
}

/** 答案页：无编号，分组与行顺序与卷面一致，家长按顺序核对 */
export function buildAnswers(questions: Question[]): AnswerPageModel[] {
  const secs: Sec<AnswerPayload>[] = []
  let secIdx = 0
  for (const t of TYPE_ORDER) {
    const items = questions.filter((q) => q.type === t).map((q) => {
      const payload = fullAnswer(q)
      return { payload, h: answerHeight(payload) }
    })
    if (items.length > 0) {
      secs.push({ title: `${CN_NUM[secIdx]}、${TYPE_SECTION[t]}`, items })
      secIdx++
    }
  }
  return paginate(secs, CONTENT_H)
}
