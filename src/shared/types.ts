// 與 Rust 端 models.rs 對應的 TypeScript 型別。

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type BodyType = "none" | "json" | "text" | "form";

export interface BodySpec {
  type: BodyType;
  content: string;
}

export interface DocsSpec {
  tags?: string[];
  description?: string;
}

export type AuthType = "none" | "bearer" | "basic" | "apikey";

/** 認證設定；送出時組成對應 header/query。 */
export interface AuthSpec {
  type: AuthType;
  token?: string; // bearer
  username?: string; // basic
  password?: string; // basic
  key?: string; // apikey 名稱
  value?: string; // apikey 值
  addTo?: "header" | "query"; // apikey 放置位置，預設 header
}

/** 持久化的 request 定義，對應 *.api.yaml */
export interface RequestSpec {
  version: number;
  id: string;
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: BodySpec | null;
  auth?: AuthSpec | null;
  docs?: DocsSpec | null;
}

export interface Environment {
  name: string;
  variables: Record<string, string>;
}

export interface WorkspaceProbe {
  initialized: boolean;
  root?: string | null;
}

export type NodeKind = "folder" | "request";

export interface CollectionNode {
  name: string;
  path: string;
  kind: NodeKind;
  method?: string;
  children?: CollectionNode[];
}

/** 可勾選啟用的鍵值列（編輯器用） */
export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

/** 送往後端的請求結構（對應 Rust SendRequest, camelCase） */
export interface SendRequest {
  method: string;
  url: string;
  headers: KeyValue[];
  query: KeyValue[];
  body?: string | null;
  bodyType?: string | null;
  /** 略過 TLS 憑證驗證（自簽憑證的內網設備用）。預設 false。 */
  insecure?: boolean;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  durationMs: number;
  sizeBytes: number;
  contentType?: string | null;
  finalUrl: string;
  /** 前端專用：此回應 body 為節省 localStorage 而被截斷儲存（重開後載入的舊大紀錄）。 */
  truncated?: boolean;
}

// ── Flow ──

export interface FlowStep {
  name: string;
  request: string;
  variables?: Record<string, string>;
  extract?: Record<string, string>;
  assert?: Record<string, unknown>;
}

export interface FlowSpec {
  version: number;
  id: string;
  name: string;
  description?: string | null;
  steps: FlowStep[];
}

export interface FlowSummary {
  id: string;
  name: string;
  path: string;
  steps: number;
}

/** 單一斷言結果 */
export interface AssertResult {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

/** 單一步驟執行結果 */
export interface StepResult {
  name: string;
  request: string;
  status?: number;
  durationMs?: number;
  finalUrl?: string;
  extracted: Record<string, string>;
  asserts: AssertResult[];
  error?: string;
  passed: boolean;
}

export type DiffKind = "added" | "removed" | "changed";

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  left?: string | null;
  right?: string | null;
}
