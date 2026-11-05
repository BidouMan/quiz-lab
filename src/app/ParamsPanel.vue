<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Level } from '../quiz/types.ts'
import {
  panelUnits,
  typeAvailability,
  typeVisibleInGrade,
} from './paperBuilder'
import { MAX_TYPE_COUNT, type AppConfig, type AppType, type TemplateInfo, type TypstInfo } from './types'
import { TYPE_OPTIONS } from './typstData'

const props = defineProps<{
  config: AppConfig
  template: TemplateInfo | null
  typst: TypstInfo | null
  typstError: string
  checking: boolean
  /** 排版回填的实际页数；未排版时为空，界面用总数粗估 */
  pageEstimate?: number
}>()

const emit = defineEmits<{ checkTypst: [] }>()

const LEVELS: { level: Level; label: string; hint: string }[] = [
  { level: 'L1', label: 'L1', hint: '基础' },
  { level: 'L2', label: 'L2', hint: '常规' },
  { level: 'L3', label: 'L3', hint: '易错' },
]

const units = computed(() => panelUnits())
const availability = computed(() => typeAvailability(props.config, props.template))
const visibleOptions = computed(() =>
  TYPE_OPTIONS.filter((option) => typeVisibleInGrade(props.config.grade, option.type)),
)
const allSelected = computed(() => props.config.unitIds.length === units.value.length)

/** 已勾选且当前单元确实能出的题型 */
const activeTypes = computed(() =>
  visibleOptions.value
    .map((option) => option.type)
    .filter((type) => props.config.types.includes(type) && availability.value[type].enabled),
)
const totalCount = computed(() => activeTypes.value.reduce((sum, type) => sum + countFor(type), 0))
/** 出卷前按题型数量粗估页数（仅用于界面提示，排版后一律以实际页数为准） */
const PAGE_COST: Record<AppType, number> = {
  kousuan: 0.02,
  chushi: 0.06,
  tuoshi: 0.06,
  jianbian: 0.06,
  tiankong: 0.06,
  compare: 0.06,
  geom: 0.2,
  word: 0.08,
  judge: 0.06,
  choice: 0.08,
}
const roughPages = computed(() => {
  if (activeTypes.value.length === 0) return 0
  const pages = activeTypes.value.reduce((sum, type) => sum + countFor(type) * (PAGE_COST[type] ?? 0.06), 0)
  return Math.max(1, Math.round(pages + activeTypes.value.length * 0.5))
})
const estimatedPages = computed(() => {
  const actual = props.pageEstimate ?? 0
  return actual > 0 ? actual : roughPages.value
})

const SOURCE_LABELS: Record<string, string> = {
  skeleton: '骨架包',
  rule: '规则库',
  legacy: '旧生成器',
  static: '静态题库',
  na: '不适用',
}

function sourceLabel(type: AppType): string {
  const source = availability.value[type].source
  return source ? SOURCE_LABELS[source] : ''
}

function countFor(type: AppType): number {
  return Math.max(0, Math.round(Number(props.config.counts?.[type] ?? 0)) || 0)
}

const countNotice = ref('')
const optionLabels = new Map(TYPE_OPTIONS.map((option) => [option.type, option.label]))

function setCount(type: AppType, raw: string) {
  const value = Number(raw)
  const rounded = Number.isFinite(value) ? Math.round(value) : 0
  const next = Math.min(MAX_TYPE_COUNT, Math.max(0, rounded))
  countNotice.value =
    rounded > MAX_TYPE_COUNT
      ? `${optionLabels.get(type) ?? type} 单题型上限 ${MAX_TYPE_COUNT} 题，已从 ${rounded} 夹到 ${MAX_TYPE_COUNT}。出卷时引擎也会按 ${MAX_TYPE_COUNT} 题处理。`
      : ''
  props.config.counts = { ...(props.config.counts ?? {}), [type]: next }
}

function toggleType(type: AppType, checked: boolean) {
  const list = props.config.types
  const index = list.indexOf(type)
  if (checked && index < 0) list.push(type)
  if (!checked && index >= 0) list.splice(index, 1)
}

function setLevel(level: Level) {
  props.config.level = level
}

