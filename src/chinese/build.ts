/**
 * 语文出卷纯函数：`buildChinesePaper(config)`。
 *
 * 只做三件事：按配置取题、按题量去重、把素材缺口如实报出来。
 * 跨卷记忆由 `config.memory` 只读传入：优先排没出过的题，留小比例旧题巩固；
 * 写回由调用方按 `usedKeys` 完成，本模块不碰存储（见 types.ts 末尾扩展点说明）。
 */

import type { ChineseLevel } from '../data/chinese/types.ts'
import { chineseUnits } from '../data/chinese/curriculum.ts'
import {
  CHINESE_ANSWER_MODE,
  CHINESE_PAPER_TYPE_META,
  chineseMaterialInventory,
  duoyinCandidates,
  fillTextCandidates,
  gushiDimoCandidates,
  gushiFillCandidates,
  kanpinyinCandidates,
  lianmianCandidates,
  readingCandidates,
  sentenceCandidates,
  writingCandidates,
  xingjinCandidates,
  zhuyinCandidates,
} from './materials.ts'
import type {
  ChineseDifficulty,
  ChinesePaperConfig,
  ChinesePaperGap,
  ChinesePaperItem,
  ChinesePaperMemory,
  ChinesePaperResult,
  ChinesePaperTypeId,
  ChineseReadingPaperQuestion,
  ChineseSectionResult,
  ReadingPaperItem,
} from './types.ts'

/** 每卷新题目标占比；其余额度留给「冷却期满」的旧题做巩固 */
const FRESH_RATIO = 0.8

const CHINESE_NO = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
]

/** 受 unitIds 收窄的教材类题型；句子、阅读、习作、卷面为全册通用题，不受影响 */
const TEXTBOOK_TYPES = new Set<ChinesePaperTypeId>([
  'kanpinyin',
  'zhuyin',
  'duoyin',
  'xingjin',
  'cipu',
  'jinayi',
  'xuanzi',
  'gushi-fill',
  'gushi-dimo',
  'riji',
  'writing',
])

function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 每类题型的冷却期（按卷数）：冷却期内不再出现，期满才允许作为巩固题重复。
 *
 * 高频出卷时（如每天一张）这一条决定「多久再见到同一道题」；
 * 扩写、仿写是开放题、答案不可背，重复的价值在「隔一段时间重写并对照评分点」，
 * 所以冷却期给得最长；字词属于熟练度题，短周期重复反而有用。
 */
const COOLDOWN_PAPERS: Record<ChinesePaperTypeId, number> = {
  kanpinyin: 4,
  zhuyin: 4,
  duoyin: 3,
  xingjin: 3,
  cipu: 3,
  jinayi: 3,
  xuanzi: 3,
  'gushi-fill': 4,
  'gushi-dimo': 6,
  riji: 3,
  gaibing: 8,
  guanlian: 8,
  biaodian: 8,
  kuoxie: 25,
  fangxie: 25,
  reading: 20,
  writing: 16,
  lianmian: 1,
}

/**
 * 洗牌后按顺序取前 n 条；同一去重键只出现一次。
 *
 * 给了跨卷记忆时改用「优先新题 + 冷却期满才巩固」：
 * - 没出过的题先排，配额 FRESH_RATIO；
 * - 剩下额度只从「冷却期满」的旧题里取，按最久没出排前面，避免刚做完又撞上；
 * - 冷却期内一律不排；整池都在冷却时（题库相对出题量太小）才兜底按最久未出取。
 */
