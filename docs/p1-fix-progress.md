# v0.3.0 复评修复进度（小步落盘）

> 用途：网络中断后按本文件继续，不需要重跑已完成部分。
> 续跑方式：一次推进 1–2 条 → 跑该条针对性测试 → 把数字补回本文件。
> 原交付标准不变：三档都测、`node --test tests/*.test.ts` 全绿、`check-layout.py --compact` PASS、样张进 `samples/`、不改版本号与 CHANGELOG。

## 总览

| 条目 | 最终状态 | 关键证据 | 遗留 |
|---|---|---|---|
| P0-N1 相框单位错配 + 单位自检 | 已修 | 应用 500 + 填空 269 = 769 道，单位错配 0；测试 600 道零错配 | 无 |
| P1-N2 U8 恢复 4–6 种玩法、与 U6 交集 0 | 已修 | U8 每档 4 种玩法：wallFence/tangram/pattern/maxArea；distinct 应用 16–21、填空 15–22；最高模板 0.100–0.167；与 U6 交集 0 | 无 |
| P1-N1 小配额核心比例 ≥70% | 已修 | L1/L2/L3 的 2 题/3 题真实卷，核心比例均 100%（5 seed） | 无 |
| P1-N3/N4 单模板压到 ≤30% | 已修 | 三单元三档最高模板 17.5%–30.0%，全部 ≤30% | 无 |
| P1-N5 按解答步数给留白行（上限 7） | 已修 | 五步满减题 workLines=6；一问题最大 2 行 | 无 |
| P1-N6 三下简算只保留凑整、三档测试 | 已修 | 3B-U2 / 3B-U7 的 L1/L2/L3 全部 `assoc`，表达式均为纯三因数凑整 | 无 |
| 16 题卷页容量实测与建议 | 已修（动态默认题量） | 填空 28.9pt、应用 L2 147.2pt / L3 195–219pt；默认题量 L1=20/L2=16/L3=12；16 题 L3 = 3 页（第 3 页 3 题，非空） | 强制 16 题 L3 仍为 3 页（属设计取舍，见建议） |
| 满减题数值上限（同价 / 五位数） | 已修 | shop3 同价 0/78；三商品总价 ≤97；满减最大答案 7065；K4 L3 ≤9999 | 无 |
| 样张与版式校验 | 已验收 | 5 份样张在 `samples/`，`--compact` 全部 PASS；页数 2/2/2/2/3 | 无 |

## 逐条明细

### P0-N1 相框单位错配 + 单位自检

已改文件：

- `src/quiz/word.ts`
  - `buildPerimeter` L1 相框改为厘米尺寸，`params.unit='厘米'`，题干/问句/解答统一厘米。
  - L1/L2/L3 全部变式显式写 `params.unit`。
  - 新增 `DIM_UNITS`、`ASK_UNIT_RE`、`checkUnitConsistency()`：把“多少X”的所求单位与最后一问解答行单位比对，不一致判生成失败；候选循环里也调用。
  - `verifyWordQuestion()` 调用 `checkUnitConsistency()`。
- `src/quiz/fill.ts`
  - `rectPerimeter` / `squarePerimeter` / `squareArea` 三档显式 `unit`；分米题改为问分米/平方分米。
  - 新增 `checkFillUnitConsistency()`：空位后的单位与 `params.unit` / 平方单位比对；`verifyFillQuestion()` 与生成循环均调用。
- `tests/p1-quality.test.ts`
  - `P0-N1`：5 单元 × 3 档 word/fill，独立抽取“多少X”与最后一步单位比对，样本 ≥500（实际 600）。

修复前（复评文档）：1681 道周长/篱笆题中 183 道错配（U6 L1 78/200、3B-U1 L1 78/200、3B-U7 L1 27/200）。

修复后实测（`node --experimental-strip-types /tmp/quizlab-p0-audit.ts`，seed 1401/1402）：

- 应用题抽查 500 道（5 单元 × 3 档 × 40，几何 form 过滤）：`verifyWordQuestion` 失败 0，问句单位与解答末步单位错配 0，问句单位未在题干出现 0。
- 填空题抽查 269 道（几何题型）：`verifyFillQuestion` 失败 0。
- 分单元：3A-U6 120/0、3A-U8 100/0、3B-U1 40/0、3B-U6 120/0、3B-U7 120/0。
- 测试 `P0-N1`（600 道随机）通过：`node --test tests/p1-quality.test.ts` 26 pass / 0 fail。

### P1-N2 U8 恢复多样

