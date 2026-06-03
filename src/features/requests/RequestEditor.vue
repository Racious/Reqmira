<script setup lang="ts">
import { ref, computed } from "vue";
import { useSessionStore } from "../../shared/stores/session";
import { useWorkspaceStore } from "../../shared/stores/workspace";
import KeyValueEditor from "../../shared/components/KeyValueEditor.vue";
import type { BodyType } from "../../shared/types";

const session = useSessionStore();
const ws = useWorkspaceStore();

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODY_TYPES: BodyType[] = ["none", "json", "text", "form"];

type Tab = "query" | "headers" | "body";
const tab = ref<Tab>("query");

const showSaveAs = ref(false);
const savePath = ref("");

const canSend = computed(() => !!session.draft && !!session.draft.url.trim() && !session.sending);

async function onSave() {
  if (!session.draft) return;
  if (session.activePath) {
    await session.save();
    return;
  }
  // 新請求 → 詢問儲存路徑
  savePath.value = `collections/${session.draft.id || "request"}.api.yaml`;
  showSaveAs.value = true;
}

async function confirmSaveAs() {
  const ok = await session.save(savePath.value.trim());
  if (ok) showSaveAs.value = false;
}

const formatError = ref("");
function formatBody() {
  if (!session.draft) return;
  formatError.value = "";
  try {
    session.draft.bodyContent = JSON.stringify(JSON.parse(session.draft.bodyContent), null, 2);
  } catch {
    formatError.value = "JSON 格式有誤，無法美化";
  }
}
</script>

<template>
  <section v-if="session.draft" class="editor">
    <!-- URL 列 -->
    <div class="urlbar">
      <select v-model="session.draft.method" class="method-sel" :class="`m-${session.draft.method.toLowerCase()}`">
        <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        v-model="session.draft.url"
        class="url-input mono"
        placeholder="{{baseUrl}}/api/..."
        spellcheck="false"
        @keyup.enter="canSend && session.send()"
      />
      <button class="primary" :disabled="!canSend" @click="session.send()">
        {{ session.sending ? "送出中…" : "送出" }}
      </button>
      <button :disabled="!session.draft" @click="onSave">儲存</button>
    </div>

    <div class="namerow">
      <input v-model="session.draft.name" class="name-input" placeholder="請求名稱" />
      <input v-model="session.draft.id" class="id-input mono" placeholder="id" />
      <span v-if="session.dirty" class="dirty-chip" title="有未儲存的變更">● 未儲存</span>
      <span v-if="ws.activeEnvName" class="env-chip">env: {{ ws.activeEnvName }}</span>
    </div>

    <!-- Save As 內嵌列 -->
    <div v-if="showSaveAs" class="saveas">
      <span class="dim">儲存為：</span>
      <input v-model="savePath" class="mono" />
      <button class="primary" @click="confirmSaveAs">確認</button>
      <button @click="showSaveAs = false">取消</button>
    </div>

    <!-- 分頁 -->
    <div class="tabs">
      <button class="tab" :class="{ on: tab === 'query' }" @click="tab = 'query'">
        Query <span v-if="session.draft.query.length" class="cnt">{{ session.draft.query.length }}</span>
      </button>
      <button class="tab" :class="{ on: tab === 'headers' }" @click="tab = 'headers'">
        Headers <span v-if="session.draft.headers.length" class="cnt">{{ session.draft.headers.length }}</span>
      </button>
      <button class="tab" :class="{ on: tab === 'body' }" @click="tab = 'body'">
        Body <span v-if="session.draft.bodyType !== 'none'" class="dot" />
      </button>
    </div>

    <div class="tab-body">
      <KeyValueEditor
        v-if="tab === 'query'"
        v-model="session.draft.query"
        key-placeholder="參數名"
        value-placeholder="值"
      />
      <KeyValueEditor
        v-else-if="tab === 'headers'"
        v-model="session.draft.headers"
        key-placeholder="Header"
        value-placeholder="值"
      />
      <div v-else class="bodypane">
        <div class="bodytype">
          <label v-for="bt in BODY_TYPES" :key="bt" class="bt">
            <input type="radio" :value="bt" v-model="session.draft.bodyType" />{{ bt }}
          </label>
          <button v-if="session.draft.bodyType === 'json'" class="fmt-btn" @click="formatBody">格式化</button>
          <span v-if="formatError" class="fmt-err">{{ formatError }}</span>
        </div>
        <textarea
          v-if="session.draft.bodyType !== 'none'"
          v-model="session.draft.bodyContent"
          class="body-text"
          rows="12"
          spellcheck="false"
          :placeholder="session.draft.bodyType === 'json' ? '{\n  &quot;key&quot;: &quot;value&quot;\n}' : ''"
        />
        <p v-else class="dim empty">此請求無 Body。</p>
      </div>
    </div>

    <p v-if="session.sendError" class="err">⚠ {{ session.sendError }}</p>
    <p v-if="session.saveError" class="err">⚠ {{ session.saveError }}</p>
  </section>

  <section v-else class="empty-state">
    <p class="dim">從左側選擇一個請求，或建立新請求。</p>
    <button class="primary" @click="session.newRequest()">＋ 新請求</button>
  </section>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px 18px;
  gap: 10px;
  overflow: hidden;
}
.urlbar {
  display: flex;
  gap: 8px;
}
.method-sel {
  font-weight: 700;
  font-family: var(--mono);
  min-width: 96px;
}
.url-input {
  flex: 1;
}
.namerow {
  display: flex;
  gap: 8px;
  align-items: center;
}
.name-input {
  flex: 1;
}
.id-input {
  width: 180px;
  color: var(--fg-dim);
}
.env-chip {
  font-size: 11.5px;
  color: var(--accent-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
  white-space: nowrap;
}
.dirty-chip {
  font-size: 11.5px;
  color: var(--warn);
  white-space: nowrap;
}
.fmt-btn {
  font-size: 11px;
  padding: 2px 10px;
  margin-left: 8px;
}
.fmt-err {
  font-size: 11.5px;
  color: var(--bad);
  margin-left: 6px;
}
.saveas {
  display: flex;
  gap: 8px;
  align-items: center;
  background: var(--bg-soft);
  padding: 8px 10px;
  border-radius: 8px;
}
.saveas input {
  flex: 1;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--fg-dim);
  padding: 6px 14px;
}
.tab.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.tab:hover {
  color: var(--fg);
}
.cnt {
  font-size: 10.5px;
  background: var(--border);
  border-radius: 999px;
  padding: 0 6px;
  margin-left: 3px;
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: 4px;
}
.tab-body {
  flex: 1;
  overflow-y: auto;
  padding-top: 6px;
}
.bodytype {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
}
.bt {
  font-size: 12.5px;
  color: var(--fg-dim);
  display: flex;
  align-items: center;
  gap: 4px;
}
.body-text {
  width: 100%;
}
.empty {
  padding: 12px 0;
}
.err {
  color: var(--bad);
  font-size: 12.5px;
  margin: 0;
}
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
</style>