function pickSectionItems(
  pool: ChinesePaperItem[],
  count: number,
  seed: number,
  memoryKeyOf: (item: ChinesePaperItem) => string,
  dedupeKeyOf: (item: ChinesePaperItem) => string,
  cooldown: number,
  memory?: ChinesePaperMemory,
): { picked: ChinesePaperItem[]; usedKeys: string[] } {
  const shuffled = [...pool]
  const random = makeRandom(seed)
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const picked: ChinesePaperItem[] = []
  const chosen = new Set<string>()
  const push = (item: ChinesePaperItem): boolean => {
    const dedupe = dedupeKeyOf(item)
    if (chosen.has(dedupe)) return false
    chosen.add(dedupe)
    picked.push(item)
    return true
  }

  if (!memory) {
    for (const item of shuffled) {
      if (picked.length >= count) break
      push(item)
    }
    return { picked, usedKeys: picked.map(memoryKeyOf) }
  }

  const lastPaperOf = (item: ChinesePaperItem) => memory.entries[memoryKeyOf(item)]?.lastPaper ?? 0
  const fresh: ChinesePaperItem[] = []
  const cooled: ChinesePaperItem[] = []
  const hot: ChinesePaperItem[] = []
  for (const item of shuffled) {
    const last = lastPaperOf(item)
    if (last === 0) fresh.push(item)
    else if (memory.paper - last >= cooldown) cooled.push(item)
    else hot.push(item)
  }
  // 最久没出过的旧题排前面；同卷号沿用洗牌顺序，避免每次固定同一批
  cooled.sort((a, b) => lastPaperOf(a) - lastPaperOf(b))
  hot.sort((a, b) => lastPaperOf(a) - lastPaperOf(b))

  // 题量只有 1–2 条时不留重复额度，全排新题
  const freshQuota = Math.min(fresh.length, Math.max(1, Math.round(count * FRESH_RATIO)))
  let freshUsed = 0
  for (const item of fresh) {
    if (picked.length >= count || freshUsed >= freshQuota) break
    if (push(item)) freshUsed += 1
  }
  // 巩固题只从冷却期满的旧题里取
  for (const item of cooled) {
    if (picked.length >= count) break
    push(item)
  }
  // 新题不够、冷却期满的旧题也不够时，回填剩余新题
  for (const item of fresh) {
    if (picked.length >= count) break
    push(item)
  }
  // 兜底：整池都在冷却期（题量太小），按最久未出取，绝不空卷
  for (const item of hot) {
    if (picked.length >= count) break
    push(item)
  }

  return { picked, usedKeys: picked.map(memoryKeyOf) }
}

/** 词语搭配按数据层 group 顺序排回：随机抽题后仍按「量词→四字词语→课文原句搭配」分段 */
function orderByGroup(items: ChinesePaperItem[]): ChinesePaperItem[] {
  const order = (item: ChinesePaperItem): number => Number(item.key.split(':')[1] ?? 0)
  return [...items].sort((a, b) => order(a) - order(b))
}

function difficultyLevels(difficulty: ChineseDifficulty): ChineseLevel[] | null {
  if (difficulty === 'mixed') return null
  return [difficulty]
}

function candidatesFor(typeId: ChinesePaperTypeId): ChinesePaperItem[] {
  switch (typeId) {
    case 'kanpinyin':
      return kanpinyinCandidates()
    case 'zhuyin':
      return zhuyinCandidates()
    case 'duoyin':
      return duoyinCandidates()
    case 'xingjin':
      return xingjinCandidates()
    case 'cipu':
      return fillTextCandidates('cipu')
    case 'jinayi':
      return fillTextCandidates('jinayi')
    case 'xuanzi':
      return fillTextCandidates('xuanzi')
    case 'gushi-fill':
      return gushiFillCandidates()
    case 'gushi-dimo':
      return gushiDimoCandidates()
    case 'riji':
      return fillTextCandidates('riji')
    case 'gaibing':
      return sentenceCandidates('gaibing')
    case 'guanlian':
      return sentenceCandidates('guanlian')
    case 'biaodian':
      return sentenceCandidates('biaodian')
    case 'kuoxie':
      return sentenceCandidates('kuoxie')
    case 'fangxie':
      return sentenceCandidates('fangxie')
    case 'reading':
      return readingCandidates()
    case 'writing':
      return writingCandidates()
    case 'lianmian':
      return lianmianCandidates()
  }
}

