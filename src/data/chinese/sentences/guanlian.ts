import type { GuanlianItem } from '../types.ts'
import { padId, sentenceSource } from './common.ts'

type RawGuanlian = Omit<GuanlianItem, 'id' | 'kind' | 'status' | 'sources' | 'explain'> & {
  explanation: string
}

/** 允许出现在答案里的关联词，防止混入超纲词 */
export const GUANLIAN_WORDS = [
  '因为', '由于', '所以', '因此',
  '虽然', '尽管', '但是', '可是', '还是',
  '如果', '要是', '就', '便',
  '只要', '只有', '才',
  '不但', '不仅', '而且', '还',
  '既', '又',
  '先', '再',
  '一边',
  '不是', '而是',
  '一',
] as const

const RAW: RawGuanlian[] = [
  // ---------- A ----------
  {
    level: 'A',
    text: '（ ）今天下雨，（ ）运动会推迟了。',
    blanks: [['因为'], ['所以']],
    pair: '因为……所以……',
    explanation: '前后是原因和结果的关系，用“因为……所以……”。',
  },
  {
    level: 'A',
    text: '（ ）小明生病了，（ ）今天没来上学。',
    blanks: [['因为'], ['所以']],
    pair: '因为……所以……',
    explanation: '前一句说原因，后一句说结果。',
  },
  {
    level: 'A',
    text: '（ ）天气很冷，（ ）同学们仍然坚持锻炼。',
    blanks: [['虽然'], ['但是']],
    pair: '虽然……但是……',
    explanation: '前后意思相反，用表示转折的“虽然……但是……”。',
  },
  {
    level: 'A',
    text: '（ ）这道题很难，（ ）我还是做出来了。',
    blanks: [['虽然'], ['但是']],
    pair: '虽然……但是……',
    explanation: '“题难”和“做出来”意思相反，要用转折关系。',
  },
  {
    level: 'A',
    text: '（ ）明天不下雨，我们（ ）去公园。',
    blanks: [['如果'], ['就']],
    pair: '如果……就……',
    explanation: '前一句提出一种情况，后一句说这种情况下的结果。',
  },
  {
    level: 'A',
    text: '（ ）你认真学习，（ ）会取得好成绩。',
    blanks: [['如果'], ['就']],
    pair: '如果……就……',
    explanation: '“认真学习”是条件，“取得好成绩”是结果。',
  },
  {
    level: 'A',
    text: '妈妈（ ）做饭，（ ）听广播。',
    blanks: [['一边'], ['一边']],
    pair: '一边……一边……',
    explanation: '两个动作同时进行，用“一边……一边……”。',
  },
  {
    level: 'A',
    text: '小明（ ）走路，（ ）想着刚才的题目。',
    blanks: [['一边'], ['一边']],
    pair: '一边……一边……',
    explanation: '走路和想题目同时发生。',
  },
  {
    level: 'A',
    text: '我们（ ）洗手，（ ）吃饭。',
    blanks: [['先'], ['再']],
    pair: '先……再……',
    explanation: '两个动作有先后顺序，先洗手，后吃饭。',
  },
  {
    level: 'A',
    text: '请你（ ）把书看完，（ ）把书放回书架。',
    blanks: [['先'], ['再']],
    pair: '先……再……',
    explanation: '看完书以后才放回书架，顺序不能反。',
  },
  {
    level: 'A',
    text: '他（ ）会唱歌，（ ）会跳舞。',
    blanks: [['不但'], ['而且']],
    pair: '不但……而且……',
    explanation: '两样本领都有，而且后一项更进一层。',
  },
  {
    level: 'A',
    text: '这本书（ ）有趣，（ ）让我们懂得很多道理。',
    blanks: [['不但'], ['而且']],
    pair: '不但……而且……',
    explanation: '先说有趣，再说更有意义的方面，意思更进一层。',
  },

  // ---------- B ----------
  {
    level: 'B',
    text: '（ ）路面结冰了，（ ）汽车开得很慢。',
    blanks: [['因为', '由于'], ['所以', '因此']],
    pair: '因为……所以……',
    explanation: '结冰是原因，开得慢是结果；两组关联词都成立。',
  },
  {
    level: 'B',
    text: '爸爸（ ）工作很忙，（ ）每天陪我读书。',
    blanks: [['虽然', '尽管'], ['但是', '还是']],
    pair: '虽然……但是……',
    explanation: '“忙”和“陪我读书”相反，用转折关系。',
  },
  {
    level: 'B',
    text: '（ ）你遇到困难，（ ）来问我。',
    blanks: [['如果', '要是'], ['就', '便']],
    pair: '如果……就……',
    explanation: '前一句假设一种情况，后一句说可以怎么做。',
  },
  {
    level: 'B',
    text: '（ ）多读多练，（ ）能把作文写好。',
    blanks: [['只要'], ['就']],
    pair: '只要……就……',
    explanation: '“多读多练”是条件，做到这一点就能写好作文。',
  },
  {
    level: 'B',
    text: '（ ）坚持锻炼，身体（ ）会越来越棒。',
    blanks: [['只要'], ['就']],
    pair: '只要……就……',
    explanation: '坚持锻炼是条件，身体变棒是结果。',
  },
  {
    level: 'B',
    text: '（ ）认真观察，（ ）能发现大自然的美。',
    blanks: [['只有'], ['才']],
    pair: '只有……才……',
    explanation: '“认真观察”是必要条件，不这样做就发现不了。',
  },
  {
    level: 'B',
    text: '（ ）付出努力，（ ）会有收获。',
    blanks: [['只有'], ['才']],
    pair: '只有……才……',
    explanation: '付出努力是取得收获的必要条件。',
  },
  {
    level: 'B',
    text: '这个书包（ ）结实，（ ）轻便。',
    blanks: [['既'], ['又']],
    pair: '既……又……',
    explanation: '结实和轻便两个特点同时具备。',
  },
  {
    level: 'B',
    text: '妹妹（ ）会画画，（ ）会弹琴。',
    blanks: [['既'], ['又']],
    pair: '既……又……',
    explanation: '画画和弹琴两样本领同时具备。',
  },
  {
    level: 'B',
    text: '这本书（ ）我的，（ ）小刚的。',
    blanks: [['不是'], ['而是']],
    pair: '不是……而是……',
    explanation: '先否定一种说法，再说明真实情况。',
  },
  {
    level: 'B',
    text: '他（ ）在生气，（ ）在思考问题。',
    blanks: [['不是'], ['而是']],
    pair: '不是……而是……',
    explanation: '先排除“生气”，再说明他其实在思考。',
  },
  {
    level: 'B',
    text: '小明（ ）回到家，（ ）开始写作业。',
    blanks: [['一'], ['就']],
    pair: '一……就……',
    explanation: '回到家以后马上写作业，两个动作紧接着发生。',
  },

  // ---------- C ----------
  {
    level: 'C',
    text: '（ ）明天下大雨，我们的比赛（ ）要改期。',
    blanks: [['如果', '要是'], ['就', '便']],
    pair: '如果……就……',
    explanation: '下大雨是假设的情况，比赛改期是结果。',
  },
  {
    level: 'C',
    text: '（ ）小树得到了阳光和水分，（ ）长得越来越茂盛。',
    blanks: [['因为', '由于'], ['所以', '因此']],
    pair: '因为……所以……',
    explanation: '阳光和水分是原因，长得茂盛是结果。',
  },
  {
    level: 'C',
    text: '（ ）奶奶年纪大了，（ ）她的手还是很巧。',
    blanks: [['虽然', '尽管'], ['但是', '可是']],
    pair: '虽然……但是……',
    explanation: '年纪大和手很巧形成对比，用转折关系。',
  },
  {
    level: 'C',
    text: '这座桥（ ）坚固，（ ）美观。',
    blanks: [['不但', '不仅'], ['而且', '还']],
    pair: '不但……而且……',
    explanation: '坚固之外还有美观，后一项更进一层。',
  },
  {
    level: 'C',
    text: '（ ）亲自去看一看，（ ）知道那里的风景有多美。',
    blanks: [['只有'], ['才']],
    pair: '只有……才……',
    explanation: '亲自去看是知道风景美的必要条件。',
  },
  {
    level: 'C',
    text: '（ ）我们团结一心，（ ）没有克服不了的困难。',
    blanks: [['只要'], ['就']],
    pair: '只要……就……',
    explanation: '团结一心是条件，能克服困难是结果。',
  },
  {
    level: 'C',
    text: '这间教室（ ）宽敞，（ ）明亮。',
    blanks: [['既'], ['又']],
    pair: '既……又……',
    explanation: '宽敞和明亮两个特点同时具备。',
  },
  {
    level: 'C',
    text: '做实验时，我们（ ）看清要求，（ ）动手操作。',
    blanks: [['先'], ['再']],
    pair: '先……再……',
    explanation: '看清要求在前，动手操作在后。',
  },
  {
    level: 'C',
    text: '爷爷（ ）散步，（ ）给我讲过去的故事。',
    blanks: [['一边'], ['一边']],
    pair: '一边……一边……',
    explanation: '散步和讲故事同时进行。',
  },
  {
    level: 'C',
    text: '这件事（ ）他做的，（ ）我做的。',
    blanks: [['不是'], ['而是']],
    pair: '不是……而是……',
    explanation: '先否定是他做的，再说明是我做的。',
  },
  {
    level: 'C',
    text: '春天（ ）到，小草（ ）探出头来。',
    blanks: [['一'], ['就']],
    pair: '一……就……',
    explanation: '春天刚到，小草马上探出头，两个动作紧接着发生。',
  },
  {
    level: 'C',
    text: '（ ）你想得到别人的帮助，（ ）先学会帮助别人。',
    blanks: [['如果', '要是'], ['就', '便']],
    pair: '如果……就……',
    explanation: '前一句提出愿望，后一句说应该怎样做。',
  },
]

export const GUANLIAN_ITEMS: GuanlianItem[] = RAW.map(({ explanation, ...item }, index) => ({
  ...item,
  id: padId('GL', index),
  kind: 'guanlian',
  status: 'verified',
  sources: sentenceSource(padId('GL', index)),
  explain: explanation,
}))
