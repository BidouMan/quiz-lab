<script setup lang="ts">
import { open, save } from '@tauri-apps/plugin-dialog'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { corruptTimestamp, memoryRecoveryNotice, MemoryStore, parseMemoryJson } from '../quiz/memory.ts'
import { findUnit } from '../data/curriculum.ts'
import {
  checkTypst,
  errorText,
  exportConfig,
  generatePaper,
  getTemplateInfo,
  importConfig,
  loadConfig,
  openPdf,
  saveConfig,
  savePdfAs,
} from './api'
import ParamsPanel from './ParamsPanel.vue'
import ChinesePanel from './ChinesePanel.vue'
import PdfPreview from './PdfPreview.vue'
import { buildPaper, defaultUnitIds, migrateCounts, migrateLegacyCounts, panelUnits, typeVisibleInGrade } from './paperBuilder'
import { buildChinesePaperDoc, buildReadingPaperConfig, buildSyncPaperConfig, type ChineseSyncSelection, type ReadingPaperSelection } from '../chinese/doc.ts'
import type { ChinesePaperMemory, ReadingPaperItem } from '../chinese/types.ts'
import {
  LEVEL_LABELS,
  PRESETS,
  estimateMinutes,
  matchesPreset,
  presetTotal,
  type PaperLevel,
  type Preset,
} from './presets'
import { TYPE_OPTIONS, TYPE_ORDER } from './typstData'
import { SUBJECTS, type SubjectId } from './subjects'
import {
  clampTypeCount,
  DEFAULT_CONFIG,
  PRACTICE_DEFAULT_COUNTS,
  type AppConfig,
  type AppType,
  type BuildResult,
  type GenerateResult,
  type TemplateInfo,
  type TypstInfo,
} from './types'
import { readableNotes, shortageNote } from './wording'

const MEMORY_KEY = 'quizlab:quiz-memory.v1'
const CHINESE_MEMORY_KEY = 'quizlab:chinese-memory.v1'
const HISTORY_KEY = 'quizlab:history.v1'
const APP_VERSION = '0.7.0-beta.2'

/** 开发者工具只在开发构建里出现；正式打包时入口与面板都不会被加载 */
const isDevBuild = import.meta.env.DEV
const DevTools = isDevBuild ? defineAsyncComponent(() => import('./DevToolsEntry.vue')) : null

/** 读一份出题记忆；结构与损坏恢复规则两边共用，只是存储键不同 */
function loadMemoryStore(key: string): { store: MemoryStore; notice: string } {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return { store: new MemoryStore(), notice: '' }
  }
  if (!raw) return { store: new MemoryStore(), notice: '' }

  const parsed = parseMemoryJson(raw)
  if (parsed.status === 'ok') return { store: parsed.store, notice: '' }

  // 损坏：先把原文另存一份备份，再重建可用状态，绝不静默清空
  const backupKey = `${key}.corrupt-${corruptTimestamp()}`
  try {
    localStorage.setItem(backupKey, raw)
  } catch {
    // 备份写不进去（配额不足）也不阻断出卷
  }
  const store = new MemoryStore()
  try {
    localStorage.setItem(key, store.toJSON())
  } catch {
    // localStorage 不可用时仅本进程生效
  }
  return { store, notice: memoryRecoveryNotice(backupKey.replace(`${key}.`, '')) }
}

function persistMemoryStore(key: string, store: MemoryStore) {
  try {
    localStorage.setItem(key, store.toJSON())
  } catch {
    // localStorage 不可用时仅本进程生效
  }
}

function loadMemory(): { store: MemoryStore; notice: string } {
  return loadMemoryStore(MEMORY_KEY)
}

function persistMemory(store: MemoryStore) {
  persistMemoryStore(MEMORY_KEY, store)
}

const DAILY = PRESETS[0]

/** 首次进入 / 恢复默认时的配置：全部单元 · 标准难度 · 每日一练 */
function initialConfig(): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    unitIds: panelUnits().map((unit) => unit.unitId),
    level: DAILY.level,
    types: Object.keys(DAILY.values) as AppType[],
    counts: { ...DAILY.values },
    count: presetTotal(DAILY),
  }
}

const config = reactive<AppConfig>(initialConfig())

const loadedMemory = loadMemory()
let memory = loadedMemory.store
const loadedChineseMemory = loadMemoryStore(CHINESE_MEMORY_KEY)
let chineseMemory = loadedChineseMemory.store
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
const memoryNotice = ref(
  [loadedMemory.notice, loadedChineseMemory.notice].filter(Boolean).join('；'),
)
/** 设置备份 / 导入导出的提示；与出卷提示分开，避免被下一次生成清掉 */
const configNotice = ref('')
const showLayoutDetail = ref(false)

/** 是否恢复过上次配置（决定首屏副文案前缀） */
const restored = ref(false)
const settingsOpen = ref(false)
const detailOpen = ref(false)
const historyOpen = ref(false)

/** 科目切换只在本次运行内保留；数学配置与已生成的卷子都留在原位，不受切换影响 */
const subject = ref<SubjectId>('math')
const chineseNotice = ref('')
const chineseError = ref('')
const chineseBusy = ref(false)
const chineseResult = ref<GenerateResult | null>(null)
const chinesePdfData = ref<Uint8Array | null>(null)
const chinesePages = ref(0)
const chineseMode = ref<'reading' | 'sync' | 'full'>('sync')
const chineseFigures = ref({ pieces: 0, questions: 0, score: 0 })
const subjectMeta = computed(() => SUBJECTS.find((item) => item.id === subject.value) ?? SUBJECTS[0])

