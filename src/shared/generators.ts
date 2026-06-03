// 沉澱產生器（P3「好整理」）：把推測出的 schema 轉成可用的程式碼與文件。
//
// - toTypeScript：TypeScript interface（含巢狀）
// - toJavaDto：Java record DTO（Spring Boot 友善）
// - toMarkdownDoc：由 request + response 產 API Markdown 文件
//
// 全部基於 analyze.ts 的 SchemaNode，純前端、即時。

import type { SchemaNode } from "./analyze";
import { inferValue } from "./analyze";

// ───────────────────────── 命名工具 ─────────────────────────

function pascal(s: string): string {
  const c = s
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return c || "Field";
}

/** 粗略單數化：roles → role，避免陣列元素型別名帶複數。 */
function singular(s: string): string {
  if (/ies$/i.test(s)) return s.slice(0, -3) + "y";
  if (/s$/i.test(s) && s.length > 1) return s.slice(0, -1);
  return s;
}

// ───────────────────────── TypeScript ─────────────────────────

export function toTypeScript(root: SchemaNode | null, rootName = "Root"): string {
  if (!root) return "// 無可推測的結構";
  const defs = new Map<string, string>();

  function tsType(node: SchemaNode, nameHint: string): string {
    switch (node.type) {
      case "integer":
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "variable":
        return "string";
      case "mixed":
        return "unknown";
      case "string":
        return "string";
      case "array": {
        const inner = node.items ? tsType(node.items, singular(nameHint)) : "unknown";
        return inner.includes(" ") ? `(${inner})[]` : `${inner}[]`;
      }
      case "object": {
        const typeName = pascal(nameHint);
        buildInterface(node, typeName);
        return typeName;
      }
    }
  }

  function buildInterface(node: SchemaNode, typeName: string) {
    if (defs.has(typeName)) return;
    defs.set(typeName, ""); // 預留位置，避免遞迴重複
    const lines = (node.fields ?? []).map((f) => {
      const opt = f.required ? "" : "?";
      return `  ${f.key}${opt}: ${tsType(f.node, f.key)};`;
    });
    defs.set(typeName, `export interface ${typeName} {\n${lines.join("\n")}\n}`);
  }

  if (root.type === "object") {
    buildInterface(root, pascal(rootName));
    return [...defs.values()].filter(Boolean).join("\n\n");
  }
  // 非物件根（如陣列）：先算出別名型別（會順帶收集巢狀 interface），
  // 再把別名與巢狀定義一併輸出，避免遺失巢狀 interface。
  const alias = `export type ${pascal(rootName)} = ${tsType(root, rootName)};`;
  const nested = [...defs.values()].filter(Boolean);
  return [alias, ...nested].join("\n\n");
}

// ───────────────────────── Java DTO（record） ─────────────────────────

function javaType(node: SchemaNode, nameHint: string, defs: Map<string, string>): string {
  switch (node.type) {
    case "integer":
      return "Long";
    case "number":
      return "Double";
    case "boolean":
      return "Boolean";
    case "string":
      if (node.format === "uuid") return "UUID";
      if (node.format === "date") return "LocalDate";
      if (node.format === "datetime") return "OffsetDateTime";
      return "String";
    case "variable":
      return "String";
    case "null":
    case "mixed":
      return "Object";
    case "array": {
      const inner = node.items ? javaType(node.items, singular(nameHint), defs) : "Object";
      return `List<${inner}>`;
    }
    case "object": {
      const typeName = pascal(nameHint);
      buildRecord(node, typeName, defs);
      return typeName;
    }
  }
}

function buildRecord(node: SchemaNode, typeName: string, defs: Map<string, string>) {
  if (defs.has(typeName)) return;
  defs.set(typeName, "");
  const fields = (node.fields ?? []).map((f) => `    ${javaType(f.node, f.key, defs)} ${f.key}`);
  defs.set(typeName, `public record ${typeName}(\n${fields.join(",\n")}\n) {}`);
}

