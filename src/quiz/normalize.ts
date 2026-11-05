/** 跨卷记忆键的规范化：全部题型共用一套写法，保证同一道题在不同生成路径下得到同一个键。 */

/** 算式规范化：去空白、统一运算符（\times/×/* → *，\div/÷ → /） */
export function normalizeExpr(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/\\times|\btimes\b|×/g, '*')
    .replace(/\\div|\bdiv\b|÷/g, '/')
    .replace(/\\cdot|\bdot\b|·/g, '*')
}

/** 文本规范化：去掉所有空白，用于题干 / 表达式的逐字比较 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, '')
}

/** 稳定序列化：对象键排序，保证同一规格得到同一字符串 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

/** 32 位 FNV-1a 哈希，用于把大段图形规格压成短键 */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
