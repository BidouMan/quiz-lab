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
 * 统编版（人教社）《义务教育教科书·语文》三年级上册，五·四学制，
 * 上海 2026 学年在用教材。
 *
 * 本版数据全部按人教社官方电子教材逐页核对：
 * - 目录：p3–5；识字表：p109–111；写字表：p112–113；词语表：p114–116；
 * - 线上入口：https://book.pep.com.cn/1211001301252/
 *
 * 口径：
 * - 识字表 276 个条目，其中蓝色多音字 26 个（不计入「共 250 个生字」），
 *   黑色字 + 四个语文园地合计 250；
 * - 写字表逐行清点 249 条，书末标注 250 字，差 1 字未定位，不猜补；
 * - 词语表逐课清点 250 词，与书末标注一致（含园地词 23 个）。
 */

const BOOK_URL = 'https://book.pep.com.cn/1211001301252/'

const bookSource = (locator: string): SourceRef => ({
  label: '人教社电子教材·义务教育教科书（五·四学制）语文三年级上册',
  url: BOOK_URL,
  locator,
})

const SRC_RENZI = bookSource('识字表 p109–111')
const SRC_XIEZI = bookSource('写字表 p112–113')
const SRC_WORDS = bookSource('词语表 p114–116')
const SRC_TOC = bookSource('目录 p3–5')
const gardenSource = (page: string): SourceRef => bookSource(`语文园地 p${page}`)

export const SRC_CURRICULUM: SourceRef = {
  label: '人教社电子教材·五四学制语文三年级上册（2024 审核通过，2025 秋使用）',
  url: BOOK_URL,
  locator: '8 单元 26 课目录 p3–5',
}

// ==================== 构造工具 ====================

/** 紧凑字表：`坡pō 球qiú 假jià*`；末尾 * 表示识字表蓝色多音字 */
function parseChars(raw: string): { char: string; pinyin: string; multi: boolean }[] {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const multi = token.endsWith('*')
      const body = multi ? token.slice(0, -1) : token
      const char = [...body][0] ?? ''
      const pinyin = [...body].slice(1).join('')
      return { char, pinyin, multi }
    })
}

const renzi = (raw: string): ChineseChar[] =>
  parseChars(raw).map((item) => ({
    ...item,
    table: 'renzi',
    status: 'verified',
    sources: [SRC_RENZI],
    ...(item.multi ? { note: '识字表蓝色字，本课作多音字学习，不计入生字总数' } : {}),
  }))

const xiezi = (raw: string): ChineseChar[] =>
  parseChars(raw).map((item) => ({
    char: item.char,
    pinyin: item.pinyin,
    table: 'xiezi',
    status: 'verified',
    sources: [SRC_XIEZI],
  }))

const wv = (word: string, sources: SourceRef[] = [SRC_WORDS]): ChineseWord => ({
  word,
  kind: '词语表',
  status: 'verified',
  sources,
})

/** 课文词语：词语表未收，但课文正文出现，来源单独标注 */
const cwv = (word: string, locator: string): ChineseWord => ({
  word,
  kind: '课文词语',
  status: 'verified',
  sources: [bookSource(locator)],
})

const pv = (
  poem: Omit<ChinesePoem, 'status' | 'sources'>,
  locator: string,
): ChinesePoem => ({
  ...poem,
  status: 'verified',
  sources: [bookSource(locator)],
})

interface RawLesson {
  no: number
  title: string
  kind: '精读' | '略读'
  renzi?: string
  xiezi?: string
  /** 词语表词只写词形；课文词语传 ChineseWord */
  words?: (string | ChineseWord)[]
  poems?: ChinesePoem[]
  note?: string
}

function lesson(unitNo: number, raw: RawLesson): ChineseLesson {
  return {
    lessonId: `3A-U${unitNo}-L${raw.no}`,
    no: raw.no,
    title: raw.title,
    kind: raw.kind,
    renzi: renzi(raw.renzi ?? ''),
    xiezi: xiezi(raw.xiezi ?? ''),
    words: (raw.words ?? []).map((word) => (typeof word === 'string' ? wv(word) : word)),
    ...(raw.poems ? { poems: raw.poems } : {}),
    ...(raw.note ? { note: raw.note } : {}),
  }
}

