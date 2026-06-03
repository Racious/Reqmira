<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useSessionStore } from "../../shared/stores/session";
import JsonTree from "../../shared/components/JsonTree.vue";
import SchemaTree from "../../shared/components/SchemaTree.vue";
import CodeGenPanel from "../../shared/components/CodeGenPanel.vue";
import { inferValue } from "../../shared/analyze";
import { diffJson } from "../../shared/api";
import type { DiffEntry, DiffKind } from "../../shared/types";

const session = useSessionStore();

type Tab = "pretty" | "schema" | "codegen" | "diff" | "raw" | "headers";
const tab = ref<Tab>("pretty");

// ── Diff ──
const diffEntries = ref<DiffEntry[]>([]);
const diffLoading = ref(false);
const diffError = ref("");

const diffCounts = computed(() => {
  const c = { added: 0, removed: 0, changed: 0 };
  for (const e of diffEntries.value) c[e.kind]++;
  return c;
});

async function runDiff() {
  diffError.value = "";
  diffEntries.value = [];
  const base = session.compareBase;
  const cur = session.response;
  if (!base || !cur) return;
  diffLoading.value = true;
  try {
    diffEntries.value = await diffJson(base.response.body, cur.body);
  } catch (e) {
    diffError.value = String(e);
  } finally {
    diffLoading.value = false;
  }
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 把目前回應設為比較基準，附帶可讀標籤。 */
function setAsBase() {
  const r = session.response;
  if (!r) return;
  const name = session.draft?.name || "回應";
  // 關聯目前回應對應的 History 紀錄，使 History 那筆常駐高亮。
  session.setCompareBase(
    r,
    `${name} · ${r.status} · ${fmtClock(Date.now())}`,
    session.currentEntryId || undefined,
  );
}

/** 基準與目前是否為同一筆（或內容完全相同）。 */
const comparingSame = computed(
  () => !!session.compareBase && session.compareBase.response.body === (session.response?.body ?? ""),
);

/** Diff 分頁「目前」這側的標籤。 */
const currentLabel = computed(() => {
  const r = session.response;
  if (!r) return "";
  const name = session.draft?.name || "回應";
  return `${name} · ${r.status}`;
});

function diffSymbol(k: DiffKind) {
  return k === "added" ? "＋" : k === "removed" ? "－" : "~";
}

watch(
  () => [tab.value, session.response, session.compareBase],
  () => {
    if (tab.value === "diff") runDiff();
  },
);

// 超過此大小的回應，預設先以 Raw 呈現，避免一進來就遞迴渲染巨大 JSON 樹。
const LARGE_BYTES = 400_000;

// 只解析一次：Pretty 與 Schema 共用同一份結果。
const parsed = computed<{ ok: boolean; value: unknown }>(() => {
  const body = session.response?.body ?? "";
  if (!body.trim()) return { ok: false, value: null };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, value: null };
  }
});

const isLarge = computed(() => (session.response?.body.length ?? 0) > LARGE_BYTES);

// Schema 直接由已解析的值推測，不再重複 JSON.parse。
const respSchema = computed(() => (parsed.value.ok ? inferValue(parsed.value.value) : null));

// 大回應預設切 Raw（避免遞迴渲染巨大樹）；否則保留目前分頁，
// 不強制切回 Pretty——以免把正在看 Diff 的老爺踢走。
watch(
  () => session.response,
  (r) => {
    if (r && r.body.length > LARGE_BYTES && tab.value !== "raw" && tab.value !== "headers") {
      tab.value = "raw";
    }
  },
);