function toggleUnit(unitId: string, checked: boolean) {
  const list = props.config.unitIds
  const index = list.indexOf(unitId)
  if (checked && index < 0) list.push(unitId)
  if (!checked && index >= 0) list.splice(index, 1)
}

function toggleAll(checked: boolean) {
  props.config.unitIds = checked ? units.value.map((unit) => unit.unitId) : []
}
</script>

<template>
  <div class="panel">
    <section class="group">
      <h2>年级</h2>
      <label class="row">
        <input type="radio" name="grade" checked disabled />
        <span>三年级上册（成品范围）</span>
      </label>
      <p class="hint">三下及后续年级已暂停，本轮只做三上成品。</p>
    </section>

    <section class="group">
      <h2>
        单元
        <button class="link" type="button" @click="toggleAll(!allSelected)">
          {{ allSelected ? '清空' : '全选' }}
        </button>
      </h2>
      <label v-for="unit in units" :key="unit.unitId" class="row unit">
        <input
          type="checkbox"
          :checked="config.unitIds.includes(unit.unitId)"
          @change="toggleUnit(unit.unitId, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ unit.unitName }}</span>
        <em v-if="unit.unconfirmed" class="tag">推定</em>
      </label>
      <p v-if="config.unitIds.length === 0" class="hint">至少选择一个单元才能出题。</p>
      <p v-else class="hint">只列三上已建骨架包的 9 个单元。</p>
    </section>

    <section class="group">
      <h2>难度</h2>
      <div class="levels">
        <label v-for="item in LEVELS" :key="item.level" class="level">
          <input
            type="radio"
            name="level"
            :checked="config.level === item.level"
            @change="setLevel(item.level)"
          />
          <span>{{ item.label }}</span>
          <em>{{ item.hint }}</em>
        </label>
      </div>
      <p class="hint">
        计算类：L1 基础、L2 常规进位退位、L3 连续进位/末尾有 0/带括号三步。填空与应用题：L1 直接套用、L2 换算或两步、L3 反向求/多步判断。
      </p>
    </section>

    <section class="group">
      <h2>题型与题量</h2>
      <template v-for="option in visibleOptions" :key="option.type">
        <label class="row type-row">
          <input
            type="checkbox"
            :checked="config.types.includes(option.type) && availability[option.type].enabled"
            :disabled="!availability[option.type].enabled"
            @change="toggleType(option.type, ($event.target as HTMLInputElement).checked)"
          />
          <span :class="{ muted: !availability[option.type].enabled }">{{ option.label }}</span>
          <input
            type="number"
            class="count"
            min="0"
            :max="MAX_TYPE_COUNT"
            step="1"
            :value="countFor(option.type)"
            :disabled="!config.types.includes(option.type) || !availability[option.type].enabled"
            @input="setCount(option.type, ($event.target as HTMLInputElement).value)"
          />
          <em
            v-if="sourceLabel(option.type)"
            class="src"
            :class="availability[option.type].source"
          >
            {{ sourceLabel(option.type) }}
          </em>
        </label>
        <p
          v-if="availability[option.type].reason"
          class="type-reason"
          :class="{ off: !availability[option.type].enabled }"
        >
          {{ availability[option.type].reason }}
        </p>
        <p v-if="option.type === 'geom' && availability[option.type].enabled" class="hint">
          图形建议 30–50 题（约 5–9 页），单题型上限 {{ MAX_TYPE_COUNT }} 题。
        </p>
      </template>
      <p v-if="countNotice" class="type-reason warn">{{ countNotice }}</p>
      <p class="hint">勾选后填写题量；0 或留空表示不出该题型，单题型上限 {{ MAX_TYPE_COUNT }} 题。</p>
    </section>

    <section class="group">
      <h2>数量与版面</h2>
      <div class="row field readonly">
        <span>总题数</span>
        <strong>{{ totalCount }}</strong>
        <em>按题型题量自动汇总</em>
      </div>
      <div class="row field readonly">
        <span>预计页数</span>
        <strong>{{ estimatedPages }}</strong>
        <em>{{ (pageEstimate ?? 0) > 0 ? '已按排版结果回填' : '粗估，出卷后回填' }}</em>
      </div>
    </section>

    <section class="group">
      <h2>排版引擎</h2>
      <label class="stack">
        <span class="label">typst 路径</span>
        <input
          type="text"
          class="text"
          :value="config.typstPath"
          placeholder="留空自动探测 /opt/homebrew/bin/typst"
          @input="config.typstPath = ($event.target as HTMLInputElement).value"
        />
      </label>
      <div class="engine-row">
        <button class="small" :disabled="checking" @click="emit('checkTypst')">
          {{ checking ? '检测中…' : '检测' }}
        </button>
        <span v-if="typst" class="engine-ok">{{ typst.version }}</span>
        <span v-else-if="typstError" class="engine-bad">未找到</span>
      </div>
      <p v-if="typstError" class="engine-error">{{ typstError }}</p>
      <p v-else-if="typst" class="engine-path">{{ typst.path }}</p>
    </section>

    <p class="footnote">参数会自动保存，下次启动仍然生效。</p>
  </div>