/**
 * 阅读题分值分配：选择/填空权重 2、简答权重 4，按权重把整篇分值拆成整数，
 * 余数用最大余数法补足，保证篇内各题之和恰好等于每篇分值。
 */
export function allocateReadingScores(
  questions: ChineseReadingPaperQuestion[],
  total: number,
): number[] {
  if (questions.length === 0) return []
  if (total <= 0) return questions.map(() => 0)
  const weights = questions.map((q) => (q.type === 'short' ? 4 : 2))
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  const raw = weights.map((w) => (total * w) / weightSum)
  const scores = raw.map((value) => Math.floor(value))
  let left = total - scores.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < left; i += 1) scores[order[i % order.length].index] += 1
  return scores
}

function withScore(item: ChinesePaperItem, score: number): ChinesePaperItem {
  if (item.typeId === 'reading') {
    const reading = item as ReadingPaperItem
    const scores = allocateReadingScores(reading.questions, score)
    return {
      ...reading,
      score,
      questions: reading.questions.map((question, index) => ({
        ...question,
        score: scores[index] ?? 0,
      })),
    }
  }
  return { ...item, score } as ChinesePaperItem
}

function gradableScore(item: ChinesePaperItem): number {
  switch (item.typeId) {
    case 'writing':
    case 'lianmian':
    case 'kuoxie':
    case 'fangxie':
      return 0
    case 'gaibing':
      return item.judging === 'auto' ? item.score : 0
    case 'reading':
      return item.questions
        .filter((question) => question.type !== 'short')
        .reduce((sum, question) => sum + question.score, 0)
    default:
      return item.score
  }
}

function validateConfig(config: ChinesePaperConfig): void {
  if (config.version !== 1) throw new Error(`不支持的配置版本：${config.version}`)
  if (config.grade !== '3A') throw new Error(`本引擎只做三上（3A），收到 ${config.grade}`)
  if (!Array.isArray(config.sections) || config.sections.length === 0) {
    throw new Error('配置里的 sections 不能为空')
  }
  if (!Number.isInteger(config.seed)) throw new Error('seed 必须是整数，才能复现同一张卷')
  if (config.unitIds) {
    if (!Array.isArray(config.unitIds) || config.unitIds.length === 0) {
      throw new Error('unitIds 不能为空数组；不筛选请直接省略')
    }
    const known = new Set(chineseUnits.map((unit) => unit.unitId))
    for (const unitId of config.unitIds) {
      if (!known.has(unitId)) throw new Error(`未知单元：${unitId}`)
    }
  }
  const seen = new Set<ChinesePaperTypeId>()
  for (const section of config.sections) {
    if (!CHINESE_PAPER_TYPE_META[section.typeId]) {
      throw new Error(`未知题型：${section.typeId}`)
    }
    if (seen.has(section.typeId)) throw new Error(`题型重复：${section.typeId}`)
    seen.add(section.typeId)
    if (!Number.isInteger(section.count) || section.count <= 0) {
      throw new Error(`${section.typeId} 的 count 必须是正整数`)
    }
    if (!Number.isInteger(section.perItemScore) || section.perItemScore < 0) {
      throw new Error(`${section.typeId} 的 perItemScore 必须是非负整数`)
    }
    if (section.levels && section.levels.length === 0) {
      throw new Error(`${section.typeId} 的 levels 不能为空数组`)
    }
    if (section.themes || section.skills) {
      if (section.typeId !== 'reading') {
        throw new Error(`只有 reading 支持 themes/skills 筛选，收到 ${section.typeId}`)
      }
      if (section.themes && section.themes.length === 0) {
        throw new Error('reading 的 themes 不能为空数组')
      }
      if (section.skills && section.skills.length === 0) {
        throw new Error('reading 的 skills 不能为空数组')
      }
    }
  }
  const sum = config.sections.reduce((total, section) => total + section.count, 0)
  if (sum !== config.totalItems) {
    throw new Error(`配置 totalItems=${config.totalItems}，但各题型 count 合计=${sum}`)
  }
}

