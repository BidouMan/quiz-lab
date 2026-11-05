# 题面骨架试点 · 进度

> 组织：按「单元 × 题型」建包，不按难度拆三份。1 包 = 30 条骨架 + 自己的场景池；每条骨架带 L1/L2/L3 三档数值域，同一句式三档复用，只换数值范围与步数。
> 硬规则：每包做法 ≥5、每种做法 2–3 句式（实际写到 5）、场景池 ≥12、同一份卷子句式/场景/数值零重复、题干 ≤45 字；1 包要支撑该单元该题型三档各 30 题零重复。
> 边界：只新建 `src/quiz/skeleton/` 与 `scripts/pilot-drill.ts`，不改 `fill.ts / word.ts / forms.ts / generate.ts / curriculum.ts / paper.typ`、版本文件、CHANGELOG。

## 一、已完成的基础设施

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `src/quiz/skeleton/bands.ts` | 完成 | 三档解析：`resolveSkeleton(skeleton, level)`；R/band 写档速记；`attachBands` 挂载数据 |
| `src/quiz/skeleton/types.ts` | 完成 | Practice/Scene/Skeleton/SkeletonBand/Combo/PilotQuestion；Skeleton 增加 `bands?: { L1/L2/L3 }` |
| `src/quiz/skeleton/expr.ts` | 完成 | 生成侧算式求值：四则 + 年月日函数 + 判断式 + 顶层除法拆分 |
| `src/quiz/skeleton/scenes.ts` | 完成 | 8 组场景池（U1 40、U2 40、面积 47，其余 30；本轮新增除法填空 32、乘法填空 32；人物/物品/场所/单位/量词/标签） |
| `src/quiz/skeleton/assemble.ts` | 完成 | 按 combo.level 解析三档数值域；骨架轮转抽取 + 单位/标签配场景 + 四重去重 + 45 字上限 |
| `src/quiz/skeleton/verify.ts` | 完成 | 独立复核（自成一套求值实现），按 level 重算；13 类校验码 |
| `src/quiz/skeleton/registry.ts` | 完成 | 包注册表：1 包展开 L1/L2/L3 三个 Combo；3 个未升包旧组合保留单档入口 |
| `scripts/pilot-drill.ts` | 完成 | 单组合出卷 + 跨组合混合卷（`--mix`）+ 统计 + 抽样 + typst 编译 + check-layout |

## 二、包进度（单元 × 题型）

> 新口径：1 包 = 30 条骨架 + 自己的场景池 + 三档数值域。三档共用同一句式与场景池，只换数值域和步数；1 包支撑该单元该题型 L1/L2/L3 各 30 题零重复。
> 旧口径的「组合 = 单元 × 题型 × 难度」明细保留在附录 A1–A8，作为历史记录。

| # | 包 | 骨架 | 场景池 | L1 | L2 | L3 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3A-U6 周长 · 应用题 | 30（`u6-perimeter.ts` + `u6-perimeter.bands.ts`） | 30（`PERIMETER_SCENES`，厘米 15 / 米 15） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u6-perimeter-l{1,2,3}-drill.pdf` 6 页 PASS |
| 2 | 3A-U4 用一位数除 · 应用题 | 30（`u4-division.ts` + `u4-division.bands.ts`） | 30（`DIVISION_SCENES`） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u4-division-l{1,2,3}-drill.pdf` 6 页 PASS |
| 3 | 3A-U1 两步四则运算 · 应用题 | 30（`u1-two-step.ts` + `u1-two-step.bands.ts`） | 40（`TWO_STEP_SCENES`，cheap/kid/bulk 标签） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u1-two-step-l{1,2,3}-drill.pdf` 6 页 PASS |
| 4 | 3A-U5 年、月、日 · 填空 | 30（`u5-date.ts` + `u5-date.bands.ts`） | 30（`DATE_SCENES`） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u5-date-l{1,2,3}-drill.pdf` 6 页 PASS |
| 5 | 3A-U2 用一位数乘 · 应用题 | 30（`u2-multiplication.ts` + `u2-multiplication.bands.ts`） | 55（`MULTIPLICATION_SCENES`，cheap/mid/high、smallbox/hundred/carton/packer/seatkeeper/rowed） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u2-multiplication-l{1,2,3}-drill.pdf` 6 页 PASS |
| 6 | 3A-U4 用一位数除 · 填空 | 30（`u4-division-fill.ts` + `u4-division-fill.bands.ts`） | 32（`DIVISION_FILL_SCENES`，cheap 21 / mid 12，全新人物与已有应用包错开） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u4-division-fill-l2-drill.pdf` 2 页 PASS |
| 7 | 3A-U2 用一位数乘 · 填空 | 30（`u2-multiplication-fill.ts` + `u2-multiplication-fill.bands.ts`） | 32（`MULTIPLICATION_FILL_SCENES`，cheap/mid、rowed/rowmany/seatkeeper、smallbox/packer、book/worker/carton、factory） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u2-multiplication-fill-l2-drill.pdf` 2 页 PASS |
| 8 | 3A-U1 两步四则运算 · 填空 | 30（`u1-two-step-fill.ts` + `u1-two-step-fill.bands.ts`） | 40（`TWO_STEP_SCENES`，cheap/kid/bulk，与应用包共用） | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | 30/30/30/30/6 PASS | `samples/pilot-u1-two-step-fill-l{1,2,3}-drill.pdf` 各 2 页 PASS |
| 9 | 3A-U6 周长 · 填空 | 30（`u6-perimeter-fill.ts` + `u6-perimeter-fill.bands.ts`） | 30（`PERIMETER_SCENES`，厘米 15 / 米 15，`matchSceneUnit`） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u6-perimeter-fill-l{1,2,3}-drill.pdf` 各 2 页 PASS |
| 10 | 3A-U5 年、月、日 · 应用题 | 30（`u5-date-word.ts` + `u5-date-word.bands.ts`） | 30（`DATE_SCENES`，与填空包共用） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u5-date-word-l{1,2,3}-drill.pdf` 各 6 页 PASS |
| 11 | 3A-U7 马拉松路线 · 填空 | 30（`u7-marathon-fill.ts` + `u7-marathon-fill.bands.ts`） | 30（`ROUTE_SCENES`，新增 32 张路线卡） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u7-marathon-fill-l{1,2,3}-drill.pdf` 各 2 页 PASS |
| 12 | 3A-U8 数学广场 · 填空 | 30（`u8-math-plaza-fill.ts` + `u8-math-plaza-fill.bands.ts`） | 32（`MATH_PLAZA_SCENES`，`u8p-01..32`） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u8-math-plaza-fill-l{1,2,3}-drill.pdf` 各 2 页 PASS |
| 13 | 3A-U9 复习 · 填空 | 30（`u9-review-fill.ts` + `u9-review-fill.bands.ts`） | 32（`REVIEW_SCENES`，`u9r-01..32`） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u9-review-fill-l{1,2,3}-drill.pdf` 各 2 页 PASS |
| 14 | 3A-U7 马拉松路线 · 应用题 | 30（`u7-marathon-word.ts` + `u7-marathon-word.bands.ts`） | 30（`ROUTE_SCENES`，与填空包共用） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u7-marathon-word-l{1,2,3}-drill.pdf` 4/4/6 页 PASS |
| 15 | 3A-U8 数学广场 · 应用题 | 30（`u8-math-plaza-word.ts` + `u8-math-plaza-word.bands.ts`） | 32（`MATH_PLAZA_SCENES`，与填空包共用） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u8-math-plaza-word-l{1,2,3}-drill.pdf` 4/6/4 页 PASS |
| 16 | 3A-U9 复习 · 应用题 | 30（`u9-review-word.ts` + `u9-review-word.bands.ts`） | 32（`REVIEW_SCENES`，与填空包共用） | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | 30/30/30/30/5 PASS | `samples/pilot-u9-review-word-l{1,2,3}-drill.pdf` 各 6 页 PASS |

> 统计口径「30/30/30/30/6」= 题量 / 句式去重 / 场景去重 / 数值去重 / 做法数。
> 尚未升包的旧组合（仅单档，保留回归入口）：3B-U2 用两位数乘除·应用 L3（`u2-muld.ts`）、3B-U6 面积·应用 L2（`u6-area.ts`）。

判断方法：每完成 1 个包就把上面这张表和该包的明细写回本文件，再开下一个包；不再按「一档一个组合」累积到 54 轮。

## 三、16 单元填空 / 应用题覆盖清单

状态：✅ 已升包（三档达标）｜◐ 有 30 骨架但只覆盖一档（缺档）｜✗ 整单元无骨架 / 无规则｜— 非计算单元，不纳入骨架。

### 3.1 三上（当前学期优先）

| 序 | 单元 | 填空 | 应用题 | 现状与下一步 |
| --- | --- | --- | --- | --- |
| 1 | 3A-U1 两步四则运算 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（原 L1 → L1/L2/L3） | 应用与填空均已达标；填空 L1 单步 / L2 带括号两步 / L3 三步或含括号，全程禁除法与平均分 |
| 2 | 3A-U2 用一位数乘 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（原无规则 → L1/L2/L3） | 应用与填空均已达标；填空禁止除法与平均分，L1 表内 / L2 两位数×一位数 / L3 三位数×一位数 |
| 3 | 3A-U3 三角形与四边形 | ✅ 0.4.0 新建 30 条图形填空骨架 | ✅ 0.4.0 新建 30 条图形应用骨架 | 图形单元，只做辨认与拼摆，不做面积、周长；图形题文字左、图右，新增 `draw-fig` 图元 |
| 4 | 3A-U4 用一位数除 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（原 L2 → L1/L2/L3） | 应用与填空均已达标；填空为独立场景池 `DIVISION_FILL_SCENES`，L1 表内 / L2 两位数含余数 / L3 三位数或商含 0 |
| 5 | 3A-U5 年、月、日 | ✅ 已升包（原 L2 → L1/L2/L3） | ✅ 本轮升包（新建 30 条应用骨架） | 填空与应用均已达标；应用 L1 单步时刻 / L2 经过时间两步 / L3 跨课间、提前出发、反求出发，复用 `DATE_SCENES` |
| 6 | 3A-U6 周长 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（原 L2 → L1/L2/L3） | 应用与填空均已达标；填空 L1 单位换算与基础周长 / L2 长方形正方形周长含反求 / L3 组合图形与边长变化，厘米与米严格同口径 |
| 7 | 3A-U7 马拉松 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（新建 30 条应用骨架） | 应用 L1 单段/换算 / L2 分段求和比较 / L3 多段综合与往返，单位同口径，`ROUTE_SCENES` 32 张 |
| 8 | 3A-U8 数学广场 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（新建 30 条应用骨架） | 应用 L1 单点/直接求 / L2 两步 / L3 最值或判断，覆盖七巧板、篱笆（含靠墙）、找规律、周长最值；与 U6 周长包三档句式零撞车 |
| 9 | 3A-U9 复习 | ✅ 本轮升包（新建 30 条填空骨架） | ✅ 本轮升包（新建 30 条应用骨架） | 应用 L1 基础复习 / L2 综合 / L3 提高，每题至少融合两个知识点；U1/U2 口吻无除法，答案不超过本册上限 |

### 3.2 三下

| 序 | 单元 | 填空 | 应用题 | 现状与下一步 |
| --- | --- | --- | --- | --- |
| 10 | 3B-U1 复习与提高 | ✗ 规则齐全（周长 / 单价 / 经过时间），未建骨架 | ✗ 无独立应用规则 | 复用 3A 周长 / 年月日 / 购物包 |
| 11 | 3B-U2 用两位数乘除 | ✗ 有 `speed / mul2x2 / div2x2` 规则，未建骨架 | ◐ `u2-muld.ts` 30 条仅 L3 | 补 L1/L2；剪刀差最大 |
| 12 | 3B-U3 统计 | — | — | 图表单元，不纳入计算骨架 |
| 13 | 3B-U4 分数初步 | ✗ 有 `fraction / fractionUnit` 规则，未建骨架 | ✗ 无应用规则 | 只做填空包 |
| 14 | 3B-U5 计算器 | — | — | 工具单元，不纳入 |
| 15 | 3B-U6 面积 | ✗ 有 `areaUnit / rectArea / squareArea` 规则，未建骨架 | ◐ `u6-area.ts` 30 条仅 L2 | 补 L1/L3；单位三档已就绪 |
| 16 | 3B-U7 整理与提高 | ✗ 乘除 / 分数 / 周长面积复习规则齐全 | ✗ 无独立应用规则 | 最后做，复用面积 / 周长包 |

### 3.3 本轮优先级

1. **P0 / P2（已完成）**：3A-U6 周长·应用、3A-U4 用一位数除·应用、3A-U1 两步四则·应用补档；3A-U5 年月日·填空补 L1/L3，四个包均三档达标。
2. **P1（已完成）**：3A-U2 用一位数乘·应用——新建 30 骨架 + 55 张场景池，三档达标（L1 表内 / L2 两位数×一位数 / L3 三位数×一位数，无除法）。
3. **P3（本轮完成）**：3A-U4 除法·填空、3A-U2 乘法·填空——各新建 30 条填空骨架 + 32 张独立场景池，三档达标（U4 L1 表内 / L2 两位数含余数 / L3 三位数或商含 0；U2 L1 表内 / L2 两位数×一位数 / L3 三位数×一位数，全程无除法）。
4. **P4（本轮完成）**：3A-U1 两步四则·填空、3A-U6 周长·填空——U1 新建 30 条填空骨架（复用 `TWO_STEP_SCENES`），U6 新建 30 条填空骨架（复用 `PERIMETER_SCENES` + `matchSceneUnit`），两包三档均达标；同轮另完成 3A-U5 应用题与 3A-U7 马拉松填空。剩余：3A-U8 / 3A-U9 填空。
5. **P5（三下）**：3B-U6 面积补档、3B-U2 两位数乘除补档、3B-U4 分数填空、3B-U1 / 3B-U7 复习包。

排序依据：先做已有 30 骨架的补档包（边际成本最低），再补整单元无规则的当前学期核心单元，最后做复习与三下。

## 四、包 1（3A-U6 周长 · 应用题）三档实测

命令（三档共用同一 30 条骨架与 30 张场景，只换数值域）：

- `node scripts/pilot-drill.ts --combo '3A-U6|word|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U6|word|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U6|word|L3' --count 30 --seed 20261103 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u6-perimeter-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u6-perimeter-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u6-perimeter-l3-drill.pdf` 6 页 RESULT: PASS |

三档差异（同一句式，只换数值域）：L1 厘米 5–36 / 米 3–20，多为一位数或小两位数；L2 厘米 12–80 / 米 4–60，两位数为主；L3 厘米 20–144 / 米 12–60，结果进入 2–3 位数。L2 基线写在 `u6-perimeter.ts` 的 `slots`，L1/L3 写在 `u6-perimeter.bands.ts`。

逐句自评后返工（8 类）：

1. `u6-c-c1` / `u6-c-m1` 的 4 个两位数在 L3 会顶破 45 字 → 去掉「两{cls}长方形{item}：」，改成「甲长方形长…，乙长方形长…」。
2. `u6-i-c1` / `u6-i-m1` 出现「长 18、宽 53」 → guard 增加 `p < 4a`，保证长边 > 宽边。
3. `u6-i-m3` 出现「宽 20、长 10」 → guard 增加 `p > 4b`。
4. `u6-m-m2` 出现「羽毛球场 12×2」 → L1/L2/L3 宽度收窄为 4–8 / 5–8 / 6–10 米。
5. `u6-j-m3` 出现「游泳池边长 3 米」 → L1 边长下限提到 6 米。
6. `u6-p-c2` 出现「书封面 54×8」 → 宽度下限提到 10 / 14 / 20 厘米。
7. `u6-24` 出现「沙坑长 52 米」 → 场景物品改为「绿化带」（量词「条」）。
8. `u6-m-m1` 围栏宽度收到 4–10 米，避免羽毛球场/小花园被拉成 14 米宽。

## 五、包 2（3A-U4 用一位数除 · 应用题）三档实测

命令：

- `node scripts/pilot-drill.ts --combo '3A-U4|word|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U4|word|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U4|word|L3' --count 30 --seed 20261103 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u4-division-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u4-division-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u4-division-l3-drill.pdf` 6 页 RESULT: PASS |

三档差异：L1 被除数 6–48（表内为主，商 ≤9 到小两位数）；L2 被除数 12–96（两位数 ÷ 一位数，含余数 / 进一 / 去尾）；L3 被除数 120–480（三位数 ÷ 一位数），商与余数都上到 2–3 位；除数始终一位数，未出现两位数除法。

逐句自评后返工（7 类）：

1. `u4-c3` L3 出现「132 米彩带」 → 上限收到 60 米。
2. `u4-d5` L3 出现「96 米彩带剪 3 段」 → 上限收到 60 米。
3. `u4-p2` 出现「54 元的羽毛球」 → 单价上限收到 24 元。
4. `u4-c5` 出现「甲班 120 人」 → L3 上限收到 90 人。
5. `u4-p1` 出现「每人 90 块巧克力」 → 商增加 `≤30` guard。
6. `u4-d2` 出现「120 支铅笔分 3 人」 → 商增加 `≤30` guard。
7. `u4-p3` 出现「每组 120 面小旗」 → 增加 `a/(b*c) ≤ 40` guard。

## 六、包 3（3A-U1 两步四则运算 · 应用题）三档实测

命令：

- `node scripts/pilot-drill.ts --combo '3A-U1|word|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U1|word|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U1|word|L3' --count 30 --seed 20261103 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-l3-drill.pdf` 6 页 RESULT: PASS |

三档差异：L1 结果 ≤100、乘法全在表内；L2 加减扩到 1–3 位数、总价 ≤150，乘法仍是表内；L3 加减到 3 位数、结果 ≤1000–1500，乘法仍 ≤9×9，全程无除法（P0 红线）。

逐句自评后返工（6 类）：

1. 出现「一块橡皮 54 元」 → `u1-i2` 模板改为「买了一件文具花了 {a} 元」，价格 L2 ≤50 / L3 ≤80。
2. 出现「二班比一班多 33 人」→ 两班 89 人 → `u1-c4` 二班差收到 L2 5–15 / L3 8–18，总和 guard ≤110。
3. 出现「138 元的钢笔」 → `u1-m5` L3 笔价上限收到 40 元。
4. 出现「小华有 322 本图书」 → `u1-d5` L3 上限收到 150 本。
5. 出现「奶奶下午拿来 109 个鸡蛋」 → `u1-d5` L3 单次上限收到 80。
6. 出现「100 元的水杯」 → `u1-p2` L3 单价上限收到 60 元。

## 七、包 4（3A-U5 年、月、日 · 填空）三档实测

命令：

- `node scripts/pilot-drill.ts --combo '3A-U5|tiankong|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U5|tiankong|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U5|tiankong|L3' --count 30 --seed 20261103 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u5-date-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u5-date-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u5-date-l3-drill.pdf` 6 页 RESULT: PASS |

三档差异：L1 时段 20–90 分钟、跨月 1 个月且 3–15 天、年份 2015–2030；L2 沿用原基线；L3 时段 60–180 分钟、跨月 ≤2 个月且 12–45 天、年份 1990–2030，分钟换算拉到 300 分钟。30 条骨架与 30 张 `DATE_SCENES` 三档复用，只换 `u5-date.bands.ts` 里的数值域与 guard。

时间口径与逐句自评返工（5 类）：

1. `u5-m2` 原句「下午 {h} 时开始……最迟 ____ 时 ____ 分到」把 12 时制与 24 时制混在一起 → 改为「最迟下午 ____ 时 ____ 分到」，算式改为 `hourOf(h*60+720-n)-12`，guard 要求到达时刻 13:00–17:55，避免出现「下午 0 时」。
2. `u5-d5` / `u5-m3` 的月份区间会跨到 2 月，而题干未给年份，闰年 29 天 / 平年 28 天会让同题出现两个答案 → 月份下限收到 3 月，彻底避开 2 月。
3. `u5-d5` L1、`u5-m3` L1 要求 3–15 天 / 4–10 天，但月份跨度随机时几乎不可能命中 → 增加 `m2 = m1 + 1` guard，把 L1 限定为相邻月。
4. `u5-d5` L3、`u5-m3` L3 同理增加 `m2 - m1 ≤ 2` guard，保证 12–45 天 / 7–21 天可稳定生成。
5. `u5-m5` 原本沿用基线 guard，L1 会出现 300 分钟以上的“实际用时” → 按档补 guard：L1 总时长 40–120 分钟、L3 90–180 分钟。

答案唯一性：全部 30 条均只求一个确定值；「连续两个大月」这类多解题未使用。出发时刻一律用「最迟」，未出现「至少」与「最多」错位。

## 八、包 5（3A-U2 用一位数乘 · 应用题）三档实测

命令：

- `node scripts/pilot-drill.ts --combo '3A-U2|word|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U2|word|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U2|word|L3' --count 30 --seed 20261103 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u2-multiplication-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u2-multiplication-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u2-multiplication-l3-drill.pdf` 6 页 RESULT: PASS |

三档差异（同一批 30 条骨架与 55 张 `MULTIPLICATION_SCENES`，只换数值域）：

- L1 表内乘法：两个因数都 ≤9，积 ≤81；容器类位数下限收到 4，避免「一箱 2 把直尺」。
- L2 两位数×一位数：一个因数 12–48，另一个 2–9；积 ≤400。
- L3 三位数×一位数：三位数因数 105–300，另一个 2–9；积不超过四位数（guard 多在 900–2700）。

30 条骨架分 6 类做法，各 5 条：直接求（`d1–d5`）、每份数相乘（`i1–i5`）、比较与最值（`c1–c5`）、组合与拆分（`p1–p5`）、多步合成（`m1–m5`）、信息筛选（`f1–f5`）。L2 基线写在 `u2-multiplication.ts` 的 `slots`，L1/L3 写在 `u2-multiplication.bands.ts`。

标签机制（价格、尺寸、年龄、装箱）：

- 价格：`cheap` 2–9 元、`mid` 12–99 元、`high` 100–300 元；L1/L2/L3 的单价题按档只挂对应标签。
- 装箱：`smallbox` 可装盒小件、`hundred` 单箱可上百（铅笔 / 图书 / 橘子等）、`carton` 可装箱（排除课桌 / 椅子 / 座位 / 花架）、`packer` 成年人装箱（排除小学生）。
- 排布与座位：`rowed` 可按排摆放、`seatkeeper` 可数座位的人（排除花农 / 店长 / 小学生）。
- 尺寸类只用彩带长度（L1 4–9 厘米、L3 105–300 厘米），不再用「米」量级；年龄类未进入本包。

逐句自评后返工（10 类）：

1. L3 `u2-d2` 的 `rowed` 场景被 `high ∩ rowed` 的单价题抢空，可用场景 0 → 新增 6 张只带 `rowed` 的场景（凳子 / 桌子 / 货架 / 花篮 / 垫子 / 展台）。
2. `c3` / `f3` 抽到课桌、椅子、座位、花架，出现「装 208 箱课桌」 → 加 `carton` 标签收口；`f3` 的量词写死「个」，改为 `{cls}`。
3. `d4` / `m2` 出现「每天包 9 张课桌」「每天整理课桌」 → 加 `book` 标签。
4. `m5` / `p2` 出现「小果上午装 3 箱直尺」「小果装了 3 箱，每层 152 把」 → 加 `packer`，装箱人只留成年人。
5. `i5` 出现「花农数了 6 排座位」 → 加 `seatkeeper`，只留后勤老师 / 管理员 / 班主任 / 校长 / 老师 / 体育老师。
6. L3 每盒/每箱上百时抽到牛奶、面包（每箱 212 瓶 / 171 个） → 加 `hundred`，只留铅笔、图书、练习册、图画本、毛巾、手套、地砖、苹果、鸭蛋、橘子、果冻、巧克力、围棋子等可成百装箱的物品。
7. `f5` 出现「每排 2 人，第一排有 8 个男生」 → guard 增加 `d ≤ b`，三档同步。
8. `c4` 的「普通的 / 精致的」不适配树苗、课桌、花架 → 改为「普通的 / 好一点的」。
9. `p5` 出现「21 根跳绳装一袋」 → 改「装一箱」，并把 L3 的单箱件数交给 `batch` 场景；`m5` 每箱数上限收到 24（牛奶类不再出现 35 瓶/箱）。
10. `c2` / `c5` L1 出现「蓝彩带 2 厘米」 → L1 长度下限收到 4 厘米；`u2-25` 拼图、`u2-26` 积木脱离 `mid` 单价（不再出现「每块积木 28 元」）。

口径核对：180 道题全部只用乘法，未出现除法、平均分、归一；「够不够 / 最多 / 至少」题在问句里显式给出差额或余量，未出现只问「够不够」而不给数的题；本卷最大答案 1680，全部积均为四位数以内（guard 上限 3000）。

## 九、包 6 / 包 7（三上填空两包）三档实测

命令（每包三档共用同一批 30 条骨架与 32 张场景，只换数值域）：

- `node scripts/pilot-drill.ts --combo '3A-U4|tiankong|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U4|tiankong|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U4|tiankong|L3' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U2|tiankong|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U2|tiankong|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U2|tiankong|L3' --count 30 --seed 20261103 --pdf --check`

