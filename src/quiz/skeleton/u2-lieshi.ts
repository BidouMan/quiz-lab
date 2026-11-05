/**
 * 3A-U2 列式计算骨架包：30 条句式 × 三档 = 90 条。
 *
 * U2 为「用一位数乘」：纯乘法、乘加（和）与乘减（差）的括号结构，
 * 不含除法；乘数固定为一位数，被乘数按档从一位数扩到两位数。
 */
import { buildLieSkeletonPackage, type LieSkeletonDef } from './lie-kit.ts'

const D = (
  id: string,
  label: string,
  shape: string,
  parts: LieSkeletonDef['parts'],
  roles: LieSkeletonDef['roles'],
  guard?: LieSkeletonDef['guard'],
): LieSkeletonDef => ({ id, label, shape, parts, roles, ...(guard ? { guard } : {}) })

const SLOTS = {
  prod: { a: 'factor', b: 'mul' } as LieSkeletonDef['roles'],
  sum: { a: 'tiny', b: 'tiny', c: 'mul' } as LieSkeletonDef['roles'],
  diff: { a: 'minuend', b: 'small', c: 'mul' } as LieSkeletonDef['roles'],
  mulSum: { c: 'mul', a: 'tiny', b: 'tiny' } as LieSkeletonDef['roles'],
  mulDiff: { c: 'mul', a: 'minuend', b: 'small' } as LieSkeletonDef['roles'],
}

const DIFF_GUARD = (p: Record<string, number>): boolean => p.a >= p.b + 1

