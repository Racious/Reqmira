//! Request 相關 command：發送 HTTP。

use indexmap::IndexMap;

use crate::error::AppResult;
use crate::models::{HttpResponse, SendRequest};
use crate::services::request_runner;

/// 發送一筆 HTTP 請求。`variables` 為目前環境的變數表，用於 `{{var}}` 解析。
#[tauri::command]
pub async fn send_request(
    request: SendRequest,
    variables: IndexMap<String, String>,
) -> AppResult<HttpResponse> {
    request_runner::send(request, &variables).await
}
