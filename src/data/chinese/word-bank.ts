import type { ChineseLevel } from './types.ts'

/**
 * 教材不直接提供、按三上范围自编的字词题素材。
 *
 * 依据：
 * - 多音字：识字表蓝色字（26 处，去重 25 字），两个读音与本课组词；
 * - 词语搭配、近反义词、选字填空：从课文词语表与写字表取字词，按一课一练常见题型自编；
 * - 词语搭配中的「课文原句中的搭配」按教材原文挖空，答案由原文唯一确定，不做开放填空；
 * - 日积月累：语文园地三/四/八的名言谚语，原文见 curriculum.ts。
 *
 * 每题只保留一个可机械核对的主答案；组词类另给可接受答案。
 */

export interface DuoyinSeed {
  char: string
  readings: { pinyin: string; word: string }[]
  unitId: string
  level: ChineseLevel
  source: string
}

export interface FillTextSeed {
  text: string
  answers: string[]
  unitId: string
  level: ChineseLevel
  source: string
  bank?: string[]
  /** 卷面小节名：同一题型内按 group 分段排版，避免量词、四字词语、原文搭配混成一列 */
  group?: string
  note?: string
}

export const DUOYIN_SEEDS: DuoyinSeed[] = [
  { char: '假', readings: [{ pinyin: 'jiǎ', word: '真假' }, { pinyin: 'jià', word: '放假' }], unitId: '3A-U1', level: 'B', source: '第 2 课《花的学校》·识字表蓝色字' },
  { char: '磨', readings: [{ pinyin: 'mó', word: '磨刀' }, { pinyin: 'mò', word: '石磨' }], unitId: '3A-U2', level: 'B', source: '第 4 课《古诗三首》·识字表蓝色字' },
  { char: '挑', readings: [{ pinyin: 'tiāo', word: '挑水' }, { pinyin: 'tiǎo', word: '挑促织' }], unitId: '3A-U2', level: 'B', source: '第 4 课《古诗三首》·识字表蓝色字' },
  { char: '吗', readings: [{ pinyin: 'ma', word: '好吗' }, { pinyin: 'má', word: '干吗' }], unitId: '3A-U3', level: 'B', source: '第 10 课《小狗学叫》·识字表蓝色字' },
  { char: '中', readings: [{ pinyin: 'zhōng', word: '中间' }, { pinyin: 'zhòng', word: '中弹' }], unitId: '3A-U3', level: 'B', source: '第 10 课《小狗学叫》·识字表蓝色字' },
  { char: '弹', readings: [{ pinyin: 'dàn', word: '子弹' }, { pinyin: 'tán', word: '弹琴' }], unitId: '3A-U3', level: 'B', source: '第 10 课《小狗学叫》·识字表蓝色字' },
  { char: '少', readings: [{ pinyin: 'shǎo', word: '多少' }, { pinyin: 'shào', word: '少年' }], unitId: '3A-U4', level: 'B', source: '第 11 课《宝葫芦的秘密》·识字表蓝色字' },
  { char: '冲', readings: [{ pinyin: 'chōng', word: '冲进' }, { pinyin: 'chòng', word: '冲劲儿' }], unitId: '3A-U4', level: 'C', source: '第 11 课《宝葫芦的秘密》·识字表蓝色字' },
  { char: '系', readings: [{ pinyin: 'xì', word: '关系' }, { pinyin: 'jì', word: '系鞋带' }], unitId: '3A-U4', level: 'B', source: '第 11 课《宝葫芦的秘密》·识字表蓝色字' },
  { char: '应', readings: [{ pinyin: 'yīng', word: '应该' }, { pinyin: 'yìng', word: '回应' }], unitId: '3A-U4', level: 'B', source: '第 12 课《在牛肚子里旅行》·识字表蓝色字' },
  { char: '骨', readings: [{ pinyin: 'gǔ', word: '骨头' }, { pinyin: 'gū', word: '骨碌' }], unitId: '3A-U4', level: 'C', source: '第 12 课《在牛肚子里旅行》·识字表蓝色字' },
  { char: '处', readings: [{ pinyin: 'chǔ', word: '处理' }, { pinyin: 'chù', word: '到处' }], unitId: '3A-U4', level: 'B', source: '第 13 课《一块奶酪》·识字表蓝色字' },
  { char: '禁', readings: [{ pinyin: 'jìn', word: '禁止' }, { pinyin: 'jīn', word: '不禁' }], unitId: '3A-U4', level: 'C', source: '第 13 课《一块奶酪》·识字表蓝色字' },
  { char: '臂', readings: [{ pinyin: 'bì', word: '手臂' }, { pinyin: 'bei', word: '胳臂' }], unitId: '3A-U6', level: 'B', source: '第 17 课《海滨小城》·识字表蓝色字' },
  { char: '参', readings: [{ pinyin: 'shēn', word: '海参' }, { pinyin: 'cān', word: '参加' }], unitId: '3A-U6', level: 'B', source: '第 16 课《富饶的西沙群岛》·识字表蓝色字' },
  { char: '兴', readings: [{ pinyin: 'xīng', word: '兴奋' }, { pinyin: 'xìng', word: '高兴' }], unitId: '3A-U6', level: 'B', source: '第 18 课《美丽的小兴安岭》·识字表蓝色字' },
  { char: '舍', readings: [{ pinyin: 'shè', word: '宿舍' }, { pinyin: 'shě', word: '舍弃' }], unitId: '3A-U6', level: 'B', source: '第 18 课《美丽的小兴安岭》·识字表蓝色字' },
  { char: '角', readings: [{ pinyin: 'jué', word: '角色' }, { pinyin: 'jiǎo', word: '牛角' }], unitId: '3A-U6', level: 'B', source: '第 19 课《香港，璀璨的明珠》·识字表蓝色字' },
  { char: '抹', readings: [{ pinyin: 'mǒ', word: '浓抹' }, { pinyin: 'mā', word: '抹布' }], unitId: '3A-U7', level: 'B', source: '第 20 课《古诗三首》·识字表蓝色字' },
  { char: '呢', readings: [{ pinyin: 'ne', word: '还早呢' }, { pinyin: 'ní', word: '呢喃' }], unitId: '3A-U7', level: 'B', source: '第 21 课《大自然的声音》·识字表蓝色字' },
  { char: '哩', readings: [{ pinyin: 'li', word: '好哩' }, { pinyin: 'lī', word: '哩哩啦啦' }], unitId: '3A-U7', level: 'C', source: '第 21 课《大自然的声音》·识字表蓝色字' },
  { char: '差', readings: [{ pinyin: 'chā', word: '差别' }, { pinyin: 'chà', word: '差不多' }], unitId: '3A-U8', level: 'B', source: '第 24 课《一定要争气》·识字表蓝色字' },
  { char: '大', readings: [{ pinyin: 'dà', word: '大小' }, { pinyin: 'dài', word: '大夫' }], unitId: '3A-U8', level: 'B', source: '第 25 课《手术台就是阵地》·识字表蓝色字' },
  { char: '担', readings: [{ pinyin: 'dān', word: '担心' }, { pinyin: 'dàn', word: '重担' }], unitId: '3A-U8', level: 'B', source: '第 25 课《手术台就是阵地》·识字表蓝色字' },
  { char: '还', readings: [{ pinyin: 'hái', word: '还有' }, { pinyin: 'huán', word: '归还' }], unitId: '3A-U8', level: 'B', source: '第 26 课《一个粗瓷大碗》·识字表蓝色字' },
]

