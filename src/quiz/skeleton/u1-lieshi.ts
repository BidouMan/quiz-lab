/**
 * 3A-U1 列式计算骨架包：30 条句式 × 三档 = 90 条。
 *
 * 只含加减乘（U1 不含除法）；数值域见 `lie-kit.ts` 的角色表，
 * 两位数乘一位数保留在三上范围内，减法一律由 guard 保证差为正。
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
  add3: { a: 'add', b: 'add', c: 'add' } as LieSkeletonDef['roles'],
  addSub: { a: 'add', b: 'add', c: 'small' } as LieSkeletonDef['roles'],
  subAdd: { a: 'minuend', b: 'small', c: 'add' } as LieSkeletonDef['roles'],
  subSub: { a: 'minuend', b: 'small', c: 'small' } as LieSkeletonDef['roles'],
  prodAdd: { a: 'factor', b: 'mul', c: 'add' } as LieSkeletonDef['roles'],
  prodSub: { a: 'factor', b: 'mul', c: 'small' } as LieSkeletonDef['roles'],
  addProd: { a: 'add', b: 'factor', c: 'mul' } as LieSkeletonDef['roles'],
  subProd: { a: 'minuend', b: 'factor', c: 'mul' } as LieSkeletonDef['roles'],
  prod: { a: 'factor', b: 'mul' } as LieSkeletonDef['roles'],
  add2: { a: 'add', b: 'add' } as LieSkeletonDef['roles'],
  sub2: { a: 'minuend', b: 'small' } as LieSkeletonDef['roles'],
  parenAdd: { a: 'paren', b: 'paren', c: 'mul' } as LieSkeletonDef['roles'],
  parenSub: { a: 'minuend', b: 'small', c: 'mul' } as LieSkeletonDef['roles'],
}

const DEFS: LieSkeletonDef[] = [
  D('u1-lie-add3-a', '三数相加', 'a+b+c', ['把', { slot: 'a' }, '、', { slot: 'b' }, '和', { slot: 'c' }, '相加，和是多少？'], SLOTS.add3),
  D('u1-lie-add3-b', '连加', 'a+b+c', [{ slot: 'a' }, '加', { slot: 'b' }, '再加', { slot: 'c' }, '，和是多少？'], SLOTS.add3),
  D('u1-lie-addsub-a', '先加后减', 'a+b-c', [{ slot: 'a' }, '加', { slot: 'b' }, '再减去', { slot: 'c' }, '，差是多少？'], SLOTS.addSub,
    (p) => p.a + p.b >= p.c + 1),
  D('u1-lie-addsub-b', '和减一数', 'a+b-c', [{ slot: 'a' }, '与', { slot: 'b' }, '的和减去', { slot: 'c' }, '，得多少？'], SLOTS.addSub,
    (p) => p.a + p.b >= p.c + 1),
  D('u1-lie-subadd-a', '先减后加', 'a-b+c', [{ slot: 'a' }, '减去', { slot: 'b' }, '，再加上', { slot: 'c' }, '，得多少？'], SLOTS.subAdd,
    (p) => p.a >= p.b + 1),
  D('u1-lie-subadd-b', '从一数里减再加', 'a-b+c', ['从', { slot: 'a' }, '里减去', { slot: 'b' }, '，再加', { slot: 'c' }, '，结果是多少？'], SLOTS.subAdd,
    (p) => p.a >= p.b + 1),
  D('u1-lie-subsub-a', '连减', 'a-b-c', [{ slot: 'a' }, '减', { slot: 'b' }, '再减', { slot: 'c' }, '，差是多少？'], SLOTS.subSub,
    (p) => p.a >= p.b + p.c + 1),
  D('u1-lie-subsub-b', '从一数里连减', 'a-b-c', ['从', { slot: 'a' }, '里先减去', { slot: 'b' }, '，再减去', { slot: 'c' }, '，得多少？'], SLOTS.subSub,
    (p) => p.a >= p.b + p.c + 1),
  D('u1-lie-prodadd-a', '积加一数', 'a*b+c', ['比', { slot: 'a' }, '与', { slot: 'b' }, '的积多', { slot: 'c' }, '的数是多少？'], SLOTS.prodAdd),
  D('u1-lie-prodadd-b', '积再加', 'a*b+c', [{ slot: 'a' }, '乘', { slot: 'b' }, '的积加上', { slot: 'c' }, '，得多少？'], SLOTS.prodAdd),
  D('u1-lie-prodsub-a', '积减一数', 'a*b-c', ['比', { slot: 'a' }, '与', { slot: 'b' }, '的积少', { slot: 'c' }, '的数是多少？'], SLOTS.prodSub,
    (p) => p.a * p.b >= p.c + 1),
  D('u1-lie-prodsub-b', '积再减', 'a*b-c', [{ slot: 'a' }, '乘', { slot: 'b' }, '的积减去', { slot: 'c' }, '，差是多少？'], SLOTS.prodSub,
    (p) => p.a * p.b >= p.c + 1),
  D('u1-lie-addprod-a', '一数加积', 'a+b*c', [{ slot: 'a' }, '加上', { slot: 'b' }, '与', { slot: 'c' }, '的积，得多少？'], SLOTS.addProd),
  D('u1-lie-addprod-b', '积再加一数', 'a+b*c', [{ slot: 'b' }, '与', { slot: 'c' }, '的积再加', { slot: 'a' }, '，和是多少？'], { a: 'add', b: 'factor', c: 'mul' }),
  D('u1-lie-subprod-a', '一数减积', 'a-b*c', ['从', { slot: 'a' }, '里减去', { slot: 'b' }, '与', { slot: 'c' }, '的积，得多少？'], SLOTS.subProd,
    (p) => p.a >= p.b * p.c + 1),
  D('u1-lie-subprod-b', '一数减积（另说法）', 'a-b*c', [{ slot: 'a' }, '减去', { slot: 'b' }, '乘', { slot: 'c' }, '的积，差是多少？'], SLOTS.subProd,
    (p) => p.a >= p.b * p.c + 1),
  D('u1-lie-prod-a', '两数相乘', 'a*b', [{ slot: 'a' }, '乘', { slot: 'b' }, '，积是多少？'], SLOTS.prod),
  D('u1-lie-prod-b', '几个几相加', 'a*b', [{ slot: 'a' }, '个', { slot: 'b' }, '相加的和是多少？'], SLOTS.prod),
  D('u1-lie-add2-a', '两数求和', 'a+b', [{ slot: 'a' }, '与', { slot: 'b' }, '的和是多少？'], SLOTS.add2),
  D('u1-lie-add2-b', '两数相加', 'a+b', [{ slot: 'a' }, '加', { slot: 'b' }, '，和是多少？'], SLOTS.add2),
  D('u1-lie-sub2-a', '两数求差', 'a-b', [{ slot: 'a' }, '与', { slot: 'b' }, '的差是多少？'], SLOTS.sub2,
    (p) => p.a >= p.b + 1),
  D('u1-lie-sub2-b', '两数相减', 'a-b', ['从', { slot: 'a' }, '里减去', { slot: 'b' }, '，差是多少？'], SLOTS.sub2,
    (p) => p.a >= p.b + 1),
  D('u1-lie-parenadd-a', '和乘一数', '(a+b)*c', [{ slot: 'a' }, '与', { slot: 'b' }, '的和乘', { slot: 'c' }, '，积是多少？'], SLOTS.parenAdd),
  D('u1-lie-parenadd-b', '先加再乘', '(a+b)*c', ['先把', { slot: 'a' }, '与', { slot: 'b' }, '相加，再乘', { slot: 'c' }, '，得多少？'], SLOTS.parenAdd),
  D('u1-lie-parensub-a', '差乘一数', '(a-b)*c', [{ slot: 'a' }, '与', { slot: 'b' }, '的差乘', { slot: 'c' }, '，积是多少？'], SLOTS.parenSub,
    (p) => p.a >= p.b + 1),
  D('u1-lie-parensub-b', '先减再乘', '(a-b)*c', ['先把', { slot: 'a' }, '减去', { slot: 'b' }, '，再乘', { slot: 'c' }, '，得多少？'], SLOTS.parenSub,
    (p) => p.a >= p.b + 1),
  D('u1-lie-mulparenadd-a', '一数乘和', 'c*(a+b)', [{ slot: 'c' }, '乘', { slot: 'a' }, '与', { slot: 'b' }, '的和，积是多少？'], { a: 'paren', b: 'paren', c: 'mul' }),
  D('u1-lie-mulparenadd-b', '先求和再乘', '(a+b)*c', ['先算', { slot: 'a' }, '与', { slot: 'b' }, '的和，再用', { slot: 'c' }, '乘这个和，积是多少？'], SLOTS.parenAdd),
  D('u1-lie-mulparensub-a', '一数乘差', 'c*(a-b)', [{ slot: 'c' }, '乘', { slot: 'a' }, '与', { slot: 'b' }, '的差，积是多少？'], { a: 'minuend', b: 'small', c: 'mul' },
    (p) => p.a >= p.b + 1),
  D('u1-lie-mulparensub-b', '先求差再乘', '(a-b)*c', ['先算', { slot: 'a' }, '与', { slot: 'b' }, '的差，再用', { slot: 'c' }, '乘这个差，积是多少？'], SLOTS.parenSub,
    (p) => p.a >= p.b + 1),
]

export const U1_LIE_PACKAGE = buildLieSkeletonPackage({
  id: '3A-U1|lieshi',
  unitId: '3A-U1',
  unitName: '两步四则运算与应用题',
  defs: DEFS,
})

export const U1_LIE_SKELETONS = U1_LIE_PACKAGE.skeletons
