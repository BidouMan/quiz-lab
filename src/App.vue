<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PaperPage from './components/PaperPage.vue'
import ParamPanel from './components/ParamPanel.vue'
import TopBar from './components/TopBar.vue'
import LabPaper from './lab/LabPaper.vue'
import { buildAnswers, buildPaper, PAGE_H, PAGE_W } from './paper/paginate'
import { paperQuestions, params } from './store'

/** ?lab=1 进入版式试验卷（独立于主卷，不动参数面板与主样张） */
const isLab = new URLSearchParams(window.location.search).has('lab')

const paper = computed(() => buildPaper(paperQuestions.value, params.pages))
const answers = computed(() => (params.withAnswers ? buildAnswers(paperQuestions.value) : []))
const totalPages = computed(() => paper.value.pages.length + answers.value.length)

/** 屏幕预览缩放：按主区可用宽度等比缩小 A4 纸 */
const zoomVal = ref(1)
const scrollerEl = ref<HTMLElement | null>(null)
let ro: ResizeObserver | null = null
onMounted(() => {
  const el = scrollerEl.value
  if (!el) return
  const update = () => {
    const avail = el.clientWidth - 64
    zoomVal.value = Math.min(1, avail / PAGE_W)
  }
  update()
  ro = new ResizeObserver(update)
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

const sheetStyle = computed(() => ({
  transform: `scale(${zoomVal.value})`,
  transformOrigin: 'top center',
  width: `${PAGE_W}px`,
  height: `${PAGE_H}px`,
  marginBottom: `${-(PAGE_H * (1 - zoomVal.value)) + 28}px`,
}))
</script>

<template>
  <LabPaper v-if="isLab" />
  <div v-else class="app">
    <TopBar />
    <div class="body">
      <aside class="side">
        <ParamPanel />
      </aside>
      <main class="main" ref="scrollerEl">
        <div class="pages">
          <div
            v-for="(p, i) in paper.pages"
            :key="'p' + i"
            class="sheet-outer"
            :style="sheetStyle"
          >
            <PaperPage
              kind="paper"
              :title="params.title"
              :page="p"
              :page-no="i + 1"
              :total-pages="totalPages"
              :scale="paper.scale"
            />
          </div>
          <div
            v-for="(p, i) in answers"
            :key="'a' + i"
            class="sheet-outer"
            :style="sheetStyle"
          >
            <PaperPage
              kind="answer"
              :title="params.title"
              :page="p"
              :page-no="paper.pages.length + i + 1"
              :total-pages="totalPages"
              :scale="1"
            />
          </div>
          <div v-if="paperQuestions.length === 0" class="empty">
            当前条件下没有题目。请至少选择一个单元和一种题型。
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ececec;
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.side {
  flex: none;
  width: 272px;
  background: #fafafa;
  border-right: 1px solid #dcdcdc;
  overflow-y: auto;
}
.main {
  flex: 1;
  overflow-y: auto;
  padding: 28px 0 40px;
}
.pages {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sheet-outer {
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
  background: #fff;
}
.empty {
  margin-top: 80px;
  color: #666;
  font-size: 15px;
}
</style>
