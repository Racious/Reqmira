// 型別推測引擎（P2「好讀」核心）。
//
// 對 JSON 值（response body / request body）推測結構化 schema，
// 並對字串值偵測常見格式（email / url / uuid / date…）。
// request 的 query/header 值皆為字串，另以 inferFromText 做型別還原。
//
// 設計取捨：此推測置於前端共用模組，講求即時反饋；P3 運算密集的
// deep-diff 才上 Rust。

export type ScalarType = "string" | "integer" | "number" | "boolean" | "null" | "variable";
export type NodeType = ScalarType | "object" | "array" | "mixed";

export interface SchemaField {
  key: string;
  node: SchemaNode;
  /** 依樣本推斷：合併多筆樣本時，僅在每筆都出現才視為必填。 */
  required: boolean;
}

export interface SchemaNode {
  type: NodeType;
  /** string 子格式：email / url / uuid / date / datetime / ipv4 */
  format?: string;
  /** object 專用 */
  fields?: SchemaField[];
  /** array 專用：元素的合併型別 */
  items?: SchemaNode;
  /** array 元素數 */
  length?: number;
  /** scalar 的樣本值（截斷），供 UI 提示 */
  sample?: string;
}

const RE = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/[^\s]+$/i,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  variable: /\{\{.*?\}\}/,
};

/** 偵測字串子格式；無命中回傳 undefined。 */
export function detectStringFormat(s: string): string | undefined {
  const v = s.trim();
  if (RE.variable.test(v)) return "variable";
  if (RE.uuid.test(v)) return "uuid";
  if (RE.email.test(v)) return "email";
  if (RE.url.test(v)) return "url";
  if (RE.datetime.test(v)) return "datetime";
  if (RE.date.test(v)) return "date";
  if (RE.ipv4.test(v)) return "ipv4";
  return undefined;
}

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** 對「真實 JSON 值」推測 schema（尊重原始型別，僅對字串偵測格式）。 */
export function inferValue(v: unknown): SchemaNode {
  if (v === null) return { type: "null" };
  if (Array.isArray(v)) return inferArray(v);
  if (typeof v === "object") {
    const fields: SchemaField[] = Object.entries(v as Record<string, unknown>).map(
      ([key, val]) => ({ key, node: inferValue(val), required: true }),
    );
    return { type: "object", fields };
  }
  if (typeof v === "number") {
    return { type: Number.isInteger(v) ? "integer" : "number", sample: String(v) };
  }
  if (typeof v === "boolean") return { type: "boolean", sample: String(v) };
  // string
  const s = String(v);
  const format = detectStringFormat(s);
  return { type: format === "variable" ? "variable" : "string", format: format === "variable" ? undefined : format, sample: truncate(s) };
}

function inferArray(arr: unknown[]): SchemaNode {
  if (arr.length === 0) return { type: "array", length: 0, items: { type: "mixed" } };
  const nodes = arr.map(inferValue);
  return { type: "array", length: arr.length, items: mergeMany(nodes) };
}

/** 合併同一陣列中多個元素的推測結果。 */
function mergeMany(nodes: SchemaNode[]): SchemaNode {
  if (nodes.length === 1) return nodes[0];
  const first = nodes[0];
  const allSameType = nodes.every((n) => n.type === first.type);
  if (!allSameType) return { type: "mixed" };

  if (first.type === "object") {
    // union 欄位：required 僅當每筆樣本皆含該 key。
    const total = nodes.length;
    const counts = new Map<string, { count: number; subs: SchemaNode[] }>();
    for (const n of nodes) {
      for (const f of n.fields ?? []) {
        const e = counts.get(f.key) ?? { count: 0, subs: [] };
        e.count += 1;
        e.subs.push(f.node);
        counts.set(f.key, e);
      }
    }
    const fields: SchemaField[] = [...counts.entries()].map(([key, e]) => ({
      key,
      node: mergeMany(e.subs),
      required: e.count === total,
    }));
    return { type: "object", fields };
  }

  if (first.type === "array") {
    const itemNodes: SchemaNode[] = nodes.map((n) => n.items ?? { type: "mixed" });
    return { type: "array", items: mergeMany(itemNodes), length: undefined };
  }

  // scalar：型別一致；格式若不一致則捨棄。
  const sameFormat = nodes.every((n) => n.format === first.format);
  return { type: first.type, format: sameFormat ? first.format : undefined };
}

/** 解析 JSON 文字並推測；失敗回傳 null。 */
export function buildSchemaFromText(text: string): SchemaNode | null {
  if (!text.trim()) return null;
  try {
    return inferValue(JSON.parse(text));
  } catch {
    return null;
  }
}

// ───────────── query / header 字串值的型別還原 ─────────────

export interface TextInference {
  type: ScalarType;
  format?: string;
}

/** 對 query/header 這類「一律是字串」的值，還原其可能型別並偵測格式。 */
export function inferFromText(raw: string): TextInference {
  const v = raw.trim();
  if (RE.variable.test(v)) return { type: "variable" };
  if (v === "true" || v === "false") return { type: "boolean" };
  if (/^-?\d+$/.test(v)) return { type: "integer" };
  if (/^-?\d*\.\d+$/.test(v)) return { type: "number" };
  const format = detectStringFormat(v);
  return { type: "string", format };
}
