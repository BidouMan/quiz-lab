<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  CHINESE_PAPER_TYPE_IDS,
  CHINESE_PAPER_TYPE_META,
  chineseUnitInventory,
} from '../chinese/materials.ts'
import { chineseUnits } from '../data/chinese/curriculum.ts'
import type { ChineseSyncSelection } from '../chinese/doc.ts'
import type { ChinesePaperTypeId } from '../chinese/types.ts'
import type { ChineseLevel } from '../data/chinese/types.ts'

const emit = defineEmits<{ generate: [selection: ChineseSyncSelection] }>()

const props = withDefaults(defineProps<{ mode?: 'unit' | 'full' }>(), { mode: 'unit' })

const LEVELS: { value: ChineseLevel; label: string }[] = [
  { value: 'A', label: '易' },
  { value: 'B', label: '中' },
  { value: 'C', label: '难' },
]

const GROUP_ORDER = ['字词', '积累', '句子', '阅读', '习作', '卷面'] as const

const DEFAULT_COUNTS: Record<ChinesePaperTypeId, number> = {
  kanpinyin: 8,
  zhuyin: 6,
  duoyin: 4,
  xingjin: 4,
  cipu: 4,
  jinayi: 4,
  xuanzi: 2,
  'gushi-fill': 2,
  'gushi-dimo': 1,
  riji: 2,
  gaibing: 1,
  guanlian: 1,
  biaodian: 0,
  kuoxie: 0,
  fangxie: 0,
  reading: 1,
  writing: 1,
  lianmian: 0,
}

/** 综合卷：全册混合，基础题 + 阅读 + 习作一次配齐 */
const FULL_COUNTS: Record<ChinesePaperTypeId, number> = {
  kanpinyin: 10,
  zhuyin: 6,
  duoyin: 4,
  xingjin: 4,
  cipu: 4,
  jinayi: 4,
  xuanzi: 2,
  'gushi-fill': 3,
  'gushi-dimo': 1,
  riji: 2,
  gaibing: 2,
  guanlian: 2,
  biaodian: 1,
  kuoxie: 1,
  fangxie: 1,
  reading: 1,
  writing: 1,
  lianmian: 0,
}

const selectedUnits = ref<string[]>(chineseUnits.map((unit) => unit.unitId))
const counts = ref<Record<ChinesePaperTypeId, number>>({
  ...(props.mode === 'full' ? FULL_COUNTS : DEFAULT_COUNTS),
})
const levels = ref<ChineseLevel[]>([])
const includeAnswers = ref(true)

/** 随单元选择变化的可出数：教材题按单元收窄，句子/阅读/习作/卷面按全册 */
const inventory = computed(() => chineseUnitInventory(selectedUnits.value))

// 单元变化后，把超出可出数的题量收回到可出数，避免卷面出现空板块
watch(selectedUnits, () => {
  for (const typeId of CHINESE_PAPER_TYPE_IDS) {
    const available = inventory.value[typeId]
    if (counts.value[typeId] > available) counts.value[typeId] = available
  }
  // 古诗补全与默写共用同一批诗：两项合计不能超过本单元古诗数
  const totalPoems = inventory.value['gushi-fill']
  if (counts.value['gushi-fill'] + counts.value['gushi-dimo'] > totalPoems) {
    counts.value['gushi-dimo'] = Math.max(totalPoems - counts.value['gushi-fill'], 0)
    if (counts.value['gushi-fill'] + counts.value['gushi-dimo'] > totalPoems) {
      counts.value['gushi-fill'] = Math.max(totalPoems - counts.value['gushi-dimo'], 0)
    }
  }
})

const groups = computed(() =>
  GROUP_ORDER.map((group) => ({
    group,
    rows: CHINESE_PAPER_TYPE_IDS.filter(
      (typeId) =>
        typeId !== 'lianmian' && CHINESE_PAPER_TYPE_META[typeId].group === group,
    ).map((typeId) => ({
      typeId,
      meta: CHINESE_PAPER_TYPE_META[typeId],
      available: inventory.value[typeId],
    })),
  })).filter((item) => item.rows.length > 0),
)

const totalItems = computed(() =>
  CHINESE_PAPER_TYPE_IDS.reduce((sum, typeId) => sum + counts.value[typeId], 0),
)

function toggleUnit(unitId: string) {
  selectedUnits.value = selectedUnits.value.includes(unitId)
    ? selectedUnits.value.filter((item) => item !== unitId)
    : [...selectedUnits.value, unitId]
}

function selectAllUnits() {
  selectedUnits.value = chineseUnits.map((unit) => unit.unitId)
}

function clearUnits() {
  selectedUnits.value = []
}

