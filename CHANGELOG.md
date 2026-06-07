# Changelog

## v0.2.0

體驗與互動大幅強化，並借鑑 Hoppscotch / Yaak 的常用做法。

### 新增功能

- **Auth 分頁**：Bearer／Basic／API Key 自動組 header，設定隨請求存檔
- **動態變數**：`{{$uuid}}`、`{{$timestamp}}`、`{{$timestampMs}}`、`{{$randomInt}}`
- **回應引用**：`{{responses.<id>.<path>}}` 跨請求引用最新回應（免跑 Flow 串 token）
- **Response JSONPath 過濾**：在回應只顯示關注片段
- **命令面板（Ctrl+K）**：快速跳請求／切環境／執行動作
- **環境編輯 UI**：程式內切換／改值／新增刪除環境變數，免開檔
- **多語言 code snippet**：由請求產 curl／JavaScript fetch／Python requests／Java HttpClient
- **OpenAPI / Postman 匯入**：貼上 JSON 一鍵生成整組請求
- **curl 匯入**：貼指令建立請求

### 介面與版面

- 佈局可切換：Request/Response 上下 ↔ 左右並排
- 中欄分隔可拖曳調比例（雙擊重設）
- 四面板（樹／Request／Response／Inspector）可各自一鍵收合
- 側欄／Inspector 寬度可拖曳、可收合
- 複製反饋 toast、未儲存標記、JSON 格式化、Ctrl+Enter／Ctrl+S 快捷鍵

### 其他

- Collection 樹：右鍵新增·重新命名·刪除、拖拉移動、展開收合
- 工作區自動初始化（選專案資料夾即建 `reqmira/`）
- 略過 SSL 憑證驗證選項、更清楚的連線錯誤訊息
- 自動化測試：前端 42、後端 24

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