export const CIPU_SEEDS: FillTextSeed[] = [
  // 量词
  { text: '一（ ）落叶', answers: ['片'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 5 课《铺满金色巴掌的水泥道》·词语表' },
  { text: '一（ ）邮票', answers: ['枚'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 6 课《秋天的雨》·词语表' },
  { text: '一（ ）古诗', answers: ['首'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 4 课《古诗三首》' },
  { text: '一（ ）秋风', answers: ['阵'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 5 课《铺满金色巴掌的水泥道》·词语表' },
  { text: '一（ ）小城', answers: ['座'], unitId: '3A-U6', level: 'A', group: '量词', source: '第 17 课《海滨小城》' },
  { text: '一（ ）孩子', answers: ['群'], unitId: '3A-U1', level: 'A', group: '量词', source: '第 1 课《大青树下的小学》' },
  { text: '一（ ）扇子', answers: ['把'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 6 课《秋天的雨》' },
  { text: '一（ ）小河', answers: ['条'], unitId: '3A-U6', level: 'A', group: '量词', source: '第 17 课《海滨小城》' },
  { text: '一（ ）菊花', answers: ['朵'], unitId: '3A-U2', level: 'A', group: '量词', source: '第 6 课《秋天的雨》·词语表' },
  { text: '一（ ）大树', answers: ['棵'], unitId: '3A-U1', level: 'A', group: '量词', source: '第 1 课《大青树下的小学》' },
  // AABB / ABAC / 四字词语
  { text: '严严（ ）', answers: ['实实'], unitId: '3A-U6', level: 'A', group: '四字词语', source: '第 18 课《美丽的小兴安岭》·词语表' },
  { text: '密密（ ）', answers: ['麻麻'], unitId: '3A-U6', level: 'A', group: '四字词语', source: '第 18 课《美丽的小兴安岭》·词语表' },
  { text: '来来（ ）', answers: ['往往'], unitId: '3A-U6', level: 'A', group: '四字词语', source: '第 17 课《海滨小城》·词语表' },
  { text: '急急（ ）', answers: ['忙忙'], unitId: '3A-U1', level: 'A', group: '四字词语', source: '第 2 课《花的学校》·词语表' },
  { text: '（ ）种（ ）样', answers: ['各', '各'], unitId: '3A-U6', level: 'B', group: '四字词语', source: '第 18 课《美丽的小兴安岭》·词语表' },
  { text: '又（ ）又（ ）', answers: ['香', '甜'], unitId: '3A-U2', level: 'B', group: '四字词语', source: '第 6 课《秋天的雨》·词语表' },
  { text: '成群（ ）', answers: ['结队'], unitId: '3A-U6', level: 'A', group: '四字词语', source: '第 16 课《富饶的西沙群岛》·词语表' },
  { text: '闪闪（ ）', answers: ['发光'], unitId: '3A-U2', level: 'A', group: '四字词语', source: '第 5 课《铺满金色巴掌的水泥道》·词语表' },
  { text: '一本（ ）', answers: ['正经'], unitId: '3A-U5', level: 'A', group: '四字词语', source: '第 15 课《金色的草地》·词语表' },
  { text: '千姿（ ）', answers: ['百态'], unitId: '3A-U7', level: 'A', group: '四字词语', source: '第 22 课《读不完的大书》·词语表' },
  { text: '秋高（ ）', answers: ['气爽'], unitId: '3A-U7', level: 'A', group: '四字词语', source: '第 22 课《读不完的大书》·词语表' },
  { text: '争分（ ）', answers: ['夺秒'], unitId: '3A-U8', level: 'A', group: '四字词语', source: '第 25 课《手术台就是阵地》·词语表' },
  { text: '当头（ ）', answers: ['一棒'], unitId: '3A-U8', level: 'A', group: '四字词语', source: '第 25 课《手术台就是阵地》·词语表' },
  { text: '井然（ ）', answers: ['有序'], unitId: '3A-U7', level: 'B', group: '四字词语', source: '第 22 课《读不完的大书》·词语表' },
  { text: '银光（ ）', answers: ['闪闪'], unitId: '3A-U6', level: 'A', group: '四字词语', source: '第 17 课《海滨小城》·词语表' },
  { text: '怒目（ ）', answers: ['圆睁'], unitId: '3A-U8', level: 'B', group: '四字词语', source: '语文园地八·词语表' },
  { text: '目瞪（ ）', answers: ['口呆'], unitId: '3A-U8', level: 'A', group: '四字词语', source: '语文园地八·词语表' },
  { text: '耳闻（ ）', answers: ['目睹'], unitId: '3A-U8', level: 'B', group: '四字词语', source: '语文园地八·词语表' },
  // 原文搭配：只挖修饰语或中心语，答案按课文原文唯一确定，避免「富饶的（ ）」这类开放填空
  { text: '它把红色给了枫树，（ ）的枫叶像一枚枚邮票。', answers: ['红红'], unitId: '3A-U2', level: 'A', group: '课文原句中的搭配', source: '第 6 课《秋天的雨》·课文原句' },
  { text: '还有苹果、橘子，好多好多（ ）的气味，都躲在小雨滴里呢！', answers: ['香甜'], unitId: '3A-U2', level: 'A', group: '课文原句中的搭配', source: '第 6 课《秋天的雨》·课文原句' },
  { text: '它的羽毛是（ ）的，翅膀带着一些蓝色，比鹦鹉还漂亮。', answers: ['翠绿'], unitId: '3A-U5', level: 'A', group: '课文原句中的搭配', source: '第 14 课《搭船的鸟》·课文原句' },
  { text: '当蒲公英盛开的时候，这片草地就变成（ ）的了。', answers: ['金色'], unitId: '3A-U5', level: 'A', group: '课文原句中的搭配', source: '第 15 课《金色的草地》·课文原句' },
  { text: '那里风景（ ），物产丰富，是个可爱的地方。', answers: ['优美'], unitId: '3A-U6', level: 'A', group: '课文原句中的搭配', source: '第 16 课《富饶的西沙群岛》·课文原句' },
  { text: '岛上有一片片（ ）的树林，树林里栖息着各种海鸟。', answers: ['茂密'], unitId: '3A-U6', level: 'A', group: '课文原句中的搭配', source: '第 16 课《富饶的西沙群岛》·课文原句' },
  { text: '树下堆积着一层厚厚的鸟粪，这是非常宝贵的（ ）。', answers: ['肥料'], unitId: '3A-U6', level: 'B', group: '课文原句中的搭配', source: '第 16 课《富饶的西沙群岛》·课文原句' },
]

export const JINAYI_SEEDS: FillTextSeed[] = [
  // 近义词
  { text: '写出近义词：洁白（ ）', answers: ['雪白'], unitId: '3A-U1', level: 'A', source: '第 1 课·词语表' },
  { text: '写出近义词：粗壮（ ）', answers: ['强壮'], unitId: '3A-U1', level: 'A', source: '第 1 课·词语表' },
  { text: '写出近义词：湿润（ ）', answers: ['潮湿'], unitId: '3A-U1', level: 'A', source: '第 2 课·词语表' },
  { text: '写出近义词：狂欢（ ）', answers: ['欢庆'], unitId: '3A-U1', level: 'B', source: '第 2 课·词语表' },
  { text: '写出近义词：明朗（ ）', answers: ['晴朗'], unitId: '3A-U2', level: 'A', source: '第 5 课·词语表' },
  { text: '写出近义词：凌乱（ ）', answers: ['杂乱'], unitId: '3A-U2', level: 'B', source: '第 5 课·词语表' },
  { text: '写出近义词：清凉（ ）', answers: ['凉爽'], unitId: '3A-U2', level: 'A', source: '第 6 课·词语表' },
  { text: '写出近义词：炎热（ ）', answers: ['酷热'], unitId: '3A-U2', level: 'B', source: '第 6 课·词语表' },
  { text: '写出近义词：准备（ ）', answers: ['打算'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出近义词：安心（ ）', answers: ['放心'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出近义词：注意（ ）', answers: ['留意'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出近义词：漂亮（ ）', answers: ['美丽'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出近义词：声明（ ）', answers: ['说明'], unitId: '3A-U4', level: 'B', source: '第 11 课·词语表' },
  { text: '写出近义词：普通（ ）', answers: ['平常'], unitId: '3A-U4', level: 'A', source: '第 11 课·词语表' },
  { text: '写出近义词：得到（ ）', answers: ['获得'], unitId: '3A-U4', level: 'A', source: '第 11 课·词语表' },
  { text: '写出近义词：喜爱（ ）', answers: ['喜欢'], unitId: '3A-U5', level: 'A', source: '第 15 课·词语表' },
  { text: '写出近义词：合拢（ ）', answers: ['闭合'], unitId: '3A-U5', level: 'B', source: '第 15 课·词语表' },
  { text: '写出近义词：优美（ ）', answers: ['秀美'], unitId: '3A-U6', level: 'B', source: '第 16 课·词语表' },
  { text: '写出近义词：理睬（ ）', answers: ['理会'], unitId: '3A-U6', level: 'B', source: '第 17 课·词语表' },
  { text: '写出近义词：干净（ ）', answers: ['洁净'], unitId: '3A-U6', level: 'A', source: '第 17 课·词语表' },
  { text: '写出近义词：苍翠（ ）', answers: ['翠绿'], unitId: '3A-U6', level: 'B', source: '第 18 课·词语表' },
  { text: '写出近义词：沉思（ ）', answers: ['深思'], unitId: '3A-U7', level: 'B', source: '第 22 课·词语表' },
  { text: '写出近义词：奥秘（ ）', answers: ['秘密'], unitId: '3A-U7', level: 'A', source: '第 22 课·词语表' },
  { text: '写出近义词：温柔（ ）', answers: ['温和'], unitId: '3A-U7', level: 'B', source: '第 21 课·词语表' },
  { text: '写出近义词：轻快（ ）', answers: ['轻巧'], unitId: '3A-U7', level: 'B', source: '第 21 课·词语表' },
  { text: '写出近义词：感受（ ）', answers: ['体会'], unitId: '3A-U7', level: 'A', source: '第 21 课·词语表' },
  { text: '写出近义词：迅速（ ）', answers: ['快速'], unitId: '3A-U8', level: 'A', source: '第 25 课·词语表' },
  { text: '写出近义词：连续（ ）', answers: ['持续'], unitId: '3A-U8', level: 'B', source: '第 25 课·词语表' },
  { text: '写出近义词：兴奋（ ）', answers: ['激动'], unitId: '3A-U8', level: 'B', source: '第 24 课·词语表' },
  // 反义词
  { text: '写出反义词：洁白（ ）', answers: ['乌黑'], unitId: '3A-U1', level: 'A', source: '第 1 课·词语表' },
  { text: '写出反义词：粗壮（ ）', answers: ['纤细'], unitId: '3A-U1', level: 'B', source: '第 1 课·词语表' },
  { text: '写出反义词：湿润（ ）', answers: ['干燥'], unitId: '3A-U1', level: 'A', source: '第 2 课·词语表' },
  { text: '写出反义词：热闹（ ）', answers: ['冷清'], unitId: '3A-U1', level: 'A', source: '第 1 课·词语表' },
  { text: '写出反义词：古老（ ）', answers: ['年轻'], unitId: '3A-U1', level: 'A', source: '第 1 课·词语表' },
  { text: '写出反义词：明朗（ ）', answers: ['阴暗'], unitId: '3A-U2', level: 'B', source: '第 5 课·词语表' },
  { text: '写出反义词：凌乱（ ）', answers: ['整齐'], unitId: '3A-U2', level: 'A', source: '第 5 课·词语表' },
  { text: '写出反义词：清凉（ ）', answers: ['炎热'], unitId: '3A-U2', level: 'A', source: '第 6 课·词语表' },
  { text: '写出反义词：凉爽（ ）', answers: ['闷热'], unitId: '3A-U2', level: 'B', source: '第 6 课·词语表' },
  { text: '写出反义词：安心（ ）', answers: ['担心'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出反义词：漂亮（ ）', answers: ['难看'], unitId: '3A-U3', level: 'A', source: '第 8 课·词语表' },
  { text: '写出反义词：普通（ ）', answers: ['特别'], unitId: '3A-U4', level: 'A', source: '第 11 课·词语表' },
  { text: '写出反义词：得到（ ）', answers: ['失去'], unitId: '3A-U4', level: 'A', source: '第 11 课·词语表' },
  { text: '写出反义词：合拢（ ）', answers: ['张开'], unitId: '3A-U5', level: 'A', source: '第 15 课·词语表' },
  { text: '写出反义词：喜爱（ ）', answers: ['讨厌'], unitId: '3A-U5', level: 'A', source: '第 15 课·词语表' },
  { text: '写出反义词：优美（ ）', answers: ['丑陋'], unitId: '3A-U6', level: 'B', source: '第 16 课·词语表' },
  { text: '写出反义词：茂密（ ）', answers: ['稀疏'], unitId: '3A-U6', level: 'B', source: '第 16 课·词语表' },
  { text: '写出反义词：干净（ ）', answers: ['肮脏'], unitId: '3A-U6', level: 'A', source: '第 17 课·词语表' },
  { text: '写出反义词：温柔（ ）', answers: ['粗暴'], unitId: '3A-U7', level: 'B', source: '第 21 课·词语表' },
  { text: '写出反义词：轻快（ ）', answers: ['沉重'], unitId: '3A-U7', level: 'B', source: '第 21 课·词语表' },
  { text: '写出反义词：危险（ ）', answers: ['安全'], unitId: '3A-U8', level: 'A', source: '第 25 课·识字表' },
  { text: '写出反义词：迅速（ ）', answers: ['缓慢'], unitId: '3A-U8', level: 'A', source: '第 25 课·词语表' },
  { text: '写出反义词：连续（ ）', answers: ['间断'], unitId: '3A-U8', level: 'B', source: '第 25 课·词语表' },
  { text: '写出反义词：兴奋（ ）', answers: ['平静'], unitId: '3A-U8', level: 'B', source: '第 24 课·词语表' },
]

export const XUANZI_SEEDS: FillTextSeed[] = [
  { text: '山（ ）、水（ ）、（ ）浪、（ ）度', answers: ['坡', '波', '波', '坡'], bank: ['坡', '波'], unitId: '3A-U1', level: 'B', source: '第 1 课·写字表' },
  { text: '小（ ）、（ ）壮、（ ）心、分（ ）', answers: ['组', '粗', '粗', '组'], bank: ['组', '粗'], unitId: '3A-U1', level: 'B', source: '第 1 课·写字表' },
  { text: '小（ ）、（ ）过、田（ ）、已（ ）', answers: ['径', '经', '径', '经'], bank: ['径', '经'], unitId: '3A-U2', level: 'B', source: '第 4 课·写字表' },
  { text: '眼（ ）、（ ）天、（ ）水、心（ ）', answers: ['睛', '晴', '清', '情'], bank: ['睛', '晴', '清', '情'], unitId: '3A-U4', level: 'B', source: '第 12 课·写字表' },
  { text: '（ ）扬、（ ）亮、（ ）浮、（ ）落', answers: ['飘', '漂', '漂', '飘'], bank: ['飘', '漂'], unitId: '3A-U1', level: 'B', source: '第 1 课·写字表' },
  { text: '表（ ）、（ ）树、飞（ ）、（ ）梅', answers: ['扬', '杨', '扬', '杨'], bank: ['扬', '杨'], unitId: '3A-U1', level: 'B', source: '第 1 课·写字表' },
  { text: '（ ）滩、面（ ）、（ ）土、轻（ ）', answers: ['沙', '纱', '沙', '纱'], bank: ['沙', '纱'], unitId: '3A-U6', level: 'B', source: '第 17 课·写字表' },
  { text: '海（ ）、（ ）客、（ ）江、来（ ）', answers: ['滨', '宾', '滨', '宾'], bank: ['滨', '宾'], unitId: '3A-U6', level: 'B', source: '第 17 课·写字表' },
  { text: '（ ）民、（ ）儿、（ ）船、金（ ）', answers: ['渔', '鱼', '渔', '鱼'], bank: ['渔', '鱼'], unitId: '3A-U6', level: 'B', source: '第 17 课·写字表' },
  { text: '（ ）子、环（ ）、眼（ ）、边（ ）', answers: ['镜', '境', '镜', '境'], bank: ['镜', '境'], unitId: '3A-U8', level: 'B', source: '第 25 课·写字表' },
  { text: '危（ ）、（ ）查、（ ）峰、体（ ）', answers: ['险', '检', '险', '检'], bank: ['险', '检'], unitId: '3A-U8', level: 'B', source: '第 25 课·写字表' },
  { text: '顺（ ）、情（ ）、（ ）号、思（ ）', answers: ['序', '绪', '序', '绪'], bank: ['序', '绪'], unitId: '3A-U7', level: 'B', source: '第 22 课·写字表' },
  { text: '（ ）长、（ ）走、浪（ ）、（ ）车', answers: ['漫', '慢', '漫', '慢'], bank: ['漫', '慢'], unitId: '3A-U6', level: 'B', source: '第 16 课·写字表' },
  { text: '（ ）来、（ ）尾、（ ）必、周（ ）', answers: ['未', '末', '未', '末'], bank: ['未', '末'], unitId: '3A-U2', level: 'B', source: '第 4 课·写字表' },
  { text: '严（ ）、（ ）史、经（ ）、（ ）声', answers: ['厉', '历', '历', '厉'], bank: ['厉', '历'], unitId: '3A-U1', level: 'B', source: '第 3 课·识字表' },
  // 第 3 单元
  { text: '（ ）太阳、（ ）水、（ ）被子、泼（ ）', answers: ['晒', '洒', '晒', '洒'], bank: ['晒', '洒'], unitId: '3A-U3', level: 'B', source: '第 8 课·写字表' },
  { text: '（ ）出、（ ）立、车（ ）、（ ）洞', answers: ['钻', '站', '站', '钻'], bank: ['钻', '站'], unitId: '3A-U3', level: 'B', source: '第 8 课·写字表' },
  { text: '（ ）雨、（ ）炸、狂（ ）、（ ）米花', answers: ['暴', '爆', '暴', '爆'], bank: ['暴', '爆'], unitId: '3A-U3', level: 'C', source: '第 8 课·写字表' },
  // 第 5 单元
  { text: '（ ）船、宝（ ）、（ ）桥、灯（ ）', answers: ['搭', '塔', '搭', '塔'], bank: ['搭', '塔'], unitId: '3A-U5', level: 'B', source: '第 14 课·写字表' },
  { text: '（ ）头、（ ）远、（ ）动、（ ）望', answers: ['摇', '遥', '摇', '遥'], bank: ['摇', '遥'], unitId: '3A-U5', level: 'B', source: '第 14 课·写字表' },
  { text: '（ ）天、花（ ）、（ ）色、球（ ）', answers: ['蓝', '篮', '蓝', '篮'], bank: ['蓝', '篮'], unitId: '3A-U5', level: 'B', source: '第 14 课·写字表' },
  { text: '安（ ）、干（ ）、（ ）悄悄、洁（ ）', answers: ['静', '净', '静', '净'], bank: ['静', '净'], unitId: '3A-U5', level: 'B', source: '第 14 课·写字表' },
  // 第 6 单元
  { text: '茂（ ）、蜂（ ）、（ ）林、甜（ ）', answers: ['密', '蜜', '密', '蜜'], bank: ['密', '蜜'], unitId: '3A-U6', level: 'B', source: '第 16 课·写字表' },
  { text: '水（ ）、（ ）头、（ ）下、最（ ）', answers: ['底', '低', '底', '低'], bank: ['底', '低'], unitId: '3A-U6', level: 'B', source: '第 16 课·写字表' },
  { text: '风（ ）、（ ）子、（ ）色、电（ ）', answers: ['景', '影', '景', '影'], bank: ['景', '影'], unitId: '3A-U6', level: 'B', source: '第 16 课·写字表' },
  // 第 7 单元
  { text: '光（ ）、（ ）易、（ ）誉、笑（ ）', answers: ['荣', '容', '荣', '容'], bank: ['荣', '容'], unitId: '3A-U7', level: 'B', source: '第 22 课·写字表' },
  { text: '（ ）势、（ ）料、舞（ ）、（ ）本', answers: ['姿', '资', '姿', '资'], bank: ['姿', '资'], unitId: '3A-U7', level: 'B', source: '第 22 课·写字表' },
  // 第 8 单元
  { text: '（ ）试、（ ）师、（ ）虑、古（ ）', answers: ['考', '老', '考', '老'], bank: ['考', '老'], unitId: '3A-U8', level: 'B', source: '第 24 课·写字表' },
  { text: '后（ ）、大（ ）、（ ）步、桌（ ）', answers: ['退', '腿', '退', '腿'], bank: ['退', '腿'], unitId: '3A-U8', level: 'B', source: '第 24 课·写字表' },
  { text: '（ ）针、美（ ）、（ ）表、奇（ ）', answers: ['秒', '妙', '秒', '妙'], bank: ['秒', '妙'], unitId: '3A-U8', level: 'B', source: '第 25 课·写字表' },
]

export const RIJI_SEEDS: FillTextSeed[] = [
  { text: '不迁怒，不（ ）。——《论语》', answers: ['贰过'], unitId: '3A-U3', level: 'B', source: '语文园地三·日积月累' },
  { text: '爱人若爱（ ）。——《墨子》', answers: ['其身'], unitId: '3A-U3', level: 'B', source: '语文园地三·日积月累' },
  { text: '仁者爱人，有礼者（ ）。——《孟子》', answers: ['敬人'], unitId: '3A-U3', level: 'B', source: '语文园地三·日积月累' },
  { text: '与人善言，暖于（ ）；伤人以言，深于（ ）。——《荀子》', answers: ['布帛', '矛戟'], unitId: '3A-U3', level: 'C', source: '语文园地三·日积月累' },
  { text: '人心齐，（ ）。', answers: ['泰山移'], unitId: '3A-U4', level: 'A', source: '语文园地四·日积月累' },
  { text: '二人同心，（ ）。', answers: ['其利断金'], unitId: '3A-U4', level: 'B', source: '语文园地四·日积月累' },
  { text: '三个臭皮匠，顶个（ ）。', answers: ['诸葛亮'], unitId: '3A-U4', level: 'B', source: '语文园地四·日积月累' },
  { text: '士不可以不（ ），任重而道远。——《论语》', answers: ['弘毅'], unitId: '3A-U8', level: 'C', source: '语文园地八·日积月累' },
  { text: '志不强者（ ），言不信者（ ）。——《墨子》', answers: ['智不达', '行不果'], unitId: '3A-U8', level: 'C', source: '语文园地八·日积月累' },
  { text: '锲而舍之，朽木不折；锲而不舍，（ ）。——《荀子》', answers: ['金石可镂'], unitId: '3A-U8', level: 'C', source: '语文园地八·日积月累' },
]
