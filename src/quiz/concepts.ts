import type { Grade, Level } from './types.ts'

/**
 * 概念型判断题命题表（独立于计算/填空来源）。
 *
 * 每一条都是一句可判真假的教材陈述，复核不靠重算，而靠：
 * 按命题 ID 查本表 → 核对题干原文、真值、标答都一致 → 假命题再核对错因落在判据里。
 * 因此这里要求：
 * - 真命题必须写明教材依据（source）；
 * - 假命题必须写明唯一点的错误点（singleError），且判据（rationale）里要覆盖它；
 * - 陈述句不得含「可能 / 有时 / 也许 / 大约 / 大概 / 通常」这类模糊表述；
 * - 陈述句含「都 / 一定 / 所有 / 任何 / 只有 / 必须 / 总 / 每」等绝对化表述时，
 *   必须写 absoluteReview 说明已核对过特例（正方形、菱形、特殊长方形、0 与 1 的运算等）。
 */
export interface ConceptProposition {
  id: string
  /** 知识点键：同卷内同一知识点最多出 1 题，跨卷去重也按它优先 */
  knowledgePoint: string
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
  /** 绝对化表述的特例复核结论；陈述句含绝对化词时必填 */
  absoluteReview?: string
}

const AMBIGUOUS = ['可能', '有时', '也许', '大约', '大概', '通常']
/** 绝对化表述：出现即要求 absoluteReview，避免依赖「孩子没想到特例」才成立 */
const ABSOLUTE = /都|一定|所有|任何|只有|必须|总|每/

