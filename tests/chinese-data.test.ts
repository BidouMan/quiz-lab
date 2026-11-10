import test from 'node:test'
import assert from 'node:assert/strict'
import { CHINESE_CURRICULUM_3A, CHINESE_TYPES, chineseUnits } from '../src/data/chinese/index.ts'

const lessons = chineseUnits.flatMap((unit) => unit.lessons)
const sum = (pick: (lesson: (typeof lessons)[number]) => number): number =>
  lessons.reduce((total, lesson) => total + pick(lesson), 0)

test('语文三上：8 单元 26 课，课次与编号唯一', () => {
  assert.equal(chineseUnits.length, 8)
  assert.equal(lessons.length, 26)
  const ids = new Set(lessons.map((lesson) => lesson.lessonId))
  assert.equal(ids.size, 26)
  const nos = lessons.map((lesson) => lesson.no).sort((a, b) => a - b)
  assert.deepEqual(nos, Array.from({ length: 26 }, (_, index) => index + 1))
})

test('语文三上：精读 19 课、略读 7 课', () => {
  assert.equal(lessons.filter((lesson) => lesson.kind === '精读').length, 19)
  assert.equal(lessons.filter((lesson) => lesson.kind === '略读').length, 7)
})

test('语文三上：略读课不出写字表', () => {
  for (const lesson of lessons) {
    if (lesson.kind === '略读') assert.equal(lesson.xiezi.length, 0)
  }
})

test('语文三上：所有字词古诗均为 verified，且带来源与拼音', () => {
  for (const unit of chineseUnits) {
    for (const lesson of unit.lessons) {
      for (const char of [...lesson.renzi, ...lesson.xiezi]) {
        assert.equal([...char.char].length, 1, `${lesson.lessonId} 单字异常：${char.char}`)
        assert.equal(char.status, 'verified', `${lesson.lessonId} ${char.char} 仍为 pending`)
        assert.ok(char.sources.length > 0, `${lesson.lessonId} ${char.char} 缺来源`)
        assert.ok(char.pinyin.length > 0, `${lesson.lessonId} ${char.char} 缺拼音`)
      }
      for (const word of lesson.words) {
        assert.equal(word.status, 'verified', `${lesson.lessonId} ${word.word} 仍为 pending`)
        assert.ok(word.sources.length > 0, `${lesson.lessonId} ${word.word} 缺来源`)
      }
      for (const poem of lesson.poems ?? []) {
        assert.equal(poem.status, 'verified', `${lesson.lessonId} ${poem.title} 仍为 pending`)
        assert.ok(poem.sources.length > 0, `${lesson.lessonId} ${poem.title} 缺来源`)
      }
    }
  }
})

test('语文三上：字表归属与数组一致', () => {
  for (const lesson of lessons) {
    for (const char of lesson.renzi) assert.equal(char.table, 'renzi')
    for (const char of lesson.xiezi) assert.equal(char.table, 'xiezi')
  }
})

test('语文三上：题型元数据覆盖 A/B/C 三档', () => {
  for (const type of CHINESE_TYPES) {
    for (const level of ['A', 'B', 'C'] as const) {
      assert.ok(type.counts[level] > 0, `${type.typeId} 缺 ${level} 档题量`)
    }
  }
})

test('语文三上：附录字表总量与教材标注一致', () => {
  // 识字表 276 条（含 4 个园地行 28 字），本数据只落课文行 248 条
  assert.equal(sum((lesson) => lesson.renzi.length), 248)
  // 写字表逐行清点 221 条（园地写字行 28 条单列在园地数据）
  assert.equal(sum((lesson) => lesson.xiezi.length), 221)
  // 词语表 250 词 = 课文词语 227 + 园地词语 23；另有第 3 课课文词语 2 条
  const lessonWords = sum((lesson) => lesson.words.filter((word) => word.kind === '词语表').length)
  const gardenWords = chineseUnits.reduce((total, unit) => total + (unit.garden?.words?.length ?? 0), 0)
  assert.equal(lessonWords + gardenWords, 250)
})

test('语文三上：识字表蓝色多音字 26 个且带说明', () => {
  const multi = lessons.flatMap((lesson) => lesson.renzi.filter((char) => char.multi))
  assert.equal(multi.length, 26)
  for (const char of multi) assert.ok(char.note?.includes('多音字'), `${char.char} 缺多音字说明`)
})

test('语文三上：七个语文园地，日积月累与词语表已核', () => {
  const gardens = chineseUnits.filter((unit) => unit.garden)
  assert.equal(gardens.length, 7)
  assert.equal(chineseUnits.find((unit) => unit.unitId === '3A-U5')?.garden, undefined)
  const poems = gardens.flatMap((unit) => unit.garden?.poems ?? [])
  const words = gardens.flatMap((unit) => unit.garden?.words ?? [])
  assert.equal(poems.length, 4)
  assert.equal(words.length, 23)
  for (const unit of gardens) assert.equal(unit.garden?.status, 'verified')
})

test('语文三上：古诗 10 首（课文 6 + 园地 4）', () => {
  const lessonPoems = lessons.flatMap((lesson) => lesson.poems ?? [])
  const gardenPoems = chineseUnits.flatMap((unit) => unit.garden?.poems ?? [])
  assert.equal(lessonPoems.length + gardenPoems.length, 10)
})

test('语文三上：习作与口语交际按教材目录落位', () => {
  const writing = chineseUnits.map((unit) => unit.writing?.label)
  assert.deepEqual(writing, [
    '习作：猜猜他是谁',
    '习作：写日记',
    '习作：续写故事',
    '习作：我来编童话',
    '习作：我们眼中的缤纷世界',
    '习作：这儿真美',
    '习作：我有一个想法',
    '习作：那次经历真难忘',
  ])
  const oral = chineseUnits.filter((unit) => unit.oral).map((unit) => unit.oral?.label)
  assert.deepEqual(oral, [
    '口语交际：我的暑假生活',
    '口语交际：名字里的故事',
    '口语交际：身边的“小事”',
    '口语交际：请教',
  ])
  assert.equal(CHINESE_CURRICULUM_3A.units[3].extra?.label, '快乐读书吧：在那奇妙的王国里')
})
