// 匯入解析：OpenAPI(JSON) 與 Postman v2.1 → Reqmira 請求陣列。
// 務實版：保留 {{var}}（Postman 變數相容）；OpenAPI 以 {{baseUrl}} 為基底、
// requestBody 產淺層範例（不深度解析 $ref）。
import type { RequestSpec } from "./types";

export interface ImportedRequest {
  path: string; // 相對 workspace 的存檔路徑
  spec: RequestSpec;
}

export interface ImportResult {
  kind: "OpenAPI" | "Postman";
  items: ImportedRequest[];
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function slug(s: string): string {
  return (
    s
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

// ───────────────────────── OpenAPI ─────────────────────────

function exampleFor(schema: any, depth = 0): unknown {
  if (!schema || depth > 3) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.$ref) return {}; // 不解析 ref
  if (schema.properties || schema.type === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) o[k] = exampleFor(v, depth + 1);
    return o;
  }
  if (schema.type === "array") return [schema.items ? exampleFor(schema.items, depth + 1) : null];
  if (schema.type === "integer" || schema.type === "number") return 0;
  if (schema.type === "boolean") return false;
  if (schema.type === "string") {
    if (schema.enum?.length) return schema.enum[0];
    if (schema.format === "date-time") return "2020-01-01T00:00:00Z";
    return "";
  }
  return null;
}

function parseOpenApi(doc: any): ImportedRequest[] {
  const items: ImportedRequest[] = [];
  const paths = doc.paths ?? {};
  for (const [p, pathItem] of Object.entries<any>(paths)) {
    const sharedParams: any[] = pathItem.parameters ?? [];
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      const params = [...sharedParams, ...(op.parameters ?? [])];
      const headers: Record<string, string> = {};
      const query: Record<string, string> = {};
      for (const prm of params) {
        if (prm.in === "query") query[prm.name] = "";
        else if (prm.in === "header") headers[prm.name] = "";
      }
      const spec: RequestSpec = {
        version: 1,
        id: slug(op.operationId || `${method}-${p}`),
        name: op.summary || `${method.toUpperCase()} ${p}`,
        method: method.toUpperCase(),
        url: `{{baseUrl}}${p}`,
        headers,
        query,
      };
      const json = op.requestBody?.content?.["application/json"];
      if (json) {
        const ex = json.example ?? exampleFor(json.schema);
        spec.body = { type: "json", content: JSON.stringify(ex ?? {}, null, 2) };
      }
      const tag = op.tags?.[0] ? slug(op.tags[0]) : "imported";
      items.push({ path: `collections/${tag}/${spec.id}.api.yaml`, spec });
    }
  }
  return items;
}

// ───────────────────────── Postman v2.1 ─────────────────────────

function postmanUrl(url: any): { raw: string; query: Record<string, string> } {
  const query: Record<string, string> = {};
  if (typeof url === "string") return { raw: url, query };
  const raw: string = url?.raw ?? "";
  for (const q of url?.query ?? []) {
    if (q?.key) query[q.key] = q.value ?? "";
  }
  return { raw, query };
}

function walkPostman(items: any[], prefix: string, out: ImportedRequest[]) {
  for (const it of items ?? []) {
    if (it.item) {
      // 資料夾
      walkPostman(it.item, `${prefix}${slug(it.name || "folder")}/`, out);
      continue;
    }
    const req = it.request;
    if (!req) continue;
    const method = (typeof req === "string" ? "GET" : req.method) || "GET";
    const { raw, query } = postmanUrl(req.url);
    const headers: Record<string, string> = {};
    for (const h of req.header ?? []) {
      if (h?.key && !h.disabled) headers[h.key] = h.value ?? "";
    }
    const spec: RequestSpec = {
      version: 1,
      id: slug(it.name || method),
      name: it.name || `${method} ${raw}`,
      method: String(method).toUpperCase(),
      url: raw,
      headers,
      query,
    };
    const rawBody = req.body?.raw;
    if (rawBody && req.body?.mode === "raw") {
      const looksJson = rawBody.trim().startsWith("{") || rawBody.trim().startsWith("[");
      spec.body = { type: looksJson ? "json" : "text", content: rawBody };
    }
    out.push({ path: `collections/${prefix}${spec.id}.api.yaml`, spec });
  }
}

function parsePostman(doc: any): ImportedRequest[] {
  const out: ImportedRequest[] = [];
  walkPostman(doc.item ?? [], "", out);
  return out;
}

// ───────────────────────── 入口 ─────────────────────────

export function detectAndParse(text: string): ImportResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("內容非有效 JSON（OpenAPI/Postman 請貼 JSON 格式）");
  }
  if (data.openapi || data.swagger) return { kind: "OpenAPI", items: parseOpenApi(data) };
  if (data.info && (data.item || data.info._postman_id)) {
    return { kind: "Postman", items: parsePostman(data) };
  }
  throw new Error("無法辨識格式：需要 OpenAPI（含 openapi/swagger 欄位）或 Postman collection JSON");
}