const DEFS: LieSkeletonDef[] = [
  D('u2-lie-prod-pen', '每盒笔支数', 'a*b', ['每盒有', { slot: 'a' }, '支笔，', { slot: 'b' }, '盒一共有多少支？'], SLOTS.prod),
  D('u2-lie-prod-money', '每个价钱', 'a*b', ['每个', { slot: 'a' }, '元，买', { slot: 'b' }, '个一共多少元？'], SLOTS.prod),
  D('u2-lie-prod-seat', '每排人数', 'a*b', ['每排坐', { slot: 'a' }, '人，', { slot: 'b' }, '排一共有多少人？'], SLOTS.prod),
  D('u2-lie-prod-bag', '每袋重量', 'a*b', ['每袋有', { slot: 'a' }, '千克，', { slot: 'b' }, '袋一共多少千克？'], SLOTS.prod),
  D('u2-lie-prod-book', '每本书页数', 'a*b', ['一本书', { slot: 'a' }, '页，', { slot: 'b' }, '本一共多少页？'], SLOTS.prod),
  D('u2-lie-prod-train', '每小时行程', 'a*b', ['每小时行', { slot: 'a' }, '千米，', { slot: 'b' }, '小时一共行多少千米？'], SLOTS.prod),
  D('u2-lie-sum-box', '每盒两次放入', '(a+b)*c', ['每盒先放', { slot: 'a' }, '个，再放', { slot: 'b' }, '个，', { slot: 'c' }, '盒一共有多少个？'], SLOTS.sum),
  D('u2-lie-sum-row', '每排男女生', '(a+b)*c', ['每排有', { slot: 'a' }, '名男生和', { slot: 'b' }, '名女生，', { slot: 'c' }, '排一共有多少名同学？'], SLOTS.sum),
  D('u2-lie-sum-bag', '每袋两色球', '(a+b)*c', ['每袋有', { slot: 'a' }, '个红球和', { slot: 'b' }, '个白球，', { slot: 'c' }, '袋一共有多少个球？'], SLOTS.sum),
  D('u2-lie-sum-candy', '每盒两种糖', '(a+b)*c', ['每盒有', { slot: 'a' }, '块奶糖和', { slot: 'b' }, '块水果糖，', { slot: 'c' }, '盒一共有多少块糖？'], SLOTS.sum),
  D('u2-lie-sum-team', '每队男女生', '(a+b)*c', ['每队有', { slot: 'a' }, '名男生和', { slot: 'b' }, '名女生，', { slot: 'c' }, '队一共有多少名同学？'], SLOTS.sum),
  D('u2-lie-sum-carton', '每箱两种饮料', '(a+b)*c', ['每箱有', { slot: 'a' }, '瓶果汁和', { slot: 'b' }, '瓶牛奶，', { slot: 'c' }, '箱一共有多少瓶？'], SLOTS.sum),
  D('u2-lie-diff-box', '每盒拿走后剩余', '(a-b)*c', ['每盒有', { slot: 'a' }, '个，每盒拿走', { slot: 'b' }, '个，', { slot: 'c' }, '盒还剩多少个？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-diff-row', '每排离开后剩余', '(a-b)*c', ['每排有', { slot: 'a' }, '人，每排离开', { slot: 'b' }, '人，', { slot: 'c' }, '排剩下多少人？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-diff-bag', '每袋吃掉后剩余', '(a-b)*c', ['每袋有', { slot: 'a' }, '个，每袋吃掉', { slot: 'b' }, '个，', { slot: 'c' }, '袋还剩多少个？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-diff-carton', '每箱送出后剩余', '(a-b)*c', ['每箱有', { slot: 'a' }, '瓶，每箱送出', { slot: 'b' }, '瓶，', { slot: 'c' }, '箱还剩多少瓶？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-diff-group', '每组请假后剩余', '(a-b)*c', ['每组有', { slot: 'a' }, '人，每组请假', { slot: 'b' }, '人，', { slot: 'c' }, '组还有多少人？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-diff-candy', '每盒分掉后剩余', '(a-b)*c', ['每盒有', { slot: 'a' }, '块，每盒分掉', { slot: 'b' }, '块，', { slot: 'c' }, '盒还剩多少块？'], SLOTS.diff, DIFF_GUARD),
  D('u2-lie-mulsum-group', '几组两类物品', 'c*(a+b)', ['有', { slot: 'c' }, '组，每组有', { slot: 'a' }, '个和', { slot: 'b' }, '个，一共有多少个？'], SLOTS.mulSum),
  D('u2-lie-mulsum-share', '几份两种糖', 'c*(a+b)', ['每份有', { slot: 'a' }, '颗奶糖和', { slot: 'b' }, '颗水果糖，', { slot: 'c' }, '份一共有多少颗？'], SLOTS.mulSum),
  D('u2-lie-mulsum-carton', '几盒两类物品', 'c*(a+b)', ['有', { slot: 'c' }, '个盒子，每个盒子有', { slot: 'a' }, '个和', { slot: 'b' }, '个，一共有多少个？'], { c: 'mul', a: 'tiny', b: 'tiny' }),
  D('u2-lie-mulsum-row', '几排男女生', 'c*(a+b)', ['有', { slot: 'c' }, '排同学，每排有', { slot: 'a' }, '名男生和', { slot: 'b' }, '名女生，一共有多少名？'], SLOTS.mulSum),
  D('u2-lie-mulsum-bag', '几袋两种糖', 'c*(a+b)', ['有', { slot: 'c' }, '袋糖果，每袋有', { slot: 'a' }, '颗奶糖和', { slot: 'b' }, '颗水果糖，一共有多少颗？'], SLOTS.mulSum),
  D('u2-lie-mulsum-drink', '几箱两种饮料', 'c*(a+b)', ['有', { slot: 'c' }, '箱饮料，每箱有', { slot: 'a' }, '瓶果汁和', { slot: 'b' }, '瓶牛奶，一共有多少瓶？'], SLOTS.mulSum),
  D('u2-lie-muldiff-sugar', '几盒吃掉后剩余', 'c*(a-b)', ['有', { slot: 'c' }, '盒糖，每盒有', { slot: 'a' }, '颗，每盒吃掉', { slot: 'b' }, '颗，现在一共有多少颗？'], SLOTS.mulDiff, DIFF_GUARD),
  D('u2-lie-muldiff-seat', '几排坏座位', 'c*(a-b)', ['有', { slot: 'c' }, '排座位，每排有', { slot: 'a' }, '个座位，每排坏了', { slot: 'b' }, '个，还能坐多少个？'], SLOTS.mulDiff, DIFF_GUARD),
  D('u2-lie-muldiff-apple', '几袋坏苹果', 'c*(a-b)', ['有', { slot: 'c' }, '袋苹果，每袋有', { slot: 'a' }, '个，每袋坏了', { slot: 'b' }, '个，还剩多少个？'], SLOTS.mulDiff, DIFF_GUARD),
  D('u2-lie-muldiff-milk', '几箱送出牛奶', 'c*(a-b)', ['有', { slot: 'c' }, '箱牛奶，每箱有', { slot: 'a' }, '瓶，每箱送出', { slot: 'b' }, '瓶，还剩多少瓶？'], SLOTS.mulDiff, DIFF_GUARD),
  D('u2-lie-muldiff-student', '几组请假学生', 'c*(a-b)', ['有', { slot: 'c' }, '组同学，每组有', { slot: 'a' }, '人，每组请假', { slot: 'b' }, '人，还有多少人？'], SLOTS.mulDiff, DIFF_GUARD),
  D('u2-lie-muldiff-pen', '几盒用完彩笔', 'c*(a-b)', ['有', { slot: 'c' }, '盒彩笔，每盒有', { slot: 'a' }, '支，每盒用完', { slot: 'b' }, '支，还剩多少支？'], SLOTS.mulDiff, DIFF_GUARD),
]

export const U2_LIE_PACKAGE = buildLieSkeletonPackage({
  id: '3A-U2|lieshi',
  unitId: '3A-U2',
  unitName: '用一位数乘',
  defs: DEFS,
})

export const U2_LIE_SKELETONS = U2_LIE_PACKAGE.skeletons
