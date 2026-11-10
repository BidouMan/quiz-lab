<script setup lang="ts">
import { computed, ref } from 'vue'
import { panelUnits, typeAvailability } from './paperBuilder'
import { LEVEL_HELP, LEVEL_LABELS, PRESETS, estimateMinutes, matchesPreset, presetTotal, type PaperLevel, type Preset } from './presets'
import { TYPE_ORDER, typeLabel } from './typstData'
import {
  clampTypeCount,
  PRACTICE_DEFAULT_COUNTS,
  type AppConfig,
  type AppType,
  type TemplateInfo,
} from './types'
import { readableAvailabilityReason } from './wording'

const props = defineProps<{
  config: AppConfig
  template: TemplateInfo | null
  pageEstimate: number
}>()

const emit = defineEmits<{
  generate: []
  touch: []
}>()

const GROUPS: { name: string; types: AppType[] }[] = [
  { name: '计算题', types: ['kousuan', 'chushi', 'tuoshi', 'jianbian'] },
  { name: '填一填、选一选', types: ['tiankong', 'compare', 'judge', 'choice'] },
  { name: '综合应用', types: ['geom', 'lieshi', 'word', 'advanced'] },
]

const units = panelUnits()
const selectedIds = computed(() => new Set(props.config.unitIds))

/** 折叠状态只在本次运行内保留：重启后回到默认展开，避免把设置藏起来 */
const sectionOpen = ref({ units: true, types: true })

function toggleSection(key: 'units' | 'types') {
  sectionOpen.value = { ...sectionOpen.value, [key]: !sectionOpen.value[key] }
}

const availability = computed(() => typeAvailability(props.config, props.template))
const activePreset = computed(() =>
  matchesPreset(props.config.level as PaperLevel, props.config.types, props.config.counts ?? {}),
)
const fromPreset = ref<Preset | null>(null)

const selectedTypes = computed(() =>
  GROUPS.flatMap((group) => group.types)
    .filter((type) => props.config.types.includes(type) && (props.config.counts?.[type] ?? 0) > 0)
    .map((type) => ({
      type,
      label: typeLabel(type),
      count: props.config.counts?.[type] ?? 0,
      available: availability.value[type]?.enabled ?? false,
      reason: readableAvailabilityReason(availability.value[type]?.reason ?? ''),
    })),
)

const total = computed(() =>
  TYPE_ORDER.reduce(
    (sum, type) => sum + (props.config.types.includes(type) ? (props.config.counts?.[type] ?? 0) : 0),
    0,
  ),
)

const minutes = computed(() => estimateMinutes(props.config.counts ?? {}))

const pages = computed(() => {
  if (props.pageEstimate > 0) return props.pageEstimate
  return Math.max(1, Math.round(total.value / 12))
})

const activeDesc = computed(() => activePreset.value?.desc ?? '按自己的需要搭配题型')
const customLabel = computed(() => `自定义 · ${total.value} 题`)

function defaultCount(type: AppType): number {
  return PRACTICE_DEFAULT_COUNTS[type] || 4
}

/** 弹层里显示的题量：已勾选显示当前题量，未勾选显示默认题量 */
function itemCount(type: AppType): number {
  return draft.value.has(type) ? (props.config.counts?.[type] ?? defaultCount(type)) : defaultCount(type)
}

function toggleUnit(unitId: string) {
  const list = props.config.unitIds.slice()
  const index = list.indexOf(unitId)
  if (index >= 0) list.splice(index, 1)
  else list.push(unitId)
  props.config.unitIds = list
  emit('touch')
}

function setLevel(level: PaperLevel) {
  props.config.level = level
  emit('touch')
}

function applyPreset(preset: Preset) {
  props.config.level = preset.level
  props.config.types = Object.keys(preset.values) as AppType[]
  props.config.counts = { ...preset.values }
  props.config.count = presetTotal(preset)
  fromPreset.value = preset
  emit('touch')
}

function restorePreset() {
  if (!fromPreset.value) return
  applyPreset(fromPreset.value)
}

