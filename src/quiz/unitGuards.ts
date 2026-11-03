/**
 * 单元级禁算符 / 禁语义检查。
 *
 * 教材顺序是硬约束：某个单元尚未学到除法，就不允许生成器“碰巧”出到除法。
 * 这里把约束写成可执行的自检，命中即判生成失败，而不是靠人工抽查。
 */
const UNIT_BANNED_TOKENS: Record<string, string[]> = {
  // 3A-U1 在 3A-U4《用一位数除》之前：只允许加减乘两步/三步与带括号的组合，
  // 不得出现除法，也不得出现隐含余数分配的表述（……／余）。
  '3A-U1': ['\\div', '÷', '……', '余'],
}

/** 返回 null 表示未命中禁用词；否则返回命中原因 */
export function unitGuardProblem(unitId: string, texts: (string | undefined | null)[]): string | null {
  const banned = UNIT_BANNED_TOKENS[unitId]
  if (!banned) return null
  for (const text of texts) {
    if (!text) continue
    const hit = banned.find((token) => text.includes(token))
    if (hit) return `${unitId} 出现禁用运算符/语义「${hit}」：${text.slice(0, 60)}`
  }
  return null
}
