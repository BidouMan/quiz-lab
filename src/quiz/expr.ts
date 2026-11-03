/** 算式 AST：渲染 LaTeX、递等式展开、独立求值（自检与测试共用）。 */

export type BinOp = '+' | '-' | '×' | '÷'
export type ExprNode =
  | { kind: 'num'; value: number }
  | { kind: 'bin'; op: BinOp; left: ExprNode; right: ExprNode }

export const num = (value: number): ExprNode => ({ kind: 'num', value })
export const bin = (op: BinOp, left: ExprNode, right: ExprNode): ExprNode => ({
  kind: 'bin',
  op,
  left,
  right,
})

const OP_LATEX: Record<BinOp, string> = {
  '+': '+',
  '-': '-',
  '×': '\\times',
  '÷': '\\div',
}

const prec = (op: BinOp): number => (op === '+' || op === '-' ? 1 : 2)

function needsParens(node: ExprNode, parentOp: BinOp, side: 'left' | 'right'): boolean {
  if (node.kind !== 'bin') return false
  if (prec(node.op) < prec(parentOp)) return true
  if (prec(node.op) > prec(parentOp)) return false
  // 同优先级：右子树保结构加括号，左子树按左结合不加
  return side === 'right'
}

function render(node: ExprNode, parentOp?: BinOp, side: 'left' | 'right' = 'left'): string {
  if (node.kind === 'num') return String(node.value)
  const body = `${render(node.left, node.op, 'left')} ${OP_LATEX[node.op]} ${render(
    node.right,
    node.op,
    'right',
  )}`
  return parentOp && needsParens(node, parentOp, side) ? `(${body})` : body
}

export function toLatex(node: ExprNode): string {
  return render(node)
}

export function evalNode(node: ExprNode): number {
  if (node.kind === 'num') return node.value
  const left = evalNode(node.left)
  const right = evalNode(node.right)
  let value: number
  switch (node.op) {
    case '+':
      value = left + right
      break
    case '-':
      value = left - right
      break
    case '×':
      value = left * right
      break
    case '÷':
      if (right === 0 || left % right !== 0) throw new Error(`不能整除: ${left} ÷ ${right}`)
      value = left / right
      break
  }
  if (!Number.isInteger(value)) throw new Error(`结果不是整数: ${value}`)
  if (value < 0) throw new Error(`出现负数: ${value}`)
  return value
}

interface Located {
  path: number[]
  node: Extract<ExprNode, { kind: 'bin' }>
}

function collectReady(node: ExprNode, path: number[], out: Located[]): void {
  if (node.kind === 'num') return
  collectReady(node.left, [...path, 0], out)
  if (node.left.kind === 'num' && node.right.kind === 'num') out.push({ path, node })
  collectReady(node.right, [...path, 1], out)
}

function replaceAt(node: ExprNode, path: number[], value: number): ExprNode {
  if (path.length === 0) return num(value)
  if (node.kind === 'num') throw new Error('路径越界')
  const [head, ...rest] = path
  return head === 0
    ? bin(node.op, replaceAt(node.left, rest, value), node.right)
    : bin(node.op, node.left, replaceAt(node.right, rest, value))
}

function reduceOnce(root: ExprNode): ExprNode {
  const ready: Located[] = []
  collectReady(root, [], ready)
  if (ready.length === 0) throw new Error('没有可约简的运算')
  let chosen = ready[0]
  for (const item of ready) {
    if (prec(item.node.op) > prec(chosen.node.op)) chosen = item
  }
  return replaceAt(root, chosen.path, evalNode(chosen.node))
}

/** 按“先括号、再乘除、后加减”的顺序展开递等式，返回带题干行的若干行 */
export function stepLines(root: ExprNode): string[] {
  const lines = [toLatex(root)]
  let current = root
  while (current.kind === 'bin') {
    current = reduceOnce(current)
    lines.push(`= ${toLatex(current)}`)
  }
  return lines
}

/** 与生成器无关的独立求值：把 LaTeX 算式转成普通四则并计算，用于答案自检 */
export function evalLatex(latex: string): number {
  const source = latex
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/=/g, ' ')
    .trim()
  let i = 0

  const skip = () => {
    while (source[i] === ' ') i++
  }

  const parsePrimary = (): number => {
    skip()
    if (source[i] === '(') {
      i++
      const value = parseExpr(1)
      skip()
      if (source[i] !== ')') throw new Error(`缺少右括号: ${source}`)
      i++
      return value
    }
    const start = i
    while (i < source.length && /[0-9]/.test(source[i])) i++
    if (start === i) throw new Error(`这里应该有数字: ${source.slice(i)}`)
    return Number(source.slice(start, i))
  }

  const parseExpr = (minPrec: number): number => {
    let left = parsePrimary()
    while (true) {
      skip()
      const op = source[i]
      if (!op || op === ')' || !['+', '-', '×', '÷'].includes(op)) break
      const p = prec(op as BinOp)
      if (p < minPrec) break
      i++
      const right = parseExpr(p + 1)
      switch (op) {
        case '+':
          left += right
          break
        case '-':
          left -= right
          break
        case '×':
          left *= right
          break
        case '÷':
          if (right === 0 || left % right !== 0) throw new Error(`不能整除: ${left} ÷ ${right}`)
          left /= right
          break
      }
      if (!Number.isInteger(left)) throw new Error(`结果不是整数: ${left}`)
      if (left < 0) throw new Error(`出现负数: ${left}`)
    }
    return left
  }

  const value = parseExpr(1)
  skip()
  if (i !== source.length) throw new Error(`算式没有读完: ${source.slice(i)}`)
  return value
}
