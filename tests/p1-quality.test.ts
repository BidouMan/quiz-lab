import test from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/quiz/generate.ts'
import { generateFill, verifyFillQuestion } from '../src/quiz/fill.ts'
import { generateWord, verifyWordQuestion } from '../src/quiz/word.ts'
import { recommendedCount } from '../src/app/paperBuilder.ts'
import { DEFAULT_CONFIG, type AppType } from '../src/app/types.ts'
import { getCombo, buildComboPaper } from '../src/quiz/skeleton/index.ts'

const words = (grade: '3A' | '3B', unitId: string, level: 'L1' | 'L2' | 'L3', count = 20, seed = 1301) =>
  generateWord({ grade, unitId, level, count, seed }).questions

const fills = (grade: '3A' | '3B', unitId: string, level: 'L1' | 'L2' | 'L3', count = 20, seed = 1302) =>
  generateFill({ grade, unitId, level, count, seed }).questions

/** 骨架包出题：U6/U3 的精选变式只在骨架包里，走 legacy 生成器检不到 */
const skeletonQuestions = (comboId: string, count = 30, seed = 1305) =>
  buildComboPaper(getCombo(comboId), { count, seed }).questions
const skeletonStems = (comboId: string, count = 30, seed = 1305) =>
  skeletonQuestions(comboId, count, seed).map((q) => q.stem)
/** 原 U8 搬入的变式骨架 id 一律以 u8 开头 */
const isVariant = (id: string) => id.startsWith('u8')

const calc = (
  grade: '3A' | '3B',
  unitId: string,
  type: 'kousuan' | 'chushi' | 'tuoshi' | 'jianbian',
  level: 'L1' | 'L2' | 'L3',
  count = 80,
  seed = 1303,
) => generate({ grade, unitId, type, level, count, seed }).questions

/** 去掉数字与姓名，保留句式与场景名词，用来比较“是否同一句模板” */
const normalize = (stem: string) =>
  stem
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/小明|小红|小华|丁丁|冬冬|乐乐/g, '@')
    .replace(/[\s，。？：、（）()]/g, '')