function makeGap(
  typeId: ChinesePaperTypeId,
  section: ChinesePaperConfig['sections'][number],
  available: number,
  selected: number,
  filterLabel: string | null = null,
): ChinesePaperGap {
  const meta = CHINESE_PAPER_TYPE_META[typeId]
  const unit = meta.countUnit
  const message = filterLabel
    ? available === 0
      ? `按${filterLabel} 筛选后没有可用素材：需要 ${section.count} ${unit}，本卷留空，不用其他篇目填充冒充。`
      : `按${filterLabel} 筛选后素材有限：需要 ${section.count} ${unit}，可用 ${available} ${unit}；本次仅排 ${selected} ${unit}，不用其他篇目填充冒充。`
    : available === 0
      ? `该题型暂无足够素材：需要 ${section.count} ${unit}，现有 0 ${unit}。本卷留空，不用重复题或未核实素材凑数。`
      : `该题型暂无足够素材：需要 ${section.count} ${unit}，现有 ${available} ${unit}；本卷已排 ${selected} ${unit}，其余留空，不用重复题凑数。`
  return {
    typeId,
    label: meta.label,
    needed: section.count,
    available,
    missing: Math.max(0, section.count - available),
    reason: filterLabel
      ? available === 0
        ? `筛选后无素材：${filterLabel} 下没有可用条目`
        : `筛选后素材有限：${filterLabel} 下可用 ${available} 条，少于配置的 ${section.count} 条`
      : available === 0
        ? '素材为 0：题库里没有这一类可用条目'
        : `素材不足：可用 ${available} 条，少于配置的 ${section.count} 条`,
    message,
  }
}

