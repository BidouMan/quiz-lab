import type {
  Constraints,
  Curriculum,
  FillFormName,
  FillRuleSpec,
  FormName,
  KnowledgePoint,
  RuleSpec,
  Unit,
  WordFormName,
  WordRuleSpec,
} from '../quiz/types.ts'

/**
 * 沪教版《义务教育教科书（五·四学制）·数学》2024 修订版，三年级上、下册。
 *
 * 三上目录已按 2024 修订版核对（9 个单元，含“复习”）；
 * 三下目录尚未公开发布，按现行沪教版三下结构推定，全部标 unconfirmed。
 *
 * 规则字段说明：
 * - rules.<题型>.<难度> = { form, constraints }；
 * - constraints 直接写数值边界，例如 digits=3 + carry='continuous' 表示
 *   “三位数×一位数、连续进位”，quotientZero='middle' 表示“商中间有 0”；
 * - 同一难度需要多种形态时写成数组，生成器会轮流抽取。
 */

const r = (form: FormName, constraints: Constraints, note?: string): RuleSpec => ({
  form,
  constraints,
  note,
})

const kp = (
  kpId: string,
  kpName: string,
  rules: KnowledgePoint['rules'],
  note?: string,
): KnowledgePoint => ({ kpId, kpName, rules, note })

const tf = (form: FillFormName, note?: string): FillRuleSpec => ({ form, note })
const wf = (form: WordFormName, note?: string): WordRuleSpec => ({ form, note })