const templateStats = (stems: string[]) => {
  const counts = new Map<string, number>()
  for (const stem of stems) {
    const key = normalize(stem)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const max = Math.max(...counts.values())
  return { distinct: counts.size, maxShare: max / stems.length }
}

const similarity = (a: string[], b: string[]) => {
  const setA = new Set(a.map(normalize))
  const setB = new Set(b.map(normalize))
  let shared = 0
  for (const item of setA) if (setB.has(item)) shared++
  return shared / Math.max(setA.size, setB.size)
}

/** 竖式进位次数：按乘数十位逐位乘，含进位链 */
const carryCount = (a: number, b: number) => {
  let carry = 0
  let total = 0
  for (const digit of String(b)) {
    let value = a * Number(digit) + carry
    if (value >= 10) total++
    carry = Math.floor(value / 10)
    while (carry >= 10) {
      total++
      carry = Math.floor(carry / 10)
    }
  }
  if (carry > 0) total++
  return total
}

test('P1-C1 时间措辞：求出发时刻一律用“最迟”，下界/上界题用“至少/最多”', () => {
  const questions = words('3A', '3A-U5', 'L3', 60)
  for (const question of questions) {
    assert.ok(question.stem.includes('最迟'), `应为最迟：${question.stem}`)
    assert.ok(!question.stem.includes('至少'), `误用至少：${question.stem}`)
    assert.equal(verifyWordQuestion(question), null)
  }
  // 真正的下界：提速反求，必须写“至少每小时”
  const trips = words('3B', '3B-U2', 'L3', 40, 1304).filter((q) => String(q.features.form) === 'trip')
  assert.ok(trips.length > 0)
  for (const question of trips) {
    assert.ok(question.stem.includes('至少'), question.stem)
    assert.ok(!question.stem.includes('最迟'), question.stem)
    assert.equal(verifyWordQuestion(question), null)
  }
  // 真正的上界：最多买几根 / 最多装满几箱
  const maxBuys = words('3A', '3A-U4', 'L3', 40, 1305).filter((q) => String(q.params.mode) === 'maxBuy')
  assert.ok(maxBuys.length > 0)
  for (const question of maxBuys) {
    assert.ok(question.stem.includes('最多'), question.stem)
    assert.ok(!question.stem.includes('最迟'), question.stem)
  }
  const packs = fills('3B', '3B-U2', 'L2', 40, 1306).filter((q) => String(q.params.mode) === 'remainder2')
  assert.ok(packs.length > 0)
  for (const question of packs) {
    assert.ok(question.stem.includes('最多'), question.stem)
    assert.ok(!question.stem.includes('最迟'), question.stem)
    assert.equal(verifyFillQuestion(question), null)
  }
})

test('P1-B1 答案步骤与小问对应：跳绳题第二步必须解“还剩多少元”', () => {
  const questions = words('3A', '3A-U4', 'L3', 60)
  const shares = questions.filter((q) => String(q.features.form) === 'share')
  assert.ok(shares.length > 0)
  for (const question of shares) {
    assert.equal(question.questions.length, 2)
    assert.equal(question.steps.length, 2)
    assert.equal(question.steps[0].q, 1)
    assert.equal(question.steps[1].q, 2)
    assert.ok(question.steps[1].line.includes(' - '), `第二步应为减法：${question.steps[1].line}`)
    assert.ok(
      question.steps[1].line.endsWith(`= ${question.answers[1]}（元）`),
      `第二步结论必须等于第②问答案：${question.steps[1].line}`,
    )
    assert.equal(verifyWordQuestion(question), null)
  }
})

test('P1-B2 答案唯一：连续两个大月只保留 7 月/8 月并写明排除跨年', () => {
  const questions = fills('3A', '3A-U5', 'L3', 8)
  const monthQuestions = questions.filter((q) => String(q.features.form) === 'monthDays')
  assert.ok(monthQuestions.length > 0)
  for (const question of monthQuestions) {
    assert.deepEqual(question.answers, ['7', '8'])
    assert.ok(question.stem.includes('12 月和 1 月除外'), question.stem)
    assert.equal(verifyFillQuestion(question), null)
  }
  // 枚举合法解：大月={1,3,5,7,8,10,12}，连续且排除跨年 12→1 后只剩 7/8
  const bigMonths = [1, 3, 5, 7, 8, 10, 12]
  const legalPairs = bigMonths.flatMap((month) =>
    bigMonths.filter((next) => next === month + 1).map((next) => `${month}/${next}`),
  )
  assert.deepEqual(legalPairs, ['7/8'])
})

test('P1-B3/C2 比较情境有效：两种商品单价不同、名称不同，且花费可比较', () => {
  const questions = words('3A', '3A-U1', 'L3', 60)
  const shopping = questions.filter((q) => String(q.features.form) === 'shopping')
  assert.ok(shopping.length > 0)
  for (const question of shopping) {
    assert.notEqual(question.params.price1, question.params.price2, question.stem)
    assert.notEqual(question.params.noun1, question.params.noun2, question.stem)
    assert.notEqual(question.params.quantity1, question.params.quantity2, question.stem)
    assert.ok(question.stem.includes('铅笔') || question.stem.includes('练习本') || question.stem.includes('橡皮') || question.stem.includes('尺子') || question.stem.includes('水彩笔'))
    assert.ok(!question.stem.includes('A 种') && !question.stem.includes('B 种'), question.stem)
  }
  const compares = questions.filter((q) => String(q.features.form) === 'shopCompare')
  assert.ok(compares.length > 0)
  for (const question of compares) {
    assert.notEqual(question.params.part1, question.params.part2)
  }
})

test('P1-B4 付款/预算取整：付款整十，草坪预算整百', () => {
  for (const question of words('3A', '3A-U4', 'L2', 60)) {
    if (String(question.params.mode) === 'change') {
      assert.equal(Number(question.params.paid) % 10, 0, question.stem)
    }
  }
  for (const question of words('3B', '3B-U6', 'L3', 60)) {
    const money = Number(question.params.money)
    assert.equal(money % 100, 0, question.stem)
    assert.ok(money > 0)
  }
  for (const question of fills('3A', '3A-U4', 'L2', 60)) {
    if (String(question.params.mode) === 'totalThenChange') {
      assert.equal(Number(question.params.paid) % 10, 0, question.stem)
    }
  }
})

test('P1-A2 脱式含除法：3A-U4 三个难度都必须出现 ÷', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const questions = calc('3A', '3A-U4', 'tuoshi', level, 30)
    for (const question of questions) {
      assert.match(question.latex, /\\div/, `L1/L2/L3 都应有除法：${question.latex}`)
    }
  }
})

