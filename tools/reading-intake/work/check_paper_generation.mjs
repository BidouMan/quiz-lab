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
const candidates = readingCandidates()
console.log(
  'readingCandidates =',
  candidates.length,
  'qualified =',
  qualifiedReadingCandidates().length,
  'pending-repair =',
  candidates.filter((x) => x.quality === 'pending-repair').length,
)

line('字段可见性（mounted 268 篇）')
const mountedIds = new Set(MOUNTED_READINGS.map((x) => x.id))
const withSkills = candidates.filter((x) => x.skills.length > 0).length
const missingSkill = candidates
  .filter((x) => mountedIds.has(x.id) && x.skills.length === 0)
  .map((x) => x.id)
const selectedMissingSkills = candidates.filter((x) => x.skills.length === 0).length
console.log({
  candidatesWithSkills: withSkills,
  mountedMissingSkills: missingSkill.length,
  selectedBankWithoutSkill: selectedMissingSkills - missingSkill.length,
  levels: Object.fromEntries(
    ['A', 'B', 'C'].map((lv) => [lv, candidates.filter((x) => x.level === lv).length]),
  ),
  themes: Object.fromEntries(
    [...new Set(candidates.map((x) => x.theme))].map((t) => [
      t,
      candidates.filter((x) => x.theme === t).length,
    ]),
  ),
})

const skillPoolSize = (skills) =>
  qualifiedReadingCandidates().filter((x) => x.skills.some((s) => skills.includes(s))).length
const themePoolSize = (themes) =>
  qualifiedReadingCandidates().filter((x) => themes.includes(x.theme)).length
console.log(
  '按考点可出卷篇数 =',
  Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [`SK${i}`, skillPoolSize([`SK${i}`])])),
)
console.log(
  '按主题可出卷篇数 =',
  Object.fromEntries([...new Set(candidates.map((x) => x.theme))].map((t) => [t, themePoolSize([t])]),
))

function summarize(result, filter) {
  const readingItems = result.items.filter((x) => x.typeId === 'reading')
  const questions = readingItems.flatMap((x) => x.questions)
  const qtypes = { choice: 0, fill: 0, short: 0 }
  for (const q of questions) qtypes[q.type] += 1
  const hitSkills = new Set(readingItems.flatMap((x) => x.skills))
  return {
    selected: readingItems.length,
    questions: questions.length,
    qtypes,
    themes: [...new Set(readingItems.map((x) => x.theme))],
    levels: [...new Set(readingItems.map((x) => x.level))],
    skills: [...hitSkills].sort(),
    ids: readingItems.map((x) => x.id),
    filter,
    gaps: result.gaps.map((g) => g.message),
    notes: result.notes,
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.log('  ✗ 断言失败：' + msg)
    process.exitCode = 1
  }
}

function specialPaper({ title, skills, themes, difficulty = 'mixed', count = 3, seed = 20261109 }) {
  const result = buildChinesePaper({
    version: 1,
    grade: '3A',
    title,
    seed,
    difficulty,
    totalItems: count,
    includeAnswers: true,
    sections: [{ typeId: 'reading', count, perItemScore: 12, skills, themes }],
  })
  const s = summarize(result, { skills, themes, difficulty })
  console.log(`${title}: 篇 ${s.selected}/${count}，题 ${s.questions}（选${s.qtypes.choice}/填${s.qtypes.fill}/简${s.qtypes.short}），`
    + `主题 ${s.themes.join('/')}，难度 ${s.levels.join('/')}，考点 ${s.skills.join('/')}`)
  console.log('  篇目：' + s.ids.join(' '))
  if (s.gaps.length) console.log('  缺口：' + s.gaps.join(' | '))
  // 不含无关篇：每篇必须命中筛选条件，且不混入下架/待修
  const itemMap = new Map(candidates.map((x) => [x.id, x]))
  for (const id of s.ids) {
    const item = itemMap.get(id)
    assert(item, `篇目 ${id} 不在候选池`)
    if (!item) continue
    if (skills) assert(item.skills.some((k) => skills.includes(k)), `${id} 未命中所选考点 ${skills}`)
    if (themes) assert(themes.includes(item.theme), `${id} 主题 ${item.theme} 不在 ${themes}`)
    if (difficulty !== 'mixed') assert(item.level === difficulty, `${id} 难度 ${item.level} 不是 ${difficulty}`)
    assert(!downlisted.includes(id), `${id} 是下架稿`)
    assert(item.quality === 'qualified', `${id} 是待修稿`)
  }
  assert(new Set(s.ids).size === s.ids.length, `${title} 篇内重复`)
  return s
}

