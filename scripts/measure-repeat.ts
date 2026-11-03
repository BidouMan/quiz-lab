import { generate } from '../src/quiz/generate.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import type { CalcType, Grade, Level } from '../src/quiz/types.ts'

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

const grade = (arg('grade', '3A') as Grade)
const unitId = arg('unit', '3A-U2')!
const type = (arg('type', 'chushi') as CalcType)
const level = (arg('level', 'L3') as Level)
const count = Number(arg('count', '12'))
const papers = Number(arg('papers', '10'))

function measure(sharedMemory: boolean): { total: number; unique: number; withinPaperDup: number } {
  const memory = sharedMemory ? new MemoryStore() : null
  const all = new Set<string>()
  let total = 0
  let withinPaperDup = 0

  for (let i = 1; i <= papers; i++) {
    const store = memory ?? new MemoryStore()
    if (sharedMemory) store.beginPaper()
    const result = generate({
      grade,
      unitId,
      type,
      level,
      count,
      seed: 1000 + i * 17,
      memory: store,
    })
    total += result.questions.length
    const local = new Set<string>()
    for (const q of result.questions) {
      const key = q.latex.replace(/\s+/g, '')
      if (local.has(key)) withinPaperDup++
      local.add(key)
      all.add(`${q.kpId}|${key}`)
    }
  }
  return { total, unique: all.size, withinPaperDup }
}

const withMemory = measure(true)
const withoutMemory = measure(false)
const rate = (x: { total: number; unique: number }) =>
  x.total === 0 ? 0 : ((x.total - x.unique) / x.total) * 100

console.log(`单元 ${unitId} · ${type}/${level} · 每份 ${count} 题 · 连续 ${papers} 份`)
console.log(`  带跨卷记忆: 共 ${withMemory.total} 题，去重后 ${withMemory.unique} 题，重复率 ${rate(withMemory).toFixed(1)}%`)
console.log(`  无跨卷记忆: 共 ${withoutMemory.total} 题，去重后 ${withoutMemory.unique} 题，重复率 ${rate(withoutMemory).toFixed(1)}%`)
console.log(`  单份内重复: 带记忆 ${withMemory.withinPaperDup} 题 / 无记忆 ${withoutMemory.withinPaperDup} 题`)