### 9.1 包 6：3A-U4 用一位数除 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u4-division-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | 同上 |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | 同上 |

- L1 表内 / 整除：被除数 ≤81、商 ≤9，允许表内有余数（`m1/m2/m4`）。
- L2 两位数÷一位数含余数：被除数 12–99，单价类商上限 9。
- L3 三位数÷一位数：被除数 108–960；`d1` 的 guard 强制商含 0（如 408÷4=102），余数题商上限 100 以内。
- 填空约定：`asks: []`，模板 `____` 与 `formulas` 一一对应；单空 `unit` 写进答案（与空位后单位同口径），双空 `unit: ''` 且单位写进题干，答案以「；」连接。

### 9.2 包 7：3A-U2 用一位数乘 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u2-multiplication-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | 同上 |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | 同上 |

- L1 表内：两因数 2–9、积 ≤81。
- L2 两位数×一位数：一个因数 12–48，另一个 2–9。
- L3 三位数×一位数：三位数放在「箱数 / 张数 / 产量 / 每天本数 / 每排人数」这类天然可上百的量上，单位量保持 2–9（避免「每盒 594 瓶」）。
- 全程只用乘法，未出现除法、平均分、归一。

### 9.3 填空特有校验

- 空位数 = `formulas` 条数（`assemble.ts` 硬校验），双空题最多 2 空。
- 答案唯一：`verify.ts` 用独立求值器重算并比对，单位与问句口径一致（如问「盒」答「盒」）。
- 题干最长 45 字（5 个 seed 抽检 L3，max=45）；30 题内句式/场景/数值三项零重复。
- 跨包场景键比对：`DIVISION_FILL_SCENES` + `MULTIPLICATION_FILL_SCENES` 与既有 7 个场景池共 336 张卡，新包撞车 0。

### 9.4 逐句自评后返工

包 6（U4 除法填空）：

1. `u4f-c4` 档位把 `gt: 'b'` 误写成 `lt`，L1 可用组合归零 → 改 `R(3, 4, undefined, undefined, 'b')`。
2. 价格句出现「21 元的手套」「每盒 594 瓶」 → `d3/c2/i3/m4/f3` 挂 `cheap`；L3 `d3/c2` 换 `mid` 并把单价收到 12–48；`d3/c2` 在 L2 把单价上限收到 9。
3. `p2` 写死「一个」不适配「一副手套」→ 改「买了 {b} 元的{item}」；`f3` 量词写死「个」→ 改 `{cls}`。
4. 「甲班 772 人」「甲袋 784 支」不自然 → 改「甲队 / 乙队」「甲箱 / 乙箱」。
5. 「354 人 → 177 条船」偏多 → `i4` L3 收到 20–60 条、`m2` L3 上限 100 条。
6. `p2` 题干 47 字超限 → 去掉「一本」。

包 7（U2 乘法填空）：

1. 「买 4 个支铅笔」→ `p3` 改 `{b} {cls}{item}`、`每{cls}`；`f2` 原写 `{a} {cls}{item}`（把盒数当成量词）→ 改 `{a} 盒{item}`；`m1` 补「原来」。
2. 「每支铅笔 36 元」 → `d3/p3/p5/m3/f4/c4` 把价格位收到 2–9、数量位 12–48；新增 `cheap` 标签 15 张。
3. L3「692 排座位」「每盒 594 瓶」「每排 583 张桌子」 → 重写 L3 数值域：上百的量落在箱数 / 张数 / 产量 / 张纸上；座位类改为 2–9 排 × 每排 100–150 人。
4. `p4` 与 `i5/m4/f5` 争抢 `seatkeeper` 场景（可用场景 0）→ `rowmany` 只给花篮，`p4` L3 独占。
5. 「一箱巧克力 2 块」「一箱 8 支铅笔」 → 容器单位量下限收到 4–6（`d5/f4/f3/i2/p1/p2/m1/f2`）。
6. `m1` 题干 46 字 → 「原来一共」改「原来有」。

## 十、跨包混合卷（同类题型场景不撞车）

命令：

`node scripts/pilot-drill.ts --mix '3A-U6|word|L3,3A-U4|word|L3,3A-U1|word|L3' --count 20 --seed 20261103 --slug mix-3 --pdf --check`
`node scripts/pilot-drill.ts --mix '3A-U4|tiankong|L3,3A-U2|tiankong|L3' --count 20 --seed 20261103 --slug fill-mix --pdf --check`

| 混合卷 | 构成 | 题量 | 句式 | 场景 | 数值 | 做法 | 跨组合撞车 | 复核 | 排版 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mix-3 | 周长 7 + 用一位数除 7 + 两步四则 6 | 20 | 20 | 20 | 20 | 6 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-mix-3-drill.pdf` 4 页 RESULT: PASS |
| fill-mix | U4 除法填空 10 + U2 乘法填空 10（L3） | 20 | 20 | 20 | 20 | 12 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-fill-mix-drill.pdf` 1 页 RESULT: PASS |
| fill-mix-2 | U1 两步四则填空 15 + U6 周长填空 15（L2） | 30 | 30 | 30 | 30 | 6 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-fill-mix-2-drill.pdf` 2 页 RESULT: PASS |

结论：应用题三包共用人物 / 物品 / 场所常见卡，但 `used` 集合跨包共享且场景键为三元组，20 题混排 0 撞车；两个填空包各自独立场景池，20 题混排同样 0 撞车；U1/U6 填空两包复用 `TWO_STEP_SCENES` / `PERIMETER_SCENES`，30 题混排同样 0 撞车；题型分区与节标题间距检查均 PASS。

## 十一、包 8 / 包 9（3A-U1 / 3A-U6 填空）三档实测

命令：

- `node scripts/pilot-drill.ts --combo '3A-U1|tiankong|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U1|tiankong|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U1|tiankong|L3' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U6|tiankong|L1' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U6|tiankong|L2' --count 30 --seed 20261103 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U6|tiankong|L3' --count 30 --seed 20261103 --pdf --check`

### 11.1 包 8：3A-U1 两步四则运算 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-fill-l1-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 6（各 5 条） | PASS | `samples/pilot-u1-two-step-fill-l3-drill.pdf` 2 页 RESULT: PASS |

- L1 单步：加 / 减 / 乘各一组，结果为 1–2 位整数（如「计算：{a} 加 {b} = ____」「{a} 个 {b} 相加是 ____」）。
- L2 带括号两步：`(a+b)*c`、`a*(b+c)`、`(a+b)-c`、`a-(b+c)`、`(a-b)*c` 等，结果 ≤99–150，乘法表内为主。
- L3 三步或含括号：`(a+b)*c+d`、`a*(b+c)-d`、`(a-b)*c-d`、`a*(b+c)-(a+d)` 等，结果 ≤200。
- P0 红线：全程只用加、减、乘，0 处除法 / 余数 / 平均分 / 归一（U4 才学除法）。
- 填空口吻：`asks: []`，题干是「计算：…= ____」或「…是 ____」，不写成应用题；单空 `unit` 写进答案，双空 `unit: ''` 并以「；」连接。

逐句自评后返工：

1. `p4/p5` 原句「买 4 根和 4 根跳绳」缺中心词 → 改为「{a} {cls}{item}和 {b} {cls}{item}」，`每{cls}` 后补 `{item}`。
2. `p4` 出现「4 根和 4 根」 → 加 `guard: p.a !== p.b`（L2 与 L3）。
3. `c3` L3「{a} 的（{b} 加 {c}）倍比 {a} 多的数，再减 {d}」拗口 → 改为「{a} 的（{b} 加 {c}）倍减去 {a} 与 {d} 的和，得 ____」。
4. `c5` L1「3 个 3 的和」不自然 → 改为「{a} 个 {b} 相加是 ____」。

### 11.2 包 9：3A-U6 周长 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（7/6/6/6/5） | PASS | `samples/pilot-u6-perimeter-fill-l1-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（7/6/6/6/5） | PASS | `samples/pilot-u6-perimeter-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（7/6/6/6/5） | PASS | `samples/pilot-u6-perimeter-fill-l3-drill.pdf` 2 页 RESULT: PASS |

- L1 长度换算 + 基础周长：厘米→毫米 ×10、分米→厘米 ×10、米→分米 ×10、米→厘米 ×100，只做大单位化小单位；换算题显式 `sceneUnit` 保持场景口径。
- L2 长方形 / 正方形周长：直接求、反求边长、反求宽、比较、相邻两边和、组合与拆分。
- L3 组合图形或边长变化：两个长方形拼、正方形拼、沿长/宽中点剪、边长增减、边长乘 2、围两圈、宽剪成两个正方形。
- 单位同口径：`matchSceneUnit: true`，厘米题只配厘米场景、米题只配米场景；空位后的单位与答案单位一致（如「合 ____ 毫米」答案单位必为毫米）。
- 尺寸 guard 沿用应用题包：宽严格小于长、边长区间不放开；`u6f-i1` 反求宽收紧到 `p > 2a + 20`（宽 ≥ 11 厘米），避免「贺卡 40×8」。

逐句自评后返工：

1. L1 / L3 首次组题失败：band 省略 guard 时会继承基线 guard（引用 L1 不存在的槽位，条件恒 false）→ 为 L1 `i1/c2/c3/i3/c4/c5`、L3 `d3/i1/d6/c2/c3/c4/c5/i3` 显式补 `guard: () => true`。
2. L1 再次失败 `u6f-m5`：单槽骨架共用同一 `valuesKey`（只含数值、不含槽名），厘米组与米组的 2 值窗口重叠 → 把 22 个单槽题的窗口改为全局互斥（厘米组 1–4 / 20–52、米组 5–18 / 38–56）。
3. `u6f-m2` L1 换算题占用厘米场景，导致厘米场景需求 16 > 池 15 → 该题无 `{cls}{item}`，`sceneUnit` 改为「米」，两池正好 15/15。
4. L2 反求宽出现「贺卡 40×8 厘米」→ `u6f-i1` guard 由 `p > 2a + 8` 收紧到 `p > 2a + 20`。

### 11.3 填空跨包校验

- 30 题内三项零重复：U1 填空 6 做法 × 5、U6 填空 5 做法（7/6/6/6/5），均 30/30/30。
- 跨包不撞车：`--mix '3A-U1|tiankong|L2,3A-U6|tiankong|L2' --count 30` → 场景 0 / 题干 0 / 句式模板 0，独立复核 PASS。
- 空位数 = `formulas` 条数；一句话最多 2 空；答案用「；」分隔；题干 ≤45 字。

## 十二、包 10（3A-U5 年、月、日 · 应用题）三档实测

命令（三档共用同一 30 条骨架与 30 张 `DATE_SCENES`，只换数值域与句式结构）：

- `node scripts/pilot-drill.ts --combo '3A-U5|word|L1' --count 30 --seed 20261103 --sample 30 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U5|word|L2' --count 30 --seed 20261103 --sample 30 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U5|word|L3' --count 30 --seed 20261103 --sample 30 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u5-date-word-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u5-date-word-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u5-date-word-l3-drill.pdf` 6 页 RESULT: PASS |

三档分工：

- L1 单步时刻计算：整时增减、经过多少分钟、下午转 24 时制、分钟折合时分。
- L2 经过时间两步：起止求经过、休息扣除、提前到场、计划用时、比较两段时长。
- L3 跨课间 / 提前出发 / 反求出发：分段求和、每段后休息、往返、提前量抵消、按「最迟」反推出发时刻。
- 30 条骨架分 5 类做法，各 6 条：直接求（`d1–d6`）、逆向求（`i1–i6`）、比较与最值（`c1–c6`）、组合与拆分（`p1–p6`）、多步合成（`m1–m6`）。

时间口径：

- 时刻一律落在 8:00–18:00，不跨零点；跨午间的题显式写「上午 / 下午」但只用 24 时制时刻，唯一涉及 12 时制的题是「下午 h 时 → 24 时制」换算，单句独立、不与 24 时制混算。
- 出发时刻一律问「最迟几时几分出发」；剩余路程问「至少还要走多少分钟」，不用「最多」。
- 每问都写明所求：几时 / 几时几分 / 经过多少分钟；一问问时、分两答（`answerUnits: ['时','分']`，答案「15 时；10 分」）。

逐句自评后返工（6 类）：

1. 「第一场 / 第二场」不适配读书节、春游等 `item` → 全包改为「第一次 / 第二次 / 两次 / 三次」，`每场` 改 `每次`，`上半场 / 下半场` 改 `第一部分 / 第二部分`。
2. L3 `d1 / c2 / c3 / c6` 模板误带问句，出题后题干末尾重复问句 → 模板只留情境句，问句全部移到 `asks`。
3. `u5w-d5`「{n} 分钟是一个时长」生硬 → 改「{item}用了 {n} 分钟。合几时几分？」；`u5w-p1 / p4` 同类改「{item}用了 …」「…又延长 …」。
4. L3 `c5`「去操场时 8 时 55 分出发」且行程 3 小时 → 改「{person}去{place}，…出发，…到达，回来少用 {r} 分钟」并保持单程 ≤3 小时。
5. L1 `c5` 两场开始时刻最大差 5 小时（315 分钟）→ L1/L2 的 `h3` 改为 `h3 > h1` 且差值 guard 30–150 分钟。
6. L1 `m1 / i5` 要求整点结束导致 `r` 必须为 60 的倍数而无解 → 改为时分双答案，去掉整点 guard。

独立复核曾报「算式无法归约 `hourOf((h+12)*60+m+n)`」：复核器只展开单层括号的函数调用 → 算式改写为 `hourOf(h*60+720+m+n)`、`hourOf(h*60-n+k)`，语义不变。

2026-11-04 三上总验收扫题干长度时，本包 L3 仍有两条超 45 字（`u5w-d2` 52 字、`u5w-m4` 48 字，改基线时漏改 L3 bands）。已缩句：

- `u5w-d2` L3 去掉「参加{item}」，问句改「待了多少分钟？」→ 42 字。
- `u5w-m4` L3 改为「{person} {h1} 时 {m1} 分到 {h2} 时 {m2} 分、{h3} 时 {m3} 分到 {h4} 时 {m4} 分都在{place}。」→ 43 字。

复跑：三档 × 双 seed（20261104 / 111）均 30/30/30/30/5、三项 0 重复、独立复核 PASS；`samples/pilot-u5-date-word-l{1,2,3}-drill.pdf` 各 6 页 RESULT: PASS；全 16 包 48 组合题干扫描 0 条超限，全局 480×3 条句式查重 0 重复。

跨包混合卷（应用题）：

`node scripts/pilot-drill.ts --mix '3A-U5|word|L2,3A-U6|word|L2,3A-U1|word|L2' --count 30 --seed 20261103 --slug mix-3 --pdf --check`