test('P1-A3 路线题：3A-U7 填空改为多段路线求和/比较，不再只有千米换算', () => {
  for (const level of ['L2', 'L3'] as const) {
    const questions = fills('3A', '3A-U7', level, 20)
    const routes = questions.filter((q) => String(q.features.form) === 'routeSum')
    // 同单元仍有千米换算，但路线题必须占到一半左右（原来的问题是完全没有）
    assert.ok(routes.length >= 8, `${level} 路线题只有 ${routes.length} 道`)
    for (const question of routes) {
      assert.ok(question.stem.includes('米'), question.stem)
      assert.match(question.stem, /路线|一共|相差|回家|全长/, question.stem)
    }
    // 千米换算不再以“只换数字”的裸换算式为主，至少有一条带情境或比较
    const bare = questions.filter((q) => /^[\d]+ 千米 = _+ 米。$/u.test(q.stem))
    assert.ok(bare.length <= 2, `${level} 裸换算式 ${bare.length} 道`)
  }
})

test('P1-A4 篱笆只以变式身份回挂 U6，且每档占比不超过两成', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const u6Words = skeletonQuestions(`3A-U6|word|${level}`, 30, 1305)
    const u6Fills = skeletonQuestions(`3A-U6|tiankong|${level}`, 30, 1306)
    const wordFence = u6Words.filter((q) => isVariant(q.skeletonId))
    const fillFence = u6Fills.filter((q) => isVariant(q.skeletonId))
    assert.ok(wordFence.length >= 1, `${level} U6 应用丢失篱笆变式`)
    assert.ok(fillFence.length >= 1, `${level} U6 填空丢失篱笆变式`)
    assert.ok(wordFence.length <= 7, `${level} U6 应用篱笆 ${wordFence.length}/30 超过两成半`)
    assert.ok(fillFence.length <= 7, `${level} U6 填空篱笆 ${fillFence.length}/30 超过两成半`)
    // 保护 U6 核心：周长公式/判断/拼剪题必须仍占七成以上
    assert.ok(30 - wordFence.length >= 23, `${level} U6 核心应用题被篱笆挤占`)
    assert.ok(30 - fillFence.length >= 23, `${level} U6 核心填空题被篱笆挤占`)
    // 变式身份：题面必须是靠墙/留门/改围/两面靠墙等变式形态，且占变式题一半以上
    const varied = [...wordFence, ...fillFence].filter((q) =>
      /靠墙|留门|围三边|改围|相邻两边|少用|宽边|长边/.test(q.stem),
    )
    assert.ok(varied.length >= Math.ceil((wordFence.length + fillFence.length) / 2), `${level} 篱笆变式形态不足`)
  }
  // 不得外溢：其他单元的骨架包里没有篱笆题
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (const combo of [`3A-U3|word|${level}`, `3A-U3|tiankong|${level}`, `3A-U4|word|${level}`, `3A-U2|word|${level}`]) {
      assert.ok(!skeletonStems(combo, 30, 1307).some((stem) => /篱笆/.test(stem)), `${combo} 出现篱笆题外溢`)
    }
  }
})

test('P1-A5 3B-U1 改为复习 3A：不再出现面积，面积只在 3B-U6', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (const question of fills('3B', '3B-U1', level, 15, 1308)) {
      assert.ok(!question.stem.includes('面积') && !question.stem.includes('平方'), question.stem)
    }
    for (const question of words('3B', '3B-U1', level, 15, 1309)) {
      assert.ok(!question.stem.includes('面积') && !question.stem.includes('平方'), question.stem)
    }
  }
  const area = fills('3B', '3B-U6', 'L2', 15, 1310)
  assert.ok(area.some((q) => q.stem.includes('面积') || q.stem.includes('平方')))
})

