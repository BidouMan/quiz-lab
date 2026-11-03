use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};

use base64::Engine;
use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

const TYPST_DATA_ARG: &str = "/.quizlab/paper-data.json";
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

#[tauri::command]
fn generate_paper(
    data: Value,
    typst_path: Option<String>,
    save_to: Option<String>,
) -> Result<GenerateResult, String> {
    let root = project_root()?;
    let typst = resolve_typst(typst_path)?;
    let version = typst_version(&typst)?;

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
        .arg("typst/paper.typ")
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

    let layout = run_layout_check(&root, &output_path);

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

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<Value, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用配置目录：{e}"))?;
    migrate_legacy_config(&dir);
    let path = dir.join("config.json");
    if !path.is_file() {
        return Ok(Value::Object(Default::default()));
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("无法读取配置 {}：{e}", path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("配置文件格式错误：{e}"))
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: Value) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用配置目录：{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建配置目录 {}：{e}", dir.display()))?;
    let path = dir.join("config.json");
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("配置序列化失败：{e}"))?;
    fs::write(&path, raw).map_err(|e| format!("无法写入配置 {}：{e}", path.display()))
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
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("QuizLab 启动失败");
}
