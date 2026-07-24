mod engine;

use engine::{EngineStatus, PdfToImagesResult};
use tauri::Manager;

#[tauri::command]
fn get_engine_status() -> EngineStatus {
    engine::refresh_engines()
}

#[tauri::command]
fn convert_image(input_path: String, output_path: String) -> Result<(), String> {
    engine::convert_image(&input_path, &output_path)
}

#[tauri::command]
fn convert_pdf_to_images(
    input_path: String,
    output_dir: String,
    format: String,
    quality: Option<String>,
) -> Result<PdfToImagesResult, String> {
    let quality = quality.as_deref().unwrap_or("normal");
    engine::convert_pdf_to_images(&input_path, &output_dir, &format, quality)
}

#[tauri::command]
fn combine_images_to_pdf(input_paths: Vec<String>, output_path: String) -> Result<(), String> {
    engine::combine_images_to_pdf(&input_paths, &output_path)
}

#[tauri::command]
fn convert_document_to_pdf(input_path: String, output_path: String) -> Result<(), String> {
    engine::convert_document_to_pdf(&input_path, &output_path)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    engine::path_exists(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Ok(resource_dir) = app.path().resource_dir() {
                engine::set_resource_dir(resource_dir);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_engine_status,
            convert_image,
            convert_pdf_to_images,
            combine_images_to_pdf,
            convert_document_to_pdf,
            path_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