| 混合卷 | 构成 | 题量 | 句式 | 场景 | 数值 | 跨组合撞车 | 复核 | 排版 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mix-3 | 年月日 10 + 周长 10 + 两步四则 10（L2） | 30 | 30 | 30 | 30 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-mix-3-drill.pdf` 6 页，3 个节标题间距 PASS、碰撞 0 |

## 十三、包 11（3A-U7 马拉松路线 · 填空）三档实测

命令（三档共用 30 条骨架与 30 张 `ROUTE_SCENES`）：

- `node scripts/pilot-drill.ts --combo '3A-U7|tiankong|L1' --count 30 --seed 20261103 --sample 30 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U7|tiankong|L2' --count 30 --seed 20261103 --sample 30 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U7|tiankong|L3' --count 30 --seed 20261103 --sample 30 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-fill-l1-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-fill-l3-drill.pdf` 2 页 RESULT: PASS |

三档分工：

- L1 千米与米换算，含反向（米→千米、米→「千米；米」复名数拆分）。
- L2 路程分段求和或比较：两段和、第二段差、来回次数、剩余。
- L3 多段路线综合或往返：三段求和、多段相减、往返、按天累计与最后一天折减。
- 30 条骨架 5 类做法各 6 条：`d1–d6` 直接、`i1–i6` 逆向、`c1–c6` 比较、`p1–p6` 组合、`m1–m6` 多步。

单位口径：

- 空位自带单位；答案单位由 `answerUnits` 逐空指定，禁止「问米答千米」。复名数两空固定「千米；米」，如「3500 米 = 3 千米；500 米」。
- 题干里出现的数值一律带单位（千米或米），不再使用「百米」这种非教材写法；单题内只做「同一长度换单位」，不做跨单位心算比较。
- 每句最多 2 空；2 空答案用「；」分隔。

逐句自评后返工（6 类）：

1. 「6 百米」「3 千米 4 百米」非教材写法 → 全包改成「{a} 千米 {b} 米」或纯米，`百米` 0 处残留。
2. L2 `d4`「走了 2 个来回」按 `a*b` 只算两趟 → 改「往返 {b} 次」并用 `2*a*b`。
3. 多个骨架共用同一句（`去时…回来多…往返共`、`每天跑…天共跑`、`一段…千米，一段…米`）导致句式撞车 → 分别改成「两趟共 / 来回共 / 往返共」「连续 {b} 天」「{a} 千米的路比 {b} 米的路长」。
4. `d6 / i3 / i4` 的「米→千米；米」窗口用 1000/2000 步长，取整锚点落到整千米上，余数为 0 → 步长改 500 并保留余数 guard。
5. L3 `p5`「每天 100 米，5 天，最后一天少 150 米」出现负数 → guard 增加 `c < a`。
6. L3 `i5 / i6 / m3 / m5 / m6` 的 10–90 米副段读起来像「6 千米 20 米」，改为 100–900 米。

跨包混合卷（填空）：

`node scripts/pilot-drill.ts --mix '3A-U7|tiankong|L2,3A-U6|tiankong|L2,3A-U1|tiankong|L2' --count 30 --seed 20261103 --slug fill-mix-3 --pdf --check`

| 混合卷 | 构成 | 题量 | 句式 | 场景 | 数值 | 跨组合撞车 | 复核 | 排版 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fill-mix-3 | 马拉松 10 + 周长 10 + 两步四则 10（L2） | 30 | 30 | 30 | 30 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-fill-mix-3-drill.pdf`，RESULT: PASS |

## 十四、包 12 / 包 13（三上收尾两包）三档实测

命令（三档共用 30 条骨架，只换数值域与句式结构）：

- `node scripts/pilot-drill.ts --combo '3A-U8|tiankong|L1' --count 30 --seed 20261104 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U8|tiankong|L2' --count 30 --seed 20261104 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U8|tiankong|L3' --count 30 --seed 20261104 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U9|tiankong|L1' --count 30 --seed 20261104 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U9|tiankong|L2' --count 30 --seed 20261104 --pdf --check`
- `node scripts/pilot-drill.ts --combo '3A-U9|tiankong|L3' --count 30 --seed 20261104 --pdf --check`

### 14.1 包 12：3A-U8 数学广场 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-fill-l1-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-fill-l3-drill.pdf` 2 页 RESULT: PASS |

三档分工（30 条 = 直接 / 逆向 / 比较 / 组合 / 找规律，各 6 条）：

- L1 单点辨认或直接求：七巧板 7 块与 5 块三角形、摆 1 个正方形 4 根、正方形周长、三边篱笆、边长相差。
- L2 两步：长边 / 宽边靠墙篱笆、留门、反求长或宽、长方形改正方形、七巧板乘加、照规律第 n 个。
- L3 最值或判断：宽最大 / 长最大、最多摆几个并剩余、四边篱笆反推、两块并排与围两圈、边长加 1 后比较。
- 与 U6 周长包不撞车：U6 沿用「卡片 / 丝带 / 花坛」等既有场景（厘米与米各半）与「沿长宽中点剪」等句式；U8 统一改为「一块长方形菜地」+ 米场景，混合卷实测题干 0 / 句式模板 0 撞车。

逐句自评后返工（8 类）：

1. 场景池 `MATH_PLAZA_SCENES` 的 `unit` 与 `cls` 两个参数写反，`{cls}` 取到「米」→ 造出「甲米长 8 米」「一米牧场」→ 32 张卡统一交换回「单位米 / 量词块、个、片、条、段」。
2. `{item}` 进入篱笆句会造出「给毛巾围篱笆」「围一个书包」→ 篱笆与几何句一律改固定名词「一块长方形菜地 / 一块正方形菜地」，`{item}` 只留在七巧板与小棒句。
3. 长宽倒挂：`u8f-c2` 出现「长 6 米、宽 12 米」，`u8f-i6` 出现「长 4 米、两条宽边共 18 米」→ `c2/i2/c6` guard 改 `a > 2b + 2 && a < 4b`（宽 ≥ 2 且严格小于长），`i6` 加 `a < 3b`。
4. L3 单槽骨架 `valuesKey` 只含数值 → `d4/d5/i3/i4/p3/p4/m1/m2` 的取值窗口全局互斥（3、5–7、9–12、13–16、17–20、21–24、25–28、29–32），`d6` L3 改双槽。
5. `u8f-m4` 与 `m5` 只差「4、7、10」与「3、5、7」，`textKey` 归一后完全相同 → `m5` 改「摆三角形按 3、5、7… 排」，L1 同步。
6. `u8f-i5` 的 `R(4,22,3)` 起锚跳到 6，`(a-1)%3===0` 永远不成立 → 去掉 step，用 4–22 / 25–40 加 guard 过滤。
7. 「最多摆几个，还剩 0 根」→ `d4/d5/i3/i4/p3/p4/m1/m2/m6` 的 L3 补余数非零 guard。
8. L3「宽最大 / 长最大」原写「宽最大 / 长最大」但 guard 未限制长宽关系 → 改为「宽 / 长」并加 `a < 3b` / `a > 3b` 的互斥约束。

### 14.2 包 13：3A-U9 复习 · 填空

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-fill-l1-drill.pdf` 2 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-fill-l2-drill.pdf` 2 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-fill-l3-drill.pdf` 2 页 RESULT: PASS |

三档分工（跨单元综合，全部在本册已学范围）：

- L1 基础复习：平年 / 闰年二月与全年、大月小月、千米与米换算、正方形周长、整十整百乘除、时刻加经过时间、送还求原。
- L2 两单元混合：年月日 + 时间（开始 / 结束 / 经过）、周长 + 乘除、单价 + 减法、路程 + 比较、除法 + 余数、平年闰年比较。
- L3 三步或综合判断：两次购买与找回、往返路程、休息扣减与反推开始、闰年跨年比较、围两圈、装箱后再加 1 每盒、两个平年合计。
- 范围红线：只出现本册已学的加、减、乘、一位数除、周长、年月日、时分、千米与米；U1/U2 口吻 0 处除法、0 处平均分、0 处两位数除法。

逐句自评后返工（7 类）：

1. `{item}` 进时间 / 篱笆 / 几何句造出「巧克力 17 时 20 分结束」「给一条毛巾围篱笆」「李老师的长方形粉笔」→ 时间句固定「看动画片 / 做手工」，篱笆与几何句固定「一块长方形菜地 / 长方形纸片」，除法与购物句固定「橡皮 / 彩笔 / 笔记本 / 苹果 / 文具盒」。
2. 答案单位与问句不一致：「每人 4 个」「每盒 9 个」→ 按新名词改 `unit` 与 `answerUnits`（支 / 块 / 盒 / 分钟），`i3` L3 单空改 `answerUnits: ['分钟']`。
3. 「16 时 0 分结束」「12 时 0 分出发」→ 时间类 L1/L2/L3 统一补「分钟非 0、总分非 60 倍数」guard。
4. 平年二月写成 26 / 27 天 → `u9f-c2` 固定为真实 28 / 29 天，答案恒 1 天。
5. 「2019 年全年 365 天，比平年多 0 天」→ `u9f-d3` L3 加 `yearDays(y) > 365`，只出闰年。
6. 买本价格前后不一致（2 本 22 元、7 本 40 元）→ `c3` 统一「每本 {c} 元」：L1 单买、L2 两次比多花、L3 两次合计。
7. `u9f-m3` 题干 49 字超上限 → 压成「路上来回各 {n} 分钟，办事 {r} 分钟」，去掉一个槽位，实测 34 字。

### 14.3 跨包混合卷（三上全部填空）

`node scripts/pilot-drill.ts --mix '3A-U8|tiankong|L2,3A-U9|tiankong|L2,3A-U6|tiankong|L2,3A-U7|tiankong|L2,3A-U5|tiankong|L2' --count 30 --seed 20261104 --slug fill-mix-4 --pdf --check`

| 混合卷 | 构成 | 题量 | 句式 | 场景 | 数值 | 跨组合撞车 | 复核 | 排版 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fill-mix-4 | 数学广场 6 + 复习 6 + 周长 6 + 马拉松 6 + 年月日 6（均 L2） | 30 | 30 | 30 | 30 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-fill-mix-4-drill.pdf` 2 页 RESULT: PASS |

### 14.4 多 seed 回归

两包 × 三档 × seed `20261104 / 111 / 222 / 333 / 444 / 555` 共 36 次组卷，全部 30/30/30/30、三项 0 重复、独立复核 PASS；`npx vue-tsc -b` 通过。

## 十五、三上完工小结

口径：三上 9 个单元中 U3 三角形与四边形为图形单元、不纳入计算骨架，其余 8 个单元 × 2 题型 = 16 个包位。16 个包位全部升包完成。

| 单元 | 填空包 | 三档（题量/句式/场景/数值/做法） | 应用题包 | 三档（题量/句式/场景/数值/做法） |
| --- | --- | --- | --- | --- |
| 3A-U1 两步四则 | ✅ 包 8 | 30/30/30/30/6 | ✅ 包 3 | 30/30/30/30/6 |
| 3A-U2 用一位数乘 | ✅ 包 7 | 30/30/30/30/6 | ✅ 包 5 | 30/30/30/30/6 |
| 3A-U3 三角形与四边形 | — 图形单元 | — | — 图形单元 | — |
| 3A-U4 用一位数除 | ✅ 包 6 | 30/30/30/30/6 | ✅ 包 2 | 30/30/30/30/6 |
| 3A-U5 年、月、日 | ✅ 包 4 | 30/30/30/30/6 | ✅ 包 10 | 30/30/30/30/5 |
| 3A-U6 周长 | ✅ 包 9 | 30/30/30/30/5 | ✅ 包 1 | 30/30/30/30/6 |
| 3A-U7 马拉松路线 | ✅ 包 11 | 30/30/30/30/5 | ✅ 包 14 | 30/30/30/30/5 |
| 3A-U8 数学广场 | ✅ 包 12 | 30/30/30/30/5 | ✅ 包 15 | 30/30/30/30/5 |
| 3A-U9 复习 | ✅ 包 13 | 30/30/30/30/5 | ✅ 包 16 | 30/30/30/30/5 |

- 已完成 16 / 16 个包位（100%），全部三档 30 题、三项 0 重复、独立复核 PASS、PDF/check-layout PASS。
- 剩余缺口 0。
- 样张：各包三档 PDF 在 `samples/pilot-<slug>-l{1,2,3}-drill.pdf`；跨包混合卷 5 份（fill-mix-1..4 + `final-mix-16`）。

## 十六、下一轮起点

三上填空已收口，三下从 **3A 迁移成本最低、剪刀差最大的 3B-U2 用两位数乘除·应用题**起手：已有 L3 30 条骨架（`u2-muld.ts`），只补 L1/L2 两档与场景池即可升包。随后按下面顺序推进：

1. **3B-U2 用两位数乘除 · 应用题**：补 L1（两位数×整十 / 表内除）、L2（两位数×两位数 / 两位数除），禁三位数乘除与超纲口吻。
2. **3B-U6 面积 · 应用题**：已有 L2 30 条（`u6-area.ts`），补 L1 面积单位与直接求、L3 组合图形与边长变化。
3. **3B-U4 分数初步 · 填空**：新建 30 条骨架（`fraction / fractionUnit` 规则已就绪），只做填空。
4. **3B-U1 / 3B-U7 复习包**：复用三上已升包的骨架与场景，换数值域。
5. 三上剩余 3 个应用缺口（U7 / U8 / U9）排在 3B 主链之后，避免打断三下节奏。

每个包的固定工序不变：30 骨架（沿用已有则只写 bands）→ 场景池 → 三档跑 30 题统计 → 30 题逐句自评并返工 → PDF + check-layout → 跨包混合卷 → 立刻写回本文件「二、包进度」与本节明细，再开下一个。

## 十七、包 14（3A-U7 马拉松路线 · 应用）三档实测

命令（三档共用 30 条骨架与 30 张 `ROUTE_SCENES`）：

- `npx tsx scripts/pilot-drill.ts --combo '3A-U7|word|L1' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U7|word|L2' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U7|word|L3' --count 30 --seed 20261104 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-word-l1-drill.pdf` 4 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-word-l2-drill.pdf` 4 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u7-marathon-word-l3-drill.pdf` 6 页 RESULT: PASS |

三档分工：

- L1 单段路程或千米/米换算：km→m、km+m→m、m→km、m→「千米；米」，不跨段求和。
- L2 分段求和或比较：两段和、剩余、往返、按天累计、两条路线相差。
- L3 多段综合或往返：三天累计、去回少走/多走、四段拆分、往返多次，每题带 2 问时留白 4 行、3 问 6 行。
- 30 条骨架 5 类做法各 6 条：`d` 直接、`i` 逆向、`c` 比较、`p` 组合、`m` 多步。

口径与返工（本轮修掉 4 类）：

1. 题干 ≤45 字按“最坏场景名（4/4/3 字）+ 最大数值”校验，L3 16 条超限 → 压掉重复的 `{person}/{item}`、把“比…多/少”压成“多/少”，两问改成短问句，最长 45 字。
2. `u7w-m4 / p5 / p6` 的 L1 原写两段求和，与“L1 单段”不符 → 改为纯 km+m 换算。
3. `u7w-p2` L3 原写“前 b 天照常，最后一天多跑 c”却按 `a*b+c` 算，少算最后一天 → 改成“共 b 天，最后一天多跑 c”，公式仍 `a*b+c`。
4. 单槽骨架的数值窗口按骨架分配互斥区间（2–4、5–9、10–15、16–20、21–23、24–26、27–29、2000–4000、5500–9500、10000–13000、14000–17000 千米/米），避免 30 题数值撞车。

多 seed 回归：三档 × seed `20261104 / 111`，全部 30/30/30/30、三项 0 重复、独立复核 PASS；`npx vue-tsc -b` 通过。

## 十八、包 15（3A-U8 数学广场 · 应用）三档实测

命令（三档共用 30 条骨架与 32 张 `MATH_PLAZA_SCENES`，`matchSceneUnit: false`——答案含 根/块/个/元）：

- `npx tsx scripts/pilot-drill.ts --combo '3A-U8|word|L1' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U8|word|L2' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U8|word|L3' --count 30 --seed 20261104 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-word-l1-drill.pdf` 4 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-word-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u8-math-plaza-word-l3-drill.pdf` 4 页 RESULT: PASS |

三档分工：

- L1 单点辨认或直接求：正方形周长、三边篱笆、留门、七巧板块数、单独摆图形的根数。
- L2 两步：四边篱笆、靠墙三边、留门、七巧板平均分、连排摆剩几根、找规律相差、两块篱笆相差。
- L3 最值或判断：篱笆长最多、靠墙两种围法省多少、并排拼框少围多少、七巧板/小棒“最多摆几个、还剩几根”、找规律对比。
- 30 条骨架 5 类做法各 6 条：`d` 直接、`i` 逆向、`c` 比较、`p` 组合、`m` 找规律。

口径与返工（本轮修掉 7 类）：

1. `matchSceneUnit:true` 导致 根/块/个/元 骨架“可用场景 0” → U8 应用包统一 `matchSceneUnit:false`，篱笆/边长类骨架自己写“米”。
2. `u8w-m6` 基线 `answerUnits:['个','根']` 被 L1 继承，单问“还剩多少根”被要求出现“个” → L1 显式 `answerUnits: []`。
3. 单槽骨架数值耗尽（L2 `u8w-i6` 11200 次、L3 `u8w-d6`）→ i6/c6/p4/p6/m6 改双槽；L1 23 条单槽骨架按骨架分配互斥数值窗口（2–3、4–5、6–7、8–9、10–11…40–44、45–47、48–52、53–55、56–57、58–60），彻底消除撞值。
4. 题干尾部自带问句 + `asks` 重复（`u8w-c1/c5/m5/p2`、`u8w-c2/c4/c6`）→ 模板只留情境并以“。”结尾，问句统一进 `asks`。
5. `u8w-d4` L3“宽边靠墙”原用 `p-2`，实际应为 `p/2-1`（两长 + 一宽 = p，宽≥1）→ 已改正，68 米时答案 33 米。
6. `u8w-d5` L3 原 `p` 步长 4、门宽 1–3，`(p+c)/4` 永不为整数 → 改为 `p` 步长 2 且 `(p+c)%4===0`，保证边长唯一。
7. `u8w-i6` 基线段补 `(n-r-1)%3===0`，避免“剩几根”算出小数；`u8w-p6` “再接”改为“再连排摆”，与 `2a+3b+2` 的“两排独立”口径一致。

与 U6 应用的互斥：三档各跑一次归一化 textKey 对比（模板+asks 去数字、去场景占位），U6 30 条 × U8 30 条，L1/L2/L3 撞车均为 0；几何对象统一写“长方形/正方形{item}”，不使用 U6 的“一{cls}…沿长宽中点剪/贴彩带”句式，尺寸取 3–60 米，避开 U6 的厘米池。

多 seed 回归：三档 × seed `20261104 / 111`，全部 30/30/30/30、三项 0 重复、独立复核 PASS；`npx vue-tsc -b` 通过。

## 十九、包 16（3A-U9 复习 · 应用）三档实测

命令（三档共用 30 条骨架与 32 张 `REVIEW_SCENES`，`matchSceneUnit: false`）：

- `npx tsx scripts/pilot-drill.ts --combo '3A-U9|word|L1' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U9|word|L2' --count 30 --seed 20261104 --pdf --check`
- `npx tsx scripts/pilot-drill.ts --combo '3A-U9|word|L3' --count 30 --seed 20261104 --pdf --check`

| 档 | 题量 | 句式去重 | 场景去重 | 数值去重 | 做法 | 独立复核 | 样张 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-word-l1-drill.pdf` 6 页 RESULT: PASS |
| L2 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-word-l2-drill.pdf` 6 页 RESULT: PASS |
| L3 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） | 5（各 6 条） | PASS | `samples/pilot-u9-review-word-l3-drill.pdf` 6 页 RESULT: PASS |

三档分工与知识点融合：

