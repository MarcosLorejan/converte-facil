use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub available: bool,
    pub name: String,
    pub detail: Option<String>,
    /// True when the tool was resolved from app-bundled sidecars, not PATH.
    pub bundled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub imagemagick: ToolStatus,
    pub ghostscript: ToolStatus,
}

/// Set by `run()` from Tauri's resource directory (production installs).
static RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

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

pub fn detect_engines() -> EngineStatus {
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
    }
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

/// Convert each PDF page into an image file in `output_dir`.
/// Writes `page-001.ext`, `page-002.ext`, … (1-based).
/// `format` must be `png` or `jpg`.
pub fn convert_pdf_to_images(
    input_path: &str,
    output_dir: &str,
    format: &str,
) -> Result<u32, String> {
    let ext = match format {
        "png" | "jpg" => format,
        _ => return Err("invalid_format".into()),
    };

    let engines = detect_engines();
    if !engines.imagemagick.available {
        return Err("missing_imagemagick".into());
    }
    if !engines.ghostscript.available {
        return Err("missing_ghostscript".into());
    }

    let before = page_file_names(output_dir, ext);
    let pattern = std::path::Path::new(output_dir)
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
        return Err(tool_error(code, &output.stderr, &output.stdout));
    }

    let after = page_file_names(output_dir, ext);
    let page_count = after.difference(&before).count() as u32;
    if page_count == 0 {
        return Err("convert_failed".into());
    }
    Ok(page_count)
}

/// Combine image files into a single PDF at `output_path`.
/// Order of `input_paths` is the page order.
pub fn combine_images_to_pdf(input_paths: &[String], output_path: &str) -> Result<(), String> {
    if input_paths.is_empty() {
        return Err("no_inputs".into());
    }

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

#[cfg(test)]
mod tests {
    use super::{classify_pdf_tool_failure, first_line, tool_error, tool_output_detail};

    #[test]
    fn first_line_skips_blanks() {
        assert_eq!(first_line("\n\nHello\nWorld"), Some("Hello".into()));
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
}
