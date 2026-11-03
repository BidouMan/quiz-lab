<script setup lang="ts">
import { computed } from 'vue'
import KatexSpan from '../components/KatexSpan.vue'
import GeometryFigure from './GeometryFigure.vue'
import type { LabItem } from './labTypes'

/** 试验卷单题渲染：按 kind 分派，根元素带 data-mid 供实测高度 */
const props = defineProps<{ item: LabItem }>()

/** 长题干纯留白高度：n 行 × 28 + (n-1) × 8（约 3 行 = 100px） */
const wordBlankH = computed(() => {
  const n = props.item.workLines ?? 3
  return n * 28 + (n - 1) * 8
})

/** 题后额外间距（分数题拉开行距用），计入分页估算 */
const itemStyle = computed(() =>
  props.item.gapAfter ? { marginBottom: `${props.item.gapAfter}px` } : undefined
)

/** 有题号的题型：编号列 + 内容体（折行悬挂对齐，不回到编号下） */
const hasNo = computed(() => props.item.no !== undefined)
</script>

<template>
  <div class="li" :data-mid="item.id" :style="itemStyle">
    <!-- 计算类（口算/分数/竖式）：无题号 -->
    <template v-if="!hasNo">
      <!-- 行内算式：等号后约 40px 纯留白，不画任何线 -->
      <div v-if="item.kind === 'latex'" class="line">
        <KatexSpan :tex="item.latex ?? ''" />
        <span class="ans-space"></span>
      </div>

      <!-- 除法竖式：题干 + 纯留白书写区 -->
      <div v-else class="divv">
        <div class="line"><KatexSpan :tex="item.latex ?? ''" /></div>
        <div
          class="write-blank"
          :data-mid="`${item.id}-blank`"
          :style="{ height: `${item.blankH ?? 104}px` }"
        ></div>
      </div>
    </template>

    <!-- 有题号的题型：(n) 题号列（宽 var(--qno-w)，tabular-nums 防漂移）+ 内容体 -->
    <div v-else class="nrow">
      <span class="qno">({{ item.no }})</span>
      <div class="nbody">
        <!-- 带图题：题干在左、示意图在右，整体垂直居中；图不挤压、题干折行不压图 -->
        <template v-if="item.kind === 'geom'">
          <div class="geom">
            <p class="geom-text">{{ item.text }}</p>
            <GeometryFigure :shape="item.shape ?? 'rect'" />
          </div>
          <div class="geom-blank"></div>
        </template>

        <!-- 比大小：式子 ○ 式子（CSS 空心圆） -->
        <div v-else-if="item.kind === 'compare'" class="line">
          <KatexSpan :tex="item.pre ?? ''" />
          <span class="cmp-circle" :data-mid="`${item.id}-circle`"></span>
          <KatexSpan :tex="item.post ?? ''" />
        </div>

        <!-- 填空：文本与变长空格混排 -->
        <div v-else-if="item.kind === 'fill'" class="fill">
          <template v-for="(p, i) in item.parts ?? []" :key="i">
            <span v-if="'t' in p">{{ p.t }}</span>
            <span v-else class="blk" :style="{ width: `${p.b}px` }"></span>
          </template>
        </div>

        <!-- 讲讲算算：长题干 + 纯留白作答区（约 3 行高） -->
        <div v-else-if="item.kind === 'word'" class="word">
          <p class="word-text" :data-mid="`${item.id}-text`">{{ item.text }}</p>
          <div class="word-blank" :style="{ height: `${wordBlankH}px` }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.li {
  break-inside: avoid;
  page-break-inside: avoid;
  padding: 3px 0;
}
.line {
  display: flex;
  align-items: baseline;
  line-height: 1.6;
}
/* 编号行：题号从栏左边界起，列宽 var(--qno-w)（实测 (10) 宽）+ 固定 8px 间距，题干紧随其后 */
.nrow {
  display: flex;
  align-items: flex-start;
}
.qno {
  flex: none;
  width: var(--qno-w, 30px);
  margin-right: 8px;
  text-align: left;
  font-size: 15px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  line-height: 24px;
  color: #555;
}
.nbody {
  flex: 1;
  min-width: 0;
}
/* 算式答案位：等号后纯留白，不画线 */
.ans-space {
  display: inline-block;
  width: 40px;
  height: 0.95em;
}
/* 比大小空心圆：直径 15px、边框 0.75px、与行垂直居中 */
.cmp-circle {
  display: inline-block;
  flex: none;
  align-self: center;
  width: 15px;
  height: 15px;
  margin: 0 8px;
  border: 0.75px solid #000;
  border-radius: 50%;
  background: transparent;
}
/* 填空空格：细下划线 */
.blk {
  display: inline-block;
  height: 0.95em;
  margin: 0 2px;
  border-bottom: 1px solid #999;
  vertical-align: baseline;
}
.fill {
  line-height: 1.6;
}
.geom {
  display: flex;
  gap: 12px;
  align-items: center;
}
.geom-text {
  margin: 0;
  line-height: 1.6;
}
/* 图形题作答区：纯留白约 2 行，什么都不画 */
.geom-blank {
  height: 56px;
  margin-top: 8px;
}
.word-text {
  margin: 0;
  line-height: 1.6;
}
/* 长题干作答区：纯留白，什么都不画 */
.word-blank {
  margin-top: 8px;
}
/* 竖式书写区：纯留白（宽度即栏宽 337px） */
.write-blank {
  margin: 6px 0 2px;
}
</style>
