<script setup lang="ts">
import { computed } from 'vue'
import { itemHeight, WORK_LINE_GAP, WORK_LINE_H, workSteps } from '../paper/paginate'
import type { Question } from '../types'
import KatexSpan from './KatexSpan.vue'
import RichText from './RichText.vue'

/** 无题号：题干直接顶到栏的内容左边界 */
const props = defineProps<{ q: Question; scale: number }>()

/** 竖式题题干行内式子（只出题干，不预画竖式） */
const vertExpr = computed(() => {
  if (!props.q.operands || !props.q.op) return ''
  const sym = { add: '+', sub: '-', mul: '\\times', div: '\\div' }[props.q.op]
  return `${props.q.operands[0]} ${sym} ${props.q.operands[1]} =`
})

/** 脱式 / 简便运算书写行数：按运算符个数（两步 2 行、三步 3 行） */
const lines = computed(() => workSteps(props.q.latex))

const minH = computed(() => Math.round(itemHeight(props.q) * props.scale))
const lineH = computed(() => Math.round(WORK_LINE_H * props.scale))
const lineGap = computed(() => Math.round(WORK_LINE_GAP * props.scale))
</script>

<template>
  <!-- 口算：一行一题，等号后约 36px 纯空白（无下划线无方框） -->
  <div v-if="q.type === 'kousuan'" class="q q-kousuan" :style="{ minHeight: `${minH}px` }">
    <KatexSpan v-if="q.latex" :tex="q.latex" />
    <span class="ans-blank"></span>
  </div>

  <!-- 填空：文本 + 内联公式 -->
  <div v-else-if="q.type === 'tiankong'" class="q q-tiankong" :style="{ minHeight: `${minH}px` }">
    <RichText v-if="q.text" :text="q.text" />
  </div>

  <!-- 竖式：仅题干 + 纯空白书写区（约 4 行），不预画数字与横线 -->
  <div v-else-if="q.type === 'chushi'" class="q q-block" :style="{ minHeight: `${minH}px` }">
    <div class="q-head">
      <KatexSpan :tex="vertExpr" />
    </div>
    <div class="write-blank" :style="{ height: `${Math.round(104 * scale)}px` }"></div>
  </div>

  <!-- 脱式 / 简便运算：题干左对齐 + 按步数给书写行 -->
  <div v-else class="q q-block" :style="{ minHeight: `${minH}px` }">
    <div class="q-head">
      <KatexSpan v-if="q.latex" :tex="q.latex" />
      <span class="qtag" v-if="q.type === 'jianbian'">（用简便方法计算）</span>
    </div>
    <div class="work-lines">
      <div
        v-for="i in lines"
        :key="i"
        class="work-line"
        :style="{ height: `${lineH}px`, marginTop: `${i === 1 ? Math.round(6 * scale) : lineGap}px` }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.q {
  display: flex;
  align-items: baseline;
  break-inside: avoid;
  page-break-inside: avoid;
}
.q-kousuan {
  padding: 3px 0;
}
.ans-blank {
  display: inline-block;
  width: 36px;
  height: 0.95em;
  margin-left: 2px;
  vertical-align: baseline;
}
.q-tiankong {
  padding: 3px 0;
  line-height: 1.8;
}
.q-block {
  flex-direction: column;
  align-items: stretch;
  padding: 4px 0;
}
.q-head {
  display: flex;
  align-items: baseline;
  line-height: 1.8;
}
.qtag {
  margin-left: 6px;
  font-size: 13px;
}
.write-blank {
  margin: 6px 0 2px;
}
.work-line {
  width: 66%;
  border-bottom: 1px dashed #bbb;
}
</style>
