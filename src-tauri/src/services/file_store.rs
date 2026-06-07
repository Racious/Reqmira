//! FileStore — workspace 內 YAML 集合與環境的讀寫，及 collection tree 掃描。
//!
//! workspace 結構（見定稿 §10）：
//! ```text
//! workspace/
//! ├─ environments/*.yaml
//! └─ collections/**/ *.api.yaml
//! ```

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::{
    CollectionNode, Environment, FlowSpec, FlowSummary, NodeKind, RequestSpec, WorkspaceProbe,
};

const REQUEST_SUFFIX: &str = ".api.yaml";

/// 將相對路徑安全地接到 root 之下，並阻擋 `..` 逃逸。
fn resolve_in_root(root: &str, rel: &str) -> AppResult<PathBuf> {
    let rel = rel.replace('\\', "/");
    if rel.split('/').any(|seg| seg == "..") {
        return Err(AppError::Invalid(format!("不允許的路徑：{rel}")));
    }
    Ok(Path::new(root).join(rel))
}

/// 掃描 `collections/` 目錄，回傳巢狀 tree。
pub fn list_collections(root: &str) -> AppResult<Vec<CollectionNode>> {
    let dir = Path::new(root).join("collections");
    if !dir.exists() {
        return Ok(vec![]);
    }
    scan_dir(&dir, root)
}

fn scan_dir(dir: &Path, root: &str) -> AppResult<Vec<CollectionNode>> {
    let mut folders: Vec<CollectionNode> = vec![];
    let mut requests: Vec<CollectionNode> = vec![];

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            let children = scan_dir(&path, root)?;
            folders.push(CollectionNode {
                name: file_name,
                path: rel_path(&path, root),
                kind: NodeKind::Folder,
                method: None,
                children,
            });
        } else if file_name.ends_with(REQUEST_SUFFIX) {
            // 嘗試讀 method/name；解析失敗時以檔名退而求其次。
            let (name, method) = match load_request_at(&path) {
                Ok(spec) => (spec.name, Some(spec.method)),
                Err(_) => (file_name.trim_end_matches(REQUEST_SUFFIX).to_string(), None),
            };
            requests.push(CollectionNode {
                name,
                path: rel_path(&path, root),
                kind: NodeKind::Request,
                method,
                children: vec![],
            });
        }
    }

    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    requests.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    folders.extend(requests);
    Ok(folders)
}

fn rel_path(path: &Path, root: &str) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn load_request_at(path: &Path) -> AppResult<RequestSpec> {
    let text = fs::read_to_string(path)?;
    Ok(serde_yaml::from_str(&text)?)
}

/// 讀取單一 request（相對 workspace 的路徑）。
pub fn load_request(root: &str, rel: &str) -> AppResult<RequestSpec> {
    let path = resolve_in_root(root, rel)?;
    load_request_at(&path)
}

/// 寫入單一 request，必要時建立父目錄。
pub fn save_request(root: &str, rel: &str, spec: &RequestSpec) -> AppResult<()> {
    let path = resolve_in_root(root, rel)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let yaml = serde_yaml::to_string(spec)?;
    fs::write(&path, yaml)?;
    Ok(())
}

