use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::webview::Cookie;
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};

const TYPST_DATA_ARG: &str = "/.quizlab/paper-data.json";
/// 设置备份保留份数：config.bak.1 最新，config.bak.3 最旧
const CONFIG_BACKUPS: usize = 3;
/// 旧版运行时目录，仅用于首次启动迁移
const LEGACY_RUNTIME_DIR: &str = ".leomath";
/// 随包字体目录：Typst 不会自动扫描项目字体，必须显式传入
const TYPST_FONT_DIR: &str = "typst/fonts";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TypstInfo {
    path: String,
    version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TemplateInfo {
    path: String,
    exists: bool,
    /// 当前模板是否已实现这些题型（用于前端提示，不修改模板）
    word: bool,
    compare: bool,
    geom: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutCheck {
    /// 校验是否通过（脚本缺失/无法执行时无意义）
    ok: bool,
    /// 未执行（脚本或 python3 缺失）
    skipped: bool,
    elapsed_ms: u64,
    /// 脚本原始输出（通过也保留，便于排查）
    output: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateResult {
    output_path: String,
    /// 另存到用户目录后的实际路径；未指定保存位置时为 null
    saved_path: Option<String>,
    data_path: String,
    elapsed_ms: u64,
    bytes: usize,
    pdf_base64: String,
    typst_path: String,
    typst_version: String,
    /// typst 输出的 warning 原文（逐条）
    warnings: Vec<String>,
    /// 是否出现 unknown font family（字体回退）
    font_fallback: bool,
    layout: LayoutCheck,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogJobFile {
    name: String,
    raw: String,
}

/// 阅读素材库快照：只读 data/reading-catalog/，原文交给前端容错解析
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogSnapshot {
    dir: String,
    sources_raw: Option<String>,
    items_raw: Option<String>,
    jobs: Vec<CatalogJobFile>,
    errors: Vec<String>,
}

/// 登录态只在本次运行内有效；这里只回布尔值，不回显任何凭证
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatLoginState {
    open: bool,
    logged_in: bool,
}

/// 分享链实际打开后解析出的账号信息；不含最终 URL、cookie 等
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatResolved {
    biz: String,
    title: Option<String>,
    account_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigLoad {
    config: Value,
    /// 备份回落 / 重建时给家长看的提示
    notice: Option<String>,
    /// 实际采用的备份路径，便于排查
    recovered_from: Option<String>,
}

// ---------- 路径 ----------

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.is_file()
        && path
            .metadata()
            .map(|m| m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

fn expand_home(raw: &str) -> PathBuf {
    if raw == "~" {
        return env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(raw));
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        if let Some(home) = env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(raw)
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;
    env::split_paths(&paths)
        .map(|dir| dir.join(name))
        .find(|candidate| is_executable(candidate))
}

fn is_project_root(path: &Path) -> bool {
    path.join("package.json").is_file() && path.join("typst/paper.typ").is_file()
}

fn project_root() -> Result<PathBuf, String> {
    let mut tried: Vec<String> = Vec::new();

    if let Some(root) = env::var_os("LEOMATH_ROOT") {
        let candidate = PathBuf::from(root);
        if is_project_root(&candidate) {
            return Ok(candidate);
        }
        tried.push(format!("LEOMATH_ROOT={}", candidate.display()));
    }

    // dev 构建时源码目录固定，优先使用编译期路径（发布版不依赖此路径）
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(parent) = manifest.parent() {
        if is_project_root(parent) {
            return Ok(parent.to_path_buf());
        }
        tried.push(parent.display().to_string());
    }

    let mut search_from = Vec::new();
    if let Ok(exe) = env::current_exe() {
        search_from.push(exe);
    }
    if let Ok(cwd) = env::current_dir() {
        search_from.push(cwd);
    }
    for start in search_from {
        for ancestor in start.ancestors() {
            if is_project_root(ancestor) {
                return Ok(ancestor.to_path_buf());
            }
        }
    }

    Err(format!(
        "找不到项目根目录（需要同时存在 package.json 和 typst/paper.typ）。已尝试：\n  - {}",
        tried.join("\n  - ")
    ))
}

/// 运行时目录：新版 .quizlab；首次启动时把旧的 .leomath 迁移过来
fn runtime_dir(root: &Path) -> PathBuf {
    let dir = root.join(".quizlab");
    let legacy = root.join(LEGACY_RUNTIME_DIR);
    if !dir.exists() && legacy.is_dir() {
        let _ = fs::rename(&legacy, &dir);
    }
    dir
}

fn resolve_typst(configured: Option<String>) -> Result<PathBuf, String> {
    let mut tried: Vec<String> = Vec::new();

    let mut candidates: Vec<String> = Vec::new();
    if let Some(configured) = configured {
        let value = configured.trim();
        if !value.is_empty() {
            candidates.push(value.to_string());
        }
    }
    candidates.push("/opt/homebrew/bin/typst".into());
    candidates.push("/usr/local/bin/typst".into());
    candidates.push("/opt/local/bin/typst".into());

    for raw in candidates {
        let path = expand_home(&raw);
        if raw.contains('/') || path.is_absolute() {
            if is_executable(&path) {
                return Ok(path);
            }
            tried.push(path.display().to_string());
        } else if let Some(found) = find_in_path(&raw) {
            return Ok(found);
        } else {
            tried.push(format!("PATH 中的 {raw}"));
        }
    }

    if let Some(found) = find_in_path("typst") {
        return Ok(found);
    }
    tried.push("PATH 中的 typst".into());

    Err(format!(
        "未找到可执行的 typst。已尝试：\n  - {}\n请在左侧「排版引擎」中填写 typst 的完整路径。",
        tried.join("\n  - ")
    ))
}

fn typst_version(typst: &Path) -> Result<String, String> {
    let output = Command::new(typst)
        .arg("--version")
        .output()
        .map_err(|e| format!("无法执行 {}：{e}", typst.display()))?;
    if !output.status.success() {
        return Err(format!(
            "{} --version 执行失败：\n{}",
            typst.display(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

// ---------- 编译后校验 ----------

/// 解析 python3：优先 PATH，再回退常见安装位置
fn resolve_python() -> Option<PathBuf> {
    for candidate in [
        "python3",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
    ] {
        let path = expand_home(candidate);
        if candidate.contains('/') {
            if is_executable(&path) {
                return Some(path);
            }
        } else if let Some(found) = find_in_path(candidate) {
            return Some(found);
        }
    }
    None
}

/// 从 typst 的 stdout/stderr 中提取 warning 原文
fn collect_warnings(stdout: &str, stderr: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    for line in stdout.lines().chain(stderr.lines()) {
        let trimmed = line.trim();
        if trimmed.starts_with("warning:") {
            warnings.push(trimmed.to_string());
        }
    }
    warnings
}

/// 运行 typst/check-layout.py --compact，返回版面校验结果
fn run_layout_check(root: &Path, pdf: &Path) -> LayoutCheck {
    let script = root.join("typst/check-layout.py");
    if !script.is_file() {
        return LayoutCheck {
            ok: false,
            skipped: true,
            elapsed_ms: 0,
            output: format!("未找到版面校验脚本：{}", script.display()),
        };
    }
    let python = match resolve_python() {
        Some(path) => path,
        None => {
            return LayoutCheck {
                ok: false,
                skipped: true,
                elapsed_ms: 0,
                output: "未找到 python3，跳过版面校验".to_string(),
            };
        }
    };

    let started = Instant::now();
    let output = Command::new(&python)
        .current_dir(root)
        .arg("typst/check-layout.py")
        .arg("--compact")
        .arg(pdf)
        .output();
    let elapsed_ms = started.elapsed().as_millis() as u64;

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let mut text = String::new();
            if !stdout.trim().is_empty() {
                text.push_str(stdout.trim());
            }
            if !stderr.trim().is_empty() {
                if !text.is_empty() {
                    text.push_str("\n\n");
                }
                text.push_str(stderr.trim());
            }
            LayoutCheck {
                ok: output.status.success(),
                skipped: false,
                elapsed_ms,
                output: text,
            }
        }
        Err(e) => LayoutCheck {
            ok: false,
            skipped: true,
            elapsed_ms,
            output: format!("无法执行版面校验（{}）：{e}", python.display()),
        },
    }
}

// ---------- 命令 ----------

#[tauri::command]
fn check_typst(typst_path: Option<String>) -> Result<TypstInfo, String> {
    let typst = resolve_typst(typst_path)?;
    let version = typst_version(&typst)?;
    Ok(TypstInfo {
        path: typst.display().to_string(),
        version,
    })
}

#[tauri::command]
fn template_info() -> Result<TemplateInfo, String> {
    let root = project_root()?;
    let path = root.join("typst/paper.typ");
    if !path.is_file() {
        return Ok(TemplateInfo {
            path: path.display().to_string(),
            exists: false,
            word: false,
            compare: false,
            geom: false,
        });
    }
    let source = fs::read_to_string(&path)
        .map_err(|e| format!("无法读取 {}：{e}", path.display()))?;
    Ok(TemplateInfo {
        path: path.display().to_string(),
        exists: true,
        word: source.contains("it.kind == \"word\""),
        compare: source.contains("it.kind == \"compare\""),
        geom: source.contains("it.kind == \"geom\""),
    })
}

/// 模板路径：默认数学卷 paper.typ；语文传 typst/chinese-paper-3a.typ。
/// 只允许项目内相对路径，拒绝绝对路径与 `..`。
fn resolve_template(root: &Path, template: Option<String>) -> Result<String, String> {
    let rel = template
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "typst/paper.typ".to_string());
    if Path::new(&rel).is_absolute() || rel.split('/').any(|part| part == "..") {
        return Err(format!("模板路径必须是项目内的相对路径：{rel}"));
    }
    let full = root.join(&rel);
    if !full.is_file() {
        return Err(format!("找不到排版模板：{}", full.display()));
    }
    Ok(rel)
}

#[tauri::command]
fn generate_paper(
    data: Value,
    typst_path: Option<String>,
    save_to: Option<String>,
    template: Option<String>,
) -> Result<GenerateResult, String> {
    let root = project_root()?;
    let typst = resolve_typst(typst_path)?;
    let version = typst_version(&typst)?;
    let template = resolve_template(&root, template)?;

    let runtime_dir = runtime_dir(&root);
    let out_dir = runtime_dir.join("out");
    fs::create_dir_all(&out_dir)
        .map_err(|e| format!("无法创建输出目录 {}：{e}", out_dir.display()))?;

    let data_path = runtime_dir.join("paper-data.json");
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("题目数据序列化失败：{e}"))?;
    fs::write(&data_path, json)
        .map_err(|e| format!("无法写入题目数据 {}：{e}", data_path.display()))?;

    let output_path = out_dir.join("paper.pdf");
    let _ = fs::remove_file(&output_path);

    let started = Instant::now();
    let output = Command::new(&typst)
        .current_dir(&root)
        .arg("compile")
        .arg("--root")
        .arg(".")
        .arg("--font-path")
        .arg(TYPST_FONT_DIR)
        .arg("--input")
        .arg(format!("data={TYPST_DATA_ARG}"))
        .arg("--input")
        .arg("body=14")
        .arg("--input")
        .arg("compact=1")
        .arg("--input")
        .arg("vert=26")
        .arg(&template)
        .arg(&output_path)
        .output()
        .map_err(|e| format!("无法启动 typst（{}）：{e}", typst.display()))?;
    let elapsed_ms = started.elapsed().as_millis() as u64;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let code = output
            .status
            .code()
            .map(|value| value.to_string())
            .unwrap_or_else(|| "被信号终止".to_string());
        let mut message = format!("typst 编译失败（退出码 {code}）\n\n{}", stderr.trim());
        if !stdout.trim().is_empty() {
            message.push_str(&format!("\n\nstdout:\n{}", stdout.trim()));
        }
        return Err(message);
    }

    if !output_path.is_file() {
        return Err("typst 返回成功，但没有生成 PDF 文件".to_string());
    }

    // 字体回退与一般 warning 都保留原文，交给界面显式提示
    let mut warnings = collect_warnings(&stdout, &stderr);
    if !root.join(TYPST_FONT_DIR).is_dir() {
        warnings.push(format!("字体目录不存在：{}", TYPST_FONT_DIR));
    }
    let font_fallback = warnings
        .iter()
        .any(|warning| warning.contains("unknown font family"));

    let layout = if template == "typst/paper.typ" {
        run_layout_check(&root, &output_path)
    } else {
        // check-layout.py 只认识数学卷的分栏与留白，语文卷不做这项校验
        LayoutCheck {
            ok: false,
            skipped: true,
            elapsed_ms: 0,
            output: format!("{template} 不是数学模板，跳过版面校验"),
        }
    };

    #[cfg(debug_assertions)]
    eprintln!(
        "[quizlab] 编译 {} ms · 版面校验 {} ms（ok={}, skipped={}）· warning {} 条 · 字体回退={}",
        elapsed_ms,
        layout.elapsed_ms,
        layout.ok,
        layout.skipped,
        warnings.len(),
        font_fallback
    );

    let mut saved_path = None;
    if let Some(dest) = save_to {
        let dest = expand_home(&dest);
        if dest != output_path {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
            }
            fs::copy(&output_path, &dest)
                .map_err(|e| format!("无法保存到 {}：{e}", dest.display()))?;
            saved_path = Some(dest.display().to_string());
        }
    }

    let bytes = fs::read(&output_path)
        .map_err(|e| format!("无法读取生成的 PDF {}：{e}", output_path.display()))?;
    let pdf_base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(GenerateResult {
        output_path: output_path.display().to_string(),
        saved_path,
        data_path: data_path.display().to_string(),
        elapsed_ms,
        bytes: bytes.len(),
        pdf_base64,
        typst_path: typst.display().to_string(),
        typst_version: version,
        warnings,
        font_fallback,
        layout,
    })
}

#[tauri::command]
fn save_pdf_as(src: String, dest: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    if !src_path.is_file() {
        return Err(format!("源 PDF 不存在：{src}"));
    }
    let dest_path = expand_home(&dest);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
    }
    fs::copy(&src_path, &dest_path)
        .map_err(|e| format!("保存失败（{}）：{e}", dest_path.display()))?;
    Ok(dest_path.display().to_string())
}

/// 用系统默认查看器打开 PDF；macOS 优先使用「预览」，便于直接打印
#[tauri::command]
fn open_pdf(path: String) -> Result<(), String> {
    let pdf = PathBuf::from(&path);
    if !pdf.is_file() {
        return Err(format!("PDF 不存在：{path}"));
    }

    #[cfg(target_os = "macos")]
    {
        let opened = Command::new("open")
            .arg("-a")
            .arg("Preview")
            .arg(&pdf)
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        if opened {
            return Ok(());
        }
    }

    let status = Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" })
        .arg(&pdf)
        .status()
        .map_err(|e| format!("无法打开 PDF：{e}"))?;
    if !status.success() {
        return Err(format!("系统查看器返回退出码 {:?}", status.code()));
    }
    Ok(())
}

/// 旧标识符 com.leomath.desktop 的配置，改名后首次启动自动复制
fn migrate_legacy_config(dir: &Path) {
    let target = dir.join("config.json");
    if target.is_file() {
        return;
    }
    let Some(parent) = dir.parent() else {
        return;
    };
    let legacy = parent.join("com.leomath.desktop").join("config.json");
    if !legacy.is_file() {
        return;
    }
    let _ = fs::create_dir_all(dir);
    let _ = fs::copy(&legacy, &target);
}

fn config_backup_path(dir: &Path, index: usize) -> PathBuf {
    dir.join(format!("config.bak.{index}"))
}

/// 损坏文件改名后缀；用毫秒时间戳，避免同一秒内多次恢复撞名
fn corrupt_stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

/// 设置必须是 JSON 对象；数组 / 字符串 / null 都属于非法文件
fn validate_config_value(value: &Value) -> Result<(), String> {
    if value.is_object() {
        Ok(())
    } else {
        Err("设置文件内容不是对象".to_string())
    }
}

/// 读取并校验设置文件；空文件、截断 JSON、非对象都返回错误，不抛 panic
fn read_config_file(path: &Path) -> Result<Value, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("无法读取 {}：{e}", path.display()))?;
    if raw.trim().is_empty() {
        return Err("设置文件为空".to_string());
    }
    let value: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("设置文件格式错误：{e}"))?;
    validate_config_value(&value)?;
    Ok(value)
}

/// 原子写：先写同目录临时文件，再 rename 覆盖，避免断电留下半个文件
fn write_text_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
    }
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "config.json".to_string());
    let tmp = path.with_file_name(format!(".{name}.tmp-{}", std::process::id()));
    fs::write(&tmp, content).map_err(|e| format!("无法写入临时文件 {}：{e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("无法保存 {}：{e}", path.display())
    })
}

