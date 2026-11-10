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
  ChinesePaperMemory,
  ChinesePaperResult,
  ChinesePaperTypeId,
  ChineseSectionConfig,
  ChineseSectionResult,
} from './types.ts'
import type {
  ChineseLevel,
  ReadingSkillCode,
  ReadingTheme,
} from '../data/chinese/types.ts'
import { findChineseUnit } from '../data/chinese/curriculum.ts'
import type { ReadingPaperItem } from './types.ts'
import type {
  FillTextItem,
  GushiDimoItem,
  GushiFillItem,
  GuanlianPaperItem,
  KuoxiePaperItem,
  FangxiePaperItem,
  ZhuyinItem,
} from './types.ts'

/** 课外阅读专项：每篇分值 */
export const READING_PAPER_SCORE = 12

// ---------- 阅读题版式度量（与 typst/gen-chinese-paper.mjs 同口径）----------
const HANDWRITE_MM_PER_CHAR = 7
const BLANK_MIN_MM = 14
const BLANK_MAX_MM = 105
const SHORT_ANSWER_CHARS_PER_LINE = 25
const PT_TO_MM = 25.4 / 72
const PINYIN_LETTER_EM = 0.55

const round1 = (value: number): number => Math.round(value * 10) / 10

const charCount = (text: unknown): number =>
  [...String(text ?? '')].filter((ch) => !/\s/.test(ch)).length

const blankWidthMm = (chars: number): number =>
  round1(Math.min(Math.max(chars * HANDWRITE_MM_PER_CHAR, BLANK_MIN_MM), BLANK_MAX_MM))

/** 注音横线：按拼音字母宽度估算，与 CLI 排版同口径 */
const pinyinWidthMm = (pinyin: string, sizePt = 10): number => {
  const em = sizePt * PT_TO_MM
  const raw = (charCount(pinyin) * PINYIN_LETTER_EM + 0.6) * em
  return round1(Math.min(Math.max(raw, 3 * em), 20 * em))
}

const medianChars = (answers: string[]): number => {
  const lengths = answers.map(charCount).sort((a, b) => a - b)
  if (lengths.length === 0) return 0
  const mid = Math.floor(lengths.length / 2)
  return lengths.length % 2 ? lengths[mid]! : Math.round((lengths[mid - 1]! + lengths[mid]!) / 2)
}

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

