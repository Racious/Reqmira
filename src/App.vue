<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";
import { useWorkspaceStore } from "./shared/stores/workspace";
import { useSessionStore } from "./shared/stores/session";
import { useHistoryStore, type HistoryEntry } from "./shared/stores/history";
import { useFlowRunnerStore } from "./shared/stores/flowRunner";
import { useToast } from "./shared/toast";
import CollectionTree from "./features/collections/CollectionTree.vue";
import RequestEditor from "./features/requests/RequestEditor.vue";
import ResponseViewer from "./features/response-viewer/ResponseViewer.vue";
import RequestInspector from "./features/inspector/RequestInspector.vue";
import FlowRunner from "./features/runner/FlowRunner.vue";
import ImportCurl from "./features/requests/ImportCurl.vue";
import DialogHost from "./shared/components/DialogHost.vue";
import ContextMenuHost from "./shared/components/ContextMenuHost.vue";
import { useContextMenu, type MenuItem } from "./shared/contextMenu";
import { useCollectionActions } from "./shared/collectionActions";
import { useTree } from "./shared/treeState";

const ws = useWorkspaceStore();
const session = useSessionStore();
const history = useHistoryStore();
const flowRunner = useFlowRunnerStore();
const toast = useToast();
const { openMenu } = useContextMenu();
const actions = useCollectionActions();
const tree = useTree();

const showCurl = ref(false);

// 根層（collections）放置區：拖到 Collections 空白處即移到最外層。
function onRootDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  tree.setDragOver("collections");
}
function onRootDrop(e: DragEvent) {
  e.preventDefault();
  tree.clearDragOver();
  const src = e.dataTransfer?.getData("text/plain");
  if (src) actions.move(src, "collections");
}

// 側欄根層「＋」：新增請求 / 資料夾（置於 collections 根）。
function rootAddMenu(e: MouseEvent) {
  const items: MenuItem[] = [
    { label: "＋ 新增請求", action: () => actions.newRequest("collections") },
    { label: "＋ 新增資料夾", action: () => actions.newFolder("collections") },
  ];
  openMenu(e, items);
}

