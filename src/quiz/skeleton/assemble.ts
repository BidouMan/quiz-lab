/**
 * 骨架组装器：只读 skeleton 数据，输出既有 title/sections/items 结构。
 * 组装时强约束：同一份卷子内 句式（骨架）、场景、数值 三者都不重复。
 */
import { evalComparison, evalFormula, renderFormula, splitTopDivision, type Params } from './expr.ts'
import { resolveSkeleton } from './bands.ts'
import { createRng, randInt } from '../rng.ts'
import { PRACTICE_LABELS, type Combo, type PilotItem, type PilotPaper, type PilotQuestion, type PilotSection, type Scene, type Skeleton } from './types.ts'

const MAX_ATTEMPTS = 400
const MAX_STEM_CHARS = 45

export interface PaperOptions {
  count: number
  seed: number
  title?: string
  /** 跨组合混排时传入已用集合，保证跨组合也不撞 */
  used?: UsedSets
}

export interface UsedSets {
  skeletons: Set<string>
  scenes: Set<string>
  values: Set<string>
  texts: Set<string>
}

export function createUsedSets(): UsedSets {
  return { skeletons: new Set(), scenes: new Set(), values: new Set(), texts: new Set() }
}

export function sceneKey(scene: Scene): string {
  return `${scene.person}|${scene.item}|${scene.place}`
}

function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = list[i]
    list[i] = list[j]
    list[j] = tmp
  }
  return list
}

function resolveUnit(unit: string, scene: Scene): string {
  return unit.replace(/\{cls\}/g, scene.cls)
}

export function renderText(template: string, scene: Scene, params: Params): string {
  const withScene = template
    .replace(/\{person\}/g, scene.person)
    .replace(/\{item\}/g, scene.item)
    .replace(/\{place\}/g, scene.place)
    .replace(/\{cls\}/g, scene.cls)
  return withScene.replace(/\{([a-z][a-zA-Z0-9]*)\}/g, (_, name: string) => String(params[name]))
}

function stemChars(text: string): number {
  return text.replace(/\s+/g, '').replace(/_{2,}/g, '□').length
}

export function blankWidth(answer: string | undefined): number {
  const chars = answer ? answer.replace(/\s+/g, '').length : 2
  return Math.max(14, Math.min(40, 10 + chars * 2.6))
}

function splitFillLocal(text: string, answers: string[]): PilotItem['parts'] {
  const parts: NonNullable<PilotItem['parts']> = []
  let buffer = ''
  let index = 0
  let blank = 0
  while (index < text.length) {
    if (text[index] === '_') {
      let end = index
      while (text[end] === '_') end++
      if (end - index >= 2) {
        if (buffer) parts.push({ t: buffer })
        buffer = ''
        parts.push({ b: blankWidth(answers[blank]) })
        blank++
        index = end
        continue
      }
    }
    buffer += text[index]
    index++
  }
  if (buffer) parts.push({ t: buffer })
  return parts
}

function pickStep(spec: Skeleton['slots'][string], lo: number, hi: number, rng: () => number): number {
  const step = spec.step ?? 1
  const start = Math.ceil(lo / step) * step
  if (start > hi) throw new Error('空区间')
  const count = Math.floor((hi - start) / step) + 1
  return start + randInt(rng, 0, count - 1) * step
}

function generateParams(skeleton: Skeleton, rng: () => number): Params | null {
  const params: Params = {}
  for (const [name, spec] of Object.entries(skeleton.slots)) {
    let lo = spec.min
    let hi = spec.max
    if (spec.lt) {
      const other = params[spec.lt]
      if (other == null) return null
      hi = Math.min(hi, other - 1)
    }
    if (spec.gt) {
      const other = params[spec.gt]
      if (other == null) return null
      lo = Math.max(lo, other + 1)
    }
    if (spec.sumWith) {
      const other = params[spec.sumWith]
      if (other == null || spec.sum == null) return null
      params[name] = spec.sum - other
      continue
    }
    if (lo > hi) return null
    params[name] = pickStep(spec, lo, hi, rng)
  }
  for (const [name, spec] of Object.entries(skeleton.slots)) {
    const value = params[name]
    if (value < spec.min || value > spec.max) return null
  }
  if (skeleton.guard && !skeleton.guard(params)) return null
  return params
}

