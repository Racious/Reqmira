//! Environment 相關 command：列出 workspace 內的環境變數檔。

use crate::error::AppResult;
use crate::models::Environment;
use crate::services::file_store;

#[tauri::command]
pub fn list_environments(root: String) -> AppResult<Vec<Environment>> {
    file_store::list_environments(&root)
}
