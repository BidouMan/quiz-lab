import type {
  ChineseLevel,
  ChineseSentenceBankMeta,
  ChineseSentenceItem,
  ChineseSentenceKind,
} from '../types.ts'
import { SENTENCE_KIND_LABELS } from './common.ts'
import { GAIBING_ITEMS } from './gaibing.ts'
import { KUOXIE_ITEMS } from './kuoxie.ts'
import { GUANLIAN_ITEMS } from './guanlian.ts'
import { BIAODIAN_ITEMS } from './biaodian.ts'
import { FANGXIE_ITEMS } from './fangxie.ts'

export { GAIBING_ITEMS } from './gaibing.ts'
export { KUOXIE_ITEMS } from './kuoxie.ts'
export { GUANLIAN_ITEMS, GUANLIAN_WORDS } from './guanlian.ts'
export { BIAODIAN_ITEMS, BIAODIAN_MARKS } from './biaodian.ts'
export { FANGXIE_ITEMS, BIYU_MARKERS } from './fangxie.ts'

export const SENTENCE_BANK: ChineseSentenceItem[] = [
  ...GAIBING_ITEMS,
  ...KUOXIE_ITEMS,
  ...GUANLIAN_ITEMS,
  ...BIAODIAN_ITEMS,
  ...FANGXIE_ITEMS,
]

export const SENTENCE_BANK_META: ChineseSentenceBankMeta = {
  subject: 'chinese',
  grade: '3A',
  scope: '句子',
  review: {
    authoredAt: '2026-11-07',
    pass1: '按三上题型表命题：修改病句 40（四类各 10）、扩写 36、关联词 36、标点 36、比喻与拟人 36。',
    pass2:
      '第二遍只看题干、不看成句答案，逐条重做后与存档比对；不一致的条目当场改写或撤下，本条库存量以比对通过为准。',
    mechanical: [
      '搭配不当：fixed 必须等于 broken 中把 defect 替换为 replacement 的结果。',
      '重复啰嗦：fixed 必须等于 broken 删去 defect 的结果。',
      '成分残缺：fixed 必须等于 broken 在某一位置插入 replacement 的结果。',
      '语序颠倒：fixed 与 broken 的字符（含标点）多重集必须完全相同，只能换序不能换词。',
      '关联词：每空答案必须在三上关联词白名单内，空数与题干「（ ）」数量一致。',
      '标点：每空只能是一个白名单标点，引号、书名号必须成对。',
      '仿写：比喻句必须出现比喻词；拟人句必须出现该条 keywords 中的动作词。',
    ],
    samples: [
      'GB-14 搭配不当：第二遍独立改为「好习惯」，与存档一致。',
      'GB-24 语序颠倒：第二遍先听取报告再讨论报告，与存档一致。',
      'GL-06 关联词：两个空均填「如果……就……」，代回原句通顺。',
      'BD-28 对话标点：按「提示语在中间」的规则逐个核对，7 个空全部一致。',
      'FP-31 拟人：答案出现「陪伴」，且没有用比喻词，符合拟人要求。',
    ],
  },
}

export function sentenceKindLabel(kind: ChineseSentenceKind): string {
  return SENTENCE_KIND_LABELS[kind]
}

export function sentenceCounts(): Record<ChineseSentenceKind, number> {
  const counts = { gaibing: 0, kuoxie: 0, guanlian: 0, biaodian: 0, fangxie: 0 }
  for (const item of SENTENCE_BANK) counts[item.kind] += 1
  return counts
}

export interface SentencePickOptions {
  kinds?: ChineseSentenceKind[]
  levels?: ChineseLevel[]
  count: number
  /** 固定种子时结果可复现；默认使用题库发布日期 */
  seed?: number
}

/** mulberry32：小而稳定，和数学侧的 rng 解耦 */
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

/** 随机抽题：同一次调用内按 id 去重，抽不满时返回全部可用题 */
export function pickSentences(options: SentencePickOptions): ChineseSentenceItem[] {
  const { kinds, levels, count, seed = 20261107 } = options
  const pool = SENTENCE_BANK.filter(
    (item) =>
      (kinds ? kinds.includes(item.kind) : true) && (levels ? levels.includes(item.level) : true),
  )
  const random = makeRandom(seed)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const size = Math.min(count, shuffled.length)
  return shuffled.slice(0, size)
}
