// 由目前請求產生多語言發送程式碼（curl / JS fetch / Python requests / Java HttpClient）。
// 保留 {{var}} 原樣（不解析、不編碼），讓 snippet 可讀、可貼進專案再自行替換。

export interface SnippetInput {
  method: string;
  url: string;
  query: { key: string; value: string }[];
  headers: { key: string; value: string }[];
  body?: string;
  bodyType?: string;
}

function fullUrl(input: SnippetInput): string {
  const qs = input.query
    .filter((q) => q.key.trim())
    .map((q) => `${q.key}=${q.value}`)
    .join("&");
  if (!qs) return input.url;
  return input.url + (input.url.includes("?") ? "&" : "?") + qs;
}

function hasBody(input: SnippetInput): boolean {
  return !!input.body && input.bodyType !== "none" && input.body.trim().length > 0;
}

function pyDict(headers: { key: string; value: string }[]): string {
  const items = headers.filter((h) => h.key.trim()).map((h) => `        "${h.key}": "${h.value}"`);
  return items.length ? `{\n${items.join(",\n")}\n    }` : "{}";
}

function jsObj(headers: { key: string; value: string }[]): string {
  const items = headers.filter((h) => h.key.trim()).map((h) => `    "${h.key}": "${h.value}"`);
  return items.length ? `{\n${items.join(",\n")}\n  }` : "{}";
}

function toCurl(input: SnippetInput): string {
  const lines = [`curl -X ${input.method.toUpperCase()} '${fullUrl(input)}'`];
  for (const h of input.headers.filter((h) => h.key.trim())) {
    lines.push(`  -H '${h.key}: ${h.value}'`);
  }
  if (hasBody(input)) lines.push(`  -d '${input.body}'`);
  return lines.join(" \\\n");
}

function toFetch(input: SnippetInput): string {
  const parts = [`  method: "${input.method.toUpperCase()}"`, `  headers: ${jsObj(input.headers)}`];
  if (hasBody(input)) parts.push(`  body: ${JSON.stringify(input.body)}`);
  return `fetch("${fullUrl(input)}", {\n${parts.join(",\n")},\n})\n  .then((r) => r.json())\n  .then(console.log);`;
}

function toPython(input: SnippetInput): string {
  const args = [`    "${fullUrl(input)}"`, `    headers=${pyDict(input.headers)}`];
  if (hasBody(input)) {
    if (input.bodyType === "json") args.push(`    data=${JSON.stringify(input.body)}`);
    else args.push(`    data=${JSON.stringify(input.body)}`);
  }
  return `import requests\n\nresp = requests.${input.method.toLowerCase()}(\n${args.join(",\n")},\n)\nprint(resp.status_code, resp.text)`;
}

function toJava(input: SnippetInput): string {
  const lines = [
    "HttpClient client = HttpClient.newHttpClient();",
    "HttpRequest request = HttpRequest.newBuilder()",
    `    .uri(URI.create("${fullUrl(input)}"))`,
  ];
  for (const h of input.headers.filter((h) => h.key.trim())) {
    lines.push(`    .header("${h.key}", "${h.value}")`);
  }
  const m = input.method.toUpperCase();
  if (hasBody(input)) {
    lines.push(`    .method("${m}", HttpRequest.BodyPublishers.ofString(${JSON.stringify(input.body)}))`);
  } else {
    lines.push(`    .method("${m}", HttpRequest.BodyPublishers.noBody())`);
  }
  lines.push("    .build();");
  lines.push("HttpResponse<String> resp = client.send(request, HttpResponse.BodyHandlers.ofString());");
  lines.push("System.out.println(resp.statusCode());");
  lines.push("System.out.println(resp.body());");
  return lines.join("\n");
}

export function buildSnippets(input: SnippetInput) {
  return {
    curl: toCurl(input),
    javascript: toFetch(input),
    python: toPython(input),
    java: toJava(input),
  };
}

export type SnippetLang = "curl" | "javascript" | "python" | "java";
