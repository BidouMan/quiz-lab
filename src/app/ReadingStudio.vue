<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  crawlWechatArticleList,
  crawlWechatLinksBatch,
  createCatalogJob,
  errorText,
  isTauri,
  openWechatLogin,
  readCatalogSnapshot,
  resolveWechatShareLink,
  wechatLoginState,
} from './api'
import {
  buildJob,
  DEFAULT_JOB_TARGET,
  DEFAULT_WORD_MAX,
  DEFAULT_WORD_MIN,
  formatJobTime,
  jobStatusLabel,
  MAX_JOB_TARGET,
  MAX_NOTE_LENGTH,
  MAX_WORD_COUNT,
  MIN_WORD_COUNT,
  summarizeCatalog,
  validateJobDraft,
  type CatalogSnapshot,
  type JobDraft,
} from './catalog'
import {
  parseWechatArticleUrl,
  splitWechatLinkLines,
  wechatResolveErrorText,
  type LinkBatchSummary,
  type WechatListSummary,
  type WechatLoginState,
  type WechatResolved,
} from './wechat'
import { findWechatSource, WECHAT_SOURCES } from './wechatSources'

const emit = defineEmits<{ close: [] }>()

const snapshot = ref<CatalogSnapshot | null>(null)
const board = computed(() => summarizeCatalog(snapshot.value))
const sources = computed(() => board.value.rows)

const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const generating = ref(false)
const feedback = ref('')
const feedbackOk = ref(true)
const jobPath = ref('')

const wechatUrl = ref('')
const WECHAT_SOURCE_KEY = 'quizlab.wechat.source'
const wechatSourceId = ref('')
const selectedSource = computed(() => findWechatSource(wechatSourceId.value))
const isCustomSource = computed(() => wechatSourceId.value === 'custom')
const wechatParsed = computed(() => parseWechatArticleUrl(wechatUrl.value))
const wechatNeedsResolve = computed(
  () => wechatParsed.value.ok && wechatParsed.value.kind === 'resolve',
)
const wechatBiz = computed(() => {
  const parsed = wechatParsed.value
  return parsed.ok && parsed.kind === 'biz' ? parsed.ref.biz : ''
})
const shareResolved = ref<WechatResolved | null>(null)
const resolving = ref(false)
const resolveError = ref('')
const effectiveBiz = computed(() => shareResolved.value?.biz ?? wechatBiz.value)
const wechatHint = computed(() => {
  if (!wechatUrl.value.trim()) return ''
  const parsed = wechatParsed.value
  return parsed.ok ? '' : parsed.reason
})
const login = ref<WechatLoginState | null>(null)
const loginError = ref('')
const loginBusy = ref(false)
const loginAttempted = ref(false)
const crawlBusy = ref(false)
const crawlSummary = ref<WechatListSummary | null>(null)
const crawlError = ref('')
let loginTimer: number | undefined

// 批量链接：一行一条，串行 curl 取正文后走 intake
const linkBatchText = ref('')
const linkBatchBusy = ref(false)
const linkBatchError = ref('')
const linkBatchNotice = ref('')
const linkBatchSummary = ref<LinkBatchSummary | null>(null)
const linkFileInput = ref<HTMLInputElement | null>(null)
const linkBatchCount = computed(() => splitWechatLinkLines(linkBatchText.value).length)
// 课内片段与课外短文分开收：课内 150–400，课外 250–600（超上限标出但不拒收）
const linkInTextMin = ref(150)
const linkInTextMax = ref(400)
const linkExtraMin = ref(250)
const linkExtraMax = ref(600)

// 换了链接就丢掉上一次的解析结果，避免把旧账号带到新链接上
watch(wechatUrl, () => {
  shareResolved.value = null
  resolveError.value = ''
  crawlSummary.value = null
  crawlError.value = ''
})

function saveSourceChoice() {
  try {
    window.localStorage.setItem(
      WECHAT_SOURCE_KEY,
      JSON.stringify({ id: wechatSourceId.value, url: wechatUrl.value }),
    )
  } catch {
    // 本地存储不可用时不影响使用
  }
}