- `src/quiz/word.ts`：`buildWallFence` 多模式 + `buildPattern`（找规律填图）+ `buildMaxArea`（图形最值）+ 本轮新增 `buildTangram`（七巧板拼摆，L1/L2 各 3 模式、L3 3 模式）；`verifyWord` 新增 `tangram` 独立复核。
- `src/quiz/fill.ts`：`buildWallFence` L1/L2/L3 各 4 模式；`buildPattern`、`buildMaxArea`、本轮新增 `buildTangram` 并注册；`verifyFill` 新增 `tangram` 分支。
- `src/quiz/types.ts`：`FillFormName` / `WordFormName` 增加 `tangram`。
- `src/data/curriculum.ts`：U8-K2 tiankong/word 三档均为 `[wallFence, tangram, pattern, maxArea]`；U8-K1 说明改为由 K2 的 tangram 玩法承载。
- `tests/p1-quality.test.ts`：`P1-A4` 允许集合加入 `tangram`；`P1-N2` 要求四种玩法齐备、distinct≥4、与 U6 交集 0。

修复前（复评文档）：U8 六个组合全是“一面靠墙篱笆”，每档 60 题 distinct=1，100% 单模板。
修复后实测（seed 1410/1411，每档 60 题）：

| 难度 | 应用 distinct | 应用最高模板 | 填空 distinct | 填空最高模板 | 与 U6 交集（应用/填空） | 玩法分布（应用） |
|---|---|---|---|---|---|---|
| L1 | 21 | 0.100 | 22 | 0.117 | 0 / 0 | wallFence 37、tangram 12、pattern 6、maxArea 5 |
| L2 | 19 | 0.133 | 21 | 0.167 | 0 / 0 | wallFence 32、tangram 14、maxArea 6、pattern 8 |
| L3 | 16 | 0.133 | 15 | 0.167 | 0 / 0 | wallFence 34、tangram 12、maxArea 8、pattern 6 |

- 每档 4 种玩法（wallFence / tangram / pattern / maxArea），满足“4–6 种”要求；篱笆只是其中一种。
- 60 题独立复核：word `verifyWordQuestion` 失败 0、fill `verifyFillQuestion` 失败 0。
- 针对性测试：`node --test tests/p1-quality.test.ts` → 26 pass / 0 fail（含 `P1-A4`、`P1-N2`）。

### P1-N1 小配额核心比例

- `src/quiz/word.ts` `resolveTargets()`：`3B-U2` 目标排序强制核心形态（K3/K4/K6/K1）优先；`generateWord` 按 `targets[index % targets.length]` 取值，因此 2–3 题卷的前 2–3 题必为核心。
- 测试：L1/L2/L3 × count 2/3 × 3 seed，断言实际题量等于 count，核心（`twoDigitSteps>0`）比例 ≥70%。

修复前：只出 2–3 道应用时核心比例跌到 50%–67%。
修复后实测（每档 count=2 与 count=3，seed 1420–1424）：

| 难度 | 2 题最低核心比例 | 3 题最低核心比例 |
|---|---|---|
| L1 | 100% | 100% |
| L2 | 100% | 100% |
| L3 | 100% | 100% |

### P1-N3/N4 单模板

- `src/quiz/word.ts`：本轮在 `buildPerimeter` **补骨架**而不是删形态——
  - L1 由 4 种扩到 6 种：新增“长方形黑板装边框（分米）”“长方形手帕缝花边（厘米）”。
  - L2 由 4 种扩到 6 种：新增“长方形画框算边框费用（厘米）”“长方形地毯算包边费用（米）”。
  - 面积 L3 已在上一轮扩到 8 个场景；`buildTimePlan` L2 已有 6 个上课场景并把 `place` 写入 `params`。
- 测试改为三单元（3A-U6 / 3B-U1 / 3B-U6）× 三档 × 40 题，全部断言 `maxShare ≤0.3`。

修复前实测（同一 seed 1430，40 题）：

| 单元 | L1 | L2 | L3 |
|---|---|---|---|
| 3A-U6 | 35.0% | 37.5% | 20.0% |
| 3B-U1 | 35.0% | 12.5% | 10.0% |
| 3B-U6 | 25.0% | 25.0% | 41%（复评值）/ 本轮修复前 17.5% |

修复后实测（seed 1430–1434 取最高值，40 题）：

| 单元 | L1 | L2 | L3 |
|---|---|---|---|
| 3A-U6 | 27.5% | 25.0% | 22.5% |
| 3B-U1 | 27.5% | 20.0% | 17.5% |
| 3B-U6 | 27.5% | 30.0% | 22.5% |