test('P1-F2 跨单元题面不雷同：U3/U6、U1/U6 的题干集合几乎不相交', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const u6 = skeletonStems(`3A-U6|word|${level}`, 20, 1311)
    const u3 = skeletonStems(`3A-U3|word|${level}`, 20, 1312)
    assert.ok(similarity(u6, u3) < 0.1, `${level} U3/U6 应用题雷同`)

    const b1 = words('3B', '3B-U1', level, 20, 1313).map((q) => q.stem)
    const b6 = words('3B', '3B-U6', level, 20, 1314).map((q) => q.stem)
    assert.ok(similarity(b1, b6) < 0.1, `${level} 3B-U1/3B-U6 应用题雷同`)

    const f6 = skeletonStems(`3A-U6|tiankong|${level}`, 20, 1315)
    const f3 = skeletonStems(`3A-U3|tiankong|${level}`, 20, 1316)
    assert.ok(similarity(f6, f3) < 0.1, `${level} U3/U6 填空雷同`)
  }
})

test('P1-D2 难度不倒挂：3B-U2-K3 竖式 L1<L2<L3 进位次数单调递增，且无整十数乘法', () => {
  const k3 = (level: 'L1' | 'L2' | 'L3', seed: number) =>
    generate({ grade: '3B', unitId: '3B-U2', kpId: '3B-U2-K3', type: 'chushi', level, count: 100, seed }).questions
  const l1 = k3('L1', 1317)
  const l2 = k3('L2', 1318)
  const l3 = k3('L3', 1319)
  assert.ok(l1.length > 0 && l2.length > 0 && l3.length > 0)
  const avg = (list: typeof l1) =>
    list.reduce((sum, q) => sum + carryCount(q.values[0], q.values[1]), 0) / list.length
  assert.ok(avg(l1) < avg(l2), `L2 平均进位 ${avg(l2)} 未高于 L1 ${avg(l1)}`)
  assert.ok(avg(l2) < avg(l3), `L3 平均进位 ${avg(l3)} 未高于 L2 ${avg(l2)}`)
  for (const question of [...l1, ...l2, ...l3]) {
    const [a, b] = question.values
    assert.ok(!(a % 10 === 0 && b % 10 === 0), `整十数×整十数：${a}×${b}`)
    assert.ok(!(a < 100 && a % 10 === 0), `两位数整十数：${a}×${b}`)
    assert.ok(!(b < 100 && b % 10 === 0), `整十乘数：${a}×${b}`)
  }
})

test('P1-E1 竖式整十数：抽 200 道乘二位数，整十乘数一律不出现', () => {
  const muls = calc('3B', '3B-U2', 'chushi', 'L2', 200, 1319).filter((q) => String(q.features.form) === 'mul2')
  assert.ok(muls.length > 0)
  for (const question of muls) {
    const [a, b] = question.values
    assert.ok(!(a % 10 === 0 && a < 100), `${a}×${b}`)
    assert.ok(!(b % 10 === 0 && b < 100), `${a}×${b}`)
  }
})

test('P1-A6 3B-U2-K4 L3：末尾有 0 的两位数×两位数不得回潮（a 必须三位数）', () => {
  const questions = generate({
    grade: '3B',
    unitId: '3B-U2',
    kpId: '3B-U2-K4',
    type: 'chushi',
    level: 'L3',
    count: 100,
    seed: 1320,
  }).questions
  assert.ok(questions.length > 0)
  for (const question of questions) assert.ok(question.values[0] >= 100, `L3 出现两位数 ${question.values[0]}`)
})

test('P1-A7 分数分层：几分之一只问 1/n，几分之几 L2 起分子≥2', () => {
  for (const level of ['L2', 'L3'] as const) {
    for (const question of fills('3B', '3B-U4', level, 30, 1321)) {
      const form = String(question.features.form)
      if (form === 'fractionUnit') {
        // L3 反求份数，答案里没有分数；统一用 params.numerator 判定“仅几分之一”
        assert.equal(Number(question.params.numerator), 1, question.stem)
        if (question.answers[0].includes('/')) assert.equal(question.answers[0].split('/')[0], '1', question.stem)
      }
      if (form === 'fractionPart') {
        assert.ok(Number(question.answers[0].split('/')[0]) >= 2, question.stem)
      }
    }
  }
})

