//! Flow 相關 command：列出與讀取自動化流程定義。

use crate::error::AppResult;
use crate::models::{FlowSpec, FlowSummary};
use crate::services::file_store;

#[tauri::command]
pub fn list_flows(root: String) -> AppResult<Vec<FlowSummary>> {
    file_store::list_flows(&root)
}

#[tauri::command]
pub fn load_flow(root: String, path: String) -> AppResult<FlowSpec> {
    file_store::load_flow(&root, &path)
}