- 单模板全部 ≤30%；句式数：U6 L1/L2 由 4→6、L3 保持 8；3B-U1 L1 由 4→6、L2 12–15、L3 16–19。

### P1-N5 留白行数

- `src/quiz/word.ts`：`workLinesOf(questions, judge, steps)` = `min(7, max(2, 2*questions + judge, steps + 1))`，生成时传入实际解答步数。
- 测试：五步满减题 `workLines` ≥6 且 ≤7；一问题 `workLines` ≤3。

修复前：3B-U2 L3 两问五步满减题只有 4 行。
修复后实测（seed 1440/1441）：

| 形状 | workLines |
|---|---|
| 问 1 / 步 1 | 2 |
| 问 2 / 步 2 | 4–5 |
| 问 2 / 步 4 | 5 |
| 问 2 / 步 5 | 6 |

- 一问题抽 30 道，最大 2 行，没有被拉宽到 7 行。

### P1-N6 三下简算

- 选择：**只保留“凑整”**（删掉结合律/分配律形式），不选“标注拓展 + 界面提示”。
- 理由：三下教材的简便运算目标是用交换律、结合律把 25×4、125×8、50×2 等先凑成整百/整千；分配律（如 a×(b+c)）不属于三下范围。若标为拓展，需要额外的界面标识与难度分层，且会让三下学生练到未学方法，收益低、风险高。
- `src/data/curriculum.ts`：3B-U2-K3 与 3B-U7 的 `jianbian` 三档均为 `assoc`。
- 测试：两处 L1/L2/L3 全部断言 `form=assoc`，且 `latex` 必须是纯三因数乘法（无括号、无加号）。

修复前：3B 简便运算仍出现结合律/分配律，测试只测 L1 所以漏过。
修复后实测（seed 1450，每档 20 题）：

| 单元 | L1 | L2 | L3 |
|---|---|---|---|
| 3B-U2 | 20/20 assoc | 20/20 assoc | 20/20 assoc |
| 3B-U7 | 20/20 assoc | 20/20 assoc | 20/20 assoc |

- 示例：`25 × 6 × 4 → 100 × 6 → 600`；`125 × 8 × 6 → 1000 × 6 → 6000`；`4 × 250 × 2 → 1000 × 2 → 2000`。

### 16 题卷页容量

- 实测工具：PyMuPDF 取 text block bbox，A4 595×842pt；正文区 51.7–790pt，页容量 ≈738pt。
- 单题实测：填空 28.9pt；应用 L2 147.2pt、L3 195.4–219.4pt（题干 2 行 + 留白 5–7 行）。
- 每页容量：填空 ≈25 题、应用 L2 ≈5 题、应用 L3 ≈3 题。
- 16 题卷实测（9 填空 + 7 应用）：
  - 3B-U6 L2：2 页，无第 3 页。
  - 3B-U2 L3：3 页，第 3 页 2 题。
  - 3B-U6 L3：3 页，第 3 页 3 题（不是 1 题，也不是空页）。
- 估算：L3 16 题约 9×28.9 + 60 + 7×200 = 1660pt > 2 页 1476pt，模板层压不下去；再压留白会破坏 P1-N5 的五步题下限。
- 落地方案：按题型/难度动态算默认题量。`paperBuilder.ts` 新增 `recommendedCount()`：混合卷 L1=20、L2=16、L3=12；纯填空=30；纯应用 L3=6、L1/L2=8。已接入 `make-mixed-paper.ts` 作为默认 `--count`。
- 结论：默认 12 题的 L3 混合卷稳定 2 页；用户强制 16 题的 L3 混合卷仍是 3 页，第 3 页有 2–3 题（非空）。16 题只建议 L1/L2 或纯填空。

### 满减题数值

- `src/quiz/word.ts`：`shop3` 三个单价两两不同（2–9 元），总价 ≤97；`pairDiscount` 单价 108–299、数量 10–15，总价 ≤7470；`bulk` L3 收窄到合理乘法范围。
- `src/data/curriculum.ts`：3B-U2-K4 `chushi` L3 `maxResult` 9999。
- 实测（seed 1500–1504）：shop3 同价 0/78（修复前 44%）；全单元满减题最大答案 7065，超 9999 的 0 道；pairDiscount 最大总价 7093；K4 L3 最大乘积 ≤9999。
- 测试：`P2-N1` 单价两两不同；`P2-N2` K4 乘积万以内；`P2-N3` 满减/三商品总价 ≤9999 且商品不同价。

## 最终验收（2026-11-03）

