<script setup lang="ts">
import { computed, ref } from 'vue'
import { CHINESE_SKILLS, CHINESE_THEMES } from './subjects'
import ChineseSyncPanel from './ChineseSyncPanel.vue'
import { READING_PAPER_SCORE, type ChineseSyncSelection, type ReadingPaperSelection } from '../chinese/doc.ts'
import type { ChineseLevel, ReadingSkillCode, ReadingTheme } from '../data/chinese/types.ts'

const emit = defineEmits<{
  generate: [
    payload:
      | { mode: 'reading'; selection: ReadingPaperSelection }
      | { mode: 'sync'; selection: ChineseSyncSelection }
      | { mode: 'full'; selection: ChineseSyncSelection },
  ]
}>()

const mode = ref<'sync' | 'full' | 'reading'>('sync')

const skills = ref<ReadingSkillCode[]>([])
const themes = ref<ReadingTheme[]>([])
const levels = ref<ChineseLevel[]>([])
const count = ref(3)

const LEVELS: { value: ChineseLevel; label: string }[] = [
  { value: 'A', label: '易' },
  { value: 'B', label: '中' },
  { value: 'C', label: '难' },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function toggleSkill(code: ReadingSkillCode) {
  skills.value = toggle(skills.value, code)
}

function toggleTheme(theme: ReadingTheme) {
  themes.value = toggle(themes.value, theme)
}

function toggleLevel(level: ChineseLevel) {
  levels.value = toggle(levels.value, level)
}

function changeCount(delta: number) {
  count.value = Math.min(20, Math.max(1, count.value + delta))
}

/** 直接输入篇数：回车或失焦时夹到 1–20，非法输入保留原值 */
function setCount(event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = Number.parseInt(input.value, 10)
  const next = Number.isNaN(parsed) ? count.value : Math.min(20, Math.max(1, parsed))
  count.value = next
  if (input.value !== String(next)) input.value = String(next)
}

const levelText = computed(() =>
  levels.value.length > 0 ? levels.value.map((level) => LEVELS.find((item) => item.value === level)!.label).join('/') : '混合',
)
const filterText = computed(() =>
  [
    skills.value.length > 0 ? skills.value.join('/') : '全部考点',
    themes.value.length > 0 ? themes.value.join('/') : '全部主题',
    `${levelText.value}难度`,
  ].join(' · '),
)
const totalScore = computed(() => count.value * READING_PAPER_SCORE)

function submit() {
  emit('generate', {
    mode: 'reading',
    selection: {
      skills: skills.value,
      themes: themes.value,
      levels: levels.value,
      count: count.value,
    },
  })
}

function onSync(selection: ChineseSyncSelection) {
  emit('generate', {
    mode: mode.value === 'full' ? 'full' : 'sync',
    selection,
  })
}
</script>

<template>
  <div class="params">
    <div class="tabs">
      <button :aria-pressed="mode === 'sync'" @click="mode = 'sync'">校内同步</button>
      <button :aria-pressed="mode === 'full'" @click="mode = 'full'">综合练习</button>
      <button :aria-pressed="mode === 'reading'" @click="mode = 'reading'">阅读专项</button>
    </div>

    <ChineseSyncPanel
      v-if="mode !== 'reading'"
      :key="mode"
      :mode="mode === 'full' ? 'full' : 'unit'"
      @generate="onSync"
    />

    <template v-else>
      <div class="params-scroll">
      <section>
        <h2>考点</h2>
        <div class="chip-grid">
          <button
            v-for="item in CHINESE_SKILLS"
            :key="item.code"
            class="chip"
            :aria-pressed="skills.includes(item.code)"
            @click="toggleSkill(item.code)"
          >
            <b>{{ item.code }}</b>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <p class="hint">不选就是全部考点；选了只出覆盖该考点的篇目。</p>
      </section>

      <section>
        <h2>主题</h2>
        <div class="chip-grid">
          <button
            v-for="theme in CHINESE_THEMES"
            :key="theme"
            class="chip"
            :aria-pressed="themes.includes(theme)"
            @click="toggleTheme(theme)"
          >
            <span>{{ theme }}</span>
          </button>
        </div>
        <p class="hint">不选就是全部主题。</p>
      </section>

      <section>
        <h2>难度</h2>
        <div class="seg">
          <button
            v-for="level in LEVELS"
            :key="level.value"
            :aria-pressed="levels.includes(level.value)"
            @click="toggleLevel(level.value)"
          >
            {{ level.label }}
          </button>
        </div>
        <p class="hint">可多选；不选或全选按混合难度出卷。</p>
      </section>

      <section>
        <h2>篇数</h2>
        <div class="count-row">
          <div class="stepper">
            <button aria-label="减少一篇" :disabled="count <= 1" @click="changeCount(-1)">−</button>
            <input
              class="count-input"
              type="number"
              min="1"
              max="20"
              step="1"
              inputmode="numeric"
              aria-label="篇数"
              :value="count"
              @change="setCount"
              @blur="setCount"
            />
            <button aria-label="增加一篇" :disabled="count >= 20" @click="changeCount(1)">+</button>
          </div>
          <span class="count-total">共 {{ totalScore }} 分</span>
        </div>
      </section>
    </div>

    <div class="foot">
      <div class="summary">{{ filterText }}</div>
      <button class="generate" @click="submit">生成阅读卷</button>
    </div>
    </template>
  </div>
</template>

<style scoped>
.params {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.tabs {
  flex: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 12px 16px 0;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
}
.tabs button {
  font: inherit;
  font-size: 13px;
  height: 32px;
  border: none;
  background: #fff;
  color: #555;
  cursor: pointer;
}
.tabs button + button {
  border-left: 1px solid #ccc;
}
.tabs button[aria-pressed='true'] {
  background: #111;
  color: #fff;
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
  margin-top: 24px;
}
h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #111;
}
.chip-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  white-space: nowrap;
  cursor: pointer;
}
.chip b {
  font-size: 11px;
  font-weight: 600;
  color: #777;
}
.chip[aria-pressed='true'] {
  border-color: #111;
  border-radius: 8px;
  font-weight: 600;
}
.chip[aria-pressed='true'] b {
  color: #111;
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
  font-size: 11px;
  line-height: 1.5;
  color: #777;
}
.count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 2px;
}
.stepper button {
  width: 30px;
  height: 30px;
  font: inherit;
  font-size: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.stepper button:disabled {
  color: #bbb;
  cursor: default;
}
.stepper input {
  width: 48px;
  height: 30px;
  padding: 0 4px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  font: inherit;
  font-size: 14px;
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
.count-total {
  font-size: 12px;
  color: #555;
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
}
</style>
