/** 科目元信息与内容包。数学内容仍由现有 paperBuilder 提供；语文目前只有占位结构。 */
export type SubjectId = 'math' | 'chinese'

export interface SubjectMeta {
  id: SubjectId
  label: string
  subtitle: string
}

export const SUBJECTS: SubjectMeta[] = [
  { id: 'math', label: '数学', subtitle: '三年级上册 · 沪教版' },
  { id: 'chinese', label: '语文', subtitle: '占位 · 待接入教材' },
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

/** 内容包形状与数学侧对齐，接入正式教材后直接替换这三组数据即可。 */
export interface SubjectContent {
  units: PlaceholderUnit[]
  types: PlaceholderType[]
  presets: PlaceholderPreset[]
}

export const PLACEHOLDER_TEXT = '占位 · 待接入教材'

export const CHINESE_CONTENT: SubjectContent = {
  units: [{ unitId: 'chinese-placeholder', unitName: PLACEHOLDER_TEXT }],
  types: [{ typeId: 'chinese-placeholder', label: PLACEHOLDER_TEXT }],
  presets: [{ id: 'chinese-placeholder', name: '占位套餐', total: 0 }],
}
