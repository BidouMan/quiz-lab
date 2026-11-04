<script setup lang="ts">
import { save } from '@tauri-apps/plugin-dialog'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { MemoryStore } from '../quiz/memory.ts'
import { findUnit } from '../data/curriculum.ts'
import {
  checkTypst,
  errorText,
  generatePaper,
  getTemplateInfo,
  loadConfig,
  openPdf,
  saveConfig,
  savePdfAs,
} from './api'
import ParamsPanel from './ParamsPanel.vue'
import PdfPreview from './PdfPreview.vue'
import { buildPaper, defaultUnitIds, panelUnits } from './paperBuilder'
import { TYPE_OPTIONS } from './typstData'
import {
  DEFAULT_CONFIG,
  type AppConfig,
  type AppType,
  type BuildResult,
  type GenerateResult,
  type TemplateInfo,
  type TypstInfo,
} from './types'

const MEMORY_KEY = 'quizlab:quiz-memory.v1'

function loadMemory(): MemoryStore {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    if (raw) return MemoryStore.fromJSON(raw)
  } catch {
    // 记忆文件损坏时从空记忆开始
  }
  return new MemoryStore()
}

function persistMemory(store: MemoryStore) {
  try {
    localStorage.setItem(MEMORY_KEY, store.toJSON())
  } catch {
    // localStorage 不可用时仅本进程生效
  }
}

const config = reactive<AppConfig>({
  ...DEFAULT_CONFIG,
  unitIds: defaultUnitIds(DEFAULT_CONFIG.grade),
  types: [...DEFAULT_CONFIG.types],
})

const memory = loadMemory()
const lastBuild = ref<BuildResult | null>(null)
const template = ref<TemplateInfo | null>(null)
const typst = ref<TypstInfo | null>(null)
const typstError = ref('')
const checking = ref(false)

const ready = ref(false)
const busy = ref(false)
const result = ref<GenerateResult | null>(null)
const pdfData = ref<Uint8Array | null>(null)
const actualPages = ref(0)
const errorMessage = ref('')
const notice = ref('')
const showLayoutDetail = ref(false)

let seed = 0
let saveTimer: number | undefined

const typeLabels = new Map<AppType, string>(TYPE_OPTIONS.map((item) => [item.type, item.label]))

const statusText = computed(() => {
  if (busy.value) return '正在生成…'
  if (!result.value) return '尚未生成试卷'
  const kb = (result.value.bytes / 1024).toFixed(1)
  const pages = actualPages.value > 0 ? ` · ${actualPages.value} 页` : ''
  const check = ` · 版面校验 ${result.value.layout.elapsedMs} ms`
  return `编译 ${result.value.elapsedMs} ms${check} · ${kb} KB${pages}`
})

/** typst warning 原文（字体回退也在这里） */
const warnings = computed(() => result.value?.warnings ?? [])

const layoutFailed = computed(
  () => result.value !== null && !result.value.layout.skipped && !result.value.layout.ok,
)

const layoutSkippedNote = computed(() => {
  if (!result.value || !result.value.layout.skipped) return ''
  return `版面校验已跳过：${result.value.layout.output.split('\n')[0]}`
})

const paperSummary = computed(() => {
  const build = lastBuild.value
  if (!build || !result.value) return ''
  const s = build.stats
  const kps = s.kpNames.length > 0 ? s.kpNames.join('、') : '无'
  const calc = Math.max(0, s.generated - s.skeleton - s.legacy)
  const parts = [`本次 ${build.count} 题`]
  if (s.skeleton > 0) parts.push(`骨架 ${s.skeleton}${s.reused > 0 ? `（复用 ${s.reused}）` : ''}`)
  if (s.legacy > 0) parts.push(`旧生成器 ${s.legacy}`)
  if (calc > 0) parts.push(`计算生成 ${calc}`)
  if (s.fallback > 0) parts.push(`静态兜底 ${s.fallback}`)
  const check = s.runtimeCheck
  parts.push(`复核 ${check.checked} 题（失败 ${check.failed} / 剔除 ${check.dropped}）`)
  if (check.regenerated > 0) parts.push(`重生成后通过 ${check.regenerated}`)
  parts.push(`去重命中 ${s.duplicates}`, `知识点：${kps}`)
  return parts.join(' · ')
})