// ==================== 题型元数据 ====================

export const CHINESE_TYPES: ChineseTypeMeta[] = [
  { typeId: 'kanpinyin', label: '看拼音写词语', counts: { A: 8, B: 12, C: 16 } },
  { typeId: 'zhuyin', label: '给加点字注音', counts: { A: 6, B: 10, C: 14 } },
  { typeId: 'duoyin', label: '多音字组词', counts: { A: 4, B: 6, C: 8 }, note: '教材蓝色多音字逐课标注' },
  { typeId: 'xingjin', label: '形近字组词', counts: { A: 4, B: 6, C: 8 } },
  { typeId: 'cipu', label: '词语搭配与积累', counts: { A: 6, B: 8, C: 10 } },
  { typeId: 'jinayi', label: '近义词与反义词', counts: { A: 4, B: 6, C: 8 } },
  { typeId: 'gushi', label: '古诗默写', counts: { A: 4, B: 6, C: 8 }, note: '只取教材内古诗，答案可逐字复核' },
  { typeId: 'juzi', label: '课文原句填空', counts: { A: 4, B: 6, C: 8 } },
]

const WORD_TYPES = ['kanpinyin', 'zhuyin', 'duoyin', 'xingjin', 'cipu', 'jinayi'] as const

// ==================== 第一单元 ====================

const U1: ChineseUnit = {
  unitId: '3A-U1',
  unitName: '第一单元',
  theme: '学校生活',
  lessons: [
    lesson(1, {
      no: 1,
      title: '大青树下的小学',
      kind: '精读',
      renzi: '绒róng 昂áng 扬yáng 凤fèng 墙qiáng 晃huàng',
      xiezi: '坡pō 球qiú 招zhāo 呼hū 飘piāo 扬yáng 读dú 热rè 闹nào 粗cū 壮zhuàng 洁jié',
      words: ['山坡', '学校', '飘扬', '课文', '声音', '招引', '热闹', '古老', '粗壮', '枝干', '洁白'],
    }),
    lesson(1, {
      no: 2,
      title: '花的学校',
      kind: '精读',
      renzi: '轰hōng 湿shī 荒huāng 笛dí 罚fá 假jià* 臂bì',
      xiezi: '轰hōng 湿shī 润rùn 笛dí 狂kuáng 功gōng 罚fá 互hù 碰pèng 黄huáng 急jí',
      words: ['轰响', '阵雨', '湿润', '风笛', '狂欢', '觉得', '功课', '放学', '老师', '急急忙忙'],
    }),
    lesson(1, {
      no: 3,
      title: '不懂就要问',
      kind: '略读',
      renzi: '诵sòng 例lì 糊hú 戒jiè 厉lì 详xiáng 挨ái',
      words: [cwv('私塾', '第 3 课《不懂就要问》p7–8'), cwv('戒尺', '第 3 课《不懂就要问》p7–8')],
      note: '略读课只有识字表；词语「私塾、戒尺」为课文词语。',
    }),
  ],
  availableTypes: [...WORD_TYPES, 'juzi'],
  garden: {
    label: '语文园地一',
    items: [],
    poems: [
      pv(
        {
          title: '所见',
          author: '袁枚',
          dynasty: '清',
          lines: ['牧童骑黄牛，歌声振林樾。', '意欲捕鸣蝉，忽然闭口立。'],
        },
        '语文园地一·日积月累 p11',
      ),
    ],
    status: 'verified',
    sources: [gardenSource('11')],
  },
  writing: { label: '习作：猜猜他是谁', status: 'verified', sources: [SRC_TOC] },
  oral: { label: '口语交际：我的暑假生活', status: 'verified' },
}

// ==================== 第二单元 ====================

