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

## 教材核对来源（人教社官方电子教材）

凡是需要核对教材原文、字表、词语表、语文园地、习作/口语交际目录，**先到这里取官方页，不要用教辅 OCR 或拍照页当定稿依据**：

1. 打开 `https://jc.pep.com.cn/`，按「学段（义务教育 五四学制 / 六三学制）→ 学科 → 年级」筛选，点卡片「在线阅读」。
2. 链接形如 `https://book.pep.com.cn/<bookId>/`，`<bookId>` 现查现用，不靠猜。已确认：五四学制语文三上 `1211001301252`，三下 `1211001302252`。
3. 逐页图 `https://book.pep.com.cn/<bookId>/files/mobile/{N}.jpg`（高清版 `files/page/{N}.jpg`），必须带请求头 `Referer: https://book.pep.com.cn/<bookId>/`，否则 403 Referer ACL。
4. 页码偏移先用已知页核对再批量取：五四制语文三上 **N = 书页码 + 6**（如识字表 p109 = 115.jpg，词语表 p114 = 120.jpg）。其他册次偏移不同，不得套用。
5. 版本确认：看封面「国家教材委员会审核通过 2024」并用新版特有篇目反证（三上为《犟龟》《一个粗瓷大碗》），不能只看目录标题。
6. 版权：页底标注「仅供个人学习使用，未经授权不得另做他用」。只作**校对依据**，不把整页图或整篇课文打包进应用；题库只保留字表、词表、古诗、日积月累等必要事实数据。

附录自检口径：识字表蓝色字为多音字、不计入「共 250 个生字」；词语表逐课合计 250 词；写字表逐行清点与书末标注可能差 1，差数要复核并如实记录，不猜补。

## 其他模块

- 数学题库与出卷：见 `docs/` 下对应版本说明。
- 前端改动后跑 `pnpm build`（含 `vue-tsc -b`）。
