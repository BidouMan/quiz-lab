import type { Grade, Level } from './types.ts'

/**
 * 概念型判断题命题表（独立于计算/填空来源）。
 *
 * 每一条都是一句可判真假的教材陈述，复核不靠重算，而靠：
 * 按命题 ID 查本表 → 核对题干原文、真值、标答都一致 → 假命题再核对错因落在判据里。
 * 因此这里要求：
 * - 真命题必须写明教材依据（source）；
 * - 假命题必须写明唯一点的错误点（singleError），且判据（rationale）里要覆盖它；
 * - 陈述句不得含「可能 / 有时 / 也许 / 大约 / 大概 / 通常」这类模糊表述。
 */
export interface ConceptProposition {
  id: string
  unitId: string
  levels: Level[]
  statement: string
  truth: boolean
  /** 判据：一句话说明为什么真 / 为什么假 */
  rationale: string
  /** 假命题的唯一错误点；真命题不填 */
  singleError?: string
  /** 真命题的教材 / 教辅依据；假命题不填 */
  source?: string
}

const AMBIGUOUS = ['可能', '有时', '也许', '大约', '大概', '通常']

export const CONCEPT_PROPOSITIONS: readonly ConceptProposition[] = [
  // ---- U3 三角形与四边形 ----
  {
    id: 'u3-tri-sides',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '三角形有3条边。',
    truth: true,
    rationale: '三角形由3条线段围成，所以有3条边。',
    source: '沪教版三上 U3《三角形与四边形》：三角形的认识（3条边、3个角）',
  },
  {
    id: 'u3-tri-four-sides',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '三角形有4条边。',
    truth: false,
    rationale: '三角形只有3条边，说成4条边多算了1条。',
    singleError: '三角形只有3条边',
  },
  {
    id: 'u3-quad-sides',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '四边形有4条边。',
    truth: true,
    rationale: '四边形由4条线段围成，所以有4条边。',
    source: '沪教版三上 U3《三角形与四边形》：四边形的认识（4条边、4个角）',
  },
  {
    id: 'u3-quad-three-angles',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '四边形有3个角。',
    truth: false,
    rationale: '四边形有4个角，说成3个角少算了1个。',
    singleError: '四边形有4个角',
  },
  {
    id: 'u3-rect-angles',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '长方形的4个角都是直角。',
    truth: true,
    rationale: '长方形是四个角都是直角的四边形。',
    source: '沪教版三上 U3《三角形与四边形》：长方形的认识（4个角都是直角）',
  },
  {
    id: 'u3-rect-sides-equal',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '长方形的4条边都相等。',
    truth: false,
    rationale: '长方形只有对边相等，相邻的边长度不同，所以不是4条边都相等。',
    singleError: '长方形只有对边相等',
  },
  {
    id: 'u3-rect-opposite-sides',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '长方形的对边相等。',
    truth: true,
    rationale: '长方形两组对边分别相等，这是长方形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：长方形的认识（对边相等）',
  },
  {
    id: 'u3-square-sides-equal',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '正方形的4条边都相等。',
    truth: true,
    rationale: '正方形的四条边长度都相等，这是正方形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：正方形的认识（4条边都相等）',
  },
  {
    id: 'u3-square-not-right-angles',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '正方形的4个角都不是直角。',
    truth: false,
    rationale: '正方形的4个角都是直角，所以说「都不是直角」错。',
    singleError: '正方形的4个角都是直角',
  },
  {
    id: 'u3-para-sides-equal',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '平行四边形的4条边都相等。',
    truth: false,
    rationale: '平行四边形只有对边相等，邻边不一定相等，所以不是4条边都相等。',
    singleError: '平行四边形只有对边相等',
  },
  {
    id: 'u3-para-opposite',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '平行四边形的对边平行且相等。',
    truth: true,
    rationale: '两组对边分别平行且相等，是平行四边形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：平行四边形的认识（对边平行且相等）',
  },
  {
    id: 'u3-trapezoid-one-pair',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '梯形只有一组对边平行。',
    truth: true,
    rationale: '只有一组对边平行的四边形叫梯形。',
    source: '沪教版三上 U3《三角形与四边形》：梯形的认识（只有一组对边平行）',
  },
  {
    id: 'u3-trapezoid-two-pairs',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '梯形有两组对边平行。',
    truth: false,
    rationale: '梯形只有一组对边平行，说成两组就变成平行四边形了。',
    singleError: '梯形只有一组对边平行',
  },
  // ---- U6 周长 ----
  {
    id: 'u6-perimeter-definition',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '封闭图形一周的长度，就是它的周长。',
    truth: true,
    rationale: '这是周长的定义：封闭图形一周的长度。',
    source: '沪教版三上 U6《周长》：周长的含义（封闭图形一周的长度）',
  },
  {
    id: 'u6-rect-formula',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '长方形的周长等于长与宽的和乘2。',
    truth: true,
    rationale: '长方形有两组对边，周长 =（长 + 宽）× 2。',
    source: '沪教版三上 U6《周长》：长方形周长的计算方法',
  },
  {
    id: 'u6-rect-half',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '长方形的周长等于长与宽的和。',
    truth: false,
    rationale: '长方形的周长等于长与宽的和乘2，只写和漏了乘2，算的是半周长。',
    singleError: '长方形的周长等于长与宽的和乘2',
  },
  {
    id: 'u6-square-formula',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '正方形的周长等于边长乘4。',
    truth: true,
    rationale: '正方形4条边相等，周长 = 边长 × 4。',
    source: '沪教版三上 U6《周长》：正方形周长的计算方法',
  },
  {
    id: 'u6-same-perimeter-same-shape',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '周长相等的两个长方形，形状一定相同。',
    truth: false,
    rationale: '周长相等只说明长与宽的和相等，长和宽可以不同，如5厘米×3厘米和6厘米×2厘米。',
    singleError: '周长相等只说明长与宽的和相等',
  },
  {
    id: 'u6-square-same-perimeter',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '周长相等的两个正方形，边长一定相等。',
    truth: true,
    rationale: '正方形周长 = 边长 × 4，周长相等时边长也相等。',
    source: '沪教版三上 U6《周长》：正方形周长与边长的关系',
  },
  // ---- U1 复习与提高（四则运算相关表述） ----
  {
    id: 'u1-zero-multiply',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '0和任何数相乘都得0。',
    truth: true,
    rationale: '0与任何数相乘，积都是0。',
    source: '沪教版三上 U1《复习与提高》：0的乘法',
  },
  {
    id: 'u1-zero-add',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '0和任何数相加都得0。',
    truth: false,
    rationale: '0加任何数等于原数，不是0；0乘任何数才得0。',
    singleError: '0加任何数等于原数',
  },
  {
    id: 'u1-multiply-one',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '任何数和1相乘，结果还是这个数。',
    truth: true,
    rationale: '任何数与1相乘，积都等于原数。',
    source: '沪教版三上 U1《复习与提高》：1的乘法',
  },
  {
    id: 'u1-add-one',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '任何数和1相加，结果还是这个数。',
    truth: false,
    rationale: '任何数和1相加等于这个数加1；只有乘1结果才不变。',
    singleError: '任何数和1相加等于这个数加1',
  },
  {
    id: 'u1-remainder-equal-divisor',
    unitId: '3A-U1',
    levels: ['L2', 'L3'],
    statement: '有余数的除法中，余数可以等于除数。',
    truth: false,
    rationale: '有余数的除法中余数必须小于除数，等于除数说明还能再分一份。',
    singleError: '余数必须小于除数',
  },
  {
    id: 'u1-remainder-less-divisor',
    unitId: '3A-U1',
    levels: ['L2', 'L3'],
    statement: '有余数的除法中，余数一定小于除数。',
    truth: true,
    rationale: '余数必须小于除数，这是有余数除法的规则。',
    source: '沪教版三上 U1《复习与提高》：有余数的除法（余数必须小于除数）',
  },
  // ---- U2 用一位数乘 ----
  {
    id: 'u2-tens-trailing-zero',
    unitId: '3A-U2',
    levels: ['L1', 'L2'],
    statement: '整十数乘一位数，积的末尾一定有0。',
    truth: true,
    rationale: '整十数是一个数乘10，再乘一位数，积一定能被10整除，末尾有0。',
    source: '沪教版三上 U2《用一位数乘》：整十数乘一位数的口算',
  },
  {
    id: 'u2-hundreds-two-zeros',
    unitId: '3A-U2',
    levels: ['L2', 'L3'],
    statement: '整百数乘一位数，积的末尾只有两个0。',
    truth: false,
    rationale: '整百数乘一位数，积的末尾可能有两个或三个0，如200×5=1000。',
    singleError: '积的末尾可能有两个或三个0',
  },
]

