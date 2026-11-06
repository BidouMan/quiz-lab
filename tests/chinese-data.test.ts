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

test('语文三上：每条已核实字词都有来源与拼音', () => {
  for (const unit of chineseUnits) {
    for (const lesson of unit.lessons) {
      for (const c of [...lesson.renzi, ...lesson.xiezi]) {
        assert.ok(c.char.length === 1, `${lesson.lessonId} 单字异常：${c.char}`)
        assert.ok(c.sources.length > 0, `${lesson.lessonId} ${c.char} 缺来源`)
        if (c.status === 'verified') {
          assert.ok(c.pinyin.length > 0, `${lesson.lessonId} ${c.char} 已核实但没有拼音`)
        } else {
          assert.ok(c.note, `${lesson.lessonId} ${c.char} 待核实但没写原因`)
        }
      }
      for (const w of lesson.words) {
        assert.ok(w.sources.length > 0, `${lesson.lessonId} ${w.word} 缺来源`)
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
  assert.ok(u2.words >= 3)
  assert.equal(CHINESE_CURRICULUM_3A.units[1].lessons[0].poems?.length, 3)
})
