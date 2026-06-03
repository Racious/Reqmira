# Reqmira — 輕量 API 工作台

本機優先、Git 友善、以**參數拆解與 API 閱讀**為核心的輕量 API 分析工作台。
以 Tauri 2 + Vue 3 + Rust 打造，HTTP 流量一律經 Rust（reqwest）發送，天生無 CORS 限制。

> 設計定稿見 [`apilens-dev-spec.html`](./apilens-dev-spec.html)（文件內產品名為 ApiLens，最終定名 **Reqmira**）。
> 操作教學見 [`docs/使用教學.md`](./docs/使用教學.md)，測試報告見 [`docs/測試報告.md`](./docs/測試報告.md)。

## 功能

- **Request Builder**：GET/POST/PUT/PATCH/DELETE 等，Query／Headers／JSON·Text·Form Body，環境變數 `{{var}}`
- **環境（Environment）**：local／dev／自訂環境切換，變數於 Rust 端解析（無 CORS）
- **Request Inspector**：自動拆解 Path／Query／Headers，型別與格式推測（email/uuid/date…），JSON Body schema 推測
- **Response Viewer**：狀態／耗時／大小、JSON Tree（點行展開、複製值／JSON／路徑）、Schema、Raw、Headers
- **Codegen 沉澱**：由回應產生 TypeScript Interface／Java DTO（record）／Markdown API 文件
- **Deep-Diff**：兩筆回應結構化比對（Rust），綠增／紅刪／黃變更，基準可由 History 指定
- **History**：最近送出快照，可回顧、設為 Diff 基準
- **Flow 自動化**：多步驟流程，回應變數抽取（JSONPath）、注入、斷言
- **Collection 樹**：展開／收合、右鍵新增·重新命名·刪除、拖拉移動
- **匯入**：貼上 curl 指令一鍵建立請求
- **體驗**：未儲存標記、`Ctrl+Enter` 送出／`Ctrl+S` 儲存、JSON 格式化、複製反饋

## 安裝

至 [Releases](../../releases) 下載（Windows）：

| 類型 | 說明 |
|---|---|
| `Reqmira_x.y.z_x64_en-US.msi` | 安裝版（推薦），整合捷徑與解除安裝 |
| `Reqmira_x.y.z_x64-setup.exe` | NSIS 輕量安裝程式 |
| `Reqmira_x.y.z_portable.exe` | 攜帶版，免安裝直接執行 |

## 開發

```bash
npm install            # 安裝前端依賴
npm start              # 啟動桌面開發模式（= tauri dev）
```

其他指令：

```bash
npm run dev            # 僅前端（瀏覽器，無 Tauri command）
npm run build          # vue-tsc 型別檢查 + vite build
npm test               # 前端單元測試（Vitest）
npm run test:rust      # Rust 單元/整合測試
npm run package        # 打包正式安裝檔（MSI / NSIS）
npm run typecheck      # 僅型別檢查
```

## 發佈（CI）

推送 `v*` tag 即觸發 GitHub Actions（[.github/workflows/release.yml](.github/workflows/release.yml)）自動建置並發佈 Release：

```bash
# 版本號需與 package.json / Cargo.toml / tauri.conf.json 一致
git tag v0.1.0
git push origin v0.1.0
```

Release 內容由 [`CHANGELOG.md`](./CHANGELOG.md) 對應版本段落自動產生（見 `scripts/extract-changelog.mjs`）。

## 專案結構

```text
src/                  # Vue 3 前端
  app/                # 全域樣式
  features/           # collections · requests · response-viewer · inspector · runner
  shared/             # types · api · stores · components · analyze · generators · jsonpath
src-tauri/src/        # Rust 後端
  commands/           # request · collection · env · flow · analyze · workspace
  services/           # request_runner · variable_resolver · file_store · deep_diff
  models.rs · error.rs
workspace/            # 範例工作區（可作為使用者資料範本）
  environments/*.yaml · collections/**/*.api.yaml · flows/*.flow.yaml
.github/workflows/    # release.yml（tag 觸發自動發佈）
```

## 首次使用

1. `npm install` 後執行 `npm start`。
2. 視窗上方點「📂 開啟工作區」：
   - 選本專案 `workspace/`（已含範例）即可直接用；
   - 或選自己的專案資料夾，依提示在其下建立 `reqmira/` 工作區。
3. 環境切到 **demo**，左欄選 **Demo · httpbin GET** 按「送出」看回應（需連網）。
4. 左欄 **Flows** → **Demo · httpbin 兩步流程** → ▶ 執行，體驗自動化。

## 機密處理

環境檔中的 `token`、`password` 等為機密欄位，範例中留空。
若要將工作區納入 Git，請勿提交含機密值的環境檔（見 `.gitignore` 說明）。