test('P1-F1 单句式占比：重点 form×难度至少 3 种句式，单模板不超过 40%', () => {
  const groups: {
    unit: string
    grade: '3A' | '3B'
    level: 'L1' | 'L2' | 'L3'
    kind: 'fill' | 'word'
    /** 该组走骨架包（U3 等只有骨架包的单元） */
    combo?: string
    /** 题型可用数值组合有限时按上限抽样（如 U7 L1 千米只有 9 个） */
    count?: number
  }[] = [
    { unit: '3A-U4', grade: '3A', level: 'L1', kind: 'fill' },
    { unit: '3A-U4', grade: '3A', level: 'L2', kind: 'fill' },
    { unit: '3A-U4', grade: '3A', level: 'L3', kind: 'fill' },
    { unit: '3A-U7', grade: '3A', level: 'L1', kind: 'fill' },
    { unit: '3A-U7', grade: '3A', level: 'L2', kind: 'fill' },
    { unit: '3A-U7', grade: '3A', level: 'L3', kind: 'fill' },
    { unit: '3A-U3', grade: '3A', level: 'L1', kind: 'fill', combo: '3A-U3|tiankong|L1' },
    { unit: '3A-U3', grade: '3A', level: 'L2', kind: 'fill', combo: '3A-U3|tiankong|L2' },
    { unit: '3A-U3', grade: '3A', level: 'L3', kind: 'fill', combo: '3A-U3|tiankong|L3' },
    { unit: '3B-U2', grade: '3B', level: 'L1', kind: 'fill' },
    { unit: '3B-U2', grade: '3B', level: 'L2', kind: 'fill' },
    { unit: '3B-U2', grade: '3B', level: 'L3', kind: 'fill' },
    { unit: '3B-U4', grade: '3B', level: 'L2', kind: 'fill' },
    { unit: '3B-U4', grade: '3B', level: 'L3', kind: 'fill' },
    { unit: '3B-U6', grade: '3B', level: 'L1', kind: 'word' },
    { unit: '3B-U6', grade: '3B', level: 'L2', kind: 'word' },
    { unit: '3B-U6', grade: '3B', level: 'L3', kind: 'word' },
    { unit: '3A-U1', grade: '3A', level: 'L3', kind: 'word' },
  ]
  for (const group of groups) {
    const count = group.count ?? 20
    const stems = group.combo
      ? skeletonStems(group.combo, count, 1322)
      : group.kind === 'fill'
        ? fills(group.grade, group.unit, group.level, count, 1322).map((q) => q.stem)
        : words(group.grade, group.unit, group.level, count, 1323).map((q) => q.stem)
    const stats = templateStats(stems)
    assert.ok(stats.distinct >= 3, `${group.unit}/${group.level}/${group.kind} 只有 ${stats.distinct} 种句式`)
    assert.ok(stats.maxShare <= 0.4, `${group.unit}/${group.level}/${group.kind} 单句式占 ${stats.maxShare}`)
  }
})

test('P1-D1/F3 3A-U1 应用 L3：单模板不超过 25%，至少 4 种推理形态且每题≥2 步', () => {
  const questions = words('3A', '3A-U1', 'L3', 60, 1330)
  const stats = templateStats(questions.map((q) => q.stem))
  assert.ok(stats.maxShare <= 0.25, `3A-U1 L3 单模板占 ${stats.maxShare}`)
  const forms = new Set(questions.map((q) => String(q.features.form)))
  for (const form of ['shopping', 'shop3', 'discount', 'shopCompare']) assert.ok(forms.has(form), `缺少 ${form}`)
  for (const question of questions) assert.ok(question.steps.length >= 2, question.stem)
  const discounts = questions.filter((q) => String(q.features.form) === 'discount')
  assert.ok(discounts.length > 0)
  for (const question of discounts) assert.ok(question.stem.includes('每满'), question.stem)
})

