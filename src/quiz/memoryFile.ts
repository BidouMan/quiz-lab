/// <reference types="node" />
/**
 * 记忆文件落盘：严格校验 + 损坏备份 + 原子写。
 *
 * 只有脚本 / 测试使用本模块（依赖 node:fs）；应用内记忆走 localStorage，
 * 复用 memory.ts 的 parseMemoryJson 做同样的完整性校验。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import {
  corruptTimestamp,
  memoryRecoveryNotice,
  MemoryStore,
  parseMemoryJson,
} from './memory.ts'

export type MemoryFileStatus = 'ok' | 'recovered'

export interface MemoryFileLoadResult {
  store: MemoryStore
  status: MemoryFileStatus
  /** 损坏原文的备份路径（文件不存在 / 读取失败时可能没有） */
  backupPath?: string
  /** 给家长看的一句话；status 为 recovered 时必有 */
  notice?: string
  /** 损坏原因，仅用于日志排查 */
  reason?: string
}

/**
 * 读取记忆文件。文件不存在按空记忆处理；内容损坏时把原文件改名为
 * `xxx.corrupt-YYYYMMDDTHHMMSS`，重建空记忆并返回提示。任何情况下都不抛异常。
 */
export function loadMemoryFile(path: string, now: Date = new Date()): MemoryFileLoadResult {
  if (!existsSync(path)) return { store: new MemoryStore(), status: 'ok' }

  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    return {
      store: new MemoryStore(),
      status: 'recovered',
      reason: `无法读取：${String(error)}`,
      notice: memoryRecoveryNotice(),
    }
  }

  const parsed = parseMemoryJson(raw)
  if (parsed.status === 'ok') return { store: parsed.store, status: 'ok' }

  const backupPath = `${path}.corrupt-${corruptTimestamp(now)}`
  let saved = false
  try {
    renameSync(path, backupPath)
    saved = true
  } catch {
    // 备份失败（权限 / 跨设备）也不能阻断出卷；后续原子写会覆盖坏文件
  }

  return {
    store: new MemoryStore(),
    status: 'recovered',
    ...(saved ? { backupPath } : {}),
    notice: saved ? memoryRecoveryNotice(basename(backupPath)) : memoryRecoveryNotice(),
    reason: parsed.reason,
  }
}

let tmpCounter = 0

/** 原子写：先写同目录临时文件，再 rename 覆盖，避免断电留下半个文件。 */
export function saveMemoryFile(path: string, store: MemoryStore): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${tmpCounter++}`
  writeFileSync(tmp, store.toJSON())
  renameSync(tmp, path)
}