const pageCompare = computed(() => {
  if (!result.value || actualPages.value === 0) return ''
  return actualPages.value === config.pages
    ? `目标 ${config.pages} 页，已达成`
    : `目标 ${config.pages} 页，实际 ${actualPages.value} 页`
})

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isAppType(value: unknown): value is AppType {
  return typeof value === 'string' && typeLabels.has(value as AppType)
}

async function refreshTemplate() {
  try {
    template.value = await getTemplateInfo()
  } catch {
    template.value = null
  }
}

async function runCheckTypst() {
  checking.value = true
  typstError.value = ''
  try {
    typst.value = await checkTypst(config.typstPath)
  } catch (reason) {
    typst.value = null
    typstError.value = errorText(reason)
  } finally {
    checking.value = false
  }
}

async function generate() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  notice.value = ''
  showLayoutDetail.value = false

  try {
    await refreshTemplate()

    seed++
    const built = buildPaper({
      config,
      template: template.value,
      seed,
      memory,
    })
    lastBuild.value = built

    if (built.count === 0) {
      const reasons = built.notes.length > 0 ? `：${built.notes.join('；')}` : '，请选择单元与题型。'
      errorMessage.value = `当前条件下没有可生成的题目${reasons}`
      return
    }

    const notes = [...built.notes]
    if (built.shortage) {
      notes.push(`未达目标题量：实际 ${built.count} 题 / 目标 ${built.stats.requested} 题（已尽量补足）`)
    }
    notice.value = notes.join('；')
    persistMemory(memory)

    const generated = await generatePaper(built.data, config.typstPath)
    result.value = generated
    actualPages.value = 0
    pdfData.value = base64ToBytes(generated.pdfBase64)
    typst.value = { path: generated.typstPath, version: generated.typstVersion }
    typstError.value = ''
  } catch (reason) {
    errorMessage.value = errorText(reason)
  } finally {
    busy.value = false
  }
}