function switchSubject(id: SubjectId) {
  if (id === subject.value) return
  subject.value = id
  if (id === 'chinese') chineseError.value = ''
}

/** 语文出卷：面板只给筛选条件，配置与模板数据都在 src/chinese/doc.ts 里装配 */
async function onChineseGenerate(
  payload:
    | { mode: 'reading'; selection: ReadingPaperSelection }
    | { mode: 'sync'; selection: ChineseSyncSelection }
    | { mode: 'full'; selection: ChineseSyncSelection },
) {
  if (chineseBusy.value) return
  chineseBusy.value = true
  chineseError.value = ''
  chineseNotice.value = ''
  try {
    seed += 1
    const isReading = payload.mode === 'reading'
    const isFull = payload.mode === 'full'
    chineseMode.value = payload.mode
    // 出卷前先领本卷号：排题按「没出过的题优先」走，卷子生成成功后再写回记忆
    const chineseMemoryInput: ChinesePaperMemory = {
      paper: chineseMemory.beginPaper(),
      entries: chineseMemory.data.entries,
    }
    const paperConfig = isReading
      ? buildReadingPaperConfig(payload.selection as ReadingPaperSelection, seed, chineseMemoryInput)
      : buildSyncPaperConfig(payload.selection as ChineseSyncSelection, seed, chineseMemoryInput)
    const { doc, paper } = buildChinesePaperDoc(paperConfig)

    let pieces = paper.items.length
    let questions = 0
    if (isReading) {
      const readings = paper.items.filter(
        (item): item is ReadingPaperItem => item.typeId === 'reading',
      )
      if (readings.length === 0) {
        chineseError.value = '当前筛选下没有可用篇目，请放宽考点、主题或难度。'
        return
      }
      pieces = readings.length
      questions = readings.reduce((sum, item) => sum + item.questions.length, 0)
    } else if (paper.items.length === 0) {
      chineseError.value = '当前单元与题型下没有可用题目，请增加题型或放宽单元。'
      return
    }

    chineseFigures.value = {
      pieces,
      questions,
      score: paper.score.total,
    }
    const notes = [...paper.gaps.map((gap) => gap.message), ...paper.notes]
    const generated = await generatePaper(
      doc,
      config.typstPath,
      'typst/chinese-paper-3a.typ',
      joinPath(
        saveRoot(),
        isReading
          ? `三年级语文-课外阅读-${stamp()}.pdf`
          : isFull
            ? `三年级语文-综合练习-${stamp()}.pdf`
            : `三年级语文-同步练习-${stamp()}.pdf`,
      ),
    )
    chineseResult.value = generated
    chinesePdfData.value = base64ToBytes(generated.pdfBase64)
    chinesePages.value = 0
    // 卷子确实生成了才记账：下次出卷优先排剩下的新题
    for (const key of paper.usedKeys) chineseMemory.record(key)
    persistMemoryStore(CHINESE_MEMORY_KEY, chineseMemory)
    chineseNotice.value = [...notes, ...generated.warnings].filter(Boolean).join('；')
    addHistory({
      title: isReading
        ? `语文 · 课外阅读（${pieces} 篇）`
        : isFull
          ? `语文 · 综合练习（${pieces} 题）`
          : `语文 · 同步练习（${pieces} 题）`,
      at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      count: isReading ? questions : pieces,
      pages: 0,
      path: generated.savedPath ?? generated.outputPath,
      subject: 'chinese',
    })
  } catch (reason) {
    chineseError.value = errorText(reason)
  } finally {
    chineseBusy.value = false
  }
}

interface HistoryItem {
  title: string
  at: string
  count: number
  pages: number
  path: string
  subject: SubjectId
}

/** 旧记录没有 subject 字段：按文件名兜底，语文卷都是「语文-」开头 */
function normalizeHistoryItem(value: unknown): HistoryItem | null {
  if (value == null || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (
    typeof item.title !== 'string' ||
    typeof item.at !== 'string' ||
    typeof item.count !== 'number' ||
    typeof item.pages !== 'number' ||
    typeof item.path !== 'string' ||
    item.path === ''
  ) {
    return null
  }
  const subject: SubjectId =
    item.subject === 'math' || item.subject === 'chinese'
      ? item.subject
      : item.path.includes('语文-')
        ? 'chinese'
        : 'math'
  return {
    title: item.title,
    at: item.at,
    count: item.count,
    pages: item.pages,
    path: item.path,
    subject,
  }
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeHistoryItem)
      .filter((item): item is HistoryItem => item !== null)
  } catch {
    return []
  }
}

function persistHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch {
    // localStorage 不可用时仅本进程生效
  }
}

const history = ref<HistoryItem[]>(loadHistory())

/** 按设置裁剪历史卷；0 表示不限 */
function trimHistory(): void {
  if (config.historyLimit > 0) history.value = history.value.slice(0, config.historyLimit)
}

function addHistory(item: HistoryItem): void {
  history.value.unshift(item)
  trimHistory()
}

