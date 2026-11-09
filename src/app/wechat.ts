/**
 * 公众号导出：链接解析等纯逻辑。
 * 登录态、抓取都由 Rust 侧处理，这里不碰任何凭证。
 */

export interface WechatArticleRef {
  /** 公众号账号标识（与应用内 fakeid 一致） */
  biz: string
  mid: string | null
  idx: string | null
}

export type WechatUrlResult =
  | { ok: true; kind: 'biz'; ref: WechatArticleRef }
  /** 分享链 / 短链：链接本身不带 __biz，需要实际打开页面取回账号标识 */
  | { ok: true; kind: 'resolve'; url: string }
  | { ok: false; reason: string }

/** 登录窗口状态；不含 cookie/token */
export interface WechatLoginState {
  open: boolean
  loggedIn: boolean
}

/** 实际打开分享链后解析出的账号信息 */
export interface WechatResolved {
  biz: string
  title: string | null
  accountName: string | null
}

/** 文章清单里的一条（第一段只取标题/日期/链接） */
export interface WechatArticleRow {
  title: string
  link: string
  publishedAt: number | null
}

/** 第一段抓取结果 */
export interface WechatListSummary {
  total: number
  pages: number
  nextOffset: number
  canContinue: boolean
  stoppedReason: string | null
  indexPath: string
}

/** 批量链接：失败原因分布的一项 */
export interface LinkBatchReason {
  reason: string
  count: number
}

/** 批量链接一次抓取的汇总；逐条明细在 report.json 里 */
export interface LinkBatchSummary {
  batch: string
  reportPath: string
  total: number
  success: number
  skipped: number
  failed: number
  imported: number
  pendingQuestions: number
  /** 合集：已切分原文数、切出单元数、字数/分段合格数、完整过 gate 数 */
  splitArticles: number
  splitUnits: number
  splitWordPassed: number
  splitPassed: number
  needsSplit: number
  failReasons: LinkBatchReason[]
}

/** 批量链接输入：一行一条，去掉空行、注释与重复项 */
export function splitWechatLinkLines(text: string): string[] {
  const links: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    if (!links.includes(value)) links.push(value)
  }
  return links
}

/** 从任意一篇公众号文章链接里取 __biz；分享链则标记为需要实际打开解析 */
export function parseWechatArticleUrl(raw: string): WechatUrlResult {
  const text = raw.trim()
  if (!text) return { ok: false, reason: '请先粘贴文章链接' }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { ok: false, reason: '链接格式不正确' }
  }

  if (url.hostname !== 'mp.weixin.qq.com') {
    return { ok: false, reason: '请粘贴 mp.weixin.qq.com 的公众号文章链接' }
  }

  const biz = (url.searchParams.get('__biz') ?? '').trim()
  if (biz) {
    // 只认标准公众号 __biz（Mz 开头的 base64）；170001 之类的统计参数一律拒绝
    if (!/^Mz[A-Za-z0-9+/]{6,}={0,2}$/.test(biz)) {
      return { ok: false, reason: '账号标识格式不正确（应为 Mz… 形式的 __biz），请重新复制链接' }
    }
    return {
      ok: true,
      kind: 'biz',
      ref: {
        biz,
        mid: url.searchParams.get('mid'),
        idx: url.searchParams.get('idx'),
      },
    }
  }

  // /s/xxxx 短链、src=11 分享链都没有 __biz，交给 Rust 实际打开页面解析
  return { ok: true, kind: 'resolve', url: url.toString() }
}

/** 目录名安全化：__biz 是 base64，可能带 / + = 等字符 */
export function safeBizDirName(biz: string): string {
  const name = biz.replace(/[/\\:*?"<>|]/g, '_').trim()
  return name || 'unknown-biz'
}

/** 解析失败原因转成界面文案；签名过期单独提示，不当作解析失败 */
export function wechatResolveErrorText(reason: string): string {
  const text = reason.trim()
  if (/过期|参数错误|参数无效/.test(text)) {
    return '该条链接已过期，请换一条或粘贴新链接'
  }
  return `解析失败：${text}`
}