/** 给全部题型的填空横线、书写行数补齐版式字段（桌面端直接调 typst，必须在这里算） */
function applyLayoutMetrics(doc: ChinesePaperDoc): void {
  for (const section of doc.sections) {
    if (section.selected <= 0) continue

    if (section.typeId === 'reading') {
      const items = section.items as ReadingPaperItem[]
      for (const reading of items) {
        for (const question of reading.questions) {
          if (question.type === 'fill') {
            const target = question as typeof question & { blankWidthsMm?: number[] }
            target.blankWidthsMm = question.blanks.map((blank) => blankWidthMm(charCount(blank)))
          } else if (question.type === 'short') {
            const target = question as typeof question & { blankLines?: number }
            target.blankLines = clampLines(charCount(coreAnswer(question.answer)))
          }
        }
      }
    } else if (section.typeId === 'zhuyin') {
      for (const item of section.items as ZhuyinItem[]) {
        item.blankWidthMm = pinyinWidthMm(item.pinyin, 10)
      }
    } else if (section.typeId === 'guanlian') {
      for (const item of section.items as GuanlianPaperItem[]) {
        const slots: string[][] = []
        for (const variant of item.answers) {
          variant.forEach((answer, index) => {
            if (!slots[index]) slots[index] = []
            slots[index]!.push(answer)
          })
        }
        item.blankWidthsMm = slots.map((answers) => blankWidthMm(medianChars(answers)))
      }
    } else if (section.typeId === 'gushi-fill') {
      for (const item of section.items as GushiFillItem[]) {
        const clauses = item.answer.split('，')
        item.answerLines = clauses.map((clause, index) =>
          index < clauses.length - 1 ? `${clause}，` : clause,
        )
        item.clauseWidthsMm = clauses.map((clause) =>
          blankWidthMm(charCount(clause.replace(/[，。？！；：、]$/, ''))),
        )
        item.blankWidthMm = round1(
          item.clauseWidthsMm.reduce((total, width) => total + width, 0) +
            (clauses.length - 1) * 5,
        )
      }
    } else if (section.typeId === 'gushi-dimo') {
      for (const item of section.items as GushiDimoItem[]) {
        item.blankWidthsPerLineMm = item.lines.map((line) =>
          line
            .split('，')
            .map((clause) => blankWidthMm(charCount(clause.replace(/[，。？！；：、]$/, '')))),
        )
      }
    } else if (section.typeId === 'kuoxie' || section.typeId === 'fangxie') {
      for (const item of section.items as (KuoxiePaperItem | FangxiePaperItem)[]) {
        item.blankLines = 1
      }
    } else if (
      section.typeId === 'cipu' ||
      section.typeId === 'jinayi' ||
      section.typeId === 'xuanzi' ||
      section.typeId === 'riji'
    ) {
      for (const item of section.items as FillTextItem[]) {
        item.blankWidthsMm = item.answers.map((answer) => blankWidthMm(charCount(answer)))
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
  memory?: ChinesePaperMemory,
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
    ...(memory ? { memory } : {}),
  }
}

/** 校内同步卷选择：单元 + 题型题量 + 难度 */
export interface ChineseSyncSelection {
  unitIds: string[]
  levels: ChineseLevel[]
  sections: { typeId: ChinesePaperTypeId; count: number; perItemScore: number }[]
  includeAnswers: boolean
}

/** 校内同步卷配置：单元筛选落在 config.unitIds，教材题按单元收窄 */
export function buildSyncPaperConfig(
  selection: ChineseSyncSelection,
  seed: number,
  memory?: ChinesePaperMemory,
): ChinesePaperConfig {
  const unitIds = [...new Set(selection.unitIds)].sort()
  if (unitIds.length === 0) throw new Error('请至少选择一个单元')
  const sections: ChineseSectionConfig[] = selection.sections
    .filter((section) => section.count > 0)
    .map((section) => ({ ...section }))
  if (sections.length === 0) throw new Error('请至少选择一个题型')

  const levels = [...new Set(selection.levels)].sort()
  const difficulty: ChineseDifficulty = levels.length === 1 ? levels[0]! : 'mixed'
  if (levels.length > 1 && levels.length < 3) {
    for (const section of sections) section.levels = levels
  }

  const title =
    unitIds.length === 1
      ? `${findChineseUnit(unitIds[0]!)?.unitName ?? '三年级语文上册'}同步练习`
      : unitIds.length === 8
        ? '三年级语文上册 综合练习'
        : '三年级语文上册 同步练习'

  return {
    version: 1,
    grade: '3A',
    title,
    seed,
    difficulty,
    totalItems: sections.reduce((total, section) => total + section.count, 0),
    unitIds,
    sections,
    includeAnswers: selection.includeAnswers,
    ...(memory ? { memory } : {}),
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
  // 校内同步卷只做日常练习，不展示分数；阅读专项保留分值说明
  const isPractice = Boolean(config.unitIds?.length)
  const shortage =
    paper.score.total < paper.score.requested
      ? isPractice
        ? `；素材不足，实排 ${totalItems}/${requestedItems} 题`
        : `；素材不足，实排 ${totalItems}/${requestedItems} 题，配置分值 ${paper.score.requested} 分`
      : ''
  const subtitle =
    config.subtitle ??
    (isPractice
      ? `统编版·五四学制 2025 年秋修订版　｜　${totalItems} 题${time ? `　｜　${time}` : ''}${shortage}`
      : `统编版·五四学制 2025 年秋修订版　｜　满分 ${paper.score.total} 分　｜　${totalItems} 题${time ? `　｜　${time}` : ''}${shortage}`)

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
  applyLayoutMetrics(doc)
  return { paper, doc }
}