/** 校验单条命题；返回空数组表示合规 */
export function validateConcept(record: ConceptProposition): string[] {
  const issues: string[] = []
  if (!record.id.trim()) issues.push('命题缺少 ID')
  if (!record.unitId.trim()) issues.push('命题缺少单元归属')
  if (record.levels.length === 0) issues.push('命题缺少适用难度')
  const statement = record.statement.trim()
  if (!statement) issues.push('命题缺少陈述句')
  if (statement.endsWith('？') || statement.endsWith('?')) issues.push('陈述句不能是问句')
  for (const word of AMBIGUOUS) {
    if (statement.includes(word)) issues.push(`陈述句含模糊表述「${word}」`)
  }
  if (!record.rationale.trim()) issues.push('命题缺少判据')
  if (record.truth) {
    if (!record.source?.trim()) issues.push('真命题缺少教材依据')
    if (record.singleError?.trim()) issues.push('真命题不应标单一错误点')
  } else {
    const error = record.singleError?.trim()
    if (!error) issues.push('假命题缺少单一错误点')
    else if (!record.rationale.includes(error)) issues.push('判据没有覆盖单一错误点')
    if (record.source?.trim()) issues.push('假命题不应写教材依据')
  }
  return issues
}

// 命题表在加载时先自检，坏数据不允许进卷
for (const record of CONCEPT_PROPOSITIONS) {
  const issues = validateConcept(record)
  if (issues.length > 0) throw new Error(`概念命题 ${record.id} 不合规：${issues.join('；')}`)
}
const BY_ID = new Map(CONCEPT_PROPOSITIONS.map((record) => [record.id, record]))
if (BY_ID.size !== CONCEPT_PROPOSITIONS.length) throw new Error('概念命题 ID 重复')

