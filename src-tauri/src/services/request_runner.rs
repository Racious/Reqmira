//! RequestRunner — Reqmira 的靈魂：HTTP 一律經此處（Rust / reqwest）發送，
//! 因此天生無 CORS 限制，並能取得原生計時與位元組大小。

use std::sync::OnceLock;
use std::time::Instant;

use indexmap::IndexMap;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::Method;

use crate::error::{AppError, AppResult};
use crate::models::{HttpResponse, SendRequest};
use crate::services::variable_resolver::resolve;

/// 重用單一 reqwest Client，複用連線池與 TLS session，避免每次發送都重建。
/// 此 client 嚴格驗證 TLS 憑證（預設行為）。
fn shared_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| build_client(false))
}

/// 略過 TLS 憑證驗證的 client（自簽憑證的內網設備用）。
/// 仍走 HTTPS 加密，僅不驗證對端身分——失去 MITM 防護，故僅供使用者明示開啟。
fn insecure_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| build_client(true))
}

fn build_client(insecure: bool) -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("Reqmira/0.1")
        .timeout(std::time::Duration::from_secs(30))
        // rustls 路徑下，此旗標會連同主機名驗證一併關閉，足以應付自簽憑證。
        .danger_accept_invalid_certs(insecure)
        .build()
        .expect("建立 HTTP client 失敗")
}

/// 解析變數 → 拼接 query → 發送 → 收集回應。
pub async fn send(req: SendRequest, vars: &IndexMap<String, String>) -> AppResult<HttpResponse> {
    let method = parse_method(&req.method)?;

    // 1. URL 變數解析
    let mut url = resolve(req.url.trim(), vars);
    if url.is_empty() {
        return Err(AppError::Invalid("URL 不可為空".into()));
    }

    // 2. 拼接啟用中的 query 參數
    let query_pairs: Vec<(String, String)> = req
        .query
        .iter()
        .filter(|kv| kv.enabled && !kv.key.trim().is_empty())
        .map(|kv| (resolve(&kv.key, vars), resolve(&kv.value, vars)))
        .collect();

    let client = if req.insecure { insecure_client() } else { shared_client() };
    let mut builder = client.request(method, &url);

    if !query_pairs.is_empty() {
        builder = builder.query(&query_pairs);
    }

    // 3. Headers（變數解析）
    let mut header_map = HeaderMap::new();
    for kv in req.headers.iter().filter(|kv| kv.enabled && !kv.key.trim().is_empty()) {
        let name = HeaderName::from_bytes(resolve(&kv.key, vars).as_bytes())
            .map_err(|e| AppError::Invalid(format!("無效的 header 名稱「{}」：{e}", kv.key)))?;
        let value = HeaderValue::from_str(&resolve(&kv.value, vars))
            .map_err(|e| AppError::Invalid(format!("無效的 header 值「{}」：{e}", kv.key)))?;
        header_map.insert(name, value);
    }

    // 4. Body
    let body_type = req.body_type.as_deref().unwrap_or("none");
    if let Some(raw) = req.body.as_ref() {
        if body_type != "none" && !raw.is_empty() {
            let resolved = resolve(raw, vars);
            if body_type == "json" && !header_map.contains_key(CONTENT_TYPE) {
                header_map.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
            }
            builder = builder.body(resolved);
        }
    }
    builder = builder.headers(header_map);

    // 5. 發送並計時
    let started = Instant::now();
    let resp = builder
        .send()
        .await
        .map_err(|e| augment_tls_hint(AppError::from(e), req.insecure))?;
    let status = resp.status();
    let status_text = status
        .canonical_reason()
        .unwrap_or("")
        .to_string();

    let resp_headers: Vec<(String, String)> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("<non-utf8>").to_string()))
        .collect();
    let content_type = resp
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // 取得最終 URL（含 query），供 Inspector 顯示
    let final_url = resp.url().to_string();
    url = final_url.clone();

    let bytes = resp.bytes().await?;
    let size_bytes = bytes.len();
    let duration_ms = started.elapsed().as_millis();
    let body = String::from_utf8_lossy(&bytes).into_owned();

    Ok(HttpResponse {
        status: status.as_u16(),
        status_text,
        headers: resp_headers,
        body,
        duration_ms,
        size_bytes,
        content_type,
        final_url: url,
    })
}

fn parse_method(m: &str) -> AppResult<Method> {
    Method::from_bytes(m.trim().to_uppercase().as_bytes())
        .map_err(|_| AppError::Invalid(format!("不支援的 HTTP 方法：{m}")))
}

