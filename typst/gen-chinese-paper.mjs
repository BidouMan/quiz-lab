/**
 * 语文出卷 CLI：按配置生成卷面数据，供 typst/chinese-paper-3a.typ 排版。
 *
 * 用法：
 *   node typst/gen-chinese-paper.mjs
 *   node typst/gen-chinese-paper.mjs --preset compact
 *   node typst/gen-chinese-paper.mjs --config my-config.json --out typst/data/chinese-paper.json
 *
 * 预设来自 src/chinese/presets.ts；自定义配置按 src/chinese/types.ts 的 ChinesePaperConfig。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildChinesePaperDoc } from '../src/chinese/doc.ts'
import { CHINESE_PAPER_PRESETS } from '../src/chinese/presets.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultOut = path.join(here, 'data', 'chinese-paper.json')

function parseArgs(argv) {
  const options = { preset: 'default', config: null, out: defaultOut }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--preset') options.preset = argv[++i]
    else if (arg === '--config') options.config = argv[++i]
    else if (arg === '--out') options.out = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log('用法：node typst/gen-chinese-paper.mjs [--preset default|compact|gap] [--config 配置文件.json] [--out 输出.json]')
      process.exit(0)
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
let config
if (options.config) {
  const configPath = path.resolve(options.config)
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  console.log(`读取配置 ${configPath}`)
} else {
  config = CHINESE_PAPER_PRESETS[options.preset]
  if (!config) {
    throw new Error(`未知预设 ${options.preset}，可选：${Object.keys(CHINESE_PAPER_PRESETS).join(' / ')}`)
  }
}

const { doc, paper } = buildChinesePaperDoc(config)
const totalItems = doc.meta.totalItems
const requestedItems = doc.meta.requestedItems

fs.mkdirSync(path.dirname(options.out), { recursive: true })
fs.writeFileSync(options.out, JSON.stringify(doc, null, 2) + '\n')

console.log(`已写出 ${path.relative(process.cwd(), options.out)}`)
console.log(
  `卷面 ${totalItems} 题（配置 ${requestedItems}），${paper.score.total}/${paper.score.requested} 分，可判分 ${paper.score.gradable}`,
)
console.log(`题型：${paper.sections.map((s) => `${s.label} ${s.selected}/${s.requested}`).join('、')}`)
if (paper.gaps.length > 0) {
  console.log(`缺口 ${paper.gaps.length} 处：${paper.gaps.map((g) => `${g.label} 需 ${g.needed} 有 ${g.available}`).join('；')}`)
} else {
  console.log('缺口：无（所有题型素材足够）')
}
if (paper.notes.length > 0) console.log(`提示：${paper.notes.join(' ')}`)
