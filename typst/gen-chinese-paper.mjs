/**
 * 语文三上完整卷样张的数据装配。
 *
 * 只从 src/data/chinese 里挑已 verified 且有来源的素材，不在这里新造题目；
 * 形近字组词的参考答案和看拼音写词语的拼音属于试卷标注，答案不唯一/为通用读音，
 * 会在答案页与附录里写明。
 *
 * 输出：typst/data/chinese-3a-paper.json，供 typst/chinese-paper-3a.typ 排版。
 * 用法：node typst/gen-chinese-paper.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHINESE_CURRICULUM_3A } from '../src/data/chinese/curriculum.ts'
import {
  BIAODIAN_ITEMS,
  FANGXIE_ITEMS,
  GAIBING_ITEMS,
  GUANLIAN_ITEMS,
} from '../src/data/chinese/sentences/index.ts'
import { READING_BANK } from '../src/data/chinese/readings/index.ts'
import { WRITING_PROMPTS } from '../src/data/chinese/writing.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, 'data', 'chinese-3a-paper.json')

const assertVerified = (item, where) => {
  if (item.status !== 'verified') throw new Error(`${where} 不是 verified`)
  if (!item.sources || item.sources.length === 0) throw new Error(`${where} 缺少 sources`)
  for (const source of item.sources) {
    if (!source.locator) throw new Error(`${where} 的来源缺少可定位 locator`)
  }
  return item
}

const pickById = (items, id, where) => {
  const hit = items.find((item) => item.id === id)
  if (!hit) throw new Error(`${where} 找不到 ${id}`)
  return assertVerified(hit, `${where} ${id}`)
}

const lessons = CHINESE_CURRICULUM_3A.units.flatMap((unit) => unit.lessons)
const lesson = (no) => {
  const hit = lessons.find((item) => item.no === no)
  if (!hit) throw new Error(`找不到第 ${no} 课`)
  return hit
}

// ---------- 字词 ----------

// 第 1–2 课共有 10 条 verified 词语，正好整组用作“看拼音写词语 10 分”。
const WORD_PINYIN = {
  洁白: 'jié bái',
  飘扬: 'piāo yáng',
  粗壮: 'cū zhuàng',
  热闹: 'rè nao',
  阵雨: 'zhèn yǔ',
  湿润: 'shī rùn',
  风笛: 'fēng dí',
  功课: 'gōng kè',
  急忙: 'jí máng',
  狂欢: 'kuáng huān',
}
const words = [...lesson(1).words, ...lesson(2).words]
if (words.length !== 10) throw new Error(`词语应为 10 条，实际 ${words.length}`)
const wordItems = words.map((word) => {
  assertVerified(word, `词语「${word.word}」`)
  const pinyin = WORD_PINYIN[word.word]
  if (!pinyin) throw new Error(`缺少「${word.word}」的拼音标注`)
  return { word: word.word, pinyin, source: word.sources.map((s) => s.label).join('；') }
})

// 识字表 6 字：第 1 课 5 字 + 第 2 课多音字“假”。
const ZHUYIN_CONTEXT = { 绒: '绒球', 昂: '昂头', 凤: '凤尾竹', 墙: '墙壁', 晃: '晃动', 假: '放假' }
const zhuyinChars = [...lesson(1).renzi, ...lesson(2).renzi.filter((c) => c.char === '假')]
if (zhuyinChars.length !== 6) throw new Error(`注音应为 6 字，实际 ${zhuyinChars.length}`)
const zhuyin = zhuyinChars.map((char) => {
  assertVerified(char, `识字「${char.char}」`)
  const context = ZHUYIN_CONTEXT[char.char]
  if (!context) throw new Error(`缺少「${char.char}」的语境标注`)
  return { char: char.char, pinyin: char.pinyin, context, source: char.sources.map((s) => s.label).join('；') }
})

// 形近字：题面字取自第 1–4 课写字表；配对字是常用形近字，参考答案不唯一。
const xingjin = [
  { a: '坡', b: '波', aAnswer: '山坡', bAnswer: '波浪' },
  { a: '扬', b: '杨', aAnswer: '飞扬', bAnswer: '杨树' },
  { a: '壮', b: '状', aAnswer: '雄壮', bAnswer: '形状' },
  { a: '飘', b: '漂', aAnswer: '飘动', bAnswer: '漂浮' },
  { a: '粗', b: '组', aAnswer: '粗心', bAnswer: '小组' },
  { a: '径', b: '经', aAnswer: '小径', bAnswer: '经过' },
]
const xieziChars = new Set(lessons.flatMap((item) => item.xiezi.map((c) => c.char)))
for (const pair of xingjin) {
  if (!xieziChars.has(pair.a)) throw new Error(`形近字题面「${pair.a}」不在第 1–4 课写字表`)
}

// ---------- 古诗 ----------

const poemByTitle = (title) => {
  for (const item of lessons) {
    const hit = (item.poems ?? []).find((poem) => poem.title === title)
    if (hit) return assertVerified(hit, `古诗《${title}》`)
  }
  throw new Error(`找不到古诗《${title}》`)
}

const fillPoems = ['山行', '望洞庭', '夜书所见', '望天门山', '饮湖上初晴后雨'].map((title) => {
  const poem = poemByTitle(title)
  const [promptLine, answerLine] = poem.lines
  return {
    title: poem.title,
    dynasty: poem.dynasty,
    author: poem.author,
    prompt: promptLine,
    answer: answerLine.replace(/[。！？]$/, ''),
    source: poem.sources.map((s) => s.label).join('；'),
  }
})
const dimoPoem = poemByTitle('鹿柴')

// ---------- 句子 ----------

const gaibing = ['GB-11', 'GB-25'].map((id) => {
  const item = pickById(GAIBING_ITEMS, id, '病句')
  return {
    id: item.id,
    subkind: item.subkind,
    level: item.level,
    broken: item.broken,
    fixed: item.fixed,
    acceptable: item.acceptable,
  }
})

const guanlian = ['GL-14', 'GL-21'].map((id) => {
  const item = pickById(GUANLIAN_ITEMS, id, '关联词')
  return {
    id: item.id,
    level: item.level,
    text: item.text,
    blanks: item.blanks,
    pair: item.pair,
  }
})

const biaodianItem = pickById(BIAODIAN_ITEMS, 'BD-16', '标点')
const biaodian = {
  id: biaodianItem.id,
  level: biaodianItem.level,
  text: biaodianItem.text,
  blanks: biaodianItem.blanks,
  rule: biaodianItem.rule,
}

const fangxieItem = pickById(FANGXIE_ITEMS, 'FP-22', '仿写')
const fangxie = {
  id: fangxieItem.id,
  level: fangxieItem.level,
  mode: fangxieItem.mode,
  example: fangxieItem.example,
  prompt: fangxieItem.prompt,
  samples: fangxieItem.samples,
  keywords: fangxieItem.keywords,
}

// ---------- 课外阅读 ----------

const reading = pickById(READING_BANK, 'RD-01', '课外阅读')
const readingQuestionPoints = [2, 2, 2, 6]
if (reading.questions.length !== readingQuestionPoints.length) {
  throw new Error(`RD-01 题量应为 ${readingQuestionPoints.length}，实际 ${reading.questions.length}`)
}
const readingOut = {
  id: reading.id,
  title: reading.title,
  theme: reading.theme,
  paragraphs: reading.paragraphs,
  questions: reading.questions.map((question, index) => ({
    ...question,
    score: readingQuestionPoints[index],
  })),
}

// ---------- 习作 ----------

const writing = pickById(WRITING_PROMPTS, 'XZ-06', '习作')
const writingOut = {
  id: writing.id,
  unitId: writing.unitId,
  unitName: writing.unitName,
  title: writing.title,
  prompt: writing.prompt,
  requirements: writing.requirements,
  wordCount: writing.wordCount,
}

// ---------- 卷面构成与缺口 ----------

const composition = [
  { no: '一', title: '看拼音写词语', score: 10, judge: '按答案判分', basis: '第 1–2 课词语 10 条（verified）' },
  { no: '二', title: '给加点字注音', score: 6, judge: '按答案判分', basis: '第 1 课识字 5 字 + 第 2 课多音字“假”（verified）' },
  { no: '三', title: '形近字组词', score: 6, judge: '参考答案，答案不唯一', basis: '题面字取第 1–4 课写字表（verified）' },
  { no: '四', title: '古诗积累', score: 13, judge: '按答案判分', basis: '第 4 课 3 首 + 第 20 课 3 首（verified）' },
  {
    no: '五',
    title: '句子运用',
    score: 10,
    judge: '按答案/可枚举答案判分',
    basis: '句子库 GB-11、GB-25、GL-14、GL-21、BD-16、FP-22（verified）',
  },
  { no: '六', title: '课内阅读', score: 10, judge: '留空，暂不可判', basis: '缺教材课文页（原文 + 课后题 + 答案）' },
  { no: '七', title: '课外阅读', score: 12, judge: '客观 + 评分点', basis: '阅读库 RD-01《修鞋的爷爷》（verified）' },
  { no: '八', title: '习作', score: 30, judge: '只出题，人工评阅', basis: '习作库 XZ-06《这儿真美》（verified）' },
  { no: '九', title: '卷面书写', score: 3, judge: '人工评分', basis: '题型表 §2.5：卷面书写 2–3 分' },
]

const gaps = [
  {
    title: '课内阅读 10 分',
    need: '第 1–4 课或第 20 课课文原文段落、课后题与参考答案；数据层只有字词表和古诗，没有课文正文，因此留空，不用课外短文顶替。',
  },
  {
    title: '字词覆盖面',
    need: '现有字词只到第 1–4 课（写字 34、识字 15、词语 12）；第 5–26 课字表未核到，按约定留空，字词题只能集中在前两单元。',
  },
  {
    title: '课外阅读储备',
    need: '24 篇均为原创，但每篇 252–272 字，接近 250 字下限；真实三上卷常用 300–400 字，并可能出现第二篇阅读或非连续性文本。',
  },
  {
    title: '古诗存量',
    need: '只有 6 首 verified 古诗，本卷已全用（5 首补全 + 1 首默写），下一卷必然重复；语文园地“日积月累”仍缺教材页。',
  },
  {
    title: '句子题型覆盖',
    need: '句子库五类齐全，但 10 分只够排四类（病句、关联词、标点、仿写），扩写未入卷；口语交际与情境表达需教材页，本轮未做。',
  },
  {
    title: '习作判分',
    need: '习作库 8 条可轮换，但按约定只给题目、提示、字数与书写空间，不提供评分标准或范文，不能自动判分，需教师按教材要求评阅。',
  },
  {
    title: '其他常见题型',
    need: '词语搭配、近反义词、选字填空、按课文内容填空、名言警句等都需要教材页或专门题库；本轮没有用未核实素材临时凑题。',
  },
]

const paper = {
  meta: {
    title: '三年级语文上册 期末综合练习',
    subtitle: '统编版·五四学制 2025 年秋修订版　｜　满分 100 分　时间 90 分钟',
    total: 100,
    gradable: 90,
    note: '样张：只使用 verified 素材；课内阅读 10 分留空并注明缺口。',
  },
  words: wordItems,
  zhuyin,
  xingjin,
  poems: fillPoems,
  dimo: {
    title: dimoPoem.title,
    dynasty: dimoPoem.dynasty,
    author: dimoPoem.author,
    lines: dimoPoem.lines,
    source: dimoPoem.sources.map((s) => s.label).join('；'),
  },
  sentences: { gaibing, guanlian, biaodian, fangxie },
  reading: readingOut,
  writing: writingOut,
  composition,
  gaps,
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(paper, null, 2) + '\n')

const total = composition.reduce((sum, item) => sum + item.score, 0)
console.log(`已写出 ${path.relative(here, outFile)}`)
console.log(`卷面总分 ${total}；可判分 ${paper.meta.gradable}（课内阅读 10 分留空）`)
console.log(`词语 ${wordItems.length} / 注音 ${zhuyin.length} / 形近字 ${xingjin.length} / 古诗 ${fillPoems.length + 1}`)
console.log(
  `句子 ${gaibing.length + guanlian.length + 1 + 1}（病句 ${gaibing.map((g) => g.id).join('/')}，关联词 ${guanlian
    .map((g) => g.id)
    .join('/')}，标点 ${biaodian.id}，仿写 ${fangxie.id}）`,
)
console.log(`阅读 ${readingOut.id}，${readingOut.questions.length} 题；习作 ${writingOut.id}`)
