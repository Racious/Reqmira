//! Reqmira — 輕量 API 工作台（Tauri 後端進入點）。
//!
//! 架構（見定稿 §5）：前端 Vue 僅負責呈現，所有 HTTP 流量與檔案讀寫
//! 一律經此 Rust 核心，藉此繞過 CORS 並取得原生效能。

mod commands;
mod error;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::request::send_request,
            commands::collection::list_collections,
            commands::collection::load_request,
            commands::collection::save_request,
            commands::collection::delete_request,
            commands::collection::create_folder,
            commands::collection::rename_entry,
            commands::collection::delete_entry,
            commands::env::list_environments,
            commands::analyze::diff_json,
            commands::flow::list_flows,
            commands::flow::load_flow,
            commands::workspace::probe_workspace,
            commands::workspace::init_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