function changeCount(type: AppType, delta: number) {
  const current = props.config.counts?.[type] ?? 0
  // 题量下限为 1：移除题型只能回到弹层取消勾选，减号不能把行减没
  const next = Math.max(1, clampTypeCount(current + delta))
  props.config.counts = { ...(props.config.counts ?? {}), [type]: next }
  props.config.count = TYPE_ORDER.reduce((sum, item) => sum + (props.config.counts?.[item] ?? 0), 0)
  emit('touch')
}

/** 直接输入题量：回车或失焦时夹到 1–200，非法输入保留原值 */
function setCount(type: AppType, event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = Number.parseInt(input.value, 10)
  const current = props.config.counts?.[type] ?? 0
  const next = Number.isNaN(parsed) ? current : Math.max(1, clampTypeCount(parsed))
  props.config.counts = { ...(props.config.counts ?? {}), [type]: next }
  props.config.count = TYPE_ORDER.reduce((sum, item) => sum + (props.config.counts?.[item] ?? 0), 0)
  emit('touch')
  if (input.value !== String(next)) input.value = String(next)
}

const panelOpen = ref(false)
const draft = ref<Set<AppType>>(new Set())
const groupOpen = ref<Record<string, boolean>>(
  Object.fromEntries(GROUPS.map((group) => [group.name, true])),
)

function openAdd() {
  draft.value = new Set(
    (Object.keys(props.config.counts ?? {}) as AppType[]).filter(
      (type) => (props.config.counts?.[type] ?? 0) > 0,
    ),
  )
  groupOpen.value = Object.fromEntries(GROUPS.map((group) => [group.name, true]))
  panelOpen.value = true
}

function closeAdd(commit: boolean) {
  if (commit) {
    const types = GROUPS.flatMap((group) => group.types).filter((type) => draft.value.has(type))
    const counts = { ...(props.config.counts ?? {}) }
    for (const type of TYPE_ORDER) {
      if (draft.value.has(type)) {
        if ((counts[type] ?? 0) <= 0) counts[type] = defaultCount(type)
      } else {
        counts[type] = 0
      }
    }
    props.config.types = types
    props.config.counts = counts
    props.config.count = TYPE_ORDER.reduce((sum, type) => sum + (counts[type] ?? 0), 0)
    emit('touch')
  }
  panelOpen.value = false
}