/// 保存前滚动备份：config.bak.1 最新，最多 CONFIG_BACKUPS 份。
/// 当前文件已损坏（不是合法设置）时跳过滚动，保住更早的可用备份。
fn rotate_config_backups(dir: &Path) {
    let current = dir.join("config.json");
    if read_config_file(&current).is_err() {
        return;
    }
    let _ = fs::remove_file(config_backup_path(dir, CONFIG_BACKUPS));
    for index in (1..CONFIG_BACKUPS).rev() {
        let from = config_backup_path(dir, index);
        let to = config_backup_path(dir, index + 1);
        if from.is_file() {
            let _ = fs::rename(&from, &to);
        }
    }
    let _ = fs::copy(&current, config_backup_path(dir, 1));
}

fn load_config_from_dir(dir: &Path) -> ConfigLoad {
    let path = dir.join("config.json");
    if !path.is_file() {
        return ConfigLoad {
            config: json!({}),
            notice: None,
            recovered_from: None,
        };
    }

    match read_config_file(&path) {
        Ok(config) => ConfigLoad {
            config,
            notice: None,
            recovered_from: None,
        },
        Err(_) => {
            // 坏文件先改名留证，再尝试最近三份备份
            let corrupt_name = format!("config.json.corrupt-{}", corrupt_stamp());
            let corrupt_path = dir.join(&corrupt_name);
            let backed_up = fs::rename(&path, &corrupt_path).is_ok();

            for index in 1..=CONFIG_BACKUPS {
                let backup = config_backup_path(dir, index);
                if let Ok(config) = read_config_file(&backup) {
                    return ConfigLoad {
                        config,
                        notice: Some("上次的设置文件读不出来，已自动恢复到最近一次保存的设置".to_string()),
                        recovered_from: Some(backup.display().to_string()),
                    };
                }
            }

            ConfigLoad {
                config: json!({}),
                notice: Some(if backed_up {
                    format!(
                        "上次的设置文件读不出来，已用默认设置重新开始，原文件已备份为 {corrupt_name}"
                    )
                } else {
                    "上次的设置文件读不出来，已用默认设置重新开始".to_string()
                }),
                recovered_from: None,
            }
        }
    }
}

fn save_config_to_dir(dir: &Path, config: &Value) -> Result<(), String> {
    validate_config_value(config)?;
    fs::create_dir_all(dir).map_err(|e| format!("无法创建配置目录 {}：{e}", dir.display()))?;
    rotate_config_backups(dir);
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| format!("配置序列化失败：{e}"))?;
    write_text_atomic(&dir.join("config.json"), &raw)
}

fn export_config_to(path: &Path, config: &Value) -> Result<(), String> {
    validate_config_value(config)?;
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| format!("配置序列化失败：{e}"))?;
    write_text_atomic(path, &raw)
}

fn import_config_from(path: &Path) -> Result<Value, String> {
    read_config_file(path).map_err(|e| format!("导入失败：{e}"))
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<ConfigLoad, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用配置目录：{e}"))?;
    migrate_legacy_config(&dir);
    Ok(load_config_from_dir(&dir))
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: Value) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用配置目录：{e}"))?;
    save_config_to_dir(&dir, &config)
}

/// 导出设置到用户选择的 JSON 文件，返回实际写入路径
#[tauri::command]
fn export_config(path: String, config: Value) -> Result<String, String> {
    let dest = expand_home(&path);
    export_config_to(&dest, &config)?;
    Ok(dest.display().to_string())
}

/// 导入设置：只做读取与校验，非法文件直接拒绝，不触碰当前配置
#[tauri::command]
fn import_config(path: String) -> Result<Value, String> {
    import_config_from(&expand_home(&path))
}

// ---------- 阅读素材库（开发者工具，只读写 data/reading-catalog/） ----------

/// 最近任务单最多读取 50 个；文件名即生成时间，倒序取最新的
const CATALOG_JOB_LIMIT: usize = 50;

fn catalog_dir() -> Result<PathBuf, String> {
    Ok(project_root()?.join("data/reading-catalog"))
}

fn read_optional_text(path: &Path, errors: &mut Vec<String>) -> Option<String> {
    if !path.is_file() {
        return None;
    }
    match fs::read_to_string(path) {
        Ok(text) => Some(text),
        Err(e) => {
            errors.push(format!("无法读取 {}：{e}", path.display()));
            None
        }
    }
}

#[tauri::command]
fn read_catalog_snapshot() -> Result<CatalogSnapshot, String> {
    let dir = catalog_dir()?;
    if !dir.is_dir() {
        return Err(format!("素材库目录不存在：{}", dir.display()));
    }

    let mut errors = Vec::new();
    let sources_raw = read_optional_text(&dir.join("sources.json"), &mut errors);
    let items_raw = read_optional_text(&dir.join("items.jsonl"), &mut errors);

    let jobs_dir = dir.join("jobs");
    let mut names: Vec<String> = Vec::new();
    if jobs_dir.is_dir() {
        match fs::read_dir(&jobs_dir) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".job.json") {
                        names.push(name);
                    }
                }
            }
            Err(e) => errors.push(format!("无法读取任务单目录 {}：{e}", jobs_dir.display())),
        }
    }
    names.sort();
    names.reverse();
    names.truncate(CATALOG_JOB_LIMIT);

    let mut jobs = Vec::new();
    for name in names {
        let path = jobs_dir.join(&name);
        match fs::read_to_string(&path) {
            Ok(raw) => jobs.push(CatalogJobFile { name, raw }),
            Err(e) => errors.push(format!("无法读取 {}：{e}", path.display())),
        }
    }

    Ok(CatalogSnapshot {
        dir: dir.display().to_string(),
        sources_raw,
        items_raw,
        jobs,
        errors,
    })
}

/// 任务单编号必须是 YYYYMMDD-HHmmss，顺便挡住路径穿越
fn valid_job_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    bytes.len() == 15
        && bytes[..8].iter().all(|byte| byte.is_ascii_digit())
        && bytes[8] == b'-'
        && bytes[9..].iter().all(|byte| byte.is_ascii_digit())
}

