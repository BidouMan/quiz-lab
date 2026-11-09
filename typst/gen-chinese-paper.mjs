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

// ---------- 版式度量：填空横线长度按答案字数计算 ----------
// 宽 = 答案字数 × 手写单字宽度，下限 2 字、上限 15 字；字号取卷面正文 11pt（1em≈3.9mm）。
// 手写单字宽度统一取 7mm（约 1.8em）：同一个孩子写字大小差不多，所有题型同字同宽。
const PT_TO_MM = 25.4 / 72
const BLANK_FONT_PT = 11
const HANDWRITE_MM_PER_CHAR = 7
const BLANK_MIN_MM = 14
const BLANK_MAX_MM = 105
const SHORT_ANSWER_CHARS_PER_LINE = 25
// 拼音字母的平均宽度约为汉字 em 的 0.55，注音横线按字母数折算
const PINYIN_LETTER_EM = 0.55

const charCount = (text) => [...String(text ?? '')].filter((ch) => !/\s/.test(ch)).length
const round1 = (value) => Math.round(value * 10) / 10

function blankWidthFromChars(chars) {
  const em = BLANK_FONT_PT * PT_TO_MM
  const raw = chars * HANDWRITE_MM_PER_CHAR
  const width = Math.min(Math.max(raw, BLANK_MIN_MM), BLANK_MAX_MM)
  return {
    chars,
    widthMm: round1(width),
    em: round1(width / em),
    mmPerChar: round1(width / Math.max(chars, 1)),
    capped: raw > BLANK_MAX_MM + 1e-6,
    floored: raw < BLANK_MIN_MM - 1e-6,
  }
}

const blankWidth = (text) => blankWidthFromChars(charCount(text))

/** 注音横线：拼音按字母宽度估算，只留 0.6em 余量，避免线宽超过词组太多 */
function pinyinBlankWidth(pinyin, sizePt = 10) {
  const em = sizePt * PT_TO_MM
  const chars = charCount(pinyin)
  const raw = (chars * PINYIN_LETTER_EM + 0.6) * em
  const width = Math.min(Math.max(raw, 3 * em), 20 * em)
  return {
    chars,
    widthMm: round1(width),
    em: round1(width / em),
    mmPerChar: round1(width / Math.max(chars, 1)),
    capped: raw > 20 * em + 1e-6,
    floored: raw < 3 * em - 1e-6,
  }
}

/** 开放答案取参考答案字数的中位数 */
function medianChars(answers) {
  const lengths = answers.map(charCount).sort((a, b) => a - b)
  if (lengths.length === 0) return 0
  const mid = Math.floor(lengths.length / 2)
  return lengths.length % 2 ? lengths[mid] : Math.round((lengths[mid - 1] + lengths[mid]) / 2)
}

const clampLines = (chars) =>
  Math.min(Math.max(Math.ceil(chars / SHORT_ANSWER_CHARS_PER_LINE), 2), 6)

// 行数只按学生实际要写的正文估算，去掉“示例：”和末尾“也可/即可”这类家长提示
function coreAnswer(answer) {
  let a = String(answer ?? '').trim()
  a = a.replace(/^示例[:：]\s*/, '')
  const parts = a.split('。').map((s) => s.trim()).filter(Boolean)
  if (parts.length > 1) {
    const last = parts[parts.length - 1]
    if (/^(摘抄其他|预测另一种|其他合理|举自己|举其他|说清|句子通顺|意思通顺)/.test(last)) {
      parts.pop()
    }
  }
  return parts.join('。')
}

const blankRecords = []