const U2: ChineseUnit = {
  unitId: '3A-U2',
  unitName: '第二单元',
  theme: '金秋时节',
  lessons: [
    lesson(2, {
      no: 4,
      title: '古诗三首',
      kind: '精读',
      renzi: '庭tíng 未wèi 磨mó* 斜xié 萧xiāo 挑tiǎo* 促cù',
      xiezi: '庭tíng 相xiāng 未wèi 寒hán 径jìng 斜xié 枫fēng 霜shuāng 挑tiǎo 深shēn 落luò',
      poems: [
        pv(
          {
            title: '山行',
            author: '杜牧',
            dynasty: '唐',
            lines: ['远上寒山石径斜，白云生处有人家。', '停车坐爱枫林晚，霜叶红于二月花。'],
          },
          '第 4 课《古诗三首》p14–15',
        ),
        pv(
          {
            title: '望洞庭',
            author: '刘禹锡',
            dynasty: '唐',
            lines: ['湖光秋月两相和，潭面无风镜未磨。', '遥望洞庭山水翠，白银盘里一青螺。'],
          },
          '第 4 课《古诗三首》p14–15',
        ),
        pv(
          {
            title: '夜书所见',
            author: '叶绍翁',
            dynasty: '宋',
            lines: ['萧萧梧叶送寒声，江上秋风动客情。', '知有儿童挑促织，夜深篱落一灯明。'],
          },
          '第 4 课《古诗三首》p14–15',
        ),
      ],
    }),
    lesson(2, {
      no: 5,
      title: '铺满金色巴掌的水泥道',
      kind: '精读',
      renzi: '粘zhān 印yìn 列liè 凌líng 增zēng 棕zōng',
      xiezi: '朗lǎng 晶jīng 珠zhū 粘zhān 印yìn 案àn 展zhǎn 列liè 规guī 则zé 凌líng 乱luàn',
      words: [
        '秋风', '放晴', '明朗', '地面', '亮晶晶', '落叶', '图案',
        '闪闪发光', '尽头', '排列', '规则', '凌乱', '歌唱', '迟到',
      ],
    }),
    lesson(2, {
      no: 6,
      title: '秋天的雨',
      kind: '精读',
      renzi: '钥yào 匙shi 缤bīn 枚méi 邮yóu 爽shuǎng 橘jú 频pín 梨lí 勾gōu 喇lǎ 叭bā',
      xiezi: '凉liáng 杏xìng 枚méi 邮yóu 票piào 爽shuǎng 挤jǐ 争zhēng 菊jú 频pín 勾gōu 挖wā 油yóu',
      words: [
        '秋天', '清凉', '炎热', '枫树', '邮票', '凉爽', '果树',
        '菊花', '仙子', '频频', '气味', '香甜', '松果', '丰收',
      ],
    }),
    lesson(2, {
      no: 7,
      title: '听听，秋的声音',
      kind: '略读',
      renzi: '抖dǒu 振zhèn 韵yùn 掠lüè 吟yín 辽liáo 阔kuò',
      note: '略读课只有识字表，无词语表条目。',
    }),
  ],
  availableTypes: [...WORD_TYPES, 'gushi', 'juzi'],
  garden: {
    label: '语文园地二',
    items: [],
    poems: [
      pv(
        {
          title: '舟夜书所见',
          author: '查慎行',
          dynasty: '清',
          lines: ['月黑见渔灯，孤光一点萤。', '微微风簇浪，散作满河星。'],
        },
        '语文园地二·日积月累 p25',
      ),
    ],
    status: 'verified',
    sources: [gardenSource('25')],
  },
  writing: { label: '习作：写日记', status: 'verified', sources: [SRC_TOC] },
}

// ==================== 第三单元 ====================

