import type {
  ChineseWritingBand,
  ChineseWritingBankMeta,
  ChineseWritingPrompt,
  ChineseWritingScoring,
  SourceRef,
} from './types.ts'

const UNIT_TITLES: Record<string, string> = {
  '3A-U1': '猜猜他是谁',
  '3A-U2': '写日记',
  '3A-U3': '续写故事',
  '3A-U4': '我来编童话',
  '3A-U5': '我们眼中的缤纷世界',
  '3A-U6': '这儿真美',
  '3A-U7': '我有一个想法',
  '3A-U8': '那次经历真难忘',
}

const writingSource = (unitId: string): SourceRef[] => [
  {
    label: '2025 秋五四制三上电子课本目录·习作',
    url: 'http://www.dzkbw.com/books/rjb/yuwen/ws3s_2025/',
    locator: `${unitId}·习作`,
  },
  { label: 'docs/语文三上练习方案-0.7.0.md', locator: '§1.2 8 次习作' },
]

const BANDS: ChineseWritingBand[] = [
  {
    band: 'A',
    label: 'A 档（27–30 分）',
    description: '内容扣题，条理清楚，语句通顺，有具体描写；标点和书写规范，读者能轻松读懂。',
  },
  {
    band: 'B',
    label: 'B 档（21–26 分）',
    description: '内容基本扣题，条理较清楚，少数语句或标点有问题，描写还不够具体。',
  },
  {
    band: 'C',
    label: 'C 档（0–20 分）',
    description: '内容偏离题目或条理混乱，语句不够通顺，标点和书写问题较多，需要重写或大改。',
  },
]

const scoring = (content: string, order: string, language: string): ChineseWritingScoring => ({
  total: 30,
  rows: [
    { aspect: '内容', points: 10, description: content },
    { aspect: '条理', points: 8, description: order },
    { aspect: '语言', points: 9, description: language },
    { aspect: '标点与书写', points: 3, description: '标点基本正确，字迹工整，卷面整洁。' },
  ],
  bands: BANDS,
})

