<script setup lang="ts">
// 命令面板（Ctrl+K）：模糊搜尋並跳請求／flow／切環境／執行動作。
import { ref, computed, onMounted, nextTick } from "vue";
import { useWorkspaceStore } from "../../shared/stores/workspace";
import { useSessionStore } from "../../shared/stores/session";
import { useFlowRunnerStore } from "../../shared/stores/flowRunner";
import { useSettingsStore } from "../../shared/stores/settings";
import type { CollectionNode } from "../../shared/types";

const emit = defineEmits<{ (e: "close"): void }>();

const ws = useWorkspaceStore();
const session = useSessionStore();
const flowRunner = useFlowRunnerStore();
const settings = useSettingsStore();

interface Cmd {
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

function flattenRequests(nodes: CollectionNode[], acc: CollectionNode[] = []): CollectionNode[] {
  for (const n of nodes) {
    if (n.kind === "request") acc.push(n);
    else if (n.children) flattenRequests(n.children, acc);
  }
  return acc;
}

const commands = computed<Cmd[]>(() => {
  const list: Cmd[] = [];
  // 請求
  for (const r of flattenRequests(ws.collections)) {
    list.push({
      label: r.name,
      hint: `${r.method ?? ""} · ${r.path}`,
      group: "請求",
      run: () => session.openRequest(r.path),
    });
  }
  // Flows
  for (const f of ws.flows) {
    list.push({ label: f.name, hint: `${f.steps} 步`, group: "Flow", run: () => flowRunner.open(f.path) });
  }
  // 切環境
  for (const e of ws.environments) {
    list.push({ label: `切換環境：${e.name}`, group: "環境", run: () => ws.setActiveEnv(e.name) });
  }
  // 動作
  list.push(
    { label: "新請求", group: "動作", run: () => session.newRequest() },
    {
      label: "送出目前請求",
      group: "動作",
      run: () => {
        if (session.draft?.url.trim()) session.send();
      },
    },
    { label: "切換佈局（上下／左右）", group: "動作", run: () => settings.toggleCenterLayout() },
  );
  return list;
});

const query = ref("");
const selected = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);

/** 子序列模糊比對：query 的字元需依序出現在 text 中。 */
function fuzzy(text: string, q: string): boolean {
  if (!q) return true;
  const t = text.toLowerCase();
  const s = q.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === s[i]) i++;
    if (i === s.length) return true;
  }
  return i === s.length;
}

const filtered = computed(() => {
  const q = query.value.trim();
  const items = commands.value.filter((c) => fuzzy(c.label + " " + (c.hint ?? ""), q));
  return items.slice(0, 50);
});

function move(d: number) {
  const n = filtered.value.length;
  if (!n) return;
  selected.value = (selected.value + d + n) % n;
}
function exec(i = selected.value) {
  const c = filtered.value[i];
  if (c) {
    c.run();
    emit("close");
  }
}

onMounted(async () => {
  await nextTick();
  inputEl.value?.focus();
});
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="palette">
      <input
        ref="inputEl"
        v-model="query"
        class="p-input"
        placeholder="跳請求、切環境、執行動作…"
        spellcheck="false"
        @input="selected = 0"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="exec()"
        @keydown.esc.prevent="emit('close')"
      />
      <ul class="p-list">
        <li
          v-for="(c, i) in filtered"
          :key="i"
          class="p-item"
          :class="{ on: i === selected }"
          @mouseenter="selected = i"
          @click="exec(i)"
        >
          <span class="p-group">{{ c.group }}</span>
          <span class="p-label">{{ c.label }}</span>
          <span v-if="c.hint" class="p-hint mono">{{ c.hint }}</span>
        </li>
        <li v-if="!filtered.length" class="p-empty dim">無相符項目</li>
      </ul>
      <div class="p-foot dim">↑↓ 選擇 · Enter 執行 · Esc 關閉</div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 9, 18, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  z-index: 95;
}
.palette {
  width: min(560px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}
.p-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  padding: 12px 16px;
  font-size: 14px;
  background: var(--code-bg);
}
.p-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 50vh;
  overflow-y: auto;
}
.p-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.p-item.on {
  background: rgba(56, 189, 248, 0.12);
}
.p-group {
  font-size: 10.5px;
  color: var(--fg-faint);
  min-width: 36px;
}
.p-label {
  flex: 1;
  font-size: 13px;
}
.p-hint {
  font-size: 11px;
  color: var(--fg-faint);
}
.p-empty {
  padding: 12px;
  font-size: 13px;
}
.p-foot {
  border-top: 1px solid var(--border);
  padding: 6px 12px;
  font-size: 11px;
}
</style>
