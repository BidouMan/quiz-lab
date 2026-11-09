/** 科目元信息与内容包。数学内容由 paperBuilder 提供；语文练习卷走 src/chinese/doc.ts。 */
import { CHINESE_PAPER_TYPE_IDS, CHINESE_PAPER_TYPE_META } from '../chinese/materials.ts'
import { CHINESE_PAPER_PRESETS } from '../chinese/presets.ts'
import { READING_THEMES } from '../data/chinese/readings/index.ts'
import type { ReadingSkillCode, ReadingTheme } from '../data/chinese/types.ts'

export type SubjectId = 'math' | 'chinese'

export interface SubjectMeta {
  id: SubjectId
  label: string
  subtitle: string
}

export const SUBJECTS: SubjectMeta[] = [
  { id: 'math', label: '数学', subtitle: '三年级上册 · 沪教版' },
  { id: 'chinese', label: '语文', subtitle: '三年级上册 · 统编版' },
]

export interface PlaceholderUnit {
  unitId: string
  unitName: string
}

export interface PlaceholderType {
  typeId: string
  label: string
}

export interface PlaceholderPreset {
  id: string
  name: string
  total: number
}

/** 内容包形状与数学侧对齐，语文用真实题型与预设填充。 */
export interface SubjectContent {
  units: PlaceholderUnit[]
  types: PlaceholderType[]
  presets: PlaceholderPreset[]
}

/** 课外阅读专项的考点选项（与 docs/reading-skills-3a.md 一致） */
export const CHINESE_SKILLS: { code: ReadingSkillCode; label: string }[] = [
  { code: 'SK1', label: '提取信息' },
  { code: 'SK2', label: '梳理概括' },
  { code: 'SK3', label: '词句赏析' },
  { code: 'SK4', label: '推断因果' },
  { code: 'SK5', label: '主旨情感' },
  { code: 'SK6', label: '写法结构' },
  { code: 'SK7', label: '非连续文本' },
]

/** 九类主题，直接沿用题库口径，避免界面与数据层各维护一份 */
export const CHINESE_THEMES: ReadingTheme[] = [...READING_THEMES]

export const CHINESE_CONTENT: SubjectContent = {
  units: [{ unitId: 'reading', unitName: '课外阅读' }],
  types: CHINESE_PAPER_TYPE_IDS.map((typeId) => ({
    typeId,
    label: CHINESE_PAPER_TYPE_META[typeId].label,
  })),
  presets: Object.entries(CHINESE_PAPER_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.title,
    total: preset.totalItems,
  })),
}