export function toJavaDto(root: SchemaNode | null, rootName = "Root"): string {
  if (!root) return "// 無可推測的結構";
  if (root.type !== "object") {
    return `// 根節點非物件，無法直接產生 record。型別：${root.type}`;
  }
  const defs = new Map<string, string>();
  buildRecord(root, pascal(rootName), defs);
  const body = [...defs.values()].filter(Boolean).join("\n\n");
  const hint = "// 草稿：依需要調整型別（如 Long/Integer）、加上 Lombok 或欄位驗證註解。\n";
  const importsHint = collectJavaImports(body);
  return hint + (importsHint ? importsHint + "\n\n" : "") + body;
}

function collectJavaImports(code: string): string {
  const imports: string[] = [];
  if (/\bList<\b|\bList<\w/.test(code) || code.includes("List<")) imports.push("import java.util.List;");
  if (code.includes("UUID")) imports.push("import java.util.UUID;");
  if (code.includes("LocalDate")) imports.push("import java.time.LocalDate;");
  if (code.includes("OffsetDateTime")) imports.push("import java.time.OffsetDateTime;");
  return imports.join("\n");
}

// ───────────────────────── Markdown API 文件 ─────────────────────────

interface FlatRow {
  path: string;
  type: string;
  required: boolean;
}

/** 把 schema 攤平成 dotted-path 列，供 Markdown 表格使用。 */
function flatten(node: SchemaNode, prefix = "", out: FlatRow[] = [], required = true): FlatRow[] {
  if (node.type === "object") {
    for (const f of node.fields ?? []) {
      const path = prefix ? `${prefix}.${f.key}` : f.key;
      flatten(f.node, path, out, f.required);
    }
  } else if (node.type === "array") {
    const path = `${prefix}[]`;
    if (node.items && (node.items.type === "object" || node.items.type === "array")) {
      flatten(node.items, path, out, required);
    } else {
      out.push({ path, type: `${node.items?.type ?? "unknown"}[]`, required });
    }
  } else {
    const t = node.format ? `${node.type}(${node.format})` : node.type;
    out.push({ path: prefix, type: t, required });
  }
  return out;
}

export interface DocInput {
  name: string;
  method: string;
  url: string;
  description?: string;
  query: { key: string; value: string }[];
  headers: { key: string; value: string }[];
  bodyJson?: string;
  response?: {
    status: number;
    statusText: string;
    body: string;
    contentType?: string | null;
  };
}

export function toMarkdownDoc(input: DocInput): string {
  const L: string[] = [];
  L.push(`# ${input.name || input.url}`);
  L.push("");
  L.push(`\`${input.method.toUpperCase()}\` \`${input.url}\``);
  if (input.description) {
    L.push("");
    L.push(input.description);
  }

  if (input.query.length) {
    L.push("");
    L.push("## Query 參數");
    L.push("");
    L.push("| 參數 | 範例值 |");
    L.push("|---|---|");
    for (const q of input.query) L.push(`| ${q.key} | ${q.value || ""} |`);
  }

  if (input.headers.length) {
    L.push("");
    L.push("## Headers");
    L.push("");
    L.push("| Header | 值 |");
    L.push("|---|---|");
    for (const h of input.headers) L.push(`| ${h.key} | ${h.value || ""} |`);
  }

  if (input.bodyJson && input.bodyJson.trim()) {
    const node = inferValue(safeParse(input.bodyJson));
    if (node) {
      L.push("");
      L.push("## Request Body");
      L.push("");
      L.push("| 欄位 | 型別 | 必填 |");
      L.push("|---|---|---|");
      for (const r of flatten(node)) L.push(`| ${r.path} | ${r.type} | ${r.required ? "是" : "否"} |`);
    }
  }

  if (input.response) {
    L.push("");
    L.push(`## Response （${input.response.status} ${input.response.statusText}）`);
    const node = tryInfer(input.response.body);
    if (node) {
      L.push("");
      L.push("| 欄位 | 型別 |");
      L.push("|---|---|");
      for (const r of flatten(node)) L.push(`| ${r.path} | ${r.type} |`);
    }
    L.push("");
    L.push("```json");
    L.push(truncateBody(input.response.body));
    L.push("```");
  }

  L.push("");
  return L.join("\n");
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryInfer(text: string): SchemaNode | null {
  const v = safeParse(text);
  return v === null && text.trim() !== "null" ? null : inferValue(v);
}

function truncateBody(body: string, max = 2000): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + "\n… （已截斷）";
}
