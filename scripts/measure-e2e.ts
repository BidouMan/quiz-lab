/**
 * 端到端实测：生成 → 排版数据准备 → Typst 编译 → 版式校验。
 * 每个进程只跑一个场景，峰值内存分 Node 与 Typst 两段统计。
 *
 * 用法：node .quizlab/measure-e2e.ts --case single-geom --count 60
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildPaper } from '../src/app/paperBuilder.ts'
import {
  DEFAULT_CONFIG,
  type AppConfig,
  type TemplateInfo,
  type AppType,
} from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}
const UNITS = ['3A-U1', '3A-U2', '3A-U3', '3A-U4', '3A-U5', '3A-U6', '3A-U7']

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

function mixCounts(total: number): Record<string, number> {
  const weights: Array<[AppType, number]> = [
    ['kousuan', 20],
    ['chushi', 14],
    ['tuoshi', 14],
    ['tiankong', 14],
    ['word', 12],
    ['judge', 8],
    ['choice', 6],
    ['compare', 4],
    ['geom', 4],
    ['lieshi', 2],
    ['advanced', 2],
  ]
  const sum = weights.reduce((acc, [, weight]) => acc + weight, 0)
  const counts: Record<string, number> = {}
  let assigned = 0
  for (const [type, weight] of weights) {
    const value = Math.max(1, Math.round((weight / sum) * total))
    counts[type] = value
    assigned += value
  }
  counts.kousuan = Math.max(1, counts.kousuan + (total - assigned))
  return counts
}

const caseId = arg('case', 'single-geom')!
const count = Number(arg('count', '60'))

const base =
  caseId === 'mixed'
    ? {
        unitIds: UNITS,
        types: Object.keys(mixCounts(count)) as AppType[],
        counts: mixCounts(count),
      }
    : { unitIds: ['3A-U6'], types: ['geom' as AppType], counts: { geom: count } }

const config: AppConfig = {
  ...DEFAULT_CONFIG,
  grade: '3A',
  unitIds: base.unitIds,
  level: 'L2',
  types: base.types,
  counts: base.counts,
  count,
}

const memory = new MemoryStore()
const outDir = resolve(root, '.quizlab/perf')
mkdirSync(outDir, { recursive: true })
const stem = `e2e-${caseId}-${count}`

const genStart = performance.now()
const result = buildPaper({ config, template: TEMPLATE, seed: 20261105, memory })
const genMs = performance.now() - genStart

const prepStart = performance.now()
const json = JSON.stringify(result.data, null, 2) + '\n'
const jsonPath = resolve(outDir, `${stem}.json`)
writeFileSync(jsonPath, json)
const prepMs = performance.now() - prepStart
const jsonBytes = statSync(jsonPath).size

const pdfPath = resolve(outDir, `${stem}.pdf`)
const relJson = `.quizlab/perf/${stem}.json`
const compileStart = performance.now()
const compile = spawnSync(
  '/usr/bin/time',
  [
    '-l',
    'typst',
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
    `.quizlab/perf/${stem}.pdf`,
  ],
  { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
const compileMs = performance.now() - compileStart
const typstRss = /(\d+)\s+maximum resident set size/.exec(compile.stderr ?? '')
const typstRssMb = typstRss ? Math.round((Number(typstRss[1]) / 1024 / 1024) * 10) / 10 : null

const checkStart = performance.now()
const check = spawnSync('python3', ['typst/check-layout.py', '--compact', `.quizlab/perf/${stem}.pdf`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})
const checkMs = performance.now() - checkStart
const checkTail = (check.stdout ?? '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('RESULT:'))
  .pop()

const pdfBytes = statSync(pdfPath).size
const nodeRssMb = Math.round((process.resourceUsage().maxRSS / 1024) * 10) / 10

console.log(
  JSON.stringify({
    case: caseId,
    count,
    actual: result.count,
    units: base.unitIds.length,
    types: base.types.length,
    genMs: Math.round(genMs * 10) / 10,
    prepMs: Math.round(prepMs * 10) / 10,
    compileMs: Math.round(compileMs),
    checkMs: Math.round(checkMs),
    jsonBytes,
    pdfBytes,
    pdfKB: Math.round((pdfBytes / 1024) * 10) / 10,
    nodeRssMb,
    typstRssMb,
    compileStatus: compile.status,
    checkStatus: check.status,
    checkResult: checkTail ?? '',
    stderr: compile.status === 0 ? '' : (compile.stderr ?? '').slice(-400),
  }),
)
