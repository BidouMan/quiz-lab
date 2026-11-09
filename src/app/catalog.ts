/**
 * 阅读素材库（开发者工具）的数据整理。
 * 只负责解析 data/reading-catalog/ 的快照、算台账、拼任务单，不做任何抓取。
 */

export const DEFAULT_JOB_TARGET = 20
export const MAX_JOB_TARGET = 300
export const MIN_WORD_COUNT = 1
export const MAX_WORD_COUNT = 2000
export const DEFAULT_WORD_MIN = 300
export const DEFAULT_WORD_MAX = 500
export const MAX_NOTE_LENGTH = 200

export interface CatalogSource {
  id: string
  name: string
  status: string
  remainingPages: number | null
  note: string
}

export interface CatalogItem {
  seq: string
  sourceId: string
  title: string
  status: string
}

export interface CatalogJobFile {
  name: string
  raw: string
}

/** Rust `read_catalog_snapshot` 的返回结构；raw 为文件原文，前端容错解析 */
export interface CatalogSnapshot {
  dir: string
  sourcesRaw: string | null
  itemsRaw: string | null
  jobs: CatalogJobFile[]
  errors: string[]
}

export interface JobDraft {
  targetCount: number
  sources: string[]
  wordMin: number
  wordMax: number
  requireAnswer: boolean
  note: string
}

export interface CatalogJob extends JobDraft {
  id: string
  createdAt: string
  status: string
}

export interface BoardStats {
  imported: number
  pending: number
  noAnswer: number
  rejected: number
  /** 合集父条目：已按材料边界切分 / 边界不可靠待切分 */
  split: number
  needsSplit: number
  total: number
  /** items.jsonl 中无法解析的行数 */
  badLines: number
}

export interface SourceRow {
  id: string
  name: string
  /** 已穷尽 / 还有 N 页 / 不可用 / 待扫描 */
  closing: string
  imported: number
}

export interface BoardSummary {
  stats: BoardStats
  rows: SourceRow[]
  latestJob: CatalogJob | null
  hasData: boolean
  errors: string[]
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 来源名单：接受 `{ sources: [...] }` 或直接数组，坏文件返回空数组而不是抛错 */
export function parseSources(raw: string | null | undefined): CatalogSource[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const object = asObject(parsed)
  const list = Array.isArray(parsed) ? parsed : object?.sources
  if (!Array.isArray(list)) return []

  return list.flatMap((entry) => {
    const item = asObject(entry)
    if (!item) return []
    const id = readString(item.id).trim()
    if (!id) return []
    return [
      {
        id,
        name: readString(item.name).trim() || id,
        status: readString(item.status).trim().toLowerCase(),
        remainingPages: readNumber(item.remainingPages),
        note: readString(item.note),
      },
    ]
  })
}

export type ItemBucket = 'imported' | 'pending' | 'no-answer' | 'rejected' | 'other'

export function itemBucket(status: string): ItemBucket {
  const value = status.trim().toLowerCase().replace(/_/g, '-')
  if (value === 'imported' || value === 'pending' || value === 'rejected') return value
  if (value === 'no-answer' || value === 'noanswer' || value === 'missing-answer') return 'no-answer'
  return 'other'
}

/** items.jsonl 逐行解析；坏行只计数，不影响其它行 */
export function parseItems(raw: string | null | undefined): {
  items: CatalogItem[]
  badLines: number
} {
  if (!raw) return { items: [], badLines: 0 }
  const items: CatalogItem[] = []
  let badLines = 0
  for (const line of raw.split('\n')) {
    const text = line.trim()
    if (!text) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      badLines += 1
      continue
    }
    const item = asObject(parsed)
    if (!item) {
      badLines += 1
      continue
    }
    items.push({
      seq: readString(item.seq),
      sourceId: readString(item.sourceId),
      title: readString(item.title),
      status: readString(item.status),
    })
  }
  return { items, badLines }
}

/** 来源的结账状态文案 */
export function sourceClosingLabel(source: CatalogSource): string {
  const status = source.status
  if (status === 'unavailable' || status === 'disabled' || status === 'blocked') return '不可用'
  if (status === 'manual') return '按链接抓取'
  if (status === 'done' || status === 'exhausted' || status === 'complete' || status === 'finished') {
    return '已穷尽'
  }
  if (source.remainingPages !== null) {
    if (source.remainingPages <= 0) return '已穷尽'
    return `还有 ${source.remainingPages} 页`
  }
  return '待扫描'
}

export function parseJob(raw: string): CatalogJob | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const object = asObject(parsed)
  if (!object) return null
  const id = readString(object.id).trim()
  if (!id) return null
  return {
    id,
    createdAt: readString(object.createdAt),
    targetCount: readNumber(object.targetCount) ?? 0,
    sources: Array.isArray(object.sources)
      ? object.sources.filter((entry): entry is string => typeof entry === 'string')
      : [],
    wordMin: readNumber(object.wordMin) ?? 0,
    wordMax: readNumber(object.wordMax) ?? 0,
    requireAnswer: object.requireAnswer === true,
    note: readString(object.note),
    status: readString(object.status),
  }
}

