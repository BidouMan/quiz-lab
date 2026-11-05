import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { generate } from '../src/quiz/generate.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import { toTypstPaper } from '../src/quiz/typst.ts'
import { findUnit } from '../src/data/curriculum.ts'
import type { CalcType, Grade, Level } from '../src/quiz/types.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

const grade = arg('grade') as Grade | undefined
const unitId = arg('unit')
const kpId = arg('kp')
const type = arg('type') as CalcType | undefined
const level = arg('level', 'L2') as Level
const count = Number(arg('count', '12'))
const seed = Number(arg('seed', '20261103'))

if (!grade || !type) {
  console.error('用法: node scripts/make-paper.ts --grade 3A --unit 3A-U2 --type chushi --level L3 --count 12')
  process.exit(1)
}
if (!['3A', '3B'].includes(grade)) throw new Error(`不支持的年级: ${grade}`)
if (!['kousuan', 'chushi', 'tuoshi', 'jianbian'].includes(type)) throw new Error(`不支持的题型: ${type}`)
if (!['L1', 'L2', 'L3'].includes(level)) throw new Error(`不支持的难度: ${level}`)

const stem = arg('name', `v0.2.0-beta.1-${unitId ?? grade}-${type}-${level}`)
const jsonPath = resolve(root, arg('json', `.quizlab/out/${stem}.json`)!)
const pdfPath = resolve(root, arg('pdf', `samples/${stem}.pdf`)!)
const answersPath = resolve(root, arg('answers', `.quizlab/out/${stem}.answers.json`)!)
const memoryPath = resolve(root, arg('memory', '.quizlab/gen-memory.json')!)
const typeLabels: Record<CalcType, string> = {
  kousuan: '口算',
  chushi: '竖式计算',
  tuoshi: '递等式计算',
  jianbian: '简便运算',
}
const unitName = unitId ? findUnit(unitId)?.unitName ?? unitId : grade
const title = arg('title', `三年级数学 · ${unitName} · ${typeLabels[type]}（${level}）`)!

mkdirSync(dirname(jsonPath), { recursive: true })
mkdirSync(dirname(pdfPath), { recursive: true })
mkdirSync(dirname(memoryPath), { recursive: true })

let memory: MemoryStore
if (existsSync(memoryPath)) {
  memory = MemoryStore.fromJSON(readFileSync(memoryPath, 'utf8'))
} else {
  memory = new MemoryStore()
}
memory.beginPaper()

const result = generate({
  grade,
  ...(unitId ? { unitId } : {}),
  ...(kpId ? { kpId } : {}),
  type,
  level,
  count,
  seed,
  memory,
})

const paper = toTypstPaper(result.questions, title)
writeFileSync(jsonPath, JSON.stringify(paper, null, 2) + '\n')
writeFileSync(answersPath, JSON.stringify({ meta: paper.meta, questions: result.questions }, null, 2) + '\n')
writeFileSync(memoryPath, memory.toJSON())

const relJson = jsonPath.slice(root.length + 1)
const relPdf = pdfPath.slice(root.length + 1)
// paper.typ 在 typst/ 下，json 路径相对文档目录解析
const dataPathForTypst = `../${relJson}`

console.log(`题目 ${result.count} 题；知识点 ${result.targets.map((t) => t.kpName).join('、')}`)
for (const q of result.questions.slice(0, 6)) {
  console.log(`  ${q.latex}  → ${q.answer}`)
}
if (result.questions.length > 6) console.log('  ……')

const compile = spawnSync(
  'typst',
  [
    'compile',
    '--root',
    '.',
    '--font-path',
    'typst/fonts',
    '--input',
    `data=${dataPathForTypst}`,
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

console.log(`JSON: ${relJson}`)
console.log(`答案: ${answersPath.slice(root.length + 1)}`)
