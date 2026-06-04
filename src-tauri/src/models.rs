//! Reqmira 核心資料模型。
//!
//! 兩組型別：
//! 1. 持久化模型（RequestSpec / Environment）— 對應 workspace 內的 YAML 檔，
//!    欄位順序以 IndexMap 保留，利於 Git diff。
//! 2. 執行期模型（SendRequest / HttpResponse）— 前端發送請求時的傳輸結構。

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

fn default_version() -> u32 {
    1
}

/// 單一 API request 的持久化定義，對應 `*.api.yaml`。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestSpec {
    #[serde(default = "default_version")]
    pub version: u32,
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub headers: IndexMap<String, String>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub query: IndexMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<BodySpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs: Option<DocsSpec>,
}

/// Request body：type 為 json / text / form / none。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BodySpec {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocsSpec {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// 環境變數定義，對應 `environments/*.yaml`。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub name: String,
    #[serde(default)]
    pub variables: IndexMap<String, String>,
}

/// Collection tree 的一個節點（資料夾或 request）。
#[derive(Debug, Clone, Serialize)]
pub struct CollectionNode {
    pub name: String,
    /// 相對 workspace root 的 POSIX 路徑（資料夾為相對目錄，request 為 .api.yaml）。
    pub path: String,
    pub kind: NodeKind,
    /// request 節點才有：方便 tree 直接顯示 method 標籤。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<CollectionNode>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Folder,
    Request,
}

// ──────────────────────────── 執行期模型 ────────────────────────────

/// 前端送出的一筆鍵值（header / query），可勾選啟用。
#[derive(Debug, Clone, Deserialize)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// 前端發送請求的傳輸結構。變數已由前端帶上 `variables`，
/// 實際的 `{{var}}` 取代在 Rust 端進行。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub query: Vec<KeyValue>,
    #[serde(default)]
    pub body: Option<String>,
    /// json / text / form / none
    #[serde(default)]
    pub body_type: Option<String>,
    /// 略過 TLS 憑證驗證（自簽憑證的內網設備用）。預設 false，維持嚴格驗證。
    #[serde(default)]
    pub insecure: bool,
}

/// 回傳給前端的回應資料。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub duration_ms: u128,
    pub size_bytes: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    /// 實際送出的最終 URL（變數解析、query 拼接後），供 Inspector 顯示。
    pub final_url: String,
}

// ──────────────────────────── Workspace ────────────────────────────

/// 探測某資料夾是否為（或內含）Reqmira 工作區。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProbe {
    pub initialized: bool,
    /// 已初始化時的工作區根路徑（可能是該資料夾本身或其下的 reqmira/）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<String>,
}

// ──────────────────────────── Flow ────────────────────────────

/// 多步驟自動化流程定義，對應 `flows/*.flow.yaml`。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowSpec {
    #[serde(default = "default_version")]
    pub version: u32,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub steps: Vec<FlowStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowStep {
    pub name: String,
    /// 相對 workspace 的 request 路徑（如 collections/auth/login.api.yaml）。
    pub request: String,
    /// 此步驟額外/覆寫的變數。
    #[serde(default)]
    pub variables: IndexMap<String, String>,
    /// 回應抽取：變數名 → JSONPath（如 authToken: "$.data.token"）。
    #[serde(default)]
    pub extract: IndexMap<String, String>,
    /// 斷言：key 為 "status" 或 "json.<path>"，value 為期望值。
    #[serde(default)]
    pub assert: IndexMap<String, serde_json::Value>,
}

/// flow 清單摘要（供側欄列出）。
#[derive(Debug, Clone, Serialize)]
pub struct FlowSummary {
    pub id: String,
    pub name: String,
    pub path: String,
    pub steps: usize,
}

// ──────────────────────────── Diff ────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiffKind {
    Added,
    Removed,
    Changed,
}

/// 一筆結構化差異。only 回傳有變化的路徑（unchanged 不列出）。
#[derive(Debug, Clone, Serialize)]
pub struct DiffEntry {
    /// JSON 路徑，如 `$.data.items[0].id`
    pub path: String,
    pub kind: DiffKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
}
