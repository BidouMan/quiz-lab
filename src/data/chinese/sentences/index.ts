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
export { GUANLIAN_ITEMS, GUANLIAN_WORDS, GUANLIAN_RELATIONS } from './guanlian.ts'
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
    pass1:
      '按三上题型表命题：修改病句 40（四类各 10）、扩写 36、关联词 36、标点 36、比喻与拟人 36；A/B/C 三档重新按「能达成 / 需要想一想 / 有挑战但不出纲」分配，A 档不再用一二年级句末标点题凑数。',
    pass2:
      '第二遍只看题干、不看成句答案，逐条重做后与存档比对；开放题（扩写、仿写、成分残缺）只给参考评分点，不冒充客观题。答案有同义写法的，按完整组合穷举进 answers；无法穷举的句子收窄语境或改为评分点。',
    mechanical: [
      '搭配不当：fixed 必须等于 broken 中把 defect 替换为 replacement 的结果。',
      '重复啰嗦：fixed 必须等于 broken 删去 defect 的结果。',
      '成分残缺：fixed 必须等于 broken 在某一位置插入 replacement 的结果。',
      '语序颠倒：fixed 与 broken 的字符（含标点）多重集必须完全相同，只能换序不能换词。',
      '关联词：每条 answers 的每个组合都必须在对应 relation 的词表内，组合长度等于题干「（ ）」数量。',
      '标点：每条 answers 的每个组合都必须在标点白名单内，组合长度等于空数，引号和书名号成对。',
      '答案声明：answerCount 必须等于可枚举答案数；unique 只能有 1 条，multiple 至少 2 条。',
      '扩写与仿写：只在 samples 上做「保留主干 / 比喻词或拟人动作」的初筛，最终按 rubric 人工面批。',
    ],
    samples: [
      'GB-15 关联词：把「只要……就……」和「只有……才……」同时列入答案，代回原句都通顺。',
      'GB-24 语序颠倒：第二遍先听取报告再讨论报告，与存档一致。',
      'GL-05 关联词：两个空均填「如果……就……」，代回原句通顺。',
      'BD-11 对话标点：按「提示语在中间」的规则逐个核对，7 个空全部一致。',
      'FP-31 拟人：答案写老槐树「陪伴」我们，没有用比喻词，符合拟人要求。',
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
