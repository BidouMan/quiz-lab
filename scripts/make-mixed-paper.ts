import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildPaper, recommendedCount } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type TemplateInfo } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import type { Level } from '../src/quiz/types.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

const grade = arg('grade') as '3A' | '3B' | undefined
const unitId = arg('unit')
const level = arg('level', 'L2') as Level
const seed = Number(arg('seed', '20261103'))
const name = arg('name', `v0.3.0-beta.1-${unitId ?? grade}-填空应用题-${level}`)!

if (!grade || !unitId) {
  console.error('用法: node scripts/make-mixed-paper.ts --grade 3A --unit 3A-U5 --level L3 --count 12')
  process.exit(1)
}
if (!['3A', '3B'].includes(grade)) throw new Error(`不支持的年级: ${grade}`)
if (!['L1', 'L2', 'L3'].includes(level)) throw new Error(`不支持的难度: ${level}`)

const defaults: AppConfig = {
  ...DEFAULT_CONFIG,
  grade,
  unitIds: [unitId],
  level,
  types: ['tiankong', 'word'],
  count: DEFAULT_CONFIG.count,
}
const count = Number(arg('count', String(recommendedCount(defaults))))

const config: AppConfig = {
  ...DEFAULT_CONFIG,
  grade,
  unitIds: [unitId],
  level,
  types: ['tiankong', 'word'],
  count,
}
const template: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}

const jsonPath = resolve(root, arg('json', `.quizlab/out/${name}.json`)!)
const pdfPath = resolve(root, arg('pdf', `samples/${name}.pdf`)!)
const answersPath = resolve(root, arg('answers', `.quizlab/out/${name}.answers.json`)!)
const memoryPath = resolve(root, arg('memory', '.quizlab/gen-memory.json')!)
mkdirSync(dirname(jsonPath), { recursive: true })
mkdirSync(dirname(pdfPath), { recursive: true })

const memory = existsSync(memoryPath)
  ? MemoryStore.fromJSON(readFileSync(memoryPath, 'utf8'))
  : new MemoryStore()

const result = buildPaper({ config, template, seed, memory })
if (result.count !== count) {
  console.error(`题量不足：目标 ${count}，实际 ${result.count}；${result.notes.join(' / ')}`)
  process.exit(1)
}
if (result.stats.fallback > 0) {
  console.error(`本卷出现旧题库兜底 ${result.stats.fallback} 题，不应作为 0.3.0 样张`)
  process.exit(1)
}

writeFileSync(jsonPath, JSON.stringify(result.data, null, 2) + '\n')
writeFileSync(
  answersPath,
  JSON.stringify(
    {
      title: result.data.title,
      stats: result.stats,
      sections: result.data.sections.map((section) => ({
        kind: section.kind,
        title: section.title,
        items: section.items.map((item) => ({
          id: item.id,
          text: item.text ?? item.parts?.map((part) => ('t' in part ? part.t : 'm' in part ? `$${part.m}$` : '____')).join(''),
          answers: item.answers,
          solution: item.solution,
        })),
      })),
    },
    null,
    2,
  ) + '\n',
)
writeFileSync(memoryPath, memory.toJSON())

const relJson = jsonPath.slice(root.length + 1)
const relPdf = pdfPath.slice(root.length + 1)
console.log(`题目 ${result.count} 题；生成 ${result.stats.generated}，兜底 ${result.stats.fallback}`)
console.log(`知识点：${result.stats.kpNames.join('、')}`)
for (const section of result.data.sections) {
  console.log(`  ${section.title}：${section.items.length} 题`)
}

const compile = spawnSync(
  'typst',
  [
    'compile',
    '--root',
    '.',
    '--font-path',
    'typst/fonts',
    '--input',
    `data=../${relJson}`,
    '--input',
    'body=14',
    '--input',
    'compact=1',
    '--input',
    'vert=26',
    'typst/paper.typ',
    relPdf,
  ],
  { cwd: root, stdio: 'inherit' },
)
if (compile.status !== 0) {
  console.error('typst 编译失败')
  process.exit(compile.status ?? 1)
}
console.log(`PDF: ${relPdf}`)

if (process.argv.includes('--check')) {
  const check = spawnSync('python3', ['typst/check-layout.py', '--compact', relPdf], {
    cwd: root,
    stdio: 'inherit',
  })
  if (check.status !== 0) {
    console.error('版式校验未通过')
    process.exit(check.status ?? 1)
  }
}
console.log(`答案: ${answersPath.slice(root.length + 1)}`)
