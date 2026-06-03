//! Collection 相關 command：tree 掃描、request 讀寫刪。

use crate::error::AppResult;
use crate::models::{CollectionNode, RequestSpec};
use crate::services::file_store;

#[tauri::command]
pub fn list_collections(root: String) -> AppResult<Vec<CollectionNode>> {
    file_store::list_collections(&root)
}

#[tauri::command]
pub fn load_request(root: String, path: String) -> AppResult<RequestSpec> {
    file_store::load_request(&root, &path)
}

#[tauri::command]
pub fn save_request(root: String, path: String, spec: RequestSpec) -> AppResult<()> {
    file_store::save_request(&root, &path, &spec)
}

#[tauri::command]
pub fn delete_request(root: String, path: String) -> AppResult<()> {
    file_store::delete_request(&root, &path)
}

#[tauri::command]
pub fn create_folder(root: String, path: String) -> AppResult<()> {
    file_store::create_folder(&root, &path)
}

#[tauri::command]
pub fn rename_entry(root: String, from: String, to: String) -> AppResult<()> {
    file_store::rename_entry(&root, &from, &to)
}

#[tauri::command]
pub fn delete_entry(root: String, path: String) -> AppResult<()> {
    file_store::delete_entry(&root, &path)
}