const U3: ChineseUnit = {
  unitId: '3A-U3',
  unitName: '第三单元',
  theme: '阅读策略：预测',
  lessons: [
    lesson(3, {
      no: 8,
      title: '总也倒不了的老屋',
      kind: '精读',
      renzi: '眯mī 哦ó 喵miāo 孵fū 叽jī 缝fèng 偶ǒu 尔ěr',
      xiezi: '屋wū 板bǎn 准zhǔn 备bèi 等děng 暴bào 哦ó 钻zuān 爬pá 漂piāo 晒shài',
      words: [
        '门板', '准备', '旁边', '暴风雨', '安心', '低头', '吃力',
        '再见', '母鸡', '注意', '屋子', '漂亮', '意思', '因此',
      ],
    }),
    lesson(3, {
      no: 9,
      title: '犟龟',
      kind: '略读',
      renzi: '陶táo 适shì 谈tán 婚hūn 庆qìng 典diǎn 途tú 括kuò 史shǐ 倍bèi 几jǐ 持chí 官guān',
      note: '略读课只有识字表，无词语表条目。',
    }),
    lesson(3, {
      no: 10,
      title: '小狗学叫',
      kind: '略读',
      renzi: '陌mò 吗má* 讨tǎo 厌yàn 访fǎng 记jì 忍rěn 委wěi 屈qū 中zhòng* 弹dàn* 疯fēng 局jú 汪wāng 搞gǎo',
      note: '略读课只有识字表，无词语表条目。',
    }),
  ],
  availableTypes: [...WORD_TYPES],
  garden: {
    label: '语文园地三',
    items: [
      '不迁怒，不贰过。——《论语》',
      '爱人若爱其身。——《墨子》',
      '仁者爱人，有礼者敬人。——《孟子》',
      '与人善言，暖于布帛；伤人以言，深于矛戟。——《荀子》',
    ],
    words: ['恒心', '神圣', '萌发', '妥当', '车轴', '阁楼', '培植', '厘米'].map((word) => wv(word)),
    status: 'verified',
    sources: [gardenSource('43')],
  },
  writing: { label: '习作：续写故事', status: 'verified', sources: [SRC_TOC] },
  oral: { label: '口语交际：名字里的故事', status: 'verified' },
}

// ==================== 第四单元 ====================

const U4: ChineseUnit = {
  unitId: '3A-U4',
  unitName: '第四单元',
  theme: '童话',
  lessons: [
    lesson(4, {
      no: 11,
      title: '宝葫芦的秘密（节选）',
      kind: '精读',
      renzi: '普pǔ 少shào* 矩jǔ 丫yā 宫gōng 掘jué 希xī 冲chōng* 联lián 系xì* 葵kuí 瘦shòu 罢bà',
      xiezi: '葫hú 芦lú 错cuò 普pǔ 宫gōng 肯kěn 冒mào 式shì 怜lián',
      words: [
        '葫芦', '声明', '神仙', '普通', '让步', '条件', '指甲',
        '得到', '衣服', '所以', '要是', '可怜', '最好', '科学',
      ],
    }),
    lesson(4, {
      no: 12,
      title: '在牛肚子里旅行',
      kind: '精读',
      renzi: '答dá 应yìng* 及jí 卷juǎn 骨gǔ* 碌lù 齿chǐ 嚼jiáo 吞tūn 胃wèi 咽yàn',
      xiezi: '旅lǚ 另lìng 睛jīng 及jí 卷juǎn 救jiù 命mìng 尾wěi 齿chǐ 胃wèi 管guǎn 刚gāng 咬yǎo',
      words: [
        '旅行', '要好', '答应', '做梦', '来得及', '救命', '大吃一惊',
        '尾巴', '牙齿', '肚皮', '食物', '消化', '当然', '刚才', '知觉', '光亮',
      ],
    }),
    lesson(4, {
      no: 13,
      title: '一块奶酪',
      kind: '略读',
      renzi: '宣xuān 处chǔ* 恐kǒng 诱yòu 毅yì 强qiáng 纪jì 性xìng 渣zhā 犯fàn 禁jìn* 旧jiù 聚jù',
      note: '略读课只有识字表，无词语表条目。',
    }),
  ],
  availableTypes: [...WORD_TYPES],
  garden: {
    label: '语文园地四',
    items: ['人心齐，泰山移。', '二人同心，其利断金。', '三个臭皮匠，顶个诸葛亮。'],
    words: ['申请', '介绍', '主旨', '占领', '乏力'].map((word) => wv(word)),
    status: 'verified',
    sources: [gardenSource('55')],
  },
  writing: { label: '习作：我来编童话', status: 'verified', sources: [SRC_TOC] },
  extra: { label: '快乐读书吧：在那奇妙的王国里', status: 'verified' },
}

// ==================== 第五单元 ====================