test('P1-G1 留白行数：按问数计算，三问面积题至少 6 行', () => {
  const questions = words('3B', '3B-U6', 'L3', 40, 1324)
  const three = questions.filter((q) => q.questions.length === 3)
  assert.ok(three.length > 0)
  for (const question of three) {
    assert.ok(question.workLines >= 6 && question.workLines <= 7, `${question.workLines} 行`)
  }
  for (const question of questions) {
    assert.ok(question.workLines >= 2 * question.questions.length, `${question.id} 留白不足`)
    assert.ok(question.workLines <= 7)
  }
})

test('P1 全量自检：修复涉及单元生成 200 题全部通过独立求值', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (const question of fills('3A', '3A-U5', level, 15, 1325)) assert.equal(verifyFillQuestion(question), null)
    for (const question of fills('3A', '3A-U6', level, 15, 1327)) assert.equal(verifyFillQuestion(question), null)
    for (const question of words('3A', '3A-U6', level, 15, 1328)) assert.equal(verifyWordQuestion(question), null)
  }
  // U7 L1 的千米换算只有 9 个数值组合，按上限抽样；L2/L3 再加路线题
  for (const question of fills('3A', '3A-U7', 'L1', 9, 1326)) assert.equal(verifyFillQuestion(question), null)
  for (const level of ['L2', 'L3'] as const) {
    for (const question of fills('3A', '3A-U7', level, 15, 1326)) assert.equal(verifyFillQuestion(question), null)
  }
})

// ---------- 复评（v0.3.0）新增守卫 ----------

const DIMENSION = '(平方厘米|平方分米|平方米|厘米|分米|毫米|米)'

/** 题干问句里的所求单位，例如“一共要多少厘米” → 厘米 */
const askedUnitOf = (text: string) =>
  text.match(new RegExp(`多少(?:要|需要|能|可以|一共要|一共需要)?${DIMENSION}`))?.[1]

/** 解答行里写出的单位，优先取括号单位，其次取行尾单位 */
const stepUnitOf = (line: string) => {
  const paren = line.match(new RegExp(`（${DIMENSION}）`))
  if (paren) return paren[1]
  return line.match(new RegExp(`${DIMENSION}$`))?.[1]
}

const squareUnitOf = (unit: string) => `平方${unit}`
const GEOMETRY_FORMS = new Set(['perimeter', 'wallFence', 'area', 'rectPerimeter', 'squarePerimeter', 'rectArea', 'squareArea'])

test('P0-N1 单位一致：600 道周长/面积题题干、所求、解答单位零错配', () => {
  const wordUnits: ['3A' | '3B', string][] = [
    ['3A', '3A-U6'],
    ['3B', '3B-U1'],
    ['3B', '3B-U6'],
    ['3B', '3B-U7'],
  ]
  let checked = 0
  for (const [grade, unit] of wordUnits) {
    for (const level of ['L1', 'L2', 'L3'] as const) {
      for (const question of words(grade, unit, level, 30, 1401)) {
        checked++
        assert.equal(verifyWordQuestion(question), null)
        for (let index = 0; index < question.questions.length; index++) {
          const ask = askedUnitOf(question.questions[index])
          if (!ask) continue
          const own = question.steps.filter((step) => step.q === index + 1)
          const last = own[own.length - 1]
          assert.ok(last && !last.judge, `第 ${index + 1} 问没有结论步：${question.stem}`)
          const written = stepUnitOf(last.line)
          assert.equal(written, ask, `问“${ask}”却按“${written}”解答：${question.stem} / ${last.line}`)
        }
      }
    }
  }
  for (const [grade, unit] of wordUnits) {
    for (const level of ['L1', 'L2', 'L3'] as const) {
      for (const question of fills(grade, unit, level, 30, 1402)) {
        const form = String(question.features.form)
        if (!GEOMETRY_FORMS.has(form)) continue
        checked++
        assert.equal(verifyFillQuestion(question), null)
        const unitParam = String(question.params.unit ?? '')
        assert.ok(unitParam, `缺少单位参数：${question.stem}`)
        for (const match of question.stem.matchAll(new RegExp(`_+\\s*${DIMENSION}`, 'g'))) {
          const blankUnit = match[1]
          assert.ok(
            blankUnit === unitParam || blankUnit === squareUnitOf(unitParam),
            `空位问“${blankUnit}”但单位参数是“${unitParam}”：${question.stem}`,
          )
        }
      }
    }
  }
  assert.ok(checked >= 500, `只抽到 ${checked} 道周长/面积题`)
})

