import type { ChineseSentenceKind, SourceRef } from '../types.ts'

/** 句子题库统一来源：原创命题，定位到题库编号，可在本仓库逐条抽查 */
export const sentenceSource = (locator: string): SourceRef[] => [
  { label: 'QuizLab 语文三上句子题库（原创命题）', locator },
]

export const SENTENCE_KIND_LABELS: Record<ChineseSentenceKind, string> = {
  gaibing: '修改病句',
  kuoxie: '扩写句子',
  guanlian: '关联词填空',
  biaodian: '标点符号',
  fangxie: '比喻与拟人仿写',
}

export const padId = (prefix: string, index: number): string =>
  `${prefix}-${String(index + 1).padStart(2, '0')}`
