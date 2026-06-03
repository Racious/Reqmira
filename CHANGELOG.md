# Changelog

## v0.1.0

首個公開版本。輕量、離線優先、Git 友善的桌面 API 工作台。

### 功能

- **Request Builder**：GET/POST/PUT/PATCH/DELETE 等，Query／Headers／JSON·Text·Form Body，環境變數 `{{var}}`
- **環境（Environment）**：local／dev／自訂環境切換，送出時於 Rust 端解析變數（無 CORS）
- **Request Inspector**：自動拆解 Path／Query／Headers，型別與格式推測（email/uuid/date…），JSON Body schema 推測
- **Response Viewer**：狀態／耗時／大小、JSON Tree（點行展開、複製值／JSON／路徑）、Schema、Raw、Headers
- **Codegen 沉澱**：由回應產生 TypeScript Interface／Java DTO（record）／Markdown API 文件
- **Deep-Diff**：兩筆回應結構化比對（Rust），綠增／紅刪／黃變更，基準可由 History 指定
- **History**：最近送出快照，可回顧、設為 Diff 基準
- **Flow 自動化**：多步驟流程，回應變數抽取（JSONPath）、注入、斷言（status／json.path）
- **Collection 樹**：展開／收合、右鍵新增·重新命名·刪除、拖拉移動請求
- **工作區**：本機 YAML（collections／environments／flows），開啟專案資料夾可自動初始化 `reqmira/`
- **匯入**：貼上 curl 指令一鍵建立請求
- **體驗**：未儲存標記、`Ctrl+Enter` 送出／`Ctrl+S` 儲存、JSON 格式化、複製反饋 toast
