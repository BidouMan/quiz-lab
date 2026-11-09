use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::Manager;

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

    if let Some(dest) = save_to {
        let dest = expand_home(&dest);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
        }
        fs::copy(&output_path, &dest)
            .map_err(|e| format!("无法保存到 {}：{e}", dest.display()))?;
    }

    let bytes = fs::read(&output_path)
        .map_err(|e| format!("无法读取生成的 PDF {}：{e}", output_path.display()))?;
    let pdf_base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(GenerateResult {
        output_path: output_path.display().to_string(),
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
            import_config
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
}
