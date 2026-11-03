/**
 * 数据导出：把 src/ 里的真实题库转成 Typst 可读的 JSON。
 *
 * 来源：
 * - 主卷：src/data/questions.ts 的 QUESTIONS（口算 / 竖式计算 / 脱式计算 / 简便运算 / 填空）
 * - 补充节（比大小 / 图形与周长）：src/lab/LabPaper.vue 的 SECTIONS（题库里尚无这两类数据）
 *
 * 各节由题型自动归组，不再手写题号清单，也不再有手写 JSON 数据源。
 * LaTeX → Typst 数学语法在本文件一次转换；未识别的命令会汇总打印，便于补覆盖。
 *
 * 用法：node typst/gen-data.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const outDir = path.join(here, 'data')

// ---------- 1. 读取题库 TS（去类型后动态 import） ----------
async function loadTsModule(source, name, exportName) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const tmp = path.join(here, `.${name}.tmp.mjs`)
  fs.writeFileSync(tmp, js)
  try {
    const mod = await import(`file://${tmp}?t=${Date.now()}`)
    return mod[exportName]
  } finally {
    fs.rmSync(tmp)
  }
}

const QUESTIONS = await loadTsModule(
  fs.readFileSync(path.join(root, 'src/data/questions.ts'), 'utf8'),
  'questions',
  'QUESTIONS',
)

/** 从 LabPaper.vue 抽出 `const SECTIONS` 数组字面量，按 TS 转译后 import */
function loadLabSections() {
  const src = fs.readFileSync(path.join(root, 'src/lab/LabPaper.vue'), 'utf8')
  const start = src.indexOf('const SECTIONS')
  if (start < 0) throw new Error('LabPaper.vue 里找不到 SECTIONS')
  const eq = src.indexOf('=', start)
  let i = src.indexOf('[', eq)
  let depth = 0
  let end = -1
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) throw new Error('SECTIONS 数组未闭合')
  const literal = src.slice(src.indexOf('[', eq), end)
  const js = ts.transpileModule(`const SECTIONS = ${literal}; export { SECTIONS };`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const tmp = path.join(here, '.lab.tmp.mjs')
  fs.writeFileSync(tmp, js)
  try {
    return importSync(tmp)
  } finally {
    fs.rmSync(tmp)
  }
}

function importSync(file) {
  // 同步读取：LabPaper 的字面量是纯数据，没有副作用
  const { execSync } = { execSync: null }
  // 直接从转译产物里去掉 export 语句，eval 出 SECTIONS
  const src = fs.readFileSync(file, 'utf8').replace(/export\s*\{[^}]*\};?/g, '')
  // eslint-disable-next-line no-new-func
  return new Function(`${src}; return SECTIONS;`)()
}

