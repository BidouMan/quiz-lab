/** 跨卷数值组合记忆：同一知识点连续出卷时优先使用没出现过的数值组合。 */

export interface MemoryEntry {
  count: number
  lastPaper: number
}

export interface MemoryData {
  version: 1
  papers: number
  entries: Record<string, MemoryEntry>
}

export class MemoryStore {
  data: MemoryData

  constructor(data?: Partial<MemoryData>) {
    this.data = {
      version: 1,
      papers: data?.papers ?? 0,
      entries: data?.entries ?? {},
    }
  }

  static fromJSON(text: string): MemoryStore {
    const parsed = JSON.parse(text) as Partial<MemoryData>
    return new MemoryStore(parsed)
  }

  toJSON(): string {
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

  record(fingerprint: string): void {
    const entry = this.data.entries[fingerprint]
    if (entry) {
      entry.count += 1
      entry.lastPaper = this.data.papers
    } else {
      this.data.entries[fingerprint] = { count: 1, lastPaper: this.data.papers }
    }
  }
}
