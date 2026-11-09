/**
 * 语文卷的数据装配：界面选择 → `ChinesePaperConfig` → typst 模板读取的 JSON。
 *
 * CLI（typst/gen-chinese-paper.mjs）与桌面端共用这一份实现，
 * 避免两处各写一遍 doc 结构，导致卷面字段对不上。
 */

import { buildChinesePaper } from './build.ts'
import type {
  ChineseDifficulty,
  ChinesePaperConfig,
  ChinesePaperGap,
  ChinesePaperResult,
  ChineseSectionConfig,
  ChineseSectionResult,
} from './types.ts'
import type {
  ChineseLevel,
  ReadingSkillCode,
  ReadingTheme,
} from '../data/chinese/types.ts'
import type { ReadingPaperItem } from './types.ts'

/** 课外阅读专项：每篇分值 */
export const READING_PAPER_SCORE = 12

// ---------- 阅读题版式度量（与 typst/gen-chinese-paper.mjs 同口径）----------
const HANDWRITE_MM_PER_CHAR = 7
const BLANK_MIN_MM = 14
const BLANK_MAX_MM = 105
const SHORT_ANSWER_CHARS_PER_LINE = 25

const charCount = (text: unknown): number =>
  [...String(text ?? '')].filter((ch) => !/\s/.test(ch)).length

const clampLines = (chars: number): number =>
  Math.min(Math.max(Math.ceil(chars / SHORT_ANSWER_CHARS_PER_LINE), 2), 6)

/** 只取学生实际要写的正文：去掉“示例：”和末尾“也可/即可”这类家长提示 */
function coreAnswer(answer: unknown): string {
  let text = String(answer ?? '').trim()
  text = text.replace(/^示例[:：]\s*/, '')
  const parts = text.split('。').map((part) => part.trim()).filter(Boolean)
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!
    if (/^(摘抄其他|预测另一种|其他合理|举自己|举其他|说清|句子通顺|意思通顺)/.test(last)) {
      parts.pop()
    }
  }
  return parts.join('。')
}

/** 给阅读题的填空横线宽度、简答书写行数补齐版式字段 */
function applyReadingMetrics(doc: ChinesePaperDoc): void {
  for (const section of doc.sections) {
    if (section.typeId !== 'reading' || section.selected <= 0) continue
    const items = section.items as ReadingPaperItem[]
    for (const reading of items) {
      for (const question of reading.questions) {
        if (question.type === 'fill') {
          const target = question as typeof question & { blankWidthsMm?: number[] }
          target.blankWidthsMm = question.blanks.map((blank) =>
            Math.min(Math.max(charCount(blank) * HANDWRITE_MM_PER_CHAR, BLANK_MIN_MM), BLANK_MAX_MM),
          )
        } else if (question.type === 'short') {
          const target = question as typeof question & { blankLines?: number }
          target.blankLines = clampLines(charCount(coreAnswer(question.answer)))
        }
      }
    }
  }
}

/** 界面上的阅读专项选择；空数组表示不筛选 */
export interface ReadingPaperSelection {
  skills: ReadingSkillCode[]
  themes: ReadingTheme[]
  levels: ChineseLevel[]
  count: number
}

/** 阅读专项卷配置：只出一节 reading，考点/主题/难度都落在小节上 */
export function buildReadingPaperConfig(
  selection: ReadingPaperSelection,
  seed: number,
): ChinesePaperConfig {
  const count = Math.min(20, Math.max(1, Math.round(selection.count) || 1))
  const section: ChineseSectionConfig = {
    typeId: 'reading',
    count,
    perItemScore: READING_PAPER_SCORE,
  }
  if (selection.skills.length > 0) section.skills = [...new Set(selection.skills)].sort()
  if (selection.themes.length > 0) section.themes = [...new Set(selection.themes)]
  const levels = [...new Set(selection.levels)].sort()
  // 三档全选等于不筛选，交给 difficulty='mixed'
  if (levels.length > 0 && levels.length < 3) section.levels = levels

  const difficulty: ChineseDifficulty = levels.length === 1 ? levels[0]! : 'mixed'
  return {
    version: 1,
    grade: '3A',
    title: '三年级语文上册 课外阅读专项',
    seed,
    difficulty,
    totalItems: count,
    includeAnswers: true,
    sections: [section],
  }
}

/** typst/chinese-paper-3a.typ 读取的文档结构 */
export interface ChinesePaperDoc {
  meta: {
    title: string
    subtitle: string
    total: number
    gradable: number
    requested: number
    totalItems: number
    requestedItems: number
    seed: number
    difficulty: ChineseDifficulty
    includeAnswers: boolean
  }
  sections: ChineseSectionResult[]
  gaps: ChinesePaperGap[]
  notes: string[]
}

/** 出卷并装配成模板数据；界面摘要可直接读 `paper` */
export function buildChinesePaperDoc(config: ChinesePaperConfig): {
  doc: ChinesePaperDoc
  paper: ChinesePaperResult
} {
  const paper = buildChinesePaper(config)
  const totalItems = paper.items.length
  const requestedItems = config.totalItems
  const time = config.timeMinutes ? `建议 ${config.timeMinutes} 分钟` : ''
  const shortage =
    paper.score.total < paper.score.requested
      ? `；素材不足，实排 ${totalItems}/${requestedItems} 题，配置分值 ${paper.score.requested} 分`
      : ''
  const subtitle =
    config.subtitle ??
    `统编版·五四学制 2025 年秋修订版　｜　满分 ${paper.score.total} 分　｜　${totalItems} 题${time ? `　｜　${time}` : ''}${shortage}`

  const doc: ChinesePaperDoc = {
    meta: {
      title: config.title,
      subtitle,
      total: paper.score.total,
      gradable: paper.score.gradable,
      requested: paper.score.requested,
      totalItems,
      requestedItems,
      seed: config.seed,
      difficulty: config.difficulty,
      includeAnswers: config.includeAnswers,
    },
    sections: paper.sections,
    gaps: paper.gaps,
    notes: paper.notes,
  }
  applyReadingMetrics(doc)
  return { paper, doc }
}