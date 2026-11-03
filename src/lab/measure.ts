import katex from 'katex'
import type { LabItem } from './labTypes'

/**
 * 题干宽度实测模块（栏位判定用）。
 * - 纯文本段：Canvas 2D measureText，字体/字号/字重与正文完全一致（15px / 400 / 系统字体栈）
 * - 公式段：KaTeX renderToString 渲染进离屏隐藏 div 测一次实际宽度，结果按 tex 缓存
 * 全程确定性：同一输入永远得到同一数值，不回读版式结果，无抖动。
 */

let ctx: CanvasRenderingContext2D | null = null
function canvasCtx(): CanvasRenderingContext2D {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!
    ctx.font =
      '15px -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Songti SC", serif'
  }
  return ctx
}

/** 纯文本题干宽度（px） */
export function textWidth(s: string): number {
  return canvasCtx().measureText(s).width
}

const latexCache = new Map<string, number>()

/** KaTeX 公式段宽度（px）：离屏渲染一次并缓存 */
export function latexWidth(tex: string): number {
  const hit = latexCache.get(tex)
  if (hit !== undefined) return hit
  const host = document.createElement('div')
  host.style.cssText =
    'position:absolute;left:-9999px;top:0;visibility:hidden;display:inline-block;font-size:15px;'
  host.innerHTML = katex.renderToString(tex, { throwOnError: false, output: 'html' })
  document.body.appendChild(host)
  const w = host.offsetWidth
  document.body.removeChild(host)
  latexCache.set(tex, w)
  return w
}

const CIRCLE_W = 15 + 16 // 比大小圆圈 15px + 左右间距
const ANS_SPACE_W = 40 // 等号后纯留白
const FIG_W: Record<string, number> = { rect: 165, square: 140 }
const FIG_GAP = 12

/** 题干首行内容总宽（px），不含编号列 */
export function stemWidth(item: LabItem): number {
  switch (item.kind) {
    case 'fill':
      return (item.parts ?? []).reduce(
        (w, p) => w + ('t' in p ? textWidth(p.t) : p.b + 4),
        0
      )
    case 'compare':
      return latexWidth(item.pre ?? '') + CIRCLE_W + latexWidth(item.post ?? '')
    case 'latex':
    case 'div':
      return latexWidth(item.latex ?? '') + ANS_SPACE_W
    case 'word':
      return textWidth(item.text ?? '')
    case 'geom':
      return (FIG_W[item.shape ?? 'rect'] ?? 165) + FIG_GAP + textWidth(item.text ?? '')
  }
}