async function saveAs() {
  if (!result.value) return
  try {
    const dest = await save({
      title: '另存为 PDF',
      defaultPath: '数学每日一练.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!dest) return
    const saved = await savePdfAs(result.value.outputPath, dest)
    notice.value = `已保存：${saved}`
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
}

async function printPdf() {
  if (!result.value) return
  try {
    await openPdf(result.value.outputPath)
    notice.value = '已用系统「预览」打开，可在预览中按 ⌘P 打印。'
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
}

function onPreviewLoaded(pages: number) {
  actualPages.value = pages
}

function scheduleSave() {
  if (!ready.value) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveConfig({ ...config, types: [...config.types] }).catch((reason) => {
      errorMessage.value = errorText(reason)
    })
  }, 400)
}

watch(config, scheduleSave, { deep: true })

onMounted(async () => {
  try {
    const stored = await loadConfig()
    // 范围锁定三上：旧配置里的三下年级/单元一律钳回三上 8 个包单元
    const grade: AppConfig['grade'] = '3A'
    const allowedUnits = new Set(panelUnits().map((unit) => unit.unitId))
    const types = Array.isArray(stored.types) ? stored.types.filter(isAppType) : []
    const storedUnits = Array.isArray(stored.unitIds)
      ? stored.unitIds.filter(
          (id): id is string => typeof id === 'string' && allowedUnits.has(id) && findUnit(id)?.grade === grade,
        )
      : null
    const level: AppConfig['level'] =
      stored.level === 'L1' || stored.level === 'L3' ? stored.level : 'L2'
    Object.assign(config, {
      grade,
      level,
      unitIds: storedUnits && storedUnits.length > 0 ? storedUnits : defaultUnitIds(grade),
      types: types.length > 0 ? types : [...DEFAULT_CONFIG.types],
      count: typeof stored.count === 'number' ? stored.count : DEFAULT_CONFIG.count,
      pages: typeof stored.pages === 'number' ? stored.pages : DEFAULT_CONFIG.pages,
      typstPath: typeof stored.typstPath === 'string' ? stored.typstPath : '',
    })
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
  ready.value = true

  await refreshTemplate()
  await runCheckTypst()

  // 开发/自检用：app.html?autogen=1 启动后自动生成一份
  if (new URLSearchParams(window.location.search).has('autogen')) {
    await generate()
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  if (ready.value) {
    void saveConfig({ ...config, types: [...config.types] })
  }
})
</script>

<template>
  <div class="app">
    <aside class="side">
      <div class="brand">
        <h1>QuizLab</h1>
        <p>数学每日一练</p>
      </div>
      <ParamsPanel
        :config="config"
        :template="template"
        :typst="typst"
        :typst-error="typstError"
        :checking="checking"
        @check-typst="runCheckTypst"
      />
    </aside>

    <main class="main">
      <div class="toolbar">
        <button class="primary" :disabled="busy" @click="generate">
          {{ busy ? '生成中…' : '生成试卷' }}
        </button>
        <div class="status">
          <span>{{ statusText }}</span>
          <span v-if="pageCompare" class="sub">{{ pageCompare }}</span>
        </div>
        <span class="spacer"></span>
        <button class="secondary" :disabled="!result || busy" @click="printPdf">打印</button>
        <button class="secondary" :disabled="!result || busy" @click="saveAs">另存为</button>
      </div>

      <div v-if="notice" class="notice">{{ notice }}</div>
      <div v-if="paperSummary" class="summary">{{ paperSummary }}</div>
      <div v-if="layoutSkippedNote" class="notice">{{ layoutSkippedNote }}</div>

      <div v-if="warnings.length > 0" class="banner warn">
        <div class="banner-head">
          {{ result?.fontFallback ? '字体回退警告' : '排版警告' }}（{{ warnings.length }} 条）
        </div>
        <ul class="warning-list">
          <li v-for="(item, index) in warnings" :key="index">{{ item }}</li>
        </ul>
      </div>

      <div v-if="layoutFailed" class="banner fail">
        <div class="banner-head">
          <span>版面校验未通过，请勿直接打印</span>
          <button class="link" @click="showLayoutDetail = !showLayoutDetail">
            {{ showLayoutDetail ? '收起详情' : '查看校验输出' }}
          </button>
        </div>
        <pre v-if="showLayoutDetail">{{ result?.layout.output }}</pre>
      </div>

      <div v-if="errorMessage" class="error">
        <div class="error-head">
          <span>出卷失败</span>
          <button class="link" @click="errorMessage = ''">关闭</button>
        </div>
        <pre>{{ errorMessage }}</pre>
      </div>

      <PdfPreview :data="pdfData" @loaded="onPreviewLoaded" />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  background: #ececec;
}
.side {
  flex: none;
  width: 292px;
  background: #fafafa;
  border-right: 1px solid #d8d8d8;
  overflow-y: auto;
}
.brand {
  padding: 16px 16px 12px;
  border-bottom: 1px solid #e2e2e2;
}
.brand h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.brand p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #888;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #000;
}
.primary {
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 20px;
  border: 1px solid #000;
  border-radius: 4px;
  background: #000;
  color: #fff;
  cursor: pointer;
}
.primary:hover:not(:disabled) {
  background: #222;
}
.primary:disabled {
  background: #777;
  border-color: #777;
  cursor: default;
}
.secondary {
  font: inherit;
  font-size: 13px;
  padding: 7px 16px;
  border: 1px solid #999;
  border-radius: 4px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.secondary:hover:not(:disabled) {
  background: #f0f0f0;
}
.secondary:disabled {
  color: #aaa;
  border-color: #ddd;
  cursor: default;
}
.status {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #444;
  font-variant-numeric: tabular-nums;
}
.status .sub {
  font-size: 11px;
  color: #888;
}
.spacer {
  flex: 1;
}
.notice {
  flex: none;
  padding: 7px 16px;
  font-size: 12px;
  color: #444;
  background: #f6f6f6;
  border-bottom: 1px solid #e0e0e0;
}
.summary {
  flex: none;
  padding: 7px 16px;
  font-size: 12px;
  color: #222;
  background: #fff;
  border-bottom: 1px solid #d8d8d8;
}
.error,
.banner {
  flex: none;
  max-height: 220px;
  overflow: auto;
  padding: 10px 16px 12px;
  background: #f7f7f7;
  border-bottom: 1px solid #d5d5d5;
  border-left: 3px solid #222;
}
.banner.fail {
  border-left-width: 5px;
}
.error-head,
.banner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #111;
}
.warning-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
.link {
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  border: none;
  background: none;
  color: #777;
  cursor: pointer;
  padding: 0;
}
.link:hover {
  color: #000;
}
.error pre,
.banner pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
