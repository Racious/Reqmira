<script setup lang="ts">
// 沉澱面板：由回應 schema 與目前 request 產出 TypeScript / Java DTO / Markdown 文件。
import { ref, computed } from "vue";
import type { SchemaNode } from "../analyze";
import { toTypeScript, toJavaDto, toMarkdownDoc } from "../generators";
import { useSessionStore } from "../stores/session";
import { useToast } from "../toast";

const props = defineProps<{ node: SchemaNode | null }>();

const session = useSessionStore();

type Lang = "ts" | "java" | "md";
const lang = ref<Lang>("ts");
const copied = ref(false);

// 預設根型別名取自請求 id（PascalCase 由產生器處理）。
const rootName = ref("");
const effectiveName = computed(() => rootName.value.trim() || defaultName());

function defaultName(): string {
  const id = session.draft?.id ?? "Response";
  return id.replace(/[^A-Za-z0-9]+/g, " ").trim() || "Response";
}

const output = computed(() => {
  switch (lang.value) {
    case "ts":
      return toTypeScript(props.node, effectiveName.value);
    case "java":
      return toJavaDto(props.node, effectiveName.value);
    case "md":
      return buildMarkdown();
  }
});

function buildMarkdown(): string {
  const d = session.draft;
  const r = session.response;
  return toMarkdownDoc({
    name: d?.name ?? "API",
    method: d?.method ?? "GET",
    url: d?.url ?? "",
    query: (d?.query ?? []).filter((q) => q.enabled && q.key.trim()).map((q) => ({ key: q.key, value: q.value })),
    headers: (d?.headers ?? []).filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: h.key, value: h.value })),
    bodyJson: d?.bodyType === "json" ? d?.bodyContent : undefined,
    response: r
      ? { status: r.status, statusText: r.statusText, body: r.body, contentType: r.contentType }
      : undefined,
  });
}

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value ?? "");
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
    useToast().show(`已複製 ${lang.value === "ts" ? "TypeScript" : lang.value === "java" ? "Java DTO" : "Markdown"}`);
  } catch {
    useToast().show("複製失敗");
  }
}
</script>

<template>
  <div class="codegen">
    <div class="cg-bar">
      <div class="langs">
        <button class="lg" :class="{ on: lang === 'ts' }" @click="lang = 'ts'">TypeScript</button>
        <button class="lg" :class="{ on: lang === 'java' }" @click="lang = 'java'">Java DTO</button>
        <button class="lg" :class="{ on: lang === 'md' }" @click="lang = 'md'">Markdown</button>
      </div>
      <label v-if="lang !== 'md'" class="nm">
        型別名
        <input v-model="rootName" :placeholder="defaultName()" spellcheck="false" />
      </label>
      <div class="spacer" />
      <button class="copy" @click="copy">{{ copied ? "已複製 ✓" : "複製" }}</button>
    </div>
    <pre class="cg-out"><code>{{ output }}</code></pre>
  </div>
</template>

<style scoped>
.codegen {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.cg-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 10px;
  flex-wrap: wrap;
}
.langs {
  display: flex;
  gap: 2px;
}
.lg {
  background: none;
  border: 1px solid var(--border);
  color: var(--fg-dim);
  padding: 3px 12px;
  font-size: 12px;
}
.lg.on {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
}
.nm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-dim);
}
.nm input {
  width: 150px;
  padding: 4px 8px;
}
.spacer {
  flex: 1;
}
.copy {
  font-size: 12px;
}
.cg-out {
  flex: 1;
  margin: 0;
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
</style>
