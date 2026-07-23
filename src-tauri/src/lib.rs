mod engine;

use engine::EngineStatus;

#[tauri::command]
fn get_engine_status() -> EngineStatus {
    engine::detect_engines()
}

#[tauri::command]
fn convert_image(input_path: String, output_path: String) -> Result<(), String> {
    engine::convert_image(&input_path, &output_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_engine_status, convert_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