fn write_catalog_job_to_dir(dir: &Path, id: &str, job: &Value) -> Result<PathBuf, String> {
    if !valid_job_id(id) {
        return Err(format!("任务单编号不合法：{id}"));
    }
    if !job.is_object() {
        return Err("任务单内容不是对象".to_string());
    }
    if job.get("id").and_then(|value| value.as_str()) != Some(id) {
        return Err("任务单编号与内容不一致".to_string());
    }

    let jobs_dir = dir.join("jobs");
    fs::create_dir_all(&jobs_dir)
        .map_err(|e| format!("无法创建任务单目录 {}：{e}", jobs_dir.display()))?;
    let path = jobs_dir.join(format!("{id}.job.json"));
    let raw = serde_json::to_string_pretty(job)
        .map_err(|e| format!("任务单序列化失败：{e}"))?;
    write_text_atomic(&path, &raw)?;
    Ok(path)
}

#[tauri::command]
fn create_catalog_job(id: String, job: Value) -> Result<String, String> {
    let dir = catalog_dir()?;
    write_catalog_job_to_dir(&dir, &id, &job).map(|path| path.display().to_string())
}

// ---------- 公众号导出（开发者工具） ----------

const WECHAT_LOGIN_LABEL: &str = "wechat-login";
const WECHAT_ORIGIN: &str = "https://mp.weixin.qq.com/";

/// 登录成功的标志：扫码后微信会下发 slave_sid；这里只判断有无，不读取值
fn wechat_logged_in(cookies: &[Cookie<'static>]) -> bool {
    cookies
        .iter()
        .any(|cookie| cookie.name() == "slave_sid" && !cookie.value().is_empty())
}

fn wechat_cookies(window: &tauri::WebviewWindow) -> Result<Vec<Cookie<'static>>, String> {
    let url = tauri::Url::parse(WECHAT_ORIGIN).map_err(|e| format!("登录地址解析失败：{e}"))?;
    window
        .cookies_for_url(url)
        .map_err(|e| format!("无法读取登录态：{e}"))
}

/// 打开公众号后台登录窗口；登录态只存在这个 webview 的会话里
#[tauri::command]
fn open_wechat_login(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WECHAT_LOGIN_LABEL) {
        window.show().map_err(|e| format!("无法显示登录窗口：{e}"))?;
        window.set_focus().map_err(|e| format!("无法聚焦登录窗口：{e}"))?;
        return Ok(());
    }

    let url = tauri::Url::parse(WECHAT_ORIGIN).map_err(|e| format!("登录地址解析失败：{e}"))?;
    WebviewWindowBuilder::new(&app, WECHAT_LOGIN_LABEL, WebviewUrl::External(url))
        .title("微信公众平台登录")
        .inner_size(560.0, 760.0)
        .min_inner_size(420.0, 600.0)
        .incognito(true)
        .center()
        .build()
        .map_err(|e| format!("无法打开登录窗口：{e}"))?;
    Ok(())
}

/// 只回传窗口是否打开、是否已登录；不返回 cookie、token 或二维码内容
#[tauri::command]
fn wechat_login_state(app: tauri::AppHandle) -> Result<WechatLoginState, String> {
    let Some(window) = app.get_webview_window(WECHAT_LOGIN_LABEL) else {
        return Ok(WechatLoginState {
            open: false,
            logged_in: false,
        });
    };
    let cookies = wechat_cookies(&window)?;
    Ok(WechatLoginState {
        open: true,
        logged_in: wechat_logged_in(&cookies),
    })
}

// ---------- 分享链解析：实际取回页面，找账号标识 ----------

/// 普通浏览器 UA，和用户自己在浏览器里打开同一个链接等价；不携带任何登录凭证
const WECHAT_BROWSER_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
     AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
/// 单次最多读 5 MB，文章页远小于这个值
const WECHAT_FETCH_LIMIT: u64 = 5 * 1024 * 1024;
/// curl -w 输出最终 URL 时用的分隔标记
const WECHAT_FINAL_URL_MARK: &str = "__QUIZLAB_FINAL_URL__";

fn wechat_article_url(raw: &str) -> Result<tauri::Url, String> {
    let text = raw.trim();
    if text.is_empty() {
        return Err("请先粘贴文章链接".to_string());
    }
    let candidate = if text.starts_with("http://") || text.starts_with("https://") {
        text.to_string()
    } else {
        format!("https://{text}")
    };
    let url = tauri::Url::parse(&candidate).map_err(|_| "链接格式不正确".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("只接受 http/https 链接".to_string());
    }
    if url.host_str() != Some("mp.weixin.qq.com") {
        return Err("请粘贴 mp.weixin.qq.com 的公众号文章链接".to_string());
    }
    Ok(url)
}

/// 用系统 curl 取回页面：跟随跳转、浏览器 UA、不读任何本地 cookie
fn fetch_wechat_html(url: &tauri::Url) -> Result<(String, Option<String>), String> {
    let output = Command::new("curl")
        .arg("-sS")
        .arg("-L")
        .arg("--compressed")
        .arg("--max-time")
        .arg("20")
        .arg("--max-filesize")
        .arg(WECHAT_FETCH_LIMIT.to_string())
        .arg("-A")
        .arg(WECHAT_BROWSER_UA)
        .arg("-H")
        .arg("Accept-Language: zh-CN,zh;q=0.9")
        .arg("-w")
        .arg(format!("\\n{WECHAT_FINAL_URL_MARK}%{{url_effective}}"))
        .arg(url.as_str())
        .output()
        .map_err(|e| format!("无法启动 curl 获取页面：{e}"))?;

    if !output.status.success() {
        let code = output
            .status
            .code()
            .map(|value| value.to_string())
            .unwrap_or_else(|| "未知".to_string());
        let stderr = String::from_utf8_lossy(&output.stderr);
        let reason = if code == "63" || stderr.contains("maximum file size") {
            "页面体积超出限制，可能不是文章页".to_string()
        } else if code == "28" {
            "请求超时，请稍后重试".to_string()
        } else if code == "6" || code == "7" {
            "无法连接 mp.weixin.qq.com，请检查网络".to_string()
        } else {
            format!("获取页面失败（curl 退出码 {code}）：{}", stderr.trim())
        };
        return Err(reason);
    }

    let raw = String::from_utf8_lossy(&output.stdout).to_string();
    match raw.rfind(WECHAT_FINAL_URL_MARK) {
        Some(index) => {
            let body = raw[..index].trim_end_matches('\n').to_string();
            let final_url = raw[index + WECHAT_FINAL_URL_MARK.len()..]
                .trim()
                .to_string();
            Ok((body, Some(final_url)))
        }
        None => Ok((raw, None)),
    }
}

/// 页面明确拒绝访问时给出可读原因；返回 None 表示页面看起来是正常文章
fn wechat_block_reason(html: &str) -> Option<&'static str> {
    const RULES: &[(&str, &str)] = &[
        (
            "请在微信客户端打开链接",
            "该链接需要在微信客户端内打开，请用浏览器打开后复制最新链接",
        ),
        (
            "完成验证后即可继续访问",
            "页面被限制：微信要求人机验证，请稍后在浏览器里打开该链接再复制",
        ),
        (
            "环境异常",
            "页面被限制：微信返回环境异常，请稍后重试或在浏览器里打开该链接",
        ),
        ("访问过于频繁", "访问过于频繁，请稍后再试"),
        ("该内容已被发布者删除", "该文章已被发布者删除"),
        ("此内容因违规无法查看", "该文章因违规无法查看"),
        ("该公众号已迁移", "该公众号已迁移，链接已失效"),
        ("链接已过期", "该链接已过期，请在微信里重新分享获取新链接"),
        ("已停止访问该网页", "该链接已被停止访问"),
        ("参数错误", "链接参数无效，可能已过期，请重新复制分享链接"),
    ];
    RULES
        .iter()
        .find(|(marker, _)| html.contains(marker))
        .map(|(_, reason)| *reason)
}

/// 取 pos 之后第一个引号包裹的字符串，返回内容与结束位置
fn quoted_value_at(text: &str, start: usize) -> Option<(&str, usize)> {
    let bytes = text.as_bytes();
    let mut index = start;
    while index < bytes.len() && !matches!(bytes[index], b'"' | b'\'') {
        index += 1;
    }
    if index >= bytes.len() {
        return None;
    }
    let quote = bytes[index];
    let begin = index + 1;
    let mut end = begin;
    while end < bytes.len() && bytes[end] != quote {
        // 跳过 \\" \\' 之类的转义
        if bytes[end] == b'\\' {
            end += 1;
        }
        end += 1;
    }
    if end >= bytes.len() {
        return None;
    }
    Some((&text[begin..end], end + 1))
}

/// marker 之后依次看引号字符串，返回第一个非空值（兼容 `var biz = "" || "Mz…"`）
fn value_after_marker(text: &str, marker: &str) -> Option<String> {
    let from = text.find(marker)? + marker.len();
    let limit = text.len().min(from + 240);
    let mut cursor = from;
    while cursor < limit {
        let (value, next) = quoted_value_at(text, cursor)?;
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
        cursor = next;
    }
    None
}

/// marker 之后连续取所有引号字符串（兼容 `var biz = "" || "Mz…"` 与多个 biz 字段）
fn quoted_values_after_marker(text: &str, marker: &str, window: usize) -> Vec<String> {
    let Some(from) = text.find(marker).map(|index| index + marker.len()) else {
        return Vec::new();
    };
    let limit = text.len().min(from + window);
    let mut values = Vec::new();
    let mut cursor = from;
    while cursor < limit {
        let Some((value, next)) = quoted_value_at(text, cursor) else {
            break;
        };
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            values.push(trimmed.to_string());
        }
        if next <= cursor {
            break;
        }
        cursor = next;
    }
    values
}

/// 微信常见的 \x26 / \u4e2d 转义；只做还原，不猜测
fn unescape_wechat_text(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '\\' {
            out.push(ch);
            continue;
        }
        match chars.peek().copied() {
            Some('x') | Some('X') => {
                chars.next();
                let mut hex = String::new();
                for _ in 0..2 {
                    match chars.peek().copied() {
                        Some(next) if next.is_ascii_hexdigit() => {
                            hex.push(next);
                            chars.next();
                        }
                        _ => break,
                    }
                }
                match u8::from_str_radix(&hex, 16) {
                    Ok(value) if value < 0x80 => out.push(value as char),
                    _ => {
                        out.push('\\');
                        out.push('x');
                        out.push_str(&hex);
                    }
                }
            }
            Some('u') | Some('U') => {
                chars.next();
                let mut hex = String::new();
                for _ in 0..4 {
                    match chars.peek().copied() {
                        Some(next) if next.is_ascii_hexdigit() => {
                            hex.push(next);
                            chars.next();
                        }
                        _ => break,
                    }
                }
                match u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) {
                    Some(value) => out.push(value),
                    None => {
                        out.push('\\');
                        out.push('u');
                        out.push_str(&hex);
                    }
                }
            }
            Some(other) => {
                chars.next();
                match other {
                    'n' => out.push('\n'),
                    't' => out.push('\t'),
                    'r' => out.push('\r'),
                    '/' => out.push('/'),
                    '\\' => out.push('\\'),
                    '"' => out.push('"'),
                    '\'' => out.push('\''),
                    _ => {
                        out.push('\\');
                        out.push(other);
                    }
                }
            }
            None => out.push('\\'),
        }
    }
    unescape_html_entities(&out)
}

