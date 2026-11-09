import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJob,
  formatJobTime,
  itemBucket,
  jobIdFromDate,
  jobStatusLabel,
  latestJob,
  localIsoString,
  parseItems,
  parseJob,
  parseSources,
  sourceClosingLabel,
  summarizeCatalog,
  validateJobDraft,
  type CatalogSnapshot,
} from '../src/app/catalog.ts'

test('来源解析：缺失与损坏文件返回空名单，不抛错', () => {
  assert.deepEqual(parseSources(null), [])
  assert.deepEqual(parseSources(''), [])
  assert.deepEqual(parseSources('{bad json'), [])
  assert.deepEqual(parseSources('{"sources": "not array"}'), [])
  assert.deepEqual(parseSources('{}'), [])
})

test('来源解析：兼容对象与数组两种写法，缺字段按默认值补齐', () => {
  const raw = JSON.stringify({
    sources: [
      { id: 'chinafable', name: '中国寓言网', status: 'pending', remainingPages: 193 },
      { id: 'gutenberg-zh', status: 'PENDING' },
      { name: '无 id 条目' },
    ],
  })
  const sources = parseSources(raw)
  assert.equal(sources.length, 2)
  assert.deepEqual(sources[0], {
    id: 'chinafable',
    name: '中国寓言网',
    status: 'pending',
    remainingPages: 193,
    note: '',
  })
  assert.equal(sources[1].name, 'gutenberg-zh')
  assert.equal(sources[1].status, 'pending')
  assert.equal(sources[1].remainingPages, null)

  const asArray = parseSources(JSON.stringify([{ id: 'a', name: 'A' }]))
  assert.equal(asArray.length, 1)
})

test('结账状态文案：已穷尽 / 还有 N 页 / 不可用 / 待扫描', () => {
  const base = { id: 'x', name: 'X', status: 'pending', remainingPages: null, note: '' }
  assert.equal(sourceClosingLabel({ ...base, status: 'unavailable' }), '不可用')
  assert.equal(sourceClosingLabel({ ...base, status: 'done' }), '已穷尽')
  assert.equal(sourceClosingLabel({ ...base, remainingPages: 0 }), '已穷尽')
  assert.equal(sourceClosingLabel({ ...base, remainingPages: 193 }), '还有 193 页')
  assert.equal(sourceClosingLabel(base), '待扫描')
})

test('items 解析：坏行只计数，不影响其它行', () => {
  const raw = [
    '{"seq":"RD-1","sourceId":"a","title":"一","status":"imported"}',
    '',
    'oops',
    '{"seq":"RD-2","sourceId":"a","title":"二","status":"no_answer"}',
    '[1,2]',
  ].join('\n')
  const { items, badLines } = parseItems(raw)
  assert.equal(items.length, 2)
  assert.equal(badLines, 2)
  assert.equal(itemBucket(items[1].status), 'no-answer')
})

test('台账汇总：四个状态计数、各来源收录数、最近任务单', () => {
  const snapshot: CatalogSnapshot = {
    dir: '/repo/data/reading-catalog',
    sourcesRaw: JSON.stringify({
      sources: [
        { id: 'chinafable', name: '中国寓言网', status: 'pending', remainingPages: 193 },
        { id: 'gutenberg-zh', name: '古登堡', status: 'pending', remainingPages: null },
        { id: 'pep', name: '人教样章', status: 'unavailable' },
      ],
    }),
    itemsRaw: [
      '{"seq":"RD-1","sourceId":"chinafable","status":"imported"}',
      '{"seq":"RD-2","sourceId":"chinafable","status":"imported"}',
      '{"seq":"RD-3","sourceId":"gutenberg-zh","status":"rejected"}',
      '{"seq":"RD-4","sourceId":"chinafable","status":"no-answer"}',
      '{"seq":"RD-5","sourceId":"chinafable","status":"pending"}',
      'broken',
    ].join('\n'),
    jobs: [
      {
        name: '20261107-093000.job.json',
        raw: JSON.stringify({ id: '20261107-093000', createdAt: '2026-11-07T09:30:00+08:00', status: 'done', targetCount: 10 }),
      },
      {
        name: '20261107-153012.job.json',
        raw: JSON.stringify({ id: '20261107-153012', createdAt: '2026-11-07T15:30:12+08:00', status: 'pending', targetCount: 20 }),
      },
      { name: 'bad.job.json', raw: '{not json' },
    ],
    errors: [],
  }

  const board = summarizeCatalog(snapshot)
  assert.deepEqual(board.stats, {
    imported: 2,
    pending: 1,
    noAnswer: 1,
    rejected: 1,
    split: 0,
    needsSplit: 0,
    total: 5,
    badLines: 1,
  })
  assert.equal(board.rows.length, 3)
  assert.equal(board.rows[0].imported, 2)
  assert.equal(board.rows[0].closing, '还有 193 页')
  assert.equal(board.rows[1].closing, '待扫描')
  assert.equal(board.rows[2].closing, '不可用')
  assert.equal(board.latestJob?.id, '20261107-153012')
  assert.equal(board.hasData, true)

  // 空快照不白屏
  const empty = summarizeCatalog(null)
  assert.equal(empty.hasData, false)
  assert.equal(empty.latestJob, null)
  assert.equal(empty.stats.total, 0)
})