const U5: ChineseUnit = {
  unitId: '3A-U5',
  unitName: '第五单元',
  theme: '习作单元：留心观察',
  lessons: [
    lesson(5, {
      no: 14,
      title: '搭船的鸟',
      kind: '精读',
      renzi: '舱cāng 啦la 鹦yīng 鹉wǔ 衔xián',
      xiezi: '搭dā 亲qīn 祖zǔ 披pī 摇yáo 停tíng 羽yǔ 翠cuì 蓝lán 静jìng 悄qiāo 吞tūn 捕bǔ',
      words: ['母亲', '外祖父', '船夫', '羽毛', '翠绿', '静悄悄', '翠鸟', '捕鱼'],
    }),
    lesson(5, {
      no: 15,
      title: '金色的草地',
      kind: '精读',
      renzi: '蒲pú 英yīng 耍shuǎ 茸róng 欠qiàn 拢lǒng',
      xiezi: '蒲pú 英yīng 盛shèng 耍shuǎ 使shǐ 劲jìn 脸liǎn 欠qiàn 朝cháo 钓diào 察chá 拢lǒng 喜xǐ',
      words: ['草地', '蒲公英', '盛开', '玩耍', '一本正经', '使劲', '钓鱼', '观察', '合拢', '张开', '喜爱'],
    }),
  ],
  availableTypes: [...WORD_TYPES],
  writing: { label: '习作：我们眼中的缤纷世界', status: 'verified', sources: [SRC_TOC] },
  note: '习作单元无语文园地；教材安排「梳理与交流」「初试身手」「习作例文」。',
}

// ==================== 第六单元 ====================

const U6: ChineseUnit = {
  unitId: '3A-U6',
  unitName: '第六单元',
  theme: '祖国河山',
  lessons: [
    lesson(6, {
      no: 16,
      title: '富饶的西沙群岛',
      kind: '精读',
      renzi: '饶ráo 优yōu 崖yá 参shēn* 懒lǎn 划huá 威wēi 武wǔ 插chā 栖qī 厚hòu 粪fèn 辈bèi',
      xiezi: '景jǐng 优yōu 淡dàn 浅qiǎn 底dǐ 岩yán 鹿lù 划huá 布bù 茂mào 密mì 厚hòu 料liào',
      words: [
        '风景', '优美', '物产', '交错', '岩石', '鹿角', '成群结队', '布满',
        '条纹', '周身', '皮球', '茂密', '肥料', '祖国', '事业', '发展',
      ],
    }),
    lesson(6, {
      no: 17,
      title: '海滨小城',
      kind: '精读',
      renzi: '滨bīn 胳gē 臂bì* 滩tān 睬cǎi 载zài 逢féng',
      xiezi: '滨bīn 棕zōng 帆fān 灰huī 跟gēn 渔yú 壳ké 睬cǎi 院yuàn 透tòu 除chú 踩cǎi',
      words: [
        '海滨', '街道', '交界', '水平线', '机帆船', '来来往往', '朝阳', '渔民',
        '贝壳', '理睬', '汽笛', '出海', '银光闪闪', '庭院', '散发', '打扫', '干净',
      ],
    }),
    lesson(6, {
      no: 18,
      title: '美丽的小兴安岭',
      kind: '精读',
      renzi: '兴xīng* 融róng 侧cè 欣xīn 封fēng 浸jìn 乳rǔ 梢shāo 宿sù 舍shè* 药yào 眠mián',
      xiezi: '抽chōu 封fēng 严yán 挡dǎng 坛tán 显xiǎn 苍cāng 药yào 材cái 软ruǎn 刮guā 捉zhuō',
      words: [
        '东北', '密密麻麻', '严严实实', '视线', '山谷', '起来', '照射', '各种各样',
        '花坛', '显得', '苍翠', '药材', '捕捉', '野兔', '景色', '宝库',
      ],
    }),
    lesson(6, {
      no: 19,
      title: '香港，璀璨的明珠',
      kind: '略读',
      renzi: '贸mào 愧kuì 仅jǐn 议yì 政zhèng 府fǔ 赠zèng 幻huàn 焰yàn 澳ào 扮bàn 角jué*',
      note: '略读课只有识字表，无词语表条目。',
    }),
  ],
  availableTypes: [...WORD_TYPES],
  garden: {
    label: '语文园地六',
    items: [],
    words: ['田螺', '螃蟹', '鲤鱼', '鲫鱼', '鲨鱼'].map((word) => wv(word)),
    poems: [
      pv(
        {
          title: '早发白帝城',
          author: '李白',
          dynasty: '唐',
          lines: ['朝辞白帝彩云间，千里江陵一日还。', '两岸猿声啼不住，轻舟已过万重山。'],
        },
        '语文园地六·日积月累 p81',
      ),
    ],
    status: 'verified',
    sources: [gardenSource('81')],
  },
  writing: { label: '习作：这儿真美', status: 'verified', sources: [SRC_TOC] },
}