- `node --test tests/*.test.ts`：51 pass / 0 fail（duration 320ms）。
- `pnpm build`：通过（`vue-tsc -b && vite build`）。
- 最终样张（全部 `check-layout.py --compact` PASS）：

| 文件 | 题量 | 页数 | 校验 |
|---|---|---|---|
| `samples/v0.3.0-beta.1-3A-U5-L3-填空应用题.pdf` | 12（7+5） | 2 | PASS |
| `samples/v0.3.0-beta.1-3A-U6-L2-填空应用题.pdf` | 16（9+7） | 2 | PASS |
| `samples/v0.3.0-beta.1-3B-U2-L3-填空应用题.pdf` | 12（7+5） | 2 | PASS |
| `samples/v0.3.0-beta.1-3B-U6-L2-填空应用题.pdf` | 16（9+7） | 2 | PASS |
| `samples/v0.3.0-beta.1-3B-U6-L3-填空应用题-16题.pdf` | 16（9+7） | 3 | PASS |

- 16 题 L3 卷第 3 页仍有 3 题（非空），属于“16 题超出 2 页容量”的设计取舍；默认混合卷 L3 已是 12 题、2 页。
- 验收期间仅修一处既有构建错误：`u5-date.ts` 移除未使用的 `febDays` 导入（不影响出题逻辑）。

### 仍未修的问题与建议版本

| 问题 | 影响 | 建议 |
|---|---|---|
| 强制 16 题 L3 混合卷仍为 3 页 | 第 3 页有 3 题，浪费半页 | v0.3.1 评估按题型动态上限（已落地默认 12 题）；不建议压缩留白，会破坏 P1-N5 |
| 3B-U2-K1 L2 高题量（>36 题）容量不足 | 大批量单卷会失败 | v0.3.1 扩充“出行”场景/数值组合 |
| 三下单元仍标 `unconfirmed` | 不影响出题，仅提示教材待确认 | 保持现状（本轮约束明确不改） |

## 样张

最终 5 份已生成并 `check-layout.py --compact` PASS：

- `samples/v0.3.0-beta.1-3A-U5-L3-填空应用题.pdf`（2 页）
- `samples/v0.3.0-beta.1-3A-U6-L2-填空应用题.pdf`（2 页）
- `samples/v0.3.0-beta.1-3B-U2-L3-填空应用题.pdf`（2 页）
- `samples/v0.3.0-beta.1-3B-U6-L2-填空应用题.pdf`（2 页）
- `samples/v0.3.0-beta.1-3B-U6-L3-填空应用题-16题.pdf`（3 页，第 3 页 3 题）

## 轮次记录

- 轮次 1：建立进度文件；复核 P0-N1 实现与测试；审计 769 道（应用 500 + 填空 269）零错配，已回写。
- 轮次 2：P1-N2 新增 `tangram`（七巧板拼摆），U8 每档 4 种玩法；distinct 应用 16–21、填空 15–22，最高模板 0.100–0.167，与 U6 交集 0；`p1-quality.test.ts` 26 pass / 0 fail。本轮不动其它条目。另修两处既有 TS6133（`quarterDays(_q)`、`stats(_combo)`）保证 `pnpm build` 通过。
- 轮次 3：P1-N1 三档 2/3 题真实卷核心比例 100%；P1-N3/N4 在 `buildPerimeter` L1/L2 各补 2 个骨架（4→6 种），U6/3B-U1/3B-U6 三档最高模板全部 ≤30%（最高 30.0%）；`p1-quality.test.ts` 26 pass / 0 fail。本轮不动 N5/N6/页容量/满减。
- 轮次 4：P1-N5 五步两问题 workLines=6、一问题最大 2 行；P1-N6 选择只保留凑整，3B-U2/3B-U7 的 L1/L2/L3 全部 `assoc` 且表达式为纯三因数乘法；测试补强后 `p1-quality.test.ts` 26 pass / 0 fail，`pnpm build` 通过。本轮不动页容量与满减数值。
- 轮次 5：页容量实测完成并落地 `recommendedCount()`（混合卷 L1=20/L2=16/L3=12，已接入出卷脚本）；满减题审计 0 同价、最大答案 7065、总价均 ≤9999；新增 `P2-N3`、`P2-P1` 断言；`p1-quality.test.ts` 28 pass / 0 fail，`pnpm build` 通过。本轮未导出样张，最终验收时重编。
- 轮次 6（最终验收）：全量测试 51 pass / 0 fail；`pnpm build` 通过；重编 5 份样张进 `samples/`，`--compact` 全部 PASS（页数 2/2/2/2/3）；16 题 L3 卷第 3 页 3 题。未 commit、未改版本号与 CHANGELOG。