export const CONCEPT_PROPOSITIONS: readonly ConceptProposition[] = [
  // ---- U3 三角形与四边形 ----
  {
    id: 'u3-tri-sides',
    knowledgePoint: 'u3.triangle.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '三角形有3条边。',
    truth: true,
    rationale: '三角形由3条线段围成，所以有3条边。',
    source: '沪教版三上 U3《三角形与四边形》：三角形的认识（3条边、3个角）',
  },
  {
    id: 'u3-tri-four-sides',
    knowledgePoint: 'u3.triangle.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '三角形有4条边。',
    truth: false,
    rationale: '三角形只有3条边，说成4条边多算了1条。',
    singleError: '三角形只有3条边',
  },
  {
    id: 'u3-quad-sides',
    knowledgePoint: 'u3.quadrilateral.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '四边形有4条边。',
    truth: true,
    rationale: '四边形由4条线段围成，所以有4条边。',
    source: '沪教版三上 U3《三角形与四边形》：四边形的认识（4条边、4个角）',
  },
  {
    id: 'u3-quad-three-angles',
    knowledgePoint: 'u3.quadrilateral.angleCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '四边形有3个角。',
    truth: false,
    rationale: '四边形有4个角，说成3个角少算了1个。',
    singleError: '四边形有4个角',
  },
  {
    id: 'u3-rect-angles',
    knowledgePoint: 'u3.rect.rightAngles',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '长方形的4个角都是直角。',
    truth: true,
    rationale: '长方形是四个角都是直角的四边形。',
    source: '沪教版三上 U3《三角形与四边形》：长方形的认识（4个角都是直角）',
    absoluteReview: '特例：正方形也属于长方形，四个角仍都是直角，命题仍真',
  },
  {
    id: 'u3-rect-adjacent-sides-equal',
    knowledgePoint: 'u3.rect.adjacentSideEquality',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '长方形相邻的两条边长度一定相等。',
    truth: false,
    rationale: '长方形相邻的两条边长度不一定相等：一般长方形一条是长、一条是宽，只有正方形才四条边都相等。',
    singleError: '长方形相邻的两条边长度不一定相等',
    absoluteReview: '特例：正方形四边相等，但一般长方形邻边不相等，全称判断仍假',
  },
  {
    id: 'u3-rect-opposite-sides',
    knowledgePoint: 'u3.rect.oppositeSides',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '长方形的对边相等。',
    truth: true,
    rationale: '长方形两组对边分别相等，这是长方形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：长方形的认识（对边相等）',
  },
  {
    id: 'u3-square-sides-equal',
    knowledgePoint: 'u3.square.sideEquality',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '正方形的4条边都相等。',
    truth: true,
    rationale: '正方形的四条边长度都相等，这是正方形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：正方形的认识（4条边都相等）',
    absoluteReview: '特例：无；正方形按定义四条边都相等',
  },
  {
    id: 'u3-square-not-right-angles',
    knowledgePoint: 'u3.square.rightAngles',
    unitId: '3A-U3',
    levels: ['L1', 'L2'],
    statement: '正方形的4个角都不是直角。',
    truth: false,
    rationale: '正方形的4个角都是直角，所以说「都不是直角」错。',
    singleError: '正方形的4个角都是直角',
    absoluteReview: '特例：无；正方形四个角都是直角，不存在反例',
  },
  {
    id: 'u3-para-adjacent-sides-equal',
    knowledgePoint: 'u3.para.adjacentSideEquality',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '平行四边形相邻的两条边长度一定相等。',
    truth: false,
    rationale: '平行四边形相邻的两条边长度不一定相等，只有菱形才四条边都相等。',
    singleError: '平行四边形相邻的两条边长度不一定相等',
    absoluteReview: '特例：菱形是四边相等的平行四边形，但一般平行四边形邻边不相等，全称判断仍假',
  },
  {
    id: 'u3-para-opposite',
    knowledgePoint: 'u3.para.oppositeSides',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '平行四边形的对边平行且相等。',
    truth: true,
    rationale: '两组对边分别平行且相等，是平行四边形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：平行四边形的认识（对边平行且相等）',
  },
  {
    id: 'u3-trapezoid-one-pair',
    knowledgePoint: 'u3.trapezoid.parallelSides',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '梯形只有一组对边平行。',
    truth: true,
    rationale: '只有一组对边平行的四边形叫梯形。',
    source: '沪教版三上 U3《三角形与四边形》：梯形的认识（只有一组对边平行）',
    absoluteReview: '特例：平行四边形有两组对边平行，按定义不算梯形；三上采用「只有一组」定义',
  },
  {
    id: 'u3-trapezoid-two-pairs',
    knowledgePoint: 'u3.trapezoid.parallelSides',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '梯形有两组对边平行。',
    truth: false,
    rationale: '梯形只有一组对边平行，说成两组就变成平行四边形了。',
    singleError: '梯形只有一组对边平行',
  },
  // ---- U3 三角形与四边形：基础计数与角的分类（补齐纯概念单元的出题量） ----
  {
    id: 'u3-tri-angles',
    knowledgePoint: 'u3.triangle.angleCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '三角形有3个角。',
    truth: true,
    rationale: '三角形由3条线段围成，3条边对应3个角。',
    source: '沪教版三上 U3《三角形与四边形》：三角形的认识（3条边、3个角）',
  },
  {
    id: 'u3-tri-four-angles',
    knowledgePoint: 'u3.triangle.angleCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '三角形有4个角。',
    truth: false,
    rationale: '三角形只有3个角，说成4个角多算了1个。',
    singleError: '三角形只有3个角',
  },
  {
    id: 'u3-quad-angles',
    knowledgePoint: 'u3.quadrilateral.angleCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '四边形有4个角。',
    truth: true,
    rationale: '四边形由4条线段围成，4条边对应4个角。',
    source: '沪教版三上 U3《三角形与四边形》：四边形的认识（4条边、4个角）',
  },
  {
    id: 'u3-rect-four-sides',
    knowledgePoint: 'u3.rect.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '长方形有4条边。',
    truth: true,
    rationale: '长方形是四边形，四边形有4条边，所以长方形有4条边。',
    source: '沪教版三上 U3《三角形与四边形》：长方形的认识（4条边、4个角）',
  },
  {
    id: 'u3-square-four-sides',
    knowledgePoint: 'u3.square.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '正方形有4条边。',
    truth: true,
    rationale: '正方形是四边形，四边形有4条边，所以正方形有4条边。',
    source: '沪教版三上 U3《三角形与四边形》：正方形的认识（4条边、4个角）',
  },
  {
    id: 'u3-square-opposite-sides',
    knowledgePoint: 'u3.square.sideEquality',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '正方形的对边相等。',
    truth: true,
    rationale: '正方形四条边都相等，对边自然也相等。',
    source: '沪教版三上 U3《三角形与四边形》：正方形的认识（4条边都相等）',
  },
  {
    id: 'u3-rect-is-quad',
    knowledgePoint: 'u3.rect.membership',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '长方形是四边形。',
    truth: true,
    rationale: '长方形有4条边、4个角，符合四边形的定义。',
    source: '沪教版三上 U3《三角形与四边形》：四边形与长方形的包含关系',
  },
  {
    id: 'u3-square-is-quad',
    knowledgePoint: 'u3.square.membership',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '正方形是四边形。',
    truth: true,
    rationale: '正方形有4条边、4个角，符合四边形的定义。',
    source: '沪教版三上 U3《三角形与四边形》：四边形与正方形的包含关系',
  },
  {
    id: 'u3-para-is-quad',
    knowledgePoint: 'u3.para.membership',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '平行四边形是四边形。',
    truth: true,
    rationale: '平行四边形有4条边、4个角，符合四边形的定义。',
    source: '沪教版三上 U3《三角形与四边形》：四边形与平行四边形的包含关系',
  },
  {
    id: 'u3-trapezoid-is-quad',
    knowledgePoint: 'u3.trapezoid.membership',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '梯形是四边形。',
    truth: true,
    rationale: '梯形有4条边、4个角，符合四边形的定义。',
    source: '沪教版三上 U3《三角形与四边形》：四边形与梯形的包含关系',
  },
  {
    id: 'u3-right-angle-gt-acute',
    knowledgePoint: 'u3.angle.acuteRightOrder',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '直角比锐角大。',
    truth: true,
    rationale: '锐角小于直角，直角大于锐角。',
    source: '沪教版三上 U3《三角形与四边形》：锐角、直角、钝角的比较',
  },
  {
    id: 'u3-obtuse-angle-gt-right',
    knowledgePoint: 'u3.angle.obtuseRightOrder',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '钝角比直角大。',
    truth: true,
    rationale: '钝角大于直角，所以钝角比直角大。',
    source: '沪教版三上 U3《三角形与四边形》：锐角、直角、钝角的比较',
  },
  {
    id: 'u3-acute-angle-lt-right',
    knowledgePoint: 'u3.angle.acuteRightOrder',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '锐角比直角小。',
    truth: true,
    rationale: '锐角小于直角，和「直角比锐角大」是同一个大小关系。',
    source: '沪教版三上 U3《三角形与四边形》：锐角、直角、钝角的比较',
  },
  {
    id: 'u3-right-angles-same-size',
    knowledgePoint: 'u3.angle.rightEqual',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '所有的直角都一样大。',
    truth: true,
    rationale: '直角的大小是固定的，与画的位置、边的长短都无关。',
    source: '沪教版三上 U3《三角形与四边形》：直角的认识',
    absoluteReview: '特例：无；角的大小与边长无关，所有直角都相等',
  },
  {
    id: 'u3-quad-all-right-angles',
    knowledgePoint: 'u3.quadrilateral.rightAngles',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '四边形的4个角都是直角。',
    truth: false,
    rationale: '四边形的4个角不都是直角：长方形、正方形的4个角才是直角，梯形等一般四边形不是。',
    singleError: '四边形的4个角不都是直角',
    absoluteReview: '特例：长方形、正方形的4个角是直角，但一般四边形不是，全称判断为假',
  },
  {
    id: 'u3-para-opposite-angles',
    knowledgePoint: 'u3.para.oppositeAngles',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '平行四边形的对角相等。',
    truth: true,
    rationale: '平行四边形两组对角分别相等，这是平行四边形的特征。',
    source: '沪教版三上 U3《三角形与四边形》：平行四边形的认识（对角相等）',
  },
  {
    id: 'u3-rect-three-angles',
    knowledgePoint: 'u3.rect.angleCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '长方形有3个角。',
    truth: false,
    rationale: '长方形有4个角，说成3个角少算了1个。',
    singleError: '长方形有4个角',
  },
  {
    id: 'u3-square-three-sides',
    knowledgePoint: 'u3.square.sideCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '正方形有3条边。',
    truth: false,
    rationale: '正方形有4条边，说成3条边少算了1条。',
    singleError: '正方形有4条边',
  },
  {
    id: 'u3-square-sides-unequal',
    knowledgePoint: 'u3.square.sideEquality',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '正方形的4条边不相等。',
    truth: false,
    rationale: '正方形的4条边都相等，说成「不相等」正好说反了。',
    singleError: '正方形的4条边都相等',
    absoluteReview: '特例：无；正方形按定义四条边都相等',
  },
  {
    id: 'u3-para-opposite-unequal',
    knowledgePoint: 'u3.para.oppositeSides',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '平行四边形的对边不相等。',
    truth: false,
    rationale: '平行四边形的对边相等，说成「不相等」正好说反了。',
    singleError: '平行四边形的对边相等',
  },
  {
    id: 'u3-acute-angle-gt-right',
    knowledgePoint: 'u3.angle.acuteRightOrder',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '锐角比直角大。',
    truth: false,
    rationale: '锐角比直角小，说成比直角大正好说反了。',
    singleError: '锐角比直角小',
  },
  // ---- U3 假命题扩充：每个知识点一句，单一错误点，均在三上范围内 ----
  {
    id: 'u3-tri-four-vertices',
    knowledgePoint: 'u3.triangle.vertexCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '三角形有4个顶点。',
    truth: false,
    rationale: '三角形有3个顶点，说成4个顶点多算了1个。',
    singleError: '三角形有3个顶点',
  },
  {
    id: 'u3-quad-three-vertices',
    knowledgePoint: 'u3.quadrilateral.vertexCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '四边形有3个顶点。',
    truth: false,
    rationale: '四边形有4个顶点，说成3个顶点少算了1个。',
    singleError: '四边形有4个顶点',
  },
  {
    id: 'u3-angle-two-vertices',
    knowledgePoint: 'u3.angle.vertexEdgeCount',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '一个角有2个顶点和1条边。',
    truth: false,
    rationale: '一个角有1个顶点和2条边，说成2个顶点、1条边正好把顶点和边说反了。',
    singleError: '一个角有1个顶点和2条边',
  },
  {
    id: 'u3-quad-four-sides-equal',
    knowledgePoint: 'u3.quadrilateral.sideEquality',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '四边形的4条边都相等。',
    truth: false,
    rationale: '四边形的4条边不都相等：长方形的对边相等而邻边不等，梯形的四条边也可以不相等，只有正方形才四条边都相等。',
    singleError: '四边形的4条边不都相等',
    absoluteReview: '特例：正方形四条边相等，但梯形等一般四边形不相等，全称判断为假',
  },
  {
    id: 'u3-square-not-rect',
    knowledgePoint: 'u3.square.isRectangle',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '正方形不是长方形。',
    truth: false,
    rationale: '正方形是特殊的长方形：它有4条边、4个角都是直角，符合长方形的特征，所以说「不是长方形」错。',
    singleError: '正方形是特殊的长方形',
  },
  {
    id: 'u3-para-is-rect',
    knowledgePoint: 'u3.para.isRect',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '平行四边形是长方形。',
    truth: false,
    rationale: '平行四边形只是对边平行且相等，4个角不都是直角；长方形要求4个角都是直角，所以平行四边形不一定是长方形。',
    singleError: '平行四边形不一定是长方形',
  },
  {
    id: 'u3-trapezoid-is-para',
    knowledgePoint: 'u3.trapezoid.isPara',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '梯形是平行四边形。',
    truth: false,
    rationale: '梯形只有一组对边平行，平行四边形有两组对边平行，所以梯形不是平行四边形。',
    singleError: '梯形不是平行四边形',
  },
  {
    id: 'u3-all-acute-angles-equal',
    knowledgePoint: 'u3.angle.acuteEqual',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '所有的锐角都一样大。',
    truth: false,
    rationale: '锐角只要求比直角小，开口可大可小，锐角的大小并不都相同。',
    singleError: '锐角的大小并不都相同',
    absoluteReview: '特例：三角尺上的两个锐角大小不同，全称判断为假',
  },
  {
    id: 'u3-triangle-ruler-no-right',
    knowledgePoint: 'u3.angle.triangleRuler',
    unitId: '3A-U3',
    levels: ['L1', 'L2', 'L3'],
    statement: '三角尺上没有直角。',
    truth: false,
    rationale: '三角尺上有一个直角，另外两个角是锐角，所以说没有直角错。',
    singleError: '三角尺上有一个直角',
  },
  {
    id: 'u3-angle-longer-side-bigger',
    knowledgePoint: 'u3.angle.sideLengthEffect',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '角的两条边画得越长，这个角就越大。',
    truth: false,
    rationale: '角的大小只与两条边张开的程度有关，角的大小与边的长短无关，边画得再长角也不会变大。',
    singleError: '角的大小与边的长短无关',
  },
  {
    id: 'u3-acute-triangle-one-angle',
    knowledgePoint: 'u3.triangle.acuteClassify',
    unitId: '3A-U3',
    levels: ['L2', 'L3'],
    statement: '有一个角是锐角的三角形是锐角三角形。',
    truth: false,
    rationale: '直角三角形和钝角三角形也有两个锐角，所以「有一个角是锐角」不能判定；锐角三角形要求三个角都是锐角。',
    singleError: '锐角三角形要求三个角都是锐角',
  },
  // ---- U6 周长 ----
  {
    id: 'u6-perimeter-definition',
    knowledgePoint: 'u6.perimeter.definition',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '封闭图形一周的长度，就是它的周长。',
    truth: true,
    rationale: '这是周长的定义：封闭图形一周的长度。',
    source: '沪教版三上 U6《周长》：周长的含义（封闭图形一周的长度）',
  },
  {
    id: 'u6-rect-formula',
    knowledgePoint: 'u6.rect.perimeterFormula',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '长方形的周长等于长与宽的和乘2。',
    truth: true,
    rationale: '长方形有两组对边，周长 =（长 + 宽）× 2。',
    source: '沪教版三上 U6《周长》：长方形周长的计算方法',
  },
  {
    id: 'u6-rect-half',
    knowledgePoint: 'u6.rect.perimeterFormula',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '长方形的周长等于长与宽的和。',
    truth: false,
    rationale: '长方形的周长等于长与宽的和乘2，只写和漏了乘2，算的是半周长。',
    singleError: '长方形的周长等于长与宽的和乘2',
  },
  {
    id: 'u6-square-formula',
    knowledgePoint: 'u6.square.perimeterFormula',
    unitId: '3A-U6',
    levels: ['L1', 'L2'],
    statement: '正方形的周长等于边长乘4。',
    truth: true,
    rationale: '正方形4条边相等，周长 = 边长 × 4。',
    source: '沪教版三上 U6《周长》：正方形周长的计算方法',
  },
  {
    id: 'u6-same-perimeter-same-shape',
    knowledgePoint: 'u6.rect.perimeterEquality',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '周长相等的两个长方形，形状一定相同。',
    truth: false,
    rationale: '周长相等只说明长与宽的和相等，长和宽可以不同，如5厘米×3厘米和6厘米×2厘米。',
    singleError: '周长相等只说明长与宽的和相等',
    absoluteReview: '特例：5厘米×3厘米与6厘米×2厘米周长同为16厘米，形状不同，是反例',
  },
  {
    id: 'u6-square-same-perimeter',
    knowledgePoint: 'u6.square.perimeterEquality',
    unitId: '3A-U6',
    levels: ['L2', 'L3'],
    statement: '周长相等的两个正方形，边长一定相等。',
    truth: true,
    rationale: '正方形周长 = 边长 × 4，周长相等时边长也相等。',
    source: '沪教版三上 U6《周长》：正方形周长与边长的关系',
    absoluteReview: '特例：无；边长 = 周长 ÷ 4 唯一确定',
  },
  // ---- U1 复习与提高（四则运算相关表述） ----
  {
    id: 'u1-zero-multiply',
    knowledgePoint: 'u1.zero.multiplication',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '0和任何数相乘都得0。',
    truth: true,
    rationale: '0与任何数相乘，积都是0。',
    source: '沪教版三上 U1《复习与提高》：0的乘法',
    absoluteReview: '特例：0×0=0，无例外',
  },
  {
    id: 'u1-zero-add',
    knowledgePoint: 'u1.zero.addition',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '0和任何数相加都得0。',
    truth: false,
    rationale: '0加任何数等于原数，不是0；0乘任何数才得0。',
    singleError: '0加任何数等于原数',
    absoluteReview: '特例：0+0=0 成立，但其余数不成立，全称判断为假',
  },
  {
    id: 'u1-multiply-one',
    knowledgePoint: 'u1.one.multiplication',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '任何数和1相乘，结果还是这个数。',
    truth: true,
    rationale: '任何数与1相乘，积都等于原数。',
    source: '沪教版三上 U1《复习与提高》：1的乘法',
    absoluteReview: '特例：0×1=0、1×1=1，结果仍是原数，无例外',
  },
  {
    id: 'u1-add-one',
    knowledgePoint: 'u1.one.addition',
    unitId: '3A-U1',
    levels: ['L1', 'L2'],
    statement: '任何数和1相加，结果还是这个数。',
    truth: false,
    rationale: '任何数和1相加等于这个数加1；只有乘1结果才不变。',
    singleError: '任何数和1相加等于这个数加1',
    absoluteReview: '特例：0+1=1 不等于0，全称判断为假',
  },
  // ---- U4 用一位数除（除法与余数；三上 U1 尚未学除法，不能标在 U1） ----
  {
    id: 'u4-remainder-equal-divisor',
    knowledgePoint: 'u4.remainder.rule',
    unitId: '3A-U4',
    levels: ['L2', 'L3'],
    statement: '有余数的除法中，余数可以等于除数。',
    truth: false,
    rationale: '有余数的除法中余数必须小于除数，等于除数说明还能再分一份。',
    singleError: '余数必须小于除数',
  },
  {
    id: 'u4-remainder-less-divisor',
    knowledgePoint: 'u4.remainder.rule',
    unitId: '3A-U4',
    levels: ['L2', 'L3'],
    statement: '有余数的除法中，余数一定小于除数。',
    truth: true,
    rationale: '余数必须小于除数，这是有余数除法的规则。',
    source: '沪教版三上 U4《用一位数除》：有余数的除法（余数必须小于除数）',
    absoluteReview: '特例：整除时余数为0，仍小于除数，无例外',
  },
  // ---- U2 用一位数乘 ----
  {
    id: 'u2-tens-trailing-zero',
    knowledgePoint: 'u2.tens.trailingZero',
    unitId: '3A-U2',
    levels: ['L1', 'L2'],
    statement: '整十数乘一位数，积的末尾一定有0。',
    truth: true,
    rationale: '整十数是一个数乘10，再乘一位数，积一定能被10整除，末尾有0。',
    source: '沪教版三上 U2《用一位数乘》：整十数乘一位数的口算',
    absoluteReview: '特例：10×0=0 也以 0 结尾，无例外',
  },
  {
    id: 'u2-hundreds-two-zeros',
    knowledgePoint: 'u2.hundreds.trailingZero',
    unitId: '3A-U2',
    levels: ['L2', 'L3'],
    statement: '整百数乘一位数，积的末尾只有两个0。',
    truth: false,
    rationale: '整百数乘一位数，积的末尾可能有两个或三个0，如200×5=1000。',
    singleError: '积的末尾可能有两个或三个0',
    absoluteReview: '特例：200×5=1000 末尾有三个0，是「只有两个0」的反例',
  },
]