function applySourceChoice() {
  wechatUrl.value = selectedSource.value?.url ?? ''
  saveSourceChoice()
}

function restoreSourceChoice() {
  let saved: { id?: unknown; url?: unknown } | null = null
  try {
    saved = JSON.parse(window.localStorage.getItem(WECHAT_SOURCE_KEY) ?? 'null')
  } catch {
    saved = null
  }

  if (saved?.id === 'custom') {
    wechatSourceId.value = 'custom'
    if (typeof saved.url === 'string') wechatUrl.value = saved.url
    return
  }
  if (typeof saved?.id === 'string' && findWechatSource(saved.id)) {
    wechatSourceId.value = saved.id
    wechatUrl.value = selectedSource.value?.url ?? ''
    return
  }

  // 第一次打开默认选中第一条已验证来源，省去再找链接
  const first = WECHAT_SOURCES[0]
  if (first) {
    wechatSourceId.value = first.id
    wechatUrl.value = first.url
  } else {
    wechatSourceId.value = 'custom'
  }
}

const loginStatusText = computed(() => {
  if (!isTauri) return '仅在桌面应用中可用'
  if (login.value?.loggedIn) return '已登录（仅本次运行有效）'
  if (login.value?.open) return '等待扫码登录…'
  if (loginAttempted.value) return '登录窗口已关闭'
  return '未登录'
})

const form = reactive({
  targetCount: DEFAULT_JOB_TARGET,
  wordMin: DEFAULT_WORD_MIN,
  wordMax: DEFAULT_WORD_MAX,
  requireAnswer: false,
  note: '',
  selected: [] as string[],
})

const allSelected = computed(
  () => sources.value.length > 0 && sources.value.every((row) => form.selected.includes(row.id)),
)

const statCards = computed(() => [
  { key: 'imported', label: '已入库', value: board.value.stats.imported },
  { key: 'pending', label: '待处理', value: board.value.stats.pending },
  { key: 'noAnswer', label: '缺答案', value: board.value.stats.noAnswer },
  { key: 'split', label: '已切分合集', value: board.value.stats.split },
  { key: 'needsSplit', label: '待切分', value: board.value.stats.needsSplit },
  { key: 'rejected', label: '已拒', value: board.value.stats.rejected },
  { key: 'total', label: '总数', value: board.value.stats.total },
])