const units: Unit[] = [
  // ==================== 三年级上册 ====================
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U1',
    unitName: '两步四则运算与应用题',
    kps: [
      kp('3A-U1-K1', '两步四则运算（不含括号）', {
        kousuan: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxOperand: 20, maxResult: 80 }),
          L2: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxOperand: 100, maxResult: 100 }),
          L3: r('mix2', { pattern: 'a+b*c', mulDigits: 1, maxOperand: 100, maxResult: 100 }),
        },
        tuoshi: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxOperand: 20, maxResult: 80 }),
          L2: [
            r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxOperand: 100, maxResult: 100 }),
            r('mix2', { pattern: 'a+b*c', mulDigits: 1, maxOperand: 100, maxResult: 100 }),
          ],
          L3: r('mix3', { pattern: 'a*b+c*d', bracket: false, mulDigits: 1, maxResult: 200 }),
        },
      }),
      kp('3A-U1-K2', '两步四则运算（含括号）', {
        kousuan: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 80 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)*c-d', bracket: true, mulDigits: 1, maxResult: 100 }),
        },
        tuoshi: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 80 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)*c-d', bracket: true, mulDigits: 1, maxResult: 200 }),
        },
      }),
      kp('3A-U1-K3', '乘加、乘减混合口算', {
        kousuan: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxOperand: 20, maxResult: 80 }),
          L2: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 100 }),
          L3: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxResult: 100 }),
        },
      }),
      kp(
        '3A-U1-K4',
        '应用题',
        {
          word: {
            L1: wf('shopping'),
            L2: wf('shopping'),
            // L3 需要“两步以上真正要推理”的形态：两种/三种商品合计、满减、预算判断
            L3: [wf('shopping'), wf('shop3'), wf('discount'), wf('shopCompare')],
          },
        },
        '购物情境；除法与平均分（含余数分配）在 3A-U4 才学，本单元不出现。L3 覆盖三种商品、满减与预算判断。',
      ),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U2',
    unitName: '用一位数乘',
    kps: [
      kp('3A-U2-K1', '一位数乘整十数、整百数', {
        kousuan: {
          L1: r('mul1', { digits: 2, zeroEnd: true, carry: 'none', maxResult: 900 }),
          L2: r('mul1', { digits: 2, zeroEnd: true, carry: 'any', maxResult: 900 }),
          L3: r('mul1', { digits: 3, zeroEnd: true, carry: 'any', maxResult: 9000 }),
        },
      }),
      kp('3A-U2-K2', '一位数乘两位数', {
        kousuan: {
          L1: r('mul1', { digits: 2, carry: 'none', maxResult: 99 }),
          L2: r('mul1', { digits: 2, carry: 'once', maxResult: 999 }),
          L3: r('mul1', { digits: 2, carry: 'continuous', maxResult: 999 }),
        },
        chushi: {
          L1: r('mul1', { digits: 2, carry: 'none', maxResult: 999 }),
          L2: r('mul1', { digits: 2, carry: 'normal', maxResult: 999 }),
          L3: r('mul1', { digits: 2, carry: 'continuous', maxResult: 999 }),
        },
      }),
      kp('3A-U2-K3', '一位数乘三位数', {
        kousuan: {
          L1: r('mul1', { digits: 3, carry: 'none', maxResult: 9999 }),
          L2: r('mul1', { digits: 3, carry: 'once', maxResult: 9999 }),
          L3: r('mul1', { digits: 3, carry: 'continuous', maxResult: 9999 }),
        },
        chushi: {
          L1: r('mul1', { digits: 3, carry: 'none', maxResult: 9999 }),
          L2: r('mul1', { digits: 3, carry: 'normal', maxResult: 9999 }),
          L3: [
            r('mul1', { digits: 3, carry: 'continuous', maxResult: 9999 }),
            r('mul1', { digits: 3, zeroMiddle: true, carry: 'any', maxResult: 9999 }),
          ],
        },
      }, '一位数乘三位数；简便运算（结合律/分配律）属四年级内容，本版不再生成。'),
      kp('3A-U2-K4', '估算', {}, '估算题要求写近似过程，属 v0.3.0，本版不生成。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U3',
    unitName: '三角形与四边形',
    note: '图形内容，四类计算生成器不覆盖。',
    kps: [
      kp('3A-U3-K1', '角的初步认识', {}, '图形与测量内容，v0.3.0 之后再接。'),
      kp('3A-U3-K2', '三角形与四边形的初步认识', {}, '图形分类内容，不属计算类。'),
      kp('3A-U3-K3', '小练习（4）', {}, '综合图形练习，不属计算类。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U4',
    unitName: '用一位数除',
    kps: [
      kp('3A-U4-K1', '一位数除整十数、整百数', {
        kousuan: {
          L1: r('div1', { dividendDigits: 2, quotientDigits: 2, exact: true, quotientZero: 'end' }),
          L2: r('div1', { dividendDigits: 3, quotientDigits: 2, exact: true, quotientZero: 'end' }),
          L3: r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'end' }),
        },
      }),
      kp('3A-U4-K2', '一位数除两位数', {
        kousuan: {
          L1: r('div1', { dividendDigits: 2, quotientDigits: 1, exact: true, quotientZero: 'none' }),
          L2: r('div1', { dividendDigits: 2, quotientDigits: 2, exact: true, quotientZero: 'none' }),
          L3: r('div1', { dividendDigits: 2, quotientDigits: 1, remainder: 'nonzero' }),
        },
        chushi: {
          L1: r('div1', { dividendDigits: 2, quotientDigits: 1, exact: true }),
          L2: r('div1', { dividendDigits: 2, quotientDigits: 2, exact: true }),
          L3: r('div1', { dividendDigits: 2, remainder: 'nonzero' }),
        },
        tuoshi: {
          // 本单元核心是除法，脱式必须出现除法：先除后加/减、先加后除
          L1: r('mix2', { pattern: 'a/b+c', requireOp: '÷', maxResult: 100 }),
          L2: r('mix2', { pattern: 'a/b-c', requireOp: '÷', maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)/c', bracket: true, requireOp: '÷', maxResult: 100 }),
        },
      }),
      kp('3A-U4-K3', '倍', {
        kousuan: {
          L1: r('mul1', { digits: 1, carry: 'none', maxResult: 81 }),
          L2: r('div1', { dividendDigits: 2, quotientDigits: 1, exact: true }),
          L3: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 100 }),
        },
        tuoshi: {
          // “倍”的脱式同样落到除法上，避免整节沿用 U1 的乘法混合
          L1: r('mix2', { pattern: 'a/b+c', requireOp: '÷', maxResult: 100 }),
          L2: r('mix2', { pattern: 'a/b-c', requireOp: '÷', maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)/c', bracket: true, requireOp: '÷', maxResult: 200 }),
        },
      }),
      kp('3A-U4-K4', '一位数除三位数', {
        kousuan: {
          L1: r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'none', maxResult: 999 }),
          L2: r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'end', maxResult: 999 }),
          L3: r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'middle', maxResult: 999 }),
        },
        chushi: {
          L1: r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'none' }),
          L2: r('div1', { dividendDigits: 3, remainder: 'nonzero' }),
          L3: [
            r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'middle' }),
            r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true, quotientZero: 'end' }),
          ],
        },
      }),
      kp(
        '3A-U4-K5',
        '除法的应用',
        {
          word: {
            L1: wf('share'),
            L2: wf('share'),
            L3: wf('share'),
          },
        },
        '平均分、装袋与“最多买几根”情境。',
      ),
      kp(
        '3A-U4-K6',
        '单价、数量、总价',
        {
          tiankong: {
            L1: tf('priceQty'),
            L2: tf('priceQty'),
            L3: tf('priceQty'),
          },
          word: {
            L1: wf('shopping'),
            L2: wf('shopping'),
            L3: wf('shopping'),
          },
        },
        '总价=单价×数量；L3 反求单价并含预算判断。',
      ),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U5',
    unitName: '年、月、日的秘密',
    note: '时间与日期内容，由填空、应用题与口算生成器承接。',
    kps: [
      kp(
        '3A-U5-K1',
        '制订作息时间表',
        {
          kousuan: {
            L1: r('dateKousuan', { dateKind: 'elapsedHour' }),
            L2: r('dateKousuan', { dateKind: 'elapsedHour' }),
            L3: r('dateKousuan', { dateKind: 'elapsedHour' }),
          },
          tiankong: {
            L1: tf('timeHour'),
            L2: tf('timeHour'),
            L3: [tf('timeHour'), tf('elapsed')],
          },
          word: {
            L1: wf('timePlan'),
            L2: wf('timePlan'),
            L3: wf('timePlan'),
          },
        },
        '12/24 时计时法互化与经过时间；口算出整时经过时间；L3 反向求出发时刻（“最迟”）。',
      ),
      kp(
        '3A-U5-K2',
        '制作月历牌',
        {
          kousuan: {
            L1: [
              r('dateKousuan', { dateKind: 'monthDays' }),
              r('dateKousuan', { dateKind: 'bigMonths' }),
              r('dateKousuan', { dateKind: 'dateOffset' }),
            ],
            L2: [
              r('dateKousuan', { dateKind: 'monthDays' }),
              r('dateKousuan', { dateKind: 'bigMonths' }),
              r('dateKousuan', { dateKind: 'dateOffset' }),
            ],
            L3: [
              r('dateKousuan', { dateKind: 'monthDays' }),
              r('dateKousuan', { dateKind: 'bigMonths' }),
              r('dateKousuan', { dateKind: 'dateOffset' }),
            ],
          },
          tiankong: {
            L1: tf('leapYear'),
            L2: [tf('leapYear'), tf('monthDays')],
            L3: [tf('monthDays'), tf('leapYear')],
          },
        },
        '平年闰年、大月小月与每月天数；口算出月份天数、大月个数与日期推算。',
      ),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U6',
    unitName: '周长',
    note: '图形与测量内容，由填空与应用题生成器承接。',
    kps: [
      kp(
        '3A-U6-K1',
        '长度的测量',
        {
          tiankong: {
            L1: tf('lengthUnits'),
            L2: tf('lengthUnits'),
            L3: tf('lengthUnits'),
          },
        },
        '米、分米、厘米、毫米之间的换算。',
      ),
      kp(
        '3A-U6-K2',
        '长方形、正方形的周长',
        {
          tiankong: {
            L1: [tf('rectPerimeter'), tf('squarePerimeter')],
            L2: [tf('rectPerimeter'), tf('squarePerimeter')],
            L3: [tf('rectPerimeter'), tf('squarePerimeter')],
          },
          word: {
            L1: wf('perimeter'),
            L2: wf('perimeter'),
            L3: wf('perimeter'),
          },
          tuoshi: {
            // 长方形周长公式 (长+宽)×2 本身就是两步，固定乘 2 与单元对齐
            L1: r('mix3', { pattern: '(a+b)*2', bracket: true, minOperand: 1, maxOperand: 6, maxResult: 24 }),
            L2: r('mix3', { pattern: '(a+b)*2', bracket: true, minOperand: 5, maxOperand: 40, maxResult: 160 }),
            L3: r('mix3', { pattern: '(a+b)*2', bracket: true, minOperand: 10, maxOperand: 99, maxResult: 400 }),
          },
        },
        '周长计算与反向求边长；L3 含“改围成正方形”的中间量；脱式只出 (长+宽)×2。',
      ),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U7',
    unitName: '马拉松的路线设计',
    note: '千米认识与路线长度，填空承接换乘，路线设计仍为项目式学习。',
    kps: [
      kp(
        '3A-U7-K1',
        '千米的认识',
        {
          tiankong: {
            L1: tf('kmM'),
            L2: tf('kmM'),
            L3: tf('kmM'),
          },
        },
        '千米与米的换算，L3 反向拆成“几千米几米”。',
      ),
      kp(
        '3A-U7-K2',
        '路线的长度',
        {
          tiankong: {
            L2: tf('routeSum'),
            L3: tf('routeSum'),
          },
        },
        '路线由 2–3 段组成，求和或比较远近；数值控制在万以内。',
      ),
      kp('3A-U7-K3', '上海半程马拉松的路线设计', {}, '项目式学习，本版不生成。'),
    ],
  },
  // ==================== 三年级下册（推定） ====================
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U1',
    unitName: '复习与提高',
    unconfirmed: true,
    note: '三下目录为推定：沿用现行沪教版三下“复习与提高”结构，待 2027 春季教材校准。',
    kps: [
      kp('3B-U1-K1', '带小括号的四则运算', {
        kousuan: {
          L1: r('mix2', { pattern: 'a+b*c', mulDigits: 1, maxResult: 200 }),
          L2: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxResult: 300 }),
          L3: r('mix3', { pattern: '(a+b)/c', bracket: true, maxResult: 300 }),
        },
        tuoshi: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 200 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 300 }),
          L3: r('mix3', { pattern: '(a+b)*c-d', bracket: true, mulDigits: 1, maxResult: 500 }),
        },
      }),
      kp('3B-U1-K2', '小复习', {
        kousuan: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 200 }),
          L2: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxResult: 300 }),
          L3: r('mix2', { pattern: 'a/b+c', maxResult: 300 }),
        },
      }),
      kp('3B-U1-K3', '面积的估测（1）', {}, '估测题需要开放答案，本版不生成。'),
      kp(
        '3B-U1-K4',
        '长度与周长复习',
        {
          tiankong: {
            L1: [tf('rectPerimeter'), tf('priceQty')],
            L2: [tf('rectPerimeter'), tf('priceQty'), tf('elapsed')],
            L3: [tf('rectPerimeter'), tf('priceQty'), tf('timeHour')],
          },
        },
        '复习 3A 的周长、单价数量总价与时间；面积规则统一放在 3B-U6。',
      ),
      kp(
        '3B-U1-K5',
        '时间与购物复习',
        {
          word: {
            L1: wf('perimeter'),
            L2: wf('timePlan'),
            L3: wf('shopping'),
          },
        },
        '复习 3A 的周长、作息时间与购物情境；不提前使用面积。',
      ),
    ],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U2',
    unitName: '用两位数乘除',
    unconfirmed: true,
    note: '三下目录为推定；本单元覆盖两位数乘除与试商。',
    kps: [
      kp(
        '3B-U2-K1',
        '速度、时间、路程',
        {
          tiankong: {
            L1: tf('speed'),
            L2: tf('speed'),
            L3: tf('speed'),
          },
          word: {
            L1: wf('trip'),
            L2: wf('trip'),
            L3: wf('trip'),
          },
        },
        '路程=速度×时间；L3 含“至少每小时行多少千米”的反向判断。',
      ),
      kp('3B-U2-K2', '整十数与两位数相乘', {
        kousuan: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, bZeroEnd: true, carry: 'none', maxResult: 9000 }),
          L2: r('mul2', { aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 9000 }),
          L3: r('mul2', { aDigits: 2, bZeroEnd: true, carry: 'any', maxResult: 9000 }),
        },
      }),
      kp('3B-U2-K3', '两位数与两位数相乘', {
        chushi: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', aZeroEnd: false, bZeroEnd: false, maxResult: 9999 }),
          L2: r('mul2', { aDigits: 2, bDigits: 2, carry: 'once', aZeroEnd: false, bZeroEnd: false, maxResult: 9999 }),
          // L3 只保留连续进位的两位数×两位数；整十数题是口算，不进竖式
          L3: r('mul2', { aDigits: 2, bDigits: 2, carry: 'continuous', aZeroEnd: false, bZeroEnd: false, maxResult: 9999 }),
        },
        kousuan: {
          // 口算只做“两位数×整十数”：两位数×两位数一律进竖式，避免 53×81 这类题混入口算
          L1: r('mul2', { aDigits: 2, bZeroEnd: true, carry: 'none', maxResult: 9000 }),
          L2: r('mul2', { aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 9000 }),
          L3: r('mul2', { aDigits: 2, bZeroEnd: true, carry: 'any', maxResult: 9000 }),
        },
        tiankong: {
          L1: tf('mul2x2'),
          L2: tf('mul2x2'),
          L3: tf('mul2x2'),
        },
        jianbian: {
          // 三下只学“凑整”：把能凑成整十/整百/整千的两个因数先乘，不引入结合律、分配律的字母式
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 4, maxFactor: 9 }),
          L3: r('assoc', { roundTo: 1000, roundPair: 'a*b', minFactor: 2, maxFactor: 9 }),
        },
        word: {
          L1: wf('shopping2'),
          L2: wf('shopping2'),
          L3: wf('shopping2'),
        },
      }, '两位数乘两位数的购物情境；L3 为两种商品合计与预算判断。'),
      kp('3B-U2-K4', '两位数与三位数相乘', {
        chushi: {
          L1: r('mul2', { aDigits: 3, bDigits: 2, carry: 'none', maxResult: 99999 }),
          L2: r('mul2', { aDigits: 3, bDigits: 2, carry: 'normal', maxResult: 99999 }),
          L3: [
            r('mul2', { aDigits: 3, bDigits: 2, carry: 'continuous', maxResult: 9999 }),
            // 末尾有 0 的三位数×两位数（如 340×27）；a 必须仍是三位数
            r('mul2', { aDigits: 3, aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 9999 }),
          ],
        },
        tiankong: {
          L1: tf('mul2x3'),
          L2: tf('mul2x3'),
          L3: tf('mul2x3'),
        },
        word: {
          L1: wf('bulk'),
          L2: wf('bulk'),
          L3: wf('bulk'),
        },
      }, '三位数乘两位数：口算不涉及，填空与应用题都要出现两位数乘三位数。'),
      kp('3B-U2-K5', '整十数除两、三位数', {
        kousuan: {
          L1: r('div2', {
            dividendDigits: 2,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 1,
            exact: true,
          }),
          L2: r('div2', {
            dividendDigits: 3,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 2,
            exact: true,
          }),
          L3: r('div2', {
            dividendDigits: 3,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 2,
            quotientZero: 'end',
            exact: true,
          }),
        },
      }),
      kp('3B-U2-K6', '两位数除两、三位数', {
        tiankong: {
          L1: tf('div2x2'),
          L2: tf('div2x2'),
          L3: tf('div2x2'),
        },
        word: {
          L1: wf('pack'),
          L2: wf('pack'),
          L3: wf('pack'),
        },
        chushi: {
          L1: r('div2', { dividendDigits: 2, divisorMin: 11, divisorMax: 99, quotientDigits: 1, exact: true }),
          L2: r('div2', { dividendDigits: 3, divisorMin: 11, divisorMax: 99, quotientDigits: 2, exact: true }),
          L3: [
            r('div2', { dividendDigits: 3, divisorMin: 11, divisorMax: 99, remainder: 'nonzero' }),
            r('div2', {
              dividendDigits: 3,
              divisorMin: 11,
              divisorMax: 99,
              quotientDigits: 2,
              quotientZero: 'end',
              exact: true,
            }),
          ],
        },
      }),
      kp('3B-U2-K7', '两位数除多位数', {
        chushi: {
          L1: r('div2', { dividendDigits: 4, divisorMin: 11, divisorMax: 99, quotientDigits: 2, exact: true }),
          L2: r('div2', { dividendDigits: 4, divisorMin: 11, divisorMax: 99, remainder: 'nonzero' }),
          L3: [
            r('div2', {
              dividendDigits: 4,
              divisorMin: 11,
              divisorMax: 99,
              quotientDigits: 3,
              quotientZero: 'middle',
              exact: true,
            }),
            r('div2', { dividendDigits: 4, divisorMin: 11, divisorMax: 99, quotientDigits: 3, exact: true }),
          ],
        },
      }),
    ],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U3',
    unitName: '统计',
    unconfirmed: true,
    note: '三下目录为推定。',
    kps: [kp('3B-U3-K1', '条形统计图（二）', {}, '统计图内容，不属四类计算。')],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U4',
    unitName: '分数的初步认识（一）',
    unconfirmed: true,
    note: '三下目录为推定。分数只到初步认识：几分之一、几分之几、同分母比较，不做异分母加减。',
    kps: [
      kp(
        '3B-U4-K1',
        '整体与部分',
        {
          tiankong: {
            L1: tf('fraction'),
            L2: tf('fraction'),
          },
        },
        '平均分与“每份是整体的几分之一”。',
      ),
      kp(
        '3B-U4-K2',
        '几分之一',
        {
          tiankong: {
            L1: tf('fractionUnit'),
            L2: tf('fractionUnit'),
            L3: tf('fractionUnit'),
          },
        },
        '只出“几分之一”：L1 直接认读，L2 换情境与更大分母，L3 反求平均分成的份数。',
      ),
      kp(
        '3B-U4-K3',
        '几分之几',
        {
          tiankong: {
            L2: tf('fractionPart'),
            L3: tf('fractionPart'),
          },
        },
        '几分之几与同分母比大小；L2 起分子至少为 2，不做异分母加减。',
      ),
    ],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U5',
    unitName: '计算器',
    unconfirmed: true,
    note: '三下目录为推定。',
    kps: [
      kp('3B-U5-K1', '从算筹到计算器', {}, '数学文化内容。'),
      kp('3B-U5-K2', '计算器', {}, '工具认识内容。'),
      kp('3B-U5-K3', '使用计算器计算', {}, '计算器操作，不属心算生成。'),
    ],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U6',
    unitName: '面积',
    unconfirmed: true,
    note: '按“面积在三下、周长在三上”的 2024 修订版口径推定。',
    kps: [
      kp(
        '3B-U6-K1',
        '面积与面积单位',
        {
          tiankong: {
            L1: tf('areaUnit'),
            L2: tf('areaUnit'),
            L3: tf('areaUnit'),
          },
        },
        '平方米、平方分米、平方厘米的进率换算。',
      ),
      kp(
        '3B-U6-K2',
        '长方形、正方形的面积',
        {
          tiankong: {
            L1: [tf('rectArea'), tf('squareArea')],
            L2: [tf('rectArea'), tf('squareArea')],
            L3: [tf('rectArea'), tf('squareArea')],
          },
          word: {
            L1: wf('area'),
            L2: wf('area'),
            L3: wf('area'),
          },
        },
        '面积计算、反求边长与铺砖问题；L3 含草皮总价与预算判断。',
      ),
      kp('3B-U6-K3', '组合图形的面积', {}, '需要割补的组合图形暂不生成。'),
    ],
  },
  {
    grade: '3B',
    semester: '下',
    unitId: '3B-U7',
    unitName: '整理与提高',
    unconfirmed: true,
    note: '三下目录为推定；只抽取乘除计算复习。',
    kps: [
      kp('3B-U7-K1', '乘与除', {
        kousuan: {
          // 口算只做整十数除法；两位数乘两位数、四位数除法一律进竖式
          L1: r('div2', {
            dividendDigits: 2,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 1,
            exact: true,
          }),
          L2: r('div2', {
            dividendDigits: 3,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 2,
            exact: true,
          }),
          L3: r('div2', {
            dividendDigits: 3,
            divisorMin: 10,
            divisorMax: 90,
            divisorStep: 10,
            quotientDigits: 2,
            quotientZero: 'end',
            exact: true,
          }),
        },
        chushi: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', maxResult: 9999 }),
          L2: r('div2', { dividendDigits: 3, divisorMin: 11, divisorMax: 99, quotientDigits: 2, exact: true }),
          L3: r('mul2', { aDigits: 3, bDigits: 2, carry: 'continuous', maxResult: 99999 }),
        },
        jianbian: {
          // 三下只学“凑整”：把能凑成整十/整百/整千的两个因数先乘，不引入结合律、分配律的字母式
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 4, maxFactor: 9 }),
          L3: r('assoc', { roundTo: 1000, roundPair: 'a*b', minFactor: 2, maxFactor: 9 }),
        },
      }),
      kp(
        '3B-U7-K2',
        '分数',
        {
          tiankong: {
            L1: tf('fraction'),
            L2: tf('fraction'),
            L3: tf('fraction'),
          },
        },
        '分数意义与同分母比较的复习。',
      ),
      kp(
        '3B-U7-K3',
        '周长与面积',
        {
          tiankong: {
            L1: [tf('rectPerimeter'), tf('rectArea')],
            L2: [tf('squarePerimeter'), tf('squareArea')],
            L3: [tf('rectPerimeter'), tf('rectArea')],
          },
          word: {
            L1: [wf('perimeter'), wf('area')],
            L2: [wf('perimeter'), wf('area')],
            L3: [wf('perimeter'), wf('area')],
          },
        },
        '周长与面积综合复习，应用题覆盖围栏、铺砖与预算。',
      ),
    ],
  },
]

export const CURRICULUM: Curriculum = {
  version: '2024-revision',
  source: '沪教版（五·四学制）数学 2024 修订版；三上目录已核对，三下为推定',
  units,
}

export function findUnit(unitId: string): Unit | undefined {
  return units.find((u) => u.unitId === unitId)
}

export function findKp(kpId: string): { unit: Unit; kp: KnowledgePoint } | undefined {
  for (const unit of units) {
    const kp = unit.kps.find((k) => k.kpId === kpId)
    if (kp) return { unit, kp }
  }
  return undefined
}
