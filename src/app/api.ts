import { invoke } from '@tauri-apps/api/core'
import type { AppConfig, GenerateResult, TemplateInfo, TypstInfo } from './types'

export const isTauri = '__TAURI_INTERNALS__' in window

export async function loadConfig(): Promise<Partial<AppConfig>> {
  return invoke<Partial<AppConfig>>('load_config')
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke('save_config', { config })
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
): Promise<GenerateResult> {
  return invoke<GenerateResult>('generate_paper', {
    data,
    typstPath: typstPath || null,
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
