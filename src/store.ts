import { computed, reactive, ref, watch } from 'vue'
import { QUESTIONS, UNITS } from './data/questions'
import type { GradeSemester, PaperParams, Question, QuestionType } from './types'

export const params = reactive<PaperParams>({
  grade: '3A',
  unitIds: [],
  types: ['kousuan', 'chushi', 'tuoshi'],
  count: 20,
  pages: 1,
  withAnswers: true,
  title: '数学每日一练',
})

/** 生成种子：P0 题库为静态样例，点「生成」旋转取题顺序以产生可见变化 */
export const seed = ref(0)
export function regenerate() {
  seed.value++
}

/** 当前年级的单元列表 */
export const currentUnits = computed(() => UNITS.filter((u) => u.grade === params.grade))

/** 切换年级时重置单元选择为该年级全部 */
watch(
  () => params.grade,
  (g: GradeSemester) => {
    params.unitIds = UNITS.filter((u) => u.grade === g).map((u) => u.id)
  },
  { immediate: true },
)

function toggleIn<T>(arr: T[], v: T, on: boolean) {
  const i = arr.indexOf(v)
  if (on && i < 0) arr.push(v)
  if (!on && i >= 0) arr.splice(i, 1)
}

export function toggleUnit(id: string, on: boolean) {
  toggleIn(params.unitIds, id, on)
}

export function toggleType(t: QuestionType, on: boolean) {
  toggleIn(params.types, t, on)
}

/** 按当前参数筛选样例题（静态题库，容量有限，循环取样补足题量；seed 旋转起点） */
export const paperQuestions = computed<Question[]>(() => {
  const pool = QUESTIONS.filter(
    (q) =>
      q.grade === params.grade &&
      params.unitIds.includes(q.unitId) &&
      params.types.includes(q.type),
  )
  if (pool.length === 0) return []
  const n = Math.min(Math.max(Math.round(params.count) || 0, 1), 100)
  const offset = seed.value % pool.length
  const out: Question[] = []
  for (let i = 0; i < n; i++) out.push(pool[(i + offset) % pool.length])
  return out
})
