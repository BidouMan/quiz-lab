<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  COL_GAP,
  COL_W,
  CONTENT_H,
  CONTENT_W,
  PAGE_H,
  PAGE_PADDING,
  PAGE_W,
} from '../paper/paginate'
import LabItemView from './LabItemView.vue'
import type { LabItem, LabSection } from './labTypes'
import { stemWidth, textWidth } from './measure'

/**
 * 版式试验卷（?lab=1）：独立于主卷，专门压边界情况。
 * 带自己的迷你分页器（支持跨两栏的 wide 行），estH 为估算高度，
 * ?measure=1 时把每个 [data-mid] 元素的实测宽高写入 <pre id="measure">。
 */

const TITLE = '版式试验卷'

const SECTIONS: LabSection[] = [
  {
    title: '一、图形与周长',
    items: [
      // 图形题永不并排：一律通栏独占整行
      {
        id: 'g1',
        kind: 'geom',
        shape: 'rect',
        wide: true,
        text: '左图长方形的长是 8 cm，宽是 5 cm。它的周长是多少厘米？',
        estH: 176,
      },
      {
        id: 'g2',
        kind: 'geom',
        shape: 'square',
        wide: true,
        text: '左图正方形的边长是 6 cm。它的周长是多少厘米？',
        estH: 176,
      },
    ],
  },
  {
    title: '二、分数初步',
    items: [
      // \dfrac 展示样式；分数题间加 15px 行距（计入 estH）；等号后纯留白
      { id: 'f1', kind: 'latex', latex: '\\dfrac{1}{3}+\\dfrac{1}{3}=', gapAfter: 15, estH: 58 },
      // 普通口算对照项：同行实测分数行与口算行的两列对齐
      { id: 'f0', kind: 'latex', latex: '24 \\times 5=', estH: 31 },
      { id: 'f3', kind: 'latex', latex: '\\dfrac{5}{6}-\\dfrac{1}{6}=', wide: true, gapAfter: 15, estH: 58 },
    ],
  },
  {
    title: '三、填空',
    items: [
      { id: 't1', kind: 'fill', parts: [{ t: '1 千米 = ' }, { b: 64 }, { t: ' 米' }], estH: 31 },
      { id: 't2', kind: 'fill', parts: [{ t: '3 吨 50 千克 = ' }, { b: 76 }, { t: ' 千克' }], estH: 31 },
      { id: 't4', kind: 'fill', parts: [{ t: '199 × 4 ≈ ' }, { b: 64 }], estH: 31 },
      { id: 't5', kind: 'fill', parts: [{ t: '2 时 30 分 = ' }, { b: 56 }, { t: ' 分' }], estH: 31 },
      {
        id: 't6',
        kind: 'fill',
        parts: [
          { t: '一个长方形的长是 12 厘米，宽是长的一半，它的周长是 ' },
          { b: 64 },
          { t: ' 厘米。' },
        ],
        // 题干实测约 480px > 半栏可用 309px，会被自动提升为通栏单行
        estH: 31,
      },
    ],
  },
  {
    // 比大小独立成节，统一说明，题内不再重复提示
    title: '四、比大小',
    note: '在 ○ 里填 >、< 或 =',
    items: [
      { id: 'c1', kind: 'compare', pre: '\\dfrac{2}{5}', post: '\\dfrac{3}{5}', estH: 44 },
      { id: 'c2', kind: 'compare', pre: '45 \\times 3', post: '54 \\times 3', estH: 31 },
    ],
  },
  {
    title: '五、讲讲算算',
    items: [
      // 书写区纯留白约 3 行（不画线）
      {
        id: 'w1',
        kind: 'word',
        wide: true,
        text: '学校操场一圈长 400 米。小明每天早上沿操场跑 2 圈，从周一到周五天天如此。他这一个星期一共跑了多少米？',
        workLines: 3,
        estH: 164,
      },
      {
        id: 'w2',
        kind: 'word',
        wide: true,
        text: '三年级同学去科技馆参观，每张门票 8 元。李老师带了 200 元，要给 23 名同学每人买一张门票。买完门票后，李老师还剩多少元？',
        workLines: 3,
        estH: 164,
      },
    ],
  },
  {
    title: '六、除法竖式',
    items: [
      // 书写区纯留白（不画框不画线）
      { id: 'd1', kind: 'div', latex: '847 \\div 7 =', estH: 143 },
      { id: 'd2', kind: 'div', latex: '84 \\div 6 =', estH: 143 },
    ],
  },
]