/// 刪除單一 request。
pub fn delete_request(root: &str, rel: &str) -> AppResult<()> {
    let path = resolve_in_root(root, rel)?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

/// 建立（巢狀）資料夾。
pub fn create_folder(root: &str, rel: &str) -> AppResult<()> {
    let path = resolve_in_root(root, rel)?;
    fs::create_dir_all(path)?;
    Ok(())
}

/// 重新命名 / 搬移檔案或資料夾。
pub fn rename_entry(root: &str, from: &str, to: &str) -> AppResult<()> {
    let f = resolve_in_root(root, from)?;
    let t = resolve_in_root(root, to)?;
    if let Some(parent) = t.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(f, t)?;
    Ok(())
}

/// 刪除檔案或資料夾（資料夾遞迴刪除）。
pub fn delete_entry(root: &str, rel: &str) -> AppResult<()> {
    let path = resolve_in_root(root, rel)?;
    if path.is_dir() {
        fs::remove_dir_all(path)?;
    } else if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// 列出 `environments/*.yaml`。
pub fn list_environments(root: &str) -> AppResult<Vec<Environment>> {
    let dir = Path::new(root).join("environments");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut envs = vec![];
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if name.ends_with(".yaml") || name.ends_with(".yml") {
            let text = fs::read_to_string(&path)?;
            let env: Environment = serde_yaml::from_str(&text)?;
            envs.push(env);
        }
    }
    envs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(envs)
}

/// 環境名稱僅允許安全字元（不可含路徑分隔或 ..），避免寫出 environments 之外。
fn safe_env_name(name: &str) -> AppResult<&str> {
    let n = name.trim();
    if n.is_empty() || n.contains('/') || n.contains('\\') || n.contains("..") {
        return Err(AppError::Invalid(format!("無效的環境名稱：{name}")));
    }
    Ok(n)
}

/// 寫入（或覆蓋）一個環境檔 `environments/<name>.yaml`。
pub fn save_environment(root: &str, env: &Environment) -> AppResult<()> {
    let name = safe_env_name(&env.name)?;
    let dir = Path::new(root).join("environments");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{name}.yaml"));
    fs::write(path, serde_yaml::to_string(env)?)?;
    Ok(())
}

/// 刪除一個環境檔。
pub fn delete_environment(root: &str, name: &str) -> AppResult<()> {
    let name = safe_env_name(name)?;
    let path = Path::new(root).join("environments").join(format!("{name}.yaml"));
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

const FLOW_SUFFIX: &str = ".flow.yaml";

/// 列出 `flows/*.flow.yaml` 的摘要。
pub fn list_flows(root: &str) -> AppResult<Vec<FlowSummary>> {
    let dir = Path::new(root).join("flows");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut flows = vec![];
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(FLOW_SUFFIX) {
            let text = fs::read_to_string(&path)?;
            if let Ok(flow) = serde_yaml::from_str::<FlowSpec>(&text) {
                flows.push(FlowSummary {
                    id: flow.id,
                    name: flow.name,
                    path: rel_path(&path, root),
                    steps: flow.steps.len(),
                });
            }
        }
    }
    flows.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(flows)
}

/// 讀取單一 flow。
pub fn load_flow(root: &str, rel: &str) -> AppResult<FlowSpec> {
    let path = resolve_in_root(root, rel)?;
    let text = fs::read_to_string(&path)?;
    Ok(serde_yaml::from_str(&text)?)
}

/// 是否具備工作區特徵（含 collections / environments / flows 任一子目錄）。
fn is_workspace(p: &Path) -> bool {
    p.join("collections").is_dir() || p.join("environments").is_dir() || p.join("flows").is_dir()
}

fn norm(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

/// 探測：該資料夾本身或其下 reqmira/ 是否為工作區。
pub fn probe_workspace(path: &str) -> WorkspaceProbe {
    let p = Path::new(path);
    if is_workspace(p) {
        return WorkspaceProbe { initialized: true, root: Some(norm(p)) };
    }
    let sub = p.join("reqmira");
    if is_workspace(&sub) {
        return WorkspaceProbe { initialized: true, root: Some(norm(&sub)) };
    }
    WorkspaceProbe { initialized: false, root: None }
}

/// 在 parent 下建立 `reqmira/` 工作區骨架，回傳工作區根路徑。
/// 既有檔案不覆蓋（只補缺）。
pub fn init_workspace(parent: &str) -> AppResult<String> {
    let target = Path::new(parent).join("reqmira");
    fs::create_dir_all(target.join("environments"))?;
    fs::create_dir_all(target.join("collections"))?;
    fs::create_dir_all(target.join("flows"))?;

    let env_file = target.join("environments").join("local.yaml");
    if !env_file.exists() {
        fs::write(
            &env_file,
            "name: local\nvariables:\n  baseUrl: \"http://localhost:8080\"\n  token: \"\"        # 機密：留空、不進 Git\n",
        )?;
    }

    let gi = target.join(".gitignore");
    if !gi.exists() {
        fs::write(
            &gi,
            "# Reqmira 工作區\n# 機密環境值請勿提交。含 token/密碼的環境檔請改名為 *.secret.yaml，由下行忽略：\n*.secret.yaml\n",
        )?;
    }

    Ok(norm(&target))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 範例 workspace 位於 crate 上層的 `workspace/`。
    fn sample_root() -> String {
        format!("{}/../workspace", env!("CARGO_MANIFEST_DIR"))
    }

    #[test]
    fn lists_sample_environments() {
        let envs = list_environments(&sample_root()).expect("環境應可解析");
        assert!(envs.iter().any(|e| e.name == "local"));
        let local = envs.iter().find(|e| e.name == "local").unwrap();
        assert_eq!(local.variables.get("baseUrl").map(String::as_str), Some("http://localhost:8080"));
    }

    #[test]
    fn lists_sample_collections_tree() {
        let tree = list_collections(&sample_root()).expect("collection 應可解析");
        // 至少含 auth / users / demo 三個資料夾
        let folder_names: Vec<&str> = tree
            .iter()
            .filter(|n| n.kind == NodeKind::Folder)
            .map(|n| n.name.as_str())
            .collect();
        assert!(folder_names.contains(&"users"), "應有 users 資料夾，實際：{folder_names:?}");
    }

    #[test]
    fn lists_and_loads_sample_flow() {
        let flows = list_flows(&sample_root()).expect("flows 應可解析");
        assert!(flows.iter().any(|f| f.id == "demo-httpbin"), "應有 demo-httpbin flow");
        let flow = load_flow(&sample_root(), "flows/demo-httpbin.flow.yaml").expect("flow 應可載入");
        assert_eq!(flow.steps.len(), 2);
        assert!(flow.steps[0].extract.contains_key("echoedUrl"));
        assert!(flow.steps[1].assert.contains_key("status"));
    }

    #[test]
    fn loads_request_with_body() {
        let spec = load_request(&sample_root(), "collections/users/create-user.api.yaml")
            .expect("create-user 應可解析");
        assert_eq!(spec.method, "POST");
        assert!(spec.body.is_some());
        assert_eq!(spec.body.unwrap().kind, "json");
    }

    #[test]
    fn resolve_in_root_blocks_traversal() {
        assert!(resolve_in_root("C:/ws", "../etc").is_err());
        assert!(resolve_in_root("C:/ws", "a/../../b").is_err());
        assert!(resolve_in_root("C:/ws", "collections/x.api.yaml").is_ok());
    }

    #[test]
    fn save_load_delete_round_trip() {
        let root = std::env::temp_dir().join("reqmira_rt_test");
        let root_s = root.to_string_lossy().to_string();
        let _ = fs::remove_dir_all(&root);

        let spec = crate::models::RequestSpec {
            version: 1,
            id: "t".into(),
            name: "T".into(),
            method: "GET".into(),
            url: "http://x".into(),
            headers: indexmap::IndexMap::new(),
            query: indexmap::IndexMap::new(),
            body: None,
            auth: None,
            docs: None,
        };
        let rel = "collections/sub/t.api.yaml";

        save_request(&root_s, rel, &spec).expect("save 應建立父目錄並寫入");
        let loaded = load_request(&root_s, rel).expect("應可載回");
        assert_eq!(loaded.id, "t");
        assert_eq!(loaded.method, "GET");

        delete_request(&root_s, rel).expect("刪除應成功");
        assert!(load_request(&root_s, rel).is_err(), "刪除後應載不到");
        delete_request(&root_s, rel).expect("再次刪除應為 no-op，不報錯");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn saves_and_loads_auth() {
        let root = std::env::temp_dir().join("reqmira_auth_test");
        let root_s = root.to_string_lossy().to_string();
        let _ = fs::remove_dir_all(&root);

        let auth = serde_json::json!({ "type": "bearer", "token": "{{token}}" });
        let spec = crate::models::RequestSpec {
            version: 1,
            id: "a".into(),
            name: "A".into(),
            method: "GET".into(),
            url: "http://x".into(),
            headers: indexmap::IndexMap::new(),
            query: indexmap::IndexMap::new(),
            body: None,
            auth: Some(auth),
            docs: None,
        };
        let rel = "collections/a.api.yaml";
        save_request(&root_s, rel, &spec).expect("save 應成功");
        let loaded = load_request(&root_s, rel).expect("應可載回");
        let a = loaded.auth.expect("auth 應被保存");
        assert_eq!(a.get("type").and_then(|v| v.as_str()), Some("bearer"));
        assert_eq!(a.get("token").and_then(|v| v.as_str()), Some("{{token}}"));

        let _ = fs::remove_dir_all(&root);
    }
}