interface AskResult {
  text: string
  steps: string[]
}

function judgeSteps(skeleton: Skeleton, params: Params, comparison: { left: number; right: number; op: '<' | '<=' | '>' | '>=', ok: boolean }): AskResult {
  const source = skeleton.formulas[0]
  const match = /\s*(<=|>=|<|>)\s*/.exec(source)
  if (!match) throw new Error(`判断式缺少比较符: ${source}`)
  const leftExpr = source.slice(0, match.index)
  const rightExpr = source.slice(match.index + match[0].length)
  const answer = comparison.ok ? skeleton.judge![0] : skeleton.judge![1]
  const opText = comparison.op === '<' ? '<' : comparison.op === '<=' ? '≤' : comparison.op === '>' ? '>' : '≥'
  // 结论不成立时，把关系取反写出来，避免出现「627 ≤ 420，所以不够」这种自相矛盾的句子
  const shownOp = comparison.ok
    ? opText
    : comparison.op === '<' ? '≥' : comparison.op === '<=' ? '>' : comparison.op === '>' ? '≤' : '<'
  return {
    text: answer,
    steps: [
      `${renderFormula(leftExpr, params)} = ${comparison.left}`,
      `${renderFormula(rightExpr, params)} = ${comparison.right}`,
      `${comparison.left} ${shownOp} ${comparison.right}，所以${answer}。`,
    ],
  }
}

function solveAsk(skeleton: Skeleton, index: number, params: Params, scene: Scene): AskResult {
  const formula = skeleton.formulas[index]
  const unit = resolveUnit(skeleton.answerUnits?.[index] ?? skeleton.unit, scene)
  const choices = skeleton.answerChoices?.[index]
  if (choices) {
    const choiceIndex = evalFormula(formula, params)
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
      throw new Error(`选项下标越界: ${formula} = ${choiceIndex}`)
    }
    return {
      text: choices[choiceIndex],
      steps: [`由图形判断，答案是「${choices[choiceIndex]}」。`],
    }
  }
  if (skeleton.judge) {
    if (index !== 0) throw new Error('判断题只能有一问')
    return judgeSteps(skeleton, params, evalComparison(formula, params))
  }
  const mode = skeleton.askModes?.[index] ?? 'exact'
  if (mode === 'exact') {
    const value = evalFormula(formula, params)
    if (!Number.isInteger(value) || value < 0) throw new Error(`答案不是非负整数: ${formula}`)
    const suffix = unit ? ` ${unit}` : ''
    return {
      text: `${value}${suffix}`,
      steps: [`${renderFormula(formula, params)} = ${value}${unit ? `（${unit}）` : ''}`],
    }
  }
  const split = splitTopDivision(formula)
  if (!split) throw new Error(`取整口径要求顶层除法: ${formula}`)
  const numerator = evalFormula(split.num, params)
  const denominator = evalFormula(split.den, params)
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error(`除法参数异常: ${formula}`)
  }
  const quotient = Math.floor(numerator / denominator)
  const remainder = numerator - quotient * denominator
  const remainderUnit = resolveUnit(skeleton.remainderUnit ?? '{cls}', scene)
  const suffix = unit ? ` ${unit}` : ''
  if (mode === 'ceil') {
    const value = remainder > 0 ? quotient + 1 : quotient
    return {
      text: `${value}${suffix}`,
      steps: [
        `${renderFormula(split.num, params)} ÷ ${renderFormula(split.den, params)} = ${quotient}……${remainder}`,
        remainder > 0 ? `${quotient} + 1 = ${value}${unit ? `（${unit}）` : ''}` : `正好分完，${value}${unit ? `（${unit}）` : ''}`,
      ],
    }
  }
  if (mode === 'remainder') {
    return {
      text: `${quotient}${suffix}，还剩 ${remainder}${remainderUnit ? ` ${remainderUnit}` : ''}`,
      steps: [`${renderFormula(split.num, params)} ÷ ${renderFormula(split.den, params)} = ${quotient}……${remainder}`],
    }
  }
  return {
    text: `${quotient}${suffix}，还剩 ${remainder}${remainderUnit ? ` ${remainderUnit}` : ''}`,
    steps: [
      `${renderFormula(split.num, params)} ÷ ${renderFormula(split.den, params)} = ${quotient}……${remainder}`,
      `最多只能取 ${quotient}${unit ? `（${unit}）` : ''}，剩下 ${remainder}${remainderUnit ? `（${remainderUnit}）` : ''}不够再取一份。`,
    ],
  }
}

