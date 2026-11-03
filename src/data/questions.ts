import type { Question, Unit } from '../types.ts'

/**
 * 单元目录（沪教版五四学制 2024 修订版）。
 * 三年级上册为 2026 秋启用的新版结构；
 * 三年级下册（2027 春首用）公开目录未发布，以下为按旧版结构的推定，待校准。
 */
export const UNITS: Unit[] = [
  { id: '3A-U1', grade: '3A', name: '两步四则运算与应用' },
  { id: '3A-U2', grade: '3A', name: '用一位数乘' },
  { id: '3A-U3', grade: '3A', name: '用一位数除' },
  { id: '3A-U4', grade: '3A', name: '年、月、日' },
  { id: '3A-U5', grade: '3A', name: '周长' },
  { id: '3B-U1', grade: '3B', name: '两位数乘除（推定）', inferred: true },
  { id: '3B-U2', grade: '3B', name: '分数的初步认识（推定）', inferred: true },
  { id: '3B-U3', grade: '3B', name: '面积（推定）', inferred: true },
]

const U = (id: string) => UNITS.find((u) => u.id === id)!

/** P0 静态样例题，共 40 题。非出题引擎，仅用于版式验证。 */
export const QUESTIONS: Question[] = [
  // ================= 三年级上册 =================
  // ---- U1 两步四则运算与应用 ----
  {
    id: '3A-U1-T1', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'tuoshi', latex: '72 - 36 \\div 4', answer: '72 - 9 = 63', answerLines: ['72 - 36 \\div 4', '= 72 - 9', '= 63'],
  },
  {
    id: '3A-U1-T2', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'tuoshi', latex: '6 \\times 8 + 15', answer: '48 + 15 = 63', answerLines: ['6 \\times 8 + 15', '= 48 + 15', '= 63'],
  },
  {
    id: '3A-U1-T3', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'tuoshi', latex: '(100 - 28) \\div 8', answer: '72 ÷ 8 = 9', answerLines: ['(100 - 28) \\div 8', '= 72 \\div 8', '= 9'],
  },
  {
    id: '3A-U1-T4', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'tuoshi', latex: '54 \\div 6 \\times 7', answer: '9 × 7 = 63', answerLines: ['54 \\div 6 \\times 7', '= 9 \\times 7', '= 63'],
  },
  {
    id: '3A-U1-K1', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'kousuan', latex: '45 + 8 \\times 5 =', answer: '85',
  },
  {
    id: '3A-U1-K2', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'kousuan', latex: '81 \\div 9 - 6 =', answer: '3',
  },
  {
    id: '3A-U1-F1', grade: '3A', unitId: '3A-U1', unitName: U('3A-U1').name,
    type: 'tiankong',
    text: '在没有括号的算式里，既有乘除法又有加减法，要先算______法，再算______法。',
    answer: '乘除；加减',
  },

  // ---- U2 用一位数乘 ----
  {
    id: '3A-U2-K1', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'kousuan', latex: '30 \\times 6 =', answer: '180',
  },
  {
    id: '3A-U2-K2', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'kousuan', latex: '400 \\times 5 =', answer: '2000',
  },
  {
    id: '3A-U2-K3', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'kousuan', latex: '12 \\times 4 =', answer: '48',
  },
  {
    id: '3A-U2-C1', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'chushi', operands: [234, 3], op: 'mul', answer: '702',
  },
  {
    id: '3A-U2-C2', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'chushi', operands: [406, 7], op: 'mul', answer: '2842',
  },
  {
    id: '3A-U2-C3', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'chushi', operands: [68, 5], op: 'mul', answer: '340',
  },
  {
    id: '3A-U2-J1', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'jianbian', latex: '25 \\times 7 \\times 4', answer: '25 × 4 × 7 = 100 × 7 = 700', answerLines: ['25 \\times 7 \\times 4', '= 100 \\times 7', '= 700'],
  },
  {
    id: '3A-U2-F1', grade: '3A', unitId: '3A-U2', unitName: U('3A-U2').name,
    type: 'tiankong',
    text: '口算 $200 \\times 3$ 时，可以先算 $2 \\times 3 = $\\ ______，再在积的末尾添上______个 0。',
    answer: '6；2',
  },

  // ---- U3 用一位数除 ----
  {
    id: '3A-U3-K1', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'kousuan', latex: '240 \\div 6 =', answer: '40',
  },
  {
    id: '3A-U3-K2', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'kousuan', latex: '96 \\div 3 =', answer: '32',
  },
  {
    id: '3A-U3-K3', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'kousuan', latex: '720 \\div 8 =', answer: '90',
  },
  {
    id: '3A-U3-C1', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'chushi', operands: [96, 4], op: 'div', answer: '24',
  },
  {
    id: '3A-U3-C2', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'chushi', operands: [705, 5], op: 'div', answer: '141',
  },
  {
    id: '3A-U3-C3', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'chushi', operands: [847, 7], op: 'div', answer: '121',
  },
  {
    id: '3A-U3-F1', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'tiankong',
    text: '$612 \\div 3$ 的商是______位数，最高位在______位上。',
    answer: '三；百',
  },
  {
    id: '3A-U3-F2', grade: '3A', unitId: '3A-U3', unitName: U('3A-U3').name,
    type: 'tiankong',
    text: '在除法算式里，余数必须比除数______。',
    answer: '小',
  },

  // ---- U4 年、月、日 ----
  {
    id: '3A-U4-F1', grade: '3A', unitId: '3A-U4', unitName: U('3A-U4').name,
    type: 'tiankong',
    text: '一年有______个月，其中大月有______个，每月有______天。',
    answer: '12；7；31',
  },
  {
    id: '3A-U4-F2', grade: '3A', unitId: '3A-U4', unitName: U('3A-U4').name,
    type: 'tiankong',
    text: '平年全年有______天，闰年全年有______天。',
    answer: '365；366',
  },
  {
    id: '3A-U4-F3', grade: '3A', unitId: '3A-U4', unitName: U('3A-U4').name,
    type: 'tiankong',
    text: '2026 年是______年（填“平”或“闰”），2 月有______天。',
    answer: '平；28',
  },
  {
    id: '3A-U4-T1', grade: '3A', unitId: '3A-U4', unitName: U('3A-U4').name,
    type: 'tuoshi', latex: '31 \\times 7 + 30 \\times 4 + 28', answer: '217 + 120 + 28 = 365', answerLines: ['31 \\times 7 + 30 \\times 4 + 28', '= 217 + 120 + 28', '= 365'],
  },
  {
    id: '3A-U4-F4', grade: '3A', unitId: '3A-U4', unitName: U('3A-U4').name,
    type: 'tiankong',
    text: '一场电影从 14:30 开始，放映 95 分钟，结束时间是______时______分。',
    answer: '16；5',
  },

  // ---- U5 周长 ----
  {
    id: '3A-U5-F1', grade: '3A', unitId: '3A-U5', unitName: U('3A-U5').name,
    type: 'tiankong',
    text: '长方形的长是 8 厘米，宽是 5 厘米，周长是______厘米。',
    answer: '26',
  },
  {
    id: '3A-U5-F2', grade: '3A', unitId: '3A-U5', unitName: U('3A-U5').name,
    type: 'tiankong',
    text: '正方形的边长是 6 分米，周长是______分米。',
    answer: '24',
  },
  {
    id: '3A-U5-T1', grade: '3A', unitId: '3A-U5', unitName: U('3A-U5').name,
    type: 'tuoshi', latex: '(12 + 8) \\times 2', answer: '20 × 2 = 40', answerLines: ['(12 + 8) \\times 2', '= 20 \\times 2', '= 40'],
  },
  {
    id: '3A-U5-F3', grade: '3A', unitId: '3A-U5', unitName: U('3A-U5').name,
    type: 'tiankong',
    text: '一根绳子长 36 厘米，正好围成一个正方形，这个正方形的边长是______厘米。',
    answer: '9',
  },

  // ================= 三年级下册（推定结构，待校准） =================
  // ---- U1 两位数乘除（推定） ----
  {
    id: '3B-U1-C1', grade: '3B', unitId: '3B-U1', unitName: U('3B-U1').name,
    type: 'chushi', operands: [23, 12], op: 'mul', answer: '276',
  },
  {
    id: '3B-U1-C2', grade: '3B', unitId: '3B-U1', unitName: U('3B-U1').name,
    type: 'chushi', operands: [45, 24], op: 'mul', answer: '1080',
  },
  {
    id: '3B-U1-K1', grade: '3B', unitId: '3B-U1', unitName: U('3B-U1').name,
    type: 'kousuan', latex: '13 \\times 30 =', answer: '390',
  },
  {
    id: '3B-U1-K2', grade: '3B', unitId: '3B-U1', unitName: U('3B-U1').name,
    type: 'kousuan', latex: '480 \\div 12 =', answer: '40',
  },
  {
    id: '3B-U1-J1', grade: '3B', unitId: '3B-U1', unitName: U('3B-U1').name,
    type: 'jianbian', latex: '12 \\times 25', answer: '3 × (4 × 25) = 3 × 100 = 300', answerLines: ['12 \\times 25', '= 3 \\times 100', '= 300'],
  },

  // ---- U2 分数的初步认识（推定） ----
  {
    id: '3B-U2-F1', grade: '3B', unitId: '3B-U2', unitName: U('3B-U2').name,
    type: 'tiankong',
    text: '把 1 米长的绳子平均分成 8 段，每段长______米（填分数），3 段长______米。',
    answer: '$\\frac{1}{8}$；$\\frac{3}{8}$',
  },
  {
    id: '3B-U2-K1', grade: '3B', unitId: '3B-U2', unitName: U('3B-U2').name,
    type: 'kousuan', latex: '\\frac{2}{7} + \\frac{3}{7} =', answer: '$\\frac{5}{7}$',
  },
  {
    id: '3B-U2-K2', grade: '3B', unitId: '3B-U2', unitName: U('3B-U2').name,
    type: 'kousuan', latex: '\\frac{7}{9} - \\frac{2}{9} =', answer: '$\\frac{5}{9}$',
  },

  // ---- U3 面积（推定） ----
  {
    id: '3B-U3-F1', grade: '3B', unitId: '3B-U3', unitName: U('3B-U3').name,
    type: 'tiankong',
    text: '长方形的面积 = ______ $\\times$ ______；边长为 5 厘米的正方形，面积是______平方厘米。',
    answer: '长；宽；25',
  },
  {
    id: '3B-U3-F2', grade: '3B', unitId: '3B-U3', unitName: U('3B-U3').name,
    type: 'tiankong',
    text: '1 平方米 = ______平方分米；1 平方分米 = ______平方厘米。',
    answer: '100；100',
  },
]
