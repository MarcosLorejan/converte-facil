mod engine;

use engine::EngineStatus;

#[tauri::command]
fn get_engine_status() -> EngineStatus {
    engine::detect_engines()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_engine_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
