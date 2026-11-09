import { invoke } from '@tauri-apps/api/core'
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
): Promise<GenerateResult> {
  return invoke<GenerateResult>('generate_paper', {
    data,
    typstPath: typstPath || null,
    template: template || null,
  })
}

export async function savePdfAs(src: string, dest: string): Promise<string> {
  return invoke<string>('save_pdf_as', { src, dest })
}

export async function openPdf(path: string): Promise<void> {
  await invoke('open_pdf', { path })
}

export function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return String(error)
}