// ==================== 第七单元 ====================

const U7: ChineseUnit = {
  unitId: '3A-U7',
  unitName: '第七单元',
  theme: '走近自然',
  lessons: [
    lesson(7, {
      no: 20,
      title: '古诗三首',
      kind: '精读',
      renzi: '返fǎn 苔tái 亦yì 抹mǒ* 宜yí',
      xiezi: '返fǎn 望wàng 断duàn 楚chǔ 至zhì 岸àn 孤gū 饮yǐn 亦yì 欲yù 抹mǒ 宜yí',
      poems: [
        pv(
          {
            title: '望天门山',
            author: '李白',
            dynasty: '唐',
            lines: ['天门中断楚江开，碧水东流至此回。', '两岸青山相对出，孤帆一片日边来。'],
          },
          '第 20 课《古诗三首》p84–85',
        ),
        pv(
          {
            title: '饮湖上初晴后雨',
            author: '苏轼',
            dynasty: '宋',
            lines: ['水光潋滟晴方好，山色空蒙雨亦奇。', '欲把西湖比西子，淡妆浓抹总相宜。'],
          },
          '第 20 课《古诗三首》p84–85',
        ),
        pv(
          {
            title: '鹿柴',
            author: '王维',
            dynasty: '唐',
            lines: ['空山不见人，但闻人语响。', '返景入深林，复照青苔上。'],
          },
          '第 20 课《古诗三首》p84–85',
        ),
      ],
    }),
    lesson(7, {
      no: 21,
      title: '大自然的声音',
      kind: '精读',
      renzi: '妙miào 奏zòu 呢ne* 喃nán 激jī 伟wěi 充chōng 击jī 器qì 汇huì 哩li*',
      xiezi: '妙miào 奏zòu 琴qín 柔róu 感gǎn 充chōng 威wēi 器qì 汇huì 鸣míng 塘táng',
      words: [
        '大自然', '美妙', '音乐家', '手风琴', '歌手', '感受', '温柔', '合奏',
        '充满', '威力', '乐器', '屋顶', '河流', '轻快', '合唱', '水塘',
      ],
    }),
    lesson(7, {
      no: 22,
      title: '读不完的大书',
      kind: '精读',
      renzi: '麻má 旋xuán 序xù 贞zhēn 姿zī 笋sǔn 超chāo 凡fán 俗sú 奥ào 秘mì',
      xiezi: '虾xiā 昆kūn 仅jǐn 序xù 荣róng 枯kū 姿zī 态tài 刺cì 梨lí 部bù 奥ào 秘mì',
      words: [
        '昆虫', '万物', '沉思', '搬家', '井然有序', '精神', '植物', '千姿百态',
        '鲜美', '池塘', '秋高气爽', '倒映', '游玩', '画册', '无穷', '奥秘', '无尽',
      ],
    }),
  ],
  availableTypes: [...WORD_TYPES, 'gushi'],
  garden: {
    label: '语文园地七',
    items: [],
    poems: [
      pv(
        {
          title: '采莲曲',
          author: '王昌龄',
          dynasty: '唐',
          lines: ['荷叶罗裙一色裁，芙蓉向脸两边开。', '乱入池中看不见，闻歌始觉有人来。'],
        },
        '语文园地七·日积月累 p93',
      ),
    ],
    status: 'verified',
    sources: [gardenSource('93')],
  },
  writing: { label: '习作：我有一个想法', status: 'verified', sources: [SRC_TOC] },
  oral: { label: '口语交际：身边的“小事”', status: 'verified' },
}

// ==================== 第八单元 ====================