// ---------- 栏位决策与编号（分页前一次性完成，确定性） ----------

/** 有题号的题型：填空 / 比大小 / 讲讲算算 / 图形；计算类（latex / div）无题号 */
const NUMBERED = new Set<LabItem['kind']>(['fill', 'compare', 'word', 'geom'])
/**
 * 题号列宽：Canvas 实测 '(10)'（半角括号，tabular-nums 下任意两位数字同宽），
 * 固定列宽保证 (1) 与 (10) 题干起点一致不漂移；题号与题干固定 8px 间距。
 */
const QNO_W = Math.ceil(textWidth('(10)'))
const NO_INDENT = QNO_W + 8
/** 半栏题干可用宽度：栏宽 337 减 4px 余量，超出即提升为通栏 */
const HALF_USABLE = COL_W - 4

/**
 * 栏位决策按题干实测宽度（Canvas / 离屏 KaTeX，见 measure.ts）：
 * 图形题与长题干恒通栏；其余题型首行内容 + 编号列 > 半栏可用宽度时提升为通栏，
 * 仅通栏仍放不下时才折行，半栏内不出现硬折行。
 * 编号分区内独立从 1 开始（填空 1..n、比大小 1..n 各自起算）。
 */
function assignLayout(): void {
  for (const sec of SECTIONS) {
    let no = 0
    for (const it of sec.items) {
      if (NUMBERED.has(it.kind)) it.no = ++no
      if (it.kind === 'geom' || it.kind === 'word') {
        it.wide = true
        continue
      }
      if (stemWidth(it) + (it.no !== undefined ? NO_INDENT : 0) > HALF_USABLE) it.wide = true
    }
  }
}
assignLayout()

// ---------- 迷你分页器（行优先，支持 wide 独占整行） ----------

type LBlock =
  | { kind: 'section'; title: string; note?: string; noteIndent?: number }
  | { kind: 'row'; left: LabItem; right?: LabItem }

const SECTION_H = 32
/** 节说明小字行高（计入首页行估算） */
const NOTE_H = 20

function labPaginate(secs: LabSection[]): LBlock[][] {
  const pages: LBlock[][] = []
  let blocks: LBlock[] = []
  let used = 0
  const flush = () => {
    if (blocks.length > 0) pages.push(blocks)
    blocks = []
    used = 0
  }
  for (const sec of secs) {
    let first = true
    let i = 0
    while (i < sec.items.length) {
      const l = sec.items[i]
      let r: LabItem | undefined
      if (!l.wide && i + 1 < sec.items.length && !sec.items[i + 1].wide) {
        r = sec.items[i + 1]
        i += 2
      } else {
        i += 1
      }
      const headH = SECTION_H + (sec.note ? NOTE_H : 0)
      const need = (first ? headH : 0) + Math.max(l.estH, r ? r.estH : 0)
      if (used + need > CONTENT_H && blocks.length > 0) flush()
      if (first) {
        // 节说明缩进到题干起点：有号分区缩进题号列宽 + 8px 间距，无号分区与节标题齐平
        const numberedSec = sec.items.some((it) => NUMBERED.has(it.kind))
        blocks.push({
          kind: 'section',
          title: sec.title,
          note: sec.note,
          noteIndent: sec.note && numberedSec ? NO_INDENT : 0,
        })
      }
      blocks.push(r ? { kind: 'row', left: l, right: r } : { kind: 'row', left: l })
      used += need
      first = false
    }
  }
  flush()
  return pages
}

const pages = computed(() => labPaginate(SECTIONS))

// ---------- 实测模式：?lab=1&measure=1 时输出各元素实际宽高 ----------

