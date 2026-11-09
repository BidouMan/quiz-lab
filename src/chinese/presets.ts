/**
 * 语文出卷预设：都只是 `ChinesePaperConfig` 字面量，界面可以照抄、改 count 与分值。
 * 默认卷沿用 0.7.0 样张的配比（去掉课内阅读后为 90 分），紧凑卷用于验证页数随配置变化，
 * 缺口卷用于验证「素材不够就留空」的占位块。
 */

import type { ChinesePaperConfig } from './types.ts'

/** 默认综合练习：13 个题型、38 题、90 分 */
export const DEFAULT_CHINESE_PAPER_CONFIG: ChinesePaperConfig = {
  version: 1,
  grade: '3A',
  title: '三年级语文上册 综合练习',
  seed: 20261107,
  difficulty: 'mixed',
  totalItems: 38,
  includeAnswers: true,
  timeMinutes: 90,
  sections: [
    { typeId: 'kanpinyin', count: 10, perItemScore: 1 },
    { typeId: 'zhuyin', count: 6, perItemScore: 1 },
    { typeId: 'xingjin', count: 6, perItemScore: 1 },
    { typeId: 'gushi-fill', count: 5, perItemScore: 2 },
    { typeId: 'gushi-dimo', count: 1, perItemScore: 3 },
    { typeId: 'gaibing', count: 2, perItemScore: 2 },
    { typeId: 'guanlian', count: 2, perItemScore: 1 },
    { typeId: 'biaodian', count: 1, perItemScore: 2 },
    { typeId: 'kuoxie', count: 1, perItemScore: 2 },
    { typeId: 'fangxie', count: 1, perItemScore: 2 },
    { typeId: 'reading', count: 1, perItemScore: 12 },
    { typeId: 'writing', count: 1, perItemScore: 30 },
    { typeId: 'lianmian', count: 1, perItemScore: 3 },
  ],
}

/** 紧凑卷：6 个题型、12 题、26 分，便于验证页数确实随配置缩短 */
export const COMPACT_CHINESE_PAPER_CONFIG: ChinesePaperConfig = {
  version: 1,
  grade: '3A',
  title: '三年级语文上册 短卷练习',
  seed: 20261107,
  difficulty: 'mixed',
  totalItems: 12,
  includeAnswers: true,
  timeMinutes: 25,
  sections: [
    { typeId: 'kanpinyin', count: 3, perItemScore: 1 },
    { typeId: 'zhuyin', count: 3, perItemScore: 1 },
    { typeId: 'xingjin', count: 2, perItemScore: 1 },
    { typeId: 'gushi-fill', count: 2, perItemScore: 2 },
    { typeId: 'gaibing', count: 1, perItemScore: 2 },
    { typeId: 'reading', count: 1, perItemScore: 12 },
  ],
}

/** 缺口卷：故意超出库存，卷面应出现占位块，且不靠重复题凑数 */
export const GAP_CHINESE_PAPER_CONFIG: ChinesePaperConfig = {
  version: 1,
  grade: '3A',
  title: '三年级语文上册 缺口验证卷',
  seed: 20261107,
  difficulty: 'mixed',
  totalItems: 47,
  includeAnswers: true,
  timeMinutes: 40,
  sections: [
    { typeId: 'kanpinyin', count: 15, perItemScore: 1 },
    { typeId: 'zhuyin', count: 20, perItemScore: 1 },
    { typeId: 'xingjin', count: 8, perItemScore: 1 },
    { typeId: 'gushi-dimo', count: 4, perItemScore: 3 },
  ],
}

export const CHINESE_PAPER_PRESETS = {
  default: DEFAULT_CHINESE_PAPER_CONFIG,
  compact: COMPACT_CHINESE_PAPER_CONFIG,
  gap: GAP_CHINESE_PAPER_CONFIG,
}