line('专项卷：SK2')
specialPaper({ title: 'SK2 专项卷', skills: ['SK2'] })
line('专项卷：SK4')
specialPaper({ title: 'SK4 专项卷', skills: ['SK4'] })
line('专项卷：SK7')
specialPaper({ title: 'SK7 专项卷', skills: ['SK7'] })
line('专项卷：写景主题')
specialPaper({ title: '写景主题卷', themes: ['写景'] })
line('专项卷：难度易（A 档）')
specialPaper({ title: '难度易卷', difficulty: 'A' })
line('专项卷：SK2 + 写景（组合筛选）')
specialPaper({ title: 'SK2+写景组合卷', skills: ['SK2'], themes: ['写景'] })
line('素材不足：记事主题请求 5 篇（实际仅 2 篇）')
specialPaper({ title: '记事主题卷（不足）', themes: ['记事'], count: 5 })

line('SK7 可出卷上限')
const sk7Pool = qualifiedReadingCandidates().filter((x) => x.skills.includes('SK7'))
const sk7Paper = buildChinesePaper({
  version: 1, grade: '3A', title: 'SK7 全量卷', seed: 20261110,
  difficulty: 'mixed', totalItems: 20, includeAnswers: true,
  sections: [{ typeId: 'reading', count: 20, perItemScore: 12, skills: ['SK7'] }],
})
const sk7 = summarize(sk7Paper, { skills: ['SK7'] })
console.log(`候选 ${sk7Pool.length} 篇，请求 20 篇，实排 ${sk7.selected} 篇，缺口 ${sk7.gaps.length}`)
console.log('  篇目：' + sk7.ids.join(' '))

line('SK7 超额请求 25 篇（候选仅 20）')
const sk7Over = buildChinesePaper({
  version: 1, grade: '3A', title: 'SK7 超额卷', seed: 20261111,
  difficulty: 'mixed', totalItems: 25, includeAnswers: true,
  sections: [{ typeId: 'reading', count: 25, perItemScore: 12, skills: ['SK7'] }],
})
const sk7o = summarize(sk7Over, { skills: ['SK7'] })
console.log(`实排 ${sk7o.selected}/25 篇，缺口：${sk7o.gaps.join(' | ')}`)

line('连出 10 套 SK2 专项卷（每套 3 篇）')
const seen = new Map()
for (let i = 1; i <= 10; i += 1) {
  const result = buildChinesePaper({
    version: 1, grade: '3A', title: `SK2 专项卷 ${i}`, seed: 20261109 + i * 7919,
    difficulty: 'mixed', totalItems: 3, includeAnswers: true,
    sections: [{ typeId: 'reading', count: 3, perItemScore: 12, skills: ['SK2'] }],
  })
  const s = summarize(result, { skills: ['SK2'] })
  if (new Set(s.ids).size !== s.ids.length) console.log(`  卷 ${i} 篇内重复`, s.ids)
  for (const id of s.ids) seen.set(id, (seen.get(id) ?? 0) + 1)
  console.log(`  卷 ${i}: ${s.ids.join(' ')}`)
}
const repeats = [...seen.values()].filter((n) => n > 1).length
console.log('10 套共 30 篇位置，去重篇数 =', seen.size, '，被重复使用的篇数 =', repeats,
  '，跨卷重复位置 =', 30 - seen.size)

line('连出 10 套 SK7 专项卷（每套 3 篇）')
const seen7 = new Map()
for (let i = 1; i <= 10; i += 1) {
  const result = buildChinesePaper({
    version: 1, grade: '3A', title: `SK7 专项卷 ${i}`, seed: 20261109 + i * 7919,
    difficulty: 'mixed', totalItems: 3, includeAnswers: true,
    sections: [{ typeId: 'reading', count: 3, perItemScore: 12, skills: ['SK7'] }],
  })
  for (const id of result.items.map((x) => x.id)) seen7.set(id, (seen7.get(id) ?? 0) + 1)
}
console.log('10 套共 30 篇位置，去重篇数 =', seen7.size, '，被重复使用的篇数 =',
  [...seen7.values()].filter((n) => n > 1).length, '，跨卷重复位置 =', 30 - seen7.size)

line('gate 统计')
console.log('gate pass 数 =', gatePass.size, 'gate fail 数 =', gate.length - gatePass.size,
  'downlisted =', downlisted.length)
