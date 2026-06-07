<script setup lang="ts">
// 貼上 OpenAPI(JSON) 或 Postman collection → 解析 → 逐一存成請求。
import { ref } from "vue";
import { detectAndParse, type ImportResult } from "../../shared/importers";
import * as api from "../../shared/api";
import { useWorkspaceStore } from "../../shared/stores/workspace";
import { useToast } from "../../shared/toast";

const emit = defineEmits<{ (e: "close"): void }>();
const ws = useWorkspaceStore();
const { show } = useToast();

const text = ref("");
const error = ref("");
const result = ref<ImportResult | null>(null);
const importing = ref(false);

function parse() {
  error.value = "";
  result.value = null;
  try {
    const r = detectAndParse(text.value);
    if (!r.items.length) {
      error.value = "解析成功，但找不到任何請求";
      return;
    }
    result.value = r;
  } catch (e) {
    error.value = String(e instanceof Error ? e.message : e);
  }
}

async function doImport() {
  if (!result.value) return;
  importing.value = true;
  error.value = "";
  let ok = 0;
  try {
    for (const item of result.value.items) {
      try {
        await api.saveRequest(ws.root, item.path, item.spec);
        ok++;
      } catch {
        /* 個別失敗略過，續匯入其餘 */
      }
    }
    await ws.refresh();
    show(`已匯入 ${ok} 支請求`);
    emit("close");
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>匯入 OpenAPI / Postman</h3>
        <button @click="emit('close')">關閉</button>
      </header>
      <div class="m-body">
        <p class="dim hint">
          貼上 OpenAPI（swagger.json，含 openapi/swagger 欄位）或 Postman collection（v2.1）的 JSON 內容。
        </p>
        <textarea
          v-model="text"
          class="spec-input mono"
          rows="10"
          spellcheck="false"
          placeholder='{ "openapi": "3.0.0", "paths": { ... } }'
        />
        <div class="actions">
          <button class="primary" :disabled="!text.trim()" @click="parse">解析</button>
          <button v-if="result" class="primary" :disabled="importing" @click="doImport">
            {{ importing ? "匯入中…" : `匯入 ${result.items.length} 支請求` }}
          </button>
          <button @click="emit('close')">取消</button>
        </div>
        <p v-if="error" class="err">⚠ {{ error }}</p>
        <div v-if="result" class="preview">
          <p class="dim">偵測格式：<b>{{ result.kind }}</b>，共 {{ result.items.length }} 支：</p>
          <ul class="plist">
            <li v-for="(it, i) in result.items.slice(0, 50)" :key="i">
              <span class="m mono">{{ it.spec.method }}</span>
              <span class="nm">{{ it.spec.name }}</span>
              <span class="pth mono dim">{{ it.path }}</span>
            </li>
          </ul>
          <p v-if="result.items.length > 50" class="dim small">…等共 {{ result.items.length }} 支</p>
        </div>
      </div>
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
  max-height: 88vh;
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
.m-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.hint {
  margin: 0 0 10px;
  font-size: 12.5px;
}
.spec-input {
  width: 100%;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.err {
  color: var(--bad);
  font-size: 12.5px;
}
.preview {
  margin-top: 12px;
}
.plist {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 30vh;
  overflow-y: auto;
}
.plist li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
  font-size: 12.5px;
}
.m {
  min-width: 52px;
  color: var(--accent-2);
  font-size: 11px;
}
.nm {
  flex: 1;
}
.pth {
  font-size: 11px;
}
.small {
  font-size: 11px;
}
</style>
