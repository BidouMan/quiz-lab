import type { AppType } from './types.ts'

export type PaperLevel = 'L1' | 'L2' | 'L3'

export interface Preset {
  id: 'daily' | 'quiz' | 'weekend'
  name: string
  desc: string
  level: PaperLevel
  values: Partial<Record<AppType, number>>
}

/** 三个套餐的唯一定义：界面卡片与套用逻辑都从这里取数 */
export const PRESETS: Preset[] = [
  {
    id: 'daily',
    name: '每日一练',
    desc: '放学后练当天学的内容',
    level: 'L2',
    values: { kousuan: 20, tiankong: 5, word: 3 },
  },
  {
    id: 'quiz',
    name: '单元小测',
    desc: '学完一个单元检验一遍',
    level: 'L2',
    values: { kousuan: 12, chushi: 4, tiankong: 4, choice: 4 },
  },
  {
    id: 'weekend',
    name: '周末加练',
    desc: '周末加量，挑难一点的',
    level: 'L3',
    values: { kousuan: 30, tuoshi: 8, tiankong: 8, word: 6, advanced: 6 },
  },
]

export const LEVEL_LABELS: Record<PaperLevel, string> = { L1: '基础', L2: '标准', L3: '挑战' }

export const LEVEL_HELP: Record<PaperLevel, string> = {
  L1: '覆盖课内核心知识点，适合日常随堂练习',
  L2: '在基础之上增加变式题，适合查漏补缺',
  L3: '综合性强、难度更高，适合学有余力的孩子',
}

/** 每题大致耗时（分钟），用于左栏与结果卡的“M 分钟” */
const MIN_PER_QUESTION: Record<AppType, number> = {
  kousuan: 0.2,
  chushi: 1,
  tuoshi: 1.5,
  jianbian: 1.5,
  tiankong: 0.8,
  compare: 0.5,
  judge: 0.8,
  choice: 1,
  geom: 3,
  lieshi: 1.5,
  word: 2,
  advanced: 4,
}

export function presetTotal(preset: Preset): number {
  return Object.values(preset.values).reduce((sum, n) => sum + (n ?? 0), 0)
}

/** 按逐题型题量估算总用时；空卷返回 0 */
export function estimateMinutes(counts: Partial<Record<AppType, number>>): number {
  const entries = Object.entries(counts) as [AppType, number][]
  const total = entries.reduce((sum, [, value]) => sum + (value ?? 0), 0)
  if (total === 0) return 0
  const work = entries.reduce(
    (sum, [type, value]) => sum + (value ?? 0) * (MIN_PER_QUESTION[type] ?? 1),
    0,
  )
  return Math.round((5 + work) / 5) * 5
}

/** 当前配置是否与某个套餐完全一致（题型、题量、难度） */
export function matchesPreset(
  level: PaperLevel,
  types: AppType[],
  counts: Partial<Record<AppType, number>>,
): Preset | null {
  return (
    PRESETS.find((preset) => {
      if (preset.level !== level) return false
      const wanted = Object.keys(preset.values) as AppType[]
      const set = [...types].filter((t) => (counts[t] ?? 0) > 0).sort()
      if (set.length !== wanted.length) return false
      return wanted.every((t) => (counts[t] ?? 0) === preset.values[t])
    }) ?? null
  )
}
