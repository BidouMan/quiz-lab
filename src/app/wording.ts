/**
 * 面向家长的结果文案。
 *
 * 生成器内部仍沿用「复核 / 剔除 / 骨架复用 / 跨卷复用」等工程口径，
 * 这里只在展示层做映射，不改动统计字段与判断逻辑。
 */
import type { AppType, BuildStats } from './types.ts'

const LEVEL_WORDS: Record<string, string> = { L1: '基础', L2: '常规', L3: '挑战' }

/** 题型来源：给家长看的说法 */
export const PARENT_SOURCE_LABELS: Record<string, string> = {
  skeleton: '按题型自动出题',
  rule: '按规则出题',
  legacy: '备用题库',
  static: '固定示例题',
  na: '暂不支持',
}

function readableLevels(text: string): string {
  return text.replace(/L[123]/g, (level) => LEVEL_WORDS[level] ?? level)
}

/** 末尾兜底：把仍可能漏出的内部词换成白话，避免界面出现工程术语 */
function sanitize(text: string): string {
  return readableLevels(text)
    .replace(/（[A-Z]\d+-[A-Z]\d+[^）]*）/g, '')
    .replace(/教材未单列(.+?)，(.+?)属四年级内容/g, '教材里没有单独安排$1，这属于四年级内容')
    .replace(/骨架包/g, '题库')
    .replace(/骨架/g, '题目模板')
    .replace(/旧生成器|生成器/g, '备用题库')
    .replace(/题池/g, '可用题目')
    .replace(/复核/g, '检查')
    .replace(/剔除/g, '移除')
    .replace(/去重命中/g, '重复题')
    .replace(/参数池/g, '题目数量')
    .replace(/句式/g, '问法')
    .replace(/干扰项/g, '错误选项')
    .replace(/真值/g, '对错')
    .replace(/LRU/g, '轮换')
}

/** 同一类题换数字/场景，保留家长能理解的解释 */
function readableReuse(note: string): string {
  return note
    .replace(
      /(.+)：题池不足，(\d+) 道按 LRU 跨卷复用（同卷仍不重复）/,
      '$1：新题不够，有 $2 题和最近做过的卷子相同（同一卷内没有重复题）',
    )
    .replace(
      /本卷 (\d+) 题，其中 (\d+) 题为骨架复用（同骨架换场景\/数字）/,
      '本卷 $1 题，其中 $2 题是同一类题目换了数字和场景',
    )
    .replace(/跨卷复用 (\d+) 题（最近 .* 卷记忆池已轮转一轮）/, '本卷有 $1 题和最近做过的卷子相同（新题已用完）')
}

/** 容量不足时如实说明差多少，并解释为什么 */
function readableCapacity(note: string): string {
  return note
    .replace(
      /(.+)：本档可用句式 (\d+) 种，按句式上限合计最多 (\d+) 题；实出 (\d+)\/(\d+)（同句式不超限，不用重复句式凑数）/,
      '$1：这个难度能出的问法有 $2 种，最多 $3 题，本卷出了 $4 题（同一种问法不重复出）',
    )
    .replace(
      /拓展题：本档可用类别 (\d+) 种，参数池用尽后如实出 (\d+)\/(\d+) 题（同结构不重复，不用重复题凑数）/,
      '拓展题：这个难度能出的类别有 $1 种，本卷出了 $2 题（同一种思路不重复出）',
    )
    .replace(
      /判断题：题池只凑到 (\d+)\/(\d+) 道（知识点去重后没有其他知识点的补充命题）/,
      '判断题：只找到 $1 题（你设了 $2 题），同知识点的题不重复',
    )
    .replace(
      /选择题：题池只凑到 (\d+)\/(\d+) 道（知识点去重 \+ 每题需 3 条相反真值干扰项）/,
      '选择题：只找到 $1 题（你设了 $2 题），同知识点的题不重复，每个错误选项都要有明确错因',
    )
    .replace(/(.+?)：题池只凑到 (\d+)\/(\d+) 道（受错因规则与单空来源限制）/, '$1：只找到 $2 题（你设了 $3 题）')
    .replace(/本版比大小规则最多可出 (\d+) 道不重复题/, '比大小：本版最多能出 $1 道不重复题')
    .replace(/本版图形规则最多可出 (\d+) 道不重复题/, '图形与周长：本版最多能出 $1 道不重复题')
}

/** 概念命题整卷时的说明 */
function readableConcept(note: string): string {
  return note
    .replace(
      /选择题：本卷全部为概念命题（实出 (\d+) 题，该单元知识点 (\d+) 个；同知识点不重复，干扰项取其他知识点的相反真值陈述）/,
      '选择题：本卷都是概念题，共 $1 题，覆盖 $2 个知识点（同一知识点不重复出）',
    )
    .replace(
      /判断题：本卷全部为概念命题（实出 (\d+) 题，该单元知识点 (\d+) 个；同知识点不重复，不用反说法凑数）/,
      '判断题：本卷都是概念题，共 $1 题，覆盖 $2 个知识点（同一知识点不重复出）',
    )
    .replace(/判断题：本卷全部为概念命题（(\d+)\/(\d+)，该单元无其他判断来源）/, '判断题：本卷都是概念题（共 $1 题）')
    .replace(/判断题：概念命题 (\d+)\/(\d+) 道（占比上限 (\d+)）/g, '判断题：其中概念题 $1 题（最多 $3 题）')
}