/** 历史卷当前显示的科目；打开抽屉时默认跟随当前页面科目 */
const historyFilter = ref<SubjectId>('math')
const filteredHistory = computed(() =>
  history.value.filter((item) => item.subject === historyFilter.value),
)

function openHistory(): void {
  historyFilter.value = subject.value
  historyOpen.value = true
  settingsOpen.value = false
}

watch(history, persistHistory, { deep: true })
watch(() => config.historyLimit, trimHistory)

let seed = 0
let saveTimer: number | undefined

const typeLabels = new Map<AppType, string>(TYPE_OPTIONS.map((item) => [item.type, item.label]))

const units = panelUnits()
const allUnitsSelected = computed(() =>
  units.length > 0 && units.every((unit) => config.unitIds.includes(unit.unitId)),
)
const unitText = computed(() => (allUnitsSelected.value ? '全部单元' : `${config.unitIds.length} 个单元`))
const levelLabel = computed(() => LEVEL_LABELS[config.level as PaperLevel])

const total = computed(() =>
  TYPE_ORDER.reduce((sum, type) => sum + (config.counts?.[type] ?? 0), 0),
)

const activePreset = computed(() =>
  matchesPreset(config.level as PaperLevel, config.types, config.counts ?? {}),
)

const emptySubtitle = computed(() => {
  if (activePreset.value) {
    const prefix = restored.value ? '当前配置' : '默认配置'
    return `${prefix}：${unitText.value} · ${levelLabel.value}难度 · ${activePreset.value.name}。可直接生成，也可先调整。`
  }
  return `当前配置：${unitText.value} · ${levelLabel.value}难度 · 自定义 ${total.value} 题。可直接生成，也可先调整。`
})

const actualCounts = computed<Partial<Record<AppType, number>>>(() => {
  const stats = lastBuild.value?.stats.typeStats ?? []
  return Object.fromEntries(stats.map((row) => [row.type, row.actual]))
})

const displayPages = computed(() => {
  if (actualPages.value > 0) return actualPages.value
  return lastBuild.value?.pageEstimate ?? Math.max(1, Math.round(total.value / 12))
})

/** 保存目录：留空时落到系统下载文件夹 */
function saveRoot(): string {
  return config.saveDir.trim() || '~/Downloads'
}

function joinPath(dir: string, name: string): string {
  return /[\\/]$/.test(dir) ? `${dir}${name}` : `${dir}/${name}`
}

/** 文件名时间戳：20261109-205133 */
function stamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function pathParts(path?: string | null): string[] {
  return (path ?? '').split(/[\\/]/).filter((part) => part !== '')
}

