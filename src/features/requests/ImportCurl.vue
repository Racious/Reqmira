<script setup lang="ts">
// 貼上 curl 指令 → 解析 → 建立為新請求草稿。
import { ref } from "vue";
import { parseCurl } from "../../shared/curl";
import { useSessionStore } from "../../shared/stores/session";

const emit = defineEmits<{ (e: "close"): void }>();
const session = useSessionStore();

const text = ref("");
const error = ref("");

function doImport() {
  error.value = "";
  const trimmed = text.value.trim();
  if (!trimmed) {
    error.value = "請貼上 curl 指令";
    return;
  }
  try {
    const parsed = parseCurl(trimmed);
    if (!parsed.url) {
      error.value = "未能解析出 URL，請確認 curl 指令格式";
      return;
    }
    session.importDraft(parsed);
    emit("close");
  } catch (e) {
    error.value = String(e);
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>匯入 curl</h3>
        <button @click="emit('close')">關閉</button>
      </header>
      <div class="m-body">
        <p class="dim hint">貼上 curl 指令，Reqmira 會解析成一個新請求（method、URL、headers、body）。</p>
        <textarea
          v-model="text"
          class="curl-input mono"
          rows="10"
          spellcheck="false"
          placeholder="curl -X POST https://api.example.com/users \&#10;  -H 'Authorization: Bearer xxx' \&#10;  -H 'Content-Type: application/json' \&#10;  -d '{&quot;name&quot;:&quot;Alice&quot;}'"
        />
        <p v-if="error" class="err">⚠ {{ error }}</p>
        <div class="actions">
          <button class="primary" @click="doImport">匯入為新請求</button>
          <button @click="emit('close')">取消</button>
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
  z-index: 60;
}
.modal {
  width: min(640px, 92vw);
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
}
.hint {
  margin: 0 0 10px;
  font-size: 12.5px;
}
.curl-input {
  width: 100%;
}
.err {
  color: var(--bad);
  font-size: 12.5px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