function buildStem(skeleton: Skeleton, scene: Scene, params: Params): { stem: string; asks: string[] } {
  const body = renderText(skeleton.template, scene, params)
  if (skeleton.asks.length === 0) return { stem: body, asks: [] }
  const asks = skeleton.asks.map((ask) => renderText(ask, scene, params))
  const joined = asks.length === 1 ? asks[0] : asks.map((ask, i) => `${'①②③④'[i]}${ask}`).join('')
  return { stem: `${body}${joined}`, asks }
}

function buildQuestion(
  skeleton: Skeleton,
  scene: Scene,
  params: Params,
  combo: Combo,
  index: number,
): PilotQuestion {
  const { stem, asks } = buildStem(skeleton, scene, params)
  const answers: string[] = []
  const steps: string[] = []
  const answerUnits: string[] = []

  if (combo.type === 'tiankong') {
    for (let i = 0; i < skeleton.formulas.length; i++) {
      const result = solveAsk(skeleton, i, params, scene)
      answers.push(result.text)
      steps.push(result.steps.join(' '))
      answerUnits.push(result.text.split(' ').slice(1).join(' ') || '')
    }
  } else {
    for (let i = 0; i < skeleton.formulas.length; i++) {
      const result = solveAsk(skeleton, i, params, scene)
      answers.push(result.text)
      steps.push(...result.steps)
      answerUnits.push(resolveUnit(skeleton.answerUnits?.[i] ?? skeleton.unit, scene))
    }
  }

  const values = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)

  return {
    id: `${combo.id}#${index + 1}`,
    comboId: combo.id,
    skeletonId: skeleton.id,
    practice: skeleton.practice,
    sceneKey: sceneKey(scene),
    sceneId: scene.id,
    params,
    values,
    stem,
    asks,
    answers,
    steps,
    answerUnits,
    fig: skeleton.figure?.(params),
    workLines: skeleton.workLines ?? Math.min(7, 2 + Math.max(1, asks.length) * 2 + (skeleton.judge ? 1 : 0)),
  }
}

function selectSkeletons(skeletons: Skeleton[], count: number, rng: () => number): Skeleton[] {
  const groups = new Map<string, Skeleton[]>()
  for (const skeleton of shuffle(rng, skeletons)) {
    const list = groups.get(skeleton.practice) ?? []
    list.push(skeleton)
    groups.set(skeleton.practice, list)
  }
  const queues = shuffle(rng, [...groups.values()])
  const selected: Skeleton[] = []
  for (const queue of queues) selected.push(queue.shift()!)
  while (selected.length < count) {
    let pushed = false
    for (const queue of queues) {
      const next = queue.shift()
      if (!next) continue
      selected.push(next)
      pushed = true
      if (selected.length >= count) break
    }
    if (!pushed) break
  }
  return shuffle(rng, selected.slice(0, count))
}

function compatibleScenes(combo: Combo, skeleton: Skeleton, pool: Scene[]): Scene[] {
  const tags = skeleton.sceneTags
  return pool.filter((scene) => {
    if (combo.matchSceneUnit) {
      const unit = skeleton.sceneUnit ?? skeleton.unit
      if (scene.unit !== unit) return false
    }
    if (!tags || tags.length === 0) return true
    return tags.every((tag) => scene.tags?.includes(tag))
  })
}