test('P1-N2 U3 七巧板/小棒变式不超过两成，且每档至少 3 种玩法', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const u3Words = skeletonQuestions(`3A-U3|word|${level}`, 30, 1410)
    const u3Fills = skeletonQuestions(`3A-U3|tiankong|${level}`, 30, 1411)
    const wordVariants = u3Words.filter((q) => isVariant(q.skeletonId))
    const fillVariants = u3Fills.filter((q) => isVariant(q.skeletonId))
    assert.ok(wordVariants.length <= 7, `${level} U3 应用特色题 ${wordVariants.length}/30 超过两成半`)
    assert.ok(fillVariants.length <= 8, `${level} U3 填空特色题 ${fillVariants.length}/30 超过两成半`)
    for (const question of [...wordVariants, ...fillVariants]) {
      assert.match(question.stem, /七巧板|小棒|三角形|正方形/, `U3 变式题面应含图形线索：${question.stem}`)
    }
    // 每档至少 3 种玩法：变式骨架本身要有 3 种以上，不能被单一玩法稀释
    assert.ok(
      new Set(wordVariants.map((q) => q.skeletonId)).size >= 3,
      `${level} U3 应用变式玩法不足 3 种`,
    )
    assert.ok(
      new Set(fillVariants.map((q) => q.skeletonId)).size >= 3,
      `${level} U3 填空变式玩法不足 3 种`,
    )
    // 保护 U3 核心：图形辨认/分类/角类题必须仍占七成以上
    assert.ok(30 - wordVariants.length >= 23, `${level} U3 应用核心被特色题挤占`)
    assert.ok(30 - fillVariants.length >= 22, `${level} U3 填空核心被特色题挤占`)
  }
})

test('P1-N1 3B-U2 小配额也保证核心步骤 ≥70%（L1/L2/L3 的 2/3 题真实卷）', () => {
  for (const level of ['L1', 'L2', 'L3'] as const) {
    for (const count of [2, 3]) {
      for (const seed of [1420, 1421, 1422]) {
        const list = words('3B', '3B-U2', level, count, seed)
        assert.equal(list.length, count, `${level} count=${count} 实际出了 ${list.length} 题`)
        const core = list.filter((q) => Number(q.features.twoDigitSteps) > 0).length
        assert.ok(
          core / list.length >= 0.7,
          `${level} count=${count} seed=${seed} 核心只有 ${core}/${list.length}`,
        )
      }
    }
  }
})

test('P1-N3/N4 单模板压到 ≤30%：U6、3B-U1、3B-U6 三档全部覆盖', () => {
  const units: { grade: '3A' | '3B'; unit: string }[] = [
    { grade: '3A', unit: '3A-U6' },
    { grade: '3B', unit: '3B-U1' },
    { grade: '3B', unit: '3B-U6' },
  ]
  for (const { grade, unit } of units) {
    for (const level of ['L1', 'L2', 'L3'] as const) {
      const list = words(grade, unit, level, 40, 1430)
      const stats = templateStats(list.map((q) => q.stem))
      assert.ok(stats.distinct >= 3, `${unit} ${level} 只有 ${stats.distinct} 种句式`)
      assert.ok(
        stats.maxShare <= 0.3,
        `${unit} ${level} 单模板 ${(stats.maxShare * 100).toFixed(1)}%`,
      )
    }
  }
})