const measureMode = new URLSearchParams(window.location.search).has('measure')
const measureJson = ref('')
const layoutJson = ref('')
onMounted(async () => {
  if (!measureMode) return
  await nextTick()
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const out: Record<string, { w: number; h: number; l: number; sw: number }> = {}
  document.querySelectorAll('[data-mid]').forEach((el) => {
    const e = el as HTMLElement
    out[e.dataset.mid ?? '?'] = {
      w: Math.round(e.offsetWidth),
      h: Math.round(e.offsetHeight),
      l: Math.round(e.offsetLeft),
      sw: Math.round(e.scrollWidth),
    }
  })
  out.__meta = { w: QNO_W, h: 0, l: 0, sw: 0 }
  measureJson.value = JSON.stringify(out)
  // 栏位决策依据：各题题干实测宽与最终栏位/编号
  const layout: Record<string, { stemW: number; wide: boolean; no?: number }> = {}
  for (const sec of SECTIONS) {
    for (const it of sec.items) {
      layout[it.id] = {
        stemW: Math.round(stemWidth(it)),
        wide: !!it.wide,
        ...(it.no !== undefined ? { no: it.no } : {}),
      }
    }
  }
  layoutJson.value = JSON.stringify(layout)
})
</script>

<template>
  <div class="app">
    <main class="main">
      <div class="pages">
        <div v-for="(pg, pi) in pages" :key="pi" class="sheet-outer">
          <div
            class="sheet"
            :data-mid="`sheet-${pi}`"
            :style="{
              width: `${PAGE_W}px`,
              height: `${PAGE_H}px`,
              padding: `${PAGE_PADDING}px`,
              '--qno-w': `${QNO_W}px`,
            }"
          >
            <header class="phead">
              <h1 class="ptitle">{{ TITLE }}</h1>
            </header>
            <main class="pbody" :style="{ height: `${CONTENT_H}px` }">
              <template v-for="(b, bi) in pg" :key="bi">
                <template v-if="b.kind === 'section'">
                  <div class="section-title">{{ b.title }}</div>
                  <div v-if="b.note" class="section-note" data-mid="note" :style="{ marginLeft: `${b.noteIndent ?? 0}px` }">{{ b.note }}</div>
                </template>
                <div v-else class="row" :style="{ gap: `${COL_GAP}px` }">
                  <div class="cell" :style="{ width: `${b.left.wide ? CONTENT_W : COL_W}px` }">
                    <LabItemView :item="b.left" />
                  </div>
                  <div v-if="b.right" class="cell" :style="{ width: `${COL_W}px` }">
                    <LabItemView :item="b.right" />
                  </div>
                </div>
              </template>
            </main>
            <footer class="pfoot">第 {{ pi + 1 }} 页 · 共 {{ pages.length }} 页</footer>
          </div>
        </div>
      </div>
    </main>
    <pre v-if="measureMode" id="measure">{{ measureJson }}</pre>
    <pre v-if="measureMode" id="layout">{{ layoutJson }}</pre>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  background: #ececec;
  overflow-y: auto;
}
.main {
  padding: 28px 0 40px;
}
.pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}
.sheet-outer {
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
  background: #fff;
}
.sheet {
  position: relative;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-size: 15px;
}
.phead {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 0.5px solid #d5d5d5;
}
.ptitle {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1.5px;
  line-height: 1.2;
}
.pbody {
  margin-top: 4px;
}
.row {
  display: flex;
  align-items: flex-start;
  break-inside: avoid;
  page-break-inside: avoid;
}
.cell {
  flex: none;
  min-width: 0;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 26px;
  margin: 6px 0 0;
  break-after: avoid;
  break-inside: avoid;
}
/* 节说明小字：13px / #666，有号分区缩进到题干起点 */
.section-note {
  font-size: 13px;
  font-weight: 400;
  color: #666;
  line-height: 18px;
  margin-top: 2px;
  break-after: avoid;
  break-inside: avoid;
}
.pfoot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  text-align: center;
  font-size: 11px;
  font-weight: 400;
  color: #999;
}
#measure {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 9;
  background: #fff;
  font-size: 10px;
}
/* 打印时放开滚动容器，否则只出第一屏 */
@media print {
  .app {
    overflow: visible !important;
  }
}
</style>