const NOTE_RULES: Array<[RegExp, (match: RegExpExecArray) => string]> = [
  [
    /^单题型上限 (\d+) 题：(.+)，已按上限出题$/,
    (m) => `每类题最多 ${m[1]} 题，${m[2]}已按上限出题`,
  ],
  [
    /^运行时复核：复核 (\d+) 题，失败 (\d+) 题，剔除 (\d+) 题（.*）$/,
    (m) => `系统检查了 ${m[1]} 题，发现 ${m[2]} 题不合格，已从卷面移除 ${m[3]} 题`,
  ],
  [
    /^(.+)：生成失败（.*）$/,
    (m) => `${m[1]}：这几题没能出出来，已跳过`,
  ],
  [
    /^(.+)：骨架(.+)生成失败（.*）$/,
    (m) => `${m[1]}：${m[2]}题改用备用题库出题`,
  ],
  [
    /^(.+)：旧(.+)生成器失败（.*）$/,
    (m) => `${m[1]}：${m[2]}题没能出出来，已跳过`,
  ],
  [
    /^(.+)：(.+)，旧(.+)生成器兜底 (\d+) 题$/,
    (m) => `${m[1]}：${m[2]}，已用备用题目补上 ${m[4]} 题`,
  ],
  [
    /^(.+)：本版没有(.+)生成规则$/,
    (m) => `${m[1]}：本版没有${m[2]}题`,
  ],
  [
    /^(.+)：当前为静态示例题（非生成器）$/,
    (m) => `${m[1]}：使用的是固定示例题`,
  ],
  [
    /^列式计算：所选单元在 (L[123]) 没有可用运算结构（.*）$/,
    (m) => `列式计算：所选单元在“${LEVEL_WORDS[m[1]]}”没有可用的算式（加减、乘法、除法、倍）`,
  ],
  [
    /^(.+?)：所选单元在 (L[123]) 没有可用于判断\/选择的计算或填空内容池，已跳过$/,
    (m) => `${m[1]}：所选单元在“${LEVEL_WORDS[m[2]]}”没有可用的素材，已跳过`,
  ],
  [
    /^比大小：所选单元（.*）没有对应的比较知识点，已跳过$/,
    () => '比大小：所选单元没有可比的数学内容，已跳过',
  ],
]

export function readableNote(note: string): string {
  for (const [pattern, format] of NOTE_RULES) {
    const match = pattern.exec(note)
    if (match) return sanitize(format(match))
  }
  const reuse = readableReuse(note)
  if (reuse !== note) return sanitize(reuse)
  const concept = readableConcept(note)
  if (concept !== note) return sanitize(concept)
  const capacity = readableCapacity(note)
  if (capacity !== note) return sanitize(capacity)
  const colon = note.indexOf('：')
  if (colon > 0) {
    const label = note.slice(0, colon)
    const reason = note.slice(colon + 1)
    const readable = readableAvailabilityReason(reason)
    if (readable !== reason) return `${label}：${readable}`
  }
  return sanitize(note)
}

/** 题型能否勾选的原因（参数面板里直接展示） */
export function readableAvailabilityReason(reason: string): string {
  const rules: Array<[RegExp, (match: RegExpExecArray) => string]> = [
    [/^不适用：(.+)$/, (m) => `本单元不出这类题：${m[1]}`],
    [
      /^所选单元在 (L[123]) 没有骨架(.+)，可切到 (.+)$/,
      (m) => `所选单元在“${LEVEL_WORDS[m[1]]}”暂时没有${m[2]}题，可改选“${m[3]}”`,
    ],
    [
      /^所选单元在 (L[123]) 没有(.+)，可切到 (.+)$/,
      (m) => `所选单元在“${LEVEL_WORDS[m[1]]}”没有${m[2].replace(/规则$/, '题')}，可改选“${m[3]}”`,
    ],
    [
      /^所选单元无骨架(.+)包，使用旧(.+)生成器（兜底）$/,
      (m) => `所选单元暂无新题库，${m[2]}题会用备用题库出题`,
    ],
    [/^所选单元在本版没有(.+)生成规则$/, (m) => `所选单元在本版没有${m[1]}题`],
    [/^所选单元本版没有(.+)生成规则$/, (m) => `所选单元在本版没有${m[1]}题`],
    [/^当前排版模板未接入应用题$/, () => '当前模板暂时不能排应用题'],
  ]
  for (const [pattern, format] of rules) {
    const match = pattern.exec(reason)
    if (match) return sanitize(format(match))
  }
  return sanitize(reason)
}

export function readableNotes(notes: string[]): string[] {
  return notes.map(readableNote)
}

/** 题量没达到设定时的说明 */
export function shortageNote(actual: number, requested: number): string {
  return `你设了 ${requested} 题，可用的不重复题目已经出完，本卷实际 ${actual} 题`
}

/** 结果摘要：只保留家长关心的题量、实出与不合格题数 */
export function formatPaperSummary(stats: BuildStats, count: number, labels: Map<AppType, string>): string {
  const typePart = stats.typeStats
    .filter((row) => row.requested > 0 || row.actual > 0)
    .map((row) => {
      const label = labels.get(row.type) ?? '其他题'
      return row.actual < row.requested
        ? `${label} ${row.actual} 题（你设了 ${row.requested} 题）`
        : `${label} ${row.actual} 题`
    })
  const head = typePart.length > 0 ? `本卷共 ${count} 题（${typePart.join('、')}）` : `本卷共 ${count} 题`

  const check = stats.runtimeCheck
  const checkPart =
    check.failed > 0
      ? `其中 ${check.failed} 题经检查不合格，已自动换掉 ${check.regenerated} 题${
          check.dropped > 0 ? `，还有 ${check.dropped} 题没能替换、未收入本卷` : ''
        }`
      : '全部通过检查'
  const duplicatePart = stats.duplicates > 0 ? `${stats.duplicates} 道重复题已自动换掉` : ''
  return [head, checkPart, duplicatePart].filter(Boolean).join('；')
}
