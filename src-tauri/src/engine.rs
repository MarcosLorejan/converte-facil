use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub available: bool,
    pub name: String,
    pub detail: Option<String>,
    /// True when the tool was resolved from app-bundled sidecars, not PATH.
    pub bundled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub imagemagick: ToolStatus,
    pub ghostscript: ToolStatus,
    pub libreoffice: ToolStatus,
}

/// Set by `run()` from Tauri's resource directory (production installs).
static RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Cached Magick / Ghostscript / LibreOffice probe results (cleared on refresh).
static ENGINE_CACHE: Mutex<Option<EngineStatus>> = Mutex::new(None);

pub fn set_resource_dir(path: PathBuf) {
    let _ = RESOURCE_DIR.set(path);
}

fn first_line(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

/// Reject empty paths and Magick/CLI flag-like path segments (e.g. `-resize`).
fn path_looks_unsafe(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return true;
    }

    let normalized = trimmed.trim_start_matches(r"\\?\");
    Path::new(normalized).components().any(|component| {
        let raw = component.as_os_str().to_string_lossy();
        raw.starts_with('-')
    })
}

fn validate_absolute_path(path: &str) -> Result<&Path, String> {
    if path_looks_unsafe(path) {
        return Err("invalid_path".into());
    }
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err("invalid_path".into());
    }
    Ok(p)
}

fn validate_existing_file(path: &str) -> Result<&Path, String> {
    let p = validate_absolute_path(path)?;
    if !p.is_file() {
        return Err("invalid_path".into());
    }
    Ok(p)
}

fn validate_output_file_path(path: &str) -> Result<&Path, String> {
    let p = validate_absolute_path(path)?;
    if p
        .file_name()
        .map(|name| name.to_string_lossy().starts_with('-'))
        .unwrap_or(true)
    {
        return Err("invalid_path".into());
    }
    Ok(p)
}

fn validate_output_dir(path: &str) -> Result<&Path, String> {
    let p = validate_absolute_path(path)?;
    if !p.is_dir() {
        return Err("invalid_path".into());
    }
    Ok(p)
}

fn probe_binary(path: &Path, args: &[&str]) -> Option<String> {
    match Command::new(path).args(args).output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            first_line(&stdout).or_else(|| first_line(&stderr))
        }
        _ => None,
    }
}

fn probe_command(candidates: &[&str], args: &[&str]) -> ToolStatus {
    let display_name = candidates
        .first()
        .copied()
        .unwrap_or("tool")
        .to_string();

    for binary in candidates {
        match Command::new(binary).args(args).output() {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let detail = first_line(&stdout).or_else(|| first_line(&stderr));
                return ToolStatus {
                    available: true,
                    name: binary.to_string(),
                    detail,
                    bundled: false,
                };
            }
            _ => continue,
        }
    }

    ToolStatus {
        available: false,
        name: display_name,
        detail: None,
        bundled: false,
    }
}

fn sidecar_search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(dir) = RESOURCE_DIR.get() {
        roots.push(dir.clone());
        roots.push(dir.join("sidecars"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.push(parent.to_path_buf());
            roots.push(parent.join("sidecars"));
        }
    }

    // Dev / `tauri build` workspace layout (binaries live under src-tauri/sidecars).
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecars"));

    roots
}

#[cfg(windows)]
fn magick_file_name() -> &'static str {
    "magick.exe"
}

#[cfg(not(windows))]
fn magick_file_name() -> &'static str {
    "magick"
}

#[cfg(windows)]
fn ghostscript_file_names() -> &'static [&'static str] {
    &["gswin64c.exe", "gswin32c.exe"]
}

#[cfg(not(windows))]
fn ghostscript_file_names() -> &'static [&'static str] {
    &["gs"]
}

fn find_bundled_magick() -> Option<(PathBuf, String)> {
    for root in sidecar_search_roots() {
        let candidate = root.join("imagemagick").join(magick_file_name());
        if candidate.is_file() {
            if let Some(detail) = probe_binary(&candidate, &["-version"]) {
                return Some((candidate, detail));
            }
        }
    }
    None
}

fn find_bundled_ghostscript() -> Option<(PathBuf, String)> {
    for root in sidecar_search_roots() {
        for name in ghostscript_file_names() {
            let candidate = root.join("ghostscript").join(name);
            if candidate.is_file() {
                if let Some(detail) = probe_binary(&candidate, &["-version"]) {
                    return Some((candidate, detail));
                }
            }
        }
    }
    None
}

