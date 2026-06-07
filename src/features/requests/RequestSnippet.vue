<script setup lang="ts">
// 由目前請求產生多語言發送程式碼，可複製。
import { ref, computed } from "vue";
import { useSessionStore } from "../../shared/stores/session";
import { buildSnippets, type SnippetLang, type SnippetInput } from "../../shared/snippets";
import { copyWithToast } from "../../shared/toast";

const emit = defineEmits<{ (e: "close"): void }>();
const session = useSessionStore();

const lang = ref<SnippetLang>("curl");
const LANGS: { v: SnippetLang; label: string }[] = [
  { v: "curl", label: "curl" },
  { v: "javascript", label: "JavaScript" },
  { v: "python", label: "Python" },
  { v: "java", label: "Java" },
];

/** 把目前草稿（含 Auth）正規化成 snippet 輸入。 */
const input = computed<SnippetInput>(() => {
  const d = session.draft;
  const headers = (d?.headers ?? []).filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: h.key, value: h.value }));
  const query = (d?.query ?? []).filter((q) => q.enabled && q.key.trim()).map((q) => ({ key: q.key, value: q.value }));
  // 併入 Auth
  const a = d?.auth;
  if (a && a.type === "bearer" && a.token) headers.push({ key: "Authorization", value: `Bearer ${a.token}` });
  else if (a && a.type === "basic") headers.push({ key: "Authorization", value: `Basic <base64(${a.username ?? ""}:${a.password ?? ""})>` });
  else if (a && a.type === "apikey" && a.key) {
    if (a.addTo === "query") query.push({ key: a.key, value: a.value ?? "" });
    else headers.push({ key: a.key, value: a.value ?? "" });
  }
  return {
    method: d?.method ?? "GET",
    url: d?.url ?? "",
    query,
    headers,
    body: d?.bodyContent,
    bodyType: d?.bodyType,
  };
});

const output = computed(() => buildSnippets(input.value)[lang.value]);

const VAR_EXAMPLE = "{{var}}";

function copy() {
  copyWithToast(output.value, `已複製 ${lang.value}`);
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>產生程式碼</h3>
        <button @click="emit('close')">關閉</button>
      </header>
      <div class="bar">
        <div class="langs">
          <button v-for="l in LANGS" :key="l.v" class="lg" :class="{ on: lang === l.v }" @click="lang = l.v">
            {{ l.label }}
          </button>
        </div>
        <div class="spacer" />
        <button class="copy" @click="copy">複製</button>
      </div>
      <pre class="out"><code>{{ output }}</code></pre>
      <p class="dim foot">提示：<code>{{ VAR_EXAMPLE }}</code> 保留原樣，貼進專案後再替換成實際值。</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 9, 18, 0.6);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 70;
}
.modal {
  width: min(680px, 92vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.m-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.m-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--accent);
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 0;
}
.langs {
  display: flex;
  gap: 2px;
}
.lg {
  background: none;
  border: 1px solid var(--border);
  color: var(--fg-dim);
  padding: 4px 12px;
  font-size: 12px;
}
.lg.on {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
}
.spacer {
  flex: 1;
}
.out {
  margin: 12px 16px;
  overflow: auto;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.6;
  color: #cdd6e6;
  white-space: pre;
}
.foot {
  margin: 0 16px 14px;
  font-size: 11.5px;
}
</style>
