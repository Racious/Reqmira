<script setup lang="ts">
// 右欄 Inspector：自動拆解 URL / Query / Headers / Body，推測型別與格式。
// 這是 Reqmira 的差異化主功能（定稿 §6.2），P2 接上共用推測引擎。
import { computed } from "vue";
import { useSessionStore } from "../../shared/stores/session";
import { buildSchemaFromText, inferFromText } from "../../shared/analyze";
import SchemaTree from "../../shared/components/SchemaTree.vue";

const session = useSessionStore();

/** 從 URL path 抽取變數占位：{id} / :id / {{var}}。 */
const pathParams = computed(() => {
  const url = session.draft?.url ?? "";
  const pathPart = url.split("?")[0];
  const found: { token: string; kind: string }[] = [];
  const seen = new Set<string>();
  const push = (token: string, kind: string) => {
    if (!seen.has(token)) {
      seen.add(token);
      found.push({ token, kind });
    }
  };
  for (const m of pathPart.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) push(m[1], "環境變數");
  for (const m of pathPart.matchAll(/(?<!\{)\{([\w-]+)\}(?!\})/g)) push(m[1], "path variable");
  for (const m of pathPart.matchAll(/\/:([\w-]+)/g)) push(m[1], "path variable");
  return found;
});

const queryParams = computed(() =>
  (session.draft?.query ?? [])
    .filter((q) => q.enabled && q.key.trim())
    .map((q) => {
      const inf = inferFromText(q.value);
      return { key: q.key, value: q.value, type: inf.type, format: inf.format };
    }),
);

const headers = computed(() =>
  (session.draft?.headers ?? [])
    .filter((h) => h.enabled && h.key.trim())
    .map((h) => {
      let hint = "";
      if (/^authorization$/i.test(h.key)) {
        hint = /^bearer/i.test(h.value) ? "Bearer Token" : "Authorization";
      } else if (/^content-type$/i.test(h.key)) {
        hint = "內容型別";
      }
      const usesVar = /\{\{.*?\}\}/.test(h.value);
      return { key: h.key, value: h.value, hint, usesVar };
    }),
);

const bodySchema = computed(() => {
  const d = session.draft;
  if (!d || d.bodyType !== "json") return null;
  return buildSchemaFromText(d.bodyContent);
});
</script>

<template>
  <aside class="inspector">
    <h3 class="insp-title">Inspector</h3>
    <p class="dim sub">參數拆解與型別推測</p>

    <template v-if="session.draft">
      <!-- Path -->
      <div class="block">
        <h4>Path 變數</h4>
        <ul v-if="pathParams.length" class="plist">
          <li v-for="p in pathParams" :key="p.token">
            <code>{{ p.token }}</code><span class="kind">{{ p.kind }}</span>
          </li>
        </ul>
        <p v-else class="faint none">URL 未含 path 變數</p>
      </div>

      <!-- Query -->
      <div class="block">
        <h4>Query 參數</h4>
        <table v-if="queryParams.length" class="atable">
          <tr v-for="q in queryParams" :key="q.key">
            <td class="ak mono">{{ q.key }}</td>
            <td>
              <span class="type" :class="`tt-${q.type}`">{{ q.type }}</span>
              <span v-if="q.format" class="fmt">{{ q.format }}</span>
            </td>
            <td class="av mono dim">{{ q.value }}</td>
          </tr>
        </table>
        <p v-else class="faint none">無 query 參數</p>
      </div>

      <!-- Headers -->
      <div class="block">
        <h4>Headers</h4>
        <table v-if="headers.length" class="atable">
          <tr v-for="h in headers" :key="h.key">
            <td class="ak mono">{{ h.key }}</td>
            <td>
              <span v-if="h.hint" class="type tt-hint">{{ h.hint }}</span>
              <span v-if="h.usesVar" class="type tt-variable">變數</span>
            </td>
          </tr>
        </table>
        <p v-else class="faint none">無 header</p>
      </div>

      <!-- Body schema -->
      <div class="block">
        <h4>Body Schema 推測</h4>
        <div v-if="bodySchema" class="schema">
          <SchemaTree :node="bodySchema" :depth="0" :show-required="true" />
        </div>
        <p v-else-if="session.draft.bodyType === 'json'" class="faint none">JSON 無法解析或為空</p>
        <p v-else class="faint none">非 JSON body</p>
      </div>
    </template>
    <p v-else class="faint none">選擇請求後顯示分析</p>
  </aside>
</template>

<style scoped>
.inspector {
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  border-left: 1px solid var(--border);
  background: var(--bg-soft);
}
.insp-title {
  margin: 0;
  font-size: 15px;
  color: var(--accent);
}
.sub {
  margin: 2px 0 14px;
  font-size: 12px;
}
.block {
  margin-bottom: 18px;
}
.block h4 {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-faint);
}
.none {
  font-size: 12px;
  margin: 4px 0;
}
.plist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.plist li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.kind {
  font-size: 11px;
  color: var(--accent-2);
}
.atable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.atable td {
  padding: 3px 6px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.ak {
  color: var(--fg);
  word-break: break-all;
}
.av {
  font-size: 11.5px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.type {
  display: inline-block;
  font-size: 10.5px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  margin-right: 4px;
}
.fmt {
  display: inline-block;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(216, 180, 106, 0.3);
  color: var(--accent-2);
}
.tt-string {
  color: var(--good);
}
.tt-integer,
.tt-number {
  color: var(--accent-2);
}
.tt-boolean {
  color: var(--accent-3);
}
.tt-variable {
  color: var(--accent);
}
.tt-hint {
  color: var(--accent-2);
}
.schema {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  overflow-x: auto;
}
</style>
