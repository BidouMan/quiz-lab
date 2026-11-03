/** 骨架试点对外出口 */
export * from './types.ts'
export { buildComboPaper, createUsedSets, practiceCoverage, renderText } from './assemble.ts'
export type { UsedSets } from './assemble.ts'
export { verifyPaper, verifyQuestion, stats } from './verify.ts'
export { COMBOS, getCombo } from './registry.ts'
