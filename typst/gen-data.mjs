/**
 * 数据导出：按 Tauri 桌面端同一条出卷链路（buildPaper → typstData）生成 Typst 可读的 JSON。
 *
 * 来源：src/app/paperBuilder.ts 的 buildPaper（骨架包 + 旧生成器 + 比大小/图形静态示例），
 * 不再读取任何手写题库或 Vue 页面里的演示数据。
 *
 * 输出：
 * - questions.json：全卷（含比大小 / 图形与周长示例节），paper.typ 的默认输入
 * - questions-bank.json：去掉比大小 / 图形示例的生成器卷
 * - questions-html20.json：口算 8 / 竖式 6 / 递等式 6 的字号对比卷
 * - questions-long.json：按题型拉长到跨页，用于续标题实测
 * - questions-30.json：全卷前 30 题
 *
 * 用法：node typst/gen-data.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPaper } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG } from '../src/app/types.ts'
import { STATIC_SAMPLES, TYPE_ORDER, typeLabel } from '../src/app/typstData.ts'
import { CURRICULUM } from '../src/data/curriculum.ts'
import { MemoryStore } from '../src/quiz/memory.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'data')

// ---------- 1. 走应用同一条出卷链路 ----------
const template = { path: 'typst/paper.typ', exists: true, word: true, compare: true, geom: true }
const unitIds = CURRICULUM.units.filter((unit) => unit.grade === '3A').map((unit) => unit.unitId)
const result = buildPaper({
  config: { ...DEFAULT_CONFIG, grade: '3A', unitIds, level: 'L2', types: TYPE_ORDER, count: 40 },
  template,
  seed: 20261104,
  memory: new MemoryStore(),
})

if (result.notes.length > 0) console.log(`出卷说明：${result.notes.join(' / ')}`)

// ---------- 2. 数据集变形 ----------
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const cn = (n) => CN_NUM[n - 1] ?? String(n)
const stripNo = (title) => title.replace(/^[一二三四五六七八九十]+、/, '')
const withNumbers = (sections) => sections.map((sec, idx) => ({ ...sec, title: `${cn(idx + 1)}、${stripNo(sec.title)}` }))

const fullTitle = result.data.title
const sections = result.data.sections
// 比大小 / 图形示例按配额分配可能被挤掉，这里固定补成完整示例节，保证版式覆盖
const SAMPLE_KINDS = ['compare', 'geom']
const bankSections = sections.filter((sec) => !SAMPLE_KINDS.includes(sec.kind))
const sampleSections = SAMPLE_KINDS.map((kind) => ({
  title: typeLabel(kind),
  kind,
  numbered: true,
  items: [...(STATIC_SAMPLES[kind] ?? [])],
})).filter((sec) => sec.items.length > 0)
const fullSections = withNumbers([...bankSections, ...sampleSections])

function takeByKind(source, counts) {
  return withNumbers(
    source
      .filter((sec) => counts[sec.kind] !== undefined)
      .map((sec) => ({ ...sec, items: sec.items.slice(0, counts[sec.kind]) }))
      .filter((sec) => sec.items.length > 0),
  )
}

/** 循环复用同一节的题（不编题），把每节拉到指定长度，用于跨页/续标题实测 */
function repeatCycle(items, n, prefix) {
  const out = []
  for (let k = 0; k < n; k++) {
    const src = items[k % items.length]
    out.push(k < items.length ? src : { ...src, id: `${prefix}-${k + 1}-${src.id}` })
  }
  return out
}

const LONG_COUNTS = { kousuan: 60, chushi: 20, tuoshi: 16, jianbian: 8, tiankong: 28, compare: 16, geom: 10 }
const longSections = withNumbers(
  fullSections.map((sec) => ({
    ...sec,
    items: repeatCycle(sec.items, LONG_COUNTS[sec.kind] ?? sec.items.length, sec.kind.toUpperCase()),
  })),
)

const first30 = (() => {
  let left = 30
  return fullSections
    .map((sec) => {
      const items = sec.items.slice(0, Math.max(0, left))
      left -= items.length
      return { ...sec, items }
    })
    .filter((sec) => sec.items.length)
})()

// ---------- 3. 写出 ----------
fs.mkdirSync(outDir, { recursive: true })
const write = (name, obj) => {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2) + '\n')
  const n = obj.sections.reduce((sum, sec) => sum + sec.items.length, 0)
  console.log(`${name}: ${obj.sections.length} 节 / ${n} 题`)
}

write('questions.json', { title: fullTitle, sections: fullSections })
write('questions-bank.json', { title: fullTitle, sections: withNumbers(bankSections) })
write('questions-html20.json', { title: fullTitle, sections: takeByKind(bankSections, { kousuan: 8, chushi: 6, tuoshi: 6 }) })
write('questions-long.json', { title: fullTitle, sections: longSections })
write('questions-30.json', { title: fullTitle, sections: first30 })