function toggleLevel(level: ChineseLevel) {
  levels.value = levels.value.includes(level)
    ? levels.value.filter((item) => item !== level)
    : [...levels.value, level]
}

/** 当前题型可加到的上限；古诗补全/默写共用本单元古诗额度 */
function maxCount(typeId: ChinesePaperTypeId): number {
  let max = Math.max(inventory.value[typeId], 0)
  if (typeId === 'gushi-fill' || typeId === 'gushi-dimo') {
    const other = counts.value[typeId === 'gushi-fill' ? 'gushi-dimo' : 'gushi-fill']
    max = Math.min(max, Math.max(inventory.value['gushi-fill'] - other, 0))
  }
  return max
}

function changeCount(typeId: ChinesePaperTypeId, delta: number) {
  const max = maxCount(typeId)
  counts.value[typeId] = Math.min(Math.max(counts.value[typeId] + delta, 0), max)
}

function submit() {
  emit('generate', {
    unitIds: selectedUnits.value,
    levels: levels.value,
    includeAnswers: includeAnswers.value,
    sections: CHINESE_PAPER_TYPE_IDS.filter((typeId) => counts.value[typeId] > 0).map(
      (typeId) => ({
        typeId,
        count: counts.value[typeId],
        perItemScore: CHINESE_PAPER_TYPE_META[typeId].defaultPerItemScore,
      }),
    ),
  })
}
</script>

<template>
  <div class="sync">
    <div class="sync-scroll">
      <section v-if="mode === 'unit'">
        <div class="section-head">
          <h2>单元</h2>
          <div class="head-actions">
            <button class="mini" @click="selectAllUnits">全册</button>
            <button class="mini" @click="clearUnits">清空</button>
          </div>
        </div>
        <div class="chip-grid">
          <button
            v-for="unit in chineseUnits"
            :key="unit.unitId"
            class="chip"
            :aria-pressed="selectedUnits.includes(unit.unitId)"
            @click="toggleUnit(unit.unitId)"
          >
            {{ unit.unitName }}
          </button>
        </div>
        <p class="hint">只收窄教材字词、古诗、园地题；句子和阅读为全册通用题。</p>
      </section>

      <section v-else>
        <h2>范围</h2>
        <p class="hint full-hint">全册混合：字词积累 + 句子 + 课外阅读 + 习作，可直接当一份完整练习。</p>
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

      <section v-for="group in groups" :key="group.group">
        <h2>{{ group.group }}</h2>
        <div class="type-list">
          <div v-for="row in group.rows" :key="row.typeId" class="type-row">
            <div class="type-name">
              <b>{{ row.meta.label }}</b>
              <small>库存 {{ row.available }}</small>
            </div>
            <div class="stepper">
              <button
                :aria-label="`减少${row.meta.label}`"
                :disabled="counts[row.typeId] <= 0"
                @click="changeCount(row.typeId, -1)"
              >
                −
              </button>
              <b>{{ counts[row.typeId] }}</b>
              <button
                :aria-label="`增加${row.meta.label}`"
                :disabled="counts[row.typeId] >= maxCount(row.typeId)"
                @click="changeCount(row.typeId, 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <label class="check">
          <input v-model="includeAnswers" type="checkbox" />
          <span>附参考答案</span>
        </label>
      </section>
    </div>

    <div class="foot">
      <div class="summary">共 {{ totalItems }} 题</div>
      <button
        class="generate"
        :disabled="selectedUnits.length === 0 || totalItems === 0"
        @click="submit"
      >
        生成{{ mode === 'full' ? '综合卷' : '同步卷' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sync {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.sync-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 8px;
}
section {
  flex: none;
}
section + section {
  margin-top: 22px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #111;
}
.head-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.mini {
  font: inherit;
  font-size: 11px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  background: #fff;
  color: #333;
  cursor: pointer;
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
.chip[aria-pressed='true'] {
  border-color: #111;
  border-radius: 8px;
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
.full-hint {
  margin-top: 0;
  font-size: 12px;
  color: #555;
}
.type-list {
  border-top: 1px solid #eee;
}
.type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid #f0f0f0;
}
.type-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.type-name b {
  font-size: 12px;
  font-weight: 600;
  color: #111;
}
.type-name small {
  font-size: 10px;
  color: #999;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}
.stepper button {
  width: 26px;
  height: 26px;
  font: inherit;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 5px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.stepper button:disabled {
  color: #ccc;
  cursor: default;
}
.stepper b {
  min-width: 28px;
  text-align: center;
  font-size: 13px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
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
.generate:disabled {
  background: #bbb;
  border-color: #bbb;
  cursor: default;
}
</style>
