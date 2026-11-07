import type { ChineseWritingBankMeta, ChineseWritingPrompt, SourceRef } from './types.ts'

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

const RAW: Omit<ChineseWritingPrompt, 'id' | 'status' | 'sources'>[] = [
  {
    unitId: '3A-U1',
    unitName: '第一单元',
    title: UNIT_TITLES['3A-U1'],
    prompt:
      '选一位熟悉的同学，写一段话介绍他。可以写他的外貌、性格、爱好，也可以写一件和他有关的小事。不要写出他的名字，让同学读完后猜一猜你写的是谁。',
    requirements: ['只写一位同学，文中不出现姓名', '至少写两个方面，或写清一件小事', '语句通顺，标点正确'],
    wordCount: { min: 200, max: 300 },
  },
  {
    unitId: '3A-U2',
    unitName: '第二单元',
    title: UNIT_TITLES['3A-U2'],
    prompt:
      '回忆今天发生的一件事，把它写进日记里。先写清日期、星期和天气，再写事情的经过和自己的心情。',
    requirements: ['使用日记格式：日期、星期、天气', '写清一件事情的经过', '写出自己的真实感受'],
    wordCount: { min: 200, max: 300 },
  },
  {
    unitId: '3A-U3',
    unitName: '第三单元',
    title: UNIT_TITLES['3A-U3'],
    prompt:
      '读一读故事的开头，或看一看课本上的图画，想一想接下来会发生什么。顺着原来的情节往下写，让故事有一个结尾。',
    requirements: ['接着开头的情节写，不另起一个故事', '写清人物做了什么、结果怎样', '给故事一个完整的结尾'],
    wordCount: { min: 300, max: 400 },
  },
  {
    unitId: '3A-U4',
    unitName: '第四单元',
    title: UNIT_TITLES['3A-U4'],
    prompt:
      '从“小蚂蚁、啄木鸟、国王、玫瑰花、森林、厨房、冬天、星期天”中选几个，编一个童话故事。想清楚他们之间发生了什么，故事怎样结束。',
    requirements: ['故事里有角色、时间、地点', '写清事情的起因、经过、结果', '想象合理，语句通顺'],
    wordCount: { min: 300, max: 400 },
  },
  {
    unitId: '3A-U5',
    unitName: '第五单元',
    title: UNIT_TITLES['3A-U5'],
    prompt:
      '观察一种植物、一只小动物或一处场景，把观察到的变化写下来。可以用眼睛看，也可以用耳朵听、用手摸一摸。',
    requirements: ['写一种事物或一处场景', '写出颜色、样子、声音等观察所得', '按一定顺序写，条理清楚'],
    wordCount: { min: 300, max: 400 },
  },
  {
    unitId: '3A-U6',
    unitName: '第六单元',
    title: UNIT_TITLES['3A-U6'],
    prompt:
      '选一个你觉得美的地方，比如校园、公园、家乡的小河。围绕一个意思，把那里的景物写清楚，让读者也想去看看。',
    requirements: ['围绕一个地方写', '按顺序写景物，不杂乱', '用上平时积累的好词好句'],
    wordCount: { min: 300, max: 400 },
  },
  {
    unitId: '3A-U7',
    unitName: '第七单元',
    title: UNIT_TITLES['3A-U7'],
    prompt:
      '生活中你发现了什么问题？比如有人浪费水、课间追逐打闹、图书角的书乱了。把你的想法写下来，也可以提出建议。',
    requirements: ['写清发现的现象', '写出自己的想法', '可以提出一两条可行的建议'],
    wordCount: { min: 300, max: 400 },
  },
  {
    unitId: '3A-U8',
    unitName: '第八单元',
    title: UNIT_TITLES['3A-U8'],
    prompt:
      '写一次你亲身经历的事，可以是第一次上台、一次比赛、一次旅行。把经过写清楚，把当时的感受写出来。',
    requirements: ['写一次亲身经历', '写清事情的经过', '写出当时的感受'],
    wordCount: { min: 350, max: 450 },
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
    pass1: '按三上 8 次习作逐单元出题，只给题目、提示、要求与字数，不给范文、不设判分。',
    pass2:
      '第二遍对照 2025 秋修订版目录与练习方案 §1.2，逐条核对 8 个篇目；第 8 单元按修订版新题“那次经历真难忘”，不沿用旧题。',
    mechanical: [
      '8 个单元各一条，unitId 唯一，顺序为 U1–U8。',
      '篇目与方案 §1.2 的 8 次习作完全一致。',
      '每条都有题目、写作提示、2–3 条要求、字数下限与上限。',
      '习作数据不含评分、范文、等级等字段。',
      '全部 verified，来源可定位到目录与方案条目。',
    ],
    samples: [
      'U1：篇目“猜猜他是谁”与目录一致；提示要求不出现姓名，符合教材要求。',
      'U4：提示给出角色、时间、地点词，学生可直接选词编故事。',
      'U8：确认修订版为“那次经历真难忘”，未写旧题“那次玩得真高兴”。',
    ],
  },
}