test('P1-N5 留白按解答步数：五步题 ≥6 行、一问题 ≤3 行、上限 7', () => {
  const list = words('3B', '3B-U2', 'L3', 20, 1440).filter(
    (q) => String(q.features.form) === 'bulk' && q.steps.length >= 5,
  )
  assert.ok(list.length > 0, '没有抽到五步满减题')
  for (const question of list) {
    assert.ok(question.workLines >= 6, `${question.stem} 只留 ${question.workLines} 行`)
    assert.ok(question.workLines <= 7)
  }
  const singles = words('3A', '3A-U6', 'L3', 30, 1441).filter((q) => q.questions.length === 1)
  assert.ok(singles.length > 0, '没有抽到一问题')
  for (const question of singles) {
    assert.ok(question.workLines <= 3, `一问题被拉宽到 ${question.workLines} 行：${question.stem}`)
  }
})

test('P1-N6 三下简便运算 L1/L2/L3 全部只凑整，不再出现分配律', () => {
  for (const unit of ['3B-U2', '3B-U7']) {
    for (const level of ['L1', 'L2', 'L3'] as const) {
      const list = calc('3B', unit, 'jianbian', level, 20, 1450)
      assert.ok(list.length > 0, `${unit}/${level} 没有简便运算`)
      for (const question of list) {
        assert.equal(String(question.features.form), 'assoc', `${unit}/${level} 出现非凑整：${question.latex}`)
        assert.match(
          question.latex,
          /^\d+\s*\\times\s*\d+\s*\\times\s*\d+$/,
          `${unit}/${level} 出现括号/分配律形式：${question.latex}`,
        )
      }
    }
  }
})

test('P2-N1 三种商品单价两两不同，不再出现同价', () => {
  const list = words('3A', '3A-U1', 'L3', 60, 1460).filter((q) => String(q.features.form) === 'shop3')
  assert.ok(list.length > 0, '没有抽到 shop3')
  for (const question of list) {
    const prices = [question.params.price1, question.params.price2, question.params.price3].map(Number)
    assert.equal(new Set(prices).size, 3, `三商品同价：${question.stem}`)
  }
})

test('P2-N2 3B-U2-K4 L3 结果收进万以内', () => {
  const list = calc('3B', '3B-U2', 'chushi', 'L3', 100, 1470).filter((q) => q.kpId === '3B-U2-K4')
  assert.ok(list.length > 0, '没有抽到 K4')
  for (const question of list) {
    const product = Number(question.values[0]) * Number(question.values[1])
    assert.ok(product <= 9999, `${question.values[0]}×${question.values[1]}=${product} 超过万以内`)
  }
})

test('P2-N3 满减题总价四位数以内，商品不同价', () => {
  for (const [grade, unit] of [
    ['3A', '3A-U1'],
    ['3B', '3B-U2'],
  ] as const) {
    for (const level of ['L1', 'L2', 'L3'] as const) {
      for (const question of words(grade, unit, level, 12, 1560)) {
        const form = String(question.features.form)
        if (form === 'discount') {
          assert.ok(Number(question.params.total) <= 9999, `满减总价过大：${question.stem}`)
        }
        if (form === 'pairDiscount') {
          const total =
            Number(question.params.price1) * Number(question.params.quantity1) +
            Number(question.params.price2) * Number(question.params.quantity2)
          assert.ok(total <= 9999, `满减总价过大：${question.stem}`)
          assert.notEqual(question.params.price1, question.params.price2, `两商品同价：${question.stem}`)
        }
        if (form === 'shop3') {
          const total =
            Number(question.params.price1) * Number(question.params.quantity1) +
            Number(question.params.price2) * Number(question.params.quantity2) +
            Number(question.params.price3) * Number(question.params.quantity3)
          assert.ok(total <= 9999, `三商品总价过大：${question.stem}`)
        }
      }
    }
  }
})

test('P2-P1 混合卷默认题量按题型与难度动态计算', () => {
  const config = (level: 'L1' | 'L2' | 'L3', types: AppType[]) => ({
    ...DEFAULT_CONFIG,
    grade: '3B' as const,
    level,
    types,
    count: 20,
  })
  assert.equal(recommendedCount(config('L1', ['tiankong', 'word'])), 20)
  assert.equal(recommendedCount(config('L2', ['tiankong', 'word'])), 16)
  assert.equal(recommendedCount(config('L3', ['tiankong', 'word'])), 12)
  assert.equal(recommendedCount(config('L3', ['tiankong'])), 30)
  assert.equal(recommendedCount(config('L3', ['word'])), 6)
})