const statusClass = computed(() => {
  const s = session.response?.status ?? 0;
  if (s >= 200 && s < 300) return "good";
  if (s >= 300 && s < 400) return "warn";
  if (s >= 400) return "bad";
  return "";
});

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<template>
  <section class="resp">
    <div class="resp-head">
      <span class="title">回應</span>
      <template v-if="session.response">
        <span class="stat" :class="statusClass">
          {{ session.response.status }} {{ session.response.statusText }}
        </span>
        <span class="meta">⏱ {{ session.response.durationMs }} ms</span>
        <span class="meta">⬇ {{ fmtSize(session.response.sizeBytes) }}</span>
        <span v-if="session.response.contentType" class="meta mono ct">{{ session.response.contentType }}</span>
        <button class="basebtn" title="將此回應設為 Diff 比較基準" @click="setAsBase">
          設為基準
        </button>
        <span v-if="session.compareBase" class="baseind" :title="session.compareBase.label">
          基準：{{ session.compareBase.label }}
        </span>
        <button v-if="session.compareBase" class="clrbase" title="清除基準" @click="session.setCompareBase(null)">
          ✕
        </button>
      </template>
      <span v-else-if="session.sending" class="meta">送出中…</span>
      <span v-else class="meta faint">尚未送出</span>

      <div class="spacer" />
      <div v-if="session.response" class="tabs">
        <button class="tab" :class="{ on: tab === 'pretty' }" @click="tab = 'pretty'">Pretty</button>
        <button v-if="respSchema" class="tab" :class="{ on: tab === 'schema' }" @click="tab = 'schema'">Schema</button>
        <button class="tab" :class="{ on: tab === 'codegen' }" @click="tab = 'codegen'">Codegen</button>
        <button class="tab" :class="{ on: tab === 'diff' }" @click="tab = 'diff'; runDiff()">Diff</button>
        <button class="tab" :class="{ on: tab === 'raw' }" @click="tab = 'raw'">Raw</button>
        <button class="tab" :class="{ on: tab === 'headers' }" @click="tab = 'headers'">
          Headers <span class="cnt">{{ session.response.headers.length }}</span>
        </button>
      </div>
    </div>

    <div v-if="session.response && isLarge && tab !== 'raw'" class="largehint">
      回應較大（{{ fmtSize(session.response.sizeBytes) }}），樹狀檢視可能較慢。建議用
      <button class="linkbtn" @click="tab = 'raw'">Raw</button> 檢視。
    </div>

    <div v-if="session.response" class="resp-body">
      <template v-if="tab === 'pretty'">
        <JsonTree v-if="parsed.ok" :data="parsed.value" :depth="0" />
        <pre v-else class="raw">{{ session.response.body }}</pre>
      </template>
      <div v-else-if="tab === 'schema'" class="schema">
        <SchemaTree v-if="respSchema" :node="respSchema" :depth="0" :show-required="false" />
      </div>
      <CodeGenPanel v-else-if="tab === 'codegen'" :node="respSchema" />
      <div v-else-if="tab === 'diff'" class="diff">
        <p v-if="!session.compareBase" class="faint">
          尚未設定比較基準。請在某筆回應（或歷史紀錄）按「設為基準」，再送出 / 檢視另一筆回應即可比對。
        </p>
        <template v-else>
          <div class="diff-head">
            <span class="dim">基準</span> <b class="bl">{{ session.compareBase.label }}</b>
            <span class="arrow">→</span>
            <span class="dim">目前</span> <b class="cl">{{ currentLabel }}</b>
          </div>
          <div class="diff-sum">
            <span class="da">＋{{ diffCounts.added }} 新增</span>
            <span class="dr">－{{ diffCounts.removed }} 刪除</span>
            <span class="dc">~{{ diffCounts.changed }} 變更</span>
          </div>
          <p v-if="diffLoading" class="faint">比對中…</p>
          <p v-else-if="diffError" class="err">⚠ {{ diffError }}</p>
          <p v-else-if="comparingSame" class="warnmsg">
            基準與目前為同一筆（或內容完全相同）。請從 History 選另一筆、或重新送出後再比對。
          </p>
          <p v-else-if="!diffEntries.length" class="faint">兩者結構相同，無差異。</p>
          <table v-else class="difftab">
            <tbody>
              <tr v-for="(e, i) in diffEntries" :key="i" :class="e.kind">
                <td class="dk">{{ diffSymbol(e.kind) }}</td>
                <td class="dp mono">{{ e.path }}</td>
                <td class="dvs mono">
                  <span v-if="e.left != null" class="old">{{ e.left }}</span>
                  <span v-if="e.kind === 'changed'" class="arrow">→</span>
                  <span v-if="e.right != null" class="new">{{ e.right }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
      <pre v-else-if="tab === 'raw'" class="raw">{{ session.response.body }}</pre>
      <table v-else class="hdr">
        <tbody>
          <tr v-for="([k, v], i) in session.response.headers" :key="i">
            <td class="hk mono">{{ k }}</td>
            <td class="hv mono">{{ v }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="resp-body placeholder">
      <span class="faint">送出請求後，回應將顯示於此。</span>
    </div>
  </section>
</template>

<style scoped>
.resp {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.resp-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  font-size: 13px;
}
.title {
  font-weight: 600;
  color: var(--fg-dim);
}
.stat {
  font-weight: 700;
  font-family: var(--mono);
}
.stat.good {
  color: var(--good);
}
.stat.warn {
  color: var(--warn);
}
.stat.bad {
  color: var(--bad);
}
.meta {
  color: var(--fg-dim);
  font-size: 12.5px;
}
.ct {
  font-size: 11.5px;
}
.spacer {
  flex: 1;
}
.tabs {
  display: flex;
  gap: 2px;
}
.tab {
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--fg-dim);
  padding: 3px 10px;
  font-size: 12px;
}
.tab.on {
  color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
}
.cnt {
  font-size: 10px;
  opacity: 0.7;
}
.resp-body {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.raw {
  margin: 0;
  font-family: var(--mono);
  font-size: 12.5px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #cdd6e6;
}
.schema {
  font-size: 12.5px;
}
.basebtn {
  font-size: 11px;
  padding: 2px 9px;
}
.baseind {
  font-size: 11px;
  color: var(--accent-2);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clrbase {
  font-size: 10px;
  padding: 1px 6px;
}
.diff-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.diff-head .bl {
  color: var(--accent-2);
}
.diff-head .cl {
  color: var(--accent);
}
.diff-head .arrow {
  color: var(--fg-faint);
}
.warnmsg {
  font-size: 12.5px;
  color: var(--warn);
}
.diff-sum {
  display: flex;
  gap: 14px;
  font-size: 12.5px;
  margin-bottom: 10px;
}
.diff-sum .da {
  color: var(--good);
}
.diff-sum .dr {
  color: var(--bad);
}
.diff-sum .dc {
  color: var(--warn);
}
.difftab {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.difftab td {
  padding: 3px 8px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.difftab tr.added .dk {
  color: var(--good);
}
.difftab tr.removed .dk {
  color: var(--bad);
}
.difftab tr.changed .dk {
  color: var(--warn);
}
.dk {
  width: 18px;
  text-align: center;
  font-weight: 700;
}
.dp {
  color: var(--accent);
  word-break: break-all;
  width: 40%;
}
.dvs {
  word-break: break-all;
}
.dvs .old {
  color: var(--bad);
}
.dvs .new {
  color: var(--good);
}
.dvs .arrow {
  color: var(--fg-faint);
  margin: 0 6px;
}
.largehint {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--warn);
  background: rgba(224, 177, 90, 0.08);
  border-bottom: 1px solid var(--border);
}
.linkbtn {
  background: none;
  border: none;
  color: var(--accent);
  padding: 0 2px;
  text-decoration: underline;
}
.hdr {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.hdr td {
  border-bottom: 1px solid var(--border);
  padding: 4px 8px;
  vertical-align: top;
}
.hk {
  color: var(--accent);
  width: 240px;
  word-break: break-all;
}
.hv {
  color: var(--fg-dim);
  word-break: break-all;
}
</style>