const U8: ChineseUnit = {
  unitId: '3A-U8',
  unitName: '第八单元',
  theme: '美好品质',
  lessons: [
    lesson(8, {
      no: 23,
      title: '司马光',
      kind: '精读',
      renzi: '司sī 皆jiē 弃qì',
      xiezi: '司sī 登dēng 跌diē 皆jiē 弃qì 持chí 击jī',
      note: '文言文，词语表无本课条目。',
    }),
    lesson(8, {
      no: 24,
      title: '一定要争气',
      kind: '精读',
      renzi: '裕yù 差chā* 均jūn 资zī 欧ōu 洲zhōu 授shòu 项xiàng 验yàn 构gòu 耐nài 励lì',
      xiezi: '念niàn 差chā 考kǎo 试shì 均jūn 退tuì 努nǔ 单dān 留liú 度dù 奋fèn',
      words: [
        '生物', '从事', '成就', '学期', '考试', '平均', '再三', '同意', '难得',
        '值班', '努力', '满分', '国家', '地位', '环节', '难度', '刻苦', '兴奋',
      ],
    }),
    lesson(8, {
      no: 25,
      title: '手术台就是阵地',
      kind: '精读',
      renzi: '棒bàng 大dài* 血xuè 硝xiāo 危wēi 险xiǎn 势shì 瓦wǎ 帘lián 担dān* 迅xùn 速sù 夺duó 秒miǎo',
      xiezi: '棒bàng 伤shāng 陆lù 血xuè 取qǔ 盘pán 匆cōng 医yī 迅xùn 速sù 夺duó 秒miǎo',
      words: [
        '手术台', '阵地', '战斗', '打响', '当头一棒', '伤员', '陆续', '血丝',
        '匆匆', '医生', '转告', '赶忙', '迅速', '争分夺秒', '连续',
      ],
    }),
    lesson(8, {
      no: 26,
      title: '一个粗瓷大碗',
      kind: '略读',
      renzi: '瓷cí 赵zhào 抗kàng 束shù 缸gāng 还huán* 顿dùn 灶zào 沾zhān 禁jìn* 锅guō 侦zhēn',
      note: '略读课只有识字表，无词语表条目。',
    }),
  ],
  availableTypes: [...WORD_TYPES],
  garden: {
    label: '语文园地八',
    items: [
      '士不可以不弘毅，任重而道远。——《论语》',
      '志不强者智不达，言不信者行不果。——《墨子》',
      '锲而舍之，朽木不折；锲而不舍，金石可镂。——《荀子》',
    ],
    words: ['怒目圆睁', '眨眼', '眼眶', '目瞪口呆', '耳闻目睹'].map((word) => wv(word)),
    status: 'verified',
    sources: [gardenSource('107')],
  },
  writing: { label: '习作：那次经历真难忘', status: 'verified', sources: [SRC_TOC] },
  oral: { label: '口语交际：请教', status: 'verified' },
}

export const CHINESE_CURRICULUM_3A: ChineseCurriculum = {
  subject: 'chinese',
  grade: '3A',
  edition: '人教社统编·五·四学制 2025 年秋',
  source: 'docs/语文三上练习方案-0.7.0.md',
  units: [U1, U2, U3, U4, U5, U6, U7, U8],
}

export const chineseUnits = CHINESE_CURRICULUM_3A.units

export function findChineseUnit(unitId: string): ChineseUnit | undefined {
  return chineseUnits.find((unit) => unit.unitId === unitId)
}

export function findChineseLesson(lessonId: string): ChineseLesson | undefined {
  for (const unit of chineseUnits) {
    const hit = unit.lessons.find((item) => item.lessonId === lessonId)
    if (hit) return hit
  }
  return undefined
}

/** 按 verified 条目统计；园地词语与古诗一并计入 words，保持旧统计口径 */
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
  for (const item of unit.lessons) {
    for (const c of item.xiezi) c.status === 'verified' ? xiezi++ : pending++
    for (const c of item.renzi) c.status === 'verified' ? renzi++ : pending++
    for (const word of item.words) word.status === 'verified' ? words++ : pending++
    for (const poem of item.poems ?? []) poem.status === 'verified' ? words++ : pending++
  }
  for (const word of unit.garden?.words ?? []) word.status === 'verified' ? words++ : pending++
  for (const poem of unit.garden?.poems ?? []) poem.status === 'verified' ? words++ : pending++
  return { xiezi, renzi, words, pending }
}

export const LEVELS: ChineseLevel[] = ['A', 'B', 'C']
export type { ChineseLevel, VerifyStatus }
