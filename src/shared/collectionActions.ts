// Collection 樹的增刪改／移動操作，集中於此供（遞迴的）CollectionTree 與側欄共用。
import * as api from "./api";
import { useWorkspaceStore } from "./stores/workspace";
import { useSessionStore } from "./stores/session";
import { useDialog } from "./dialog";
import { useToast } from "./toast";
import { useTree } from "./treeState";
import type { CollectionNode, RequestSpec } from "./types";

function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}
function leafOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}
function slug(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, "-");
}
function join(a: string, b: string): string {
  return a ? `${a}/${b}` : b;
}

export function useCollectionActions() {
  const ws = useWorkspaceStore();
  const session = useSessionStore();
  const { prompt, confirm } = useDialog();
  const { show } = useToast();
  const tree = useTree();

  /** 在資料夾下新增請求（folderPath 預設 collections 根）。 */
  async function newRequest(folderPath = "collections") {
    const name = await prompt("新增請求", "新請求");
    if (name === null || !name.trim()) return;
    const id = slug(name) || "request";
    const path = join(folderPath, `${id}.api.yaml`);
    const spec: RequestSpec = {
      version: 1,
      id,
      name,
      method: "GET",
      url: "{{baseUrl}}/",
      headers: {},
      query: {},
    };
    await api.saveRequest(ws.root, path, spec);
    await ws.refresh();
    tree.expand(folderPath);
    await session.openRequest(path);
    show("已新增請求");
  }

  async function newFolder(parentPath = "collections") {
    const name = await prompt("新增資料夾", "新資料夾");
    if (name === null || !name.trim()) return;
    const path = join(parentPath, slug(name) || "folder");
    await api.createFolder(ws.root, path);
    await ws.refresh();
    tree.expand(parentPath);
    show("已新增資料夾");
  }

  async function rename(node: CollectionNode) {
    const name = await prompt(node.kind === "folder" ? "重新命名資料夾" : "重新命名請求", node.name);
    if (name === null || !name.trim()) return;
    if (node.kind === "request") {
      // 改請求顯示名稱：更新 YAML 內的 name（不動檔名，避免與樹顯示脫節）。
      const spec = await api.loadRequest(ws.root, node.path);
      spec.name = name;
      await api.saveRequest(ws.root, node.path, spec);
    } else {
      const to = join(parentOf(node.path), slug(name));
      await api.renameEntry(ws.root, node.path, to);
    }
    await ws.refresh();
    show("已重新命名");
  }

  async function remove(node: CollectionNode) {
    const ok = await confirm(
      `刪除「${node.name}」${node.kind === "folder" ? "及其所有內容" : ""}？此動作無法復原。`,
    );
    if (!ok) return;
    await api.deleteEntry(ws.root, node.path);
    if (session.activePath === node.path) session.newRequest();
    await ws.refresh();
    show("已刪除");
  }

  /** 拖拉移動：把 srcPath 移到 destFolder 下（檔名不變）。 */
  async function move(srcPath: string, destFolder: string) {
    const to = join(destFolder, leafOf(srcPath));
    if (to === srcPath || srcPath === destFolder) return;
    await api.renameEntry(ws.root, srcPath, to);
    if (session.activePath === srcPath) await session.openRequest(to);
    await ws.refresh();
    show("已移動");
  }

  return { newRequest, newFolder, rename, remove, move };
}