// 全域快捷鍵：Ctrl/Cmd+Enter 送出、Ctrl/Cmd+S 儲存。
function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === "Enter") {
    if (session.draft && session.draft.url.trim() && !session.sending) {
      e.preventDefault();
      session.send();
    }
  } else if (e.key.toLowerCase() === "s") {
    // 僅對已有路徑者直接存；新請求請用編輯器的「儲存」走另存流程。
    if (session.draft && session.activePath) {
      e.preventDefault();
      session.save();
    }
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 「基準」開關：已是基準→取消；否則設為基準（自動切換掉前一筆）。
function toggleBase(h: HistoryEntry) {
  if (session.compareBase?.sourceId === h.id) {
    session.setCompareBase(null);
  } else {
    session.setCompareBase(h.response, `${h.name} · ${h.response.status} · ${fmtTime(h.sentAt)}`, h.id);
  }
}

const workspaceName = computed(() => {
  if (!ws.root) return "未開啟工作區";
  return ws.root.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? ws.root;
});

onMounted(() => {
  if (ws.hasWorkspace) ws.refresh();
});
</script>

<template>
  <div class="shell">
    <!-- 頂列 -->
    <header class="topbar">
      <div class="brand">
        <span class="logo">RL</span>
        <span class="bname">Reqmira</span>
      </div>
      <button class="ws-btn" :title="ws.root" @click="ws.pickWorkspace()">
        📂 {{ workspaceName }}
      </button>
      <button v-if="ws.hasWorkspace" class="icon" title="重新整理" @click="ws.refresh()">⟳</button>

      <div class="spacer" />

      <label class="envsel" v-if="ws.environments.length">
        <span class="dim">環境</span>
        <select :value="ws.activeEnvName" @change="ws.setActiveEnv(($event.target as HTMLSelectElement).value)">
          <option v-for="e in ws.environments" :key="e.name" :value="e.name">{{ e.name }}</option>
        </select>
      </label>
      <button @click="showCurl = true">⤓ 匯入 curl</button>
      <button class="primary" @click="session.newRequest()">＋ 新請求</button>
    </header>

    <!-- 未初始化提示 -->
    <div v-if="ws.pendingInit" class="initbar">
      <span>「{{ ws.pendingInit }}」尚未初始化為工作區。要在其下建立 <code>reqmira/</code> 工作區嗎？</span>
      <div class="init-actions">
        <button class="primary" @click="ws.confirmInit()">建立</button>
        <button @click="ws.cancelInit()">取消</button>
      </div>
    </div>

    <!-- 三欄主體 -->
    <div class="body">
      <!-- 左：Collection Tree -->
      <nav class="sidebar">
        <div class="side-head">
          <span class="dim">Collections</span>
          <button v-if="ws.hasWorkspace" class="addbtn" title="新增請求 / 資料夾" @click="rootAddMenu($event)">＋</button>
        </div>
        <div
          v-if="ws.hasWorkspace"
          class="col-droproot"
          :class="{ dragover: tree.isDragOver('collections') }"
          @dragenter.prevent="tree.setDragOver('collections')"
          @dragover="onRootDragOver($event)"
          @dragleave="tree.clearDragOver()"
          @drop="onRootDrop($event)"
        >
          <CollectionTree v-if="ws.collections.length" :nodes="ws.collections" />
          <p v-else class="faint hint">此工作區尚無 collection（可拖入或按 ＋ 新增）。</p>
        </div>
        <p v-else class="faint hint">請先開啟一個工作區資料夾。</p>
        <p v-if="ws.error" class="err">⚠ {{ ws.error }}</p>

        <!-- Flows -->
        <div v-if="ws.flows.length" class="side-head hist-head">
          <span class="dim">Flows</span>
        </div>
        <ul v-if="ws.flows.length" class="histlist">
          <li v-for="f in ws.flows" :key="f.path" class="hrow" @click="flowRunner.open(f.path)">
            <span class="fico">⇄</span>
            <span class="hname">{{ f.name }}</span>
            <span class="htime faint">{{ f.steps }} 步</span>
          </li>
        </ul>

        <!-- History -->
        <div class="side-head hist-head">
          <span class="dim">History</span>
          <button v-if="history.entries.length" class="clr" title="清除歷史" @click="history.clear()">清除</button>
        </div>
        <ul v-if="history.entries.length" class="histlist">
          <li
            v-for="h in history.entries"
            :key="h.id"
            class="hrow"
            :class="{ viewing: session.currentEntryId === h.id }"
            @click="session.showResponse(h.response, h.id)"
          >
            <span class="hmethod mono" :class="`m-${h.method.toLowerCase()}`">{{ h.method }}</span>
            <span
              class="hstat mono"
              :class="h.response.status >= 200 && h.response.status < 300 ? 'ok' : 'bad'"
              >{{ h.response.status }}</span
            >
            <span class="hname">{{ h.name }}</span>
            <span class="htime faint">{{ fmtTime(h.sentAt) }}</span>
            <button
              class="hbase"
              :class="{ on: session.compareBase?.sourceId === h.id }"
              :title="session.compareBase?.sourceId === h.id ? '取消基準' : '設為 Diff 基準'"
              @click.stop="toggleBase(h)"
            >
              基準
            </button>
          </li>
        </ul>
        <p v-else class="faint hint">尚無送出紀錄。</p>
      </nav>

      <!-- 中：Editor + Response -->
      <main class="center">
        <div class="editor-pane">
          <RequestEditor />
        </div>
        <div class="resp-pane">
          <ResponseViewer />
        </div>
      </main>

      <!-- 右：Inspector -->
      <RequestInspector class="inspector-col" />
    </div>

    <!-- Flow Runner 模態 -->
    <FlowRunner />

    <!-- 匯入 curl 模態 -->
    <ImportCurl v-if="showCurl" @close="showCurl = false" />

    <!-- 全域 toast 反饋 -->
    <Transition name="toast">
      <div v-if="toast.message" class="toast">{{ toast.message }}</div>
    </Transition>

    <!-- 對話框與右鍵選單 host -->
    <DialogHost />
    <ContextMenuHost />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(8, 17, 31, 0.85);
  backdrop-filter: blur(10px);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-3));
  color: #06111f;
  font-weight: 900;
  font-size: 12px;
}
.bname {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ws-btn {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon {
  padding: 6px 10px;
}
.spacer {
  flex: 1;
}
.envsel {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.initbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(56, 189, 248, 0.08);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--fg-dim);
}
.init-actions {
  display: flex;
  gap: 8px;
  flex: none;
}
.body {
  flex: 1;
  display: grid;
  grid-template-columns: 270px 1fr 330px;
  min-height: 0;
}
.sidebar {
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px 10px;
}
.side-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  padding: 0 4px;
}
.addbtn {
  font-size: 13px;
  line-height: 1;
  padding: 1px 8px;
  border-radius: 6px;
}
.hint {
  font-size: 12px;
  padding: 8px 4px;
}
.col-droproot {
  min-height: 60px;
  border-radius: 8px;
  transition: 0.12s;
}
.col-droproot.dragover {
  background: rgba(95, 211, 141, 0.1);
  outline: 1px dashed var(--good);
}
.hist-head {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  align-items: center;
}
.clr {
  font-size: 10.5px;
  padding: 1px 8px;
}
.histlist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.hrow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.hrow:hover {
  background: var(--bg-soft);
}
/* 目前正在檢視的那筆：藍色外框常駐，讓「在看哪筆」一目了然 */
.hrow.viewing {
  background: rgba(56, 189, 248, 0.08);
  outline: 1px solid rgba(56, 189, 248, 0.45);
}
.hmethod {
  font-size: 9.5px;
  font-weight: 700;
  min-width: 30px;
}
.fico {
  color: var(--accent-3);
  font-size: 13px;
}
.hstat {
  font-size: 10.5px;
}
.hstat.ok {
  color: var(--good);
}
.hstat.bad {
  color: var(--bad);
}
.hname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.htime {
  font-size: 10.5px;
}
.hbase {
  font-size: 9.5px;
  padding: 1px 6px;
  opacity: 0;
  flex: none;
}
.hrow:hover .hbase {
  opacity: 1;
}
/* 已選為基準：常駐顯示且高亮，點一下可取消 */
.hbase.on {
  opacity: 1;
  color: #06111f;
  background: var(--accent-2);
  border-color: var(--accent-2);
  font-weight: 700;
}
.err {
  color: var(--bad);
  font-size: 12px;
  padding: 0 4px;
}
.center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.editor-pane {
  flex: 1 1 55%;
  min-height: 0;
  border-bottom: 1px solid var(--border);
}
.resp-pane {
  flex: 1 1 45%;
  min-height: 0;
}
.inspector-col {
  min-width: 0;
}

/* 全域 toast */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--panel-2);
  border: 1px solid var(--accent);
  color: var(--fg);
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 100;
  pointer-events: none;
}
.toast::before {
  content: "✓ ";
  color: var(--good);
  font-weight: 700;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
