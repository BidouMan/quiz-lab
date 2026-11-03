import type {
  Constraints,
  Curriculum,
  FormName,
  KnowledgePoint,
  RuleSpec,
  Unit,
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
            r('mix2', { pattern: 'a/b+c', maxOperand: 100, maxResult: 100 }),
          ],
          L3: r('mix3', { pattern: 'a*b+c*d', bracket: false, mulDigits: 1, maxResult: 200 }),
        },
      }),
      kp('3A-U1-K2', '两步四则运算（含括号）', {
        kousuan: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 80 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)/c', bracket: true, maxResult: 100 }),
        },
        tuoshi: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 80 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)*c-d', bracket: true, mulDigits: 1, maxResult: 200 }),
        },
      }),
      kp('3A-U1-K3', '乘除与加减混合口算', {
        kousuan: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 100 }),
          L2: r('mix2', { pattern: 'a/b+c', maxResult: 100 }),
          L3: r('mix2', { pattern: 'a*b-c', maxResult: 200 }),
        },
      }),
      kp('3A-U1-K4', '应用题', {}, '应用题属 v0.3.0，本版只做计算类，不生成。'),
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
        jianbian: {
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('assoc', { roundTo: 1000, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L3: r('dist', { pattern: 'a*c+b*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
        },
      }, '简便运算按 25×4、125×8 的凑整思路，教材未单列，作为乘法单元的拓展规则。'),
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
      }),
      kp('3A-U4-K3', '倍', {
        kousuan: {
          L1: r('mul1', { digits: 1, carry: 'none', maxResult: 81 }),
          L2: r('div1', { dividendDigits: 2, quotientDigits: 1, exact: true }),
          L3: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 100 }),
        },
        tuoshi: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 80 }),
          L2: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxResult: 100 }),
          L3: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 200 }),
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
      kp('3A-U4-K5', '除法的应用', {}, '应用题属 v0.3.0。'),
      kp('3A-U4-K6', '单价、数量、总价', {}, '情境应用题属 v0.3.0。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U5',
    unitName: '年、月、日的秘密',
    note: '时间与日期内容，四类计算生成器不覆盖。',
    kps: [
      kp('3A-U5-K1', '制订作息时间表', {}, '时间情境题，属 v0.3.0。'),
      kp('3A-U5-K2', '制作月历牌', {}, '日期规律题，属 v0.3.0。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U6',
    unitName: '周长',
    note: '图形与测量内容，四类计算生成器不覆盖。',
    kps: [
      kp('3A-U6-K1', '长度的测量', {}, '测量内容，不属计算类。'),
      kp('3A-U6-K2', '长方形、正方形的周长', {}, '周长应用题属 v0.3.0。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U7',
    unitName: '马拉松的路线设计',
    note: '千米认识与路线长度，属情境应用。',
    kps: [
      kp('3A-U7-K1', '千米的认识', {}, '单位换算与情境题，属 v0.3.0。'),
      kp('3A-U7-K2', '路线的长度', {}, '测量与估算题，属 v0.3.0。'),
      kp('3A-U7-K3', '上海半程马拉松的路线设计', {}, '项目式学习，不属计算类。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U8',
    unitName: '数学广场',
    note: '七巧板、篱笆问题，属图形与开放题。',
    kps: [
      kp('3A-U8-K1', '七巧板', {}, '图形拼搭，属 v0.3.0 之后。'),
      kp('3A-U8-K2', '篱笆问题', {}, '开放应用题，属 v0.3.0。'),
    ],
  },
  {
    grade: '3A',
    semester: '上',
    unitId: '3A-U9',
    unitName: '复习',
    note: '综合复习单元，只抽取已有计算规则。',
    kps: [
      kp('3A-U9-K1', '四则运算复习', {
        kousuan: {
          L1: r('mix2', { pattern: 'a*b+c', mulDigits: 1, maxResult: 100 }),
          L2: r('mix2', { pattern: 'a*b-c', mulDigits: 1, maxResult: 200 }),
          L3: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 200 }),
        },
        tuoshi: {
          L1: r('mix3', { pattern: '(a+b)*c', bracket: true, mulDigits: 1, maxResult: 100 }),
          L2: r('mix3', { pattern: '(a-b)*c', bracket: true, mulDigits: 1, maxResult: 200 }),
          L3: r('mix3', { pattern: 'a*b+c*d', bracket: false, mulDigits: 1, maxResult: 300 }),
        },
        jianbian: {
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('dist', { pattern: 'a*c+b*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
          L3: r('dist', { pattern: 'a*c-b*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
        },
      }),
      kp('3A-U9-K2', '乘除复习', {
        kousuan: {
          L1: [
            r('mul1', { digits: 2, carry: 'none', maxResult: 999 }),
            r('div1', { dividendDigits: 2, quotientDigits: 1, exact: true }),
          ],
          L2: [
            r('mul1', { digits: 2, carry: 'any', maxResult: 999 }),
            r('div1', { dividendDigits: 3, quotientDigits: 2, exact: true }),
          ],
          L3: [
            r('mul1', { digits: 3, carry: 'any', maxResult: 9999 }),
            r('div1', { dividendDigits: 3, quotientDigits: 3, exact: true }),
          ],
        },
        chushi: {
          L1: r('mul1', { digits: 2, carry: 'none', maxResult: 999 }),
          L2: r('div1', { dividendDigits: 3, quotientDigits: 2, exact: true }),
          L3: r('mul1', { digits: 3, carry: 'continuous', maxResult: 9999 }),
        },
      }),
      kp('3A-U9-K3', '周长与年月日复习', {}, '图形与时间内容，不属计算类。'),
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
      kp('3B-U1-K3', '面积的估测（1）', {}, '估测题属 v0.3.0。'),
      kp('3B-U1-K4', '平方分米', {}, '面积单位内容，不属四类计算。'),
      kp('3B-U1-K5', '组合图形的面积', {}, '图形面积，属 v0.3.0。'),
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
      kp('3B-U2-K1', '速度、时间、路程', {}, '情境应用题属 v0.3.0。'),
      kp('3B-U2-K2', '整十数与两位数相乘', {
        kousuan: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, bZeroEnd: true, carry: 'none', maxResult: 9000 }),
          L2: r('mul2', { aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 9000 }),
          L3: r('mul2', { aDigits: 3, bZeroEnd: true, carry: 'any', maxResult: 99999 }),
        },
      }),
      kp('3B-U2-K3', '两位数与两位数相乘', {
        chushi: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', maxResult: 9999 }),
          L2: r('mul2', { aDigits: 2, bDigits: 2, carry: 'once', maxResult: 9999 }),
          L3: [
            r('mul2', { aDigits: 2, bDigits: 2, carry: 'continuous', maxResult: 9999 }),
            r('mul2', { aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 9999 }),
          ],
        },
        kousuan: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', maxResult: 9999 }),
          L2: r('mul2', { aDigits: 2, bDigits: 2, carry: 'any', maxResult: 9999 }),
          L3: r('mul2', { aDigits: 2, bZeroEnd: true, carry: 'any', maxResult: 9999 }),
        },
        jianbian: {
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('dist', { pattern: 'a*c+b*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
          L3: r('dist', { pattern: 'a*c+b*c+d*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
        },
      }),
      kp('3B-U2-K4', '两位数与三位数相乘', {
        chushi: {
          L1: r('mul2', { aDigits: 3, bDigits: 2, carry: 'none', maxResult: 99999 }),
          L2: r('mul2', { aDigits: 3, bDigits: 2, carry: 'normal', maxResult: 99999 }),
          L3: [
            r('mul2', { aDigits: 3, bDigits: 2, carry: 'continuous', maxResult: 99999 }),
            r('mul2', { aZeroEnd: true, bDigits: 2, carry: 'any', maxResult: 99999 }),
          ],
        },
      }),
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
            remainder: 'nonzero',
          }),
        },
      }),
      kp('3B-U2-K6', '两位数除两、三位数', {
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
      kp('3B-U4-K1', '整体与部分', {}, '分数概念，v0.3.0 用填空/比大小承接。'),
      kp('3B-U4-K2', '几分之一', {}, '分数比较属 v0.3.0 比大小题型。'),
      kp('3B-U4-K3', '几分之几', {}, '同分母比较属 v0.3.0，不做加减。'),
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
      kp('3B-U6-K1', '面积与面积单位', {}, '面积概念与单位，不属四类计算。'),
      kp('3B-U6-K2', '长方形、正方形的面积', {}, '面积应用题属 v0.3.0。'),
      kp('3B-U6-K3', '组合图形的面积', {}, '图形面积，属 v0.3.0。'),
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
          L1: [
            r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', maxResult: 9999 }),
            r('div2', { dividendDigits: 2, divisorMin: 11, divisorMax: 99, quotientDigits: 1, exact: true }),
          ],
          L2: [
            r('mul2', { aDigits: 2, bDigits: 2, carry: 'any', maxResult: 9999 }),
            r('div2', { dividendDigits: 3, divisorMin: 11, divisorMax: 99, quotientDigits: 2, exact: true }),
          ],
          L3: [
            r('mul2', { aDigits: 3, bDigits: 2, carry: 'any', maxResult: 99999 }),
            r('div2', { dividendDigits: 4, divisorMin: 11, divisorMax: 99, remainder: 'nonzero' }),
          ],
        },
        chushi: {
          L1: r('mul2', { aDigits: 2, bDigits: 2, carry: 'none', maxResult: 9999 }),
          L2: r('div2', { dividendDigits: 3, divisorMin: 11, divisorMax: 99, quotientDigits: 2, exact: true }),
          L3: r('mul2', { aDigits: 3, bDigits: 2, carry: 'continuous', maxResult: 99999 }),
        },
        jianbian: {
          L1: r('assoc', { roundTo: 100, roundPair: 'a*c', minFactor: 2, maxFactor: 9 }),
          L2: r('dist', { pattern: 'a*c+b*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
          L3: r('dist', { pattern: 'a*c+b*c+d*c', roundTo: 100, minFactor: 2, maxFactor: 9, maxResult: 9999 }),
        },
      }),
      kp('3B-U7-K2', '分数', {}, '分数复习属 v0.3.0 填空/比大小。'),
      kp('3B-U7-K3', '周长与面积', {}, '图形应用题属 v0.3.0。'),
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
