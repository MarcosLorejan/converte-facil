use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub available: bool,
    pub name: String,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub imagemagick: ToolStatus,
    pub ghostscript: ToolStatus,
}

fn first_line(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
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
                };
            }
            _ => continue,
        }
    }

    ToolStatus {
        available: false,
        name: display_name,
        detail: None,
    }
}

pub fn detect_engines() -> EngineStatus {
    // On Windows, never fall back to `convert` — it collides with System32\convert.exe.
    #[cfg(windows)]
    let imagemagick = probe_command(&["magick"], &["-version"]);
    #[cfg(not(windows))]
    let imagemagick = probe_command(&["magick", "convert"], &["-version"]);

    EngineStatus {
        imagemagick,
        ghostscript: probe_command(&["gswin64c", "gswin32c", "gs"], &["-version"]),
    }
}

/// Convert `input_path` to `output_path` with ImageMagick.
/// Returns stable error codes for the UI to translate.
pub fn convert_image(input_path: &str, output_path: &str) -> Result<(), String> {
    let imagemagick = detect_engines().imagemagick;
    if !imagemagick.available {
        return Err("missing_imagemagick".into());
    }

    let output = Command::new(&imagemagick.name)
        .arg(input_path)
        .arg(output_path)
        .output()
        .map_err(|_| "spawn_failed".to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err("convert_failed".into())
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

    let mut command = Command::new(&engines.imagemagick.name);
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
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
        if stderr.contains("ghostscript") || stderr.contains("delegate") {
            return Err("missing_ghostscript".into());
        }
        return Err("convert_failed".into());
    }

    let after = page_file_names(output_dir, ext);
    let page_count = after.difference(&before).count() as u32;
    if page_count == 0 {
        return Err("convert_failed".into());
    }
    Ok(page_count)
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
    use super::first_line;

    #[test]
    fn first_line_skips_blanks() {
        assert_eq!(first_line("\n\nHello\nWorld"), Some("Hello".into()));
    }
}
