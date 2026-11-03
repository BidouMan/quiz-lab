/** 版式试验卷的题目定义（独立于主卷题库，仅用于 ?lab=1 页面压边界情况） */

export type LabPart = { t: string } | { b: number }

export interface LabItem {
  /** 测量锚点 id */
  id: string
  /** compare = 比大小（独立题型，不归填空/计算） */
  kind: 'geom' | 'latex' | 'compare' | 'fill' | 'word' | 'div'
  /** 分页估算高度（px），用于和实测对比暴露偏差 */
  estH: number
  /** 跨两栏独占整行（图形题、长题干、实测超宽题自动提升） */
  wide?: boolean
  /** 题号（填空/比大小/讲讲算算/图形题，分区内从 1 独立编号；计算类无） */
  no?: number
  /** 题后额外垂直间距（px），计入 estH */
  gapAfter?: number
  /** geom：图形种类 */
  shape?: 'rect' | 'square'
  /** geom / word：题干文字 */
  text?: string
  /** latex / div：行内 KaTeX */
  latex?: string
  /** compare：圆圈左右两段 KaTeX */
  pre?: string
  post?: string
  /** fill：文本与空格片段 */
  parts?: LabPart[]
  /** word：作答留白行数 */
  workLines?: number
  /** div：书写区高度 px（默认 104） */
  blankH?: number
}

export interface LabSection {
  title: string
  /** 节标题下的一行小字统一说明（如比大小） */
  note?: string
  items: LabItem[]
}