async function load() {
  if (!isTauri) {
    loadError.value = '请在桌面应用中打开（pnpm tauri dev）'
    return
  }
  loading.value = true
  try {
    snapshot.value = await readCatalogSnapshot()
    loadError.value = ''
    if (!loaded.value) {
      form.selected = sources.value.map((row) => row.id)
      loaded.value = true
    } else {
      form.selected = form.selected.filter((id) => sources.value.some((row) => row.id === id))
    }
  } catch (reason) {
    snapshot.value = null
    loadError.value = `无法读取：${errorText(reason)}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  restoreSourceChoice()
  void load()
  void refreshLoginState()
})

onBeforeUnmount(stopLoginPolling)

function stopLoginPolling() {
  if (loginTimer !== undefined) {
    window.clearInterval(loginTimer)
    loginTimer = undefined
  }
}

async function refreshLoginState() {
  if (!isTauri) return
  try {
    login.value = await wechatLoginState()
    if (!login.value.open || login.value.loggedIn) stopLoginPolling()
  } catch (reason) {
    loginError.value = errorText(reason)
    stopLoginPolling()
  }
}

function startLoginPolling() {
  stopLoginPolling()
  loginTimer = window.setInterval(() => {
    void refreshLoginState()
  }, 2000)
}

async function resolveShareLink() {
  if (resolving.value) return
  resolveError.value = ''
  shareResolved.value = null
  if (!isTauri) {
    resolveError.value = '仅在桌面应用中可用'
    return
  }
  const parsed = wechatParsed.value
  if (!parsed.ok) {
    resolveError.value = parsed.reason
    return
  }
  if (parsed.kind !== 'resolve') {
    resolveError.value = '这个链接已经带了 __biz，不需要解析'
    return
  }

  resolving.value = true
  try {
    shareResolved.value = await resolveWechatShareLink(parsed.url)
  } catch (reason) {
    resolveError.value = wechatResolveErrorText(errorText(reason))
  } finally {
    resolving.value = false
  }
}

async function crawlList() {
  if (crawlBusy.value) return
  crawlError.value = ''
  crawlSummary.value = null
  if (!effectiveBiz.value) {
    crawlError.value = '请先解析或粘贴带 __biz 的链接'
    return
  }
  if (!login.value?.loggedIn) {
    crawlError.value = '还没有登录，请先扫码登录'
    return
  }
  crawlBusy.value = true
  try {
    crawlSummary.value = await crawlWechatArticleList(
      effectiveBiz.value,
      shareResolved.value?.accountName ?? null,
    )
  } catch (reason) {
    crawlError.value = `抓取失败：${errorText(reason)}`
  } finally {
    crawlBusy.value = false
  }
}

async function crawlLinks() {
  if (linkBatchBusy.value) return
  linkBatchError.value = ''
  linkBatchNotice.value = ''
  linkBatchSummary.value = null
  if (!isTauri) {
    linkBatchError.value = '仅在桌面应用中可用'
    return
  }
  const links = splitWechatLinkLines(linkBatchText.value)
  if (links.length === 0) {
    linkBatchError.value = '请先粘贴至少一条文章链接（一行一条），或导入 txt 文件'
    return
  }
  if (linkInTextMin.value > linkInTextMax.value || linkExtraMin.value > linkExtraMax.value) {
    linkBatchError.value = '字数区间的上限不能小于下限'
    return
  }
  linkBatchBusy.value = true
  try {
    linkBatchSummary.value = await crawlWechatLinksBatch(
      links.join('\n'),
      linkInTextMin.value,
      linkInTextMax.value,
      linkExtraMin.value,
      linkExtraMax.value,
    )
    await load()
  } catch (reason) {
    linkBatchError.value = `批量抓取失败：${errorText(reason)}`
  } finally {
    linkBatchBusy.value = false
  }
}

async function importLinkFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  linkBatchError.value = ''
  try {
    const text = (await file.text()).trim()
    linkBatchText.value = linkBatchText.value.trim()
      ? `${linkBatchText.value.trimEnd()}\n${text}`
      : text
    linkBatchNotice.value = `已导入 ${file.name}`
  } catch (reason) {
    linkBatchError.value = `读取文件失败：${errorText(reason)}`
  }
}

async function openLogin() {
  if (loginBusy.value) return
  loginError.value = ''
  if (!effectiveBiz.value) {
    loginError.value = wechatNeedsResolve.value
      ? '请先点「解析账号」，从这条分享链里取回账号标识'
      : wechatParsed.value.ok
        ? '请先粘贴文章链接'
        : wechatParsed.value.reason
    return
  }
  loginBusy.value = true
  loginAttempted.value = true
  try {
    await openWechatLogin()
    await refreshLoginState()
    if (!login.value?.loggedIn) startLoginPolling()
  } catch (reason) {
    loginError.value = `无法打开登录窗口：${errorText(reason)}`
  } finally {
    loginBusy.value = false
  }
}

function toggleSource(id: string) {
  const index = form.selected.indexOf(id)
  if (index >= 0) form.selected.splice(index, 1)
  else form.selected.push(id)
}

function toggleAll() {
  form.selected = allSelected.value ? [] : sources.value.map((row) => row.id)
}

function toDraft(): JobDraft {
  return {
    targetCount: Number(form.targetCount),
    sources: form.selected.slice(),
    wordMin: Number(form.wordMin),
    wordMax: Number(form.wordMax),
    requireAnswer: form.requireAnswer,
    note: form.note,
  }
}

async function submit() {
  if (generating.value) return
  feedback.value = ''
  jobPath.value = ''
  const draft = toDraft()
  const problem = validateJobDraft(draft)
  if (problem) {
    feedbackOk.value = false
    feedback.value = problem
    return
  }

  generating.value = true
  try {
    const job = buildJob(draft)
    jobPath.value = await createCatalogJob(job)
    feedbackOk.value = true
    feedback.value = '任务单已生成，可回到对话让助手执行'
    await load()
  } catch (reason) {
    feedbackOk.value = false
    feedback.value = `任务单生成失败：${errorText(reason)}`
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="studio" role="dialog" aria-modal="true" aria-label="阅读素材库">
      <div class="head">
        <h2>阅读素材库</h2>
        <span class="badge">开发者工具</span>
        <button class="close" aria-label="关闭" @click="emit('close')">×</button>
      </div>

      <div class="body">
        <section class="group">
          <h3>配置区</h3>

          <div class="fields">
            <div class="field">
              <span class="label">目标篇数</span>
              <input
                v-model.number="form.targetCount"
                class="input num"
                type="number"
                min="1"
                :max="MAX_JOB_TARGET"
              />
            </div>
            <div class="field">
              <span class="label">字数区间</span>
              <div class="word-range">
                <input
                  v-model.number="form.wordMin"
                  class="input num"
                  type="number"
                  :min="MIN_WORD_COUNT"
                  :max="MAX_WORD_COUNT"
                />
                <span class="dash">–</span>
                <input
                  v-model.number="form.wordMax"
                  class="input num"
                  type="number"
                  :min="MIN_WORD_COUNT"
                  :max="MAX_WORD_COUNT"
                />
              </div>
            </div>
          </div>

          <div class="field field-wide">
            <span class="label">来源范围</span>
            <button class="text-btn" @click="toggleAll">
              {{ allSelected ? '全不选' : '全选' }}
            </button>
            <span class="note">{{ form.selected.length }} / {{ sources.length }}</span>
          </div>
          <div v-if="sources.length > 0" class="picks">
            <button
              v-for="row in sources"
              :key="row.id"
              class="pick"
              :aria-pressed="form.selected.includes(row.id)"
              @click="toggleSource(row.id)"
            >
              {{ row.name }}
            </button>
          </div>
          <p v-else class="hint">来源名单暂无数据，无法生成任务单</p>

          <div class="field field-wide">
            <span class="label">只要带答案</span>
            <label class="switch">
              <input v-model="form.requireAnswer" type="checkbox" />
              <span class="track" :class="{ on: form.requireAnswer }" />
              <span class="switch-text">{{ form.requireAnswer ? '是' : '否' }}</span>
            </label>
          </div>

          <div class="note-field">
            <span class="label">备注（可选）</span>
            <textarea
              v-model="form.note"
              class="input area"
              rows="2"
              :maxlength="MAX_NOTE_LENGTH"
              placeholder="写进任务单的补充说明"
            />
          </div>

          <div class="actions">
            <span v-if="feedback" class="feedback" :class="{ err: !feedbackOk }">{{ feedback }}</span>
            <span class="spacer" />
            <button class="secondary" :disabled="loading || generating" @click="load()">刷新</button>
            <button class="primary" :disabled="generating || sources.length === 0" @click="submit">
              生成任务单
            </button>
          </div>
          <p v-if="jobPath" class="job-path">{{ jobPath }}</p>
        </section>

        <section class="group">
          <h3>公众号导出</h3>
          <div class="wechat-row">
            <span class="label">公众号</span>
            <select
              v-model="wechatSourceId"
              class="input source-select"
              @change="applySourceChoice"
            >
              <option v-for="item in WECHAT_SOURCES" :key="item.id" :value="item.id">
                {{ item.accountName }} · {{ item.title }}
              </option>
              <option value="custom">自定义链接（粘贴任意一篇）</option>
            </select>
            <button
              v-if="wechatNeedsResolve"
              class="secondary"
              :disabled="resolving"
              @click="resolveShareLink"
            >
              {{ resolving ? '解析中…' : '解析账号' }}
            </button>
          </div>

          <div v-if="isCustomSource" class="wechat-row">
            <span class="label">文章链接</span>
            <input
              v-model="wechatUrl"
              class="input url-input"
              type="url"
              spellcheck="false"
              placeholder="粘贴该公众号任意一篇文章链接（分享链也可以）"
              @change="saveSourceChoice"
            />
          </div>
          <p v-else-if="selectedSource" class="hint">
            已验证 {{ selectedSource.verifiedAt }} · 链接签名过期时会提示换一条
          </p>

          <template v-if="shareResolved">
            <p class="hint ok">
              已解析：{{ shareResolved.accountName || '未取到账号名' }}
              <template v-if="shareResolved.title"> · 《{{ shareResolved.title }}》</template>
            </p>
            <p class="hint">
              账号标识 __biz：<span class="biz">{{ shareResolved.biz }}</span>
            </p>
            <p class="hint">请确认账号名和文章标题是不是你要导出的那篇。</p>
          </template>
          <p v-else-if="wechatBiz" class="hint">
            已识别账号 __biz：<span class="biz">{{ wechatBiz }}</span>
          </p>
          <p v-else-if="wechatHint" class="hint err">{{ wechatHint }}</p>
          <p v-else-if="wechatNeedsResolve && !resolveError" class="hint">
            分享链里没有 __biz，点「解析账号」会实际打开这条链接取回账号名与文章标题。
          </p>
          <p v-if="resolveError" class="hint err">{{ resolveError }}</p>

          <div class="actions">
            <span class="wechat-status">{{ loginStatusText }}</span>
            <span class="spacer" />
            <button class="secondary" :disabled="!effectiveBiz || loginBusy" @click="openLogin">
              登录
            </button>
            <button
              class="secondary"
              disabled
              title="微信服务端限制：历史文章列表只有微信客户端能取，桌面端不可用"
              @click="crawlList"
            >
              {{ crawlBusy ? '抓取中…' : '抓取文章列表' }}
            </button>
          </div>
          <p class="hint">
            已停用「抓取文章列表」：微信服务端限制，历史文章列表仅微信客户端可取，桌面端已停止尝试。
            请用下面的「批量链接」逐条抓正文。
          </p>
          <p v-if="loginError" class="hint err">{{ loginError }}</p>
          <p v-if="crawlError" class="hint err">{{ crawlError }}</p>
          <template v-if="crawlSummary">
            <p class="hint ok">
              列表抓取完成：{{ crawlSummary.total }} 篇（本次 {{ crawlSummary.pages }} 页）
            </p>
            <p v-if="crawlSummary.stoppedReason" class="hint err">
              已停止：{{ crawlSummary.stoppedReason }}
            </p>
            <p v-else-if="crawlSummary.canContinue" class="hint">
              还有更多，再点一次可从未抓的位置继续。
            </p>
            <p class="hint">{{ crawlSummary.indexPath }}</p>
          </template>
          <p class="hint">登录态只保留在本次运行内，不写入磁盘；扫码成功后这里会显示已登录。</p>
        </section>

        <section class="group">
          <h3>批量链接</h3>
          <p class="hint">
            一行一条公众号文章链接。用系统 curl 串行取 HTML（浏览器 UA、跟随跳转、无任何登录凭证），
            取正文后走现有 intake：clean → gate → 入库，并按 sha256 / simhash 与已有素材去重。
            每条间隔 3–5 秒；单条失败只记原因、不中断整批；已抓成功的链接下次自动跳过。
          </p>
          <div class="field field-wide">
            <span class="label">字数区间（课内片段 / 课外短文，按段独立判定）</span>
            <div class="word-range">
              <span class="range-tag">课内</span>
              <input
                v-model.number="linkInTextMin"
                class="input num"
                type="number"
                :min="1"
                :max="MAX_WORD_COUNT"
              />
              <span class="dash">–</span>
              <input
                v-model.number="linkInTextMax"
                class="input num"
                type="number"
                :min="1"
                :max="MAX_WORD_COUNT"
              />
              <span class="range-tag">课外</span>
              <input
                v-model.number="linkExtraMin"
                class="input num"
                type="number"
                :min="1"
                :max="MAX_WORD_COUNT"
              />
              <span class="dash">–</span>
              <input
                v-model.number="linkExtraMax"
                class="input num"
                type="number"
                :min="1"
                :max="MAX_WORD_COUNT"
              />
            </div>
          </div>
          <textarea
            v-model="linkBatchText"
            class="input area link-area"
            rows="6"
            spellcheck="false"
            placeholder="https://mp.weixin.qq.com/s?...（一行一条）"
          />
          <div class="actions">
            <button class="secondary" :disabled="linkBatchBusy" @click="linkFileInput?.click()">
              导入 txt
            </button>
            <input
              ref="linkFileInput"
              class="file-input"
              type="file"
              accept=".txt,text/plain"
              @change="importLinkFile"
            />
            <span class="note">{{ linkBatchCount }} 条链接</span>
            <span class="spacer" />
            <button
              class="primary"
              :disabled="linkBatchBusy || linkBatchCount === 0"
              @click="crawlLinks"
            >
              {{ linkBatchBusy ? '抓取中…' : '开始抓取' }}
            </button>
          </div>
          <p v-if="linkBatchNotice" class="hint">{{ linkBatchNotice }}</p>
          <p v-if="linkBatchError" class="hint err">{{ linkBatchError }}</p>
          <template v-if="linkBatchSummary">
            <p class="hint ok">
              成功 {{ linkBatchSummary.success }} / 跳过 {{ linkBatchSummary.skipped }} / 失败
              {{ linkBatchSummary.failed }}（共 {{ linkBatchSummary.total }} 条）
            </p>
            <p class="hint">
              已入库 {{ linkBatchSummary.imported }} 篇；正文合格、待补题 {{ linkBatchSummary.pendingQuestions }} 篇。
            </p>
            <p
              v-if="linkBatchSummary.splitArticles > 0 || linkBatchSummary.needsSplit > 0"
              class="hint"
            >
              合集已切分 {{ linkBatchSummary.splitArticles }} 篇 → 切出
              {{ linkBatchSummary.splitUnits }} 段；字数/分段合格
              {{ linkBatchSummary.splitWordPassed }} 段，完整过 gate
              {{ linkBatchSummary.splitPassed }} 段。
              <template v-if="linkBatchSummary.needsSplit > 0">
                边界不可靠、整篇待切分 {{ linkBatchSummary.needsSplit }} 篇。
              </template>
            </p>
            <p v-for="item in linkBatchSummary.failReasons" :key="item.reason" class="hint">
              单篇不合格 · {{ item.reason }}：{{ item.count }} 条
            </p>
            <p class="hint">{{ linkBatchSummary.reportPath }}</p>
          </template>
        </section>

        <section class="group">
          <div class="group-head">
            <h3>台账看板</h3>
            <span class="dir">{{ snapshot?.dir ?? '' }}</span>
            <span class="spacer" />
            <button class="text-btn" :disabled="loading" @click="load()">刷新</button>
          </div>

          <p v-if="loadError" class="hint err">{{ loadError }}</p>
          <p v-else-if="loading && !snapshot" class="hint">读取中…</p>
          <p v-else-if="!board.hasData" class="hint">暂无数据</p>
          <template v-else>
            <div class="stats">
              <div v-for="card in statCards" :key="card.key" class="stat">
                <b>{{ card.value }}</b>
                <small>{{ card.label }}</small>
              </div>
            </div>

            <p v-if="board.stats.badLines > 0" class="hint">
              items.jsonl 有 {{ board.stats.badLines }} 行无法读取
            </p>

            <table v-if="board.rows.length > 0" class="board">
              <thead>
                <tr>
                  <th>来源</th>
                  <th>结账状态</th>
                  <th class="num-col">已收录</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in board.rows" :key="row.id">
                  <td>{{ row.name }}</td>
                  <td>{{ row.closing }}</td>
                  <td class="num-col">{{ row.imported }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="hint">来源名单暂无数据</p>

            <div class="latest">
              <span class="label">最近任务单</span>
              <span v-if="board.latestJob">
                {{ formatJobTime(board.latestJob.createdAt) || board.latestJob.id }} ·
                {{ jobStatusLabel(board.latestJob.status) }} · {{ board.latestJob.targetCount }} 篇
              </span>
              <span v-else class="hint inline">暂无任务单</span>
            </div>

            <p v-if="board.errors.length > 0" class="hint err">
              {{ board.errors.join('；') }}
            </p>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.studio {
  display: flex;
  flex-direction: column;
  width: 860px;
  max-width: 100%;
  max-height: 88vh;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 24px;
  border-bottom: 1px solid #e3e3e3;
  flex: none;
}
.head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}
.badge {
  padding: 2px 8px;
  border: 1px solid #ddd;
  border-radius: 999px;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}
.close {
  margin-left: auto;
  border: none;
  background: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  white-space: nowrap;
}
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px 22px;
}
.group {
  padding: 10px 0 18px;
  border-bottom: 1px solid #efefef;
}
.group:last-child {
  border-bottom: 0;
  padding-bottom: 4px;
}
.group h3 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.group-head h3 {
  margin: 0;
}
.group-head .dir {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-head .spacer {
  flex: none;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
}
.field-wide {
  margin-top: 8px;
}
.label {
  flex: none;
  font-size: 13px;
  white-space: nowrap;
}
.note {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.input {
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
.input.num {
  width: 84px;
  flex: none;
}
.word-range {
  display: flex;
  align-items: center;
  gap: 6px;
}
.range-tag {
  font-size: 12px;
  color: #666;
  margin-left: 4px;
}
.wechat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.url-input {
  flex: 1;
  min-width: 0;
}
.source-select {
  flex: 1;
  min-width: 0;
}
.wechat-status {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}
.biz {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #555;
  word-break: break-all;
}
.dash {
  color: #888;
  font-size: 12px;
}
.text-btn {
  font: inherit;
  font-size: 11px;
  color: #777;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}
.text-btn:hover:not(:disabled) {
  color: #111;
}
.text-btn:disabled {
  color: #bbb;
  cursor: default;
}
.picks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 2px 0 10px;
}
.pick {
  font: inherit;
  font-size: 12px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  cursor: pointer;
  white-space: nowrap;
}
.pick:hover {
  border-color: #999;
}
.pick[aria-pressed='true'] {
  border-color: #111;
  border-radius: 8px;
  font-weight: 600;
}
.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.track {
  position: relative;
  width: 34px;
  height: 18px;
  border: 1px solid #ccc;
  border-radius: 999px;
  background: #f2f2f2;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease;
}
.track.on {
  background: #111;
  border-color: #111;
}
.track.on::after {
  transform: translateX(16px);
}
.switch-text {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}
.note-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.input.area {
  height: auto;
  min-height: 52px;
  padding: 8px;
  resize: vertical;
  line-height: 1.5;
}
.link-area {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  margin-bottom: 4px;
}
.file-input {
  display: none;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.actions .spacer {
  flex: 1;
  min-width: 0;
}
.feedback {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #2f6f4f;
}
.feedback.err {
  color: #b3261e;
}
.secondary,
.primary {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  white-space: nowrap;
  flex: none;
  cursor: pointer;
}
.secondary {
  border: 1px solid #ccc;
  background: #fff;
  color: #111;
}
.secondary:hover:not(:disabled) {
  background: #f6f6f6;
}
.primary {
  border: 1px solid #111;
  background: #111;
  color: #fff;
}
.primary:hover:not(:disabled) {
  background: #222;
}
.secondary:disabled,
.primary:disabled {
  opacity: 0.45;
  cursor: default;
}
.job-path {
  margin: 10px 0 0;
  font-size: 11px;
  color: #888;
  word-break: break-all;
}
.hint {
  margin: 6px 0;
  font-size: 12px;
  color: #888;
}
.hint.err {
  color: #b3261e;
}
.hint.ok {
  color: #2f6f4f;
}
.hint.inline {
  margin: 0;
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.stat {
  padding: 10px 12px;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
  background: #fff;
}
.stat b {
  display: block;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.stat small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}
.board {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.board th,
.board td {
  padding: 8px 10px;
  border-bottom: 1px solid #efefef;
  text-align: left;
  white-space: nowrap;
}
.board th {
  font-weight: 600;
  color: #666;
  font-size: 11px;
}
.board .num-col {
  width: 90px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.latest {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
.latest .label {
  color: #666;
  font-size: 12px;
}
</style>