test('任务单：编号取本地时间，字段按约定落库', () => {
  const date = new Date(2026, 10, 7, 15, 30, 12)
  assert.equal(jobIdFromDate(date), '20261107-153012')
  assert.match(localIsoString(date), /^2026-11-07T15:30:12[+-]\d{2}:\d{2}$/)

  const job = buildJob(
    {
      targetCount: 40,
      sources: ['chinafable', ' chinafable ', 'gutenberg-zh', ''],
      wordMin: 300,
      wordMax: 500,
      requireAnswer: true,
      note: '  优先寓言  ',
    },
    date,
  )
  assert.deepEqual(job, {
    id: '20261107-153012',
    createdAt: localIsoString(date),
    targetCount: 40,
    sources: ['chinafable', 'gutenberg-zh'],
    wordMin: 300,
    wordMax: 500,
    requireAnswer: true,
    note: '优先寓言',
    status: 'pending',
  })
})

test('任务单：越界值被钳制，字数上限不小于下限', () => {
  const job = buildJob({
    targetCount: 999,
    sources: [],
    wordMin: 1200,
    wordMax: 200,
    requireAnswer: false,
    note: 'x'.repeat(300),
  })
  assert.equal(job.targetCount, 300)
  assert.equal(job.wordMin, 1200)
  assert.equal(job.wordMax, 1200)
  assert.equal(job.note.length, 200)

  const fallback = buildJob({
    targetCount: Number.NaN,
    sources: [],
    wordMin: Number.NaN,
    wordMax: Number.NaN,
    requireAnswer: false,
    note: '',
  })
  assert.equal(fallback.targetCount, 20)
  assert.equal(fallback.wordMin, 300)
  assert.equal(fallback.wordMax, 500)
})

test('生成前校验：空来源、越界篇数、反向字数区间都要拦下', () => {
  const ok = { targetCount: 20, sources: ['a'], wordMin: 300, wordMax: 500, requireAnswer: false, note: '' }
  assert.equal(validateJobDraft(ok), '')
  assert.match(validateJobDraft({ ...ok, sources: [] }), /至少选择一个来源/)
  assert.match(validateJobDraft({ ...ok, targetCount: 0 }), /1–300/)
  assert.match(validateJobDraft({ ...ok, targetCount: 301 }), /1–300/)
  assert.match(validateJobDraft({ ...ok, wordMax: 299 }), /上限不能小于下限/)
  assert.match(validateJobDraft({ ...ok, wordMax: 3000 }), /1–2000/)
})

test('任务单解析：坏文件跳过，状态文案可读', () => {
  assert.equal(parseJob('{bad'), null)
  assert.equal(parseJob('[]'), null)
  assert.equal(parseJob('{}'), null)
  assert.equal(parseJob('{"id":"20261107-153012","status":"pending"}')?.id, '20261107-153012')

  assert.equal(latestJob([]), null)
  assert.equal(jobStatusLabel('pending'), '待执行')
  assert.equal(jobStatusLabel('done'), '已完成')
  assert.equal(jobStatusLabel('weird'), 'weird')
  assert.equal(jobStatusLabel(''), '未知')

  assert.equal(formatJobTime('2026-11-07T15:30:12+08:00'), '2026-11-07 15:30:12')
  assert.equal(formatJobTime('not-a-time'), 'not-a-time')
  assert.equal(formatJobTime(''), '')
})