</template>

<style scoped>
.panel {
  padding: 14px 16px 24px;
  font-size: 14px;
  color: #222;
}
.group {
  margin-bottom: 20px;
}
h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #000;
  border-bottom: 1px solid #dcdcdc;
  padding-bottom: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}
.row.unit span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
input[type='checkbox'],
input[type='radio'] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #000;
}
input:disabled {
  cursor: not-allowed;
}
.muted {
  color: #999;
}
.tag {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  font-style: normal;
  color: #888;
  white-space: nowrap;
}
.type-reason {
  margin: 0 0 6px 23px;
  font-size: 11px;
  line-height: 1.5;
  color: #666;
}
.src {
  margin-left: auto;
  font-size: 10px;
  font-style: normal;
  padding: 1px 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  color: #555;
  white-space: nowrap;
}
.src.skeleton {
  border-color: #4a7a4a;
  color: #2f5f2f;
}
.src.rule {
  border-color: #4a6f8a;
  color: #2f4f6a;
}
.src.legacy {
  border-color: #b08230;
  color: #7a5410;
}
.src.static {
  border-color: #999;
  color: #555;
}
.src.na {
  border-color: #9a5a5a;
  color: #8a3a3a;
}
.type-reason.off {
  color: #8a4b00;
}
.type-reason.warn {
  color: #8a3a3a;
}
.levels {
  display: flex;
  gap: 8px;
}
.level {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.level em {
  font-style: normal;
  font-size: 11px;
  color: #888;
}
.field {
  justify-content: space-between;
  cursor: default;
}
.field.readonly strong {
  font-size: 14px;
}
.field.readonly em {
  font-size: 11px;
  font-style: normal;
  color: #888;
}
.type-row .count {
  width: 58px;
  margin-left: auto;
  font: inherit;
  font-size: 12px;
  text-align: right;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 2px 6px;
  background: #fff;
}
.type-row .count:disabled {
  background: #f4f4f4;
  color: #aaa;
}
.field input[type='number'] {
  width: 72px;
  font: inherit;
  font-size: 13px;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 3px 6px;
  background: #fff;
}
.hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #888;
}
.link {
  font: inherit;
  font-size: 11px;
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
.stack {
  display: block;
  margin-bottom: 8px;
}
.label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #555;
}
.text {
  width: 100%;
  font: inherit;
  font-size: 12px;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 5px 7px;
  background: #fff;
}
.engine-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.small {
  font: inherit;
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid #999;
  border-radius: 4px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.small:hover:not(:disabled) {
  background: #f0f0f0;
}
.small:disabled {
  color: #999;
  border-color: #ccc;
  cursor: default;
}
.engine-ok {
  font-size: 11px;
  color: #333;
}
.engine-bad {
  font-size: 11px;
  color: #777;
}
.engine-error {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  background: #f4f4f4;
  border-left: 2px solid #666;
  padding: 6px 8px;
  max-height: 110px;
  overflow: auto;
}
.engine-path {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #999;
  word-break: break-all;
}
.footnote {
  margin: 8px 0 0;
  font-size: 11px;
  color: #aaa;
}
</style>
