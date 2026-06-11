<script setup lang="ts">
// 遞迴 JSON 樹節點。支援展開/收合、型別著色、複製欄位路徑。
import { ref, computed } from "vue";
import { copyWithToast } from "../toast";

const props = defineProps<{
  data: unknown;
  nodeKey?: string;
  path?: string;
  depth?: number;
}>();

// 預設只展開頂層，避免大型回應一次遞迴渲染全部節點。
const expanded = ref((props.depth ?? 0) < 1);

// 大陣列截斷：預設只渲染前 ARRAY_LIMIT 筆，可按鈕展開全部。
const ARRAY_LIMIT = 100;
const showAll = ref(false);

const kind = computed(() => {
  const v = props.data;
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // object | string | number | boolean
});

const isBranch = computed(() => kind.value === "object" || kind.value === "array");

const arrayLen = computed(() => (Array.isArray(props.data) ? (props.data as unknown[]).length : 0));
const truncated = computed(
  () => kind.value === "array" && !showAll.value && arrayLen.value > ARRAY_LIMIT,
);

const entries = computed<{ k: string; v: unknown; childPath: string }[]>(() => {
  const v = props.data;
  const base = props.path ?? "$";
  if (Array.isArray(v)) {
    const list = showAll.value ? v : v.slice(0, ARRAY_LIMIT);
    return list.map((item, i) => ({ k: String(i), v: item, childPath: `${base}[${i}]` }));
  }
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
      k,
      v: val,
      childPath: /^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}["${k}"]`,
    }));
  }
  return [];
});

const summary = computed(() => {
  if (kind.value === "array") return `[ ${(props.data as unknown[]).length} ]`;
  if (kind.value === "object") return `{ ${Object.keys(props.data as object).length} }`;
  return "";
});

const display = computed(() => {
  const v = props.data;
  if (kind.value === "string") return `"${v}"`;
  if (kind.value === "null") return "null";
  return String(v);
});

/** epoch timestamp 內嵌提示（IDE inlay hint 風格）：
 *  純數字 10 位（秒）或 13 位（毫秒）且換算年份合理（2001–2099）時，
 *  在值右側附上本地時間，方便一眼讀懂 timeStamp 類欄位。 */
const tsHint = computed(() => {
  if (kind.value !== "string" && kind.value !== "number") return "";
  const raw = String(props.data);
  if (!/^\d{10}$|^\d{13}$/.test(raw)) return "";
  const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
  const d = new Date(ms);
  const y = d.getFullYear();
  if (y < 2001 || y > 2099) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
});

/** tooltip：含星期與時區的完整說明。 */
const tsTitle = computed(() => {
  if (!tsHint.value) return "";
  const raw = String(props.data);
  const unit = raw.length === 10 ? "秒" : "毫秒";
  const d = new Date(raw.length === 10 ? Number(raw) * 1000 : Number(raw));
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `epoch ${unit}級時間戳 → ${tsHint.value}（週${week}，本地時區）`;
});

function copyPath() {
  if (props.path) copyWithToast(props.path, "已複製路徑");
}

function copyValue() {
  const v = props.data;
  const text =
    v !== null && typeof v === "object"
      ? JSON.stringify(v, null, 2)
      : v === null
        ? "null"
        : String(v);
  copyWithToast(text, isBranch.value ? "已複製 JSON" : "已複製值");
}
</script>

<template>
  <div class="node">
    <div class="line" :class="{ branch: isBranch }" @click="isBranch && (expanded = !expanded)">
      <span class="twist" :class="{ open: expanded, leaf: !isBranch }">{{ isBranch ? "▸" : "" }}</span>
      <span v-if="nodeKey !== undefined" class="jkey">{{ nodeKey }}</span>
      <span v-if="nodeKey !== undefined" class="colon">:</span>
      <span v-if="isBranch" class="summary">{{ summary }}</span>
      <span v-else class="jval" :class="`t-${kind}`">{{ display }}</span>
      <span v-if="tsHint" class="tshint" :title="tsTitle">⇢ {{ tsHint }}</span>
      <button class="copybtn" :title="isBranch ? '複製此節點 JSON' : '複製值'" @click.stop="copyValue">
        {{ isBranch ? "{ }" : "值" }}
      </button>
      <button v-if="path" class="copybtn" title="複製路徑" @click.stop="copyPath">⧉</button>
    </div>
    <div v-if="isBranch && expanded" class="children">
      <JsonTree
        v-for="e in entries"
        :key="e.childPath"
        :data="e.v"
        :node-key="e.k"
        :path="e.childPath"
        :depth="(depth ?? 0) + 1"
      />
      <button v-if="truncated" class="more" @click="showAll = true">
        … 顯示前 {{ ARRAY_LIMIT }} 筆，共 {{ arrayLen }} 筆 — 展開全部
      </button>
    </div>
  </div>
</template>

<style scoped>
.node {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.7;
}
.line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
  cursor: default;
  border-radius: 4px;
  padding: 0 2px;
}
.line.branch {
  cursor: pointer;
}
.line.branch:hover {
  background: rgba(56, 189, 248, 0.06);
}
.twist {
  display: inline-block;
  width: 12px;
  color: var(--fg-faint);
  transition: transform 0.12s;
}
.twist.open {
  transform: rotate(90deg);
}
.jkey {
  color: var(--accent);
}
.copybtn {
  opacity: 0;
  margin-left: 6px;
  padding: 0 5px;
  font-size: 11px;
  border: none;
  background: none;
  color: var(--fg-faint);
  border-radius: 4px;
}
.line:hover .copybtn {
  opacity: 1;
}
.copybtn:hover {
  color: var(--accent);
  background: var(--bg-soft);
}
.colon {
  color: var(--fg-faint);
}
/* timestamp 內嵌提示：IDE inlay hint 風格的淡色註記 */
.tshint {
  color: var(--fg-faint);
  font-size: 11px;
  font-style: italic;
  opacity: 0.85;
  white-space: nowrap;
}
.summary {
  color: var(--fg-faint);
}
.children {
  padding-left: 16px;
  border-left: 1px dashed var(--border);
  margin-left: 5px;
}
.more {
  margin: 4px 0;
  font-size: 11.5px;
  color: var(--accent);
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 2px 10px;
}
.t-string {
  color: var(--good);
}
.t-number {
  color: var(--accent-2);
}
.t-boolean {
  color: var(--accent-3);
}
.t-null {
  color: var(--bad);
}
</style>