/** 校验单条命题；返回空数组表示合规 */
export function validateConcept(record: ConceptProposition): string[] {
  const issues: string[] = []
  if (!record.id.trim()) issues.push('命题缺少 ID')
  const kp = record.knowledgePoint?.trim() ?? ''
  if (!kp) issues.push('命题缺少知识点键（knowledgePoint）')
  else if (!/^[a-z0-9]+(\.[a-zA-Z0-9]+)+$/.test(kp)) issues.push(`知识点键格式不合法：${kp}`)
  if (!record.unitId.trim()) issues.push('命题缺少单元归属')
  if (record.levels.length === 0) issues.push('命题缺少适用难度')
  const statement = record.statement.trim()
  if (!statement) issues.push('命题缺少陈述句')
  if (statement.endsWith('？') || statement.endsWith('?')) issues.push('陈述句不能是问句')
  for (const word of AMBIGUOUS) {
    if (statement.includes(word)) issues.push(`陈述句含模糊表述「${word}」`)
  }
  // 绝对化表述必须带特例复核结论，防止靠「孩子没想到特例」才成立
  const absoluteMatch = statement.match(ABSOLUTE)
  if (absoluteMatch) {
    const review = record.absoluteReview?.trim() ?? ''
    if (!review) issues.push(`绝对化表述「${absoluteMatch[0]}」缺少特例复核（absoluteReview）`)
    else if (!review.includes('特例')) issues.push('特例复核（absoluteReview）必须写明「特例」结论')
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

/** 复核概念选择题：四个选项必须在命题表里，真假分布与来源命题一致 */
export function verifyConceptChoice(data: {
  conceptId: string
  options: string[]
  answerIndex: number
  want: 'true' | 'false'
}): { ok: boolean; error?: string } {
  const focal = findConcept(data.conceptId)
  if (!focal) return { ok: false, error: '概念选择题来源命题不在命题表里' }
  if (data.options.length !== 4) {
    return { ok: false, error: `概念选择题应有 4 个选项，实际 ${data.options.length}` }
  }
  const statements = data.options.map((option) => option.trim())
  if (new Set(statements).size !== statements.length) {
    return { ok: false, error: '概念选择题存在重复选项' }
  }
  const records = statements.map((statement) =>
    CONCEPT_PROPOSITIONS.find((record) => record.statement.trim() === statement),
  )
  const missing = statements.find((_, index) => !records[index])
  if (missing) return { ok: false, error: `选项不在命题表里：${missing}` }
  const trueCount = records.filter((record) => record!.truth).length
  const expectedTrue = data.want === 'true' ? 1 : 3
  if (trueCount !== expectedTrue) {
    return {
      ok: false,
      error: `「${data.want === 'true' ? '正确' : '不正确'}」题应有 ${expectedTrue} 个正确陈述，实际 ${trueCount} 个`,
    }
  }
  if (!Number.isInteger(data.answerIndex) || data.answerIndex < 0 || data.answerIndex > 3) {
    return { ok: false, error: '概念选择题标答下标越界' }
  }
  const answerRecord = records[data.answerIndex]!
  if (answerRecord.id !== focal.id) return { ok: false, error: '标答选项与来源命题不一致' }
  if (focal.truth !== (data.want === 'true')) {
    return { ok: false, error: '来源命题真值与题干问法不一致' }
  }
  for (const record of records) {
    if (!record!.truth && !record!.singleError) {
      return { ok: false, error: `干扰陈述缺少唯一错误点：${record!.id}` }
    }
    if (record!.truth && !record!.source) {
      return { ok: false, error: `正确陈述缺少依据：${record!.id}` }
    }
  }
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
