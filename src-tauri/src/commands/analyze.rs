//! 分析相關 command：JSON 結構化 diff。

use crate::error::AppResult;
use crate::models::DiffEntry;
use crate::services::deep_diff;

/// 比對兩段 JSON，回傳差異條目（unchanged 不列出）。
#[tauri::command]
pub fn diff_json(left: String, right: String) -> AppResult<Vec<DiffEntry>> {
    deep_diff::diff_json(&left, &right)
}
