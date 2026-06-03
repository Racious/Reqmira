// 極簡 JSONPath 取值，支援 Flow 的 extract 與 assert。
// 支援：$.a.b.c、a.b、陣列索引 a[0].b、$[0]。不支援萬用字元/過濾器（P4 夠用即止）。

/** 將路徑字串拆成 token 序列（key 或數字索引）。 */
function tokenize(path: string): (string | number)[] {
  let p = path.trim();
  if (p.startsWith("$")) p = p.slice(1);
  if (p.startsWith(".")) p = p.slice(1);
  const tokens: (string | number)[] = [];
  // 比對 .key 或 [index] 或 開頭的 key
  const re = /\[(\d+)\]|\.?([^.[\]]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    if (m[1] !== undefined) tokens.push(Number(m[1]));
    else if (m[2] !== undefined) tokens.push(m[2]);
  }
  return tokens;
}

/** 依路徑取值；取不到回傳 undefined。 */
export function getByPath(root: unknown, path: string): unknown {
  const tokens = tokenize(path);
  let cur: unknown = root;
  for (const t of tokens) {
    if (cur == null) return undefined;
    if (typeof t === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[t];
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[t];
    }
  }
  return cur;
}