// ---------- 2. LaTeX → Typst 数学 ----------
const stats = { commands: new Map(), unknown: new Map(), sources: new Map() }

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** 递归解析 LaTeX 数学片段；返回 Typst 数学表达式（供 typst eval 使用） */
function parseMath(src) {
  let i = 0

  const readGroup = () => {
    while (src[i] === ' ') i++
    if (src[i] === '{') {
      let depth = 1
      const start = ++i
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') depth--
        if (depth > 0) i++
      }
      const inner = src.slice(start, i)
      i++
      return inner
    }
    // 无花括号：只取一个字符（LaTeX 语义）
    const c = src[i] ?? ''
    i++
    return c
  }

  /** 参数若是单个普通字符就原样返回，避免 frac(2, 7) 这种多余括号 */
  const arg = (raw) => {
    const t = parseMath(raw).trim()
    return t
  }

  const readOptional = () => {
    while (src[i] === ' ') i++
    if (src[i] !== '[') return null
    const j = src.indexOf(']', i)
    if (j < 0) return null
    const inner = src.slice(i + 1, j)
    i = j + 1
    return inner
  }

  let out = ''
  while (i < src.length) {
    // ------- 命令 -------
    if (src[i] === '\\') {
      const nameM = /^\\([a-zA-Z]+)/.exec(src.slice(i))
      if (nameM) {
        const name = nameM[1]
        i += nameM[0].length
        count(stats.commands, `\\${name}`)
        switch (name) {
          case 'frac':
          case 'dfrac':
          case 'tfrac': {
            const a = arg(readGroup())
            const b = arg(readGroup())
            out += name === 'tfrac' ? `frac(${a}, ${b})` : `display(frac(${a}, ${b}))`
            break
          }
          case 'sqrt': {
            const deg = readOptional()
            const body = arg(readGroup())
            out += deg ? `root(${parseMath(deg)}, ${body})` : `sqrt(${body})`
            break
          }
          case 'times':
            out += 'times'
            break
          case 'div':
            out += 'div'
            break
          case 'cdot':
            out += 'dot'
            break
          case 'le':
          case 'leq':
            out += 'lt.eq'
            break
          case 'ge':
          case 'geq':
            out += 'gt.eq'
            break
          case 'ne':
          case 'neq':
            out += 'neq'
            break
          case 'lt':
            out += 'lt'
            break
          case 'gt':
            out += 'gt'
            break
          case 'approx':
            out += 'approx'
            break
          case 'equiv':
            out += 'equiv'
            break
          case 'sim':
            out += 'tilde'
            break
          case 'ldots':
            out += 'dots'
            break
          case 'cdots':
          case 'dots':
            out += 'dots'
            break
          case 'quad':
            out += 'quad'
            break
          case 'qquad':
            out += 'wide'
            break
          case 'left':
          case 'right':
          case 'big':
          case 'Big':
            break // Typst 自动缩放括号
          case 'text':
          case 'textrm':
          case 'mbox':
          case 'mathrm':
          case 'mathbf':
          case 'operatorname': {
            const body = readGroup()
            out += `text("${body.replace(/"/g, '\\"')}")`
            break
          }
          case '%':
            out += '%'
            break
          case ' ':
          case ',':
          case ';':
          case ':':
            out += ' '
            break
          default:
            count(stats.unknown, `\\${name}`)
            out += name
            break
        }
        continue
      }
      // 转义字符：\% \$ \{ \} \_ \& \# \_ 等
      const c = src[i + 1] ?? ''
      i += 2
      if (c === ' ' || c === ',' || c === ';') {
        out += ' '
      } else if (c === '_' || c === '{' || c === '}' || c === '$' || c === '%' || c === '&' || c === '#') {
        out += `"${c}"` // 数学模式里的字面字符
      } else {
        count(stats.unknown, `\\${c}`)
        out += c
      }
      continue
    }

    // ------- 上标 / 下标 -------
    if (src[i] === '^' || src[i] === '_') {
      const sym = src[i]
      i++
      const raw = readGroup()
      let body = parseMath(raw).trim()
      if (body === '') body = ' '
      out += raw.length > 1 || raw.startsWith('{') ? `${sym}(${body})` : `${sym}${body}`
      continue
    }

    // ------- 普通字符 -------
    if (src[i] === '{' || src[i] === '}') {
      i++
      continue
    }
    if (src[i] === '~') {
      out += 'space'
      i++
      continue
    }
    out += src[i++]
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** 对外入口：记录来源单词，便于统计覆盖 */
function toMath(latex, source = 'unknown') {
  count(stats.sources, source)
  return parseMath(latex)
}

// ---------- 3. 真实题库 → 题目 ----------
const OP = { add: '+', sub: '-', mul: 'times', div: 'div' }
const MODE = { add: '加法', sub: '减法', mul: '乘法', div: '除法' }

const VERT = { add: '+', sub: '-', mul: 'times', div: 'div' }

function chushiItem(q) {
  const [a, b] = q.operands
  return {
    id: q.id,
    kind: 'chushi',
    expr: `${a} ${VERT[q.op]} ${b} =`,
    blank: 30,
    meta: { op: MODE[q.op], unit: q.unitName },
  }
}

function exprItem(q, kind) {
  const expr = toMath(q.latex, q.type)
  return { id: q.id, kind, expr, lines: 3, display: expr.includes('frac') }
}

function kousuanItem(q) {
  const expr = toMath(q.latex, q.type)
  return { id: q.id, kind: 'kousuan', expr, display: expr.includes('frac') }
}

/** 填空文本拆分：$...$ 变数学片段，连续 2 个以上下划线变书写空白 */
const BLANK_MM = 18
function splitFill(text, source = 'tiankong') {
  const parts = []
  let buf = ''
  let i = 0
  const flush = () => {
    if (buf) parts.push({ t: buf })
    buf = ''
  }
  while (i < text.length) {
    if (text[i] === '$') {
      const j = text.indexOf('$', i + 1)
      if (j > i) {
        flush()
        parts.push({ m: toMath(text.slice(i + 1, j), source) })
        i = j + 1
        continue
      }
    }
    if (text[i] === '_') {
      let k = i
      while (text[k] === '_') k++
      if (k - i >= 2) {
        flush()
        parts.push({ b: BLANK_MM })
        i = k
        continue
      }
    }
    if (text[i] === '\\' && text[i + 1] === ' ') {
      buf += ' '
      i += 2
      continue
    }
    buf += text[i]
    i++
  }
  flush()
  return parts
}

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const cn = (n) => CN_NUM[n - 1] ?? String(n)

/** 按题型分组：顺序固定，标题里的序号自动分配 */
const TYPE_GROUPS = [
  { type: 'kousuan', title: '口算', numbered: false, make: kousuanItem },
  { type: 'chushi', title: '竖式计算', numbered: false, make: chushiItem },
  { type: 'tuoshi', title: '脱式计算', numbered: false, make: (q) => exprItem(q, 'tuoshi') },
  { type: 'jianbian', title: '简便运算', numbered: false, make: (q) => exprItem(q, 'tuoshi') },
  { type: 'tiankong', title: '填空', numbered: true, make: (q) => ({ id: q.id, kind: 'fill', parts: splitFill(q.text) }) },
]

function sectionsFromBank(bank) {
  return TYPE_GROUPS.map((g) => {
    const items = bank.filter((q) => q.type === g.type).map(g.make)
    return items.length ? { title: g.title, kind: g.type, numbered: g.numbered, items } : null
  }).filter(Boolean)
}

/** lab 补充节：题库里没有比大小 / 图形数据，取自 LabPaper.vue 的演示定义 */
function labSections() {
  const sections = loadLabSections()
  const out = []
  for (const sec of sections) {
    const items = []
    for (const it of sec.items) {
      if (it.kind === 'compare') {
        const pre = toMath(it.pre, 'lab-compare')
        const post = toMath(it.post, 'lab-compare')
        items.push({
          id: it.id,
          kind: 'compare',
          pre,
          post,
          display: pre.includes('frac') || post.includes('frac'),
        })
      } else if (it.kind === 'geom') {
        items.push({ id: it.id, kind: 'geom', fig: it.shape, text: it.text, blank: 15 })
      }
    }
    if (items.length) {
      out.push({
        title: sec.title.replace(/^[一二三四五六七八九十]+、/, ''),
        kind: items[0].kind,
        numbered: true,
        note: sec.note,
        items,
      })
    }
  }
  // 题库没有这两类数据；按“比大小在前、图形在后”的旧版顺序排列
  return out.sort((a, b) => (a.kind === 'compare' ? -1 : b.kind === 'compare' ? 1 : 0))
}

/** 统一加“一、二、…”序号 */
function withNumbers(sections) {
  return sections.map((sec, idx) => {
    const base = sec.title.replace(/^[一二三四五六七八九十]+、/, '')
    return { ...sec, title: `${cn(idx + 1)}、${base}` }
  })
}

const bank = QUESTIONS
const bankSections = sectionsFromBank(bank)
const lab = labSections()

const fullSections = withNumbers([...bankSections, ...lab])

// ---------- 4. 数据集 ----------
const docTitle = '三年级数学每日一练'

// 4.1 全卷：真实题库 5 节 + lab 补充 2 节
const full = { title: docTitle, sections: fullSections }

// 4.2 纯题库（不含 lab 补充）
const bankOnly = { title: docTitle, sections: withNumbers(bankSections) }

// 4.3 字号对比 20 题：按题型取前 N（8 口算 + 6 竖式 + 6 脱式），与 HTML 认可版一致
function takeByType(sections, counts) {
  return sections
    .filter((s) => counts[s.kind] !== undefined)
    .map((s) => ({ ...s, items: s.items.slice(0, counts[s.kind]) }))
}
const html20Sections = withNumbers(takeByType(bankSections, { kousuan: 8, chushi: 6, tuoshi: 6 }))

// 4.4 长卷：循环使用真题（不编题），把每节拉到跨页长度，用于续标题实测
function repeatCycle(items, n, prefix) {
  const out = []
  for (let k = 0; k < n; k++) {
    const src = items[k % items.length]
    out.push(k < items.length ? src : { ...src, id: `${prefix}-${k + 1}-${src.id}` })
  }
  return out
}
const longBankSections = withNumbers(
  bankSections.map((s) => {
    const counts = { kousuan: 60, chushi: 20, tuoshi: 16, jianbian: 8, tiankong: 28 }
    return { ...s, items: repeatCycle(s.items, counts[s.kind] ?? s.items.length, s.kind.toUpperCase()) }
  }),
)
const longLabSections = withNumbers(
  lab.map((s) => ({
    ...s,
    items: repeatCycle(s.items, s.kind === 'geom' ? 10 : 16, `${s.kind}-LAB`),
  })),
)
const longSections = longBankSections.concat(
  longLabSections.map((s, i) => {
    const num = longBankSections.length + i + 1
    return { ...s, title: `${cn(num)}、${s.title.replace(/^[一二三四五六七八九十]+、/, '')}` }
  }),
)

const long = { title: docTitle, sections: longSections }

// ---------- 5. 写出 ----------
fs.mkdirSync(outDir, { recursive: true })
const write = (name, obj) => {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2) + '\n')
  const n = obj.sections.reduce((a, s) => a + s.items.length, 0)
  console.log(`${name}: ${obj.sections.length} 节 / ${n} 题`)
}

write('questions.json', full)
write('questions-bank.json', bankOnly)
write('questions-html20.json', { title: docTitle, sections: html20Sections })
write('questions-long.json', long)

// 兼容旧的 30 题压力测试文件名：取全卷前 30 题（不再手写追加）
write('questions-30.json', {
  title: docTitle,
  sections: (() => {
    let left = 30
    return fullSections
      .map((s) => {
        const items = s.items.slice(0, Math.max(0, left))
        left -= items.length
        return { ...s, items }
      })
      .filter((s) => s.items.length)
  })(),
})

// ---------- 6. 覆盖报告 ----------
const fmtTop = (map) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}×${v}`)

console.log('\nLaTeX 命令覆盖（题库 + lab）：')
console.log('  已转换:', fmtTop(stats.commands).join(', ') || '（无）')
console.log('  未识别:', fmtTop(stats.unknown).join(', ') || '（无）')
console.log('  数学片段来源:', fmtTop(stats.sources).join(', '))
