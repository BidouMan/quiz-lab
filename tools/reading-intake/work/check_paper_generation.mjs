import { readFileSync } from 'node:fs'
import {
  MOUNTED_READINGS,
  PENDING_READINGS,
  PRACTICE_READING_BANK,
  QUALIFIED_READING_BANK,
  READING_BANK,
} from '../../../src/data/chinese/readings/index.ts'
import {
  chineseMaterialInventory,
  readingCandidates,
  qualifiedReadingCandidates,
} from '../../../src/chinese/materials.ts'
import { buildChinesePaper } from '../../../src/chinese/build.ts'

const downlisted = JSON.parse(
  readFileSync('data/reading-catalog/downlisted.json', 'utf8'),
).readings.map((r) => r.id)
const gate = readFileSync('data/reading-catalog/quality-gate.jsonl', 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const gatePass = new Set(gate.filter((row) => row.pass).map((row) => row.id))

const line = (title) => console.log(`\n== ${title}`)
line('素材总量')
console.log({
  READING_BANK: READING_BANK.length,
  MOUNTED_READINGS: MOUNTED_READINGS.length,
  PENDING_READINGS: PENDING_READINGS.length,
  QUALIFIED: QUALIFIED_READING_BANK.length,
  PRACTICE: PRACTICE_READING_BANK.length,
})
console.log('materials.inventory.reading =', chineseMaterialInventory().reading)
console.log('readingCandidates =', readingCandidates().length,
  'qualified =', qualifiedReadingCandidates().length,
  'pending-repair =', readingCandidates().filter((x) => x.quality === 'pending-repair').length)
const pendingIds = readingCandidates().filter((x) => x.quality === 'pending-repair').map((x) => x.id)
const leaked = qualifiedReadingCandidates().filter((x) => downlisted.includes(x.id) || pendingIds.includes(x.id))
console.log('候选池混入下架/待修 =', leaked.length)

const byTheme = new Map()
for (const item of qualifiedReadingCandidates()) {
  byTheme.set(item.theme, (byTheme.get(item.theme) ?? 0) + 1)
}
console.log('主题候选数 =', Object.fromEntries(byTheme))

function summarize(result) {
  const readingItems = result.items.filter((x) => x.typeId === 'reading')
  const questions = readingItems.flatMap((x) => x.questions)
  const qtypes = { choice: 0, fill: 0, short: 0 }
  for (const q of questions) qtypes[q.type] += 1
  return {
    sections: result.sections.map((s) => `${s.typeId}:${s.selected}/${s.requested}`),
    items: result.items.length,
    readingIds: readingItems.map((x) => x.id),
    readingQuestions: questions.length,
    qtypes,
    readingLevels: [...new Set(readingItems.map((x) => x.level))],
    gaps: result.gaps.map((g) => `${g.typeId} 缺 ${g.missing}`),
  }
}

line('卷 A：只出课外阅读 5 篇')
const paperA = buildChinesePaper({
  version: 1, grade: '3A', title: '三上课外阅读专练', seed: 20261109,
  difficulty: 'mixed', totalItems: 5, includeAnswers: true,
  sections: [{ typeId: 'reading', count: 5, perItemScore: 12 }],
})
console.log(summarize(paperA))
console.log('篇内重复 =', new Set(paperA.items.map((x) => x.key)).size !== paperA.items.length)

line('卷 B：字词+积累+句子+阅读+习作混合')
const paperB = buildChinesePaper({
  version: 1, grade: '3A', title: '三上语文综合练习', seed: 20261109,
  difficulty: 'mixed', totalItems: 12, includeAnswers: true,
  sections: [
    { typeId: 'kanpinyin', count: 5, perItemScore: 1 },
    { typeId: 'gushi-fill', count: 2, perItemScore: 2 },
    { typeId: 'gaibing', count: 2, perItemScore: 2 },
    { typeId: 'reading', count: 2, perItemScore: 12 },
    { typeId: 'writing', count: 1, perItemScore: 30 },
  ],
})
console.log(summarize(paperB))

line('连出 10 套阅读卷（每套 3 篇）')
const seen = new Map()
let crossRepeat = 0
for (let i = 1; i <= 10; i += 1) {
  const result = buildChinesePaper({
    version: 1, grade: '3A', title: `阅读卷 ${i}`, seed: 20261109 + i * 7919,
    difficulty: 'mixed', totalItems: 3, includeAnswers: true,
    sections: [{ typeId: 'reading', count: 3, perItemScore: 12 }],
  })
  const s = summarize(result)
  if (new Set(s.readingIds).size !== s.readingIds.length) console.log(`卷 ${i} 篇内重复`, s.readingIds)
  for (const id of s.readingIds) {
    if (seen.has(id)) crossRepeat += 1
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  if (s.readingIds.some((id) => downlisted.includes(id))) console.log(`卷 ${i} 混入下架稿`, s.readingIds)
}
console.log('跨卷重复篇数（10 套共 30 篇中）=', crossRepeat, '去重篇数 =', seen.size)

line('按主题取篇（数据层可筛选，出卷配置暂无此字段）')
for (const theme of byTheme.keys()) {
  const pool = qualifiedReadingCandidates().filter((x) => x.theme === theme)
  const picked = pool.slice(0, 2)
  console.log(theme, '池', pool.length, '示例', picked.map((x) => `${x.id}《${x.title}》${x.questionCount}题`).join('；'))
}

line('按考点取篇（仅 268 篇挂载稿有 skill 标注）')
const skillMap = new Map()
for (const item of qualifiedReadingCandidates()) {
  for (const q of item.questions) {
    const skill = q.skill
    if (!skill) continue
    if (!skillMap.has(skill)) skillMap.set(skill, new Set())
    skillMap.get(skill).add(item.id)
  }
}
console.log(Object.fromEntries([...skillMap].map(([k, v]) => [k, v.size])))
console.log('无 skill 标注篇数 =', qualifiedReadingCandidates().filter((x) => x.questions.every((q) => !q.skill)).length)
console.log('gate pass 数 =', gatePass.size, 'gate fail 数 =', gate.length - gatePass.size,
  'downlisted =', downlisted.length)
