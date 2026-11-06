<script setup lang="ts">
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ data: Uint8Array | null }>()
const emit = defineEmits<{ loaded: [pages: number] }>()

const stageEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const doc = shallowRef<pdfjs.PDFDocumentProxy | null>(null)
const pageNo = ref(1)
const totalPages = ref(0)
const userZoom = ref(1)
const fitScale = ref(1)
const loading = ref(false)
const error = ref('')

let resizeObserver: ResizeObserver | null = null
let renderTask: pdfjs.RenderTask | null = null
let renderSeq = 0

const hasDoc = computed(() => doc.value !== null && totalPages.value > 0)
const zoomLabel = computed(() => `${Math.round(userZoom.value * 100)}%`)

function cancelRender() {
  if (renderTask) {
    try {
      renderTask.cancel()
    } catch {
      // 取消时的拒绝由 renderPage 的 catch 处理
    }
    renderTask = null
  }
}

function updateFitScale() {
  const stage = stageEl.value
  if (!stage) return
  // A4 宽 210mm ≈ 595pt；预留左右各 28px 的滚动留白
  const available = Math.max(320, stage.clientWidth - 56)
  fitScale.value = Math.max(0.4, Math.min(2.5, available / 595))
}

async function renderPage() {
  const document = doc.value
  const canvas = canvasEl.value
  if (!document || !canvas) return

  const seq = ++renderSeq
  cancelRender()

  try {
    const page = await document.getPage(pageNo.value)
    if (seq !== renderSeq) return

    const scale = fitScale.value * userZoom.value
    const viewport = page.getViewport({ scale })
    const ratio = window.devicePixelRatio || 1

    canvas.width = Math.floor(viewport.width * ratio)
    canvas.height = Math.floor(viewport.height * ratio)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`

    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布上下文')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const task = page.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
    renderTask = task
    await task.promise
    if (seq === renderSeq) renderTask = null
  } catch (reason) {
    if (seq === renderSeq && !(reason instanceof pdfjs.RenderingCancelledException)) {
      error.value = reason instanceof Error ? reason.message : String(reason)
    }
  }
}

async function loadPdf() {
  cancelRender()
  renderSeq++
  await doc.value?.destroy()
  doc.value = null
  totalPages.value = 0
  pageNo.value = 1
  error.value = ''

  if (!props.data) return

  loading.value = true
  try {
    const document = await pdfjs.getDocument({ data: props.data }).promise
    doc.value = document
    totalPages.value = document.numPages
    updateFitScale()
    await renderPage()
    emit('loaded', document.numPages)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

async function goToPage(next: number) {
  if (!doc.value) return
  const clamped = Math.min(Math.max(1, next), totalPages.value)
  if (clamped === pageNo.value) return
  pageNo.value = clamped
  stageEl.value?.scrollTo({ top: 0, left: 0 })
  await renderPage()
}

async function changeZoom(delta: number) {
  const next = Math.min(2.5, Math.max(0.5, Math.round((userZoom.value + delta) * 100) / 100))
  if (next === userZoom.value) return
  userZoom.value = next
  await renderPage()
}

async function fitWidth() {
  userZoom.value = 1
  updateFitScale()
  await renderPage()
}

watch(
  () => props.data,
  () => {
    void loadPdf()
  },
  { immediate: true },
)

watch(
  () => stageEl.value,
  (stage) => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (!stage) return
    resizeObserver = new ResizeObserver(() => {
      const before = fitScale.value
      updateFitScale()
      if (before !== fitScale.value && userZoom.value === 1) {
        void renderPage()
      }
    })
    resizeObserver.observe(stage)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelRender()
  void doc.value?.destroy()
})
</script>

<template>
  <div class="preview">
    <div ref="stageEl" class="stage">
      <div v-if="data && !error" class="sheet">
        <canvas ref="canvasEl"></canvas>
      </div>
      <div v-if="!data" class="empty">尚未生成试卷</div>
      <div v-if="loading" class="float">正在加载 PDF…</div>
      <div v-if="error" class="error">
        <p class="error-title">预览失败</p>
        <pre>{{ error }}</pre>
      </div>
    </div>

    <div class="bar">
      <button class="tool" :disabled="!hasDoc || pageNo <= 1" @click="goToPage(pageNo - 1)">
        上一页
      </button>
      <span class="pages">第 {{ hasDoc ? pageNo : 0 }} / {{ totalPages }} 页</span>
      <button
        class="tool"
        :disabled="!hasDoc || pageNo >= totalPages"
        @click="goToPage(pageNo + 1)"
      >
        下一页
      </button>
      <span class="spacer"></span>
      <button class="tool" :disabled="!hasDoc || userZoom <= 0.5" @click="changeZoom(-0.1)">
        缩小
      </button>
      <span class="zoom">{{ zoomLabel }}</span>
      <button class="tool" :disabled="!hasDoc || userZoom >= 2.5" @click="changeZoom(0.1)">
        放大
      </button>
      <button class="tool" :disabled="!hasDoc || userZoom === 1" @click="fitWidth">
        适应宽度
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  background: #fafafa;
  border-top: 1px solid #dcdcdc;
  font-size: 12px;
  color: #333;
}
.tool {
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  border: 1px solid #bbb;
  border-radius: 4px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.tool:hover:not(:disabled) {
  background: #f0f0f0;
}
.tool:disabled {
  color: #aaa;
  border-color: #ddd;
  background: #fff;
  cursor: default;
}
.pages,
.zoom {
  min-width: 54px;
  text-align: center;
  color: #555;
  font-variant-numeric: tabular-nums;
}
.spacer {
  flex: 1;
}
.stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #ececec;
  padding: 28px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.sheet {
  flex: none;
  background: #fff;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
  line-height: 0;
}
.sheet canvas {
  display: block;
}
.empty {
  margin-top: 80px;
  font-size: 14px;
  color: #888;
}
.float {
  position: absolute;
  margin-top: 40px;
  font-size: 13px;
  color: #555;
  background: #fff;
  border: 1px solid #ddd;
  padding: 6px 12px;
}
.error {
  margin-top: 40px;
  max-width: 760px;
  background: #fff;
  border: 1px solid #ccc;
  border-left: 3px solid #333;
  padding: 14px 18px;
}
.error-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
}
.error pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
}
</style>