export function buildComboPaper(combo: Combo, options: PaperOptions): PilotPaper {
  const rng = createRng(options.seed)
  const used = options.used ?? createUsedSets()
  // 包模型：同一份骨架按当前难度档取数值域，句式与场景不变
  const leveled = combo.skeletons.map((skeleton) => resolveSkeleton(skeleton, combo.level))
  const skeletons = selectSkeletons(leveled, options.count, rng)
  if (skeletons.length < options.count) {
    throw new Error(`${combo.id} 骨架不足：需要 ${options.count}，只有 ${skeletons.length}`)
  }
  // 标签受限的骨架先配场景：可用场景越少越先占，避免“稀缺场景被宽泛骨架抢走”
  const ordered = [...skeletons].sort(
    (a, b) => compatibleScenes(combo, a, combo.scenes).length - compatibleScenes(combo, b, combo.scenes).length,
  )

  const scenePool = shuffle(rng, combo.scenes)
  const takenScenes = new Set<string>()
  const questions: PilotQuestion[] = []

  for (const skeleton of ordered) {
    if (used.skeletons.has(`${combo.id}|${skeleton.id}`)) throw new Error(`骨架重复: ${skeleton.id}`)
    const candidates = compatibleScenes(combo, skeleton, scenePool).filter(
      (scene) => !takenScenes.has(scene.id) && !used.scenes.has(sceneKey(scene)),
    )
    let built: PilotQuestion | null = null
    const skip = { params: 0, values: 0, build: 0, length: 0, text: 0 }
    for (const scene of candidates) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const params = generateParams(skeleton, rng)
        if (!params) {
          skip.params++
          continue
        }
        const valuesKey = Object.keys(params)
          .sort()
          .map((name) => params[name])
          .join(',')
        if (used.values.has(valuesKey)) {
          skip.values++
          continue
        }
        let question: PilotQuestion
        try {
          question = buildQuestion(skeleton, scene, params, combo, questions.length)
        } catch {
          skip.build++
          continue
        }
        if (stemChars(question.stem) > MAX_STEM_CHARS) {
          skip.length++
          continue
        }
        const textKey = question.stem.replace(/\d+/g, '#')
        if (used.texts.has(textKey)) {
          skip.text++
          continue
        }
        built = question
        used.values.add(valuesKey)
        used.texts.add(textKey)
        break
      }
      if (built) {
        takenScenes.add(scene.id)
        used.scenes.add(sceneKey(scene))
        used.skeletons.add(`${combo.id}|${skeleton.id}`)
        questions.push(built)
        break
      }
    }
    if (!built) {
      throw new Error(
        `${combo.id} 无法为骨架 ${skeleton.id} 组题：可用场景 ${candidates.length}，跳过统计 ${JSON.stringify(skip)}`,
      )
    }
  }

  const sections: PilotSection[] =
    combo.type === 'tiankong'
      ? [
          {
            title: '一、填空题',
            kind: 'tiankong',
            numbered: true,
            items: questions.map((question) => ({
              id: question.id,
              kind: 'fill' as const,
              parts: splitFillLocal(question.stem, question.answers),
              answers: question.answers,
              solution: [question.answers.join('；')],
              fig: question.fig,
            })),
          },
        ]
      : [
          {
            title: '一、应用题',
            kind: 'word',
            numbered: true,
            items: questions.map((question) => ({
              id: question.id,
              kind: 'word' as const,
              text: question.stem,
              workLines: question.workLines,
              answers: question.answers,
              solution: question.steps,
              fig: question.fig,
            })),
          },
        ]

  const title = options.title ?? `${combo.unitName} · ${combo.level} 专项练习`
  return {
    title,
    data: { title, sections },
    questions,
  }
}

/** 覆盖信息：按做法统计题量，供自检报告使用 */
export function practiceCoverage(questions: PilotQuestion[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const question of questions) {
    counts[PRACTICE_LABELS[question.practice]] = (counts[PRACTICE_LABELS[question.practice]] ?? 0) + 1
  }
  return counts
}
