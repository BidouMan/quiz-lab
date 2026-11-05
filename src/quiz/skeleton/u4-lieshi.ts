/**
 * 3A-U4 列式计算骨架包：30 条句式 × 三档 = 90 条。
 *
 * U4 为「用一位数除」：除数固定为一位数（2~9），被除数按档从表内除法扩到两位数、三位数。
 * 句式覆盖：纯除法、除加、除减、除乘、先乘后除、先加减后除、减法后再除。
 * 全部为整除写法（列式计算不出现余数），题干只出现槽位数字，不含面积与方程。
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
  div: { a: 'dividend', b: 'divisor' },
  divAdd: { a: 'dividend', b: 'divisor', c: 'tiny' },
  divSub: { a: 'dividend', b: 'divisor', c: 'tiny' },
  divMul: { a: 'dividend', b: 'divisor', c: 'mul' },
  prodDiv: { a: 'factor', b: 'mul', c: 'divisor' },
  sumDiv: { a: 'paren', b: 'paren', c: 'divisor' },
  diffDiv: { a: 'minuend', b: 'paren', c: 'divisor' },
  subDiv: { a: 'minuend', b: 'dividend', c: 'divisor' },
}

const DIV_GUARD = (p: Record<string, number>): boolean => p.a % p.b === 0 && p.a / p.b >= 2
const DIV_SUB_GUARD = (p: Record<string, number>): boolean => DIV_GUARD(p) && p.a / p.b > p.c
const DIV_MUL_GUARD = (p: Record<string, number>): boolean =>
  DIV_GUARD(p) && (p.a / p.b) * p.c <= 999
const PROD_DIV_GUARD = (p: Record<string, number>): boolean =>
  (p.a * p.b) % p.c === 0 && (p.a * p.b) / p.c >= 2 && p.a * p.b <= 999
const SUM_DIV_GUARD = (p: Record<string, number>): boolean =>
  (p.a + p.b) % p.c === 0 && (p.a + p.b) / p.c >= 2
const DIFF_DIV_GUARD = (p: Record<string, number>): boolean =>
  p.a - p.b >= p.c + 1 && (p.a - p.b) % p.c === 0 && (p.a - p.b) / p.c >= 2
const SUB_DIV_GUARD = (p: Record<string, number>): boolean =>
  p.b % p.c === 0 && p.b / p.c >= 2 && p.a - p.b / p.c > 0

const DEFS: LieSkeletonDef[] = [
  // 纯除法（6）
  D('u4-lie-div-apple', '苹果平均分', 'a/b', ['把', { slot: 'a' }, '个苹果平均分给', { slot: 'b' }, '个小朋友，每人分得几个？'], SLOTS.div, DIV_GUARD),
  D('u4-lie-div-flower', '扎花束', 'a/b', [{ slot: 'a' }, '朵花，每', { slot: 'b' }, '朵扎成一束，可以扎成几束？'], SLOTS.div, DIV_GUARD),
  D('u4-lie-div-book', '书本分书架', 'a/b', [{ slot: 'a' }, '本书平均放在', { slot: 'b' }, '层书架上，每层放几本？'], SLOTS.div, DIV_GUARD),
  D('u4-lie-div-team', '同学分组', 'a/b', [{ slot: 'a' }, '名同学，每', { slot: 'b' }, '人一组，可以分成几组？'], SLOTS.div, DIV_GUARD),
  D('u4-lie-div-egg', '鸡蛋装盒', 'a/b', [{ slot: 'a' }, '个鸡蛋，每盒装', { slot: 'b' }, '个，可以装几盒？'], SLOTS.div, DIV_GUARD),
  D('u4-lie-div-money', '本子单价', 'a/b', [{ slot: 'a' }, '元买', { slot: 'b' }, '本同样的本子，每本几元？'], SLOTS.div, DIV_GUARD),

  // 除加（4）
  D('u4-lie-divadd-water', '每班饮料', 'a/b+c', ['一箱有', { slot: 'a' }, '瓶水，平均分给', { slot: 'b' }, '个班，每班分到几瓶？每班再添', { slot: 'c' }, '瓶，每班一共几瓶？'], SLOTS.divAdd, DIV_GUARD),
  D('u4-lie-divadd-candy', '每人糖果', 'a/b+c', [{ slot: 'a' }, '颗糖平均分给', { slot: 'b' }, '个小朋友，每人分几颗？每人再多给', { slot: 'c' }, '颗，每人一共几颗？'], SLOTS.divAdd, DIV_GUARD),
  D('u4-lie-divadd-paper', '每组用纸', 'a/b+c', [{ slot: 'a' }, '张纸平均分给', { slot: 'b' }, '个小组，每组几张？每组再用', { slot: 'c' }, '张，每组一共用几张？'], SLOTS.divAdd, DIV_GUARD),
  D('u4-lie-divadd-seat', '每排座位', 'a/b+c', [{ slot: 'a' }, '个座位平均分成', { slot: 'b' }, '排，每排几个座位？每排再添', { slot: 'c' }, '个座位，每排一共几个座位？'], SLOTS.divAdd, DIV_GUARD),

  // 除减（3）
  D('u4-lie-divsub-ribbon', '丝带剪段', 'a/b-c', [{ slot: 'a' }, '米丝带平均剪成', { slot: 'b' }, '段，每段几米？每段用去', { slot: 'c' }, '米，每段还剩几米？'], SLOTS.divSub, DIV_SUB_GUARD),
  D('u4-lie-divsub-orange', '橙子分篮', 'a/b-c', [{ slot: 'a' }, '个橙子平均放进', { slot: 'b' }, '个篮子，每篮几个？每篮拿走', { slot: 'c' }, '个，每篮还剩几个？'], SLOTS.divSub, DIV_SUB_GUARD),
  D('u4-lie-divsub-pen', '笔的单价', 'a/b-c', [{ slot: 'a' }, '元买', { slot: 'b' }, '支同样的笔，每支几元？每支便宜', { slot: 'c' }, '元，便宜后每支几元？'], SLOTS.divSub, DIV_SUB_GUARD),

  // 除乘（3）
  D('u4-lie-divmul-row', '每排人数', 'a/b*c', [{ slot: 'a' }, '名同学平均站成', { slot: 'b' }, '排，每排几人？这样的', { slot: 'c' }, '排一共有多少人？'], SLOTS.divMul, DIV_MUL_GUARD),
  D('u4-lie-divmul-seat', '每排座位数', 'a/b*c', [{ slot: 'a' }, '个座位平均分成', { slot: 'b' }, '排，每排几个座位？', { slot: 'c' }, '排一共有多少个座位？'], SLOTS.divMul, DIV_MUL_GUARD),
  D('u4-lie-divmul-rice', '每袋大米', 'a/b*c', [{ slot: 'a' }, '千克大米平均装成', { slot: 'b' }, '袋，每袋几千克？', { slot: 'c' }, '袋一共有多少千克？'], SLOTS.divMul, DIV_MUL_GUARD),

  // 先乘后除（4）
  D('u4-lie-proddiv-pen', '笔分给班级', 'a*b/c', ['每盒有', { slot: 'a' }, '支笔，', { slot: 'b' }, '盒一共有多少支？把这些笔平均分给', { slot: 'c' }, '个班，每班多少支？'], SLOTS.prodDiv, PROD_DIV_GUARD),
  D('u4-lie-proddiv-seat', '座位分年级', 'a*b/c', ['每排有', { slot: 'a' }, '个座位，', { slot: 'b' }, '排一共有多少个座位？平均分给', { slot: 'c' }, '个年级，每个年级多少个座位？'], SLOTS.prodDiv, PROD_DIV_GUARD),
  D('u4-lie-proddiv-bottle', '饮料分班级', 'a*b/c', ['每箱有', { slot: 'a' }, '瓶饮料，', { slot: 'b' }, '箱一共有多少瓶？平均分给', { slot: 'c' }, '个班，每班多少瓶？'], SLOTS.prodDiv, PROD_DIV_GUARD),
  D('u4-lie-proddiv-apple', '苹果装篮', 'a*b/c', ['每袋有', { slot: 'a' }, '个苹果，', { slot: 'b' }, '袋一共有多少个？平均装进', { slot: 'c' }, '个篮子，每篮多少个？'], SLOTS.prodDiv, PROD_DIV_GUARD),

  // 先加后除（4）
  D('u4-lie-sumdiv-bread', '面包装盒', '(a+b)/c', ['上午卖出', { slot: 'a' }, '个面包，下午卖出', { slot: 'b' }, '个，一共卖出多少个？平均装进', { slot: 'c' }, '个盒子，每盒装多少个？'], SLOTS.sumDiv, SUM_DIV_GUARD),
  D('u4-lie-sumdiv-class', '两班分组', '(a+b)/c', ['一班有', { slot: 'a' }, '人，二班有', { slot: 'b' }, '人，两班一共多少人？平均分成', { slot: 'c' }, '组，每组多少人？'], SLOTS.sumDiv, SUM_DIV_GUARD),
  D('u4-lie-sumdiv-box', '水果分店', '(a+b)/c', ['仓库有', { slot: 'a' }, '箱苹果和', { slot: 'b' }, '箱梨，一共多少箱？平均分给', { slot: 'c' }, '家店，每家多少箱？'], SLOTS.sumDiv, SUM_DIV_GUARD),
  D('u4-lie-sumdiv-balloon', '气球分人', '(a+b)/c', ['红气球', { slot: 'a' }, '个，蓝气球', { slot: 'b' }, '个，一共多少个？平均分给', { slot: 'c' }, '个小朋友，每人几个？'], SLOTS.sumDiv, SUM_DIV_GUARD),

  // 先减后除（4）
  D('u4-lie-diffdiv-note', '本子分同学', '(a-b)/c', ['原来有', { slot: 'a' }, '个本子，用掉', { slot: 'b' }, '个，剩下的平均分给', { slot: 'c' }, '个同学，每人几个？'], SLOTS.diffDiv, DIFF_DIV_GUARD),
  D('u4-lie-diffdiv-book', '书分书架', '(a-b)/c', ['书架上有', { slot: 'a' }, '本书，借走', { slot: 'b' }, '本，剩下的平均放在', { slot: 'c' }, '层，每层几本？'], SLOTS.diffDiv, DIFF_DIV_GUARD),
  D('u4-lie-diffdiv-egg', '鸡蛋装盒', '(a-b)/c', ['有', { slot: 'a' }, '个鸡蛋，坏了', { slot: 'b' }, '个，剩下的平均装进', { slot: 'c' }, '个盒子，每盒几个？'], SLOTS.diffDiv, DIFF_DIV_GUARD),
  D('u4-lie-diffdiv-apple', '苹果分车', '(a-b)/c', ['果园有', { slot: 'a' }, '筐苹果，运走', { slot: 'b' }, '筐，剩下的平均分给', { slot: 'c' }, '辆车，每车几筐？'], SLOTS.diffDiv, DIFF_DIV_GUARD),

  // 先除后减（2）
  D('u4-lie-subdiv-bag', '纸箱装饮料', 'a-b/c', ['仓库有', { slot: 'a' }, '个纸箱，每', { slot: 'c' }, '瓶饮料装一箱，', { slot: 'b' }, '瓶饮料装完后，还剩几个空纸箱？'], SLOTS.subDiv, SUB_DIV_GUARD),
  D('u4-lie-subdiv-envelope', '信封装卡片', 'a-b/c', ['有', { slot: 'a' }, '个信封，每', { slot: 'c' }, '张卡片装一个信封，', { slot: 'b' }, '张卡片装完后，还剩几个信封？'], SLOTS.subDiv, SUB_DIV_GUARD),
]

export const U4_LIE_PACKAGE = buildLieSkeletonPackage({
  id: '3A-U4|lieshi',
  unitId: '3A-U4',
  unitName: '用一位数除',
  defs: DEFS,
})

export const U4_LIE_SKELETONS = U4_LIE_PACKAGE.skeletons
