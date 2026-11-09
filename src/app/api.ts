import { invoke } from '@tauri-apps/api/core'
import type { CatalogJob, CatalogSnapshot } from './catalog'
import type {
  LinkBatchSummary,
  WechatListSummary,
  WechatLoginState,
  WechatResolved,
} from './wechat'
import type { AppConfig, GenerateResult, TemplateInfo, TypstInfo } from './types'

export const isTauri = '__TAURI_INTERNALS__' in window

export interface ConfigLoadResult {
  config: Partial<AppConfig>
  /** 备份回落 / 损坏重建时给家长看的提示 */
  notice?: string
  /** 实际采用的备份路径 */
  recoveredFrom?: string
}

export async function loadConfig(): Promise<ConfigLoadResult> {
  return invoke<ConfigLoadResult>('load_config')
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke('save_config', { config })
}

/** 导出设置到指定 JSON 文件，返回实际写入路径 */
export async function exportConfig(path: string, config: AppConfig): Promise<string> {
  return invoke<string>('export_config', { path, config })
}

/** 导入设置：非法文件会被后端拒绝，当前配置不受影响 */
export async function importConfig(path: string): Promise<Partial<AppConfig>> {
  return invoke<Partial<AppConfig>>('import_config', { path })
}

export async function checkTypst(typstPath: string): Promise<TypstInfo> {
  return invoke<TypstInfo>('check_typst', { typstPath: typstPath || null })
}

export async function getTemplateInfo(): Promise<TemplateInfo> {
  return invoke<TemplateInfo>('template_info')
}

export async function generatePaper(
  data: unknown,
  typstPath: string,
  template?: string,
  saveTo?: string,
): Promise<GenerateResult> {
  return invoke<GenerateResult>('generate_paper', {
    data,
    typstPath: typstPath || null,
    template: template || null,
    saveTo: saveTo || null,
  })
}

export async function savePdfAs(src: string, dest: string): Promise<string> {
  return invoke<string>('save_pdf_as', { src, dest })
}

export async function openPdf(path: string): Promise<void> {
  await invoke('open_pdf', { path })
}

/** 只读 data/reading-catalog/ 的现状快照（开发者工具用） */
export async function readCatalogSnapshot(): Promise<CatalogSnapshot> {
  return invoke<CatalogSnapshot>('read_catalog_snapshot')
}

/** 写入任务单，返回实际文件路径 */
export async function createCatalogJob(job: CatalogJob): Promise<string> {
  return invoke<string>('create_catalog_job', { id: job.id, job })
}

/** 打开公众号后台登录窗口（登录态只存在 webview 会话里） */
export async function openWechatLogin(): Promise<void> {
  await invoke('open_wechat_login')
}

/** 查询登录窗口是否打开、是否已扫码登录；不含任何凭证 */
export async function wechatLoginState(): Promise<WechatLoginState> {
  return invoke<WechatLoginState>('wechat_login_state')
}

/** 实际打开分享链/短链取回页面，解析出账号标识、文章标题与账号名 */
export async function resolveWechatShareLink(url: string): Promise<WechatResolved> {
  return invoke<WechatResolved>('resolve_wechat_share_link', { url })
}

/** 第一段：用登录窗口里的会话串行翻页，只抓文章列表 */
export async function crawlWechatArticleList(
  biz: string,
  accountName: string | null,
): Promise<WechatListSummary> {
  return invoke<WechatListSummary>('crawl_wechat_article_list', { biz, accountName })
}

/** 批量链接：串行 curl 取正文，走现有 intake 入库；返回成功/跳过/失败统计 */
export async function crawlWechatLinksBatch(
  links: string,
  intextMin: number,
  intextMax: number,
  extraMin: number,
  extraMax: number,
): Promise<LinkBatchSummary> {
  return invoke<LinkBatchSummary>('crawl_wechat_links_batch', {
    links,
    intextMin,
    intextMax,
    extraMin,
    extraMax,
  })
}

export function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return String(error)
}