function applyBlankMetrics(document) {
  for (const section of document.sections) {
    if (section.selected <= 0) continue

    if (section.typeId === 'reading') {
      for (const reading of section.items) {
        reading.questions.forEach((question, qi) => {
          if (question.type === 'fill') {
            question.blankWidthsMm = question.blanks.map((blank) => {
              const metric = blankWidth(blank)
              blankRecords.push({
                slot: `${section.no}·${qi + 1}`,
                kind: '短文填空',
                answer: blank,
                ...metric,
              })
              return metric.widthMm
            })
          } else if (question.type === 'short') {
            question.blankLines = clampLines(charCount(coreAnswer(question.answer)))
          }
        })
      }
    } else if (section.typeId === 'guanlian') {
      for (const [gi, group] of section.items.entries()) {
        const slots = []
        for (const variant of group.answers) {
          variant.forEach((answer, index) => {
            if (!slots[index]) slots[index] = []
            slots[index].push(answer)
          })
        }
        group.blankWidthsMm = slots.map((answers) => {
          const metric = blankWidthFromChars(medianChars(answers))
          blankRecords.push({
            slot: `${section.no}·${gi + 1}`,
            kind: '关联词',
            answer: answers.join('／'),
            ...metric,
          })
          return metric.widthMm
        })
      }
    } else if (section.typeId === 'gushi-fill') {
      for (const [gi, item] of section.items.entries()) {
        const clauses = String(item.answer).split('，')
        item.answerLines = clauses.map((clause, index) =>
          index < clauses.length - 1 ? `${clause}，` : clause,
        )
        // 一联两个分句：每个分句一条横线，中间的逗号由版式打印，
        // 分句宽度同样按「字数 × 单字宽度」算（去掉句末标点）。
        item.clauseWidthsMm = clauses.map((clause) => {
          const chars = charCount(clause.replace(/[，。？！；：、]$/, ''))
          return blankWidthFromChars(chars).widthMm
        })
        const emMm = BLANK_FONT_PT * PT_TO_MM
        // 分句之间打印一个逗号，占 5mm（与 PoemFill 的逗号格一致）
        const total = round1(
          item.clauseWidthsMm.reduce((sum, w) => sum + w, 0) + (clauses.length - 1) * 5,
        )
        item.blankWidthMm = total
        blankRecords.push({
          slot: `${section.no}·${gi + 1}`,
          kind: '诗句补全',
          answer: item.answer,
          chars: charCount(item.answer),
          widthMm: total,
          em: round1(total / emMm),
          mmPerChar: HANDWRITE_MM_PER_CHAR,
          capped: false,
          floored: false,
        })
      }
    } else if (section.typeId === 'gushi-dimo') {
      // 默写与补全同一套结构：每联一行，联内每个分句一条按字数定宽的横线
      for (const item of section.items) {
        item.blankWidthsPerLineMm = item.lines.map((line) =>
          line
            .split('，')
            .map((clause) => blankWidthFromChars(charCount(clause.replace(/[，。？！；：、]$/, ''))).widthMm),
        )
      }
    } else if (section.typeId === 'zhuyin') {
      for (const [gi, item] of section.items.entries()) {
        const metric = pinyinBlankWidth(item.pinyin, 10)
        item.blankWidthMm = metric.widthMm
        blankRecords.push({
          slot: `${section.no}·${gi + 1}`,
          kind: '注音',
          answer: item.pinyin,
          ...metric,
        })
      }
    } else if (section.typeId === 'kuoxie' || section.typeId === 'fangxie') {
      // 扩写、仿写都只写一句，固定给一行书写线
      for (const item of section.items) {
        item.blankLines = 1
      }
    }
  }
}

function printBlankStats(records) {
  if (records.length === 0) {
    console.log('填空横线：本卷没有需要按答案定长的横线。')
    return
  }
  const sorted = [...records].sort((a, b) => a.widthMm - b.widthMm)
  const shortest = sorted[0]
  const longest = sorted[sorted.length - 1]
  const emMm = BLANK_FONT_PT * PT_TO_MM
  console.log('')
  console.log(
    `填空横线（宽 = 字数 × ${HANDWRITE_MM_PER_CHAR}mm，下限 ${BLANK_MIN_MM}mm、上限 ${BLANK_MAX_MM}mm；正文 1em = ${BLANK_FONT_PT}pt ≈ ${round1(emMm)}mm）`,
  )
  console.log('题号        类型        答案                     字数   线宽        每字')
  for (const record of records) {
    const flags = record.capped ? '（封顶）' : record.floored ? '（保底）' : ''
    console.log(
      `${record.slot.padEnd(10, '　')}  ${record.kind.padEnd(6, '　')}  ${record.answer.slice(0, 22).padEnd(22, ' ')}  ${String(record.chars).padStart(3)}  ${record.widthMm.toFixed(1)}mm / ${record.em.toFixed(1)}em  ${String(record.mmPerChar ?? '-').padStart(4)}mm ${flags}`,
    )
  }
  console.log(
    `最长：${longest.slot} ${longest.kind}「${longest.answer}」${longest.chars} 字 → ${longest.widthMm.toFixed(1)}mm（${longest.em.toFixed(1)}em）`,
  )
  console.log(
    `最短：${shortest.slot} ${shortest.kind}「${shortest.answer}」${shortest.chars} 字 → ${shortest.widthMm.toFixed(1)}mm（${shortest.em.toFixed(1)}em）`,
  )
  console.log(
    `区间：${shortest.widthMm.toFixed(1)}–${longest.widthMm.toFixed(1)}mm，共 ${records.length} 条横线`,
  )
  doc.meta.blankMetrics = {
    formula: `宽 = 答案字数 × ${HANDWRITE_MM_PER_CHAR}mm，夹在 ${BLANK_MIN_MM}mm–${BLANK_MAX_MM}mm`,
    fontPt: BLANK_FONT_PT,
    emMm: round1(emMm),
    count: records.length,
    minMm: shortest.widthMm,
    maxMm: longest.widthMm,
    shortest: { slot: shortest.slot, kind: shortest.kind, answer: shortest.answer, chars: shortest.chars },
    longest: { slot: longest.slot, kind: longest.kind, answer: longest.answer, chars: longest.chars },
  }
}

applyBlankMetrics(doc)
printBlankStats(blankRecords)

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
