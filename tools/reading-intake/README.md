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

# 3) 表格页（可选，16 秒/页）
./vision_doc --out work/x/doc work/x/pages/a.png

# 4) 与人工校对稿比准确率
python3 intake.py eval ref.txt hyp.txt --out work/x/eval.json

# 5) 入库前自动闸门（规则与 tests/chinese-readings.test.ts 对齐）
python3 gate.py draft.json

# 6) 补充实验：模型只输出段号、程序回填原文（对比规则切分）
python3 locate_experiment.py --out work/locate/result.json
#   已跑过一次时可复用段号，不再调模型：
python3 locate_experiment.py --out work/locate/result.json --reuse
```

`intake.py eval` 输出字符准确率、编辑距离、逐条错误（形近字/标点/漏行等）。
`gate.py` 只做机器能判的项；来源真实性、答案是否符合题意必须人看。

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