fn unescape_html_entities(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(index) = rest.find('&') {
        out.push_str(&rest[..index]);
        let tail = &rest[index..];
        let search = &tail[1..];
        let Some(relative) = search.find(';') else {
            out.push('&');
            rest = search;
            continue;
        };
        let end = relative + 1;
        if end > 12 {
            out.push('&');
            rest = search;
            continue;
        }
        let body = &tail[1..end];
        let single = match body {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some(' '),
            _ => None,
        };
        if let Some(value) = single {
            out.push(value);
            rest = &tail[end + 1..];
            continue;
        }
        let code = if let Some(hex) = body.strip_prefix("#x").or_else(|| body.strip_prefix("#X")) {
            u32::from_str_radix(hex, 16).ok()
        } else {
            body.strip_prefix('#').and_then(|dec| dec.parse::<u32>().ok())
        };
        match code.and_then(char::from_u32) {
            Some(value) => {
                out.push(value);
                rest = &tail[end + 1..];
            }
            None => {
                out.push('&');
                rest = search;
            }
        }
    }
    out.push_str(rest);
    out
}

/// 真实公众号 __biz 是 base64（形如 `MzUxNTU0NjQ2Mg==`）；
/// 只认 `Mz` 开头这一种，避免把 `__biz=170001` 这类无关参数当成账号
fn is_standard_biz(value: &str) -> bool {
    let value = value.trim();
    if value.len() < 8 || !value.starts_with("Mz") {
        return false;
    }
    let body = value.trim_end_matches('=');
    let padding = value.len() - body.len();
    padding <= 2
        && body.len() >= 8
        && body
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '/'))
}

fn percent_decode(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '%' {
            out.push(ch);
            continue;
        }
        let mut hex = String::new();
        while hex.len() < 2 {
            match chars.peek().copied() {
                Some(next) if next.is_ascii_hexdigit() => {
                    hex.push(next);
                    chars.next();
                }
                _ => break,
            }
        }
        match u8::from_str_radix(&hex, 16) {
            Ok(value) if hex.len() == 2 && value < 0x80 => out.push(value as char),
            _ => {
                out.push('%');
                out.push_str(&hex);
            }
        }
    }
    out
}

/// 从 `__biz=…` 形式的 URL 片段里取账号标识（含 `%3D%3D` 编码）
fn biz_from_query_text(text: &str) -> Option<String> {
    let mut search_from = 0;
    while let Some(offset) = text[search_from..].find("__biz=") {
        let start = search_from + offset + "__biz=".len();
        let bytes = text.as_bytes();
        let mut end = start;
        while end < bytes.len() {
            let byte = bytes[end];
            if matches!(
                byte,
                b'&' | b'"' | b'\'' | b'<' | b'>' | b'#' | b' ' | b'\n' | b'\r' | b'\t' | b'\\'
                    | b')' | b';'
            ) {
                break;
            }
            end += 1;
        }
        if end > start {
            let decoded = percent_decode(&text[start..end]);
            if is_standard_biz(&decoded) {
                return Some(decoded);
            }
        }
        search_from = if end > start { end } else { start };
    }
    None
}

fn extract_wechat_biz(html: &str) -> Option<String> {
    // 1) 文章页脚本里的 var biz = "…"（可能先出现空串，也可能有多个 biz 字段）
    for candidate in quoted_values_after_marker(html, "var biz", 900) {
        let decoded = unescape_wechat_text(&candidate);
        if is_standard_biz(&decoded) {
            return Some(decoded);
        }
    }
    // 2) <meta property="og:url"> 里的 __biz
    if let Some(og_url) = meta_content(html, "og:url") {
        if let Some(value) = biz_from_query_text(&og_url) {
            return Some(value);
        }
    }
    // 3) 页面里其它 __biz= 片段（同样只认 Mz 开头，170001 之类会被跳过）
    biz_from_query_text(html)
}

fn clean_text(raw: &str, max_chars: usize) -> String {
    let text = unescape_wechat_text(raw);
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.chars().take(max_chars).collect()
}

fn meta_content(html: &str, key: &str) -> Option<String> {
    let mut search_from = 0;
    while let Some(offset) = html[search_from..].find("<meta") {
        let start = search_from + offset;
        let Some(close) = html[start..].find('>') else {
            break;
        };
        let tag = &html[start..start + close];
        if tag.contains(key) {
            if let Some(position) = tag.find("content") {
                if let Some((value, _)) = quoted_value_at(tag, position + "content".len()) {
                    let text = clean_text(value, 200);
                    if !text.is_empty() {
                        return Some(text);
                    }
                }
            }
        }
        search_from = start + close + 1;
    }
    None
}

