//! Deep-Diff — 結構化比對兩段 JSON。
//!
//! 依定稿 §6.3，此運算密集工作置於 Rust 端。遞迴走訪兩棵 JSON 樹，
//! 回傳所有差異路徑（綠＝新增、紅＝刪除、黃＝變更），unchanged 不列出。

use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::models::{DiffEntry, DiffKind};

pub fn diff_json(left_text: &str, right_text: &str) -> AppResult<Vec<DiffEntry>> {
    let left: Value =
        serde_json::from_str(left_text).map_err(|e| AppError::Invalid(format!("左側 JSON 解析失敗：{e}")))?;
    let right: Value =
        serde_json::from_str(right_text).map_err(|e| AppError::Invalid(format!("右側 JSON 解析失敗：{e}")))?;

    let mut out = Vec::new();
    walk("$", &left, &right, &mut out);
    Ok(out)
}

/// 將純量轉為可讀字串；物件/陣列以 compact JSON 呈現。
fn repr(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Object(_) | Value::Array(_) => v.to_string(),
        _ => v.to_string(),
    }
}

fn join_key(base: &str, key: &str) -> String {
    if base == "$" {
        format!("$.{key}")
    } else {
        format!("{base}.{key}")
    }
}

fn walk(path: &str, left: &Value, right: &Value, out: &mut Vec<DiffEntry>) {
    match (left, right) {
        (Value::Object(a), Value::Object(b)) => {
            // 左有右無 → removed
            for (k, lv) in a {
                if !b.contains_key(k) {
                    out.push(DiffEntry {
                        path: join_key(path, k),
                        kind: DiffKind::Removed,
                        left: Some(repr(lv)),
                        right: None,
                    });
                }
            }
            // 右有左無 → added；兩者皆有 → 遞迴
            for (k, rv) in b {
                match a.get(k) {
                    None => out.push(DiffEntry {
                        path: join_key(path, k),
                        kind: DiffKind::Added,
                        left: None,
                        right: Some(repr(rv)),
                    }),
                    Some(lv) => walk(&join_key(path, k), lv, rv, out),
                }
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            let max = a.len().max(b.len());
            for i in 0..max {
                let p = format!("{path}[{i}]");
                match (a.get(i), b.get(i)) {
                    (Some(lv), Some(rv)) => walk(&p, lv, rv, out),
                    (Some(lv), None) => out.push(DiffEntry {
                        path: p,
                        kind: DiffKind::Removed,
                        left: Some(repr(lv)),
                        right: None,
                    }),
                    (None, Some(rv)) => out.push(DiffEntry {
                        path: p,
                        kind: DiffKind::Added,
                        left: None,
                        right: Some(repr(rv)),
                    }),
                    (None, None) => {}
                }
            }
        }
        _ => {
            if left != right {
                out.push(DiffEntry {
                    path: path.to_string(),
                    kind: DiffKind::Changed,
                    left: Some(repr(left)),
                    right: Some(repr(right)),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_added_removed_changed() {
        let l = r#"{"a":1,"b":2,"nested":{"x":1}}"#;
        let r = r#"{"a":1,"b":3,"c":4,"nested":{}}"#;
        let d = diff_json(l, r).unwrap();
        // b changed、c added、nested.x removed
        assert!(d.iter().any(|e| e.path == "$.b" && matches!(e.kind, DiffKind::Changed)));
        assert!(d.iter().any(|e| e.path == "$.c" && matches!(e.kind, DiffKind::Added)));
        assert!(d.iter().any(|e| e.path == "$.nested.x" && matches!(e.kind, DiffKind::Removed)));
        // a 未變 → 不列出
        assert!(!d.iter().any(|e| e.path == "$.a"));
    }

    #[test]
    fn array_index_diff() {
        let d = diff_json(r#"[1,2,3]"#, r#"[1,9]"#).unwrap();
        assert!(d.iter().any(|e| e.path == "$[1]" && matches!(e.kind, DiffKind::Changed)));
        assert!(d.iter().any(|e| e.path == "$[2]" && matches!(e.kind, DiffKind::Removed)));
    }

    #[test]
    fn identical_yields_empty() {
        let d = diff_json(r#"{"a":1,"b":[1,2]}"#, r#"{"a":1,"b":[1,2]}"#).unwrap();
        assert!(d.is_empty());
    }

    #[test]
    fn invalid_json_errors() {
        assert!(diff_json("{bad", "{}").is_err());
        assert!(diff_json("{}", "nope").is_err());
    }
}