/** 最近的任务单：编号即生成时间，按编号倒序 */
export function latestJob(files: CatalogJobFile[]): CatalogJob | null {
  const jobs = files
    .map((file) => parseJob(file.raw))
    .filter((job): job is CatalogJob => job !== null)
  if (jobs.length === 0) return null
  jobs.sort((left, right) => {
    const byId = right.id.localeCompare(left.id)
    return byId !== 0 ? byId : right.createdAt.localeCompare(left.createdAt)
  })
  return jobs[0]
}

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  done: '已完成',
  completed: '已完成',
  failed: '失败',
  rejected: '已取消',
}

export function jobStatusLabel(status: string): string {
  const value = status.trim().toLowerCase()
  return JOB_STATUS_LABELS[value] ?? (status.trim() || '未知')
}

export function summarizeCatalog(snapshot: CatalogSnapshot | null | undefined): BoardSummary {
  const stats: BoardStats = {
    imported: 0,
    pending: 0,
    noAnswer: 0,
    rejected: 0,
    split: 0,
    needsSplit: 0,
    total: 0,
    badLines: 0,
  }
  if (!snapshot) {
    return { stats, rows: [], latestJob: null, hasData: false, errors: [] }
  }

  const sources = parseSources(snapshot.sourcesRaw)
  const { items, badLines } = parseItems(snapshot.itemsRaw)
  stats.badLines = badLines
  stats.total = items.length

  const importedBySource = new Map<string, number>()
  for (const item of items) {
    const status = item.status.trim().toLowerCase().replace(/_/g, '-')
    if (status === 'split') {
      stats.split += 1
      continue
    }
    if (status === 'needs-split') {
      stats.needsSplit += 1
      continue
    }
    const bucket = itemBucket(item.status)
    if (bucket === 'imported') {
      stats.imported += 1
      if (item.sourceId) {
        importedBySource.set(item.sourceId, (importedBySource.get(item.sourceId) ?? 0) + 1)
      }
    } else if (bucket === 'pending') {
      stats.pending += 1
    } else if (bucket === 'no-answer') {
      stats.noAnswer += 1
    } else if (bucket === 'rejected') {
      stats.rejected += 1
    }
  }

  const rows: SourceRow[] = sources.map((source) => ({
    id: source.id,
    name: source.name,
    closing: sourceClosingLabel(source),
    imported: importedBySource.get(source.id) ?? 0,
  }))

  const hasData =
    snapshot.sourcesRaw != null || snapshot.itemsRaw != null || snapshot.jobs.length > 0

  return {
    stats,
    rows,
    latestJob: latestJob(snapshot.jobs),
    hasData,
    errors: Array.isArray(snapshot.errors) ? snapshot.errors : [],
  }
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** 任务单编号：本地时间 YYYYMMDD-HHmmss */
export function jobIdFromDate(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

/** 本地时区的 ISO 时间（带偏移量，便于人读） */
export function localIsoString(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hours = pad(Math.floor(Math.abs(offset) / 60))
  const minutes = pad(Math.abs(offset) % 60)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return Math.min(max, Math.max(min, rounded))
}

export function buildJob(draft: JobDraft, date: Date = new Date()): CatalogJob {
  const targetCount = clampInt(draft.targetCount, 1, MAX_JOB_TARGET, DEFAULT_JOB_TARGET)
  const wordMin = clampInt(draft.wordMin, MIN_WORD_COUNT, MAX_WORD_COUNT, DEFAULT_WORD_MIN)
  const wordMax = Math.max(
    wordMin,
    clampInt(draft.wordMax, MIN_WORD_COUNT, MAX_WORD_COUNT, DEFAULT_WORD_MAX),
  )
  const sources = Array.from(
    new Set(
      draft.sources
        .filter((id) => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    ),
  )
  return {
    id: jobIdFromDate(date),
    createdAt: localIsoString(date),
    targetCount,
    sources,
    wordMin,
    wordMax,
    requireAnswer: Boolean(draft.requireAnswer),
    note: draft.note.trim().slice(0, MAX_NOTE_LENGTH),
    status: 'pending',
  }
}

/** 生成前校验；空字符串表示通过 */
export function validateJobDraft(draft: JobDraft): string {
  const target = Number(draft.targetCount)
  if (!Number.isFinite(target) || target < 1 || target > MAX_JOB_TARGET) {
    return `目标篇数需在 1–${MAX_JOB_TARGET} 之间`
  }
  if (draft.sources.length === 0) return '请至少选择一个来源'
  const min = Number(draft.wordMin)
  const max = Number(draft.wordMax)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < MIN_WORD_COUNT || max > MAX_WORD_COUNT) {
    return `字数区间需在 ${MIN_WORD_COUNT}–${MAX_WORD_COUNT} 之间`
  }
  if (max < min) return '字数区间的上限不能小于下限'
  return ''
}

/** 把 ISO 时间显示成 YYYY-MM-DD HH:mm:ss；解析不了就原样返回 */
export function formatJobTime(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
