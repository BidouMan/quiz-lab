/**
 * 跨卷记忆：全部题型共用一份 `.quizlab/gen-memory.json`（应用内为同一份 localStorage 键）。
 *
 * 统一语义：
 * - 每出一卷调用一次 beginPaper()，卷号从 1 起；
 * - 每条记忆的键由出题层按题型语义生成（见 normalize.ts 与各生成器）；
 * - 最近 RECENT_WINDOW 卷出现过的题视为“热题”，新卷优先避开；
 * - 池子耗尽时按最久未用（lastPaper 最小）轮换，由出题层在 notes 里标注复用；
 * - 条目数超过 MAX_MEMORY_ENTRIES 时按 lastPaper 从旧到新裁剪，控制文件体积；
 * - 文件损坏 / 不可读时按空记忆处理并重建，绝不让出卷失败。
 */

/** 记忆窗口：优先避开最近 6 卷出现过的题 */
export const RECENT_WINDOW = 6

/** 记忆条目上限；单条约 50–80 字节，上限对应文件约 1–1.6MB */
export const MAX_MEMORY_ENTRIES = 20_000

export interface MemoryEntry {
  /** 累计出现次数，仅作统计与二级权重 */
  count: number
  /** 最近一次出现的卷号；0 表示从未出现 */
  lastPaper: number
}

export interface MemoryData {
  version: 1
  papers: number
  entries: Record<string, MemoryEntry>
}

function sanitizeEntry(value: unknown): MemoryEntry | null {
  if (value == null || typeof value !== 'object') return null
  const raw = value as Partial<MemoryEntry>
  const count = Number(raw.count)
  const lastPaper = Number(raw.lastPaper)
  if (!Number.isFinite(count) || !Number.isFinite(lastPaper)) return null
  return { count: Math.max(0, Math.trunc(count)), lastPaper: Math.max(0, Math.trunc(lastPaper)) }
}

export class MemoryStore {
  data: MemoryData

  constructor(data?: Partial<MemoryData>) {
    const papers = Number(data?.papers)
    const entries: Record<string, MemoryEntry> = {}
    if (data?.entries != null && typeof data.entries === 'object') {
      for (const [key, value] of Object.entries(data.entries)) {
        const entry = sanitizeEntry(value)
        if (entry) entries[key] = entry
      }
    }
    this.data = {
      version: 1,
      papers: Number.isFinite(papers) && papers > 0 ? Math.trunc(papers) : 0,
      entries,
    }
  }

  /** 损坏 / 不可读时返回空记忆，调用方无需 try/catch */
  static fromJSON(text: string): MemoryStore {
    try {
      const parsed = JSON.parse(text)
      if (parsed == null || typeof parsed !== 'object') return new MemoryStore()
      return new MemoryStore(parsed as Partial<MemoryData>)
    } catch {
      return new MemoryStore()
    }
  }

  toJSON(): string {
    this.prune()
    return JSON.stringify(this.data, null, 2) + '\n'
  }

  /** 每出一份卷子调用一次，返回卷号 */
  beginPaper(): number {
    this.data.papers += 1
    return this.data.papers
  }

  usage(fingerprint: string): number {
    return this.data.entries[fingerprint]?.count ?? 0
  }

  /** 最近一次出现的卷号；0 表示从未出现，用于 LRU 轮换 */
  lastPaper(fingerprint: string): number {
    return this.data.entries[fingerprint]?.lastPaper ?? 0
  }

  /** 是否在最近 window 卷内出现过（含当前卷） */
  recentlyUsed(fingerprint: string, window: number = RECENT_WINDOW): boolean {
    const last = this.lastPaper(fingerprint)
    return last > 0 && last > this.data.papers - window
  }

  /**
   * 是否来自更早的卷（不含当前卷）。
   * 统计“跨卷复用”用这个口径：同一卷内分多次生成时复用已出题，不算跨卷复用。
   */
  crossPaperUsed(fingerprint: string, window: number = RECENT_WINDOW): boolean {
    const last = this.lastPaper(fingerprint)
    return last > 0 && last < this.data.papers && last > this.data.papers - window
  }

  record(fingerprint: string): void {
    const entry = this.data.entries[fingerprint]
    if (entry) {
      entry.count += 1
      entry.lastPaper = this.data.papers
    } else {
      this.data.entries[fingerprint] = { count: 1, lastPaper: this.data.papers }
    }
  }

  size(): number {
    return Object.keys(this.data.entries).length
  }

  /** 超出上限时按 lastPaper 从旧到新裁剪（同卷号按 key 排序保证结果稳定） */
  prune(maxEntries: number = MAX_MEMORY_ENTRIES): void {
    const keys = Object.keys(this.data.entries)
    if (keys.length <= maxEntries) return
    keys.sort((a, b) => {
      const diff = this.data.entries[a].lastPaper - this.data.entries[b].lastPaper
      return diff !== 0 ? diff : a.localeCompare(b)
    })
    for (const key of keys.slice(0, keys.length - maxEntries)) delete this.data.entries[key]
  }
}
