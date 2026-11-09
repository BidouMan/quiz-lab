# 阅读短文素材录入工具（试跑版）

把试卷/练习册里的阅读短文（图片、扫描 PDF、可复制网页）整理成可入库的
`ChineseReading` 结构前的半自动流水线。全部脚本都在 `tools/reading-intake/`，
不碰 `src/**`。

## 依赖

- macOS 26+（用到 Vision 的 `RecognizeDocumentsRequest`，仅表格识别需要）
- Xcode Command Line Tools：`swiftc`
- Python 3.11+：`pymupdf`、`Pillow`（`pip3 install pymupdf pillow`）
- 第三方 OCR 对比用：`brew install tesseract tesseract-lang`

## 一次性编译

```bash
cd tools/reading-intake
swiftc -O vision_ocr.swift -o vision_ocr    # 逐行文字识别（快，主路线）
swiftc -O vision_doc.swift -o vision_doc    # 段落 + 表格（慢，仅表格页用）
```

## 用法

```bash
# 1) 一个目录批量：PDF/图片 -> 逐页 PNG -> Vision OCR -> 去页眉/合并断行
python3 intake.py batch <样例目录> --work work/xxx --dpi 300

# 2) 单步
python3 intake.py pages sample.pdf --out work/x/pages --dpi 300
python3 intake.py ocr work/x/pages --out work/x/vision
python3 intake.py clean work/x/vision/a.vision.json --out work/x/clean/a.txt
python3 intake.py blocks work/x/clean/a.txt --out work/x   # 导出 blocks.json

# 2.1) 默认结构切分：模型只输出段号，程序回填原文
python3 locate_with_llm.py work/x/blocks.json --out work/x/structured.json
#   模型失败/输出汉字/校验不过会自动回退规则切分，结果见 structureSource 与 fallbackReason
#   只验证兜底逻辑、不调模型：--rule-only

# 3) 表格页（可选，16 秒/页）
./vision_doc --out work/x/doc work/x/pages/a.png

# 4) 与人工校对稿比准确率
python3 intake.py eval ref.txt hyp.txt --out work/x/eval.json

# 5) 入库前自动闸门（规则与 tests/chinese-readings.test.ts 对齐）
#    结构回填并人工补客观题答案/主观题评分点后，跑这一步
python3 gate.py draft.json

# 5.1) 目录流水线（网页枚举来源，非图片）
python3 cli.py scan chinafable
python3 cli.py process --limit 5
python3 cli.py report

# 5.2) 本地导出目录（公众号导出工具批量导出后）
python3 cli.py scan --local ~/Downloads/公众号导出 --exporter "导出工具名"
python3 cli.py process --source local-export --limit 10
python3 cli.py report

# 6) 补充实验：模型只输出段号、程序回填原文（对比规则切分）
python3 locate_experiment.py --out work/locate/result.json
#   已跑过一次时可复用段号，不再调模型：
python3 locate_experiment.py --out work/locate/result.json --reuse
```

`intake.py eval` 输出字符准确率、编辑距离、逐条错误（形近字/标点/漏行等）。
`gate.py` 只做机器能判的项；来源真实性、答案是否符合题意必须人看。

## 结构切分默认路线（图片/扫描件）

`Vision 文字块 -> 模型只输出段号 -> 程序回填` 是默认步骤，规则切分只做兜底：

1. `intake.py clean` 输出 `clean.txt`。
2. `intake.py blocks` 导出 `blocks.json`。
3. `locate_with_llm.py` 让模型输出 `title/passage/questions` 的段号映射；
   程序按段号回填原文，模型不接触原文，因此原文不会被改写。
4. 回填后自动校验：值里不得出现汉字；①–⑥ 题号标记必须全覆盖且只出现一次；
   题号连续；同一段不得跨题重复；题干与选项同段按段号去重。
5. 任一校验不过或模型失败（超时、空正文、非法 JSON）自动回退规则切分，
   `structured.json` 的 `structureSource=rule`、`fallbackReason` 写明原因，不阻塞入库。
6. 人工补客观题答案与主观题评分点后，跑 `gate.py` 做入库前质检。

模型调用带重试（默认 2 次），仍失败即回退，不会产出残缺结果。

**复验状态**：段号方案在 3 篇样本上切分正确 3/3（规则 1/3），样本中 2 篇同源。
新版式 10 篇抽检尚未执行，需要新样本与可用模型额度；执行后把结果补到本文件。

## 结构化环节（可选，需模型接口）

```bash
export MIMO_BASE_URL=http://127.0.0.1:4099/v1
export MIMO_MODEL=deepseek/deepseek-v4-pro
export MIMO_API_KEY=...        # `mimo llm-server issue` 签发，不要写进仓库
python3 structure_with_llm.py work/x/clean/a.txt --out work/x/structured.json
```

注意：本机暂无可用的视觉模型，多模态「图片直出结构化」未跑通；该脚本当前只能
接收已识别文本。做图片直出时，同一提示词把 `content` 换成
`[{type:text},{type:image_url,...}]` 即可，接口是 OpenAI 兼容的。

## 素材状态与入库口径

`data/reading-catalog/items.jsonl` 的 `status`：

