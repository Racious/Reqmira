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
                    None => out.push_str(&input[i..i + 2 + close + 2]),
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
}