fn html_tag_text(html: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let start = html.find(&open)?;
    let content_start = html[start..].find('>').map(|index| start + index + 1)?;
    let content_end = html[content_start..]
        .find(&close)
        .map(|index| content_start + index)?;
    let text = clean_text(&html[content_start..content_end], 200);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn extract_wechat_title(html: &str) -> Option<String> {
    if let Some(value) = value_after_marker(html, "var msg_title") {
        let title = clean_text(&value, 200);
        if !title.is_empty() {
            return Some(title);
        }
    }
    meta_content(html, "og:title").or_else(|| html_tag_text(html, "title"))
}

fn extract_wechat_account(html: &str) -> Option<String> {
    for marker in ["var nickname", "var nick_name"] {
        if let Some(value) = value_after_marker(html, marker) {
            let name = clean_text(&value, 60);
            if !name.is_empty() {
                return Some(name);
            }
        }
    }
    // 文章页里 <a id="js_name">公众号名</a>
    let offset = html.find("js_name")?;
    let from = offset + "js_name".len();
    let tag_end = html[from..].find('>').map(|index| from + index + 1)?;
    let content_end = html[tag_end..].find('<').map(|index| tag_end + index)?;
    let name = clean_text(&html[tag_end..content_end], 60);
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn wechat_resolved_from_html(
    html: &str,
    final_url: Option<&str>,
) -> Result<WechatResolved, String> {
    if html.trim().is_empty() {
        return Err("页面返回为空，链接可能已失效".to_string());
    }
    if let Some(reason) = wechat_block_reason(html) {
        return Err(reason.to_string());
    }

    let biz = extract_wechat_biz(html)
        .or_else(|| final_url.and_then(extract_wechat_biz))
        .ok_or_else(|| {
            "未识别到账号标识：页面可能不是文章页，或链接已过期/被限制；请在浏览器里打开后复制最新链接"
                .to_string()
        })?;

    Ok(WechatResolved {
        biz,
        title: extract_wechat_title(html),
        account_name: extract_wechat_account(html),
    })
}

/// 分享链 / 短链：实际取回页面，解析出账号标识与文章标题，供用户确认
#[tauri::command]
fn resolve_wechat_share_link(url: String) -> Result<WechatResolved, String> {
    let url = wechat_article_url(&url)?;
    let (html, final_url) = fetch_wechat_html(&url)?;
    wechat_resolved_from_html(&html, final_url.as_deref())
}

// ---------- 第一段：只抓文章列表（用登录窗口里的会话，串行翻页） ----------

/// 每页固定 10 条，和网页版历史消息一致
const WECHAT_LIST_COUNT: i64 = 10;
/// 单次任务最多翻 120 页，避免异常链接无限循环
const WECHAT_LIST_MAX_PAGES: usize = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WechatArticleRow {
    title: String,
    link: String,
    published_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WechatExportIndex {
    biz: String,
    account_name: Option<String>,
    updated_at: i64,
    next_offset: i64,
    can_continue: bool,
    stopped_reason: Option<String>,
    articles: Vec<WechatArticleRow>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatListSummary {
    total: usize,
    pages: usize,
    next_offset: i64,
    can_continue: bool,
    stopped_reason: Option<String>,
    index_path: String,
}

fn wechat_export_path(biz: &str) -> Result<PathBuf, String> {
    let safe: String = biz
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '=') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let dir = catalog_dir()?.join("wechat-export").join(if safe.is_empty() {
        "unknown-biz".to_string()
    } else {
        safe
    });
    Ok(dir.join("index.json"))
}

fn epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

/// 登录窗口当前所在页面（只取 host + path，不带查询串，避免把 token 带出来）
fn wechat_window_location(window: &tauri::WebviewWindow) -> String {
    match window.url() {
        Ok(url) => format!("{}{}", url.host_str().unwrap_or("未知地址"), url.path()),
        Err(_) => "未知地址".to_string(),
    }
}

/// 在登录窗口里同步执行一段 JS，并取回序列化后的结果
fn wechat_eval_value(window: &tauri::WebviewWindow, js: &str) -> Result<Value, String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    window
        .eval_with_callback(js.to_string(), move |result| {
            let _ = sender.send(result);
        })
        .map_err(|e| {
            format!(
                "无法在登录窗口执行脚本（窗口当前 {}）：{e}",
                wechat_window_location(window)
            )
        })?;
    let raw = receiver
        .recv_timeout(std::time::Duration::from_secs(10))
        .map_err(|_| {
            format!(
                "登录窗口 10 秒内没有响应（窗口当前 {}），页面可能正在跳转或加载",
                wechat_window_location(window)
            )
        })?;
    Ok(serde_json::from_str(&raw).unwrap_or(Value::Null))
}

fn wechat_cookie_value(cookies: &[Cookie<'static>], name: &str) -> String {
    cookies
        .iter()
        .find(|cookie| cookie.name() == name)
        .map(|cookie| cookie.value().to_string())
        .unwrap_or_default()
}

/// pass_ticket 优先取当前窗口地址里的，再退回 cookie；只用于内存里的 URL，不写日志
fn wechat_pass_ticket(window: &tauri::WebviewWindow, cookies: &[Cookie<'static>]) -> String {
    if let Ok(url) = window.url() {
        if let Some((_, value)) = url.query_pairs().find(|(key, _)| key == "pass_ticket") {
            return value.into_owned();
        }
    }
    wechat_cookie_value(cookies, "pass_ticket")
}

fn wechat_history_url(biz: &str, pass_ticket: &str) -> Result<Url, String> {
    let mut url = Url::parse("https://mp.weixin.qq.com/mp/profile_ext")
        .map_err(|e| format!("历史页地址无效：{e}"))?;
    {
        let mut pairs = url.query_pairs_mut();
        pairs.append_pair("action", "home");
        pairs.append_pair("__biz", biz);
        pairs.append_pair("scene", "124");
        pairs.append_pair("devicetype", "Mac 10.15");
        pairs.append_pair("version", "63090c2f");
        pairs.append_pair("lang", "zh_CN");
        pairs.append_pair("nettype", "WIFI");
        pairs.append_pair("a8scene", "0");
        pairs.append_pair("pass_ticket", pass_ticket);
        pairs.append_pair("wx_header", "1");
    }
    Ok(url)
}

/// 先 fetch 一次历史页，拿到真实 HTTP 状态和正文前 300 字符；被拦截就停在这里
fn wechat_probe_home(window: &tauri::WebviewWindow, home_url: &str) -> Result<Value, String> {
    let url_literal = serde_json::to_string(home_url)
        .map_err(|e| format!("历史页地址序列化失败：{e}"))?;
    let js = r#"
window.__quizlabWxHomeProbe = null;
(function () {
  fetch(%%URL%%, { credentials: "include" })
    .then(function (response) {
      return response.text().then(function (text) {
        window.__quizlabWxHomeProbe = { status: response.status, text: text.slice(0, 200000) };
      });
    })
    .catch(function (error) {
      window.__quizlabWxHomeProbe = { status: 0, text: "", error: String(error) };
    });
})();
undefined;
"#
    .replace("%%URL%%", &url_literal);
    window
        .eval(js)
        .map_err(|e| format!("无法在登录窗口发起历史页请求：{e}"))?;
    wechat_wait_value(
        window,
        "window.__quizlabWxHomeProbe",
        std::time::Duration::from_secs(20),
        "历史页",
    )
}

/// 在导航后的历史页上下文里取令牌并同源发 getmsg。
/// prepare=true 时先检查页面是否被拦截，并把令牌挂到 window 上供后续翻页复用。
fn wechat_kickoff_getmsg(
    window: &tauri::WebviewWindow,
    biz: &str,
    offset: i64,
    home_status: i64,
    prepare: bool,
) -> Result<(), String> {
    let biz_literal = serde_json::to_string(biz)
        .map_err(|e| format!("账号标识序列化失败：{e}"))?;
    let js = if prepare {
        r#"
window.__quizlabWx = null;
(function () {
  var biz = %%BIZ%%;
  var offset = %%OFFSET%%;
  var count = %%COUNT%%;
  var homeStatus = %%HOME_STATUS%%;
  var html = document.documentElement ? document.documentElement.innerHTML : "";
  var bodyText = (document.body && document.body.innerText) ? document.body.innerText : html;
  var marker = "";
  var markers = ["请在微信客户端打开链接", "环境异常", "完成验证后即可继续访问", "访问过于频繁"];
  for (var i = 0; i < markers.length; i++) {
    if (html.indexOf(markers[i]) > -1) { marker = markers[i]; break; }
  }
  var pick = function (name) {
    var pattern = new RegExp("var\\s+" + name + "\\s*=\\s*[\"']([^\"']*)[\"']");
    var hit = html.match(pattern);
    return hit ? hit[1] : "";
  };
  var cookiePick = function (name) {
    var hit = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return hit ? decodeURIComponent(hit[1]) : "";
  };
  var pass_ticket = pick("pass_ticket") || cookiePick("pass_ticket");
  var appmsg_token = pick("appmsg_token") || cookiePick("appmsg_token");
  var uin = pick("uin") || cookiePick("uin");
  var key = pick("key") || cookiePick("key");
  var secrets = [pass_ticket, appmsg_token, uin, key];
  var redact = function (value) {
    for (var i = 0; i < secrets.length; i++) {
      if (secrets[i] && secrets[i].length >= 6) {
        value = value.split(secrets[i]).join("[已隐藏]");
      }
    }
    return value;
  };
  var tokens = { uin: !!uin, key: !!key, pass_ticket: !!pass_ticket, appmsg_token: !!appmsg_token };
  var base = function () {
    return {
      homeHttpStatus: homeStatus,
      homeTitle: document.title || "",
      pageTextPrefix: redact(bodyText.slice(0, 300)),
      tokens: tokens
    };
  };
  if (marker) {
    var blocked = base();
    blocked.stage = "home-blocked";
    blocked.blockMarker = marker;
    window.__quizlabWx = blocked;
    return;
  }
  window.__quizlabWxTokens = { biz: biz, uin: uin, key: key, pass_ticket: pass_ticket, appmsg_token: appmsg_token, tokens: tokens };
  var pageUrl = "/mp/profile_ext?action=getmsg&__biz=" + encodeURIComponent(biz)
    + "&f=json&offset=" + offset + "&count=" + count + "&is_ok=1&scene=124"
    + "&uin=" + encodeURIComponent(uin)
    + "&key=" + encodeURIComponent(key)
    + "&pass_ticket=" + encodeURIComponent(pass_ticket)
    + "&wxtoken=&appmsg_token=" + encodeURIComponent(appmsg_token) + "&x5=0";
  fetch(pageUrl, { credentials: "include" })
    .then(function (response) {
      return response.text().then(function (text) {
        var result = base();
        result.stage = "page";
        result.status = response.status;
        result.text = text.slice(0, 200000);
        result.responsePrefix = redact(text.slice(0, 300));
        window.__quizlabWx = result;
      });
    })
    .catch(function (error) {
      var result = base();
      result.stage = "fetch-failed";
      result.status = 0;
      result.error = String(error);
      window.__quizlabWx = result;
    });
})();
undefined;
"#
        .replace("%%BIZ%%", &biz_literal)
        .replace("%%OFFSET%%", &offset.to_string())
        .replace("%%COUNT%%", &WECHAT_LIST_COUNT.to_string())
        .replace("%%HOME_STATUS%%", &home_status.to_string())
    } else {
        r#"
window.__quizlabWx = null;
(function () {
  var biz = %%BIZ%%;
  var offset = %%OFFSET%%;
  var count = %%COUNT%%;
  var t = window.__quizlabWxTokens;
  var emptyTokens = { uin: false, key: false, pass_ticket: false, appmsg_token: false };
  var base = function () {
    return {
      homeHttpStatus: 0,
      homeTitle: document.title || "",
      pageTextPrefix: "",
      tokens: t ? t.tokens : emptyTokens
    };
  };
  if (!t || t.biz !== biz) {
    var lost = base();
    lost.stage = "tokens-lost";
    window.__quizlabWx = lost;
    return;
  }
  var pageUrl = "/mp/profile_ext?action=getmsg&__biz=" + encodeURIComponent(biz)
    + "&f=json&offset=" + offset + "&count=" + count + "&is_ok=1&scene=124"
    + "&uin=" + encodeURIComponent(t.uin)
    + "&key=" + encodeURIComponent(t.key)
    + "&pass_ticket=" + encodeURIComponent(t.pass_ticket)
    + "&wxtoken=&appmsg_token=" + encodeURIComponent(t.appmsg_token) + "&x5=0";
  fetch(pageUrl, { credentials: "include" })
    .then(function (response) {
      return response.text().then(function (text) {
        var result = base();
        result.stage = "page";
        result.status = response.status;
        result.text = text.slice(0, 200000);
        var secrets = [t.pass_ticket, t.appmsg_token, t.uin, t.key];
        var prefix = text.slice(0, 300);
        for (var i = 0; i < secrets.length; i++) {
          if (secrets[i] && secrets[i].length >= 6) {
            prefix = prefix.split(secrets[i]).join("[已隐藏]");
          }
        }
        result.responsePrefix = prefix;
        window.__quizlabWx = result;
      });
    })
    .catch(function (error) {
      var result = base();
      result.stage = "fetch-failed";
      result.status = 0;
      result.error = String(error);
      window.__quizlabWx = result;
    });
})();
undefined;
"#
        .replace("%%BIZ%%", &biz_literal)
        .replace("%%OFFSET%%", &offset.to_string())
        .replace("%%COUNT%%", &WECHAT_LIST_COUNT.to_string())
    };
    window
        .eval(js)
        .map_err(|e| format!("无法在登录窗口发起文章列表请求：{e}"))
}

fn wechat_wait_value(
    window: &tauri::WebviewWindow,
    expression: &str,
    timeout: std::time::Duration,
    label: &str,
) -> Result<Value, String> {
    let deadline = Instant::now() + timeout;
    loop {
        if Instant::now() >= deadline {
            return Err(format!(
                "等待{label}超过 {} 秒（窗口当前 {}）：页面未就绪、正在跳转，或不在 mp.weixin.qq.com",
                timeout.as_secs(),
                wechat_window_location(window)
            ));
        }
        // 导航过程中 eval 可能失败，继续重试直到超时
        if let Ok(value) = wechat_eval_value(window, expression) {
            if value.is_object() {
                return Ok(value);
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

fn wechat_wait_navigated(
    window: &tauri::WebviewWindow,
    previous_path: &str,
) -> Result<(), String> {
    let started = Instant::now();
    let deadline = started + std::time::Duration::from_secs(25);
    loop {
        if Instant::now() >= deadline {
            return Err(format!(
                "打开该号历史页后 25 秒内未加载完成（窗口当前 {}）：页面可能仍在跳转或被拦截",
                wechat_window_location(window)
            ));
        }
        if let Ok(value) =
            wechat_eval_value(window, "({path: location.pathname, ready: document.readyState})")
        {
            let path = value.get("path").and_then(Value::as_str).unwrap_or("");
            let ready = value.get("ready").and_then(Value::as_str).unwrap_or("");
            let path_changed = !path.is_empty() && path != previous_path;
            // 上次已经停在历史页时路径不会变，给它固定等待时间避免误判旧页面
            let same_history_after_wait = previous_path.contains("/mp/profile_ext")
                && started.elapsed() >= std::time::Duration::from_secs(2);
            if ready == "complete" && (path_changed || same_history_after_wait) {
                return Ok(());
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
}

fn wechat_list_ret_reason(ret: i64, errmsg: &str) -> String {
    let message = errmsg.to_lowercase();
    if message.contains("freq") || errmsg.contains("频繁") {
        return "访问过于频繁，已停止；稍后可从断点继续".to_string();
    }
    if message.contains("verify") || errmsg.contains("验证") {
        return "页面被限制：微信要求人机验证，已停止".to_string();
    }
    if matches!(ret, -1 | -2 | -3) {
        return "登录态已失效，请重新扫码登录后再试".to_string();
    }
    if errmsg.is_empty() {
        format!("列表接口返回错误（ret={ret}），已停止")
    } else {
        format!("列表接口返回错误（ret={ret}：{errmsg}），已停止")
    }
}

/// 首页/历史页正文可能内联令牌，写进诊断前先按值替换掉
fn wechat_redact_secrets(text: &str) -> String {
    let mut redacted = text.to_string();
    for marker in ["var pass_ticket", "var appmsg_token", "var uin", "var key"] {
        if let Some(secret) = value_after_marker(text, marker) {
            if secret.len() >= 8 {
                redacted = redacted.replace(&secret, "[已隐藏]");
            }
        }
    }
    redacted
}

fn wechat_token_flags_text(tokens: &Value) -> String {
    let flag = |name: &str| {
        if tokens.get(name).and_then(Value::as_bool).unwrap_or(false) {
            "有"
        } else {
            "无"
        }
    };
    format!(
        "uin={}，key={}，pass_ticket={}，appmsg_token={}",
        flag("uin"),
        flag("key"),
        flag("pass_ticket"),
        flag("appmsg_token")
    )
}

fn wechat_payload_ret_errmsg(text: &str) -> (Option<i64>, String) {
    match serde_json::from_str::<Value>(text) {
        Ok(value) => (
            value.get("ret").and_then(Value::as_i64),
            value.get("errmsg").and_then(Value::as_str).unwrap_or("").to_string(),
        ),
        Err(_) => (None, String::new()),
    }
}

fn wechat_envelope_diagnostics(
    envelope: &Value,
    status: i64,
    ret: Option<i64>,
    errmsg: &str,
) -> String {
    let home_status = envelope.get("homeHttpStatus").and_then(Value::as_i64).unwrap_or(0);
    let title = envelope.get("homeTitle").and_then(Value::as_str).unwrap_or("");
    let prefix = envelope
        .get("responsePrefix")
        .or_else(|| envelope.get("pageTextPrefix"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let tokens = envelope.get("tokens").cloned().unwrap_or(Value::Null);
    format!(
        "诊断：home HTTP {home_status}，getmsg HTTP {status}，ret={}，errmsg={}，令牌 {}，页面标题「{}」，响应前 300 字符：{}",
        ret.map(|value| value.to_string())
            .unwrap_or_else(|| "缺失".to_string()),
        if errmsg.is_empty() {
            "空".to_string()
        } else {
            clean_text(errmsg, 120)
        },
        wechat_token_flags_text(&tokens),
        title,
        prefix
    )
}

/// 历史页被微信拒绝时，把真实证据带回去；桌面端不可行时明确说结论
fn wechat_home_block_error(status: i64, text: &str, reason: &str) -> String {
    let title = html_tag_text(text, "title").unwrap_or_default();
    let prefix = clean_text(&wechat_redact_secrets(text), 300);
    if text.contains("请在微信客户端打开链接") {
        format!(
            "桌面端不可行：该号历史页返回「请在微信客户端打开链接」（home HTTP {status}，页面标题「{title}」，正文前 300 字符：{prefix}）。getmsg 未发起，四个令牌未取；已停止，不重试；请改用导出文件方案。"
        )
    } else {
        format!(
            "该号历史页被微信限制：{reason}（home HTTP {status}，页面标题「{title}」，正文前 300 字符：{prefix}）。getmsg 未发起，四个令牌未取；已停止，不重试。"
        )
    }
}

fn wechat_page_block_error(envelope: &Value) -> String {
    let marker = envelope
        .get("blockMarker")
        .and_then(Value::as_str)
        .unwrap_or("页面被拦截");
    let home_status = envelope.get("homeHttpStatus").and_then(Value::as_i64).unwrap_or(0);
    let title = envelope.get("homeTitle").and_then(Value::as_str).unwrap_or("");
    let prefix = envelope
        .get("pageTextPrefix")
        .and_then(Value::as_str)
        .unwrap_or("");
    if marker.contains("请在微信客户端打开链接") {
        format!(
            "桌面端不可行：该号历史页返回「请在微信客户端打开链接」（home HTTP {home_status}，页面标题「{title}」，正文前 300 字符：{prefix}）。getmsg 未发起，四个令牌未取；已停止，不重试；请改用导出文件方案。"
        )
    } else {
        format!(
            "该号历史页被微信限制：{marker}（home HTTP {home_status}，页面标题「{title}」，正文前 300 字符：{prefix}）。getmsg 未发起，四个令牌未取；已停止，不重试。"
        )
    }
}

/// 先探针取证，再导航到该号历史页，等页面就绪后才发起 getmsg
fn prepare_wechat_history_page(
    window: &tauri::WebviewWindow,
    biz: &str,
    offset: i64,
) -> Result<(), String> {
    let cookies = wechat_cookies(window)?;
    let pass_ticket = wechat_pass_ticket(window, &cookies);
    let home_url = wechat_history_url(biz, &pass_ticket)?;

    let probe = wechat_probe_home(window, home_url.as_str())?;
    let home_status = probe.get("status").and_then(Value::as_i64).unwrap_or(0);
    let home_text = probe.get("text").and_then(Value::as_str).unwrap_or("");
    let home_error = probe.get("error").and_then(Value::as_str).unwrap_or("");

    if home_status == 0 {
        return Err(format!(
            "打开该号历史页失败（窗口当前 {}）：{}。getmsg 未发起，四个令牌未取；已停止，不重试。",
            wechat_window_location(window),
            if home_error.is_empty() {
                "窗口内 fetch 抛错但没有错误信息"
            } else {
                home_error
            }
        ));
    }
    if !(200..=299).contains(&home_status) {
        let title = html_tag_text(home_text, "title").unwrap_or_default();
        let prefix = clean_text(&wechat_redact_secrets(home_text), 300);
        return Err(format!(
            "该号历史页请求失败（home HTTP {home_status}，页面标题「{title}」，正文前 300 字符：{prefix}）。getmsg 未发起，四个令牌未取；已停止，不重试。"
        ));
    }
    if let Some(reason) = wechat_block_reason(home_text) {
        return Err(wechat_home_block_error(home_status, home_text, reason));
    }

    let previous_path = window
        .url()
        .ok()
        .map(|url| url.path().to_string())
        .unwrap_or_default();
    window
        .navigate(home_url)
        .map_err(|e| format!("无法打开该号历史页：{e}"))?;
    wechat_wait_navigated(window, &previous_path)?;
    // 给页面内联脚本一点时间写入令牌
    std::thread::sleep(std::time::Duration::from_millis(500));
    wechat_kickoff_getmsg(window, biz, offset, home_status, true)
}

fn normalize_wechat_link(raw: &str) -> String {
    unescape_wechat_text(raw)
        .replace("http://mp.weixin.qq.com", "https://mp.weixin.qq.com")
}

fn push_wechat_article(ext: &Value, datetime: Option<i64>, out: &mut Vec<WechatArticleRow>) {
    let raw_title = ext.get("title").and_then(Value::as_str).unwrap_or("").trim();
    let raw_link = ext
        .get("content_url")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if raw_title.is_empty() || raw_link.is_empty() {
        return;
    }
    out.push(WechatArticleRow {
        title: clean_text(raw_title, 300),
        link: normalize_wechat_link(raw_link),
        published_at: datetime,
    });
}

fn collect_wechat_articles(items: &[Value], out: &mut Vec<WechatArticleRow>) {
    for item in items {
        let datetime = item
            .get("comm_msg_info")
            .and_then(|info| info.get("datetime"))
            .and_then(Value::as_i64);
        let Some(ext) = item.get("app_msg_ext_info") else {
            continue;
        };
        push_wechat_article(ext, datetime, out);
        if let Some(multi) = ext.get("multi_app_msg_item_list").and_then(Value::as_array) {
            for sub in multi {
                push_wechat_article(sub, datetime, out);
            }
        }
    }
}

/// 解析一页 getmsg 返回；失败返回可读原因（含风控/验证）
fn parse_wechat_list_page(
    text: &str,
    fallback_offset: i64,
) -> Result<(Vec<WechatArticleRow>, i64, bool), String> {
    if let Some(reason) = wechat_block_reason(text) {
        return Err(reason.to_string());
    }
    let value: Value = serde_json::from_str(text).map_err(|_| {
        "列表接口返回了非 JSON 内容，可能是验证页或被限制".to_string()
    })?;
    let ret = value.get("ret").and_then(Value::as_i64).unwrap_or(-1);
    let errmsg = value.get("errmsg").and_then(Value::as_str).unwrap_or("");
    if ret != 0 {
        return Err(wechat_list_ret_reason(ret, errmsg));
    }

    let list_text = value
        .get("general_msg_list")
        .and_then(Value::as_str)
        .unwrap_or("");
    if list_text.trim().is_empty() {
        return Ok((Vec::new(), fallback_offset, false));
    }
    let list_value: Value = serde_json::from_str(list_text)
        .map_err(|_| "文章列表 JSON 解析失败".to_string())?;
    let items = list_value
        .get("list")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut articles = Vec::new();
    collect_wechat_articles(&items, &mut articles);

    let next_offset = value
        .get("next_offset")
        .and_then(Value::as_i64)
        .unwrap_or(fallback_offset + WECHAT_LIST_COUNT);
    let can_continue = match value.get("can_msg_continue") {
        Some(Value::Bool(flag)) => *flag,
        Some(other) => other.as_i64().unwrap_or(0) == 1,
        None => false,
    };
    Ok((articles, next_offset, can_continue))
}

fn fetch_wechat_list_page(
    window: &tauri::WebviewWindow,
    biz: &str,
    offset: i64,
    prepare: bool,
) -> Result<(Vec<WechatArticleRow>, i64, bool), String> {
    if prepare {
        prepare_wechat_history_page(window, biz, offset)?;
    } else {
        wechat_kickoff_getmsg(window, biz, offset, 0, false)?;
    }

    let envelope = wechat_wait_value(
        window,
        "window.__quizlabWx",
        std::time::Duration::from_secs(30),
        "文章列表",
    )?;
    let stage = envelope.get("stage").and_then(Value::as_str).unwrap_or("");
    if stage == "home-blocked" {
        return Err(wechat_page_block_error(&envelope));
    }
    if stage == "tokens-lost" {
        let tokens = envelope.get("tokens").cloned().unwrap_or(Value::Null);
        return Err(format!(
            "页面上下文里没有可用令牌（登录窗口可能已跳转），getmsg 未发起，令牌 {}；已停止，请重新点击抓取",
            wechat_token_flags_text(&tokens)
        ));
    }

    let status = envelope.get("status").and_then(Value::as_i64).unwrap_or(0);
    let text = envelope.get("text").and_then(Value::as_str).unwrap_or("");
    let error = envelope.get("error").and_then(Value::as_str).unwrap_or("");
    let (ret, errmsg) = wechat_payload_ret_errmsg(text);
    let diagnostics = wechat_envelope_diagnostics(&envelope, status, ret, &errmsg);

    if status == 0 {
        return Err(format!(
            "窗口内 getmsg 请求失败：{}〔{}〕",
            if error.is_empty() {
                "没有错误信息，页面可能未就绪"
            } else {
                error
            },
            diagnostics
        ));
    }
    if status != 200 {
        return Err(format!("文章列表请求失败（HTTP {status}）〔{diagnostics}〕"));
    }
    match parse_wechat_list_page(text, offset) {
        Ok(page) => Ok(page),
        Err(reason) => Err(format!("{reason}〔{diagnostics}〕")),
    }
}

fn merge_wechat_articles(target: &mut Vec<WechatArticleRow>, incoming: Vec<WechatArticleRow>) -> usize {
    let mut added = 0;
    for article in incoming {
        if target.iter().any(|existing| existing.link == article.link) {
            continue;
        }
        target.push(article);
        added += 1;
    }
    added
}

fn save_wechat_index(path: &Path, index: &WechatExportIndex) -> Result<(), String> {
    let text = serde_json::to_string_pretty(index)
        .map_err(|e| format!("无法序列化文章清单：{e}"))?;
    write_text_atomic(path, &format!("{text}\n"))
}

/// 第一段：串行翻页只抓列表；每页落盘，撞验证/风控立即停，可从 nextOffset 续抓
///
/// 必须是 async：同步命令跑在主线程，内部等 eval 回调会把主线程堵死；
/// 真正的抓取循环放到 blocking 线程里执行。
#[tauri::command]
async fn crawl_wechat_article_list(
    app: tauri::AppHandle,
    biz: String,
    account_name: Option<String>,
) -> Result<WechatListSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crawl_wechat_article_list_blocking(app, biz, account_name)
    })
    .await
    .map_err(|e| format!("抓取任务异常结束：{e}"))?
}

fn crawl_wechat_article_list_blocking(
    app: tauri::AppHandle,
    biz: String,
    account_name: Option<String>,
) -> Result<WechatListSummary, String> {
    let biz = biz.trim().to_string();
    if !is_standard_biz(&biz) {
        return Err("账号标识格式不正确（应为 Mz… 形式的 __biz），请先重新解析链接".to_string());
    }
    let Some(window) = app.get_webview_window(WECHAT_LOGIN_LABEL) else {
        return Err("登录窗口已关闭，请重新扫码登录".to_string());
    };
    match window.url() {
        Ok(url) if url.host_str() == Some("mp.weixin.qq.com") => {}
        Ok(url) => {
            return Err(format!(
                "登录窗口当前不在 mp.weixin.qq.com（当前 {}{}），无法复用登录会话；请让登录窗口回到公众号页面后再试",
                url.host_str().unwrap_or("未知地址"),
                url.path()
            ));
        }
        Err(_) => return Err("无法读取登录窗口当前地址".to_string()),
    }
    let cookies = wechat_cookies(&window)?;
    if !wechat_logged_in(&cookies) {
        return Err("还没有登录，请先扫码登录".to_string());
    }

    let path = wechat_export_path(&biz)?;
    let mut index = match fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<WechatExportIndex>(&raw).ok())
    {
        Some(existing) if existing.biz == biz => existing,
        _ => WechatExportIndex {
            biz: biz.clone(),
            account_name: account_name.clone(),
            updated_at: epoch_seconds(),
            next_offset: 0,
            can_continue: true,
            stopped_reason: None,
            articles: Vec::new(),
        },
    };

    let mut pages = 0;
    if index.articles.is_empty() {
        index.next_offset = 0;
        index.can_continue = true;
        index.stopped_reason = None;
    }

    let mut prepared = false;
    while index.can_continue && pages < WECHAT_LIST_MAX_PAGES {
        match fetch_wechat_list_page(&window, &biz, index.next_offset, !prepared) {
            Ok((articles, next_offset, can_continue)) => {
                prepared = true;
                let added = merge_wechat_articles(&mut index.articles, articles);
                pages += 1;
                let advanced = next_offset > index.next_offset;
                index.next_offset = next_offset;
                index.can_continue = can_continue && advanced;
                index.updated_at = epoch_seconds();
                index.stopped_reason = None;
                save_wechat_index(&path, &index)?;
                if added == 0 && !advanced {
                    index.can_continue = false;
                    save_wechat_index(&path, &index)?;
                }
                if !index.can_continue {
                    break;
                }
                // 3–5 秒间隔，串行，不并发
                let wait_ms = 3600 + (pages as u64 % 3) * 500;
                std::thread::sleep(std::time::Duration::from_millis(wait_ms));
            }
            Err(reason) => {
                index.stopped_reason = Some(reason);
                index.updated_at = epoch_seconds();
                save_wechat_index(&path, &index)?;
                break;
            }
        }
    }

    if pages >= WECHAT_LIST_MAX_PAGES && index.can_continue {
        index.stopped_reason = Some("已达到本次翻页上限（120 页），可再次点击继续".to_string());
        index.updated_at = epoch_seconds();
        save_wechat_index(&path, &index)?;
    }

    let indexPath = path
        .strip_prefix(project_root()?)
        .unwrap_or(&path)
        .to_string_lossy()
        .to_string();
    Ok(WechatListSummary {
        total: index.articles.len(),
        pages,
        next_offset: index.next_offset,
        can_continue: index.can_continue,
        stopped_reason: index.stopped_reason.clone(),
        index_path: indexPath,
    })
}
// ---------- 批量链接（公众号正文） ----------

/// 与 tools/reading-intake/cli.py 的 links 子命令约定：报告路径写在最后一行
const LINK_REPORT_MARK: &str = "__QUIZLAB_REPORT__";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkBatchReason {
    reason: String,
    count: usize,
}

/// 一次批量抓取的汇总；逐条明细在 report.json 里
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkBatchSummary {
    batch: String,
    report_path: String,
    total: usize,
    success: usize,
    skipped: usize,
    failed: usize,
    imported: usize,
    pending_questions: usize,
    /// 合集：已切分的原文篇数、切出的单元数、字数/分段合格数与完整过 gate 数
    split_articles: usize,
    split_units: usize,
    split_word_passed: usize,
    split_passed: usize,
    needs_split: usize,
    fail_reasons: Vec<LinkBatchReason>,
}

fn link_batch_summary_of(report: &Value, report_path: &str) -> LinkBatchSummary {
    let count = |key: &str| {
        report
            .get("stats")
            .and_then(|stats| stats.get(key))
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as usize
    };
    let mut fail_reasons: Vec<LinkBatchReason> = report
        .get("failReasons")
        .and_then(|value| value.as_object())
        .map(|map| {
            map.iter()
                .map(|(reason, amount)| LinkBatchReason {
                    reason: reason.clone(),
                    count: amount.as_u64().unwrap_or(0) as usize,
                })
                .collect()
        })
        .unwrap_or_default();
    fail_reasons.sort_by(|left, right| right.count.cmp(&left.count));

    LinkBatchSummary {
        batch: report
            .get("batch")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        report_path: report_path.to_string(),
        total: report
            .get("entries")
            .and_then(|value| value.as_array())
            .map(|entries| entries.len())
            .unwrap_or(0),
        success: count("success"),
        skipped: count("skipped"),
        failed: count("failed"),
        imported: count("imported"),
        pending_questions: count("pendingQuestions"),
        split_articles: count("splitArticles"),
        split_units: count("splitUnits"),
        split_word_passed: count("splitWordPassed"),
        split_passed: count("splitPassed"),
        needs_split: count("needsSplit"),
        fail_reasons,
    }
}

/// 批量链接：串行用系统 curl 取正文，再交给现有 intake（clean → gate → 入库）
///
/// async + spawn_blocking：整批按 3–5 秒间隔串行取页面，会跑很久，不能占主线程。
#[tauri::command]
async fn crawl_wechat_links_batch(
    links: String,
    intext_min: Option<u32>,
    intext_max: Option<u32>,
    extra_min: Option<u32>,
    extra_max: Option<u32>,
) -> Result<LinkBatchSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crawl_wechat_links_batch_blocking(&links, intext_min, intext_max, extra_min, extra_max)
    })
    .await
    .map_err(|e| format!("批量抓取任务异常结束：{e}"))?
}

fn crawl_wechat_links_batch_blocking(
    links: &str,
    intext_min: Option<u32>,
    intext_max: Option<u32>,
    extra_min: Option<u32>,
    extra_max: Option<u32>,
) -> Result<LinkBatchSummary, String> {
    use std::io::Write;
    use std::process::Stdio;

    if links.trim().is_empty() {
        return Err("没有链接：请一行粘贴一条公众号文章链接".to_string());
    }
    let root = project_root()?;
    let script = root.join("tools/reading-intake/cli.py");
    if !script.is_file() {
        return Err(format!("找不到抓取脚本：{}", script.display()));
    }
    let python =
        resolve_python().ok_or_else(|| "未找到 python3，无法运行抓取流水线".to_string())?;

    // 链接通过 stdin 传给脚本，不写进任何日志
    let mut child = Command::new(&python)
        .arg(&script)
        .arg("links")
        .arg("--intext-min")
        .arg(intext_min.unwrap_or(150).to_string())
        .arg("--intext-max")
        .arg(intext_max.unwrap_or(400).to_string())
        .arg("--extra-min")
        .arg(extra_min.unwrap_or(250).to_string())
        .arg("--extra-max")
        .arg(extra_max.unwrap_or(600).to_string())
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("无法启动抓取脚本：{e}"))?;
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法写入链接清单".to_string())?;
        stdin
            .write_all(links.as_bytes())
            .map_err(|e| format!("写入链接清单失败：{e}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| format!("等待抓取脚本失败：{e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        let tail: Vec<&str> = stdout
            .lines()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        return Err(format!(
            "抓取流水线退出异常（{}）：{}",
            output
                .status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "被中断".to_string()),
            if stderr.trim().is_empty() {
                tail.join("\n")
            } else {
                stderr.trim().to_string()
            }
        ));
    }

    let report_file = stdout
        .lines()
        .rev()
        .find_map(|line| line.strip_prefix(LINK_REPORT_MARK))
        .map(|path| PathBuf::from(path.trim()))
        .ok_or_else(|| {
            let tail: Vec<&str> = stdout.lines().rev().take(6).collect();
            format!("抓取脚本没有返回报告路径：\n{}", tail.join("\n"))
        })?;
    let raw = fs::read_to_string(&report_file)
        .map_err(|e| format!("无法读取报告 {}：{e}", report_file.display()))?;
    let report: Value =
        serde_json::from_str(&raw).map_err(|e| format!("报告格式不正确：{e}"))?;
    let display = report_file
        .strip_prefix(&root)
        .unwrap_or(&report_file)
        .to_string_lossy()
        .to_string();
    Ok(link_batch_summary_of(&report, &display))
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_typst,
            template_info,
            generate_paper,
            save_pdf_as,
            open_pdf,
            load_config,
            save_config,
            export_config,
            import_config,
            read_catalog_snapshot,
            create_catalog_job,
            open_wechat_login,
            wechat_login_state,
            resolve_wechat_share_link,
            crawl_wechat_article_list,
            crawl_wechat_links_batch
        ])
        .run(tauri::generate_context!())
        .expect("QuizLab 启动失败");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_config_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!(
            "quizlab-config-{name}-{}-{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn export_change_import_restores_previous_settings() {
        let dir = temp_config_dir("roundtrip");
        let exported = json!({
            "grade": "3A",
            "level": "L2",
            "types": ["kousuan", "tiankong"],
            "counts": { "kousuan": 20, "tiankong": 10 }
        });
        let file = dir.join("settings.json");
        export_config_to(&file, &exported).unwrap();

        // 导出后把当前设置改掉
        let changed = json!({ "grade": "3A", "level": "L3", "types": ["word"], "counts": { "word": 8 } });
        save_config_to_dir(&dir, &changed).unwrap();
        assert_eq!(read_config_file(&dir.join("config.json")).unwrap(), changed);

        // 从导出文件导入，应回到导出时的设置
        let restored = import_config_from(&file).unwrap();
        assert_eq!(restored, exported);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn import_rejects_invalid_files_without_touching_config() {
        let dir = temp_config_dir("invalid-import");
        let current = json!({ "grade": "3A", "level": "L2" });
        save_config_to_dir(&dir, &current).unwrap();

        let file = dir.join("bad.json");
        for bad in ["{bad json", "", "[1, 2]", "null"] {
            fs::write(&file, bad).unwrap();
            assert!(import_config_from(&file).is_err(), "非法文件应被拒绝：{bad}");
            // 当前配置保持原样
            assert_eq!(
                read_config_file(&dir.join("config.json")).unwrap(),
                current,
                "导入失败不得写入当前配置"
            );
        }

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn broken_config_falls_back_to_latest_backup() {
        let dir = temp_config_dir("fallback");
        let first = json!({ "level": "L1", "counts": { "kousuan": 10 } });
        let second = json!({ "level": "L2", "counts": { "kousuan": 20 } });

        save_config_to_dir(&dir, &first).unwrap();
        save_config_to_dir(&dir, &second).unwrap();
        assert!(config_backup_path(&dir, 1).is_file(), "第二次保存应留下 .bak.1");

        // 主文件被同步工具截断
        fs::write(dir.join("config.json"), "{\"level\":\"L2\",\"counts\":{\"kousuan\":2").unwrap();
        let loaded = load_config_from_dir(&dir);
        assert_eq!(loaded.config, first, "应回落到最近一份可用备份");
        assert!(loaded.notice.is_some(), "回落时必须有提示");
        assert!(loaded.recovered_from.is_some(), "应记录回落来源");
        assert!(
            fs::read_dir(&dir)
                .unwrap()
                .filter_map(|entry| entry.ok())
                .any(|entry| entry.file_name().to_string_lossy().contains(".corrupt-")),
            "损坏文件应改名留证"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn empty_config_does_not_crash() {
        let dir = temp_config_dir("empty");
        fs::write(dir.join("config.json"), "").unwrap();
        let loaded = load_config_from_dir(&dir);
        assert_eq!(loaded.config, json!({}), "空设置按默认开始");
        assert!(loaded.notice.is_some(), "空设置应提示");

        // 空文件重新保存后应恢复正常
        save_config_to_dir(&dir, &json!({ "level": "L2" })).unwrap();
        let loaded = load_config_from_dir(&dir);
        assert_eq!(loaded.config, json!({ "level": "L2" }));
        assert!(loaded.notice.is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn backups_roll_and_keep_at_most_three() {
        let dir = temp_config_dir("rotate");
        for index in 0..=CONFIG_BACKUPS {
            let value = json!({ "round": index });
            save_config_to_dir(&dir, &value).unwrap();
        }
        assert!(config_backup_path(&dir, 1).is_file());
        assert!(config_backup_path(&dir, 2).is_file());
        assert!(config_backup_path(&dir, 3).is_file());
        assert!(!config_backup_path(&dir, 4).exists(), "最多保留三份备份");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn catalog_job_writes_named_file_and_rejects_bad_ids() {
        let dir = temp_config_dir("catalog-job");
        let id = "20261107-153012";
        let job = json!({
            "id": id,
            "createdAt": "2026-11-07T15:30:12+08:00",
            "targetCount": 20,
            "sources": ["chinafable"],
            "wordMin": 300,
            "wordMax": 500,
            "requireAnswer": false,
            "note": "",
            "status": "pending"
        });

        let path = write_catalog_job_to_dir(&dir, id, &job).unwrap();
        assert!(
            path.ends_with("jobs/20261107-153012.job.json"),
            "任务单路径不正确：{}",
            path.display()
        );
        let written: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(written, job, "写出的任务单内容应与输入一致");

        assert!(
            write_catalog_job_to_dir(&dir, "../evil", &job).is_err(),
            "非时间编号必须拒绝"
        );
        assert!(
            write_catalog_job_to_dir(&dir, id, &json!({ "id": "other" })).is_err(),
            "编号不一致必须拒绝"
        );
        assert!(
            write_catalog_job_to_dir(&dir, id, &json!([1, 2])).is_err(),
            "非对象内容必须拒绝"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn wechat_login_cookie_detection() {
        let anonymous = vec![Cookie::new("poc_sid", "anonymous")];
        assert!(!wechat_logged_in(&anonymous), "只有游客 cookie 时不算登录");

        let empty = vec![Cookie::new("slave_sid", "")];
        assert!(!wechat_logged_in(&empty), "空 slave_sid 不算登录");

        let logged = vec![
            Cookie::new("poc_sid", "anonymous"),
            Cookie::new("slave_sid", "session"),
        ];
        assert!(wechat_logged_in(&logged), "有 slave_sid 即视为已登录");
    }

    #[test]
    fn wechat_share_link_extracts_biz_title_and_account() {
        let html = r#"<html><head><meta property="og:title" content="三年级滑坡现象之阅读理解" /></head><body>
<script>var biz = "" || "MzUxNTU0NjQ2Mg=="; var msg_title = "三年级滑坡现象之阅读理解"; var nickname = "涵涵妈聊绘本";</script>
</body></html>"#;
        let resolved = wechat_resolved_from_html(html, None).unwrap();
        assert_eq!(resolved.biz, "MzUxNTU0NjQ2Mg==");
        assert_eq!(resolved.title.as_deref(), Some("三年级滑坡现象之阅读理解"));
        assert_eq!(resolved.account_name.as_deref(), Some("涵涵妈聊绘本"));
    }

    #[test]
    fn wechat_biz_from_og_url_is_percent_decoded() {
        let html = r#"<meta property="og:url" content="http://mp.weixin.qq.com/s?__biz=MzUxNTU0NjQ2Mg%3D%3D&amp;mid=2">"#;
        assert_eq!(
            extract_wechat_biz(html).as_deref(),
            Some("MzUxNTU0NjQ2Mg==")
        );
    }

    #[test]
    fn wechat_biz_rejects_non_mz_values() {
        assert!(!is_standard_biz("170001"));
        assert!(!is_standard_biz("MzU5"));
        assert!(!is_standard_biz(""));
        assert!(is_standard_biz("MzUxNTU0NjQ2Mg=="));

        // 页面里只有 170001 时不能当成账号标识
        let html = r#"<a href="http://mp.weixin.qq.com/s?__biz=170001&mid=1">x</a>"#;
        assert_eq!(extract_wechat_biz(html), None);
    }

    #[test]
    fn wechat_biz_prefers_var_biz_over_stray_query() {
        // 真实页面常见：var biz 先给空串，页面其它地方有 __biz=170001
        let html = r#"<script>var biz = ""; var other = 1;</script>
<a href="http://mp.weixin.qq.com/s?__biz=170001">x</a>
<script>var biz = "MzUxNTU0NjQ2Mg==";</script>"#;
        assert_eq!(
            extract_wechat_biz(html).as_deref(),
            Some("MzUxNTU0NjQ2Mg==")
        );
    }

    #[test]
    fn wechat_home_prefix_redacts_tokens() {
        let html = r#"<script>var pass_ticket = "SECRET-TICKET-123456"; var key = "SECRETKEY123456";</script><body>请在微信客户端打开链接。</body>"#;
        let redacted = wechat_redact_secrets(html);
        assert!(!redacted.contains("SECRET-TICKET-123456"), "pass_ticket 不应出现在诊断里");
        assert!(!redacted.contains("SECRETKEY123456"), "key 不应出现在诊断里");
        assert!(redacted.contains("[已隐藏]"));
    }

    #[test]
    fn wechat_home_block_reports_desktop_unavailable() {
        let html = r#"<html><head><title>验证</title></head><body>请在微信客户端打开链接。</body></html>"#;
        let message = wechat_home_block_error(200, html, "该链接需要在微信客户端内打开");
        assert!(message.contains("桌面端不可行"));
        assert!(message.contains("home HTTP 200"));
        assert!(message.contains("验证"));
        assert!(message.contains("getmsg 未发起"));
    }

    #[test]
    fn wechat_diagnostics_show_status_ret_errmsg_and_token_flags() {
        let envelope = json!({
            "homeHttpStatus": 200,
            "homeTitle": "历史消息",
            "responsePrefix": "{\"ret\":-3",
            "tokens": {"uin": true, "key": false, "pass_ticket": true, "appmsg_token": false}
        });
        let diagnostics = wechat_envelope_diagnostics(&envelope, 200, Some(-3), "");
        assert!(diagnostics.contains("home HTTP 200"));
        assert!(diagnostics.contains("getmsg HTTP 200"));
        assert!(diagnostics.contains("ret=-3"));
        assert!(diagnostics.contains("errmsg=空"));
        assert!(diagnostics.contains("uin=有"));
        assert!(diagnostics.contains("key=无"));
        assert!(diagnostics.contains("pass_ticket=有"));
        assert!(diagnostics.contains("appmsg_token=无"));
    }

    #[test]
    fn wechat_share_link_reports_readable_reasons() {
        for (html, expect) in [
            ("<html>请在微信客户端打开链接</html>", "微信客户端"),
            ("<html>当前环境异常，完成验证后即可继续访问</html>", "验证"),
            ("<html>该内容已被发布者删除</html>", "删除"),
        ] {
            let error = wechat_resolved_from_html(html, None).unwrap_err();
            assert!(
                error.contains(expect),
                "错误原因应包含「{expect}」，实际为：{error}"
            );
        }

        let missing = wechat_resolved_from_html("<html>nothing here</html>", None).unwrap_err();
        assert!(
            missing.contains("账号标识"),
            "没找到 biz 时要说清原因，实际为：{missing}"
        );
        assert!(wechat_resolved_from_html("  ", None).is_err());
    }

    #[test]
    fn wechat_share_link_rejects_foreign_hosts() {
        assert!(wechat_article_url("https://example.com/s?__biz=MzU5").is_err());
        assert!(wechat_article_url("ftp://mp.weixin.qq.com/s").is_err());
        assert!(wechat_article_url("   ").is_err());
        assert!(wechat_article_url("https://mp.weixin.qq.com/s/AbCdEfGh").is_ok());
    }

    #[test]
    fn wechat_list_page_parses_articles_and_paging() {
        let inner = json!({
            "list": [{
                "comm_msg_info": { "datetime": 1700000000_i64 },
                "app_msg_ext_info": {
                    "title": "三年级上册语文课内阅读理解专项练习（4），附答案",
                    "content_url": "http://mp.weixin.qq.com/s?__biz=MzU5&mid=2&idx=1&sn=abc",
                    "multi_app_msg_item_list": [{
                        "title": "三年级 课外阅读短文练习",
                        "content_url": "http://mp.weixin.qq.com/s?__biz=MzU5&mid=2&idx=2&sn=def"
                    }]
                }
            }]
        });
        let outer = json!({
            "ret": 0,
            "errmsg": "ok",
            "next_offset": 20,
            "can_msg_continue": 1,
            "general_msg_list": inner.to_string()
        });

        let (articles, next_offset, can_continue) =
            parse_wechat_list_page(&outer.to_string(), 10).unwrap();
        assert_eq!(articles.len(), 2, "主篇 + 次篇都要收进清单");
        assert!(articles[0].title.contains("三年级"));
        assert!(articles[0].link.starts_with("https://mp.weixin.qq.com/s?"));
        assert_eq!(articles[0].published_at, Some(1700000000));
        assert_eq!(next_offset, 20);
        assert!(can_continue);
    }

    #[test]
    fn wechat_list_page_reports_login_and_verify_errors() {
        let expired = json!({ "ret": -3, "errmsg": "" }).to_string();
        let reason = parse_wechat_list_page(&expired, 0).unwrap_err();
        assert!(reason.contains("登录态已失效"), "实际：{reason}");

        let verify = parse_wechat_list_page("<html>当前环境异常，完成验证后即可继续访问</html>", 0)
            .unwrap_err();
        assert!(verify.contains("验证") || verify.contains("环境异常"), "实际：{verify}");
    }

    #[test]
    fn link_batch_summary_reads_stats_and_fail_reasons() {
        let report = json!({
            "batch": "20261107-221948",
            "stats": {"success": 2, "skipped": 1, "failed": 3, "imported": 1, "pendingQuestions": 1,
                      "splitArticles": 1, "splitUnits": 7, "splitWordPassed": 3,
                      "splitPassed": 1, "needsSplit": 1},
            "failReasons": {"字数不符": 1, "过期": 2},
            "entries": [{}, {}, {}, {}, {}, {}]
        });
        let summary = link_batch_summary_of(
            &report,
            "data/reading-catalog/link-batch/20261107-221948/report.json",
        );
        assert_eq!(summary.batch, "20261107-221948");
        assert_eq!(summary.total, 6);
        assert_eq!(summary.success, 2);
        assert_eq!(summary.skipped, 1);
        assert_eq!(summary.failed, 3);
        assert_eq!(summary.imported, 1);
        assert_eq!(summary.pending_questions, 1);
        assert_eq!(summary.split_articles, 1);
        assert_eq!(summary.split_units, 7);
        assert_eq!(summary.split_word_passed, 3);
        assert_eq!(summary.split_passed, 1);
        assert_eq!(summary.needs_split, 1);
        assert_eq!(
            summary.report_path,
            "data/reading-catalog/link-batch/20261107-221948/report.json"
        );
        // 失败原因按数量倒序：过期 2 在前
        assert_eq!(summary.fail_reasons[0].reason, "过期");
        assert_eq!(summary.fail_reasons[0].count, 2);
        assert_eq!(summary.fail_reasons[1].reason, "字数不符");
    }
}
