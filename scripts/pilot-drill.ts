/**
 * 骨架试点出卷脚本（独立输出目录 .quizlab/pilot，不碰 dev 实例与端口）。
 *
 * 用法：
 *   node scripts/pilot-drill.ts --combo '3A-U6|word|L2' --count 30 --seed 20261103 --pdf --check
 *   node scripts/pilot-drill.ts --combo ... --sample 10        # 打印前 10 题供教师自评
 *   node scripts/pilot-drill.ts --mix 'A,B,C' --count 20 --seed ... --slug mix-1 --pdf --check
 *       # 跨组合混合卷：共享一套已用集合，验证跨组合的场景/题干不撞
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  COMBOS,
  buildComboPaper,
  createUsedSets,
  getCombo,
  stats,
  verifyPaper,
  verifyQuestion,
  type Combo,
  type PilotPaper,
} from '../src/quiz/skeleton/index.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : fallback
}

const combos = COMBOS
const comboId = arg('combo', combos[0]?.id)
if (!comboId) throw new Error('没有已注册的组合')
const count = Number(arg('count', '30'))
const seed = Number(arg('seed', '20261103'))
const sample = Number(arg('sample', '0'))
const wantPdf = process.argv.includes('--pdf')
const wantCheck = process.argv.includes('--check')
const slugArg = arg('slug')
const mixArg = arg('mix')

if (mixArg) {
  runMix(mixArg)
  process.exit(0)
}

const combo = getCombo(comboId)
const started = Date.now()
const paper = buildComboPaper(combo, { count, seed })
const issues = verifyPaper(paper, combo)
const stat = stats(paper, combo)

console.log(`组合 ${combo.id}（${combo.unitName} · ${combo.level}）`)
console.log(
  `题量 ${stat.count} | 句式 ${stat.skeletons} | 场景 ${stat.scenes} | 数值 ${stat.values} | 做法 ${stat.practices}`,
)
console.log('做法分布：' + Object.entries(stat.practiceBreakdown).map(([label, n]) => `${label} ${n}`).join(' / '))
console.log(`零重复：句式 ${stat.skeletons === stat.count ? '0 重复' : '有重复'} / 场景 ${stat.scenes === stat.count ? '0 重复' : '有重复'} / 数值 ${stat.values === stat.count ? '0 重复' : '有重复'}`)

if (issues.length > 0) {
  console.log(`独立复核：${issues.length} 条问题`)
  for (const issue of issues.slice(0, 30)) console.log(`  [${issue.code}] ${issue.questionId} ${issue.message}`)
  process.exit(1)
}
console.log('独立复核：PASS（每题答案由参数重算并比对，单位与问句一致）')

if (sample > 0) {
  console.log('\n—— 抽样 ——')
  for (const question of paper.questions.slice(0, sample)) {
    console.log(`${question.id} 〔${question.practice}/${question.skeletonId}〕`)
    console.log(`  ${question.stem}`)
    console.log(`  答案：${question.answers.join('；')}`)
  }
}

const outDir = resolve(root, '.quizlab/pilot')
mkdirSync(outDir, { recursive: true })
const stem = `${combo.slug}-seed${seed}-n${count}`
const jsonPath = resolve(outDir, `${stem}.json`)
const answersPath = resolve(outDir, `${stem}.answers.json`)
writeFileSync(jsonPath, JSON.stringify(paper.data, null, 2))
writeFileSync(
  answersPath,
  JSON.stringify(
    {
      combo: combo.id,
      seed,
      questions: paper.questions.map((question) => ({
        id: question.id,
        skeletonId: question.skeletonId,
        practice: question.practice,
        sceneId: question.sceneId,
        sceneKey: question.sceneKey,
        params: question.params,
        answers: question.answers,
        steps: question.steps,
      })),
    },
    null,
    2,
  ),
)
console.log(`题目 JSON：${jsonPath.slice(root.length + 1)}`)

if (wantPdf) {
  const relJson = jsonPath.slice(root.length + 1)
  const relPdf = `samples/pilot-${combo.slug}-drill.pdf`
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
  console.log(`PDF：${relPdf}`)
  if (wantCheck) {
    const check = spawnSync('python3', ['typst/check-layout.py', '--compact', relPdf], {
      cwd: root,
      stdio: 'inherit',
    })
    if (check.status !== 0) process.exit(check.status ?? 1)
  }
}

console.log(`耗时 ${Date.now() - started} ms`)

/** 跨组合混合卷：共享一套 used 集合，任何场景/数值/题干都不能跨组合重复 */
function runMix(mixArg: string): void {
  const started = Date.now()
  const ids = mixArg.split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length < 2) throw new Error('--mix 至少需要 2 个组合')
  const picked: Combo[] = ids.map((id) => getCombo(id))
  const base = Math.floor(count / picked.length)
  const counts = picked.map((_, i) => base + (i < count % picked.length ? 1 : 0))
  const used = createUsedSets()
  const papers = picked.map((combo, i) => buildComboPaper(combo, { count: counts[i], seed: seed + i * 31, used }))

  const questions = papers.flatMap((paper) => paper.questions)
  const numeral = '一二三四五六七八九十'
  const sections = papers.flatMap((paper, i) =>
    paper.data.sections.map((section) => ({ ...section, title: `${numeral[i] ?? i + 1}、${picked[i].unitName}` })),
  )
  const title =
    picked.length <= 3
      ? `跨组合混合卷 · ${picked.map((combo) => combo.unitName).join(' / ')}`
      : `跨组合混合卷 · ${picked.length} 个包`
  const merged: PilotPaper = { title, data: { title, sections }, questions }

  const issues = papers.flatMap((paper, i) => paper.questions.flatMap((question) => verifyQuestion(question, picked[i])))
  const stat = stats(merged, picked[0])

  const templates = questions.map((question) => {
    const combo = picked.find((item) => item.id === question.comboId)!
    return combo.skeletons.find((item) => item.id === question.skeletonId)!.template
  })
  const sceneDup = questions.length - new Set(questions.map((q) => q.sceneKey)).size
  const textDup = questions.length - new Set(questions.map((q) => q.stem.replace(/\d+/g, '#'))).size
  const templateDup = questions.length - new Set(templates).size

  console.log(`混合卷 ${picked.map((combo) => combo.id).join(' + ')}`)
  console.log(
    `题量 ${stat.count} | 句式 ${stat.skeletons} | 场景 ${stat.scenes} | 数值 ${stat.values} | 做法 ${stat.practices}`,
  )
  console.log('分组合：' + picked.map((combo, i) => `${combo.unitName} ${counts[i]}`).join(' / '))
  console.log(`跨组合校验：场景撞 ${sceneDup} / 题干撞 ${textDup} / 句式模板撞 ${templateDup}`)

  if (issues.length > 0) {
    console.log(`独立复核：${issues.length} 条问题`)
    for (const issue of issues.slice(0, 30)) console.log(`  [${issue.code}] ${issue.questionId} ${issue.message}`)
    process.exit(1)
  }
  console.log('独立复核：PASS（每题答案由参数重算并比对，单位与问句一致）')

  if (sample > 0) {
    console.log('\n—— 抽样 ——')
    for (const question of questions.slice(0, sample)) {
      console.log(`${question.id} 〔${question.practice}/${question.skeletonId}〕`)
      console.log(`  ${question.stem}`)
      console.log(`  答案：${question.answers.join('；')}`)
    }
  }

  const outDir = resolve(root, '.quizlab/pilot')
  mkdirSync(outDir, { recursive: true })
  const slug = slugArg ?? 'mix'
  const stem = `${slug}-seed${seed}-n${count}`
  const jsonPath = resolve(outDir, `${stem}.json`)
  const answersPath = resolve(outDir, `${stem}.answers.json`)
  writeFileSync(jsonPath, JSON.stringify(merged.data, null, 2))
  writeFileSync(
    answersPath,
    JSON.stringify(
      {
        combos: picked.map((combo) => combo.id),
        seed,
        questions: questions.map((question) => ({
          id: question.id,
          comboId: question.comboId,
          skeletonId: question.skeletonId,
          practice: question.practice,
          sceneId: question.sceneId,
          sceneKey: question.sceneKey,
          params: question.params,
          answers: question.answers,
          steps: question.steps,
        })),
      },
      null,
      2,
    ),
  )
  console.log(`题目 JSON：${jsonPath.slice(root.length + 1)}`)

  if (wantPdf) {
    const relJson = jsonPath.slice(root.length + 1)
    const relPdf = `samples/pilot-${slug}-drill.pdf`
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
    console.log(`PDF：${relPdf}`)
    if (wantCheck) {
      const check = spawnSync('python3', ['typst/check-layout.py', '--compact', relPdf], {
        cwd: root,
        stdio: 'inherit',
      })
      if (check.status !== 0) process.exit(check.status ?? 1)
    }
  }

  console.log(`耗时 ${Date.now() - started} ms`)
}