function folderOf(path?: string | null): string {
  const parts = pathParts(path)
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

function fileOf(path?: string | null): string {
  const parts = pathParts(path)
  return parts.length >= 1 ? parts[parts.length - 1] : ''
}

const folderName = computed(() => folderOf(result.value?.savedPath ?? result.value?.outputPath))
const fileName = computed(() => fileOf(result.value?.savedPath ?? result.value?.outputPath))
const chineseFolder = computed(() =>
  folderOf(chineseResult.value?.savedPath ?? chineseResult.value?.outputPath),
)
const chineseFile = computed(() =>
  fileOf(chineseResult.value?.savedPath ?? chineseResult.value?.outputPath),
)

const combinedNotice = computed(() =>
  [memoryNotice.value, configNotice.value, notice.value, layoutSkippedNote.value]
    .filter((item) => item !== '')
    .join(' · '),
)

const typstStatus = computed(() => {
  if (checking.value) return '正在检查…'
  if (typst.value) return '已就绪'
  return typstError.value ? '未找到' : '未检查'
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

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isAppType(value: unknown): value is AppType {
  return typeof value === 'string' && typeLabels.has(value as AppType)
}

function typeName(type: AppType): string {
  return typeLabels.get(type) ?? type
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

function applyPreset(preset: Preset) {
  config.level = preset.level
  config.types = Object.keys(preset.values) as AppType[]
  config.counts = { ...preset.values }
  config.count = presetTotal(preset)
  restored.value = true
  actualPages.value = 0
}

function markTouched() {
  restored.value = true
  // 配置一变，上一份卷子的实际页数就不再代表当前配置；摘要改用估算页数
  actualPages.value = 0
}

async function quickGenerate(preset: Preset) {
  applyPreset(preset)
  await generate()
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
      mode: 'practice',
    })
    lastBuild.value = built

    if (built.count === 0) {
      const reasons = built.notes.length > 0 ? `：${readableNotes(built.notes).join('；')}` : '，请选择单元与题型。'
      errorMessage.value = `当前条件下没有可生成的题目${reasons}`
      return
    }

    const notes = [...built.notes]
    if (built.shortage) {
      notes.push(shortageNote(built.count, built.stats.requested))
    }
    notice.value = readableNotes(notes).join('；')
    persistMemory(memory)

    const paperName = `三年级数学-${activePreset.value?.name ?? '自选题量'}-${stamp()}.pdf`
    const generated = await generatePaper(
      built.data,
      config.typstPath,
      undefined,
      joinPath(saveRoot(), paperName),
    )
    result.value = generated
    actualPages.value = 0
    pdfData.value = base64ToBytes(generated.pdfBase64)
    typst.value = { path: generated.typstPath, version: generated.typstVersion }
    typstError.value = ''
    addHistory({
      title: `${unitText.value} · ${activePreset.value?.name ?? '自选题量'}`,
      at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      count: built.count,
      pages: built.pageEstimate ?? 0,
      path: generated.savedPath ?? generated.outputPath,
      subject: 'math',
    })
  } catch (reason) {
    errorMessage.value = errorText(reason)
  } finally {
    busy.value = false
  }
}

async function saveAs(target: GenerateResult | null = result.value, fileName = '数学每日一练.pdf') {
  if (!target) return
  try {
    const dest = await save({
      title: '保存 PDF',
      defaultPath: config.saveDir.trim() ? joinPath(saveRoot(), fileName) : fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!dest) return
    const saved = await savePdfAs(target.outputPath, dest)
    notice.value = `已保存：${saved}`
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
}

async function openPdfNow(path = result.value?.outputPath) {
  if (!path) return
  try {
    await openPdf(path)
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
}

async function printPdf(target: GenerateResult | null = result.value) {
  if (!target) return
  try {
    await openPdf(target.outputPath)
    notice.value = '已用系统「预览」打开，可在预览中按 ⌘P 打印。'
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
}

function onPreviewLoaded(pages: number) {
  actualPages.value = pages
}

function normalizedConfig(): AppConfig {
  return {
    ...config,
    types: config.types.filter((type) => typeVisibleInGrade(config.grade, type)),
    counts: Object.fromEntries(
      Object.entries(config.counts ?? {})
        .filter(([type]) => typeVisibleInGrade(config.grade, type as AppType))
        .map(([type, value]) => [type, clampTypeCount(value)]),
    ),
  }
}

/** 把读到的设置归一化后套用到当前配置；返回需要提示的迁移说明 */
function applyStoredConfig(stored: Partial<AppConfig>): string {
  // 首次启动 / 空设置文件：保持“全部单元 · 标准难度 · 每日一练”
  if (Object.keys(stored).length === 0) return ''

  // 范围锁定三上：旧配置里的三下年级/单元一律钳回三上 8 个包单元
  const grade: AppConfig['grade'] = '3A'
  const allowedUnits = new Set(panelUnits().map((unit) => unit.unitId))
  // 旧配置里的 angle 题型已并入填空，选择它时迁移为 tiankong
  const rawTypes: unknown[] = Array.isArray(stored.types) ? stored.types : []
  const migratedTypes = rawTypes.flatMap((type) => (type === 'angle' ? ['tiankong'] : [type]))
  const types: AppType[] = Array.from(
    new Set(migratedTypes.filter(isAppType).filter((type) => typeVisibleInGrade(grade, type))),
  )
  const storedUnits = Array.isArray(stored.unitIds)
    ? stored.unitIds.filter(
        (id): id is string => typeof id === 'string' && allowedUnits.has(id) && findUnit(id)?.grade === grade,
      )
    : null
  const level: AppConfig['level'] = stored.level === 'L1' || stored.level === 'L3' ? stored.level : 'L2'
  const storedCounts =
    stored.counts != null && typeof stored.counts === 'object' ? (stored.counts as Record<string, unknown>) : null
  const migrated = migrateLegacyCounts(storedCounts)
  const counts: AppConfig['counts'] =
    migrated != null
      ? { ...PRACTICE_DEFAULT_COUNTS, ...migrated }
      : migrateCounts(typeof stored.count === 'number' ? stored.count : DEFAULT_CONFIG.count, types)
  // 题量是选中题型的唯一口径：未在 types 里的题型一律归零，避免旧配置里的残留题量被算进总数
  const selectedTypes = types.filter((type) => (counts?.[type] ?? 0) > 0)
  const normalizedCounts: AppConfig['counts'] = Object.fromEntries(
    TYPE_ORDER.map((type) => [type, selectedTypes.includes(type) ? (counts?.[type] ?? 0) : 0]),
  )
  const fallbackTypes = Object.keys(DAILY.values) as AppType[]
  Object.assign(config, {
    grade,
    level,
    unitIds: storedUnits && storedUnits.length > 0 ? storedUnits : defaultUnitIds(grade),
    types: selectedTypes.length > 0 ? selectedTypes : fallbackTypes,
    counts: selectedTypes.length > 0 ? normalizedCounts : { ...DAILY.values },
    count: typeof stored.count === 'number' ? stored.count : DEFAULT_CONFIG.count,
    pages: typeof stored.pages === 'number' ? stored.pages : DEFAULT_CONFIG.pages,
    typstPath: typeof stored.typstPath === 'string' ? stored.typstPath : '',
    saveDir: typeof stored.saveDir === 'string' ? stored.saveDir : '',
    historyLimit:
      stored.historyLimit === 10 || stored.historyLimit === 30 || stored.historyLimit === 0
        ? stored.historyLimit
        : DEFAULT_CONFIG.historyLimit,
  })
  return typeof storedCounts?.angle === 'number' && storedCounts.angle > 0
    ? '「角与图形计数」已并入填空，原题量已累加到填空题'
    : ''
}

async function exportSettings() {
  try {
    const dest = await save({
      title: '导出设置',
      defaultPath: 'QuizLab-设置.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!dest) return
    const saved = await exportConfig(dest, normalizedConfig())
    configNotice.value = `设置已导出到：${saved}`
  } catch (reason) {
    configNotice.value = `设置导出失败：${errorText(reason)}`
  }
}

async function importSettings() {
  try {
    const file = await open({
      title: '导入设置',
      multiple: false,
      directory: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!file || Array.isArray(file)) return
    const imported = await importConfig(file)
    const migration = applyStoredConfig(imported)
    configNotice.value = migration ? `设置已导入并生效；${migration}` : '设置已导入并生效'
  } catch (reason) {
    configNotice.value = `设置导入失败：${errorText(reason)}。当前设置没有改动`
  }
}

const saveDirLabel = computed(() => config.saveDir.trim() || '下载文件夹（~/Downloads）')

async function chooseSaveDir() {
  try {
    const dir = await open({
      title: '选择保存位置',
      directory: true,
      multiple: false,
      defaultPath: config.saveDir.trim() || undefined,
    })
    if (!dir || Array.isArray(dir)) return
    config.saveDir = dir
    configNotice.value = `保存位置已改为：${dir}`
  } catch (reason) {
    configNotice.value = `保存位置设置失败：${errorText(reason)}`
  }
}

function resetSaveDir() {
  config.saveDir = ''
  configNotice.value = '保存位置已恢复为下载文件夹'
}

function clearMemory() {
  memory = new MemoryStore()
  persistMemory(memory)
  chineseMemory = new MemoryStore()
  persistMemoryStore(CHINESE_MEMORY_KEY, chineseMemory)
  memoryNotice.value = '出题记忆已清空，新卷可能和旧卷重复'
}

function resetSettings() {
  Object.assign(config, initialConfig())
  configNotice.value = '已恢复默认设置'
}

function scheduleSave() {
  if (!ready.value) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveConfig(normalizedConfig()).catch((reason) => {
      errorMessage.value = errorText(reason)
    })
  }, 400)
}

watch(config, scheduleSave, { deep: true })

onMounted(async () => {
  try {
    const loaded = await loadConfig()
    restored.value = Object.keys(loaded.config).length > 0
    const migration = applyStoredConfig(loaded.config)
    if (loaded.notice) configNotice.value = loaded.notice
    if (migration) notice.value = migration
  } catch (reason) {
    errorMessage.value = errorText(reason)
  }
  ready.value = true
  trimHistory()

  await refreshTemplate()
  await runCheckTypst()

  // 开发/自检用：app.html?autogen=1 启动后自动生成一份
  if (new URLSearchParams(window.location.search).has('autogen')) {
    await generate()
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  if (ready.value) void saveConfig(normalizedConfig())
})
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <b>每日一练</b>
        <span class="grade">{{ subjectMeta.subtitle }}</span>
      </div>
      <div class="subjects" role="group" aria-label="科目">
        <button
          v-for="item in SUBJECTS"
          :key="item.id"
          :aria-pressed="subject === item.id"
          @click="switchSubject(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <span class="spacer" />
      <button class="ghost" @click="openHistory">历史卷</button>
      <button class="ghost" @click="settingsOpen = true; historyOpen = false">设置</button>
      <component :is="DevTools" v-if="DevTools" />
    </header>

    <aside class="side">
      <ParamsPanel
        v-if="subject === 'math'"
        :config="config"
        :template="template"
        :page-estimate="actualPages"
        @generate="generate"
        @touch="markTouched"
      />
      <ChinesePanel v-else @generate="onChineseGenerate" />
    </aside>

    <main class="main">
      <template v-if="subject === 'math'">
      <div v-if="combinedNotice" class="status">
        <i class="dot" />
        <span class="status-text">{{ combinedNotice }}</span>
      </div>
      <div v-if="errorMessage" class="status err">
        <i class="dot" />
        <span class="status-text">{{ errorMessage }}</span>
        <button class="act" @click="errorMessage = ''">关闭</button>
      </div>

      <div v-if="warnings.length > 0" class="banner">
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

      <section v-if="result && lastBuild" class="result-card">
        <div class="rc-top">
          <div class="figures">
            <div class="figure"><b>{{ lastBuild.count }}</b><small>道题</small></div>
            <div class="figure"><b>{{ estimateMinutes(actualCounts) }}</b><small>分钟</small></div>
            <div class="figure"><b>{{ displayPages }}</b><small>页纸</small></div>
          </div>
          <div class="row-actions">
            <button class="secondary" :disabled="busy" @click="saveAs()">保存 PDF</button>
            <button class="print" :disabled="busy" @click="printPdf()">打印</button>
          </div>
        </div>
        <div class="path">已保存到 {{ folderName }} / {{ fileName }}</div>
        <div class="row-actions rc-actions">
          <button class="linkbtn" @click="openPdfNow()">打开 PDF</button>
          <button class="linkbtn" @click="detailOpen = true">题型明细</button>
        </div>
      </section>

      <div v-if="pdfData" class="preview-wrap">
        <PdfPreview :data="pdfData" @loaded="onPreviewLoaded" />
      </div>
      <div v-else class="empty-stage">
        <div v-if="busy" class="skeleton-card">
          <p>正在生成练习卷…</p>
        </div>
        <div v-else class="empty-card">
          <h3>先出一份今天的练习</h3>
          <p>{{ emptySubtitle }}</p>
          <div class="empty-actions">
            <button
              v-for="preset in PRESETS"
              :key="preset.id"
              class="preset"
              :aria-pressed="activePreset?.id === preset.id"
              @click="quickGenerate(preset)"
            >
              <b>{{ preset.name }}</b>
              <small>{{ presetTotal(preset) }} 题</small>
              <em>点击直接生成</em>
            </button>
          </div>
          <div class="empty-summary" :class="{ custom: !activePreset }">
            {{
              activePreset
                ? `${activePreset.name} · ${total} 题 · ${levelLabel}难度`
                : `自定义 · ${total} 题`
            }}
          </div>
        </div>
      </div>
      </template>

      <template v-else>
        <div v-if="chineseBusy" class="status">
          <i class="dot" />
          <span class="status-text">正在生成语文{{ chineseMode === 'reading' ? '阅读' : chineseMode === 'full' ? '综合' : '同步' }}卷…</span>
        </div>
        <div v-if="chineseError" class="status err">
          <i class="dot" />
          <span class="status-text">{{ chineseError }}</span>
          <button class="act" @click="chineseError = ''">关闭</button>
        </div>
        <div v-if="chineseNotice" class="status">
          <i class="dot" />
          <span class="status-text">{{ chineseNotice }}</span>
        </div>

        <section v-if="chineseResult" class="result-card">
          <div class="rc-top">
            <div class="figures">
              <div class="figure">
                <b>{{ chineseFigures.pieces }}</b>
                <small>{{ chineseMode === 'reading' ? '篇文章' : '道题' }}</small>
              </div>
              <div v-if="chineseMode === 'reading'" class="figure">
                <b>{{ chineseFigures.questions }}</b><small>道题</small>
              </div>
              <div v-if="chineseMode === 'reading'" class="figure">
                <b>{{ chineseFigures.score }}</b><small>分</small>
              </div>
            </div>
            <div class="row-actions">
              <button
                class="secondary"
                :disabled="chineseBusy"
                @click="saveAs(chineseResult, chineseMode === 'reading' ? '语文课外阅读专项.pdf' : chineseMode === 'full' ? '语文综合练习.pdf' : '语文校内同步练习.pdf')"
              >
                保存 PDF
              </button>
              <button class="print" :disabled="chineseBusy" @click="printPdf(chineseResult)">打印</button>
            </div>
          </div>
          <div class="path">
            已保存到 {{ chineseFolder }} / {{ chineseFile }}
            <span v-if="chinesePages > 0"> · 共 {{ chinesePages }} 页</span>
          </div>
          <div class="row-actions rc-actions">
            <button class="linkbtn" @click="openPdfNow(chineseResult?.outputPath)">打开 PDF</button>
          </div>
        </section>

        <div v-if="chinesePdfData" class="preview-wrap">
          <PdfPreview :data="chinesePdfData" @loaded="chinesePages = $event" />
        </div>
        <div v-else class="empty-stage">
          <div class="empty-card">
            <h3>先出一份语文练习</h3>
            <p>「校内同步」按单元出基础题；「综合卷」全册混合基础、阅读和习作；「阅读专项」只出阅读。</p>
          </div>
        </div>
      </template>
    </main>

    <Teleport to="body">
      <div v-if="settingsOpen" class="scrim" @click.self="settingsOpen = false">
        <div class="modal" role="dialog" aria-modal="true" aria-label="设置">
          <div class="modal-head">
            <h2>设置</h2>
            <button class="x" aria-label="关闭" @click="settingsOpen = false">×</button>
          </div>
          <div class="modal-body">
            <section class="setting-group">
              <h3>保存位置</h3>
              <div class="field">
                <span class="label">当前目录</span>
                <span class="spacer" />
                <span class="readonly dir" :title="saveDirLabel">{{ saveDirLabel }}</span>
                <button class="secondary" @click="chooseSaveDir">更改</button>
              </div>
              <div v-if="config.saveDir" class="field">
                <span class="spacer" />
                <button class="linkbtn" @click="resetSaveDir">恢复默认（下载文件夹）</button>
              </div>
            </section>

            <section class="setting-group">
              <h3>历史卷</h3>
              <div class="field">
                <span class="label">保留最近</span>
                <span class="spacer" />
                <div class="seg">
                  <button :aria-pressed="config.historyLimit === 10" @click="config.historyLimit = 10">
                    10 份
                  </button>
                  <button :aria-pressed="config.historyLimit === 30" @click="config.historyLimit = 30">
                    30 份
                  </button>
                  <button :aria-pressed="config.historyLimit === 0" @click="config.historyLimit = 0">
                    不限
                  </button>
                </div>
              </div>
            </section>

            <section class="setting-group">
              <h3>数据</h3>
              <div class="field">
                <span class="label">备份</span>
                <span class="note">导出为 JSON，换电脑可导入</span>
                <span class="spacer" />
                <div class="row-actions">
                  <button class="secondary" @click="exportSettings">导出备份</button>
                  <button class="secondary" @click="importSettings">导入备份</button>
                </div>
              </div>
              <div class="field">
                <span class="label">清空出题记忆</span>
                <span class="note">清空后新卷可能和旧卷重复</span>
                <span class="spacer" />
                <button class="secondary" @click="clearMemory">清空</button>
              </div>
              <div class="field">
                <span class="label">恢复默认设置</span>
                <span class="note">回到首次进入的状态</span>
                <span class="spacer" />
                <button class="secondary" @click="resetSettings">恢复</button>
              </div>
            </section>

            <section class="setting-group">
              <h3>排版程序</h3>
              <div class="field">
                <span class="label">Typst</span>
                <span class="spacer" />
                <span class="readonly">{{ typstStatus }}</span>
                <button class="secondary" :disabled="checking" @click="runCheckTypst">检查</button>
              </div>
              <div class="field">
                <input
                  v-model="config.typstPath"
                  class="input"
                  placeholder="留空则自动探测"
                  @change="runCheckTypst"
                />
                <span class="note">留空则自动探测</span>
              </div>
            </section>

            <section class="setting-group">
              <h3>关于</h3>
              <div class="field">
                <span class="label">版本号</span>
                <span class="spacer" />
                <span class="readonly">{{ APP_VERSION }}</span>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div v-if="detailOpen" class="scrim" @click.self="detailOpen = false">
        <div class="modal detail-modal" role="dialog" aria-modal="true" aria-label="题型明细">
          <div class="modal-head">
            <h2>显示明细</h2>
            <button class="x" aria-label="关闭" @click="detailOpen = false">×</button>
          </div>
          <div class="modal-body">
            <p class="detail-lead">本卷题型与题量</p>
            <div v-for="row in lastBuild?.stats.typeStats ?? []" :key="row.type" class="detail-line">
              <span>{{ typeName(row.type) }}</span>
              <span>{{ row.actual }} 题</span>
            </div>
            <div class="detail-path">
              <span>完整路径</span>
              <div class="path">{{ result?.outputPath }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="historyOpen" class="scrim drawer-scrim" @click.self="historyOpen = false">
        <div class="drawer" role="dialog" aria-modal="true" aria-label="历史卷">
          <div class="drawer-head">
            <h2>历史卷</h2>
            <button class="x" aria-label="关闭" @click="historyOpen = false">×</button>
          </div>
          <div class="history-filter">
            <button :aria-pressed="historyFilter === 'math'" @click="historyFilter = 'math'">数学</button>
            <button :aria-pressed="historyFilter === 'chinese'" @click="historyFilter = 'chinese'">
              语文
            </button>
          </div>
          <div class="drawer-body">
            <p v-if="filteredHistory.length === 0" class="drawer-empty">
              还没有{{ historyFilter === 'chinese' ? '语文' : '数学' }}卷。<br />本次生成的卷会先出现在这里，下次启动后保留。
            </p>
            <div v-for="(item, index) in filteredHistory" :key="index" class="history-item">
              <b>{{ item.title }}</b>
              <small>{{ item.at }} · {{ item.count }} 题 · {{ item.pages }} 页</small>
              <div class="row-actions">
                <button class="secondary" @click="openPdfNow(item.path)">打开 PDF</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: 56px 1fr;
  grid-template-columns: 340px 1fr;
  height: 100vh;
  background: #f2f2f2;
  color: #111;
}
.top {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e3e3e3;
  white-space: nowrap;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex: none;
}
.brand b {
  font-size: 17px;
  letter-spacing: 0.02em;
}
.grade {
  font-size: 12px;
  color: #555;
  padding-left: 12px;
  border-left: 1px solid #e3e3e3;
  flex: none;
}
.subjects {
  display: flex;
  gap: 8px;
  flex: none;
}
.subjects button {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #111;
  cursor: pointer;
  white-space: nowrap;
}
.subjects button:hover {
  border-color: #999;
}
.subjects button[aria-pressed='true'] {
  border-color: #111;
  font-weight: 600;
}
.top .spacer {
  flex: 1;
  min-width: 0;
}
.ghost {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  background: #fff;
  color: #111;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.ghost:hover {
  background: #f6f6f6;
}
.side {
  grid-row: 2;
  min-height: 0;
  background: #fff;
  border-right: 1px solid #e3e3e3;
}
.main {
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.status {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  font-size: 12px;
  color: #333;
  background: #fff;
  border-bottom: 1px solid #e3e3e3;
}
.status .dot {
  flex: none;
  width: 3px;
  align-self: stretch;
  border-radius: 2px;
  background: #2f6f4f;
}
.status.err {
  background: #fff8f8;
}
.status.err .dot {
  background: #b3261e;
}
.status-text {
  flex: 1;
  min-width: 0;
}
.act {
  font: inherit;
  font-size: 12px;
  border: none;
  background: none;
  color: #111;
  text-decoration: underline;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.banner {
  flex: none;
  max-height: 180px;
  overflow: auto;
  padding: 10px 20px 12px;
  background: #fffdf7;
  border-bottom: 1px solid #e3e3e3;
}
.banner.fail {
  background: #fff8f8;
}
.banner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
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
  white-space: nowrap;
  flex: none;
}
.link:hover {
  color: #000;
}
.banner pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
.result-card {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 20px 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
}
.rc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.figures {
  display: flex;
  gap: 24px;
}
.figure b {
  display: block;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.figure small {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.path {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.row-actions {
  display: flex;
  gap: 8px;
  flex: none;
}
.rc-actions {
  gap: 24px;
  align-items: baseline;
}
.secondary {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 16px;
  border: 1px solid #bbb;
  border-radius: 6px;
  background: #fff;
  color: #111;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.secondary:hover:not(:disabled) {
  background: #f6f6f6;
}
.secondary:disabled {
  color: #aaa;
  border-color: #ddd;
  cursor: default;
}
.print {
  font: inherit;
  font-size: 13px;
  width: 104px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #111;
  border-radius: 6px;
  background: #111;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.print:hover:not(:disabled) {
  background: #222;
}
.print:disabled {
  background: #777;
  border-color: #777;
  cursor: default;
}
.secondary {
  width: 104px;
  padding: 0 12px;
}
.linkbtn {
  font: inherit;
  font-size: 12px;
  border: none;
  background: none;
  color: #555;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.linkbtn:hover {
  color: #111;
}
.preview-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
}
.ph-panel {
  flex: none;
  margin: 20px;
  padding: 16px 20px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background: #fff;
}
.ph-badge {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid #ddd;
  border-radius: 999px;
  font-size: 11px;
  color: #777;
}
.ph-panel h3 {
  margin: 10px 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: #111;
}
.ph-panel p {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #666;
}
.ph-panel .ph-tip {
  margin-top: 8px;
  color: #111;
}
.empty-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.empty-card {
  width: 620px;
  min-height: 420px;
  padding: 48px 40px;
  background: #fff;
  border: 1px dashed #ccc;
  border-radius: 10px;
  text-align: center;
}
.empty-card h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}
.empty-card p {
  margin: 0 0 24px;
  font-size: 13px;
  color: #888;
  white-space: nowrap;
}
.empty-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.empty-actions .preset {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 132px;
  min-height: 66px;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  text-align: center;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.empty-actions .preset:hover {
  border-color: #111;
}
.empty-actions .preset[aria-pressed='true'] {
  border-color: #111;
  background: #fff;
}
.empty-actions .preset b {
  font-size: 13px;
  font-weight: 600;
}
.empty-actions .preset small {
  margin-top: 2px;
  font-size: 11px;
  color: #888;
}
.empty-actions .preset em {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  font-style: normal;
  color: #999;
}
.empty-summary {
  margin-top: 14px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
.empty-summary.custom {
  color: #888;
}
.skeleton-card {
  width: 560px;
  min-height: 420px;
  background: #fff;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #555;
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  display: flex;
  flex-direction: column;
  width: 560px;
  max-height: 82vh;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}
.detail-modal {
  width: 460px;
}
.modal-head {
  display: flex;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #e3e3e3;
}
.modal-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-head .x {
  margin-left: auto;
  border: none;
  background: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 8px 24px 24px;
  overflow-y: auto;
}
.setting-group {
  padding: 16px 0;
  border-bottom: 1px solid #efefef;
}
.setting-group:last-child {
  border-bottom: 0;
}
.setting-group h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}
.field {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
}
.field .label {
  font-size: 13px;
  white-space: nowrap;
  flex: none;
}
.field .note {
  font-size: 12px;
  color: #888;
}
.field .spacer {
  flex: 1;
  min-width: 0;
}
.readonly {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  flex: none;
}
.readonly.dir {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.setting-group .seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 210px;
  flex: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
}
.setting-group .seg button {
  font: inherit;
  font-size: 13px;
  height: 30px;
  border: none;
  background: #fff;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}
.setting-group .seg button + button {
  border-left: 1px solid #ccc;
}
.setting-group .seg button[aria-pressed='true'] {
  background: #111;
  color: #fff;
}
.input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
}
.input:focus {
  outline: none;
  border-color: #111;
}
.detail-lead {
  margin: 8px 0 4px;
  font-size: 12px;
  color: #888;
}
.detail-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid #efefef;
  font-size: 13px;
}
.detail-line span:last-child {
  margin-left: auto;
  color: #555;
  white-space: nowrap;
  flex: none;
}
.detail-path {
  padding: 9px 0;
  border-top: 1px solid #efefef;
  font-size: 13px;
}
.detail-path .path {
  margin-top: 4px;
  font-size: 11px;
  word-break: break-all;
  white-space: normal;
}
.drawer {
  margin-left: auto;
  height: 100%;
  width: 400px;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.16);
}
.drawer-scrim {
  padding: 0;
}
.drawer-head {
  display: flex;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #e3e3e3;
}
.drawer-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.drawer-head .x {
  margin-left: auto;
  border: none;
  background: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
  line-height: 1;
}
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.history-filter {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin: 12px 20px 0;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  flex: none;
}
.history-filter button {
  font: inherit;
  font-size: 13px;
  height: 32px;
  border: none;
  background: #fff;
  color: #555;
  cursor: pointer;
}
.history-filter button + button {
  border-left: 1px solid #ccc;
}
.history-filter button[aria-pressed='true'] {
  background: #111;
  color: #fff;
}
.drawer-empty {
  margin-top: 80px;
  text-align: center;
  font-size: 13px;
  color: #888;
  line-height: 1.7;
}
.history-item {
  padding: 12px 0;
  border-bottom: 1px solid #efefef;
}
.history-item b {
  display: block;
  font-size: 13px;
  font-weight: 500;
}
.history-item small {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #888;
}
.history-item .row-actions {
  margin-top: 8px;
  gap: 6px;
}
.history-item .secondary {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  width: auto;
}
</style>