/// 若為 TLS / 憑證類連線錯誤，附上「簡述原因 + 應對方法」的提示。
/// 依是否已略過驗證，給予不同建議。
fn augment_tls_hint(err: AppError, insecure: bool) -> AppError {
    let msg = match err {
        AppError::Http(m) => m,
        other => return other,
    };
    let low = msg.to_lowercase();
    let cert_related = low.contains("certificate")
        || low.contains("certversion")
        || low.contains("handshake")
        || low.contains("self-signed")
        || low.contains("self signed");
    if !cert_related {
        return AppError::Http(msg);
    }
    let hint = if insecure {
        "對方憑證格式過舊或不合規範，連「略過驗證」都無法解析（rustls 較嚴格）。此設備可能需改用 native-tls 後端才能連線。"
    } else {
        "對方可能使用自簽或老舊的 TLS 憑證。若這是您信任的內網設備，請於頂列開啟「略過 SSL 驗證」後重試。"
    };
    AppError::Http(format!("{msg}\n\n💡 {hint}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::KeyValue;

    fn kv(key: &str, value: &str) -> KeyValue {
        KeyValue { key: key.into(), value: value.into(), enabled: true }
    }

    #[test]
    fn tls_hint_appends_for_cert_errors_only() {
        // 憑證錯誤：應附上提示
        let e = augment_tls_hint(
            AppError::Http("invalid peer certificate: UnsupportedCertVersion".into()),
            false,
        );
        let AppError::Http(msg) = e else { panic!("應為 Http") };
        assert!(msg.contains("💡"), "憑證錯誤應附提示");
        assert!(msg.contains("略過 SSL 驗證"), "未略過時應建議開啟略過");

        // 已略過驗證：提示內容不同
        let e2 = augment_tls_hint(
            AppError::Http("invalid peer certificate: UnsupportedCertVersion".into()),
            true,
        );
        let AppError::Http(msg2) = e2 else { panic!("應為 Http") };
        assert!(msg2.contains("native-tls"), "已略過仍失敗時應提示換後端");

        // 非憑證錯誤：原樣返回，不加提示
        let e3 = augment_tls_hint(AppError::Http("connection refused".into()), false);
        let AppError::Http(msg3) = e3 else { panic!("應為 Http") };
        assert!(!msg3.contains("💡"), "非憑證錯誤不應附提示");
    }

    #[test]
    fn parse_method_normalizes_and_validates() {
        assert_eq!(parse_method("get").unwrap(), Method::GET);
        assert_eq!(parse_method("  post ").unwrap(), Method::POST);
        assert_eq!(parse_method("Delete").unwrap(), Method::DELETE);
        // 含空白屬非法 token（注意：HTTP 允許自訂方法如 "PURGE"，故僅拒非法字元）
        assert!(parse_method("BAD METHOD").is_err());
    }

    #[tokio::test]
    async fn empty_url_errors_without_network() {
        let req = SendRequest {
            method: "GET".into(),
            url: "   ".into(),
            headers: vec![],
            query: vec![],
            body: None,
            body_type: None,
            insecure: false,
        };
        let res = send(req, &IndexMap::new()).await;
        assert!(res.is_err(), "空 URL 應在送出前就回錯");
    }

    /// 端到端：實際對 httpbin 發送，驗證變數解析、query 拼接、header 注入與計時。
    /// 需連網，故預設 ignore；以 `cargo test -- --ignored` 執行。
    #[tokio::test]
    #[ignore = "需連網：對 httpbin.org 實際發送"]
    async fn sends_real_request_end_to_end() {
        let mut vars = IndexMap::new();
        vars.insert("base".to_string(), "https://httpbin.org".to_string());
        vars.insert("tok".to_string(), "secret123".to_string());

        let req = SendRequest {
            method: "GET".into(),
            url: "{{base}}/anything".into(),
            headers: vec![kv("Authorization", "Bearer {{tok}}")],
            query: vec![kv("page", "1"), kv("q", "reqmira")],
            body: None,
            body_type: None,
            insecure: false,
        };

        let resp = send(req, &vars).await.expect("請求應成功");

        assert_eq!(resp.status, 200, "狀態碼應為 200");
        // httpbin 會回顯 query 與 headers
        assert!(resp.final_url.contains("page=1"), "final_url 應含 query：{}", resp.final_url);
        assert!(resp.body.contains("Bearer secret123"), "變數應已解析並送達");
        assert!(resp.body.contains("\"q\""), "query 應送達");
        assert!(resp.size_bytes > 0, "應有回應內容");
    }
}
