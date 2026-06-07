<script setup lang="ts">
// 環境編輯器：在程式內切換／修改／新增變數、新增／刪除環境，免開檔。
import { ref, computed, onMounted } from "vue";
import { useWorkspaceStore } from "../../shared/stores/workspace";
import { useDialog } from "../../shared/dialog";
import { useToast } from "../../shared/toast";
import KeyValueEditor from "../../shared/components/KeyValueEditor.vue";
import type { KeyValue } from "../../shared/types";

const emit = defineEmits<{ (e: "close"): void }>();

const ws = useWorkspaceStore();
const { prompt, confirm } = useDialog();
const { show } = useToast();

interface EnvDraft {
  name: string;
  vars: KeyValue[];
}

const drafts = ref<EnvDraft[]>([]);
const selected = ref<string>("");

onMounted(() => {
  drafts.value = ws.environments.map((e) => ({
    name: e.name,
    vars: Object.entries(e.variables ?? {}).map(([key, value]) => ({ key, value, enabled: true })),
  }));
  selected.value = drafts.value[0]?.name ?? "";
});

const current = computed(() => drafts.value.find((d) => d.name === selected.value) ?? null);

function varsToRecord(vars: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of vars) if (kv.key.trim()) out[kv.key] = kv.value;
  return out;
}

async function addEnv() {
  const name = await prompt("新增環境名稱", "new-env");
  if (name === null || !name.trim()) return;
  if (drafts.value.some((d) => d.name === name)) {
    show("環境已存在");
    selected.value = name;
    return;
  }
  // 立即建立空環境（持久化），再選取編輯
  await ws.saveEnvironment({ name, variables: {} });
  drafts.value.push({ name, vars: [] });
  selected.value = name;
  show(`已新增環境 ${name}`);
}

async function saveCurrent() {
  const d = current.value;
  if (!d) return;
  await ws.saveEnvironment({ name: d.name, variables: varsToRecord(d.vars) });
  show(`已儲存環境 ${d.name}`);
}

async function removeEnv(name: string) {
  const ok = await confirm(`刪除環境「${name}」？此動作無法復原。`);
  if (!ok) return;
  await ws.deleteEnvironment(name);
  drafts.value = drafts.value.filter((d) => d.name !== name);
  if (selected.value === name) selected.value = drafts.value[0]?.name ?? "";
  show(`已刪除環境 ${name}`);
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>環境變數</h3>
        <button @click="emit('close')">關閉</button>
      </header>
      <div class="m-body">
        <!-- 左：環境清單 -->
        <div class="env-list">
          <button
            v-for="d in drafts"
            :key="d.name"
            class="env-item"
            :class="{ on: d.name === selected }"
            @click="selected = d.name"
          >
            {{ d.name }}
          </button>
          <button class="env-add" @click="addEnv">＋ 新增環境</button>
        </div>

        <!-- 右：變數編輯 -->
        <div v-if="current" class="env-edit">
          <div class="env-edit-head">
            <span class="ename mono">{{ current.name }}</span>
            <div class="spacer" />
            <button class="primary" @click="saveCurrent">儲存</button>
            <button class="danger" @click="removeEnv(current.name)">刪除環境</button>
          </div>
          <KeyValueEditor v-model="current.vars" key-placeholder="變數名" value-placeholder="值" />
          <p class="dim hint">機密值（token／密碼）建議留空、由使用時填入；勿提交至 Git。</p>
        </div>
        <div v-else class="env-empty dim">尚無環境，點「＋ 新增環境」建立。</div>
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
  width: min(720px, 92vw);
  max-height: 84vh;
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
  display: grid;
  grid-template-columns: 180px 1fr;
  min-height: 0;
  overflow: hidden;
}
.env-list {
  border-right: 1px solid var(--border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
.env-item {
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 13px;
}
.env-item.on {
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(56, 189, 248, 0.3);
  color: var(--accent);
}
.env-add {
  margin-top: 6px;
  font-size: 12px;
}
.env-edit {
  padding: 14px 18px;
  overflow-y: auto;
}
.env-edit-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.ename {
  font-size: 14px;
  color: var(--accent-2);
}
.spacer {
  flex: 1;
}
button.danger {
  background: var(--bad);
  border: none;
  color: #1a0608;
  font-weight: 600;
}
.hint {
  font-size: 11.5px;
  margin-top: 10px;
}
.env-empty {
  padding: 24px;
}
</style>
