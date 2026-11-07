import type {
  ChineseChar,
  ChineseCurriculum,
  ChineseLesson,
  ChineseLevel,
  ChinesePoem,
  ChineseTypeMeta,
  ChineseUnit,
  ChineseWord,
  SourceRef,
  VerifyStatus,
} from './types.ts'

/**
 * 统编版（人教社）《义务教育教科书·语文》三年级上册，五·四学制 2025 年秋修订版，
 * 上海 2026 学年在用教材。
 *
 * 目录依据：
 * - 人教社《三年级上册修订要点》：8 单元、26 课（19 精读 + 7 略读）；
 * - 人教社教师用书（2026-09 发布 PDF）目录：含《犟龟》《宝葫芦的秘密（节选）》
 *   《一定要争气》《一个粗瓷大碗》，确认为新修订版；
 * - 电子课本目录（2025 秋版）交叉核对课次。
 *
 * 与旧版（第三单元《卖火柴的小女孩》《那一定会很好》《在牛肚子里旅行》《一块奶酪》）
 * 的冲突：一律以新版为准，旧版条目不得用于填充；无法回溯到新版的字词标 pending。
 */

export const SRC_CURRICULUM: SourceRef = {
  label: '人教社《三年级上册修订要点》+ 教师用书目录（2026-09）',
  url: 'https://www.pep.com.cn/bks/xxyw/jzjd/202510/W020251016516675066625.pdf',
  locator: '8 单元 26 课目录',
}

/** 干净的逐课字表（表格版，含读音与组词），本批覆盖第 1–4 课 */
const SRC_TABLE_CLEAN: SourceRef = {
  label: '学科网《期末生字组词（一二类字）》2025-2026 统编版三上',
  url: 'https://m.zxxk.com/soft/54306321.html',
  locator: '第 1–4 课·写字表/识字表（表格原文）',
}

/** 教师用书同步练习（基础达标·看拼音写词语等），用于核对课文词语 */
const SRC_WORKBOOK: SourceRef = {
  label: '人教社教师用书配套练习（2026-09）逐课「基础达标」',
  locator: '第 X 课·看拼音写词语',
}

const v = (char: string, pinyin: string, table: 'renzi' | 'xiezi', sources: SourceRef[]): ChineseChar => ({
  char,
  pinyin,
  table,
  status: 'verified',
  sources,
})

const wv = (word: string, sources: SourceRef[]): ChineseWord => ({
  word,
  kind: '课文词语',
  status: 'verified',
  sources,
})

const pv = (poem: Omit<ChinesePoem, 'status' | 'sources'>, sources: SourceRef[]): ChinesePoem => ({
  ...poem,
  status: 'verified',
  sources,
})

export const CHINESE_TYPES: ChineseTypeMeta[] = [
  { typeId: 'kanpinyin', label: '看拼音写词语', counts: { A: 8, B: 12, C: 16 } },
  { typeId: 'zhuyin', label: '给加点字注音', counts: { A: 6, B: 10, C: 14 } },
  { typeId: 'duoyin', label: '多音字组词', counts: { A: 4, B: 6, C: 8 }, note: '需按课标注读音与组词' },
  { typeId: 'xingjin', label: '形近字组词', counts: { A: 4, B: 6, C: 8 } },
  { typeId: 'cipu', label: '词语搭配与积累', counts: { A: 6, B: 8, C: 10 } },
  { typeId: 'jinayi', label: '近义词与反义词', counts: { A: 4, B: 6, C: 8 } },
  { typeId: 'gushi', label: '古诗默写', counts: { A: 4, B: 6, C: 8 }, note: '只取教材内古诗，答案可逐字复核' },
  { typeId: 'juzi', label: '课文原句填空', counts: { A: 4, B: 6, C: 8 } },
]

const WORD_TYPES = ['kanpinyin', 'zhuyin', 'duoyin', 'xingjin', 'cipu', 'jinayi'] as const

// ==================== 第一单元 ====================