#[cfg(windows)]
fn soffice_file_name() -> &'static str {
    "soffice.exe"
}

#[cfg(not(windows))]
fn soffice_file_name() -> &'static str {
    "soffice"
}

fn find_soffice_in_dir(dir: &Path) -> Option<PathBuf> {
    let candidate = dir.join(soffice_file_name());
    if candidate.is_file() {
        Some(candidate)
    } else {
        None
    }
}

/// System LibreOffice only (ADR 0002 — not shipped in the default installer).
fn find_system_libreoffice() -> Option<(PathBuf, String)> {
    #[cfg(windows)]
    {
        let mut roots = Vec::new();
        for key in ["PROGRAMFILES", "PROGRAMFILES(X86)", "ProgramW6432"] {
            if let Ok(dir) = std::env::var(key) {
                roots.push(PathBuf::from(dir));
            }
        }
        for root in roots {
            if let Some(path) = find_soffice_in_dir(&root.join("LibreOffice").join("program")) {
                if let Some(detail) = probe_binary(&path, &["--version"]) {
                    return Some((path, detail));
                }
            }
            if let Ok(entries) = std::fs::read_dir(&root) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if !name.starts_with("libreoffice") {
                        continue;
                    }
                    if let Some(path) = find_soffice_in_dir(&entry.path().join("program")) {
                        if let Some(detail) = probe_binary(&path, &["--version"]) {
                            return Some((path, detail));
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        for dir in [
            "/usr/bin",
            "/usr/lib/libreoffice/program",
            "/usr/lib64/libreoffice/program",
            "/Applications/LibreOffice.app/Contents/MacOS",
        ] {
            if let Some(path) = find_soffice_in_dir(Path::new(dir)) {
                if let Some(detail) = probe_binary(&path, &["--version"]) {
                    return Some((path, detail));
                }
            }
        }
    }

    #[cfg(windows)]
    let status = probe_command(&["soffice.exe", "soffice"], &["--version"]);
    #[cfg(not(windows))]
    let status = probe_command(&["soffice", "libreoffice"], &["--version"]);

    if status.available {
        Some((
            PathBuf::from(&status.name),
            status.detail.unwrap_or_default(),
        ))
    } else {
        None
    }
}

fn detect_libreoffice() -> ToolStatus {
    if let Some((path, detail)) = find_system_libreoffice() {
        ToolStatus {
            available: true,
            name: path.to_string_lossy().into_owned(),
            detail: if detail.is_empty() {
                None
            } else {
                Some(detail)
            },
            bundled: false,
        }
    } else {
        ToolStatus {
            available: false,
            name: soffice_file_name().to_string(),
            detail: None,
            bundled: false,
        }
    }
}

/// Probe Magick / Ghostscript / LibreOffice without reading the cache.
fn probe_engines() -> EngineStatus {
    let imagemagick = if let Some((path, detail)) = find_bundled_magick() {
        ToolStatus {
            available: true,
            name: path.to_string_lossy().into_owned(),
            detail: Some(detail),
            bundled: true,
        }
    } else {
        // On Windows, never fall back to `convert` — it collides with System32\convert.exe.
        #[cfg(windows)]
        let status = probe_command(&["magick"], &["-version"]);
        #[cfg(not(windows))]
        let status = probe_command(&["magick", "convert"], &["-version"]);
        status
    };

    let ghostscript = if let Some((path, detail)) = find_bundled_ghostscript() {
        ToolStatus {
            available: true,
            name: path.to_string_lossy().into_owned(),
            detail: Some(detail),
            bundled: true,
        }
    } else {
        probe_command(&["gswin64c", "gswin32c", "gs"], &["-version"])
    };

    EngineStatus {
        imagemagick,
        ghostscript,
        libreoffice: detect_libreoffice(),
    }
}

/// Return cached engine status, probing once on first use.
pub fn detect_engines() -> EngineStatus {
    {
        let guard = ENGINE_CACHE
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(cached) = guard.as_ref() {
            return cached.clone();
        }
    }

    let status = probe_engines();
    if let Ok(mut guard) = ENGINE_CACHE.lock() {
        *guard = Some(status.clone());
    }
    status
}

/// Clear the cache and probe again (UI refresh / Check again).
pub fn refresh_engines() -> EngineStatus {
    let status = probe_engines();
    if let Ok(mut guard) = ENGINE_CACHE.lock() {
        *guard = Some(status.clone());
    }
    status
}

/// Prefers bundled Magick/Ghostscript directories on PATH so delegates and DLLs resolve.
fn prepare_command(program: &str) -> Command {
    let mut command = Command::new(program);
    let mut path_dirs: Vec<PathBuf> = Vec::new();

    let program_path = Path::new(program);
    if program_path.is_absolute() || program_path.components().count() > 1 {
        if let Some(dir) = program_path.parent() {
            path_dirs.push(dir.to_path_buf());
        }
    }

    if let Some((gs_path, _)) = find_bundled_ghostscript() {
        if let Some(dir) = gs_path.parent() {
            path_dirs.push(dir.to_path_buf());
        }
    }

    if !path_dirs.is_empty() {
        let extra = std::env::join_paths(
            path_dirs
                .into_iter()
                .chain(std::env::var_os("PATH").map_or_else(Vec::new, |p| {
                    std::env::split_paths(&p).collect()
                })),
        )
        .ok();
        if let Some(path) = extra {
            command.env("PATH", path);
        }
    }

    command
}

/// Stable error code, optionally followed by a newline and technical detail
/// (Magick/Ghostscript stderr) for the UI Details disclosure.
fn tool_error(code: &str, stderr: &[u8], stdout: &[u8]) -> String {
    let detail = tool_output_detail(stderr, stdout);
    if detail.is_empty() {
        code.to_string()
    } else {
        format!("{code}\n{detail}")
    }
}

fn tool_output_detail(stderr: &[u8], stdout: &[u8]) -> String {
    let err = String::from_utf8_lossy(stderr);
    let out = String::from_utf8_lossy(stdout);
    let mut parts = Vec::new();
    let err_trim = err.trim();
    let out_trim = out.trim();
    if !err_trim.is_empty() {
        parts.push(err_trim);
    }
    if !out_trim.is_empty() {
        parts.push(out_trim);
    }
    let joined = parts.join("\n");
    const MAX_CHARS: usize = 2500;
    let count = joined.chars().count();
    if count > MAX_CHARS {
        let truncated: String = joined.chars().take(MAX_CHARS).collect();
        format!("{truncated}…")
    } else {
        joined
    }
}

fn classify_pdf_tool_failure(stderr: &str) -> &'static str {
    let lower = stderr.to_lowercase();
    if lower.contains("ghostscript") || lower.contains("delegate") {
        "missing_ghostscript"
    } else {
        "convert_failed"
    }
}

/// Convert `input_path` to `output_path` with ImageMagick.
/// Returns stable error codes (optional technical detail) for the UI to translate.
pub fn convert_image(input_path: &str, output_path: &str) -> Result<(), String> {
    validate_existing_file(input_path)?;
    validate_output_file_path(output_path)?;

    let imagemagick = detect_engines().imagemagick;
    if !imagemagick.available {
        return Err("missing_imagemagick".into());
    }

    let output = prepare_command(&imagemagick.name)
        .arg(input_path)
        .arg(output_path)
        .output()
        .map_err(|_| "spawn_failed".to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(tool_error(
            "convert_failed",
            &output.stderr,
            &output.stdout,
        ))
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfToImagesResult {
    pub page_count: u32,
    /// Absolute path of the unique subfolder that received `page-*.{ext}` files.
    pub output_dir: String,
}

/// Convert each PDF page into an image file under a unique subfolder of `output_dir`.
/// Writes `page-001.ext`, `page-002.ext`, … (1-based) so existing files are never overwritten.
/// `format` must be `png` or `jpg`.
pub fn convert_pdf_to_images(
    input_path: &str,
    output_dir: &str,
    format: &str,
) -> Result<PdfToImagesResult, String> {
    let ext = match format {
        "png" | "jpg" => format,
        _ => return Err("invalid_format".into()),
    };

    validate_existing_file(input_path)?;
    validate_output_dir(output_dir)?;

    let engines = detect_engines();
    if !engines.imagemagick.available {
        return Err("missing_imagemagick".into());
    }
    if !engines.ghostscript.available {
        return Err("missing_ghostscript".into());
    }

    let stem = Path::new(input_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("pdf");
    let pages_dir = unique_child_dir(Path::new(output_dir), &format!("{stem}-pages"))?;
    let pages_dir_str = pages_dir.to_string_lossy().into_owned();

    let pattern = pages_dir
        .join(format!("page-%03d.{ext}"))
        .to_string_lossy()
        .into_owned();

    let mut command = prepare_command(&engines.imagemagick.name);
    command
        .arg("-density")
        .arg("150")
        .arg(input_path)
        .arg("-scene")
        .arg("1");

    if ext == "jpg" {
        command.arg("-quality").arg("90");
    }

    let output = command
        .arg(&pattern)
        .output()
        .map_err(|_| "spawn_failed".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let code = classify_pdf_tool_failure(&stderr);
        let _ = std::fs::remove_dir_all(&pages_dir);
        return Err(tool_error(code, &output.stderr, &output.stdout));
    }

    let page_count = page_file_names(&pages_dir_str, ext).len() as u32;
    if page_count == 0 {
        let _ = std::fs::remove_dir_all(&pages_dir);
        return Err("convert_failed".into());
    }

    Ok(PdfToImagesResult {
        page_count,
        output_dir: pages_dir_str,
    })
}

/// Combine image files into a single PDF at `output_path`.
/// Order of `input_paths` is the page order.
pub fn combine_images_to_pdf(input_paths: &[String], output_path: &str) -> Result<(), String> {
    if input_paths.is_empty() {
        return Err("no_inputs".into());
    }

    for path in input_paths {
        validate_existing_file(path)?;
    }
    validate_output_file_path(output_path)?;

    let engines = detect_engines();
    if !engines.imagemagick.available {
        return Err("missing_imagemagick".into());
    }

    let mut command = prepare_command(&engines.imagemagick.name);
    for path in input_paths {
        command.arg(path);
    }
    command.arg(output_path);

    let output = command
        .output()
        .map_err(|_| "spawn_failed".to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let code = classify_pdf_tool_failure(&stderr);
        Err(tool_error(code, &output.stderr, &output.stdout))
    }
}

fn page_file_names(output_dir: &str, ext: &str) -> std::collections::HashSet<String> {
    let Ok(entries) = std::fs::read_dir(output_dir) else {
        return std::collections::HashSet::new();
    };

    entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with("page-") && name.ends_with(&format!(".{ext}")) {
                Some(name)
            } else {
                None
            }
        })
        .collect()
}

/// Create `{parent}/{base_name}` or `{parent}/{base_name}-2`, … until free.
fn unique_child_dir(parent: &Path, base_name: &str) -> Result<PathBuf, String> {
    let safe = base_name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>();
    let safe = if safe.trim().is_empty() {
        "pages".to_string()
    } else {
        safe
    };

    let mut candidate = parent.join(&safe);
    let mut index = 2u32;
    while candidate.exists() {
        candidate = parent.join(format!("{safe}-{index}"));
        index = index.saturating_add(1);
        if index > 10_000 {
            return Err("convert_failed".into());
        }
    }

    std::fs::create_dir_all(&candidate).map_err(|_| "spawn_failed".to_string())?;
    Ok(candidate)
}

pub fn path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

pub fn is_supported_document(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".docx") || lower.ends_with(".xlsx")
}

fn path_to_file_url(path: &Path) -> String {
    let raw = path.to_string_lossy();
    let normalized = raw.trim_start_matches(r"\\?\").replace('\\', "/");
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        format!("file:///{normalized}")
    }
}

fn unique_temp_dir(prefix: &str) -> Result<PathBuf, String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("{prefix}-{nanos}"));
    std::fs::create_dir_all(&dir).map_err(|_| "spawn_failed".to_string())?;
    Ok(dir)
}

