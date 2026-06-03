<script setup lang="ts">
// 左欄 Collection 樹（遞迴）。支援展開/收合、右鍵選單（增刪改）、拖拉請求到資料夾。
import type { CollectionNode } from "../../shared/types";
import { useSessionStore } from "../../shared/stores/session";
import { useTree } from "../../shared/treeState";
import { useContextMenu, type MenuItem } from "../../shared/contextMenu";
import { useCollectionActions } from "../../shared/collectionActions";

defineProps<{
  nodes: CollectionNode[];
  depth?: number;
}>();

const session = useSessionStore();
const tree = useTree();
const { openMenu } = useContextMenu();
const actions = useCollectionActions();

function methodClass(method?: string) {
  return method ? `m-${method.toLowerCase()}` : "";
}

function folderMenu(e: MouseEvent, node: CollectionNode) {
  const items: MenuItem[] = [
    { label: "＋ 新增請求", action: () => actions.newRequest(node.path) },
    { label: "＋ 新增子資料夾", action: () => actions.newFolder(node.path) },
    { label: "重新命名", action: () => actions.rename(node) },
    { label: "刪除", action: () => actions.remove(node), danger: true },
  ];
  openMenu(e, items);
}

function requestMenu(e: MouseEvent, node: CollectionNode) {
  const items: MenuItem[] = [
    { label: "開啟", action: () => session.openRequest(node.path) },
    { label: "重新命名", action: () => actions.rename(node) },
    { label: "刪除", action: () => actions.remove(node), danger: true },
  ];
  openMenu(e, items);
}

function onDragStart(e: DragEvent, node: CollectionNode) {
  e.dataTransfer?.setData("text/plain", node.path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

// dragenter/dragover 都必須 preventDefault 並設定 dropEffect，
// 否則游標顯示「禁止」且 drop 不會觸發。
function onDragOver(e: DragEvent, folder: CollectionNode) {
  e.preventDefault();
  e.stopPropagation(); // 避免冒泡到根層放置區
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  tree.setDragOver(folder.path);
}

function onDrop(e: DragEvent, folder: CollectionNode) {
  e.preventDefault();
  e.stopPropagation();
  tree.clearDragOver();
  const src = e.dataTransfer?.getData("text/plain");
  if (src) actions.move(src, folder.path);
}
</script>

<template>
  <ul class="tree" :class="{ root: !depth }">
    <li v-for="node in nodes" :key="node.path">
      <template v-if="node.kind === 'folder'">
        <div
          class="row folder"
          :class="{ dragover: tree.isDragOver(node.path) }"
          @click="tree.toggle(node.path)"
          @contextmenu="folderMenu($event, node)"
          @dragenter.prevent="tree.setDragOver(node.path)"
          @dragover="onDragOver($event, node)"
          @dragleave="tree.clearDragOver()"
          @drop="onDrop($event, node)"
        >
          <span class="twist" :class="{ open: !tree.isCollapsed(node.path) }">▸</span>
          <span class="ico">{{ tree.isCollapsed(node.path) ? "📁" : "📂" }}</span>
          <span class="label">{{ node.name }}</span>
        </div>
        <CollectionTree
          v-if="node.children?.length && !tree.isCollapsed(node.path)"
          :nodes="node.children"
          :depth="(depth ?? 0) + 1"
        />
      </template>
      <template v-else>
        <div
          class="row req"
          :class="{ active: session.activePath === node.path }"
          draggable="true"
          @click="session.openRequest(node.path)"
          @contextmenu="requestMenu($event, node)"
          @dragstart="onDragStart($event, node)"
        >
          <span class="method mono" :class="methodClass(node.method)">{{ node.method ?? "?" }}</span>
          <span class="label">{{ node.name }}</span>
        </div>
      </template>
    </li>
  </ul>
</template>

<style scoped>
.tree {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}
.tree.root {
  padding-left: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.row:hover {
  background: var(--bg-soft);
}
.row.active {
  background: rgba(56, 189, 248, 0.12);
  outline: 1px solid rgba(56, 189, 248, 0.3);
}
.row.dragover {
  background: rgba(95, 211, 141, 0.14);
  outline: 1px dashed var(--good);
}
.folder {
  color: var(--fg-dim);
}
.twist {
  display: inline-block;
  width: 10px;
  font-size: 10px;
  color: var(--fg-faint);
  transition: transform 0.12s;
  flex: none;
}
.twist.open {
  transform: rotate(90deg);
}
.ico {
  font-size: 12px;
}
.method {
  font-size: 10.5px;
  font-weight: 700;
  min-width: 38px;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
