/**
 * 44 篇精选原创的考点与难度补标（按现有题目实际考查内容逐题判定）。
 *
 * 这些篇目早于 SK1–SK7 标签体系，题目本身没有 skill 字段。
 * 为不改动正文与题目，这里以覆盖表的形式补标，由 `READING_BANK` 装配时并入：
 * - `skills`：篇级考点并集，升序；
 * - `questionSkills`：逐题考点，顺序与 `questions` 完全一致；
 * - `difficulty`：A 易 / B 中 / C 难，依据正文长度与题目是否需要跨段整合。
 *
 * 修改标签必须同时给出依据，不要在未读题的情况下调整。
 */

import type { ChineseLevel, ReadingSkillCode } from '../types.ts'

export interface OriginalReadingTag {
  /** 篇级考点并集，升序 */
  skills: ReadingSkillCode[]
  /** A 易 / B 中 / C 难 */
  difficulty: ChineseLevel
  /** 逐题考点，顺序与 questions 一致 */
  questionSkills: ReadingSkillCode[]
}

export const ORIGINAL_READING_TAGS: Record<string, OriginalReadingTag> = {
  'RD-01': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-02': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2', 'SK4'] },
  'RD-03': { skills: ['SK1', 'SK4'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-04': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK4'] },
  'RD-05': { skills: ['SK1', 'SK2'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-06': { skills: ['SK1', 'SK5', 'SK6'], difficulty: 'B', questionSkills: ['SK6', 'SK1', 'SK1', 'SK5'] },
  'RD-07': { skills: ['SK1', 'SK6'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK6'] },
  'RD-08': { skills: ['SK1', 'SK4'], difficulty: 'A', questionSkills: ['SK4', 'SK1', 'SK1', 'SK1'] },
  'RD-09': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK4'] },
  'RD-10': { skills: ['SK1', 'SK3'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK3'] },
  'RD-11': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK4'] },
  'RD-12': { skills: ['SK1', 'SK4'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-13': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK4'] },
  'RD-14': { skills: ['SK1', 'SK3'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK3'] },
  'RD-15': { skills: ['SK1', 'SK2'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-16': { skills: ['SK1', 'SK4', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK4', 'SK5'] },
  'RD-17': { skills: ['SK1', 'SK2', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK5'] },
  'RD-18': { skills: ['SK1', 'SK2'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-19': { skills: ['SK1', 'SK2', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK4', 'SK2'] },
  'RD-20': { skills: ['SK1', 'SK5'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-21': { skills: ['SK1', 'SK3'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK3'] },
  'RD-22': { skills: ['SK1'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK1'] },
  'RD-23': { skills: ['SK1', 'SK2'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK2', 'SK1'] },
  'RD-24': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-026': { skills: ['SK1', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-028': { skills: ['SK1', 'SK5'], difficulty: 'C', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-035': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-043': { skills: ['SK1', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-027': { skills: ['SK1', 'SK2'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-044': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-049': { skills: ['SK1', 'SK2'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-055': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-056': { skills: ['SK1', 'SK5'], difficulty: 'C', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-058': { skills: ['SK1', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-072': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-073': { skills: ['SK1', 'SK5'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-076': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-077': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-084': { skills: ['SK1', 'SK2'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-091': { skills: ['SK1', 'SK2'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK2'] },
  'RD-096': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-098': { skills: ['SK1', 'SK5'], difficulty: 'A', questionSkills: ['SK1', 'SK1', 'SK1', 'SK5'] },
  'RD-103': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
  'RD-106': { skills: ['SK1', 'SK4'], difficulty: 'B', questionSkills: ['SK1', 'SK1', 'SK1', 'SK4'] },
}
