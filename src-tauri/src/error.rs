//! 統一錯誤型別。所有 command 回傳 `Result<T, AppError>`，
//! AppError 序列化為字串，前端以 `catch` 取得可讀訊息。

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("HTTP 請求失敗：{0}")]
    Http(String),

    #[error("檔案讀寫失敗：{0}")]
    Io(String),

    #[error("YAML 解析/序列化失敗：{0}")]
    Yaml(String),

    #[error("無效的請求設定：{0}")]
    Invalid(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_yaml::Error> for AppError {
    fn from(e: serde_yaml::Error) -> Self {
        AppError::Yaml(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        // reqwest 的頂層訊息常只說「error sending request」，真因藏在 source chain
        // （如 invalid certificate / connection refused）。逐層串接，讓使用者看得到病灶。
        use std::error::Error;
        let mut msg = e.to_string();
        let mut src = e.source();
        while let Some(cause) = src {
            let detail = cause.to_string();
            // 避免重複串接相同片段
            if !msg.contains(&detail) {
                msg.push_str("：");
                msg.push_str(&detail);
            }
            src = cause.source();
        }
        AppError::Http(msg)
    }
}

// 讓 AppError 能直接被 Tauri command 序列化回前端。
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