const U1_L1: ChineseLesson = {
  lessonId: '3A-U1-L1',
  no: 1,
  title: '大青树下的小学',
  kind: '精读',
  xiezi: [
    v('坡', 'pō', 'xiezi', [SRC_TABLE_CLEAN]),
    v('球', 'qiú', 'xiezi', [SRC_TABLE_CLEAN]),
    v('招', 'zhāo', 'xiezi', [SRC_TABLE_CLEAN]),
    v('呼', 'hū', 'xiezi', [SRC_TABLE_CLEAN]),
    v('飘', 'piāo', 'xiezi', [SRC_TABLE_CLEAN]),
    v('扬', 'yáng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('读', 'dú', 'xiezi', [SRC_TABLE_CLEAN]),
    v('热', 'rè', 'xiezi', [SRC_TABLE_CLEAN]),
    v('闹', 'nào', 'xiezi', [SRC_TABLE_CLEAN]),
    v('粗', 'cū', 'xiezi', [SRC_TABLE_CLEAN]),
    v('壮', 'zhuàng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('洁', 'jié', 'xiezi', [SRC_TABLE_CLEAN]),
  ],
  renzi: [
    v('绒', 'róng', 'renzi', [SRC_TABLE_CLEAN]),
    v('昂', 'áng', 'renzi', [SRC_TABLE_CLEAN]),
    v('凤', 'fèng', 'renzi', [SRC_TABLE_CLEAN]),
    v('墙', 'qiáng', 'renzi', [SRC_TABLE_CLEAN]),
    v('晃', 'huàng', 'renzi', [SRC_TABLE_CLEAN]),
  ],
  words: [
    wv('洁白', [SRC_WORKBOOK, SRC_TABLE_CLEAN]),
    wv('飘扬', [SRC_WORKBOOK, SRC_TABLE_CLEAN]),
    wv('粗壮', [SRC_WORKBOOK, SRC_TABLE_CLEAN]),
    wv('热闹', [SRC_WORKBOOK, SRC_TABLE_CLEAN]),
  ],
}

const U1_L2: ChineseLesson = {
  lessonId: '3A-U1-L2',
  no: 2,
  title: '花的学校',
  kind: '精读',
  xiezi: [
    v('轰', 'hōng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('湿', 'shī', 'xiezi', [SRC_TABLE_CLEAN]),
    v('润', 'rùn', 'xiezi', [SRC_TABLE_CLEAN]),
    v('笛', 'dí', 'xiezi', [SRC_TABLE_CLEAN]),
    v('狂', 'kuáng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('功', 'gōng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('罚', 'fá', 'xiezi', [SRC_TABLE_CLEAN]),
    v('互', 'hù', 'xiezi', [SRC_TABLE_CLEAN]),
    v('碰', 'pèng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('黄', 'huáng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('急', 'jí', 'xiezi', [SRC_TABLE_CLEAN]),
  ],
  renzi: [
    v('荒', 'huāng', 'renzi', [SRC_TABLE_CLEAN]),
    v('假', 'jià', 'renzi', [SRC_TABLE_CLEAN]),
    v('臂', 'bì', 'renzi', [SRC_TABLE_CLEAN]),
  ],
  words: [
    wv('阵雨', [SRC_WORKBOOK]),
    wv('湿润', [SRC_WORKBOOK]),
    wv('风笛', [SRC_WORKBOOK]),
    wv('功课', [SRC_WORKBOOK]),
    wv('急忙', [SRC_WORKBOOK]),
    wv('狂欢', [SRC_WORKBOOK]),
  ],
  note: '「假」为多音字：本课读 jià（放假），另读 jiǎ（真假）。',
}

const U1_L3: ChineseLesson = {
  lessonId: '3A-U1-L3',
  no: 3,
  title: '不懂就要问',
  kind: '略读',
  xiezi: [],
  renzi: [
    v('诵', 'sòng', 'renzi', [SRC_TABLE_CLEAN]),
    v('例', 'lì', 'renzi', [SRC_TABLE_CLEAN]),
    v('糊', 'hú', 'renzi', [SRC_TABLE_CLEAN]),
    v('戒', 'jiè', 'renzi', [SRC_TABLE_CLEAN]),
    v('厉', 'lì', 'renzi', [SRC_TABLE_CLEAN]),
    v('详', 'xiáng', 'renzi', [SRC_TABLE_CLEAN]),
    v('挨', 'ái', 'renzi', [SRC_TABLE_CLEAN]),
  ],
  words: [wv('私塾', [SRC_WORKBOOK]), wv('戒尺', [SRC_WORKBOOK])],
  note: '略读课只有识字表，不要求写字。',
}

// ==================== 第二单元 ====================

const U2_L4: ChineseLesson = {
  lessonId: '3A-U2-L4',
  no: 4,
  title: '古诗三首',
  kind: '精读',
  xiezi: [
    v('庭', 'tíng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('相', 'xiāng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('未', 'wèi', 'xiezi', [SRC_TABLE_CLEAN]),
    v('寒', 'hán', 'xiezi', [SRC_TABLE_CLEAN]),
    v('径', 'jìng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('斜', 'xié', 'xiezi', [SRC_TABLE_CLEAN]),
    v('枫', 'fēng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('霜', 'shuāng', 'xiezi', [SRC_TABLE_CLEAN]),
    v('挑', 'tiǎo', 'xiezi', [SRC_TABLE_CLEAN]),
    v('深', 'shēn', 'xiezi', [SRC_TABLE_CLEAN]),
    v('落', 'luò', 'xiezi', [SRC_TABLE_CLEAN]),
  ],
  renzi: [
  ],
  words: [],
  poems: [
    pv(
      {
        title: '山行',
        author: '杜牧',
        dynasty: '唐',
        lines: [
          '远上寒山石径斜，白云生处有人家。',
          '停车坐爱枫林晚，霜叶红于二月花。',
        ],
      },
      [{ label: '教材第 4 课《古诗三首》', locator: '写字表含 寒/径/斜/枫/霜' }],
    ),
    pv(
      {
        title: '望洞庭',
        author: '刘禹锡',
        dynasty: '唐',
        lines: ['湖光秋月两相和，潭面无风镜未磨。', '遥望洞庭山水翠，白银盘里一青螺。'],
      },
      [
        { label: '教材第 4 课《古诗三首》', locator: '写字表含 庭/相/未/落' },
        { label: '教师用书·期末专项复习', locator: '逐句补全题已核对' },
      ],
    ),
    pv(
      {
        title: '夜书所见',
        author: '叶绍翁',
        dynasty: '宋',
        lines: ['萧萧梧叶送寒声，江上秋风动客情。', '知有儿童挑促织，夜深篱落一灯明。'],
      },
      [
        { label: '教材第 4 课《古诗三首》', locator: '写字表含 挑/落' },
        { label: '教师用书·期末专项复习', locator: '「知有儿童挑促织」一句已核对' },
      ],
    ),
  ],
  note: '教材把三首古诗编为第 4 课；诗题与作者按教材，正文按通行本。识字表 3 字无可靠来源，已撤出。',
}

const U2_L5: ChineseLesson = {
  lessonId: '3A-U2-L5',
  no: 5,
  title: '铺满金色巴掌的水泥道',
  kind: '精读',
  xiezi: [
  ],
  renzi: [
  ],
  words: [],
  note: '无可靠来源：字表条目只来自教辅 OCR 且有重叠，本课暂不出题。',
}

const U2_L6: ChineseLesson = {
  lessonId: '3A-U2-L6',
  no: 6,
  title: '秋天的雨',
  kind: '精读',
  xiezi: [
  ],
  renzi: [
  ],
  words: [],
  note: '无可靠来源：字表条目只来自教辅 OCR 且识字/写字归属冲突，本课暂不出题。词语「钥匙」虽有 S3 课文原文依据，但按本批口径第 5–7 课字词暂不使用，已记入核对清单待补名单。',
}

const U2_L7: ChineseLesson = {
  lessonId: '3A-U2-L7',
  no: 7,
  title: '听听，秋的声音',
  kind: '略读',
  xiezi: [],
  renzi: [
  ],
  words: [],
  note: '无可靠来源；略读课只有识字表。本课暂不出题。',
}

const U1: ChineseUnit = {
  unitId: '3A-U1',
  unitName: '第一单元',
  theme: '学校生活',
  lessons: [U1_L1, U1_L2, U1_L3],
  availableTypes: [...WORD_TYPES, 'juzi'],
  garden: {
    label: '语文园地一',
    items: [],
    status: 'pending',
    sources: [{ label: '教师用书目录', locator: '第一单元·语文园地' }],
  },
  writing: {
    label: '习作：猜猜他是谁',
    status: 'verified',
    sources: [{ label: '教师用书目录', locator: '第一单元·习作' }],
  },
  oral: { label: '口语交际：我的暑假生活', status: 'verified' },
  note: '日积月累的具体条目尚未与教材核对，暂留空。',
}

const U2: ChineseUnit = {
  unitId: '3A-U2',
  unitName: '第二单元',
  theme: '金秋时节',
  lessons: [U2_L4, U2_L5, U2_L6, U2_L7],
  availableTypes: [...WORD_TYPES, 'gushi', 'juzi'],
  garden: {
    label: '语文园地二',
    items: [],
    status: 'pending',
    sources: [{ label: '教师用书目录', locator: '第二单元·语文园地' }],
  },
  writing: {
    label: '习作：写日记',
    status: 'verified',
    sources: [{ label: '教师用书目录', locator: '第二单元·习作' }],
  },
  note: '第 4 课古诗可直接出默写；第 5–7 课字词待与教材核对。',
}

// ==================== 第三至第八单元（结构先行，字词待补） ====================

const stub = (
  unitId: string,
  no: number,
  title: string,
  kind: '精读' | '略读',
  note: string,
): ChineseLesson => ({
  lessonId: `${unitId}-L${no}`,
  no,
  title,
  kind,
  xiezi: [],
  renzi: [],
  words: [],
  note,
})

const STUB_NOTE = '无可靠来源（教材字表未核到），本课留空。'

const U3: ChineseUnit = {
  unitId: '3A-U3',
  unitName: '第三单元',
  theme: '阅读策略：预测',
  lessons: [
    stub('3A-U3', 8, '总也倒不了的老屋', '精读', STUB_NOTE),
    stub('3A-U3', 9, '犟龟', '略读', STUB_NOTE),
    stub('3A-U3', 10, '小狗学叫', '略读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  oral: { label: '口语交际：名字里的故事', status: 'verified' },
  note: '阅读策略单元，路线 A 只取字词题；本单元暂无有据字词。',
}

const U4: ChineseUnit = {
  unitId: '3A-U4',
  unitName: '第四单元',
  theme: '童话',
  lessons: [
    stub('3A-U4', 11, '宝葫芦的秘密（节选）', '精读', STUB_NOTE),
    stub('3A-U4', 12, '在牛肚子里旅行', '精读', STUB_NOTE),
    stub('3A-U4', 13, '一块奶酪', '略读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  extra: { label: '快乐读书吧：在那奇妙的王国里', status: 'verified' },
  note: '童话单元；本单元暂无有据字词。',
}

const U5: ChineseUnit = {
  unitId: '3A-U5',
  unitName: '第五单元',
  theme: '习作单元：留心观察',
  lessons: [
    stub('3A-U5', 14, '搭船的鸟', '精读', STUB_NOTE),
    stub('3A-U5', 15, '金色的草地', '精读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  note: '习作单元无语文园地，教材改为「梳理与交流」「初试身手」「习作例文」。',
}

const U6: ChineseUnit = {
  unitId: '3A-U6',
  unitName: '第六单元',
  theme: '祖国河山',
  lessons: [
    stub('3A-U6', 16, '富饶的西沙群岛', '精读', STUB_NOTE),
    stub('3A-U6', 17, '海滨小城', '精读', STUB_NOTE),
    stub('3A-U6', 18, '美丽的小兴安岭', '精读', STUB_NOTE),
    stub('3A-U6', 19, '香港，璀璨的明珠', '略读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  extra: { label: '快乐读书吧：格林童话', status: 'pending' },
}

const U7_L20: ChineseLesson = {
  lessonId: '3A-U7-L20',
  no: 20,
  title: '古诗三首',
  kind: '精读',
  xiezi: [],
  renzi: [],
  words: [],
  poems: [
    pv(
      {
        title: '望天门山',
        author: '李白',
        dynasty: '唐',
        lines: ['天门中断楚江开，碧水东流至此回。', '两岸青山相对出，孤帆一片日边来。'],
      },
      [{ label: '教师用书·第 20 课「发展提升」阅读古诗（一）（二）', locator: '题干引用与原文' }],
    ),
    pv(
      {
        title: '饮湖上初晴后雨',
        author: '苏轼',
        dynasty: '宋',
        lines: ['水光潋滟晴方好，山色空蒙雨亦奇。', '欲把西湖比西子，淡妆浓抹总相宜。'],
      },
      [{ label: '教师用书·第 20 课「发展提升」阅读古诗（三）', locator: '原文完整给出' }],
    ),
    pv(
      {
        title: '鹿柴',
        author: '王维',
        dynasty: '唐',
        lines: ['空山不见人，但闻人语响。', '返景入深林，复照青苔上。'],
      },
      [{ label: '教师用书·第 20 课「发展提升」阅读古诗（一）', locator: '原文完整给出' }],
    ),
  ],
  note: '三首篇目由教师用书原文确认；写字表无可靠来源，本课只出古诗默写。',
}

const U7: ChineseUnit = {
  unitId: '3A-U7',
  unitName: '第七单元',
  theme: '走近自然',
  lessons: [
    U7_L20,
    stub('3A-U7', 21, '大自然的声音', '精读', STUB_NOTE),
    stub('3A-U7', 22, '读不完的大书', '精读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES, 'gushi'],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  note: '第 20 课三首古诗（望天门山/饮湖上初晴后雨/鹿柴）已由教师用书原文确认，可出默写；其余两课无可靠字词来源。',
}

const U8: ChineseUnit = {
  unitId: '3A-U8',
  unitName: '第八单元',
  theme: '美好品质',
  lessons: [
    stub('3A-U8', 23, '司马光', '精读', STUB_NOTE),
    stub('3A-U8', 24, '一定要争气', '精读', STUB_NOTE),
    stub('3A-U8', 25, '手术台就是阵地', '精读', STUB_NOTE),
    stub('3A-U8', 26, '一个粗瓷大碗', '略读', STUB_NOTE),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作（篇目待核）', status: 'pending', sources: [SRC_CURRICULUM] },
  extra: { label: '快乐读书吧：稻草人', status: 'pending' },
}

export const CHINESE_CURRICULUM_3A: ChineseCurriculum = {
  subject: 'chinese',
  grade: '3A',
  edition: '人教社统编·五·四学制 2025 年秋修订版',
  source: 'docs/语文三上练习方案-0.7.0.md',
  units: [U1, U2, U3, U4, U5, U6, U7, U8],
}

export const chineseUnits = CHINESE_CURRICULUM_3A.units

export function findChineseUnit(unitId: string): ChineseUnit | undefined {
  return chineseUnits.find((u) => u.unitId === unitId)
}

export function findChineseLesson(lessonId: string): ChineseLesson | undefined {
  for (const u of chineseUnits) {
    const hit = u.lessons.find((l) => l.lessonId === lessonId)
    if (hit) return hit
  }
  return undefined
}

/** 可按难度出题的素材统计：只统计 verified 条目 */
export function countVerified(unit: ChineseUnit): {
  xiezi: number
  renzi: number
  words: number
  pending: number
} {
  let xiezi = 0
  let renzi = 0
  let words = 0
  let pending = 0
  for (const lesson of unit.lessons) {
    for (const c of lesson.xiezi) c.status === 'verified' ? xiezi++ : pending++
    for (const c of lesson.renzi) c.status === 'verified' ? renzi++ : pending++
    for (const word of lesson.words) word.status === 'verified' ? words++ : pending++
    for (const poem of lesson.poems ?? []) poem.status === 'verified' ? words++ : pending++
  }
  return { xiezi, renzi, words, pending }
}

export const LEVELS: ChineseLevel[] = ['A', 'B', 'C']
export type { ChineseLevel, VerifyStatus }
