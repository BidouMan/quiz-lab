/**
 * 题型可用量估算：给面板提示用，不参与出卷。
 *
 * 算法（用真实生成器实测，不拍脑袋）：
 * 1. 按当前年级 / 单元 / 难度，把单题型设到上限 200 题，用全新的去重记忆连出三卷；
 * 2. 统计第三卷的跨卷复用率 r = 复用题数 / 实出题数（此时前两卷已在记忆里，
 *    对应「同一套设置连印几卷」的真实使用场景，也与实测 87/200 的口径一致）；
 * 3. 把内容池近似为均匀池 P，则复用率约等于「单卷题量 / P」。
 *    要求复用率不超过 10%，可稳定不重复的单卷题量 X = 0.10 × P = 200 × 0.10 / r；
 * 4. X 再与三卷实出量取较小值，避免把「本身出不满」的题型说成能出 200 道。
 *
 * 只在配置题量较大时调用（见 ParamsPanel），结果按「年级 + 单元 + 难度 + 题型」缓存。
 */
import { buildPaper } from './paperBuilder.ts'
import {
  MAX_TYPE_COUNT,
  type AppConfig,
  type AppType,
  type BuildResult,
  type BuildStats,
  type TemplateInfo,
} from './types.ts'
import { MemoryStore } from '../quiz/memory.ts'

/** 采样题量：与单题型上限一致，确保看清 200 题附近的池边界 */
export const CAPACITY_SAMPLE_COUNT = MAX_TYPE_COUNT
/** 触发提示的实测复用率线：超过 10% 视为「会明显和旧卷重复」 */
export const CAPACITY_REUSE_THRESHOLD = 0.1
/** 低于该题量不做采样（此量级下实测复用率均低于阈值，采样只会拖慢面板） */
export const CAPACITY_PROBE_MIN_COUNT = 60

const ALL_TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

export interface TypeCapacityResult {
  type: AppType
  /** 保持跨卷复用不超过 10% 的单卷建议题量 */
  available: number
  /** 第二卷实测复用率（0–1） */
  reuseRate: number
  /** 第二卷实测复用题数 */
  repeated: number
  /** 第二卷实出题数 */
  sampled: number
}

type PaperBuilder = (input: {
  config: AppConfig
  template: TemplateInfo
  seed: number
  memory: MemoryStore
}) => BuildResult

const cache = new Map<string, TypeCapacityResult>()

function cacheKey(config: AppConfig, type: AppType): string {
  return `${config.grade}|${[...config.unitIds].sort().join(',')}|${config.level}|${type}`
}

export function estimateTypeCapacity(
  config: AppConfig,
  type: AppType,
  builder: PaperBuilder = buildPaper as PaperBuilder,
): TypeCapacityResult {
  const key = cacheKey(config, type)
  if (builder === (buildPaper as PaperBuilder)) {
    const hit = cache.get(key)
    if (hit) return hit
  }

  const probeConfig: AppConfig = {
    ...config,
    unitIds: [...config.unitIds],
    types: [type],
    counts: { [type]: CAPACITY_SAMPLE_COUNT },
    count: CAPACITY_SAMPLE_COUNT,
  }
  const memory = new MemoryStore()
  const first = builder({ config: probeConfig, template: ALL_TEMPLATE, seed: 20261105, memory })
  const second = builder({ config: probeConfig, template: ALL_TEMPLATE, seed: 20261106, memory })
  const third = builder({ config: probeConfig, template: ALL_TEMPLATE, seed: 20261107, memory })

  const stats: BuildStats = third.stats
  const sampled = Math.min(third.count, CAPACITY_SAMPLE_COUNT)
  const reuseRate = sampled > 0 ? stats.crossReused / sampled : 0
  const byReuse =
    reuseRate > 0
      ? Math.floor((CAPACITY_SAMPLE_COUNT * CAPACITY_REUSE_THRESHOLD) / reuseRate)
      : CAPACITY_SAMPLE_COUNT
  const available = Math.max(
    0,
    Math.min(first.count, second.count, sampled, byReuse, CAPACITY_SAMPLE_COUNT),
  )

  const result: TypeCapacityResult = {
    type,
    available,
    reuseRate,
    repeated: stats.crossReused,
    sampled,
  }
  if (builder === (buildPaper as PaperBuilder)) cache.set(key, result)
  return result
}

/** 面板提示；未超过可用量时返回空串，保证提示只在超阈值时出现 */
export function typeCapacityHint(result: TypeCapacityResult, requested: number): string {
  if (requested <= result.available) return ''
  if (result.reuseRate <= 0) {
    return `目前大约能出不重复的 ${result.available} 道，设到 ${requested} 道时会有一部分出不满`
  }
  const expected = Math.max(1, Math.round(result.reuseRate * requested))
  return `目前大约能出不重复的 ${result.available} 道，设到 ${requested} 道时，后一卷约有 ${expected} 道会和以前的卷子重复`
}
