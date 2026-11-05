/**
 * 3A-U6 列式计算骨架包：30 条句式 × 三档 = 90 条。
 *
 * U6 为「周长」：长方形（长 + 宽）× 2、正方形边长 × 4，以及由周长逆推边长、
 * 长方形与正方形周长比较、两块图形周长求和。只做周长，不含面积，不含方程。
 * 问法覆盖：求周长、求边长、逆推、比较、求和。
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

type Roles = LieSkeletonDef['roles']

const SLOTS: Record<string, Roles> = {
  rect: { a: 'add', b: 'add' },
  square: { a: 'paren' },
  revWidth: { c: 'minuend', a: 'add' },
  revLength: { c: 'minuend', b: 'add' },
  revSquare: { c: 'minuend' },
  rectSquare: { a: 'add', b: 'add', c: 'paren' },
}

const RECT_GUARD = (p: Record<string, number>): boolean => p.a > p.b + 1
const REV_WIDTH_GUARD = (p: Record<string, number>): boolean => p.c % 2 === 0 && p.c / 2 - p.a >= 2
const REV_LENGTH_GUARD = (p: Record<string, number>): boolean => p.c % 2 === 0 && p.c / 2 - p.b >= 2
const REV_SQUARE_GUARD = (p: Record<string, number>): boolean => p.c % 4 === 0 && p.c / 4 >= 2
const RECT_MORE_GUARD = (p: Record<string, number>): boolean =>
  RECT_GUARD(p) && (p.a + p.b) * 2 > p.c * 4
const SQUARE_MORE_GUARD = (p: Record<string, number>): boolean =>
  RECT_GUARD(p) && p.c * 4 > (p.a + p.b) * 2

const DEFS: LieSkeletonDef[] = [
  // 长方形求周长（10）
  D('u6-lie-rect-book', '课本封面', '(a+b)*2', ['一个长方形课本封面，长', { slot: 'a' }, '厘米，宽', { slot: 'b' }, '厘米，周长是多少厘米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-field', '长方形菜地', '(a+b)*2', ['一块长方形菜地，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，周长是多少米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-frame', '相框木条', '(a+b)*2', ['一个长方形相框，长', { slot: 'a' }, '厘米，宽', { slot: 'b' }, '厘米，做这个相框需要多长的木条？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-desk', '桌面周长', '(a+b)*2', ['一张长方形桌面，长', { slot: 'a' }, '分米，宽', { slot: 'b' }, '分米，周长是多少分米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-flowerbed', '花坛走一周', '(a+b)*2', ['一块长方形花坛，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，绕花坛走一周是多少米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-playground', '操场跑一周', '(a+b)*2', ['一个长方形操场，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，跑一周是多少米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-blackboard', '黑板边框', '(a+b)*2', ['一块长方形黑板，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，四周装边框需要多少米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-poster', '手抄报周长', '(a+b)*2', ['一张长方形手抄报，长', { slot: 'a' }, '厘米，宽', { slot: 'b' }, '厘米，周长是多少厘米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-fence', '围一圈篱笆', '(a+b)*2', ['一块长方形菜地，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，围一圈篱笆需要多少米？'], SLOTS.rect, RECT_GUARD),
  D('u6-lie-rect-pond', '水池栏杆', '(a+b)*2', ['一个长方形水池，长', { slot: 'a' }, '米，宽', { slot: 'b' }, '米，池边栏杆长多少米？'], SLOTS.rect, RECT_GUARD),

  // 正方形求周长（6）
  D('u6-lie-square-handkerchief', '手帕周长', 'a*4', ['一块正方形手帕，边长', { slot: 'a' }, '厘米，周长是多少厘米？'], SLOTS.square),
  D('u6-lie-square-cloth', '桌布花边', 'a*4', ['一块正方形桌布，边长', { slot: 'a' }, '分米，四周缝花边需要多少分米？'], SLOTS.square),
  D('u6-lie-square-mirror', '镜框边框', 'a*4', ['一个正方形镜框，边长', { slot: 'a' }, '厘米，做边框需要多少厘米？'], SLOTS.square),
  D('u6-lie-square-field', '菜地篱笆', 'a*4', ['一块正方形菜地，边长', { slot: 'a' }, '米，围一圈篱笆需要多少米？'], SLOTS.square),
  D('u6-lie-square-tile', '瓷砖周长', 'a*4', ['一块正方形瓷砖，边长', { slot: 'a' }, '分米，周长是多少分米？'], SLOTS.square),
  D('u6-lie-square-napkin', '方巾花边', 'a*4', ['一块正方形方巾，边长', { slot: 'a' }, '厘米，四周缝花边需要多少厘米？'], SLOTS.square),

  // 已知周长求长方形的宽（4）
  D('u6-lie-revw-frame', '相框求宽', 'c/2-a', ['一个长方形相框的周长是', { slot: 'c' }, '厘米，长是', { slot: 'a' }, '厘米，宽是多少厘米？'], SLOTS.revWidth, REV_WIDTH_GUARD),
  D('u6-lie-revw-field', '菜地求宽', 'c/2-a', ['一块长方形菜地的周长是', { slot: 'c' }, '米，长是', { slot: 'a' }, '米，宽是多少米？'], SLOTS.revWidth, REV_WIDTH_GUARD),
  D('u6-lie-revw-flowerbed', '花坛求宽', 'c/2-a', ['一个长方形花坛的周长是', { slot: 'c' }, '米，长是', { slot: 'a' }, '米，宽是多少米？'], SLOTS.revWidth, REV_WIDTH_GUARD),
  D('u6-lie-revw-desk', '桌面求宽', 'c/2-a', ['一张长方形桌面的周长是', { slot: 'c' }, '分米，长是', { slot: 'a' }, '分米，宽是多少分米？'], SLOTS.revWidth, REV_WIDTH_GUARD),

  // 已知周长求长方形的长（2）
  D('u6-lie-revl-lawn', '草坪求长', 'c/2-b', ['一块长方形草坪的周长是', { slot: 'c' }, '米，宽是', { slot: 'b' }, '米，长是多少米？'], SLOTS.revLength, REV_LENGTH_GUARD),
  D('u6-lie-revl-poster', '手抄报求长', 'c/2-b', ['一张长方形手抄报的周长是', { slot: 'c' }, '厘米，宽是', { slot: 'b' }, '厘米，长是多少厘米？'], SLOTS.revLength, REV_LENGTH_GUARD),

  // 已知周长求正方形边长（3）
  D('u6-lie-revsq-flowerbed', '花坛求边长', 'c/4', ['一个正方形花坛的周长是', { slot: 'c' }, '米，边长是多少米？'], SLOTS.revSquare, REV_SQUARE_GUARD),
  D('u6-lie-revsq-handkerchief', '手帕求边长', 'c/4', ['一块正方形手帕的周长是', { slot: 'c' }, '厘米，边长是多少厘米？'], SLOTS.revSquare, REV_SQUARE_GUARD),
  D('u6-lie-revsq-desk', '桌面求边长', 'c/4', ['一个正方形桌面的周长是', { slot: 'c' }, '分米，边长是多少分米？'], SLOTS.revSquare, REV_SQUARE_GUARD),

  // 长方形与正方形周长比较（2）
  D('u6-lie-cmp-rect-more', '长方形多多少', '(a+b)*2-c*4', ['一个长方形长', { slot: 'a' }, '米、宽', { slot: 'b' }, '米，一个正方形边长', { slot: 'c' }, '米，长方形周长比正方形周长多多少米？'], SLOTS.rectSquare, RECT_MORE_GUARD),
  D('u6-lie-cmp-square-less', '正方形少多少', '(a+b)*2-c*4', ['一个长方形长', { slot: 'a' }, '厘米、宽', { slot: 'b' }, '厘米，一个正方形边长', { slot: 'c' }, '厘米，正方形周长比长方形周长少多少厘米？'], SLOTS.rectSquare, RECT_MORE_GUARD),

  // 两块图形周长求和（2）
  D('u6-lie-sum-two-fields', '两块菜地周长和', '(a+b)*2+c*4', ['一块长方形菜地长', { slot: 'a' }, '米、宽', { slot: 'b' }, '米，旁边一块正方形菜地边长', { slot: 'c' }, '米，两块菜地的周长一共多少米？'], SLOTS.rectSquare, RECT_GUARD),
  D('u6-lie-sum-two-frames', '两个相框边框和', '(a+b)*2+c*4', ['一个长方形相框长', { slot: 'a' }, '厘米、宽', { slot: 'b' }, '厘米，一个正方形相框边长', { slot: 'c' }, '厘米，两个相框的边框一共多少厘米？'], SLOTS.rectSquare, RECT_GUARD),

  // 正方形比长方形多（1）
  D('u6-lie-cmp-square-more', '正方形多多少', 'c*4-(a+b)*2', ['一个长方形长', { slot: 'a' }, '厘米、宽', { slot: 'b' }, '厘米，一个正方形边长', { slot: 'c' }, '厘米，正方形周长比长方形周长多多少厘米？'], SLOTS.rectSquare, SQUARE_MORE_GUARD),
]

export const U6_LIE_PACKAGE = buildLieSkeletonPackage({
  id: '3A-U6|lieshi',
  unitId: '3A-U6',
  unitName: '周长',
  defs: DEFS,
})

export const U6_LIE_SKELETONS = U6_LIE_PACKAGE.skeletons
