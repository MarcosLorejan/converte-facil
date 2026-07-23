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

#[cfg(test)]
mod tests {
    use super::first_line;

    #[test]
    fn first_line_skips_blanks() {
        assert_eq!(first_line("\n\nHello\nWorld"), Some("Hello".into()));
    }
}
