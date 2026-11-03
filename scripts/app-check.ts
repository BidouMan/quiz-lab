/**
 * 三上成品「应用出卷链路」自测。
 *
 * 走的是应用同一条代码路径：paperBuilder.buildPaper → paper-data.json →
 * 与 Tauri generate_paper 相同的 typst 参数（body=14 / compact=1 / vert=26）→ check-layout。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildPaper, recommendedCount } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type AppType, type TemplateInfo } from '../src/app/types.ts'
import { MemoryStore } from '../src/quiz/memory.ts'
import type { Level } from '../src/quiz/types.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const template: TemplateInfo = {
  path: 'typst/paper.typ',
  exists: true,
  word: true,
  compare: true,
  geom: true,
}
const memoryPath = resolve(root, '.quizlab/gen-memory.json')
const memory = existsSync(memoryPath)
  ? MemoryStore.fromJSON(readFileSync(memoryPath, 'utf8'))
  : new MemoryStore()

interface Scenario {
  slug: string
  label: string
  unitIds: string[]
  level: Level
  types: AppType[]
  count?: number
}

const scenarios: Scenario[] = [
  {
    slug: 'app-final-calc',
    label: '纯计算',
    unitIds: ['3A-U1'],
    level: 'L2',
    types: ['kousuan'],
  },
  {
    slug: 'app-final-fill',
    label: '纯填空',
    unitIds: ['3A-U1', '3A-U5'],
    level: 'L2',
    types: ['tiankong'],
  },
  {
    slug: 'app-final-word',
    label: '纯应用',
    unitIds: ['3A-U7', '3A-U9'],
    level: 'L2',
    types: ['word'],
  },
  {
    slug: 'app-final-mixed',
    label: '三题型混合',
    unitIds: ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6', '3A-U7', '3A-U8', '3A-U9'],
    level: 'L2',
    types: ['kousuan', 'tiankong', 'word'],
    count: 30,
  },
]

let failed = false

for (const scenario of scenarios) {
  const base: AppConfig = {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: scenario.unitIds,
    level: scenario.level,
    types: [...scenario.types],
    count: DEFAULT_CONFIG.count,
  }
  const count = scenario.count ?? recommendedCount(base)
  const config: AppConfig = { ...base, count }

  const result = buildPaper({ config, template, seed: 20261104, memory })
  console.log(`\n===== ${scenario.label}（${scenario.slug}）=====`)
  console.log(
    `目标 ${count} / 实出 ${result.count} · 骨架 ${result.stats.skeleton} · 旧生成器 ${result.stats.legacy} · 静态兜底 ${result.stats.fallback} · 去重命中 ${result.stats.duplicates}`,
  )
  for (const section of result.data.sections) {
    console.log(`  ${section.title}：${section.items.length} 题`)
  }
  if (result.notes.length > 0) console.log(`  备注：${result.notes.join(' / ')}`)

  if (result.count !== count) {
    console.error(`✗ 题量不足：目标 ${count}，实出 ${result.count}`)
    failed = true
    continue
  }

  const outDir = resolve(root, '.quizlab/out')
  mkdirSync(outDir, { recursive: true })
  const jsonPath = resolve(outDir, `${scenario.slug}.json`)
  writeFileSync(jsonPath, JSON.stringify(result.data, null, 2) + '\n')
  // 应用编译固定读取 .quizlab/paper-data.json
  writeFileSync(resolve(root, '.quizlab/paper-data.json'), JSON.stringify(result.data, null, 2) + '\n')

  const relPdf = `samples/${scenario.slug}.pdf`
  const compile = spawnSync(
    'typst',
    [
      'compile',
      '--root',
      '.',
      '--font-path',
      'typst/fonts',
      '--input',
      'data=/.quizlab/paper-data.json',
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
    console.error(`✗ typst 编译失败（${scenario.slug}）`)
    failed = true
    continue
  }

  const check = spawnSync('python3', ['typst/check-layout.py', '--compact', relPdf], {
    cwd: root,
    stdio: 'inherit',
  })
  if (check.status !== 0) {
    console.error(`✗ check-layout 未通过（${scenario.slug}）`)
    failed = true
    continue
  }
  console.log(`✓ ${relPdf} 编译 + check-layout 通过`)
}

writeFileSync(memoryPath, memory.toJSON())
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS')
process.exit(failed ? 1 : 0)