const RAW: Omit<ChineseWritingPrompt, 'id' | 'status' | 'sources'>[] = [
  {
    unitId: '3A-U1',
    unitName: '第一单元',
    title: UNIT_TITLES['3A-U1'],
    prompt:
      '选一位熟悉的同学，写一篇短文介绍他。可以写他的外貌、性格、爱好，也可以写一件和他有关的小事。不要写出他的名字，让同学读完后猜一猜你写的是谁。',
    requirements: ['只写一位同学，文中不出现姓名', '至少写两个方面，或写清一件小事', '语句通顺，标点正确'],
    wordCount: { min: 200, max: 300 },
    scoring: scoring(
      '写的是熟悉的同学，外貌、性格、爱好或事例至少写清两个方面，读者能猜出是谁。',
      '先写一方面再写另一方面，或按事情顺序写，段落清楚。',
      '用上描写外貌、动作、语言的词句，句子通顺。',
    ),
  },
  {
    unitId: '3A-U2',
    unitName: '第二单元',
    title: UNIT_TITLES['3A-U2'],
    prompt:
      '回忆今天发生的一件事，把它写进日记里。先写清日期、星期和天气，再写事情的经过和自己的心情。',
    requirements: ['使用日记格式：日期、星期、天气', '写清一件事情的经过', '写出自己的真实感受'],
    wordCount: { min: 200, max: 300 },
    scoring: scoring(
      '写的是当天真实的一件事，经过完整，心情写得具体。',
      '有日记格式，按事情发展的顺序写。',
      '语句通顺，能写出自己的感受，不空喊“我很高兴”。',
    ),
  },
  {
    unitId: '3A-U3',
    unitName: '第三单元',
    title: UNIT_TITLES['3A-U3'],
    storyOpening:
      '下课铃响了，同学们围在教室的图书角，小声商量着什么。李晓明推门进来，大家立刻散开了。李晓明发现，自己的课桌上多了一张折起来的纸条……',
    prompt:
      '读一读下面的故事开头，接着往下写。想一想：纸条上写了什么？同学们为什么神秘地散开？后来发生了什么？',
    requirements: ['接着给出的开头写，不另起一个故事', '写清同学们做了什么、李晓明的心情', '给故事一个完整的结尾'],
    wordCount: { min: 300, max: 400 },
    scoring: scoring(
      '故事接着开头发展，纸条、同学的神秘举动和结局都交代清楚。',
      '按“发现纸条—弄清原因—事情结果”的顺序写，前后连贯。',
      '有人物的动作、语言和心情，语句通顺。',
    ),
  },
  {
    unitId: '3A-U4',
    unitName: '第四单元',
    title: UNIT_TITLES['3A-U4'],
    prompt:
      '从“小蚂蚁、啄木鸟、国王、玫瑰花、森林、厨房、冬天、星期天”中选几个，编一个童话故事。想清楚他们之间发生了什么，故事怎样结束。',
    requirements: ['故事里有角色、时间、地点', '写清事情的起因、经过、结果', '想象合理，语句通顺'],
    wordCount: { min: 300, max: 400 },
    scoring: scoring(
      '角色、时间、地点齐全，起因、经过、结果完整，想象合理。',
      '故事按起因、经过、结果的顺序展开，段落清楚。',
      '人物有对话或动作，语句通顺，童话味足。',
    ),
  },
  {
    unitId: '3A-U5',
    unitName: '第五单元',
    title: UNIT_TITLES['3A-U5'],
    prompt:
      '观察一种植物、一只小动物或一处场景，把观察到的变化写下来。可以用眼睛看，也可以用耳朵听、用手摸一摸。',
    requirements: ['写一种事物或一处场景', '写出颜色、样子、声音等观察所得', '按一定顺序写，条理清楚'],
    wordCount: { min: 300, max: 400 },
    scoring: scoring(
      '观察对象明确，写出了颜色、样子、声音或变化，内容具体。',
      '按观察顺序写（如从远到近、从上到下），条理清楚。',
      '用上观察到的细节和积累的词句，句子通顺。',
    ),
  },
  {
    unitId: '3A-U6',
    unitName: '第六单元',
    title: UNIT_TITLES['3A-U6'],
    prompt:
      '选一个你觉得美的地方，比如校园、公园、家乡的小河。围绕一个意思，把那里的景物写清楚，让读者也想去看看。',
    requirements: ['围绕一个地方写', '按顺序写景物，不杂乱', '用上平时积累的好词好句'],
    wordCount: { min: 300, max: 400 },
    scoring: scoring(
      '围绕一个地方写，景物特点清楚，能让人感受到“美”。',
      '按空间顺序或游览顺序写，景物不杂乱。',
      '用上积累的好词好句，语句通顺，有画面感。',
    ),
  },
  {
    unitId: '3A-U7',
    unitName: '第七单元',
    title: UNIT_TITLES['3A-U7'],
    prompt:
      '生活中你发现了什么问题？比如有人浪费水、课间追逐打闹、图书角的书乱了。把你的想法写下来，也可以提出建议。',
    requirements: ['写清发现的现象', '写出自己的想法', '可以提出一两条可行的建议'],
    wordCount: { min: 300, max: 400 },
    scoring: scoring(
      '现象写得清楚，想法明确，建议具体、能做到。',
      '按“现象—想法—建议”的顺序写，条理清楚。',
      '说理明白，语句通顺，不空喊口号。',
    ),
  },
  {
    unitId: '3A-U8',
    unitName: '第八单元',
    title: UNIT_TITLES['3A-U8'],
    prompt:
      '写一次你亲身经历的事，可以是第一次上台、一次比赛、一次旅行。把经过写清楚，把当时的感受写出来。',
    requirements: ['写一次亲身经历', '写清事情的经过', '写出当时的感受'],
    wordCount: { min: 350, max: 450 },
    scoring: scoring(
      '写的是自己亲身经历的事，经过完整，感受真实、具体。',
      '按事情发展的顺序写，重点写清最难忘的场面。',
      '有动作、语言、心理描写，语句通顺。',
    ),
    note: '2025 秋修订版将旧题“那次玩得真高兴”改为“那次经历真难忘”，本篇目以修订版目录为准。',
  },
]

export const WRITING_PROMPTS: ChineseWritingPrompt[] = RAW.map((item, index) => ({
  ...item,
  id: `XZ-0${index + 1}`,
  status: 'verified',
  sources: writingSource(item.unitId),
}))

export const WRITING_BANK_META: ChineseWritingBankMeta = {
  subject: 'chinese',
  grade: '3A',
  scope: '习作',
  review: {
    authoredAt: '2026-11-07',
    pass1:
      '按三上 8 次习作逐单元出题，给题目、提示、要求、字数与给家长看的分项评分标准；工具不判分，也不给范文。',
    pass2:
      '第二遍对照 2025 秋修订版目录与练习方案 §1.2，逐条核对 8 个篇目；第 8 单元按修订版新题“那次经历真难忘”，不沿用旧题。第 3 单元补上可直接续写的文字故事开头。',
    mechanical: [
      '8 个单元各一条，unitId 唯一，顺序为 U1–U8。',
      '篇目与方案 §1.2 的 8 次习作完全一致。',
      '每条都有题目、写作提示、2–3 条要求、字数下限与上限。',
      '每条评分标准 4 个分项，分值合计 30 分，并给 A/B/C 三档描述。',
      '评分标准只作家长面批参考，数据里没有自动判分、等级或范文字段。',
      '全部 verified，来源可定位到目录与方案条目。',
    ],
    samples: [
      'U1：篇目“猜猜他是谁”与目录一致；提示要求不出现姓名，字数 200–300 与“写一篇短文”相符。',
      'U3：补入故事开头“课桌上的纸条”，学生可以顺着情节续写，不再依赖课本插图。',
      'U8：确认修订版为“那次经历真难忘”，未写旧题“那次玩得真高兴”。',
    ],
  },
}
