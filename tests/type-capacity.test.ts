import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateTypeCapacity, typeCapacityHint, type TypeCapacityResult } from '../src/app/typeCapacity.ts'
import { DEFAULT_CONFIG, type AppConfig, type BuildResult } from '../src/app/types.ts'

type Builder = Parameters<typeof estimateTypeCapacity>[2]

function fakeBuilder(actual: number, thirdReuse: number): Builder {
  let calls = 0
  const builder = () => {
    calls += 1
    return {
      count: actual,
      stats: {
        requested: 200,
        generated: actual,
        crossReused: calls >= 3 ? thirdReuse : 0,
        duplicates: 0,
      },
    } as unknown as BuildResult
  }
  return builder as unknown as Builder
}

function configFor(type: AppConfig['types'][number]): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    grade: '3A',
    unitIds: ['3A-U1'],
    level: 'L2',
    types: [type],
    counts: { [type]: 200 },
    count: 200,
  }
}

test('低于可用量不提示', () => {
  const result: TypeCapacityResult = {
    type: 'geom',
    available: 100,
    reuseRate: 0.18,
    repeated: 36,
    sampled: 200,
  }
  assert.equal(typeCapacityHint(result, 80), '', '低于阈值应静默')
  assert.equal(typeCapacityHint(result, 100), '', '刚好等于可用量也不提示')
})

test('超过可用量提示，并使用实测数值', () => {
  // 第三卷复用 36/200 = 18%，按 10% 复用线折算可用量 = 200 × 0.1 / 0.18 = 111
  const result = estimateTypeCapacity(configFor('geom'), 'geom', fakeBuilder(200, 36))
  assert.equal(result.available, 111)
  assert.equal(result.repeated, 36)

  const hint = typeCapacityHint(result, 200)
  assert.ok(hint.includes('111'), `提示应含可用量，实际：${hint}`)
  assert.ok(hint.includes('200'), `提示应含当前题量，实际：${hint}`)
  assert.ok(hint.includes('36'), `提示应含实测复用题数，实际：${hint}`)
  assert.ok(hint.includes('重复'), `提示应说明会重复，实际：${hint}`)
})

test('题池本身出不满时，提示可出量与出不满', () => {
  const result = estimateTypeCapacity(configFor('choice'), 'choice', fakeBuilder(120, 0))
  assert.equal(result.available, 120)
  const hint = typeCapacityHint(result, 200)
  assert.ok(hint.includes('120'), `提示应含可用量，实际：${hint}`)
  assert.ok(hint.includes('200'), `提示应含当前题量，实际：${hint}`)
  assert.ok(hint.includes('出不满'), `提示应说明出不满，实际：${hint}`)
  assert.equal(typeCapacityHint(result, 60), '')
})

test('真实生成器：图形单卷 200 题会触及内容池边界', () => {
  const config = { ...configFor('geom'), unitIds: ['3A-U6'] }
  const result = estimateTypeCapacity(config, 'geom')
  assert.ok(result.reuseRate > 0.1, `应实测到超过 10% 的复用率，实际 ${result.reuseRate}`)
  assert.ok(result.available > 0 && result.available < 200, `可用量应低于 200，实际 ${result.available}`)
  assert.equal(result.sampled, 200)
})