function toggleDraft(type: AppType) {
  if (!availability.value[type]?.enabled) return
  const next = new Set(draft.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  draft.value = next
}
</script>

<template>
  <div class="params">
    <div class="params-scroll">
      <section>
        <h2 :class="{ 'head-collapsed': !sectionOpen.units }">
          <button
            class="sec-toggle"
            :aria-expanded="sectionOpen.units"
            aria-controls="unit-body"
            @click="toggleSection('units')"
          >
            <span>单元选择</span>
            <svg class="caret" :class="{ collapsed: !sectionOpen.units }" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 4.5 6 8 9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
        </h2>
        <div v-show="sectionOpen.units" id="unit-body" class="unit-grid">
          <button
            v-for="unit in units"
            :key="unit.unitId"
            class="unit"
            :aria-pressed="selectedIds.has(unit.unitId)"
            @click="toggleUnit(unit.unitId)"
          >
            {{ unit.unitName }}
          </button>
        </div>
      </section>

      <section>
        <h2 :class="{ 'head-collapsed': !sectionOpen.types }">
          <button
            class="sec-toggle"
            :aria-expanded="sectionOpen.types"
            aria-controls="type-body"
            @click="toggleSection('types')"
          >
            <span>题型设置</span>
            <svg class="caret" :class="{ collapsed: !sectionOpen.types }" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 4.5 6 8 9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
        </h2>
        <div v-show="sectionOpen.types" id="type-body">
          <div class="seg">
          <button
            v-for="level in (['L1', 'L2', 'L3'] as PaperLevel[])"
            :key="level"
            :aria-pressed="config.level === level"
            @click="setLevel(level)"
          >
            {{ LEVEL_LABELS[level] }}
          </button>
        </div>
        <p class="hint">{{ LEVEL_HELP[config.level as PaperLevel] }}</p>

        <div class="presets">
          <button
            v-for="preset in PRESETS"
            :key="preset.id"
            class="preset"
            :aria-pressed="activePreset?.id === preset.id"
            @click="applyPreset(preset)"
          >
            <b>{{ preset.name }}</b>
            <span>{{ presetTotal(preset) }} 题</span>
          </button>
        </div>
        <p class="preset-desc">{{ activeDesc }}</p>
        <div v-if="!activePreset" class="custom-line">
          <span>{{ customLabel }}</span>
          <template v-if="fromPreset">
            <span class="sep">·</span>
            <span>改自{{ fromPreset.name }}</span>
            <span class="sep">·</span>
            <button class="text-btn" @click="restorePreset">恢复默认</button>
          </template>
        </div>

        <div v-if="selectedTypes.length > 0" class="type-list">
          <div v-for="row in selectedTypes" :key="row.type" class="type-row">
            <div class="type-line">
              <span class="type-name">{{ row.label }}</span>
              <div class="stepper">
                <button :aria-label="`减少${row.label}题量`" :disabled="row.count <= 1" @click="changeCount(row.type, -1)">−</button>
                <input
                  class="count-input"
                  type="number"
                  min="1"
                  max="200"
                  step="1"
                  inputmode="numeric"
                  :aria-label="`${row.label}题量`"
                  :value="row.count"
                  @change="setCount(row.type, $event)"
                  @blur="setCount(row.type, $event)"
                />
                <button :aria-label="`增加${row.label}题量`" @click="changeCount(row.type, 1)">+</button>
              </div>
            </div>
            <p v-if="!row.available" class="type-warn">{{ row.reason || '当前条件下出不了这类题' }}</p>
          </div>
        </div>
        <p v-else class="empty-types">还没有选题型，先添加一项。</p>

        <button class="add-main" @click="openAdd">＋ 添加题型</button>
        </div>
      </section>
    </div>

    <div class="foot">
      <div class="summary">{{ total }} 题 · {{ minutes }} 分钟 · {{ pages }} 页</div>
      <button class="generate" :disabled="total === 0" @click="emit('generate')">生成练习卷</button>
    </div>

    <Teleport to="body">
      <div v-if="panelOpen" class="add-mask" @click.self="closeAdd(false)">
        <div class="add-modal" role="dialog" aria-modal="true" aria-label="添加题型">
          <div class="add-head">
            <h2>添加题型</h2>
            <button class="x" aria-label="关闭" @click="closeAdd(false)">×</button>
          </div>
          <div class="add-body">
            <div v-for="group in GROUPS" :key="group.name" class="group">
              <button class="group-head" @click="groupOpen[group.name] = !groupOpen[group.name]">
                <span class="caret" :class="{ collapsed: !groupOpen[group.name] }">▾</span>
                <h3>{{ group.name }}</h3>
              </button>
              <div v-show="groupOpen[group.name]" class="group-items">
                <div
                  v-for="type in group.types"
                  :key="type"
                  class="add-item"
                  :class="{ disabled: !availability[type]?.enabled, on: draft.has(type) }"
                  role="checkbox"
                  :aria-checked="draft.has(type)"
                  :aria-disabled="!availability[type]?.enabled"
                  @click="toggleDraft(type)"
                >
                  <span class="check" :class="{ on: draft.has(type) }" />
                  <span class="add-meta">
                    <b>{{ typeLabel(type) }}</b>
                  </span>
                  <span v-if="!availability[type]?.enabled" class="reason">
                    {{ readableAvailabilityReason(availability[type]?.reason ?? '') }}
                  </span>
                  <span v-else class="def">{{ itemCount(type) }} 题</span>
                </div>
              </div>
            </div>
          </div>
          <div class="add-foot">
            <span>已选 {{ draft.size }} 项</span>
            <span class="spacer" />
            <button class="secondary" @click="closeAdd(false)">取消</button>
            <button class="primary" @click="closeAdd(true)">完成</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.params {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.params-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 8px;
}
section {
  flex: none;
}
section + section {
  margin-top: 28px;
}
h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #111;
}
h2.head-collapsed {
  margin-bottom: 0;
}
.sec-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: #111;
  cursor: pointer;
  text-align: left;
}
.sec-toggle .caret {
  width: 12px;
  height: 12px;
  flex: none;
  color: #555;
  transform-origin: 50% 50%;
  transition: transform 0.15s ease;
}
.sec-toggle:hover .caret {
  color: #111;
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
.text-btn:hover {
  color: #111;
}
.unit-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.unit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: inherit;
  font-size: 13px;
  width: 100%;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.unit[aria-pressed='true'] {
  background: #fff;
  border-color: #111;
  border-radius: 8px;
  color: #111;
  font-weight: 600;
}
.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
}
.seg button {
  font: inherit;
  font-size: 13px;
  height: 32px;
  border: none;
  background: #fff;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}
.seg button + button {
  border-left: 1px solid #ccc;
}
.seg button[aria-pressed='true'] {
  background: #111;
  color: #fff;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #666;
  white-space: nowrap;
}
.presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 6px 4px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font: inherit;
}
.preset b {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.preset span {
  margin-top: 2px;
  font-size: 11px;
  color: #777;
  white-space: nowrap;
}
.preset[aria-pressed='true'] {
  border-color: #111;
}
.preset-desc {
  margin: 8px 0 0;
  font-size: 11px;
  color: #777;
  white-space: nowrap;
}
.custom-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #555;
  white-space: nowrap;
}
.custom-line .sep {
  color: #aaa;
}
.type-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.type-row {
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}
.type-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.type-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.stepper button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  color: #111;
  cursor: pointer;
}
.stepper button:disabled {
  color: #bbb;
  border-color: #eee;
  cursor: default;
}
.stepper input {
  width: 44px;
  height: 24px;
  padding: 0 3px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  color: #111;
  font: inherit;
  font-size: 13px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
  appearance: textfield;
}
.stepper input::-webkit-outer-spin-button,
.stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.stepper input:focus {
  outline: none;
  border-color: #111;
}
.type-warn {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: #a15c00;
  white-space: normal;
}
.empty-types {
  margin: 14px 0 0;
  font-size: 12px;
  color: #888;
}
.add-main {
  width: 100%;
  height: 32px;
  margin-top: 10px;
  border: 1px dashed #bbb;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.add-main:hover {
  border-color: #111;
}
.foot {
  flex: none;
  padding: 12px 20px 16px;
  border-top: 1px solid #e3e3e3;
  background: #fff;
}
.summary {
  text-align: center;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
.generate {
  width: 100%;
  height: 36px;
  margin-top: 8px;
  border: 1px solid #111;
  border-radius: 6px;
  background: #111;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.generate:disabled {
  background: #aaa;
  border-color: #aaa;
  cursor: default;
}
.add-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  padding: 16px;
}
.add-modal {
  display: flex;
  flex-direction: column;
  width: 520px;
  max-height: calc(100vh - 64px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
}
.add-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eee;
}
.add-head h2 {
  margin: 0;
  font-size: 16px;
}
.add-head .x {
  border: none;
  background: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
}
.add-body {
  flex: 1;
  overflow: auto;
  padding: 4px 16px 12px;
}
.group {
  margin-top: 8px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 2px;
  border: none;
  border-bottom: 1px solid #eee;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.group-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #111;
}
.caret {
  font-size: 11px;
  color: #777;
}
.caret.collapsed {
  transform: rotate(-90deg);
}
.group-items {
  padding: 4px 0;
}
.add-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.add-item:hover {
  background: #f7f7f7;
}
.add-item.disabled {
  cursor: default;
  color: #999;
}
.add-item.disabled:hover {
  background: none;
}
.check {
  flex: none;
  width: 16px;
  height: 16px;
  border: 1px solid #bbb;
  border-radius: 4px;
}
.check.on {
  background: #111;
  border-color: #111;
  position: relative;
}
.check.on::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.add-meta {
  flex: 1;
  min-width: 0;
}
.add-meta b {
  font-size: 13px;
  font-weight: 600;
}
.reason {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 11px;
  color: #a15c00;
  white-space: normal;
  line-height: 1.4;
}
.add-item.disabled .reason {
  color: #a15c00;
}
.def {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}
.add-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: #555;
}
.add-foot .spacer {
  flex: 1;
}
.secondary,
.primary {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: pointer;
}
.secondary {
  border: 1px solid #ccc;
  background: #fff;
  color: #111;
}
.primary {
  border: 1px solid #111;
  background: #111;
  color: #fff;
}
</style>