fn prepare_soffice_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// Convert Word/Excel (`.docx` / `.xlsx`) to PDF via system LibreOffice headless.
pub fn convert_document_to_pdf(input_path: &str, output_path: &str) -> Result<(), String> {
    if !is_supported_document(input_path) {
        return Err("unsupported_format".into());
    }
    if !output_path.to_lowercase().ends_with(".pdf") {
        return Err("invalid_format".into());
    }

    validate_existing_file(input_path)?;
    validate_output_file_path(output_path)?;

    let libreoffice = detect_engines().libreoffice;
    if !libreoffice.available {
        return Err("missing_libreoffice".into());
    }

    let input = Path::new(input_path);
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "convert_failed".to_string())?;

    let work_dir = unique_temp_dir("converte-facil-lo-out")?;
    let profile_dir = unique_temp_dir("converte-facil-lo-profile")?;
    let profile_url = path_to_file_url(&profile_dir);

    let cleanup = |dirs: &[PathBuf]| {
        for dir in dirs {
            let _ = std::fs::remove_dir_all(dir);
        }
    };

    let output = prepare_soffice_command(&libreoffice.name)
        .arg("--headless")
        .arg("--nologo")
        .arg("--nofirststartwizard")
        .arg(format!("-env:UserInstallation={profile_url}"))
        .arg("--convert-to")
        .arg("pdf")
        .arg("--outdir")
        .arg(&work_dir)
        .arg(input_path)
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => {
            cleanup(&[work_dir, profile_dir]);
            return Err("spawn_failed".into());
        }
    };

    if !output.status.success() {
        let err = tool_error("convert_failed", &output.stderr, &output.stdout);
        cleanup(&[work_dir, profile_dir]);
        return Err(err);
    }

    let produced = work_dir.join(format!("{stem}.pdf"));
    if !produced.is_file() {
        cleanup(&[work_dir, profile_dir]);
        return Err("convert_failed".into());
    }

    if let Some(parent) = Path::new(output_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let copy_result = std::fs::copy(&produced, output_path);
    cleanup(&[work_dir, profile_dir]);

    match copy_result {
        Ok(_) => Ok(()),
        Err(_) => Err("convert_failed".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_pdf_tool_failure, first_line, is_supported_document, path_looks_unsafe,
        path_to_file_url, tool_error, tool_output_detail, unique_child_dir,
        validate_absolute_path, validate_output_file_path,
    };
    use std::path::Path;

    #[test]
    fn first_line_skips_blanks() {
        assert_eq!(first_line("\n\nHello\nWorld"), Some("Hello".into()));
    }

    #[test]
    fn rejects_flag_like_and_empty_paths() {
        assert!(path_looks_unsafe(""));
        assert!(path_looks_unsafe("   "));
        assert!(path_looks_unsafe("-resize"));
        assert!(path_looks_unsafe(r"C:\Users\-evil\photo.png"));
        assert!(!path_looks_unsafe(r"C:\Users\me\photo.png"));
        assert!(!path_looks_unsafe(r"\\?\C:\Users\me\photo.png"));
    }

    #[test]
    fn validate_absolute_path_requires_absolute() {
        assert!(validate_absolute_path("photo.png").is_err());
        assert!(validate_absolute_path(r"C:\Users\me\photo.png").is_ok());
    }

    #[test]
    fn validate_output_rejects_missing_file_name() {
        assert!(validate_output_file_path(r"C:\").is_err());
        assert!(validate_output_file_path(r"C:\Users\me\out.png").is_ok());
    }

    #[test]
    fn tool_error_code_only_when_empty_output() {
        assert_eq!(tool_error("convert_failed", b"", b""), "convert_failed");
    }

    #[test]
    fn tool_error_appends_stderr_detail() {
        let err = tool_error("convert_failed", b"no decode delegate\n", b"");
        assert!(err.starts_with("convert_failed\n"));
        assert!(err.contains("no decode delegate"));
    }

    #[test]
    fn tool_output_detail_truncates_long_text() {
        let long = "x".repeat(3000);
        let detail = tool_output_detail(long.as_bytes(), b"");
        assert!(detail.chars().count() <= 2501);
        assert!(detail.ends_with('…'));
    }

    #[test]
    fn classify_detects_ghostscript_delegate() {
        assert_eq!(
            classify_pdf_tool_failure("Delegate failed: ghostscript"),
            "missing_ghostscript"
        );
        assert_eq!(
            classify_pdf_tool_failure("unable to open image"),
            "convert_failed"
        );
    }

    #[test]
    fn document_extensions() {
        assert!(is_supported_document(r"C:\docs\Report.DOCX"));
        assert!(is_supported_document("/tmp/sheet.xlsx"));
        assert!(!is_supported_document("notes.pdf"));
        assert!(!is_supported_document("old.doc"));
    }

    #[test]
    fn unique_child_dir_avoids_existing() {
        let parent = std::env::temp_dir().join(format!(
            "converte-facil-unique-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&parent).unwrap();
        let first = unique_child_dir(&parent, "report-pages").unwrap();
        assert!(first.ends_with("report-pages"));
        let second = unique_child_dir(&parent, "report-pages").unwrap();
        assert!(second.ends_with("report-pages-2"));
        let _ = std::fs::remove_dir_all(&parent);
    }

    #[test]
    fn file_url_windows_style() {
        let url = path_to_file_url(Path::new(r"C:\Users\me\profile"));
        assert_eq!(url, "file:///C:/Users/me/profile");
    }
}
