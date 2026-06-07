// 回應引用：記住每支請求最新一次的回應，供 {{responses.<id>.<path>}} 引用。
// 送出前由 session/flow 掃描並把引用解析成值，併入傳給 Rust 的 variables。
import { reactive } from "vue";
import { getByPath } from "../jsonpath";

// requestId → 最新回應（已解析 JSON；非 JSON 則存原字串）
const latest = reactive<Record<string, unknown>>({});

const REF_RE = /\{\{\s*(responses\.[^}]+?)\s*\}\}/g;

export function useResponses() {
  /** 送出成功後記錄某請求的最新回應。 */
  function record(id: string, body: string) {
    if (!id) return;
    try {
      latest[id] = JSON.parse(body);
    } catch {
      latest[id] = body;
    }
  }

  /** 解析單一引用運算式：responses.<id>.<jsonpath>。 */
  function resolveExpr(expr: string): string | undefined {
    const e = expr.trim();
    if (!e.startsWith("responses.")) return undefined;
    const rest = e.slice("responses.".length);
    const dot = rest.indexOf(".");
    const id = dot < 0 ? rest : rest.slice(0, dot);
    const path = dot < 0 ? "" : rest.slice(dot + 1);
    if (!(id in latest)) return undefined;
    const v = path ? getByPath(latest[id], path) : latest[id];
    if (v === undefined || v === null) return undefined;
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  }

  /** 掃描多段文字中的 {{responses.*}}，回傳可併入 variables 的 map（key 為內層運算式）。 */
  function refVars(texts: (string | undefined | null)[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const t of texts) {
      if (!t) continue;
      REF_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = REF_RE.exec(t)) !== null) {
        const expr = m[1].trim();
        const val = resolveExpr(expr);
        if (val !== undefined) out[expr] = val;
      }
    }
    return out;
  }

  return { record, resolveExpr, refVars };
}
