//! `{{var}}` 變數解析。
//!
//! 在不引入 regex 依賴的前提下，手動掃描 `{{ ... }}` 樣式並以環境變數取代。
//! 找不到的變數維持原樣（保留 `{{name}}`），方便使用者察覺未定義變數。

use indexmap::IndexMap;

/// 將文字中的 `{{key}}` 取代為 `vars` 對應值。鍵兩側空白會被忽略。
pub fn resolve(input: &str, vars: &IndexMap<String, String>) -> String {
    if !input.contains("{{") {
        return input.to_string();
    }

    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            if let Some(close) = input[i + 2..].find("}}") {
                let key = input[i + 2..i + 2 + close].trim();
                match vars.get(key) {
                    Some(val) => out.push_str(val),
                    // 使用者變數優先；未定義且以 $ 開頭者視為動態變數。
                    None => match dynamic(key) {
                        Some(val) => out.push_str(&val),
                        None => out.push_str(&input[i..i + 2 + close + 2]),
                    },
                }
                i = i + 2 + close + 2;
                continue;
            }
        }
        // 以字元邊界推進，避免切壞多位元組 UTF-8。
        let ch = input[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// 動態變數（未被使用者變數覆寫時生效）：
/// `$uuid`、`$timestamp`(秒)、`$timestampMs`(毫秒)、`$randomInt`(0–99999)。
fn dynamic(key: &str) -> Option<String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    match key {
        "$uuid" => Some(uuid::Uuid::new_v4().to_string()),
        "$timestamp" => SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_secs().to_string()),
        "$timestampMs" => SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis().to_string()),
        "$randomInt" => SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| (d.subsec_nanos() % 100_000).to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars() -> IndexMap<String, String> {
        let mut m = IndexMap::new();
        m.insert("baseUrl".into(), "http://localhost:8080".into());
        m.insert("token".into(), "abc123".into());
        m
    }

    #[test]
    fn resolves_known() {
        assert_eq!(
            resolve("{{baseUrl}}/api", &vars()),
            "http://localhost:8080/api"
        );
    }

    #[test]
    fn keeps_unknown() {
        assert_eq!(resolve("{{missing}}/x", &vars()), "{{missing}}/x");
    }

    #[test]
    fn trims_spaces() {
        assert_eq!(resolve("Bearer {{ token }}", &vars()), "Bearer abc123");
    }

    #[test]
    fn handles_utf8() {
        assert_eq!(resolve("使用者 {{token}} 名", &vars()), "使用者 abc123 名");
    }

    #[test]
    fn adjacent_vars() {
        assert_eq!(resolve("{{baseUrl}}{{token}}", &vars()), "http://localhost:8080abc123");
    }

    #[test]
    fn unclosed_brace_kept() {
        assert_eq!(resolve("{{baseUrl", &vars()), "{{baseUrl");
    }

    #[test]
    fn empty_input() {
        assert_eq!(resolve("", &vars()), "");
    }

    #[test]
    fn dynamic_vars() {
        // timestamp 應為純數字
        let ts = resolve("{{$timestamp}}", &vars());
        assert!(ts.chars().all(|c| c.is_ascii_digit()) && !ts.is_empty());
        // uuid 應為 36 字元含連字號
        let id = resolve("{{$uuid}}", &vars());
        assert_eq!(id.len(), 36);
        assert_eq!(id.matches('-').count(), 4);
    }

    #[test]
    fn user_var_overrides_dynamic() {
        let mut m = vars();
        m.insert("$uuid".into(), "fixed".into());
        assert_eq!(resolve("{{$uuid}}", &m), "fixed");
    }

    #[test]
    fn unknown_dynamic_kept() {
        assert_eq!(resolve("{{$nope}}", &vars()), "{{$nope}}");
    }
}