- L1 基础复习：数值收窄，两到三步；例如“长方形花坛围篱笆×每米价钱”（周长+乘法）、“4 月每天读几页”（年月日+乘法）、“先走几千米几米再走几米”（千米换算+加法）、“铁丝围正方形求边长”（周长+除法）。
- L2 综合：数值取中段，保持两到三步；新增“时刻+经过时间”“相框周长反求宽”“两天路线比较”等。
- L3 提高：数值放大但仍在本册上限内（答案最大 7400 米），步数不变；“两年 2 月共写多少字”“花坛摆花盆”“买彩笔再平均分”等多知识点串联。
- 30 条骨架 5 类做法各 6 条：`d` 直接、`i` 逆向、`c` 比较、`p` 组合、`m` 多步；每题都至少融合两个知识点（U1 两步四则、U2 一位数乘、U4 一位数除、U5 年月日、U6 周长、U7 千米与米、U8 数学广场）。

口径与返工（本轮修掉 5 类）：

1. 场景是 `REVIEW_SCENES` 的日常物品（铅笔、图书、糖果…），不能直接套“长方形铅笔长 8 米” → 几何题统一改成“长方形花坛 / 正方形花坛 / 长方形相框”，计数题统一用“个”，避免量词与场景物品冲突。
2. `u9w-i2` 反求宽时未约束“宽小于长”，出现长 22 厘米、宽 24 厘米 → 加 `p/2-a < a-2`，L1 的 `a` 下限同步抬到 7。
3. `u9w-m5` 只要求“周长能被间距整除”，但四个角都摆还要求边长能被间距整除 → guard 改为 `a%c===0`。
4. `u9w-c1` 原先用“长方形{item}”，场景换成铅笔后题干超限且语义不对 → 改为“甲长方形/乙长方形”，题干最大 41 字。
5. `u9w-c6` 题干 47 字 → 改为“闰年 2 月 29 天，平年 2 月 28 天”，降到 44 字。

硬规则核对：

- 题干 ≤45 字：三档逐条 `check-len`，最长 44（`u9w-c6`），无超限。
- 做法 ≥5：`direct / inverse / compare / compose / multistep` 各 6 条。
- 答案唯一：全部题在 guard 内整数可解；比较类方向词与算式一致（“多/少/还剩/最多”均按大数减小数或取整余数）。
- 留白按步数：1 步 2 行、2 步 4 行、3 步 6 行（`workLines` 与算式步数一一对应）。
- 30 题内三项零重复：句式、场景、数值均 0 重复。
- 跨包不撞车：与 3A 其余 15 个包逐档做归一化 textKey 对比，L1/L2/L3 撞车均为 0。
- U1/U2 口吻无除法：涉及千米加减、找规律乘加、单价×数量、七巧板的乘减等题只用加、减、乘；除法只出现在以 U4 为知识点之一的题（铁丝围正方形、平均分、装盒、摆花盆、彩笔再分配）。
- 本册上限：三档答案最大 7400（米），中间量最大 9900，均在万以内；乘数不超过三位数×一位数，除数不超过一位数。

多 seed 回归：三档 × seed `20261104 / 111`，全部 30/30/30/30、三项 0 重复、独立复核 PASS；`npx vue-tsc -b` 通过。

## 二十、三上 16 个包总验收（本轮收口）

验收口径：三上 8 个计算单元 × 2 题型 = 16 个包位；每包三档各 30 题，seed `20261104` 为主，本轮新增的 3 个应用包另跑 `111` 回归，其余 13 包沿用既有 `111 / 222 / 333 / 444 / 555` 记录。

### 20.1 逐包三档数字

| 包号 | 包 | 题型 | L1 | L2 | L3 |
| --- | --- | --- | --- | --- | --- |
| 1 | 3A-U6 周长 | 应用 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 2 | 3A-U4 用一位数除 | 应用 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 3 | 3A-U1 两步四则 | 应用 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 4 | 3A-U5 年、月、日 | 填空 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 5 | 3A-U2 用一位数乘 | 应用 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 6 | 3A-U4 用一位数除 | 填空 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 7 | 3A-U2 用一位数乘 | 填空 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 8 | 3A-U1 两步四则 | 填空 | 30/30/30/30/6 | 30/30/30/30/6 | 30/30/30/30/6 |
| 9 | 3A-U6 周长 | 填空 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 10 | 3A-U5 年、月、日 | 应用 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 11 | 3A-U7 马拉松路线 | 填空 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 12 | 3A-U8 数学广场 | 填空 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 13 | 3A-U9 复习 | 填空 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 14 | 3A-U7 马拉松路线 | 应用 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 15 | 3A-U8 数学广场 | 应用 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |
| 16 | 3A-U9 复习 | 应用 | 30/30/30/30/5 | 30/30/30/30/5 | 30/30/30/30/5 |

统计口径「30/30/30/30/p」= 题量 / 句式去重 / 场景去重 / 数值去重 / 做法数；16 包 × 3 档共 48 组合部为 30 题、三项 0 重复、独立复核 PASS，做法数最少 5。

### 20.2 跨包混合卷（30 题、16 个包全覆盖）

命令：

```bash
npx tsx scripts/pilot-drill.ts \
  --mix '3A-U1|word|L2,3A-U1|tiankong|L2,3A-U2|word|L2,3A-U2|tiankong|L2,3A-U4|word|L2,3A-U4|tiankong|L2,3A-U5|word|L2,3A-U5|tiankong|L2,3A-U6|word|L2,3A-U6|tiankong|L2,3A-U7|word|L2,3A-U7|tiankong|L2,3A-U8|word|L2,3A-U8|tiankong|L2,3A-U9|word|L2,3A-U9|tiankong|L2' \
  --count 30 --seed 20261104 --slug final-mix-16 --pdf --check
```

实测：

- 题量 30 | 句式 30 | 场景 30 | 数值 30 | 做法 7。
- 分组合：前 14 个包各 2 题，复习（应用/填空）各 1 题，16 个包全部出现。
- 跨包校验：场景撞 0 / 题干撞 0 / 句式模板撞 0。
- 独立复核 PASS；`samples/pilot-final-mix-16-drill.pdf` 4 页，check-layout RESULT: PASS。
- 混合卷标题超过 3 个组合时改为「跨组合混合卷 · N 个包」，避免 16 个单元名在页眉折行重叠（`scripts/pilot-drill.ts` 已做小改，≤3 组合保持原名）。

### 20.3 结论

- 三上 **16 / 16 个包位全部完工**，可以宣布三上整册收口；本轮新增 3 包（U7/U8/U9 应用）分别为包 14、15、16，包进度表与覆盖清单已同步。
- 三上新包均满足硬规则：题干 ≤45 字、做法 ≥5、答案唯一、方向词与算式一致、留白按步数、30 题内三项零重复、跨包零撞车。
- 本轮只收口三上，未向三下铺新包；三下起手包仍为 `3B-U2 用两位数乘除 · 应用题`。

## 附录 A1（历史）组合 1：3A-U6 周长 · 应用题 · L2 实测

命令：`node scripts/pilot-drill.ts --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30 |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u6-perimeter-drill.pdf` 6 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过 |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. 「铁丝围成一张正方形明信片」——明信片太小，铁丝不成立。改为「{person}有一根 {p} 厘米长的铁丝，正好围成一个正方形。」
2. 「画纸沿边跑两圈」——纸面不能跑。改为「沿四周贴两圈花边」。
3. 「两个长方形花园拼成一个大长方形」——未说拼法，答案有两种。改为「沿宽边拼成一个大长方形」。
4. 「沿长边剪成两个长方形」——剪法歧义。改为「沿长的中点剪成两个长方形」。
5. 场景池里 杯垫 / 明信片 / 书签 / 小镜子 与 20–60 厘米的长宽不符，换成 坐垫 / 手工纸 / 海报 / 镜子。
6. 黑板 12×8 米、展板周长 92 米、跑道 18×10 米 与学生作品尺寸不符，换成 舞台 / 空地 / 稻田；篮球场换成 羽毛球场。
7. 「每厘米彩带 5 元」单价失真，改为每厘米 1–2 元。
8. 篱笆/护栏/沿边跑 类骨架加 `sceneTags: ['outdoor']`，会场、舞台、游泳池不再配篱笆。

## 附录 A2（历史）组合 2：3A-U4 用一位数除 · 应用题 · L2 实测

命令：`node scripts/pilot-drill.ts --combo '3A-U4|word|L2' --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30 |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| 除法口径 | 整除 21 题；带余数（remainder）1 题；至少（ceil）1 题；最多（floor）2 题；判断 5 题 |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u4-division-drill.pdf` 6 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过 |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. 「甲班 64 人平均分成 4 组」——一个班 64 人不合常理，班级人数压到 32–48。
2. 「甲店 24 元买 2 个橘子」——合 12 元一个，单价失真；甲店单价限制在 2–9 元，乙店不低于 1 元。
3. 「每 3 米做一个蝴蝶结」——3 米彩带做一个蝴蝶结不成立；改为「每 3–5 米做一根跳绳」。
4. 「96 根玉米按每盒 2 根装」——每盒 2 根不常见；改为每盒 4–8 根或 10–12 根。
5. 「52 米彩带剪成 2 段」「72 支铅笔分给 2 个同学」——单段过长、人均过多；彩带压到 12–36 米，分铅笔人数改为 3–9 人。
6. 「41 个气球有 13 个盒子」容量余量过大但结论正确，保留为判断题的正常“够”样例。

## 附录 A3（历史）组合 3：3A-U5 年、月、日 · 填空 · L2 实测

命令：`node scripts/pilot-drill.ts --combo '3A-U5|tiankong|L2' --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30（填空，全部单句带 1–2 个空位） |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 空位与答案 | 每句空位数 = 算式数（`blank-count` 校验 30/30 通过），答案以“；”分隔 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| 时间口径 | 不跨零点；出发时刻用“最迟”，行程用“经过 N 分钟”，无“至少/最迟”混用 |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u5-date-drill.pdf` 2 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过 |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. 「一段英语角用了 75 分钟」——英语角不能论“段”，改为「第一场 / 第二场」。
2. 「下午 1 时到 18 时」——12 时制与 24 时制混用，改为「下午 1 时到下午 6 时」。
3. 「到达家长会」「到达科技节」——事件不能“到达”，改为按场景地点写「到达教室 / 到达科技馆」。
4. 「1990 年有 52 个星期零 1 天」——把年份当星期载体略生硬，保留但确认是全年级常见练法（365÷7=52……1）。
5. 跨月日期题（如「10 月 15 日到 11 月 2 日」）按“含头含尾”计天（19 天），与教材“从某日到某日一共几天”口径一致，已在 `daysBetween` 中固定。
6. 月天数、大月小月、闰年二月的题目前答案恒定（31/30/29），靠月份/年份与场景去重拉开题面，属于本单元填空的正常形态，不做人为改造。

补充：本轮为 `expr.ts` 的 `FUNCS` 补齐 `hourOf / minuteOf / wholeWeeks / restDays`，与 `verify.ts` 的独立实现分开维护；嵌套函数参数（如 `(h+12)*60-n`）独立复核无法归约，已改写为 `h*60+720-n` 等价式。

## 附录 A4（历史）组合 4：3A-U1 两步四则运算 · 应用题 · L1 实测

命令：`node scripts/pilot-drill.ts --combo '3A-U1|word|L1' --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30 |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| P0 红线 | 全文 0 处除法 / 余数 / 平均分 / 至少；乘法全在表内（≤81）；答案最大 109，仅 1 题三位数 |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u1-two-step-drill.pdf` 6 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过；组合 1/2/3 回归统计仍 30/30/30/30/6 且复核 PASS |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. `u1-c1`、`u1-c3` 模板末尾自带问句，`buildStem` 又追加 `asks`，出现「甲店少花多少元？甲店比乙店少花多少元？」——模板只留情境，问句全部进 `asks`。
2. `u1-c3` 出现「爷爷今年 11 岁」——年龄题要求 `sceneTags: ['kid']`，只配小学生场景。
3. `u1-d4` 出现「每个书包 3 元」——凡是写单价的骨架都要求 `cheap` 标签（单价 2–6 元成立），书包/篮球/铅笔盒/围棋/拼图不再进单价题。
4. `u1-m1` 出现「上午摘了 39 个气球」「26 个花」——动词改「拿来」，量词统一 `{cls}`，题面变成「26 朵花」。
5. `u1-m4` 出现「第一天跑了 44 米」——44 米不像跑步，整题改为跳绳（下），数值不变（109 下）。
6. `u1-j2` 出现「剩下的够 13 本吗」——改为「剩下的够分给 13 个人吗？」，并改成 `a+b-c>=d` 两步式（爷爷也能分给邻居/其他人）。
7. `u1-j3` 出现「体育老师每天写 5 个字」——改为每天读故事书（读完了 / 没读完），任何人物都成立。
8. `u1-i3` 的「仓库原有若干箱」等于让孩子先设未知数——删掉该分句，改为「上午运进…下午运进…现在有…，原来有多少箱」。
9. `u1-i4` 出现第一天 6 只、第二天 38 只——guard 增加「第二天不超过第一天的 2 倍」，保证两天数量合理。
10. `u1-p1`/`u1-p2`/`u1-j5`/`u1-j2` 人称与物品错配（叔叔有同学、菠菜配文具盒、12 元的铅笔）——改为「送给邻居」「又买了一个水杯」「买 12 元的书，再买 6 元的笔」「送出」。
11. `u1-c2` 出现「16 本本子」「美术老师有同桌」——场景物品改「练习本」，并要求 `bulk + kid`（只有学生才有同桌）。
12. `u1-d2` 出现「一盒有 6 盒牛奶」——改为「买了 3 份牛奶，每份 6 盒」。
13. `u1-i2` 出现「买盒牛奶」「39 元一盒牛奶」——改为「买了一盒牛奶」，单价上限压到 20 元。
14. 大数量的骨架（d1/d5/i1/p1/c2/d2/m1/j2）统一要求 `bulk` 标签，避免「35 把尺子」「37 副围棋」这类不合常理的成批数量。

补充：场景池从 30 张扩到 40 张（新增练习册/发卡/豆腐/橡皮泥/梨/糖葫芦/菠菜/酸奶/油画棒/豆角），并给 `Scene` 增加 `cheap / kid / bulk` 三个标签；`compatibleScenes` 的 `tags.every` 支持多标签同时命中。

## 附录 A5（历史）组合 5：3B-U2 用两位数乘除 · 应用题 · L3 实测

命令：`node scripts/pilot-drill.ts --combo '3B-U2|word|L3' --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30 |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 乘法口径 | 全部两位数 × 两位数：两个因数均 12–48 且都非整十数，必须分两层相乘（不存在表内乘法或整十数凑数） |
| 除法口径 | 全部两位数除三位数：被除数 100–999，除数 12–48 且非整十数，商 2–9（真实试商）；整除 20 题、带余数 1 题、最多 2 题、至少 2 题、判断 5 题 |
| 余数与差额 | remainder / floor 题答案直接写「……还剩 N」；ceil 题在解题步骤里显式给出「被除数 ÷ 除数 = 商……余数」再 +1；判断题步骤并列两侧数值（乘积与总量）后下结论 |
| 数值上限 | 乘法积 ≤1600，单价题总价 ≤1200（四位数以内，无五位数）；「至少/最多」为数量下界，未出现出发时刻类题目 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u2-muld-drill.pdf` 6 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过；组合 1/2/3/4 回归统计仍 30/30/30/30/6 且复核 PASS |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. 花盆、牛奶被配进「每箱重 N 千克 / 每箱装 N 千克」——按千克计重的物品只留箱装货物（矿泉水/苹果/梨/积木/大米/面粉），`care` 标签收回。
2. 「18 箱矿泉水，每箱装 24 箱」——量词为「箱」的物品又进「每箱装 N 箱」句，去掉这些场景的 `boxed` 标签。
3. 「532 辆汽车平均分给 19 个班，每班再分给 2 个组」——分班/分组句只配 `class` 标签（图书/作业本/铅笔/彩笔/球类/拼图/水杯/字典/饭盒等）。
4. 「593 台打印机分给 19 人，每人 24 台」——判断题改为「每辆车坐多少人、有几辆车、坐得下吗」，并只用 `team` 场景。
5. 「机房开会」——开会句加 `hall` 标签（礼堂/学校/展厅/办公室），机房不再配。
6. 「24 桶油漆桶」——场景物品由「油漆桶」改为「油漆」，量词「桶」不再重复。
7. 「师傅买 14 桶油漆，又花 17 元买文具」——人称与物品错配，改为「又买了一个 17 元的水壶」。
8. 「店员运来两批笔记本」——「运来」与部分人称错配，改为「{place}新到两批……」。
9. 「姐姐买副手套」——补「了」：改为「姐姐买了副手套」。
10. 「215 千克积木装 43 箱，每箱卖 38 元」原为「每箱装 24 套校服、每箱 48 元」（合 2 元/套）——按箱卖价失真，改为按千克装箱、每箱卖价的重量题。
11. 比较做法里两处「两批独立整除 + 商比较」参数命中率仅 0.01%，必然配不出题——`u2-c3` 改为同一批货「按 b 个班分 / 改成按 c 个班分」，`u2-c4` 改为两区「每排数 × 排数」比较。
12. 稀缺标签场景被宽泛骨架先抢走，导致「判断题要 price 场景时已无可用场景」——`assemble.ts` 增加「可用场景少的骨架优先配场景」排序；`MULDIV_SCENES` 由 30 张扩到 40 张。
13. 判断题结论不成立时，解法最后一句原样打印原比较符，出现「627 ≤ 420，所以不够」——`judgeSteps` 在结论不成立时改写为取反关系（「627 > 420，所以不够」），组合 1–4 的判断题解法同步受益。

补充：本轮为 `Scene` 新增 `rowed / boxed / care / price / class / team / hall` 七个组合 5 专用标签；`u2-muld.ts` 的 30 条骨架全部带 guard，乘法 guard 统一「两位数 + 非整十数 + 积 ≤1600」，除法 guard 统一「三位数 ÷ 两位数 + 非整十除数 + 商 2–9」。

## 附录 A6（历史）组合 6：3B-U6 面积 · 应用题 · L2 实测

命令：`node scripts/pilot-drill.ts --combo '3B-U6|word|L2' --count 30 --seed 20261103 --pdf --check`

| 指标 | 结果 |
| --- | --- |
| 题量 | 30 |
| 句式（骨架）去重数 | 30（0 重复） |
| 场景去重数 | 30（0 重复） |
| 数值去重数 | 30（0 重复） |
| 做法覆盖 | 6：直接求 5 / 逆向求 5 / 比较与最值 5 / 组合与拆分 5 / 多步合成 5 / 判断与验证 5 |
| 单位口径 | 平方米 12 / 平方分米 6 / 平方厘米 12；题干、问句、答案、场景四者同一档，0 处跨档换算 |
| 尺寸口径 | 室内 12–54 平方米、院子 30–120、场地 120–450；桌面 96–200 平方分米、玻璃/展板 24–160、方砖 16–64；书本照片类 10–26×8–20 平方厘米、邮票 6–12、书签贺卡类 60–150 |
| 铺砖口径 | `u6a-m-tile`、`u6a-j-tile` 都显式给出地砖边长；前者要求长、宽都能被边长整除（`(a/c)*(b/c)`），后者用「n 块边长 c」与地面面积比对，余量由结论体现 |
| 余数与取整 | 多步合成 2 题（`m-yard` / `m-big`）用 floor 口径，答案写「最多…，还剩…平方米/平方厘米」，步骤先列 `÷` 的商与余数 |
| 独立复核 | PASS（30/30，答案按参数重算，单位与问句一致） |
| 题干长度 | 全部 ≤45 字 |
| 排版 | `samples/pilot-u6-area-drill.pdf` 6 页，check-layout `--compact` RESULT: PASS（字符碰撞 0） |
| 类型检查 | `npx vue-tsc -b` 通过；组合 1–5 回归统计仍 30/30/30/30/6 且复核 PASS |

教师自评（抽 30 题逐句读）发现并已修掉的问题：

