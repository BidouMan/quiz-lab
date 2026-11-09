/**
 * 语文素材数据层：类型定义。
 *
 * 与数学侧同构：单元（unit）→ 题型（typeId）→ 难度（A/B/C）。
 * 差异在于语文素材需要逐条溯源，因此每一条生字/词语都带 source 与 status：
 * - verified：来源可直接核对（教材/教师用书页次，或人教社官方资料）
 * - pending：只查到教辅 OCR 或推断，使用时必须在卷面标注「待核实」
 */

/** 难度：A 基础 / B 常规 / C 提高 */
export type ChineseLevel = 'A' | 'B' | 'C'

export type VerifyStatus = 'verified' | 'pending'

/** 生字所属表：识字表（会认） / 写字表（会写） */
export type CharTable = 'renzi' | 'xiezi'

export interface SourceRef {
  /** 来源说明，例如「教材第 1 课·写字表」 */
  label: string
  /** 可点击核对的地址（可选） */
  url?: string
  /** 页次/条目定位（可选） */
  locator?: string
}

export interface ChineseChar {
  char: string
  /** 带调拼音；查不到时留空并置 pending */
  pinyin: string
  table: CharTable
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChineseWord {
  word: string
  /** 词语表（教材词语表）/ 课文词语（课文或课后练习出现） */
  kind: '词语表' | '课文词语'
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChinesePoem {
  title: string
  author: string
  dynasty: string
  /** 逐句，按教材分行 */
  lines: string[]
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChineseLesson {
  lessonId: string
  /** 课次，例：1、3（略读课沿用数字，另由 kind 区分） */
  no: number
  title: string
  /** 精读要求写字，略读只有识字表 */
  kind: '精读' | '略读'
  renzi: ChineseChar[]
  xiezi: ChineseChar[]
  words: ChineseWord[]
  poems?: ChinesePoem[]
  note?: string
}

export type ChineseTypeId =
  | 'kanpinyin'
  | 'zhuyin'
  | 'duoyin'
  | 'xingjin'
  | 'cipu'
  | 'jinayi'
  | 'gushi'
  | 'juzi'

export interface ChineseTypeMeta {
  typeId: ChineseTypeId
  label: string
  /** 各难度的建议题量（出卷时的默认值，可在界面再调） */
  counts: Record<ChineseLevel, number>
  note?: string
}

export interface ChineseUnitGarden {
  label: string
  /** 日积月累等固定内容；未核实则留空 */
  items: string[]
  status: VerifyStatus
  sources: SourceRef[]
}

export interface ChineseUnitWriting {
  label: string
  /** 只给题目与提示，不判对错 */
  prompt?: string
  status: VerifyStatus
  sources: SourceRef[]
}

export interface ChineseUnit {
  unitId: string
  unitName: string
  /** 人文主题（查证不到时留空） */
  theme: string
  lessons: ChineseLesson[]
  /** 本单元可出的题型 */
  availableTypes: ChineseTypeId[]
  garden?: ChineseUnitGarden
  writing?: ChineseUnitWriting
  oral?: { label: string; status: VerifyStatus }
  /** 快乐读书吧等单元级附加内容 */
  extra?: { label: string; status: VerifyStatus }
  note?: string
}

export interface ChineseCurriculum {
  subject: 'chinese'
  grade: '3A'
  edition: string
  source: string
  units: ChineseUnit[]
}

// ==================== 句子题库 ====================
//
// 与教材字词不同，句子题是原创命题，来源定位到题库 id 本身；每条仍须 verified，
// 并在复核记录中写明「独立重做 + 机械校验」的结论。

export type ChineseSentenceKind = 'gaibing' | 'kuoxie' | 'guanlian' | 'biaodian' | 'fangxie'

/** 病句四类，按三上常见的修改类型划分 */
export type GaibingSubkind = '成分残缺' | '搭配不当' | '语序颠倒' | '重复啰嗦'

/** 判分方式：auto 可机械判分；rubric 为开放题，只给参考评分点、不自动判分 */
export type ChineseSentenceJudging = 'auto' | 'rubric'

/** 主观题评分要点：至少 2 条，供家长或外部 AI 批改，不作为唯一答案 */
export type RubricPoints = [string, string, ...string[]]

/** 答案声明：unique 答案唯一；multiple 允许多种写法（答案集尽量穷举，或给出示例） */
export type ChineseSentenceAnswerKind = 'unique' | 'multiple'

/** 关联词的关系类型，用于校验答案集与题干语境一致 */
export type GuanlianRelation =
  | '因果'
  | '转折'
  | '假设'
  | '并列'
  | '并列递进'
  | '承接'
  | '递进'
  | '条件'

interface SentenceItemBase {
  /** 题库内唯一编号，例：GB-01 / KX-03 */
  id: string
  kind: ChineseSentenceKind
  level: ChineseLevel
  status: VerifyStatus
  sources: SourceRef[]
  /** 这条题为什么这么改 / 为什么用这个标点，给复核和教师看 */
  explain: string
  /** 判分方式：客观题 auto，开放题 rubric */
  judging: ChineseSentenceJudging
  /** 答案声明：唯一或多解 */
  answerKind: ChineseSentenceAnswerKind
  /**
   * 客观题：本题声明的合法答案数量，unique 必须为 1，multiple 至少为 2。
   * 主观题：不锁答案数，只记录参考示例数量，可为 0。
   */
  answerCount: number
}

/**
 * 修改病句：broken 为病句。
 * auto（客观题）：fixed 为主答案，acceptable 为其他可接受改法，均必填。
 * rubric（成分残缺等开放题）：rubric 至少 2 条；fixed/acceptable 只作参考，可缺省。
 */
export interface GaibingItem extends SentenceItemBase {
  kind: 'gaibing'
  subkind: GaibingSubkind
  /** 题干指令；开放题在这里写明「补出主语即可，答案不唯一」 */
  instruction: string
  broken: string
  /** 客观题必填；开放题可保留作参考 */
  fixed?: string
  /** 客观题的可接受改法；开放题可保留作参考 */
  acceptable?: string[]
  /** 开放题必填（≥2 条），gate 与测试会强制检查 */
  rubric?: RubricPoints
  /** 被替换/删除的原片段；成分残缺时为空串 */
  defect: string
  /** 替换成的片段；删除类为空串，成分残缺时为补上的成分 */
  replacement: string
  reason: string
}

/** 扩写句子：base 为原句，hints 为提示角，samples 为参考示例（可选） */
export interface KuoxieItem extends SentenceItemBase {
  kind: 'kuoxie'
  base: string
  keep: string[]
  /** 提示角：时间、地点、样子、动作、心情等，学生任选，不强制用词 */
  hints: string[]
  /** 参考示例，可保留但不作为标准答案 */
  samples?: string[]
  /** 评分要点，至少 2 条 */
  rubric: RubricPoints
}

/** 关联词填空：text 中的「（ ）」按顺序对应答案组合里的每个词 */
export interface GuanlianItem extends SentenceItemBase {
  kind: 'guanlian'
  text: string
  /** 题干指令，用于说明「同义说法都算对」或收窄语境 */
  instruction: string
  relation: GuanlianRelation
  /** 合法的完整填法；每项按空顺序给出词语，任一组合都算对 */
  answers: string[][]
  /** 主搭配，用于答案页展示 */
  pair: string
}

/** 标点符号：text 中的「（ ）」按顺序对应答案组合里的每个标点 */
export interface BiaodianItem extends SentenceItemBase {
  kind: 'biaodian'
  text: string
  /** 题干指令，用语气或写法约束，减少多解 */
  instruction: string
  /** 合法的完整标点组合；每项按空顺序给出标点，任一组合都算对 */
  answers: string[][]
  rule: string
}

/** 比喻与拟人仿写：samples 为参考句（可选）；keywords 仅为参考词，不作唯一判定 */
export interface FangxieItem extends SentenceItemBase {
  kind: 'fangxie'
  mode: '比喻' | '拟人'
  example: string
  prompt: string
  /** 参考示例，可保留但不作为标准答案 */
  samples?: string[]
  /** 参考词，帮助学生打开思路；判分看评分点，不卡词表 */
  keywords: string[]
  /** 评分要点，至少 2 条 */
  rubric: RubricPoints
  guide: string
}

export type ChineseSentenceItem =
  | GaibingItem
  | KuoxieItem
  | GuanlianItem
  | BiaodianItem
  | FangxieItem

/** 题库复核记录：证明答案不是「生成时觉得对」 */
export interface ChineseBankReview {
  authoredAt: string
  /** 第一遍：命题与写答案 */
  pass1: string
  /** 第二遍：不看答案独立重做，再与存档比对 */
  pass2: string
  /** 机械校验：由测试逐条执行的结构检查 */
  mechanical: string[]
  /** 抽查记录 */
  samples: string[]
}

export interface ChineseSentenceBankMeta {
  subject: 'chinese'
  grade: '3A'
  scope: '句子'
  review: ChineseBankReview
}

// ==================== 课外阅读短文库 ====================

export type ReadingTheme =
  | '写人'
  | '写景'
  | '写事'
  | '状物'
  | '寓言'
  | '科普'
  | '非连续'
  | '童话'
  | '记事'

/** 三上阅读考点代号，与教研 SK1–SK7 对应 */
export type ReadingSkillCode = 'SK1' | 'SK2' | 'SK3' | 'SK4' | 'SK5' | 'SK6' | 'SK7'

export interface ReadingChoiceQuestion {
  type: 'choice'
  stem: string
  options: string[]
  /** 正确选项下标，从 0 开始 */
  answer: number
  explain: string
  /** 本题考点（命题稿元数据，出卷筛选时读取） */
  skill?: ReadingSkillCode
}

export interface ReadingFillQuestion {
  type: 'fill'
  stem: string
  /** 逐空答案，可枚举 */
  blanks: string[]
  explain: string
  /** 本题考点（命题稿元数据，出卷筛选时读取） */
  skill?: ReadingSkillCode
}

export interface ReadingShortQuestion {
  type: 'short'
  stem: string
  /** 参考答案（可选，仅作批改参考，不作为唯一标准答案） */
  answer?: string
  /** 评分要点，至少 2 条；简答题按点给分 */
  scoring: RubricPoints
  /** 本题考点（命题稿元数据，出卷筛选时读取） */
  skill?: ReadingSkillCode
}

export type ReadingQuestion = ReadingChoiceQuestion | ReadingFillQuestion | ReadingShortQuestion

export interface ChineseReading {
  id: string
  title: string
  theme: ReadingTheme
  /** 逐段，排版时自然分段 */
  paragraphs: string[]
  status: VerifyStatus
  sources: SourceRef[]
  questions: ReadingQuestion[]
  /** 本文覆盖的考点集合（去重升序）；精选旧稿可能没有 */
  skills?: ReadingSkillCode[]
  /** 命题稿难度：A 易 / B 中 / C 难；精选旧稿可能没有 */
  difficulty?: ChineseLevel
  /** 本文的复核记录 */
  review: string
}

export interface ChineseReadingBankMeta {
  subject: 'chinese'
  grade: '3A'
  scope: '课外阅读'
  review: ChineseBankReview
}

// ==================== 习作题目 ====================

/** 习作评分标准的单行：分项、分值、给家长看的说明 */
export interface ChineseWritingRubricRow {
  aspect: string
  points: number
  description: string
}

/** 习作评分的三档描述 */
export interface ChineseWritingBand {
  band: 'A' | 'B' | 'C'
  label: string
  description: string
}

/** 给家长看的评分标准；工具不据此自动判分 */
export interface ChineseWritingScoring {
  total: number
  rows: ChineseWritingRubricRow[]
  bands: ChineseWritingBand[]
}

/** 习作只给题目、提示与字数要求；评分标准仅供家长面批，机器不判分 */
export interface ChineseWritingPrompt {
  id: string
  unitId: string
  unitName: string
  title: string
  /** 写作提示，面向学生 */
  prompt: string
  /** 续写类习作给出的固定故事开头；其他单元为空 */
  storyOpening?: string
  requirements: string[]
  wordCount: { min: number; max: number }
  /** 分项与分值，给家长核对，不参与自动判分 */
  scoring: ChineseWritingScoring
  status: VerifyStatus
  sources: SourceRef[]
  note?: string
}

export interface ChineseWritingBankMeta {
  subject: 'chinese'
  grade: '3A'
  scope: '习作'
  review: ChineseBankReview
}
