# QuizLab 协作指引

## 语文阅读题库（采集 / 命题 / 质检 / 挂载）

只要任务涉及下列任一项，**先读 SOP，再动手**：

- `data/reading-catalog/` 下的采集、清洗、命题、质检、去重、挂载
- `data/reading-catalog/quiz-drafts/` 的增删改
- `src/data/chinese/readings/mounted.ts` 或阅读出卷链路

必读顺序：

1. `docs/reading-bank-sop-finalize-3a.md`（流程唯一来源；所有年级共用，不复制流程）
2. `data/reading-catalog/grades/<年级>.json`（三年级上册为 `3a.json`；新年级先按 SOP §1 复制 3a 并只改差异项）
3. `data/reading-catalog/progress/<年级>.json`（断点状态；从 `nextBatch` / `stage` 续跑，不靠对话记忆）

固定入口命令：

```bash
python3 tools/reading-intake/review_batch.py --start RD-xxx --count 20   # 取下一批
python3 tools/reading-intake/quality_gate.py                            # 门禁 + 写 quality-gate.jsonl
python3 tools/reading-intake/export_mounted.py                           # 只导出 pass 篇，生成 mounted.ts
```

硬规则：

- 未过 `quality_gate.py` 的稿不得进入正式题库；`mounted.ts` 只能由 `export_mounted.py` 生成，不得手改。
- 每批结束必须更新 `progress/<年级>.json` 并单独提交；停下来问人的条件见 SOP §9。
- 正文只允许清洗，不允许补写、改写、拼接、按常识猜字；细则见 SOP §2。

## 其他模块

- 数学题库与出卷：见 `docs/` 下对应版本说明。
- 前端改动后跑 `pnpm build`（含 `vue-tsc -b`）。