1. 量词层叠「块块地砖」「张张邮票」「一块张餐桌桌面」「一个张方巾」——所有模板统一为「一{cls}{item}」「{n} {cls}{item}」「每{cls}」，不再手写量词。
2. 「菜园的菜地 97 平方米」——场所与物品语义重复，改为「一块{item} {a} 平方米」。
3. 「篮球场长 16 米、宽 15 米」与小学场地不符——删除该场景，field 池保留操场/草坪/停车场/仓库/果园。
4. 「厨房长 7 米、宽 2 米」「阳台宽 2 米」过窄——删除厨房/阳台，新增办公室/阅览室；室内宽下限提到 3 米。
5. 「餐桌桌面 57 平方分米」过小、「玻璃 50 平方分米」过大却共用槽位——拆 `panel`（玻璃/展板 24–160）与 `table`（桌面 96–200）两个标签。
6. 「贺卡 42 平方厘米（长 14、宽 3）」与邮票共用槽位——拆 `tiny`（邮票 6–12）与 `flat`（书签/卡片/贺卡 60–150，宽 5–10）。
7. 「每块 62 平方分米的地砖」不真实——方砖改为「给定边长 3–8 分米」，面积由边长平方得出。
8. 「会议室 14 平方米，一块地毯 45 平方米」夸张——`j-room` 增加 `c ≤ a*b+12` 的 guard。
9. 「书皮 5 分米 × 3 分米」（50×30 厘米）不合书本尺寸——场景物品改为「包书纸」。
10. 「每张桌子占 2 平方米」配到卧室/书房——新增 `seat` 标签（教室/办公室/阅览室/会议室），坐人类判断只配这四类。
11. 「已经铺好 / 每天铺」配到果园——新增 `surface` 标签（操场/草坪/停车场/仓库），铺装类多步题只配这四类。
12. 「要剪成小块」配到镜面、鼠标垫、拼图——新增 `papery` 标签（试卷/奖状/课本封面/明信片/彩纸/卡纸），裁剪类判断只配可剪纸品。
13. 邮票只有 1 张场景，判断题仍要求 `n*s` 落在 30–240，并用 6–12 平方厘米的真实邮票面积，避免「一张邮票 100 平方厘米」。

补充：`AREA_SCENES` 由 30 张双档重构为 47 张三档（平方米 18 / 平方分米 11 / 平方厘米 18），新增 `seat / surface / panel / table / tile / big / papery / flat / square / paper / tiny` 十一个面积专用标签。

## 附录 A7（历史）全 6 组合汇总

| # | 组合 | 骨架（句式） | 做法 | 场景池 | 30 题句式去重 | 场景去重 | 数值去重 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3A-U6 周长 · word · L2 | 30 | 6 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 2 | 3A-U4 用一位数除 · word · L2 | 30 | 6 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 3 | 3A-U5 年、月、日 · tiankong · L2 | 30 | 6 | 30 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 4 | 3A-U1 两步四则运算 · word · L1 | 30 | 6 | 40 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 5 | 3B-U2 用两位数乘除 · word · L3 | 30 | 6 | 40 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 6 | 3B-U6 面积 · word · L2 | 30 | 6 | 47 | 30（0 重复） | 30（0 重复） | 30（0 重复） |
| 合计 | 6 个组合 | 180 | 6 做法 × 6 组合 = 36 个做法槽 | 217 | — | — | — |

补充说明：每个组合的 30 条骨架 = 6 做法 × 5 句式（硬规则要求每做法 2–3，这里统一写到 5 条）；30 张卷面题正好一条骨架出一题，因此「句式去重 30」等价于「30 条骨架全部用到」。场景池大于 30 的组合，多出的场景用于标签匹配与跨组合混合卷。

### 跨组合混合卷

命令（新增 `--mix`，共享同一套 used 集合）：

- `node scripts/pilot-drill.ts --mix '3A-U6|word|L2,3A-U4|word|L2,3B-U6|word|L2' --count 20 --seed 20261103 --slug mix-1 --pdf --check`
- `node scripts/pilot-drill.ts --mix '3A-U1|word|L1,3B-U2|word|L3,3A-U5|tiankong|L2' --count 20 --seed 20261103 --slug mix-2 --pdf --check`