export function buildChinesePaper(config: ChinesePaperConfig): ChinesePaperResult {
  validateConfig(config)

  const notes: string[] = []
  const usedPoemTitles = new Set<string>()
  const usedKeys: string[] = []
  const sections: ChineseSectionResult[] = config.sections.map((section, index) => {
    const meta = CHINESE_PAPER_TYPE_META[section.typeId]
    const levels = section.levels ?? difficultyLevels(config.difficulty)

    let pool = candidatesFor(section.typeId)
    let filterLabel: string | null = null

    // 阅读专项卷：按主题、考点筛选，两者同时给出时取交集（组内为 OR）
    if (section.typeId === 'reading') {
      const parts: string[] = []
      if (section.themes && section.themes.length > 0) {
        pool = (pool as ReadingPaperItem[]).filter((item) =>
          section.themes!.includes(item.theme),
        )
        parts.push(`主题 ${section.themes.join('/')}`)
      }
      if (section.skills && section.skills.length > 0) {
        pool = (pool as ReadingPaperItem[]).filter((item) =>
          item.skills.some((skill) => section.skills!.includes(skill)),
        )
        parts.push(`考点 ${section.skills.join('/')}`)
      }
      if (parts.length > 0) filterLabel = parts.join(' + ')
    }

    // 单元卷：教材类题按单元收窄；句子/阅读/习作/卷面为全册通用题，不参与
    if (config.unitIds && config.unitIds.length > 0 && TEXTBOOK_TYPES.has(section.typeId)) {
      const allowed = new Set(config.unitIds)
      pool = pool.filter((item) => 'unitId' in item && allowed.has(String(item.unitId)))
      const names = chineseUnits
        .filter((unit) => allowed.has(unit.unitId))
        .map((unit) => unit.unitName)
      const unitLabel = names.length <= 2 ? names.join('/') : '所选单元'
      filterLabel = filterLabel ? `${filterLabel} + ${unitLabel}` : unitLabel
    }

    // 古诗补全与整首默写共用同一批古诗：先出现的一节先占用，避免一诗两用
    if (section.typeId === 'gushi-fill' || section.typeId === 'gushi-dimo') {
      pool = pool.filter(
        (item) => 'poemTitle' in item && !usedPoemTitles.has(item.poemTitle),
      )
    }

    if (levels) {
      if (meta.itemLevels) {
        pool = pool.filter((item) => item.level !== null && levels.includes(item.level))
      } else if (!levels.includes(meta.baselineLevel)) {
        notes.push(
          `${meta.label}的素材没有逐题难度标注，按题型基线 ${meta.baselineLevel} 档出题，未按 ${levels.join('/')} 档筛选。`,
        )
      }
    }

    const isPoemSection = section.typeId === 'gushi-fill' || section.typeId === 'gushi-dimo'
    const uniqueKey = (item: ChinesePaperItem): string => {
      if ('poemTitle' in item) return item.poemTitle
      if ('dedupeKey' in item && item.dedupeKey) return item.dedupeKey
      return item.key
    }
    // 近义词/反义词按词头去重，同一套卷里同一个词只出现一次
    const needsDedup = isPoemSection || section.typeId === 'jinayi'
    const available = needsDedup
      ? new Set(pool.map((item) => uniqueKey(item))).size
      : pool.length
    const seed = config.seed + index * 7919
    // 记忆键带题型前缀：同一首诗在「古诗补全」和「古诗默写」里各记一轮
    const memoryKeyOf = (item: ChinesePaperItem): string => `${section.typeId}|${uniqueKey(item)}`
    const chosen = pickSectionItems(
      pool,
      section.count,
      seed,
      memoryKeyOf,
      uniqueKey,
      COOLDOWN_PAPERS[section.typeId],
      config.memory,
    )
    usedKeys.push(...chosen.usedKeys)
    const rawPicked = chosen.picked.map((item) => withScore(item, section.perItemScore))
    // 词语搭配抽题后按数据层顺序排回，让「量词 / 四字词语 / 课文原句搭配」各自连续，不交错
    const picked = section.typeId === 'cipu' ? orderByGroup(rawPicked) : rawPicked

    const poemTitles = picked
      .filter((item): item is ChinesePaperItem & { poemTitle: string } => 'poemTitle' in item)
      .map((item) => item.poemTitle)
    for (const title of poemTitles) usedPoemTitles.add(title)

    if (section.typeId === 'reading' && picked.length > 0) {
      notes.push('课外阅读的分值按篇内题型分配：选择、填空权重 2，简答权重 4，余数用最大余数法补足。')
    }
    if (section.typeId === 'writing') {
      const writing = picked[0]
      if (writing && writing.typeId === 'writing' && writing.scoring.total !== section.perItemScore) {
        notes.push(
          `习作评分的分项标准按数据层的 ${writing.scoring.total} 分制给出，本卷习作按 ${section.perItemScore} 分计，请按比例折算。`,
        )
      }
    }

    const score = picked.reduce((sum, item) => sum + item.score, 0)
    return {
      typeId: section.typeId,
      label: meta.label,
      group: meta.group,
      answerMode: CHINESE_ANSWER_MODE[section.typeId],
      no: CHINESE_NO[index] ?? `${index + 1}`,
      requested: section.count,
      selected: picked.length,
      perItemScore: section.perItemScore,
      score,
      items: picked,
      gap: picked.length < section.count ? makeGap(section.typeId, section, available, picked.length, filterLabel) : null,
    }
  })

  const items = sections.flatMap((section) => section.items)
  const total = sections.reduce((sum, section) => sum + section.score, 0)
  const gradable = items.reduce((sum, item) => sum + gradableScore(item), 0)
  const requested = config.sections.reduce(
    (sum, section) => sum + section.count * section.perItemScore,
    0,
  )

  return {
    config,
    sections,
    items,
    score: { total, gradable, requested },
    gaps: sections.map((section) => section.gap).filter((gap): gap is ChinesePaperGap => gap !== null),
    notes,
    usedKeys,
  }
}

/** 给界面做「可出数」摘要用；与具体配置无关，是题库总量 */
export { chineseMaterialInventory }
