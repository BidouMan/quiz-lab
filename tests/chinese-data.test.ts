import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHINESE_CURRICULUM_3A,
  CHINESE_TYPES,
  chineseUnits,
  countVerified,
} from '../src/data/chinese/index.ts'

test('语文三上：8 单元 26 课，课次与编号唯一', () => {
  assert.equal(chineseUnits.length, 8)
  const lessons = chineseUnits.flatMap((u) => u.lessons)
  assert.equal(lessons.length, 26)
  const ids = new Set(lessons.map((l) => l.lessonId))
  assert.equal(ids.size, 26)
  const nos = lessons.map((l) => l.no).sort((a, b) => a - b)
  assert.deepEqual(nos, Array.from({ length: 26 }, (_, i) => i + 1))
})

test('语文三上：精读 19 课、略读 7 课', () => {
  const lessons = chineseUnits.flatMap((u) => u.lessons)
  assert.equal(lessons.filter((l) => l.kind === '精读').length, 19)
  assert.equal(lessons.filter((l) => l.kind === '略读').length, 7)
})

test('语文三上：略读课不出写字表', () => {
  for (const lesson of chineseUnits.flatMap((u) => u.lessons)) {
    if (lesson.kind === '略读') assert.equal(lesson.xiezi.length, 0)
  }
})

test('语文三上：可出题数据集只允许 verified，且每条都有来源与拼音', () => {
  for (const unit of chineseUnits) {
    for (const lesson of unit.lessons) {
      for (const c of [...lesson.renzi, ...lesson.xiezi]) {
        assert.ok(c.char.length === 1, `${lesson.lessonId} 单字异常：${c.char}`)
        assert.equal(c.status, 'verified', `${lesson.lessonId} ${c.char} 仍为 pending`)
        assert.ok(c.sources.length > 0, `${lesson.lessonId} ${c.char} 缺来源`)
        assert.ok(c.pinyin.length > 0, `${lesson.lessonId} ${c.char} 缺拼音`)
      }
      for (const w of lesson.words) {
        assert.equal(w.status, 'verified', `${lesson.lessonId} ${w.word} 仍为 pending`)
        assert.ok(w.sources.length > 0, `${lesson.lessonId} ${w.word} 缺来源`)
      }
      for (const poem of lesson.poems ?? []) {
        assert.equal(poem.status, 'verified', `${lesson.lessonId} ${poem.title} 仍为 pending`)
        assert.ok(poem.sources.length > 0, `${lesson.lessonId} ${poem.title} 缺来源`)
      }
    }
  }
})

test('语文三上：字表归属与数组一致', () => {
  for (const unit of chineseUnits) {
    for (const lesson of unit.lessons) {
      for (const c of lesson.renzi) assert.equal(c.table, 'renzi')
      for (const c of lesson.xiezi) assert.equal(c.table, 'xiezi')
    }
  }
})

test('语文三上：题型元数据覆盖 A/B/C 三档', () => {
  for (const type of CHINESE_TYPES) {
    for (const level of ['A', 'B', 'C'] as const) {
      assert.ok(type.counts[level] > 0, `${type.typeId} 缺 ${level} 档题量`)
    }
  }
})

test('语文三上：第 1–2 单元已核实素材可出题', () => {
  const u1 = countVerified(chineseUnits[0])
  const u2 = countVerified(chineseUnits[1])
  assert.equal(u1.xiezi, 23)
  assert.equal(u1.renzi, 15)
  assert.ok(u1.words >= 12)
  assert.equal(u2.xiezi, 11)
  // 1 条词语（钥匙）+ 3 首古诗
  assert.equal(u2.words, 4)
  assert.equal(CHINESE_CURRICULUM_3A.units[1].lessons[0].poems?.length, 3)
})
