// curl 指令解析：把貼上的 curl 轉成請求草稿欄位。
// 支援 method(-X)、header(-H)、data(-d/--data*)、basic auth(-u)、cookie(-b)、續行與引號。

import type { KeyValue } from "./types";

export interface ParsedCurl {
  method: string;
  url: string;
  headers: KeyValue[];
  body: string;
  bodyType: "none" | "json" | "text";
}

/** 尊重單/雙引號的 tokenizer。 */
function tokenize(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, " "); // 續行
  const out: string[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && /\s/.test(s[i])) i++;
    if (i >= n) break;
    let tok = "";
    while (i < n && !/\s/.test(s[i])) {
      const c = s[i];
      if (c === "'") {
        i++;
        while (i < n && s[i] !== "'") tok += s[i++];
        i++;
      } else if (c === '"') {
        i++;
        while (i < n && s[i] !== '"') {
          if (s[i] === "\\" && i + 1 < n) {
            tok += s[i + 1];
            i += 2;
          } else {
            tok += s[i++];
          }
        }
        i++;
      } else {
        tok += c;
        i++;
      }
    }
    out.push(tok);
  }
  return out;
}

function looksJson(s: string): boolean {
  const t = s.trim();
  return t.startsWith("{") || t.startsWith("[");
}

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input.trim());
  // 去掉開頭的 curl
  if (tokens[0] === "curl") tokens.shift();

  let method = "";
  let url = "";
  const headers: KeyValue[] = [];
  let body = "";
  // 取下一個參數的小工具
  const dataFlags = ["-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode"];
  // 不帶參數、可忽略的旗標
  const skipNoArg = new Set([
    "--compressed", "-L", "--location", "-k", "--insecure", "-s", "--silent",
    "-i", "--include", "-v", "--verbose", "-g", "--globoff", "-f", "--fail",
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-X" || t === "--request") {
      method = tokens[++i] ?? "";
    } else if (t === "-H" || t === "--header") {
      const h = tokens[++i] ?? "";
      const idx = h.indexOf(":");
      if (idx > 0) {
        headers.push({ key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim(), enabled: true });
      }
    } else if (dataFlags.includes(t)) {
      const d = tokens[++i] ?? "";
      body = body ? `${body}&${d}` : d;
      if (!method) method = "POST";
    } else if (t === "-u" || t === "--user") {
      const cred = tokens[++i] ?? "";
      const enc = typeof btoa !== "undefined" ? btoa(cred) : cred;
      headers.push({ key: "Authorization", value: `Basic ${enc}`, enabled: true });
    } else if (t === "-b" || t === "--cookie") {
      headers.push({ key: "Cookie", value: tokens[++i] ?? "", enabled: true });
    } else if (t === "--url") {
      url = tokens[++i] ?? "";
    } else if (skipNoArg.has(t)) {
      // 忽略
    } else if (t.startsWith("-")) {
      // 未知旗標：保守跳過該 token（不吞掉下一個）
    } else if (!url) {
      url = t;
    }
  }

  const bodyType: ParsedCurl["bodyType"] = body ? (looksJson(body) ? "json" : "text") : "none";
  return {
    method: (method || "GET").toUpperCase(),
    url,
    headers,
    body,
    bodyType,
  };
}