| 混合卷 | 组合构成 | 题量 | 句式 | 场景 | 数值 | 做法 | 跨组合撞车 | 复核 | 排版 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mix-1 | 周长 7 + 一位数除 7 + 面积 6 | 20 | 20 | 20 | 20 | 6 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-mix-1-drill.pdf` 3 节 PASS |
| mix-2 | 两步 7 + 两位数乘除 7 + 年月日（填空）6 | 20 | 20 | 20 | 20 | 6 | 场景 0 / 题干 0 / 句式模板 0 | PASS | `samples/pilot-mix-2-drill.pdf` 3 节 PASS |

结论：6 个组合虽共用 `人物 / 物品 / 场所` 这类常见场景（如「小明 / 照片 / 家里」「师傅 / 地砖」），但场景去重键是三元组，且 `used` 集合跨组合共享，因此混合卷 40 题内场景、题干、句式模板均 0 撞车；填空与应用题混排时，`paper.typ` 按 section 的 `kind` 正常分区，三节标题间距与碰撞检查均 PASS。

## 附录 A8（历史）铺到全册 60 个组合的骨架量与工作量判断

按本轮实测数据外推（6 组合 = 180 条骨架 / 217 张场景卡 / 6 套标签体系）：

1. **骨架量**：60 组合 × 30 条 = 1,800 条。但做法与句式结构可跨单元复用（周长与面积的长方形/正方形、乘除与一位数除的分装/均分、两步与多步的「先…再…」都是同构模板），实际需要新写的独立模板约 1,200–1,300 条；其余可由「同模板 + 换数值域 + 换场景标签」派生。判断依据：本轮的 180 条里，去掉数值与场景后，真正不同的句法骨架约 120 条。
2. **场景卡**：60 组合若各自建池，约需 2,100 张；但同一张「人物|物品|场所」卡可跨组合复用（本轮 217 张里有约 1/4 是概念重复，例如「师傅/地砖」在乘除与面积各出现一次）。做成统一场景库后，预计 900–1,200 张即可覆盖，建议先落 600 张通用卡，再按单元补 300–400 张专业卡（面积/周长/年月日各有专属物品）。
3. **每组合固定工序**（按本轮 6 次的同样流程）：写 30 条骨架 → 配 30–47 张场景（含标签）→ 跑 30 题统计 + 独立复核 → 抽 30 题逐句教师自评 → 返工 1–3 轮（尺寸/量词/单位/可行性）。真正耗时的不是「跑通 30/30/30/30/6」（一次通常就能过），而是逐句自评与返工：组合 6 一轮就修了 13 处，组合 5 修了 13 处，组合 4 修了 14 处。
4. **估算法**：不要按「60 × 每组合小时数」拍脑袋，按「每组合 = 1 个工序包（30 骨架 + 30–47 场景 + 3 轮审读）」折算。全册 60 个 ≈ 60 个工序包；其中约 12–15 个可复用已有结构（周长/面积同构、乘除/除法同构、两步/多步同构），这部分的边际成本主要是场景与数值域。
5. **必须先补的基础设施**（否则 60 组合会重演本轮返工）：
   - 场景卡加「尺寸档位」字段（纸片/桌面/场地/书本），让同一标签下的骨架能按真实尺寸取值，而不是靠 guard 手调；
   - 稀缺标签先算可行场景数（如邮票只有 1 张），`assemble.ts` 的「可用场景升序」排序只能缓解、不能兜底；
   - 单位口径做成组合级约束（题干/问句/答案/场景同一档），面积与周长这类带度量单位组合必须显式 `matchSceneUnit`；
   - 每组合保留一条「反例清单」（本轮 13 条），下一组合开写前先对照，避免同类错误重复出现。

## 附录 A9（历史）旧版下一轮起点

试点 6 组合已完成，下一步若铺向全册，建议先做三件事再做新组合：
1. 把 180 条骨架按做法归类，抽出可复用的句法模板（预计能压到约 120 条独立模板）；
2. 合并跨组合重复的场景卡（如「师傅/地砖」「小明/照片」），建立统一场景库并补尺寸档位；
3. 把本文件各节的「教师自评反例清单」固化成组合开写前的检查项，再启动第 7 个组合。

## 二十一、0.4.0 第一项：3A-U3 图形骨架包（填空 + 应用）

口径：沪教版三上「三角形与四边形」。只做角的初步认识（直角 / 锐角 / 钝角辨认）、三角形与四边形的辨认分类、图形拼摆；不写角度数字、不做面积与周长计算、不引入三角形内角和推导。图形题统一文字左、图右，新增图元不改既有 `geom-fig` 分支。

### 21.1 新增文件

| 文件 | 内容 |
| --- | --- |
| `src/quiz/skeleton/u3-shapes-fill.ts` | 填空 L1 基线 30 条（6 做法 × 5） |
| `src/quiz/skeleton/u3-shapes-fill.bands.ts` | 填空 L2/L3 各 30 条 |
| `src/quiz/skeleton/u3-shapes-word.ts` | 应用 L1 基线 30 条（6 做法 × 5） |
| `src/quiz/skeleton/u3-shapes-word.bands.ts` | 应用 L2/L3 各 30 条 |
| `src/quiz/skeleton/u3-figures.ts` | 角度 / 三角形 / 四边形 / 拼摆 / 对角线 / 2×2 方格图元，mm 坐标 |
| `scenes.ts` 新增 `SHAPE_SCENES` | 32 张「人物｜物品｜场所」卡，人物、物品、场所三元组唯一 |

模型与排版：`FigureSpec / answerChoices` 贯通 skeleton → assemble → app types → Typst；`paper.typ` 新增 `fig-stroke` 与 `draw-fig`，填空 `item-body` 用 `grid(1fr,auto)`、应用用 `(left+top,right+top)`，文字与图形同题右对齐，原有静态 `geom-fig('rect'/'square')` 未改。

### 21.2 六组合验收（seed `20261104`，每题 30）

命令统一为 `npx tsx scripts/pilot-drill.ts --combo '3A-U3|...' --count 30 --seed 20261104 --slug ... --pdf --check`。

| 组合 | 题量 / 句式 / 场景 / 数值 | 做法 | 独立复核 | PDF 页数 | check-layout |
| --- | --- | --- | --- | --- | --- |
| 填空 L1 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 5 | PASS（碰撞 0） |
| 填空 L2 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 5 | PASS（碰撞 0） |
| 填空 L3 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 6 | PASS（碰撞 0） |
| 应用 L1 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 5 | PASS（碰撞 0） |
| 应用 L2 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 6 | PASS（碰撞 0） |
| 应用 L3 | 30 / 30 / 30 / 30 | 6 × 5 | PASS | 6 | PASS（碰撞 0） |

样张：`samples/pilot-u3-shapes-l1-drill.pdf`、`-l2`、`-l3`，`samples/pilot-u3-shapes-word-l1-drill.pdf`、`-l2`、`-l3`。

第二颗种子 `20261105` 六组合复跑：题量 30、句式/场景/数值均 0 重复，独立复核全部 PASS。

### 21.3 教师视角逐句复核与返工

1. **全角标点挤压**：`？「`、`：「`、`」（` 会被排版压缩到字符框重叠，check-layout 判 FAIL。填空 L3 三处判断题、应用 L3 五处“说：…”与 L1 一处统一改为直接陈述，去掉引号，语义不变。
2. **题干超长**：应用 L3 `u3w-d4` 原题干 52 字，86% 尝试被 45 字上限拦下。改为「把长方形纸板剪成两个正方形」，问「两个正方形共有几个直角？原长方形有几个直角？」（8 / 4），保住双问与剪拼情境。
3. **同档换图不换问法**：填空基线 `p5` 原与 `p3` 都数“对角线分出几个三角形”，改为「两个三角形一共有几条边」（6）；填空 `p4` L2 原与 `p3` L2 都问“完全一样吗”，改为“每个三角形有几条边”（3）；应用 `p4` L2 改为“得到的两个三角形有直角吗”（没有）。
4. **四上表述**：「相邻两边不相等」共 6 处（填空 3、应用 3）改为三上可懂的「只有对边相等」；「两组对边分别平行」改为「两组对边都相等」。全包不再出现“平行（线）”“角度数字”“面积/周长”。
5. **包内同句式**：应用 L1/L2/L3 原有 6 组模板重复（如“一共几条边”两题、同一平行四边形只换问法），逐组改成不同观察维度（角数、直角判断、大小比较等），模板重复降为 0。
6. **测试同步**：`tests/fill-word.test.ts` 原以 3A-U3 作为“无规则单元”样例，U3 接入后改为断言填空/应用均走 `skeleton`，51 条单测全过。

### 21.4 回归与构建

- 既有四份成品样张 `scripts/app-check.ts` 重编 + check-layout：纯计算、纯填空、纯应用、三题型混合全部 PASS。
- `3A-U6|tiankong|L2` 重编：静态 `geom-fig` 长方形图形正常，check-layout PASS。
- `npx vue-tsc -b` 通过；`node --test tests/*.test.ts` 51/51 通过；`pnpm build` 通过。

### 21.5 如实说明

- U3 是图形单元，应用题的“多步合成”只能做到两图/三图计数、剪拼后判断与说理，不能像计算单元那样叠三步运算；六组合仍各写满 30 条，但每条都对应不同图形与不同观察点，没有靠换人名/换数字补量。
- 图元目前覆盖长方形、正方形、三角形、平行四边形及对角线/2×2 方格；梯形、圆等不在本单元口径内，未画。
- 三上包位由 16 个计算包 + U3 图形 2 包 = 18 个包，本轮完成第 17、18 包。

## 二十二、0.4.0 第二项：计算类欠账（换生成题 / 标不适用）

原则：先判断教材单元有没有这类题型；没有就不造题，参数面板标“不适用”并写明依据；只有教材确实承载的题型才换成生成题。三上不出现除法（U4 除外）、两位数除法、结合律/分配律。

### 22.1 逐项教材判定

| 单元 × 题型 | 判定 | 依据 |
| --- | --- | --- |
| 3A-U2 用一位数乘 × 简便运算 | **不适用** | `docs/题目质量评审-v0.3.0.md` P1-A1：沪教版乘法结合律、分配律在四年级，三上《用一位数乘》没有“简便运算”课时；`curriculum.ts` 原注释也写“教材未单列，作为拓展”。P1 已移除 U2/U9 的 `jianbian` 规则，本轮把 U2 的旧题库兜底也关掉。 |
| 3A-U5 年月日 × 脱式 | **不适用** | 本单元是年月日认识、24 时计时与经过时间，教材不设“脱式计算”题型；时间计算由填空/应用题承载。旧题库的 1 道静态题会造成“单元里有脱式”的错觉。 |
| 3A-U6 周长 × 脱式 | **适用** | 长方形周长公式 `(长+宽)×2` 本身就是两步计算，可用递等式表达；只生成这一种与单元对齐的式子。 |
| 3A-U7 千米（马拉松路线）× 口算/脱式 | **不适用** | 项目式“马拉松路线设计”单元，教材以千米/米换算、路线长度为载体，不设口算/脱式；路线计算由填空承载。 |
| 3A-U8 数学广场 × 口算/脱式 | **不适用** | 活动与图形玩法单元，不设口算/脱式；周长与图形玩法由填空/应用题承载。 |

> 术语说明：本节按当时的叫法记录“脱式计算”；沪教版教材用语为“递等式计算”，后已统一，历史记录保留原文不改。

### 22.2 实现

- `paperBuilder.ts` 新增 `NOT_APPLICABLE_CALC` 与 `source: 'na'`：选中的单元若全部属于“教材不适用”，该题型禁用、显示原因，并且**不再落到静态题库**；与支持该题型的单元混选时仍可生成。
- `ParamsPanel.vue` 的来源标签新增“不适用”，禁用项也会显示标签与原因；顺带修正单元提示“8 个单元（U3 暂未建包）”为“9 个单元”。
- `forms.ts` 的 `mix3` 新增 `(a+b)*2` 模式：固定乘 2，避免生成 `(长+宽)×3` 这类与周长无关的式子；支持 `minOperand`，L1/L2/L3 用不同数域。
- `curriculum.ts` 的 3A-U6 新增 `tuoshi` 三档规则：L1 `minOperand 1 / maxOperand 6 / maxResult 24`，L2 `5 / 40 / 160`，L3 `10 / 99 / 400`。
- `tests/calc-gaps.test.ts`：断言 U2/U5/U7/U8 的“不适用”口径，以及 U6 三档 30 题、固定乘 2、无除法、独立复算通过。

### 22.3 U6 周长脱式三档验收（seed `20261104`）

| 档 | 题量 / 唯一算式 / 唯一数值 | 答案范围 | 知识点 | 独立复核 | PDF | check-layout |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | 30 / 30 / 30 | 4–22 | 长方形、正方形的周长 | PASS（0 失败） | 2 页 | PASS，碰撞 0 |
| L2 | 30 / 30 / 30 | 20–156 | 长方形、正方形的周长 | PASS（0 失败） | 2 页 | PASS，碰撞 0 |
| L3 | 30 / 30 / 30 | 44–382 | 长方形、正方形的周长 | PASS（0 失败） | 2 页 | PASS，碰撞 0 |

样张：`samples/u6-tuoshi-l1.pdf`、`-l2`、`-l3`。三档全部为 `(长+宽)×2`，除法 0 题；L1 允许长=宽（正方形按长方形公式算仍成立），L2 起操作数至少 5，L3 操作数至少 10。

计算题的统计口径与图形题不同：**句式固定 1 种**（`(长+宽)×2`），**场景不适用**（纯计算无情境），因此这里如实记“题量 / 唯一算式 / 唯一数值”，不把同一式子拆成 30 种句式充数。

教师视角逐题审读：三档都只出 `(长+宽)×2`，没有除法、面积、结合律/分配律；L2 起操作数下限为 5/10，答案分别不低于 20/44，避免出现 0 或 1×1 这类无效周长；L1 保留 1–6 的操作数，允许长=宽（正方形按长方形公式计算仍成立）。题面只给算式，不混入“长/宽”文字，避免与图形题口径混淆。

### 22.4 全量回归

- 18 个三上骨架包 × L1/L2/L3 共 **54 个组合**，各抽 30 题（seed `20261104`）：54/54 OK，0 失败。
- 四份成品样张 `scripts/app-check.ts` 重编 + check-layout：纯计算、纯填空、纯应用、三题型混合全部 PASS。
- `npx vue-tsc -b` 通过；`node --test tests/*.test.ts` **53/53** 通过；`pnpm build` 通过。

### 22.5 如实说明

- U2 简便、U5 脱式、U7/U8 口算/脱式都**没有造题**；参数面板显示“不适用”及原因，静态题库兜底同步关闭。
- U6 脱式只出一种式子，L1/L2/L3 的差异是操作数数域与进位难度，不是换情境或换问法；这是周长公式专项练习的合理形态，但没有把它包装成“30 种不同题型”。
- 未新增除法、两位数除法、结合律/分配律题；未改动 U4 除法口径。

## 二十三、0.4.0 第三项：出卷运行时复核

目标：出卷时自己验一遍，不再只靠离线验收；复核与生成路径分开，失败先有限次重生成，仍失败则剔除并如实少题。

### 23.1 复核路径

新增 `src/app/runtimeCheck.ts`，三类题走三种独立复核：

| 题型来源 | 复核方式 | 说明 |
| --- | --- | --- |
| 骨架包题 | `verifySkeletonQuestion` → `verify.ts` 独立求值器 | 从题目参数重算答案、检查句式/场景/数值/题干长度；不回看组装时的中间结果 |
| 规则库计算题 | `verifyCalcQuestion` → `evalLatex` 重算 | 只拿最终 `latex` / `answer` 字符串重算；带余数除法单独校验 `被除数 = 商 × 除数 + 余数` 且 `0 ≤ 余数 < 除数`；递等式逐行重算，防止答案对但过程错 |
| 旧生成器填空/应用题 | `verifyFillQuestion` + `verifyItemStructure` | 题干非空、无未替换值、答案非空、填空空位数 = 答案条数 |
| 静态题库兜底题 | `verifyStaticItem` | 结构 + 答案非空；旧题库条目已补带 `answers`（`typstData.ts`），缺答案的旧题会被剔除 |
| 静态示例题（比大小/图形） | `verifyItemStructure` | 无答案字段，只校验题面结构非空 |

### 23.2 失败策略

- `admitWithRetry`：首检不过 → 最多重生成 **3 次**（`MAX_REGENERATIONS`）→ 仍不过就剔除，绝不放行未经验证的候选。
- 骨架题重生成走 `assemble.ts` 的 `rebuildQuestion`：同句式、同难度档，换场景与数值；`releaseQuestion` 先释放原题的卷内去重键，避免重生成被自己占位卡死。
- 规则库计算题重生成：换种子重新 `generate(count: 1)`，候选必须重新过 `evalLatex` 复核。
- 剔除会计入 `stats.runtimeCheck.dropped`，同时写入 `result.notes`；配合既有 `shortage` 提示，卷面少题不会静默。
- 静态兜底题不重生成（题库固定），校验不过直接剔除。

### 23.3 界面展示

`DesktopApp.vue` 的本次出卷摘要固定显示：

`复核 N 题（失败 M / 剔除 K）`，有重生成时追加 `重生成后通过 X`。

剔除时同时把原因写进备注条（`运行时复核：复核 N 题，失败 M 题，剔除 K 题（原因…）`），不只留在日志。

### 23.4 性能实测

30 题、混合卷（口算 + 填空 + 应用题，9 个单元，L2），连续 20 次，每次新 `MemoryStore`、seed 变化：

| 场景 | 平均 | 中位 | 最慢 | 复核量 |
| --- | --- | --- | --- | --- |
| 混合 30 题 | 1.7 ms | 1.3 ms | 10.9 ms | 600 题，0 失败 / 0 剔除 |
| 纯骨架 30 题 | 0.8 ms | 0.8 ms | 1.2 ms | 600 题，0 失败 / 0 剔除 |

结论：复核开销可忽略（`evalLatex` 为纯算术解析，30 题量级在毫秒内）。出卷耗时的大头仍是骨架组装时的参数重试与去重，不是复核。

### 23.5 测试

新增 `tests/runtime-verify.test.ts`，共 6 条：

1. 人为注入一道错答案计算题（`36 × 4` 答案写成 148）：复核拦住，重生成正确题后放行，错误答案不进卷面。
2. 注入错答案且重生成仍错：重生成恰好调用 3 次（有上限）后剔除，`accepted = null`。
3. 骨架题篡改答案：独立求值器拦住，原题通过。
4. 静态兜底题空答案：直接剔除。
5. 旧填空生成器空位数与答案数不一致：拦住。
6. 真实 `buildPaper` 30 题混合卷：`checked ≥ 30`、`dropped = 0`，逐题结构校验通过且填空/应用题都带答案。

### 23.6 全量回归

- 18 个三上骨架包 × L1/L2/L3 = **54 个组合**，各 30 题（seed `20261104`）：54/54 OK；再经 `buildPaper` 链路复核共 **1620 题**，0 失败、0 剔除，最慢单卷 7 ms。
- 四份成品样张 `scripts/app-check.ts` 重编 + check-layout：纯计算 20 题 / 3 ms、纯填空 30 题 / 7 ms、纯应用 8 题 / 0 ms、混合 30 题 / 3 ms；复核全部 0 失败 / 0 剔除，PDF 与 check-layout 全部 PASS。
- `node --test tests/*.test.ts` **59/59** 通过；`npx vue-tsc -b` 通过；`pnpm build` 通过。

### 23.7 如实说明

- 本轮没有把复核做成“可开关”：默认每卷都验，代价已在毫秒级，无需为性能留后门。
- 复核失败样本只在单测里人为注入；真实语料 54 组合 + 四样张 0 失败，说明现有生成器本身稳定，但复核路径已具备拦截能力。
- 旧题库静态兜底题补带了答案字段；若某条旧题缺答案，会被剔除并计入题量缺口，而不是沿用“无答案也算兜底”。

## 二十四、0.4.0 第四项：旧题库教研审核 + 清理

逐条审核文档：`docs/旧题库教研审核-0.4.0.md`。

### 24.1 盘点结论

三上 9 个单元 × 6 个题型 × L1/L2/L3，共 162 个单单元组合逐一跑 `typeAvailability`：**静态题库来源命中 0 次**（不适用 18 次，其余为骨架/规则）；再补两两/三三多单元组合 × 4 个计算题型 × 3 档共 1440 个组合，静态来源同样 0 次。旧题库实际可达条数为 0，原因：

- 计算类：每个单元×题型要么有生成规则，要么已在 `NOT_APPLICABLE_CALC` 标为不适用，要么旧题池为空；容量补齐路径虽存在，但无题可补。
- 填空/应用：9 个单元三档都有骨架包，静态兜底不触发。
- 旧生成器：仅在骨架包抛错/产出 0 时同单元兜底（填空 U1/U4/U5/U6/U7/U8/U9，应用 U1/U4/U5/U6/U8/U9），常规出卷 0 命中，命中时备注明示“旧…生成器兜底”。
- 旧预览页 `index.html` 仍直接读 `QUESTIONS`，但 Tauri 主入口是 `app.html`，不属于出卷链路。

### 24.2 逐题审核结果

三上旧题 32 条逐句审核：答案全部重算正确，问题集中在超纲与单元口径冲突。

| 处理 | 数量 | 条目 |
| --- | --- | --- |
| 删除（超纲） | 5 | 3A-U1-T1 `/36÷4`、3A-U1-T3 `÷8`、3A-U1-T4 `÷6`、3A-U1-K2 `÷9`（除法在 U4 才学）；3A-U2-J1 `25×7×4`（结合律属四年级，P1-A1） |
| 删除（口径冲突） | 1 | 3A-U4-T1（年月日单元出脱式，与第二项 22.1 判定冲突） |
| 改写 | 1 | 3A-U4-F1：“每月有 31 天”→“每个大月有 31 天”，消除歧义，答案不变 |
| 保留（可用，来源仍标旧题库） | 25 | 其余答案正确、知识点属三上的条目 |

清理后三上旧题 26 条，3B 8 条未动（3B 目录为推定结构，不在三上范围）。

### 24.3 剩余项与保留原因

1. 主出卷链路静态题：**0 条可达**。
2. 代码库保留 26 条三上旧题：旧预览页 `index.html` 仍读取 `QUESTIONS`；这些题可用且答案正确，符合“可用但风格老 → 保留并标注来源”。若未来下线旧预览页，可整体删除三上 `QUESTIONS`。
3. 旧生成器潜在兜底：保留，但已接入运行时复核，且备注会明示来源，不是静默混用。
4. 容量补齐：U5 脱式、U2 简便的超纲旧题删除后，相关池子为 0；实测 U1+U5 / U1+U7 / U1+U8 各 60 题混合，静态兜底 0。

### 24.4 全量回归

- 54 个骨架组合 × 30 题（seed `20261104`）：**54/54 OK**。
- 四份成品样张重编 + check-layout：纯计算 20 题、纯填空 30 题、纯应用 8 题、混合 30 题，全部 PASS（静态兜底 0）。
- `node --test tests/*.test.ts` **59/59**；`npx vue-tsc -b` 通过；`pnpm build` 通过。

## 二十五、0.4.0 收口：真机全链路回归 + 题量上限评估

日期 2026-11-04；未改题目内容、未改 `typst/` 版式规则、未提交、未改版本号/CHANGELOG。

### 25.1 真机环境与自动化方式

- `pnpm tauri dev`（vite 8.3.5 + cargo dev），窗口标题 `QuizLab`，1240×845。
- WKWebView 不向 System Events 暴露网页元素，实际操作分两层：坐标点击（Swift `CGEvent`）与 AX（`AXUIElement` 的 `AXPress` / 取值 / 赋值）。
- 本轮机器上另有一个自动化会话在并发操作，多次抢走键焦点；15:36、15:57 出现过非本次操作生成的卷子与另存文件。因此所有 GUI 结论只以「窗口截图 + 文件 ctime」为证据，不依赖前台焦点。

### 25.2 出卷链路（真机实测）

参数：三上 U1+U5、L2、口算 / 脱式 / 填空 / 应用题（竖式在两个单元均不可用）、20 题、目标 2 页。

| 指标 | 实测 |
| --- | --- |
| 编译耗时 | 264 ms |
| 版面校验耗时 | 467 ms（ok=true, skipped=false） |
| warning | 0 条 |
| 字体回退 | false |
| 页数 / 大小 | 2 页 / 32.0 KB |
| 题量来源 | 20 题：骨架 7 + 计算生成 13 |
| 运行时复核 | 复核 20 题 / 失败 0 / 剔除 0 |
| 去重命中 | 0 |
| 连续三次生成 | 266/474 ms、241/459 ms、264/467 ms（编译/校验） |

### 25.3 预览

| 项 | 结果 |
| --- | --- |
| 分页 | 第 1/2 页 → 第 2/2 页，`下一页` 生效，页脚「第 N 页 · 共 2 页」正确 |
| 第 2 页页眉 | 为空（符合「第 2 页起页眉为空」） |
| 缩放 | `缩小` 将 100% → 90%，页面重排正常；`适应宽度`、`放大` 均在位 |
| 公式清晰度 | 分数、`÷`、答案横线与留白在 100% / 90% 下均无裁切、无重叠 |
| 鼠标滚动 | 未能稳定自动化（焦点被并发会话抢走），**需人工确认** |

### 25.4 打印（系统打印对话框）

`打印` → Preview 打开当前 `.quizlab/out/paper.pdf` → `Cmd+P`：

| 设置项 | 实测值 |
| --- | --- |
| 打印机 | HP Smart Tank 210-220 series（系统默认） |
| 份数 | 1 |
| 页码 | 所有 2 页 |
| 纸张 | **A4 210 × 297 毫米** |
| 方向 | 竖排 |
| 缩放 | **缩放以适合 97%**（未选「缩放:」自定义） |
| 打印整张图像 / 填满纸张 | 未勾选 |
| 结果 | `Esc` 取消，未消耗纸张 |

发现：默认缩放不是 100%，而是「缩放以适合」算出的 97%（打印机不可打印边距所致），不是应用排版问题；要 1:1 输出需手动勾选「缩放:」并填 100。

### 25.5 保存（另存为）

- `另存为` 打开原生 `NSSavePanel`（AXSheet）；用 AX 将文件名设为 `quizlab-regression.pdf` 并 `AXPress` 的 `Save`。
- 落盘：`~/Downloads/备选/quizlab-regression.pdf`，**33,302 B**，2 页 A4（595.3 × 841.9 pt）。
- 文件 ctime `16:00:13`（本次保存时刻）；birth/mtime 沿用源 `paper.pdf` 的 `15:57:53`（Rust `fs::copy` 保留元数据，非新文件伪造）。
- `python3 typst/check-layout.py --compact`：**PASS**（口算行距 8.87 mm、字符碰撞 0 处、正文最后一行 224.72 mm）。
- 目录说明：面板 `Where:` 为「备选」（上次保存位置）；尝试 AXPress 侧边栏 `Desktop` 行返回 `-25206`（该行不支持 Press），未切换目录。**指定目录切换需人工**。

### 25.6 题量上限实测（30 / 40 / 60）

脚本走应用同一条 `buildPaper` → typst 编译 → `check-layout.py --compact` 链路；每组独立记忆，另跑 3 卷不同 seed 统计跨卷重复。全部 warning 0、字体回退 false、跨页切断 0、版心溢出 0 mm、最大正文底部 280.5 mm（版心底 281 mm）。

| 组 | 目标 | 实出 | 短缺 | 骨架/规则 | 页数 | 大小 KB | 编译 ms | 校验 ms | 复核 检/败/剔 | 跨卷重复 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 填空 单单元 U2 | 30 | 30 | 否 | 30/0 | 2 | 39.9 | 528（冷启） | 301 | 30/0/0 | 0.0% |
| 填空 单单元 U2 | 40 | 30 | **是** | 30/0 | 2 | 39.9 | 122 | 299 | 30/0/0 | 同 30 题 |
| 填空 单单元 U2 | 60 | 30 | **是** | 30/0 | 2 | 39.9 | 127 | 296 | 30/0/0 | 同 30 题 |
| 填空 8 单元 | 30 | 30 | 否 | 30/0 | 2 | 47.7 | 134 | 302 | 30/0/0 | 2.2% |
| 填空 8 单元 | 40 | 40 | 否 | 40/0 | 3 | 57.5 | 129 | 292 | 40/0/0 | — |
| 填空 8 单元 | 60 | 60 | 否 | 60/0 | 4 | 72.9 | 129 | 300 | 60/0/0 | 2.2% |
| 应用 8 单元 | 30 | 30 | 否 | 30/0 | 6 | 67.3 | 123 | 290 | 30/0/0 | 0.0% |
| 应用 8 单元 | 40 | 40 | 否 | 40/0 | 8 | 79.7 | 121 | 295 | 40/0/0 | — |
| 应用 8 单元 | 60 | 60 | 否 | 60/0 | 11 | 96.8 | 128 | 304 | 60/0/0 | 0.0% |
| 混合 8 单元 | 30 | 30 | 否 | 11/0 | 2 | 48.0 | 130 | 290 | 30/0/0 | 1.1% |
| 混合 8 单元 | 40 | 40 | 否 | 15/0 | 3 | 54.4 | 120 | 295 | 40/0/0 | — |
| 混合 8 单元 | 60 | 60 | 否 | 22/0 | 4 | 69.4 | 131 | 295 | 60/0/0 | 0.6% |

- 分页结构：每组每页页眉为「1/0/...」、页脚页码连续；无孤儿小节标题、无通栏题跨页、无题被切断。
- 单包 40/60 被硬截断到 30；`shortage=true`，应用层提示「题量不足：实际 30 题（目标 N 题）」，`buildPaper.notes` 本身不含该句。
- 复核：12 组失败 0、剔除 0，失败率 0%；构建 + 复核耗时 120–131 ms（60 题），耗时主要在 typst 编译与校验（约 0.4–0.55 s）。
- 重复率：跨 3 卷 0.0%–2.2%，骨架池未耗尽（8 单元 60 题仅用 60/240 套骨架）。

### 25.7 结论：暂不解除 30 题上限

依据：

1. 单包只有 30 套骨架，40/60 只能截断为 30；放开上限会先暴露「有题但重复」而非「有题可出」。
2. 应用题 60 题需 11 页，已超出「每日一练」的使用场景；填空/混合 60 题 4 页尚可，但页数线性增长无自动分页提示。
3. 版式本身扛得住 60 题（12 组 PASS、无溢出/切断），复核 0 失败，说明技术上不是版式或复核瓶颈，而是内容池与产品定位。
4. UI 已有 100 题输入上限，但单包 30 的配额由 `skeletonPieces` 钳制；「混合 60」现在已能出满，不需改代码。

若未来解除，需要同步：每包骨架扩到 ≥40（建议 60）；单包配额与提示文案（说明「单包上限，跨单元可更多」）；≥6 页时提示页数；打印指引改为 100% 缩放；复核覆盖新增骨架。

### 25.8 回归结果

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | 59/59 通过 |
| `vue-tsc -b`（`pnpm build` 内含） | 通过，0 错误 |
| `pnpm build` | 通过（仅 >500 kB chunk 提示） |
| 样张 `check-layout.py --compact` 全量 | 93 份：88 PASS / 5 FAIL |
| 本次 12 份评估卷 | 12/12 PASS |
| 真机另存 PDF | PASS |

5 份 FAIL 均为**历史样张第 2 页页眉非空**（`samples/试卷样张.pdf`、`版式试验卷.pdf`、`app-输出.pdf`、`v0.2.0-beta.1-三上U2-应用出卷L3.pdf`、`v0.2.0-beta.1-三下U2-应用出卷L2.pdf`），文件 mtime 为 11-02/11-03、git 未修改，属旧版式产物，非本次引入；未改动，建议归档或按新版式重生成（需批准）。

### 25.9 问题与限制

1. 打印默认「缩放以适合 97%」，与「100%」预期不一致（系统面板行为，非应用代码）。
2. 单包 >30 截断提示只在 `DesktopApp` 拼接，`buildPaper.notes` 不含；若后续有脚本消费 notes，会看不到该原因。
3. 前端 console 未能直接抓取：截图无错误横幅、dev 终端无 panic/ERROR，但不能 100% 断言 console 零 warning。
4. 预览鼠标滚动未自动化完成，需人工确认。
5. 并发自动化会话污染 GUI 时点（15:36/15:57 非本次产物）；GUI 结论以截图与 ctime 为准。

## 26. 比大小 / 图形与周长：静态示例改为规则生成器（2026-11-04）

### 26.1 背景与结论

- 改动前两类题型只有 2 条静态示例，`typeAvailability` 标记 `static`（界面「静态题库」），`buildPaper` 在配额计算时按静态池长度截断。
- 改动后新增 `src/quiz/compare.ts`、`src/quiz/geom.ts`，接入 `buildPaper` 的规则生成链路，两类的来源徽标改为 `rule`（界面「规则库」）；静态示例仅在「所选单元不含图形内容」时兜底，并在界面写明原因。
- 结果：两类题型在 3A 全单元 L2 下 20/30/60 题均能出满，同卷逐字重复 0，复核失败 0。

### 26.2 改动前基线（静态示例，type-only 卷）

环境：3A 全 9 单元、L2、`buildPaper` 直接调用（`typeAvailability` 走静态分支）。

| 题型 | 目标 | 实出 | 完全重复 | 页数 | 复核 checked/failed/dropped | 构建耗时 |
| --- | --- | --- | --- | --- | --- | --- |
| 比大小 | 20 | 1 | 0 | 1 | 会话前段记录 2/0/0 | ≈0–1 ms |
| 比大小 | 30 | 1 | 0 | 1 | 同上 | ≈0–1 ms |
| 图形与周长 | 20 | 1 | 0 | 1 | 同上 | ≈0–1 ms |
| 图形与周长 | 30 | 1 | 0 | 1 | 同上 | ≈0–1 ms |

说明：基线 PDF 曾误用默认 `typst/data/questions.json` 出卷（页数解析成 4 页），已用基线 JSON 重编译确认为 1 页；上表页数为重编译结果。

### 26.3 改动内容

| 文件 | 改动 |
| --- | --- |
| `src/quiz/compare.ts`（新增） | 比大小规则生成器：整数直比、元/角、积比、商比、算式与数比、长度换算、时间换算、同分母分数、同分子分数、带括号两步式、米+厘米混合单位；按单元判定已学内容（除法 U4 起、分数三下分数单元后） |
| `src/quiz/geom.ts`（新增） | 图形与周长规则生成器：长方形/正方形求周长、给周长逆求边长/宽、靠墙围篱笆、两个相同长方形拼合、长是宽的 k 倍；图形按长宽比例缩放画在 32×19 框内 |
| `src/app/paperBuilder.ts` | `typeAvailability` 两类改为 `source: 'rule'`；`capacityOf` 有生成器时视为无限；`itemKey` 按题干/算式去重；新增 `buildRuleType` 接入 `admitWithRetry`；主循环分流规则生成器/静态兜底 |
| `src/app/types.ts` | 新增 `ItemAudit`（form/answer/params），`TypstItem` 增加 `audit?` |
| `src/app/runtimeCheck.ts` | 比大小：解析题面独立求左右值（分数交叉相乘、单位按 `UNIT_FACTORS` 换算）再判大小；图形：按 form + 已知边长重算 7 种周长公式，并校验题干单位；修正时间单位换算基准（时 3600 秒、分 60 秒） |
| `typst/paper.typ` | 一行最小改动：geom 分区的 `fig` 支持字符串或 `FigureSpec`，`[#if type(it.fig) == str { geom-fig(it.fig) } else { draw-fig(it.fig) }]` |
| `tests/compare-geom.test.ts`（新增） | 8 条用例：30 题不重复/复核通过、难度形态递进、教材口径、单位一致、篡改答案拦截、接线与静态兜底 |

### 26.4 改动后实测（3A 全 9 单元、L2、seed 20261104）

| 题型 | 目标 | 实出 | 完全重复 | 页数 | 复核 checked/failed/dropped | `buildPaper` 耗时 | typst 编译 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 比大小 | 20 | 20 | 0 | 1 | 20/0/0 | 1 ms | 0.19 s |
| 比大小 | 30 | 30 | 0 | 1 | 30/0/0 | <1 ms | 0.17 s |
| 比大小 | 60 | 60 | 0 | 1 | 60/0/0 | <1 ms | 0.19 s |
| 图形与周长 | 20 | 20 | 0 | 4 | 20/0/0 | 1 ms | 0.11 s |
| 图形与周长 | 30 | 30 | 0 | 6 | 30/0/0 | <1 ms | 0.11 s |
| 图形与周长 | 60 | 60 | 0 | 12 | 60/0/0 | <1 ms | 0.11 s |

- 6 份 PDF 均 `check-layout.py --compact` → PASS（字符级碰撞 0 处）；PDF 内题目编号数分别 20/30/60，无缺题。
- 比大小 60 题单页排满两栏（每栏 30 行）；图形题每题含 25 mm 图形 + 15 mm 作答区，30 题 6 页属版式预期。
- 其他难度实测（同 seed 42，3A 全单元，30 题）：L1/L2/L3 均出满 30、唯一 30、复核失败 0；L1 形态仅整数/元角/积/商，L3 追加括号两步式与米厘米混合单位；3A-U3 及之前无除法/分数，3A-U4 起有除法，三下分数单元后出现分数比较。
- 30 题跨形态分布示例（L3）：`(33 - 28) times 7` vs `26 times 6`、`4 "米" 1 "厘米"` vs `335 "厘米"`、`96 div 4` vs `420 div 6`。

### 26.5 复核机制

- 比大小：不再信任生成器算出的答案；`evalCompareSide` 把题面 Typst 数学串（`times`/`div`/`frac`/带单位量）独立求值，分数用交叉相乘避免浮点误差，单位按 毫米1 / 厘米10 / 分米100 / 米1000 / 元10 / 角1 / 秒1 / 分60 / 时3600 统一到基准。
- 图形：`geomRecompute` 只读 `audit.params`（form + 已知边长）重算 7 种公式，再与 `audit.answer` 比对；同时校验 `params.unit` 出现在题干里，防止「问厘米按米算」。
- 两者都走 `admitWithRetry`：首次不过→有限次重生成（本版 `regenerate: () => null`，即直接剔除并记录），`recordCheck` 计入界面统计。

### 26.6 回归结果

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | 67/67 通过（新增 8 条） |
| `npx vue-tsc -b` | 通过，0 错误 |
| `pnpm build` | 通过（仅 >500 kB chunk 提示） |
| `cargo check`（src-tauri） | 通过 |
| 20/30/60 六份 PDF `check-layout.py --compact` | 6/6 PASS |

### 26.7 遗留限制

1. `scripts/pilot-drill.ts` 只支持骨架组合（`--combo`/`--mix`），不支持 compare/geom；本次实测改用 `buildPaper` 出 JSON + `typst/paper.typ` 编译 + `check-layout.py`，等价于应用主链路。
2. 比大小 60 题集中在 1 页，题间距偏紧（版式校验 PASS，但实际打印建议 30–40 题）。
3. 图形生成器暂无三角形/平行四边形；`paper.typ` 只有 `draw-fig` 的通用多段线能力，接新图形需再加规格与复核公式（未做）。
4. 静态示例 `STATIC_SAMPLES` 仍保留：compare 已不再走静态分支，geom 在「所选单元不含图形内容」时仍作为兜底（最多 2 题）；是否删除需确认后再评估。
5. 跨卷记忆未接入 compare/geom：同 seed 可复现，不同 seed 会重合（未做跨卷去重）。

## 二十七、题型可用性矩阵入台账（2026-11-05）

- 台账：`docs/三上题型可用性矩阵-0.4.0.md`（9 单元 × 10 题型，逐格 L2 / 30 题实测）。
- 汇总：90 格中满 48、有上限 4（U1 判断 29、U4 选择 28、U5 判断与选择各 17）、不适用 38（C1 教材无 15 / C2 未做 19 / C3 形态不适合 4）。
- 该有题却空着的 6 组共 8 格已列清单（U9/U8 × 图形与周长、U3/U8 × 判断与选择、U5 × 口算、U6 × 比大小），按优先级排，本轮不补。
- 口径限制：仅 L2 / 30 题实测，L1、L3 与 200 题上限未逐格验证；角题 1/3 上限维持现状，不设配比开关。

## 二十八、文字型概念比较改为判断题命题来源（2026-11-05）

### 28.1 比大小只留数值型

- `src/quiz/compare.ts` 删除 `shapeSides` / `shapeAngle` 两种形态、`SHAPES` 表与两个生成函数；`3A-U3` 三档形态池清空，`3A-U9` 由 6/11/11 降为 5/9/9。
- 保留下来的形态全部是纯数值：数的大小、元角、积比较、商比较、算式与数、长度换算（米/分米/厘米）、时间换算（时/分/秒）、天与时、米厘米混合、带括号两步式、两/三步加减、除法算式与数。
- 清理前后 20 题可出量（同 seed 实测）：`3A-U3` L1/L2/L3 `20→0`；`3A-U9` 三档 `20→20`；全单元三档 `20→20`（数值池不受影响）。
- 概念词扫描（平行四边形/正方形/梯形/三角形/条边/个角/长方形/四边形）：3 档枚举 23 条题干，命中 0。

### 28.2 概念命题来源

- 新文件 `src/quiz/concepts.ts`：48 条命题（U3 34、U6 6、U1 4、U4 2、U2 2；真 29 / 假 19），每条含陈述句、真值、判据、单元、适用难度；假命题另带唯一 `singleError`，真命题另带教材依据 `source`；绝对化表述另带 `absoluteReview`（特例复核）。
- 加载时逐条自检：含「可能/有时/也许/大约/大概/通常」的陈述句拒绝；假命题缺 `singleError` 或判据未覆盖 `singleError` 拒绝；真命题缺 `source` 或误标 `singleError` 拒绝；陈述句含「都/一定/所有/任何/只有/必须/总/每」但缺 `absoluteReview`（或结论里没写「特例」）拒绝；ID 重复拒绝。
- 复核不走数值重算：`verifyConceptSource` 按命题 ID 核对真值与标答；`verifyConceptItem` 再核对题干原文、真值、`√/×`、假命题错因 `detail === rationale`。运行时 `verifyFormatItem` 对 `pool === 'concept'` 走这条路径。
- 接入：`formats.ts` 增加 `concept` 池与来源；`formatSourceUnits/formatSupports` 按题型筛选，U3 判断题可出、选择题仍不适用；`paperBuilder.ts` 5 处调用带题型。

### 28.3 占比、洗牌与去重

- 概念命题默认在一份判断题卷中最多 `floor(count/3)` 道（20 题最多 6 道），按位置均匀分布（第 1、4、7…道），仍受 `judgePlan` 真假各半与连续同答 ≤2 约束。
- 条件放宽：如果所选单元组合没有任何数值判断来源（如只勾 U3），概念题上限放宽到 100%，允许出满；notes 写「本卷全部为概念命题（该单元无其他判断来源）」。只要存在数值来源，仍按 1/3，notes 写「概念命题 6/20 道（占比上限 1/3）」。
- 同卷用 `seen` + `sourceUsed` 去重；跨卷走 `MemoryStore`，概念题只有真值匹配当前答案位且未超 1/3 时才允许 LRU 复用。

### 28.4 实测

| 项 | L1 | L2 | L3 |
| --- | --- | --- | --- |
| 判断题 20 题概念占比 | 6/20（30.0%） | 6/20（30.0%） | 6/20（30.0%） |
| 判断题 真/假 | 10/10 | 10/10 | 10/10 |
| 判断题 最长连续同答 | 2 | 2 | 2 |
| 比大小 20 题（纯数值） | 20 | 20 | 20 |
| 检查 `check-layout --compact` | 判断 3 页 / 比大小 1 页，均 PASS（比大小 60 组、基线差 0.00pt、跨行 0、题号 0） | 同左 | 同左 |

- 判断题单单元 20 题实测：只勾 U3 时 L1/L2 各 20/20、L3 19/20（全部概念命题，真假 10/10、10/10、9/10；L3 受知识点池限制，见 28.8）；U6 三档 20/20（概念 2/4/2）；U1 三档 20/20（概念 3/5/2）；U5 仍为 20/19/0，与本轮无关。
- 审计 300 题（5 卷 × 30 判断 + 30 选择，判断单元含 U3）：复核失败 0、同卷重复 0、跨卷重复 0/600。
- 防猜测：判断三档 5 卷 × 20 题 √/× 各 50，最长连答 2，未发现固定周期。

### 28.5 回归

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | 114/114 通过（110 → 114，新增 4 条） |
| `npx vue-tsc -b` | 通过，0 错误 |
| `pnpm build` | 通过（仅 >500 kB chunk 提示） |

### 28.6 限制

1. 概念命题不是数值题，题干改动、教材表述变化都必须回到 `concepts.ts` 改表，不能靠模板自动扩展。
2. 纯概念单元（U3）单独出判断题时，知识点唯一是硬约束：L1 21 个、L2 24 个、L3 19 个知识点，20 题口径 L3 只能出 19；若以后继续删减知识点，实出量会同步下降。
3. U5 判断题容量（L2 19/20、L3 0）与本轮无关，仍未改善；U1 判断题本就 20/20，概念题只改变来源构成、不增加容量。
4. 矩阵文档已同步：U3 × 判断记为 24/30（纯概念单元放宽到 100%，同卷知识点唯一），U3 × 比大小改为不适用 C3，汇总变为满 47 / 上限 5 / 不适用 38。

### 28.7 命题质量修订（2026-11-05 同日）

- **归属修正**：`u1-remainder-equal-divisor`、`u1-remainder-less-divisor` 从 U1 移到 U4（三上 U1 未学除法），ID 改为 `u4-*`，依据改为 U4《用一位数除》。全表复查后，U1 只剩 0/1 运算 4 条，无除法表述。
- **改写两条绝对化假命题**：原「长方形的4条边都相等」「平行四边形的4条边都相等」依赖「孩子没想到正方形/菱形」才成立，改为「长方形相邻的两条边长度一定相等」（假）、「平行四边形相邻的两条边长度一定相等」（假），ID 改为 `u3-rect-adjacent-sides-equal`、`u3-para-adjacent-sides-equal`；一般长方形/一般平行四边形即可推翻，不依赖特例。
- **新增 21 条 U3 命题**（边角计数、图形包含关系、角的分类比较、常见错误说法），使 U3 命题池达到 L1 29 / L2 34 / L3 26（真 21 / 假 13），纯概念单元 20 题可出满且真假各半。
- **新增长期校验**：`ConceptProposition.absoluteReview`；陈述句含「都/一定/所有/任何/只有/必须/总/每」时必须填写并包含「特例」结论，否则 `validateConcept` 与模块自检直接报错。
- **条件放宽**：无数值判断来源时概念上限 100%；有数值来源仍 1/3。实测：仅 U3 三档 20/20（notes「本卷全部为概念命题」）；U3+U4+U6 仍 6/20（notes「上限 1/3」）。30 题口径仅 U3 时 L1 21、L2 27、L3 21（受真假各半限制，假命题少的一侧决定上限）；本轮加知识点去重后为 21/24/19，见 28.8。
- **比大小空单元**：仅 U3 + 比大小 -> `enabled: false`、`source: 'na'`，原因写明「本单元（三角形与四边形）无比大小内容（图形概念比较已改为判断题概念命题），不出比大小题」。

### 28.8 知识点去重（2026-11-05 同日）

- **命题结构**：`ConceptProposition` 新增必填 `knowledgePoint`（形如 `u3.triangle.sideCount`）。48 条命题共 36 个知识点：U3 24、U6 5、U1 4、U4 1、U2 2。同一事实的正反说法共用同一知识点键（例如「三角形有3条边」/「三角形有4条边」→ `u3.triangle.sideCount`）。
- **校验**：`validateConcept` 缺键报「命题缺少知识点键（knowledgePoint）」；键不符合 `^[a-z0-9]+(\.[a-zA-Z0-9]+)+$` 报格式错误。模块加载时逐条自检，坏数据 import 即抛错。
- **同卷硬约束**：`conceptSource.key` 从 `concept:<命题ID>` 改为 `concept:<知识点键>`，同卷 `seen` / `sourceUsed` 与跨卷 `MemoryStore` 都以知识点为去重单位，同一知识点的另一种说法不会当成新题。
- **排卷**：纯概念卷（U3 单选判断题）改走 `planConceptOnly`：先按知识点在真假上的可用性分组（只真 / 只假 / 兼备），再按知识点池决定实出量；真假尽量各半，交错排布保证连续同答 ≤2；知识点用尽就如实少出，不用反说法凑数。跨卷优先选未在最近 6 卷出现的知识点。
- **notes 文案**：未满卷时先写「判断题：题池只凑到 X/Y 道（知识点去重后没有其他知识点的补充命题）」，再写「判断题：本卷全部为概念命题（实出 X 题，该单元知识点 N 个；同知识点不重复，不用反说法凑数）」。
- **实测（seed 31337）**：仅 U3 判断题 20 题口径 L1 20/20、L2 20/20、L3 19/20（知识点 20/20/19，真 10/10/9，最长连答 2）；30 题口径 L1 21、L2 24、L3 19。U3+U4+U6 与全单元 20 题仍满 20、概念 6 道（30.0%）、真假 10/10、知识点 6 个且唯一。
- **回归**：`node --test tests/*.test.ts` 117/117 通过（114 → 117，新增「同卷知识点唯一」「跨卷按知识点去重」「知识点键必填与格式」3 条）；`npx vue-tsc -b`、`pnpm build` 通过。

## 二十九、0.4.0 第五项：拓展题/提高题（T1/T2/T3 双路径复核与唯一解约束）（2026-11-05）

### 29.1 类别与单元归属

- 新增独立题型 `advanced`（`src/quiz/advanced.ts`，`AppType = advanced`），共 **15 类**：T1/L1 **7 类**、T2/L2 **6 类**、T3/L3 **2 类**；卷面一题一行通栏，题干下留白写思路，不画横线。
- T1：周期排列、归一问题、等量代换、经过时间、年龄差不变、拼图形后的周长、归总问题。
- T2：逆向推理、两个集合的重叠、剪拼后的周长、图形代表数、数长方形、星期几推算。
- T3：和差问题、策略选择（怎样租最省）。
- 第 31 轮按教研评审删除「数长方形」「和差问题」，现为 **13 类**（T1 7 / T2 5 / T3 1），留白改为按类别 3–8 行；本节 15 类数据为第 29 轮历史记录，以 31 节为准。
- 单元归属按类别的 `units` 与实际所选单元取交集：T1 → U1/U2/U4/U5/U6/U9；T2 → U1/U2/U3/U4/U5/U6/U9；T3 → U1/U2/U4/U9；U7/U8 暂无结构，矩阵记 C2（教材有对应内容、本版未做）。只出所选单元内的类别（方案 A）。

### 29.2 红线与被拒类别

- 超纲/内容红线落在 `FORBIDDEN_TERMS`（13 词）：方程、未知数、负数、小数、分数、分配律、结合律、面积、菱形、梯形、平均数、植树、鸡兔；模糊词 8 个：大约、可能、一些、差不多、左右、若干、大概、也许。题干或步骤命中即拒，复核不通过不放行。
- 「多解」不是类别，而是策略类的硬约束：租船 `invariant` 穷举大船 0…上限，出现并列最优即拒。反例参数 24 人 / 大船限 6 人 36 元 / 小船限 4 人 24 元，穷举判出 3 个并列方案并拒绝出题。
- **被拒类别清单：未留档**。仓库里没有「候选类别 → 拒因」的单独台账；可核实的只有上述禁止词。其中「平均数」「植树」「鸡兔」以整类词形式被禁、未建成类别，其余为解题方法或内容红线；不凭记忆补列。

### 29.3 难度分档与留白

| 档 | 类别数 | `MIN_STEPS` | 实测平均步数 | 留白行数 | 留白高度 |
| --- | --- | --- | --- | --- | --- |
| T1 / L1 | 7 | 2 | 2.00 | 3 | 25.5 mm |
| T2 / L2 | 6 | 3 | 3.00 | 4 | 34 mm |
| T3 / L3 | 2 | 4 | 4.50 | 4 | 34 mm |

- 留白高度 = `workLines × 8.5mm`：`paperBuilder` 对 T1 设 3 行、T2/T3 设 4 行，`paper.typ` 按 `workLines` 渲染，不画横线。
- 平均步数为 `tests/advanced.test.ts` 的实测断言（三档严格递增），本轮复跑一致。

### 29.4 双路径复核

- **① 独立重算**：`recompute(params)` 用与生成侧不同的算法（模拟 / 枚举 / 比例）重算答案，不复用生成时的中间值。
- **② 结构与解法一致性**：题干必须等于类别模板 `stem(params)` 的渲染结果；每一步的知识点键必须同时落在 `ADV_3A_KP`（12 个三上允许知识点）与类别 `kpKeys` 内；带算式的步骤由独立四则解析器 `evalArithmetic` 重算，必须等于该步 `result`。
- **③ 唯一解硬约束**：答案由参数唯一确定；策略类穷举确认最优方案唯一，并列即拒；题干禁模糊词。
- 去重键 `advancedKey = 主知识点 + 类别 + 排序后的参数结构`，同卷 `seen` 与跨卷 `MemoryStore` 都按此键，不按题干字符串。

### 29.5 审计与容量实测

- 300 题审计（3 档 × 5 卷 × 20 题，seed 按档加偏移）：复核失败 **0**（独立重算 0、结构-解法一致性 0）；同卷重复 **0**；跨卷重复 **0 / 2100 = 0.0%**；三档平均步数 **2.00 / 3.00 / 4.50**。本轮按同一参数复跑，结果一致。
- 单单元 20 题口径：U1/U2/U4/U9 三档均 20/20；U5/U6 仅 T1/T2 为 20/20（T3 不适用）；U3 仅 T2 可出，9/20（结构池为 2–4 行 × 2–4 列共 9 种，用尽即如实少出）；U7/U8 不适用。
- L2/30 题口径：U3 为 9/30（结构池），其余可用单元满 30；单题型上限 200，U9 的 L2/L3 均可出满 200 且同卷不重复。
- 反例 5 条全部拦住：步骤挂超纲知识点、步骤挂非本类别知识点（虽在三上集合内）、租船并列最优、题干加模糊词、题干加超纲词。

### 29.6 样张与回归

| 项 | 结果 |
| --- | --- |
| `node --test tests/advanced.test.ts` | 13/13 通过 |
| `node --test tests/*.test.ts` | 136/136 通过 |
| `npx vue-tsc -b` | 通过，0 错误 |
| 样张 `.quizlab/bench/advanced-samples.pdf` | 6 页；`check-layout` exit 0、RESULT PASS；字符碰撞 0 处；最小题干间距 29.26 mm；第 2 页起页眉为空 |
| 样张是否有版本库落盘 | 否：`samples/` 无该文件，PDF 与输出在忽略目录 `.quizlab/` 内 |

### 29.7 矩阵同步与限制

- 矩阵：`docs/三上题型可用性矩阵-0.4.0.md`，9 单元 × 12 题型 = **108 格**，汇总 **满 53 / 有上限 9 / 不适用 46**（不适用中 C1 19、C2 22、C3 5）。拓展题列：U3 记 9/30（结构池），U7/U8 记 C2，其余可用单元满 30。
- 限制：矩阵只按 L2、单题型、30 题逐格实测，L1/L3 与 200 上限未逐格验证；U3 结构池只有 9 种；U7/U8 未建结构；样张与审计产物未入库；被拒类别清单未留档。

## 三十、0.4.0 第六项：数图形入卷 / 列式两处缺口 / U3 假命题扩充（2026-11-05）

### 30.1 数三角形 / 数长方形接入图形题型

- 计数配方从 `src/quiz/angle.ts` 的「方案小样」迁入 `src/quiz/geom.ts`，成为正式 `geom` 形态 `count-triangles` / `count-rectangles`；`angle.ts` 不再保留重复实现。
- **只画图、不判分**：`renderSegmentScene` 只接收线段坐标；答案在出题侧按参数独立重算——数三角形 `C(k+2,2)`（k 为底边分点数），数长方形 `C(m+1,2)×C(n+1,2)`（m、n 为完整网格行列数）。运行时复核 `geomRecompute` 用同一独立公式，不读取图形标注。
- **单元归属**：U8 数学广场三档均出 `count-triangles` / `count-rectangles`；U9 复习继承 U3 认识图形、U6 周长与 U8 数图形共 14 种形态；U3/U6 原形态不变。
- **去重**：同卷 `seen` 与跨卷 `MemoryStore` 继续用 `geomKey = 形态 + 图形规格 + 参数`。实测 U8 20 题连续两卷零复用；U8 池不足以撑满 20 时按现有口径回退旧题，不静默重复。
- **实测（L2 / 30 题，seed 31337，全新 MemoryStore）**：U8 实出 30/30（数三角形 20 + 数长方形 10，复核剔除 0）；U9 实出 30/30（复核剔除 0）；U8+U6 混选 30/30。U8 三档 L1/L2/L3 均 30/30。
- **样张**：`.quizlab/bench/bench-geom-3A-U8.pdf`（5 页）、`bench-geom-3A-U9.pdf`（6 页）、`bench-geom-3A-U8-3A-U6.pdf`（6 页），`typst/check-layout.py --compact` 均 PASS。

### 30.2 列式计算补两处缺口

- **U6 周长**（`src/quiz/lieshi.ts`）：新增长方形 `(a+b)*2` 两种问法（「长 a 厘米、宽 b 厘米的长方形，周长是多少厘米？」/「一个长方形的长是 a 厘米，宽是 b 厘米……」）与正方形 `a*4`（边长×4）。单元显式挂 U6/U9；目标算式 `(12+5)×2` 实测输出 `(12+5)×2`、答案 34，双路径复核通过。
- **U2 的 L2 括号句式**：新增 3 条 `a*(b+c)` / `a*(b-c)` 句式（每排人数×（男女生排数和）、单价×（先买+再买）、每盒个数×（买了-送出）），份数先合并成一位数，符合「用一位数乘」。
- **体例与去重**：仍先定 AST 形状再翻中文模板；同卷同一句式 ≤2 次；跨卷按「句式 + 数值结构」去重；两条复核路径（独立重算 + 模板反解）全部通过，复核剔除 0。
- **实测（L2 / 30 题）**：U6 实出 4/4（2 种问法各 2 题）；U2 实出 6/6（3 种句式各 2 题）；U9 由 24 提升到 30/30（L2 17 种句式）。全单元 20 题三档仍 20/20/20，句式 L1/L2/L3 为 20/17/20 种。
- **样张**：`.quizlab/bench/bench-lieshi-u6-l2.pdf`（1 页）、`bench-lieshi-u2-l2.pdf`（1 页）、`bench-lieshi-u9-l2.pdf`（5 页），`check-layout --compact` 均 PASS。

### 30.3 U3 判断题假命题扩充

- 新增 **11 条假命题、11 个知识点**（`src/quiz/concepts.ts`），每条单一错误点、真值明确、判据写在 `rationale` 且包含 `singleError` 原文；全部落在三上 U3：三角形/四边形顶点数、角的顶点与边、四边形四边是否都相等、正方形与长方形关系、平行四边形与长方形/梯形关系、锐角大小、三角尺直角、边长不影响角的大小、锐角三角形判定。
- 绝对化词 2 条（「都」「所有」）均带 `absoluteReview` 特例；模块加载自检（真值/判据/单元/知识点格式/单一错误点/绝对化复核）全部通过。
- **池子变化**：U3 命题 L1 29→38、L2 34→45、L3 26→37；可用知识点 L1 21→30、L2 24→35、L3 19→30。
- **实测（单勾 U3、判断题）**：30 题口径三档由 21 / 24 / 19 提升到 **30 / 30 / 30**，每档 **真 15 / 假 15**，同卷 30 个知识点唯一；20 题口径三档均 20/20（真 10 / 假 10）。复核剔除 0。

### 30.4 剩余空格的说明（本轮不动手）

| 格子 | 缺什么 | 补它要做的改动 | 粗估工作量 |
| --- | --- | --- | --- |
| 3A-U5 × 口算 | 月份天数、整时经过时间、日期推算等可单值化口算 | U5 加 3–4 条 `kousuan` 规则 + 独立复核分支 + 跨卷去重 + 测试；答案带「天/时」时统一口径 | 中（约 3–4 条规则、1 个复核分支、10+ 测试） |
| 3A-U6 × 比大小 | 周长/边长数值比较 | 比大小池加「周长 vs 边长」同量纲结构，复用现有比大小复核；跨单位换算需先定是否超三上范围 | 小（约 2–3 个结构、1 个池扩展） |
| 3A-U7 × 口算 | 项目式单元没有独立口算素材，需先做教材核对 | 先确认可单值化的里程/时间素材，再建 2–3 条规则；不建议按普通单元硬套 | 中大（含教研确认，规则本身约 2–3 条） |
| 3A-U3 × 选择题 | 概念命题缺同量纲干扰项 | 为 35 个知识点各配 3 个不歧义干扰值，或从命题库派生选择形态并接入选择复核 | 中大（35 组干扰项 + 复核 + 测试） |

> U7 × 口算的优先级低于 U6 × 比大小：前者需要教研确认「该不该有」，后者只是生成规则缺口。U1 × 竖式仍按现有口径记 C2，不排期。

### 30.5 回归与提交

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | **140/140 通过**（基线 136，新增/调整 4 条） |
| `npx vue-tsc -b` | 通过，0 错误 |
| 样张 | 6 份 PDF，`check-layout --compact` 全部 PASS |
| 提交 | 任务 1 `2e3c22c`；任务 2 `18bd1aa`；任务 3 `18020f8`；文档另提 |
| 版本 | 保持 `0.4.0-beta.2`，未打 tag、未 push |

### 30.6 矩阵同步

- 108 格汇总由 **满 53 / 上限 9 / 不适用 46** 变为 **满 58 / 上限 8 / 不适用 42**（C1 17、C2 21、C3 4）。
- 新增满格：U8 × 图形与周长、U9 × 图形与周长、U3 × 判断题、U9 × 列式计算。
- 另有 U1 × 判断题在 seed 31337 下由 29 回到 30（源池贴近上限，换 seed 实测 26–30），不计为容量提升，矩阵记「满（源池贴近上限）」。
- 新增上限格：U2 × 列式计算 6/30、U6 × 列式计算 4/30（句式 ×2 封顶）；上限格总数 9→8。
- 剩余空格 4 格：U3 × 选择题、U5 × 口算、U6 × 比大小、U7 × 口算。




## 三十一、0.4.0 第七项：拓展题教研评审修复（2026-11-05）

按 `docs/拓展题教研评审-0.4.0.md` 执行，评审结论已拍板，不重新评估类别存废。可做类别由 **15 类 → 13 类**（T1 7 / T2 5 / T3 1）。

### 31.1 P0 三项

- **归一/归总数域**：归一单价 2–9（橡皮 1–5）、数量 2–8、新数量 3–9，答案 ≤99；归总新每天 3–9。全组合扫描 13 类 × 3000 次 = **39000 道**，两位数除法 0、两位数×两位数 0；归一最大答案 81。
- **星期几写法**：日期下限 8、上限当月月末，`MONTH_DAYS` 补 2 月（平年 28 天）；整周题单独改写为"正好 2 周，星期不变"；起算点写死"从1日算起（1日算第1天）"；禁止 `÷7=0……`、`……0`、`往后数0天`、`中间过了`。3000 次抽样整周题 491 道全部走改写分支，禁区命中 0。
- **剪拼唯一解**：题干锁"从一端剪下"，invariant 排除 `l=2w`，验算改为"原周长 − 2×宽"（独立于 `2×原长` 的重算）。3000 次抽样 `l=2w` 0 道，剩下部分边长差最小 1 厘米，第二答案消失。

### 31.2 租船留白与按类别行数

`AdvancedCategory.workLines` 按类别定：租船 **8 行（68mm）**，重叠 5 行（42.5mm），经过时间/逆向/剪拼/图形代表数/星期几 4 行（34mm），其余 T1 类 3 行（25.5mm）。租船方案数控制为 **3–5**（大船 0..maxBig，maxBig ≤4），实测睡不下/并列最优均被拒。A4 两栏、正文 14pt、页眉未动，三档样张 `check-layout` PASS。

### 31.3 其余"需修改"类别

等量代换改西瓜/书包两类等量关系（移除杯/盒中盒语义，铅笔用"支"，排除答案 4）；经过时间改 5 分钟步进、规范读法、分段法、答案双写；拼周长补 `个数×边长` 一步；逆向改"从结果倒着想"；重叠加"可以先画两个圈"提示并留 5 行；图形代表数符号改 △/□/☆；周期第 2 步改"第 n 个是第 q 组的第 r 个"；租船重写第 2 步、零条改"只租大船 N 条"。保留：年龄差（差不变，保留几年后干扰）；重叠/图形代表数教材归属未核对，按"保留 + 选做定位"处理，未删除、未改问法。

### 31.4 删类

删除 `adv-sum-diff`（和差）与 `adv-count-rect`（数长方形）。`src/quiz/geom.ts` 的数长方形保留并承接能力：U3 单开时按 `ceil(count/5)` 配额补充（10 题实测 2 题），U8 中数长方形同样按 20% 限流（30 题实测 24 数三角形 + 6 数长方形）。矩阵 U3 × 拓展题由"9 上限"改为 **C2 不适用**。

### 31.5 上一轮待定项

- 数长方形网格上限 **2–5 → 2–4**（6 种网格）。
- "正方形不是长方形""平行四边形是长方形""梯形是平行四边形"3 条假命题从 L1 挪到 L2/L3；U3 L1 判断题容量 30 → **27**（真 13 / 假 14），L2/L3 仍 30（真 15 / 假 15）。
- U6 列式保持 4 题上限，未加"已知周长反求长宽"。
- U3 教材含"三角形与四边形初步认识"，**开**数图形但小配额，不挤掉认图形/分类/小棒等原有形态。
- U7 × 口算在矩阵正式记 **C1 按教材不适用**，不排期。

### 31.6 验证与提交

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | **145/145 通过**（新增 P0 扫描/写法/剪拼/租船/反例 5 条） |
| `npx vue-tsc -b` | 通过，0 错误 |
| 拓展题样张 | 重新生成，7 页；`check-layout --compact` **PASS**（碰撞 0、题号错位 0、跨行拆组 0） |
| 300 题审计 | 复核失败 0（独立重算 0 / 结构-解法一致性 0）、同卷重复 0、跨卷重复 0 |
| 三档平均步骤 | 2.00 / 3.00 / 5.00 |
| 提交 | `ba8d65c`（拓展题）/ `aa7d9f6`（数图形）/ `07c4a3f`（关系判断）/ 文档随本提交 |
| 版本 | 保持 `0.4.0-beta.2`，未打 tag、未 push |

### 31.7 矩阵同步

- 108 格汇总：**满 58 / 上限 7 / 不适用 43**（C1 17、C2 22、C3 4）。
- U3 × 拓展题由上限格转为不适用（数长方形删除后 U3 无 T2 类别）；上限格总数 8 → 7。
- 剩余空格 3 格：U3 × 选择题、U5 × 口算、U6 × 比大小；U7 × 口算按教材记为不适用。

## 三十二、0.4.0 第八项：T3 补固定周长摆长方形 + 蒙对收紧（2026-11-05）

### 32.1 新类别「固定周长摆长方形」

- 注册为 `adv-arrange-rect`，T3，单元 `3A-U6` / `3A-U9`，主知识点 `3A-PERIMETER`，步骤键 `3A-PERIMETER` + `3A-STRATEGY`。
- 参数：周长取 **12–24 的偶数**（7 种）。题干写死"每根算一条边，正方形也算长方形"，因此长 ≥ 宽，无歧义。
- 解法 4 步：① 周长÷2 = 长+宽；② 有序枚举；③ 说明长每次少 1、宽每次多 1 不重不漏；④ 数出种数。
- 留白 **6 行（51mm）**，能写下 3–6 组方案。答案形如 `共3种：长5宽1、长4宽2、长3宽3`。
- 独立复核：生成侧按长从大到小枚举，`recompute` 按宽从小到大枚举，不复用生成中间值；invariant 拒绝奇周长与 12–24 之外。
- 实测：P=12 → 3 种；P=14 → 3 种（6+1、5+2、4+3）；P=16 → 4 种；P=24 → 6 种。1000 次抽样周长均在 12–24。
- T3 由 1 类变 **2 类**（租船 5 步 + 固定周长 4 步），平均步骤 **4.50**。

### 32.2 蒙对收紧

星期几（7 选 1）与图形代表数（8 选 1）题干统一追加 **"（写出算式和答句）"**，孩子必须写过程才能得分；题干只增 8 字，A4 两栏/14pt/页眉不变，样张 `check-layout` PASS。答案空间本身未改，问法仍是教材单值问法。

### 32.3 验证与提交

| 项 | 结果 |
| --- | --- |
| `node --test tests/*.test.ts` | **147/147 通过**（新增枚举计数、退化情形、作答要求 2 条） |
| `npx vue-tsc -b` | 通过，0 错误 |
| 拓展题样张 | 7 页，`check-layout --compact` **PASS**（碰撞 0、题号错位 0、跨行拆组 0） |
| 提交 | `2a2545f`（新类别）/ `87cbe40`（蒙对收紧）/ 文档随本提交 |
| 版本 | 保持 `0.4.0-beta.2`，未打 tag、未 push |

### 32.4 矩阵同步

- 可做类别 **13 → 14 类**（T1 7 / T2 5 / T3 2）。
- 矩阵 108 格汇总不变：满 58 / 上限 7 / 不适用 43；U6/U9 × 拓展题仍为满（T2/T3 均可出）。
- 评审文档 P2-15 由"保留"改为 **已处理**；T3 结构单薄一项标记已补。

## 三十三、0.4.0 第九项：整删 U9、拆解 U8（2026-11-05）

### 33.1 单元归并 9 → 7

- `3A-U9 复习` 整删（无自有知识点，纯复用 U1–U8），提交 `36c39fb`。
- `3A-U8 数学广场` 拆解，新增分发层 `src/quiz/skeleton/u8-variants.ts`：按骨架 id 只取精选变式，不整包搬迁——U6 篱笆 fill 8 / word 8，U3 七巧板+小棒 fill 8 / word 7，U4 除法版 fill 2 / word 3，U2 纯数列 fill 3 / word 3，合计 42 条。
- `curriculum` 三上为 7 个单元（U1–U7）；`geom` 只认 U3/U6，`compare` / `advanced` / `lieshi` / `paperBuilder` 去掉 U8/U9 归属。

### 33.2 删除的形态

- 填空与应用删除 `maxArea`（"围成正方形面积最大"及反求边长）：U8 独占、重心偏离本册周长主线，`FillFormName` 同步移除。
- U9 独占的"摆花盆"等混合场景随 `u9-review-*` 四个文件一并移除。
- 旧文件 `u8-math-plaza-fill/word`（含 `.bands`）保留，仅作 `u8-variants` 数据源，不再注册为骨架包。

### 33.3 专练入口取舍

- 单元树只列 7 个单元；`paperBuilder` 删 `3A-U8` 的"不适用"提示项，U8/U9 不再可勾选。
- 变式不单开专练入口，只在目标单元内按约两成配额混出。

### 33.4 矩阵与验证

- 矩阵 108 → **84 格**：满 44 / 上限 7 / 不适用 33（C1 13、C2 18、C3 2）。
- `node --test tests/*.test.ts` 147/147；`npx vue-tsc -b` 0 错误。
- 版本保持 `0.4.0-beta.2`，未打 tag、未 push。

## 三十四、0.4.0 第十项：按教材核对删两类拓展题（2026-11-05）

- 删除 `adv-overlap`（两个集合的重叠）：沪教版小学阶段无教材落点，属人教版三上"数学广角·集合"。
- 删除 `adv-symbol`（图形代表数）：属沪教版五上《符号表示数》，超出三上；实现整删，不留半成品。
- 同步清理：`advanced.ts` 类别注册表、`draw`/`build`/`recompute`/`invariant` 分支、无类别提示文案；`tests/advanced.test.ts` 的类别数（14 → 12）、留白表、蒙对收紧用例。
- 类别分档：**12 类 = T1 7 / T2 3 / T3 2**（T2 由 5 减为 3；T3 未变，仍为租船 + 固定周长）。
- 矩阵单元格总数不变（84 格），仅同步拓展题说明；图形代表数未来若要恢复，仅做选做/挑战档，并先补「符号表示数」前置说明。

## 三十四、0.5.0-beta.1：补三格（U6 比大小 / U5 口算 / U3 选择题）（2026-11-05）

### 34.1 U6 × 比大小（周长同量纲比较）

- 版本升到 `0.5.0-beta.1`（package.json / Cargo.toml / Cargo.lock 的 quizlab 条目 / tauri.conf.json），提交 `e2ce5b9`。
- `compare.ts` 新增两个形态：`perimeter`（L1，题面带厘米单位：`(长+宽)×2 厘米` 与 `(边长+边长)×2 厘米`）与 `perimeterFormula`（L2/L3：`(长+宽)×2` 与 `边长×4`）。
- 数值：L1 长 3–10、宽 2–长−1、边长 2–10；L2 3–20；L3 8–40，周长一律 ≤ 160，落在三上心算范围。
- 复核沿用现有路径：`verifyItemStructure` → `evalCompareSide` 按题面独立求值再与标注答案比对，未新增复核器。
- 实测 L2/30：实出 30，同卷重复 0，答案分布 `<`18 / `>`11 / `=`1（L1 抽样），L2/L3 各 30 条全部复核通过。

### 34.2 U5 × 口算（月份天数、整时经过、日期推算）

- 新增 `src/quiz/dateKousuan.ts`：4 条口算素材 `monthDays`（12 个月，2 月题面必写「平年/闰年」）、`bigMonths`（一年 7 个大月）、`elapsedHour`（整时经过，L1 ≤2 时 / L2 ≤4 时 / L3 ≤6 时）、`dateOffset`（L1 ≤3 天 / L2 ≤5 天 / L3 ≤7 天，只在不跨月范围取，保证答案是唯一的「几号」）。
- 题面用「（　　）」留空，答案一律单值整数；卡片样式与现有口算两栏一致，未改排版参数。
- 复核分支：生成侧 `selfCheck` 与运行时 `verifyCalcQuestion` 都调用 `verifyDateKousuan`，只凭 features 里的月份 / 起止时刻 / 起始日期重新算，并校验题面与参数一致；参数不合法（如往后 0 天、跨月、结束不晚于开始）直接判失败。
- 规则接线：U5-K1 三档 `elapsedHour`；U5-K2 三档 `monthDays + bigMonths + dateOffset`。
- 实测：L1/L2/L3 各 30 题均出满、同卷重复 0、运行时剔除 0；四类素材在 30 题里都出现（约 15 / 6 / 8 / 1）。样张 `.quizlab/bench/u5-kousuan-l1.pdf`，`check-layout --compact` PASS。
- 测试：`tests/date-kousuan.test.ts` 8 条（含 300 次抽样、改答案 / 零天 / 跨月 / 题面不符拦截、三档 30 题独立性）。
