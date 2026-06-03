//! Workspace 相關 command：探測與初始化工作區。

use crate::error::AppResult;
use crate::models::WorkspaceProbe;
use crate::services::file_store;

/// 探測資料夾是否為（或內含 reqmira/）工作區。
#[tauri::command]
pub fn probe_workspace(path: String) -> WorkspaceProbe {
    file_store::probe_workspace(&path)
}

/// 在 parent 下建立 reqmira/ 工作區骨架，回傳工作區根路徑。
#[tauri::command]
pub fn init_workspace(parent: String) -> AppResult<String> {
    file_store::init_workspace(&parent)
}