export function findConcept(id: string | undefined): ConceptProposition | undefined {
  return id == null ? undefined : BY_ID.get(id)
}

/** 某单元 / 难度可用的概念命题 */
export function conceptForUnit(grade: Grade, unitId: string, level: Level): ConceptProposition[] {
  if (grade !== '3A') return []
  return CONCEPT_PROPOSITIONS.filter(
    (record) => record.unitId === unitId && record.levels.includes(level),
  )
}

/** 复核来源层：按命题 ID 核对真值与标答 */
export function verifyConceptSource(id: string | undefined, correct: string): { ok: boolean; error?: string } {
  const record = findConcept(id)
  if (!record) return { ok: false, error: '概念命题 ID 不在命题表里' }
  const expected = record.truth ? '√' : '×'
  if (correct !== expected) return { ok: false, error: `命题表真值为 ${expected}，来源标答为 ${correct}` }
  return { ok: true }
}

/** 复核成品题：题干原文、真值、标答、错因判据四处都要与命题表一致 */
export function verifyConceptItem(input: {
  conceptId?: string
  stem: string
  truth?: boolean
  answers?: string[]
  causes?: Array<{ value: string; rule: string; detail: string }>
}): string[] {
  const issues: string[] = []
  const record = findConcept(input.conceptId)
  if (!record) return [`概念命题 ID 不存在：${input.conceptId ?? '（空）'}`]
  if (input.stem.trim() !== record.statement.trim()) issues.push('题干与命题表不一致')
  if (typeof input.truth !== 'boolean' || input.truth !== record.truth) {
    issues.push('真假与命题表不一致')
  }
  const expected = record.truth ? '√' : '×'
  if ((input.answers?.[0] ?? '') !== expected) issues.push('标答与命题表真值不一致')
  const causes = input.causes ?? []
  if (!record.truth) {
    if (causes.length !== 1) issues.push('概念假命题必须且只能带 1 条判据')
    else if (causes[0]!.rule !== 'concept-error') issues.push('概念假命题错因规则应为 concept-error')
    else if (causes[0]!.detail !== record.rationale) issues.push('错因未落到命题判据')
  } else if (causes.length > 0) {
    issues.push('概念真命题不应带错因')
  }
  return issues
}
