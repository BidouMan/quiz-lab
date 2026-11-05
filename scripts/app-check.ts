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
import { buildPaper, recommendedCount, typeAvailability } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppConfig, type AppType, type TemplateInfo } from '../src/app/types.ts'
import { TYPE_OPTIONS } from '../src/app/typstData.ts'
import { formatPaperSummary, readableAvailabilityReason, readableNotes } from '../src/app/wording.ts'
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
    unitIds: ['3A-U7'],
    level: 'L2',
    types: ['word'],
  },
  {
    slug: 'app-final-mixed',
    label: '三题型混合',
    unitIds: ['3A-U1', '3A-U2', '3A-U4', '3A-U5', '3A-U6', '3A-U7'],
    level: 'L2',
    types: ['kousuan', 'tiankong', 'word'],
    count: 30,
  },
]

let failed = false

// 界面组件必须真的调用家长文案映射，不能只改工具函数
const componentChecks: Array<{ file: string; needs: string[]; stale: string[] }> = [
  {
    file: 'src/app/DesktopApp.vue',
    needs: ['formatPaperSummary', 'readableNotes', 'shortageNote'],
    stale: ['去重命中', '未达目标', '已尽量补足'],
  },
  {
    file: 'src/app/ParamsPanel.vue',
    needs: ['readableAvailabilityReason', 'PARENT_SOURCE_LABELS'],
    stale: ['骨架包', '旧生成器'],
  },
]
for (const check of componentChecks) {
  const source = readFileSync(resolve(root, check.file), 'utf8')
  const missing = check.needs.filter((needle) => !source.includes(needle))
  const hits = check.stale.filter((word) => source.includes(word))
  if (missing.length > 0 || hits.length > 0) {
    console.error(`✗ ${check.file} 未接入家长文案：缺少 ${missing.join('、') || '无'}；残留 ${hits.join('、') || '无'}`)
    failed = true
  }
}
if (failed) process.exit(1)

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

  const buildStart = Date.now()
  const result = buildPaper({ config, template, seed: 20261104, memory })
  const buildMs = Date.now() - buildStart
  const runtime = result.stats.runtimeCheck
  console.log(`\n===== ${scenario.label}（${scenario.slug}）=====`)
  console.log(
    `目标 ${count} / 实出 ${result.count} · 骨架 ${result.stats.skeleton} · 旧生成器 ${result.stats.legacy} · 去重命中 ${result.stats.duplicates}`,
  )
  console.log(
    `运行时复核 ${runtime.checked} 题（失败 ${runtime.failed} / 剔除 ${runtime.dropped} / 重生成通过 ${runtime.regenerated}）· 出卷耗时 ${buildMs} ms`,
  )
  for (const section of result.data.sections) {
    console.log(`  ${section.title}：${section.items.length} 题`)
  }
  if (result.notes.length > 0) console.log(`  备注：${result.notes.join(' / ')}`)

  // 界面文案：结果摘要与备注必须已经换成家长可读的说法
  const labels = new Map(TYPE_OPTIONS.map((item) => [item.type, item.label]))
  const summary = formatPaperSummary(result.stats, result.count, labels)
  const parentNotes = readableNotes(result.notes)
  console.log(`  家长摘要：${summary}`)
  if (parentNotes.length > 0) console.log(`  家长备注：${parentNotes.join(' / ')}`)
  const banned = ['复核', '剔除', '去重命中', '骨架', '跨卷复用', 'LRU', '未达目标', '已尽量补足', '题池', '生成器']
  const shown = [summary, ...parentNotes].join(' ')
  const leaked = banned.filter((word) => shown.includes(word))
  if (leaked.length > 0 || !summary.includes('本卷共')) {
    console.error(`✗ 家长文案仍含工程术语：${leaked.join('、') || '缺少“本卷共”摘要'}`)
    failed = true
    continue
  }
  const availability = typeAvailability(config, template)
  const reasonLeaks = TYPE_OPTIONS.map((option) =>
    readableAvailabilityReason(availability[option.type].reason),
  ).join(' ')
  const reasonBanned = ['骨架', '生成器', 'L1', 'L2', 'L3']
  const reasonHits = reasonBanned.filter((word) => reasonLeaks.includes(word))
  if (reasonHits.length > 0) {
    console.error(`✗ 参数面板文案仍含工程术语：${reasonHits.join('、')}`)
    failed = true
    continue
  }

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
