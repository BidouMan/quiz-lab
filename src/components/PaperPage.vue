<script setup lang="ts">
import { computed } from 'vue'
import type { AnswerPageModel, PaperPageModel } from '../paper/paginate'
import { COL_GAP, COL_W, CONTENT_H, PAGE_H, PAGE_PADDING, PAGE_W } from '../paper/paginate'
import KatexSpan from './KatexSpan.vue'
import QuestionItem from './QuestionItem.vue'
import RichText from './RichText.vue'

/**
 * 一页 A4 纸。屏幕预览时外层按 transform 缩放；打印时原始尺寸输出。
 * 行优先排布：节标题通栏，随后每行左右两题，顶部对齐，行高取大。
 * 无题号：题干顶到栏左边界；答案页给完整算式，按卷面顺序排列。
 * kind = paper 试卷页 / answer 答案页
 */
const props = defineProps<{
  kind: 'paper' | 'answer'
  title: string
  page: PaperPageModel | AnswerPageModel
  pageNo: number
  totalPages: number
  scale: number
}>()

const paperBlocks = computed(() => (props.kind === 'paper' ? (props.page as PaperPageModel).blocks : null))
const answerBlocks = computed(() => (props.kind === 'answer' ? (props.page as AnswerPageModel).blocks : null))
</script>

<template>
  <div
    class="sheet"
    :style="{ width: `${PAGE_W}px`, height: `${PAGE_H}px`, padding: `${PAGE_PADDING}px` }"
  >
    <!-- 页眉：仅标题 + 细分隔线 -->
    <header class="phead">
      <h1 class="ptitle">
        {{ title }}<template v-if="kind === 'answer'"> · 参考答案</template>
      </h1>
    </header>

    <!-- 正文：行优先两题一行 -->
    <main class="pbody" :style="{ height: `${CONTENT_H}px` }">
      <template v-if="paperBlocks">
        <template v-for="(b, bi) in paperBlocks" :key="bi">
          <div v-if="b.kind === 'section'" class="section-title">{{ b.title }}</div>
          <div v-else class="row" :style="{ gap: `${COL_GAP}px` }">
            <div class="cell" :style="{ width: `${COL_W}px` }">
              <QuestionItem :q="b.left.q" :scale="scale" />
            </div>
            <div class="cell" :style="{ width: `${COL_W}px` }">
              <QuestionItem v-if="b.right" :q="b.right.q" :scale="scale" />
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="answerBlocks">
        <template v-for="(b, bi) in answerBlocks" :key="bi">
          <div v-if="b.kind === 'section'" class="section-title">{{ b.title }}</div>
          <div v-else class="row" :style="{ gap: `${COL_GAP}px` }">
            <div class="cell" :style="{ width: `${COL_W}px` }">
              <div v-if="b.left.lines" class="answer-steps">
                <div v-for="(ln, li) in b.left.lines" :key="li" class="answer-step">
                  <KatexSpan :tex="ln" />
                </div>
              </div>
              <div v-else-if="b.left.latex" class="answer-line"><KatexSpan :tex="b.left.latex" /></div>
              <div v-else-if="b.left.text" class="answer-line"><RichText :text="b.left.text" /></div>
            </div>
            <div class="cell" :style="{ width: `${COL_W}px` }">
              <template v-if="b.right">
                <div v-if="b.right.lines" class="answer-steps">
                  <div v-for="(ln, li) in b.right.lines" :key="li" class="answer-step">
                    <KatexSpan :tex="ln" />
                  </div>
                </div>
                <div v-else-if="b.right.latex" class="answer-line"><KatexSpan :tex="b.right.latex" /></div>
                <div v-else-if="b.right.text" class="answer-line"><RichText :text="b.right.text" /></div>
              </template>
            </div>
          </div>
        </template>
      </template>
    </main>

    <!-- 页脚 -->
    <footer class="pfoot">第 {{ pageNo }} 页 · 共 {{ totalPages }} 页</footer>
  </div>
</template>

<style scoped>
.sheet {
  position: relative;
  background: #fff;
  color: #000;
  box-sizing: border-box;
  font-size: 15px;
}

/* 页眉：总高 28px，仅标题 + 细分隔线 */
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

/* 正文行排布 */
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
  font-weight: 700;
  line-height: 26px;
  margin: 6px 0 0;
  break-after: avoid;
  break-inside: avoid;
  page-break-inside: avoid;
}
.answer-line {
  line-height: 24px;
  margin-bottom: 16px;
}
.answer-steps {
  margin-bottom: 16px;
}
.answer-step {
  line-height: 24px;
}

/* 页脚 */
.pfoot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  text-align: center;
  font-size: 12px;
  color: #333;
}
</style>
