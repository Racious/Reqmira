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