| 状态 | 含义 |
| --- | --- |
| `pending` | 已发现、待处理 |
| `imported` | 正文与题目通过红线检查 + `gate.py`，已写入阅读库 |
| `no-answer` | 正文合格但缺题目/答案，需人工命题；不算拒稿 |
| `no-questions` | 本地导出正文里没找到题目形态（通知、招生、活动稿等），保留正文待人工命题；不算拒稿 |
| `needs-redline` | 红线错字待核（答案字词、生字词语题面、题干引用原句），修好再跑 |
| `rejected` | 正文不合格（字数、段数、重复、题目不过闸），已写原因 |

`no-answer` 与 `rejected` 的区别：前者只差人工补答案，材料可用；后者是材料本身不能用。
`no-questions` 只用于本地导出目录：正文保留，补完 `questions/<seq>.json` 后 process 会自动重新走质检。

错字只核三类红线：答案所在字词、生字/词语题面字、题干明确引用的原句。
只准改回可查证的原字，不做润色。`qa.mustFix` 记必须修的红线错误，
`qa.benign` 记放过的非判分瑕疵（多余“的”、标点差异等），报告只汇总数量。

## 公众号来源（第一优先，当前受阻）

- 索引路线：`wechat_probe.py` 按关键词 + 搜狗微信枚举 `/link` 包装链接，还原
  `mp.weixin.qq.com` 地址后抓 `#js_content`。
- 实测 50 条：成功 2、撞验证 48、404 0、正文为空 0；第 3 条起搜狗跳 antispider，
  判定为本机 IP 限流，不是正文不可取。报告见 `data/reading-catalog/wechat-probe.json`。
- 结论：低于三成，不放量。索引路线不再自动扫；批量收集改走下面的本地导出目录。

## 如何用公众号导出工具

用任意公众号导出工具扫码登录一次，把某个公众号的历史文章批量导出到本地目录。
工具不限定，只要能导出下面三种格式之一即可；导入后 `scan` 不再需要登录态。

支持格式：

| 后缀 | 识别方式 |
| --- | --- |
| `.html` / `.htm` | 标题取 `#activity-name`，正文取 `#js_content`（或 `rich_media_content`），发布时间取 `#publish_time`；自动去掉“阅读原文”“点赞”“在看”“分享”等模板噪声 |
| `.pdf` | 有文字层直接抽文本；没有文字层走 `intake.py pages/ocr/clean` 的 Vision 流程 |
| `.txt` / `.md` | 第一个非空行作标题，其余作正文；`.md` 会去掉开头的 `#` |

目录怎么放：

- 递归扫描，子目录层级不限；非上述后缀直接忽略。
- 建议一个公众号一个子目录，文件名保留导出工具的原名，方便追溯。
- 原文链接：导出件里有 `og:url` 或 `mp.weixin.qq.com/s?...` 就写进 `sourceUrl`；
  没有就写 `local:<相对路径>#<导出工具名>`，工具名用 `--exporter` 传入。
- 重复：按正文指纹（sha256 + simhash）去重，同一篇被多个公众号转载只留一条，
  重复条目标 `rejected`，原因写“正文指纹与 RD-xxx 相同”。
- 内容预筛：正文里没有题号、括号、选项、“阅读下面的短文”等题目形态的，
  `process` 标 `no-questions` 并保留正文，不判拒稿，方便以后人工命题。

命令：

```bash
# 扫描本地导出目录；sourceId 默认 local-export
python3 cli.py scan --local ~/Downloads/公众号导出 --exporter "导出工具名"

# 只处理这批导出件，避免动到网页来源的待办
python3 cli.py process --source local-export --limit 10

python3 cli.py report
```

`data/reading-catalog/samples/local-export/` 是自造样例：`会唱歌的石头.html`
（公众号结构、无题目，process 后 `no-questions`）、`小溪边的发现.txt`
（纯文本带题，`no-answer`）、`蒲公英的旅行.pdf`（文字层 PDF 带题，`no-answer`）、
`转载-会唱歌的石头.md`（与首篇同文，scan 时按指纹 `rejected`）。

## 实测（2026-11-07，M 系 macOS）

| 项目 | 结果 |
| --- | --- |
| Vision 逐行 OCR | 0.51 s/页（5 页 PDF 共 2.56 s） |
| Vision 文档结构 API | 16.8 s/页（能识别表格，正文有截断） |
| Tesseract 5.5.4 chi_sim | 1.0 s/正文页（需人工裁掉侧栏） |
| 七色花正文 559 字 CER | Vision 90.7%；Tesseract 75.9% |
| 合成“手机拍照”退化同页 | Vision 83.9% |

## 已知问题

- 扫描页左侧常有竖排装订栏（姓名/学号/成绩），会让逐行顺序错乱；
  `clean` 按“宽高比 < 2 且有一定高度”过滤，但偶尔误伤窄题号。
- 段落序号（①②③）会被 OCR 认错（②→③、⑤→⑥），规则无法纠正，只能人看。
- 语文试卷的表格会被逐行 OCR 压成一行；需要 `vision_doc` 单独取表格。
- 楷体正文的形近字错得最多：瓣/辦/辩、猬/猁/狷、灿烂→炒烂、清晨→清展。
