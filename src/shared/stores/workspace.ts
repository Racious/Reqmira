// Workspace store：目前開啟的工作區根目錄、collection tree、環境變數。

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "../api";
import type { CollectionNode, Environment, FlowSummary } from "../types";

const LS_ROOT = "reqmira.workspace.root";
const LS_ENV = "reqmira.workspace.env";

export const useWorkspaceStore = defineStore("workspace", () => {
  const root = ref<string>(localStorage.getItem(LS_ROOT) ?? "");
  const collections = ref<CollectionNode[]>([]);
  const environments = ref<Environment[]>([]);
  const flows = ref<FlowSummary[]>([]);
  const activeEnvName = ref<string>(localStorage.getItem(LS_ENV) ?? "");
  const loading = ref(false);
  const error = ref<string>("");
  // 待初始化的父目錄（選到未初始化資料夾時，等待老爺確認）。
  const pendingInit = ref<string>("");

  const hasWorkspace = computed(() => root.value.length > 0);

  const activeEnv = computed<Environment | undefined>(() =>
    environments.value.find((e) => e.name === activeEnvName.value),
  );

  /** 目前環境的變數表，供發送請求時解析 {{var}} */
  const activeVariables = computed<Record<string, string>>(
    () => activeEnv.value?.variables ?? {},
  );

  async function refresh() {
    if (!root.value) return;
    loading.value = true;
    error.value = "";
    try {
      const [cols, envs, fls] = await Promise.all([
        api.listCollections(root.value),
        api.listEnvironments(root.value),
        api.listFlows(root.value),
      ]);
      collections.value = cols;
      environments.value = envs;
      flows.value = fls;
      // 確保 activeEnv 仍有效
      if (envs.length && !envs.some((e) => e.name === activeEnvName.value)) {
        setActiveEnv(envs[0].name);
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function pickWorkspace() {
    const selected = await open({ directory: true, multiple: false, title: "選擇專案或工作區資料夾" });
    if (typeof selected !== "string") return;
    error.value = "";
    try {
      const probe = await api.probeWorkspace(selected);
      if (probe.initialized && probe.root) {
        pendingInit.value = "";
        setRoot(probe.root);
        await refresh();
      } else {
        // 未初始化 → 等待老爺確認在其下建立 reqmira/
        pendingInit.value = selected;
      }
    } catch (e) {
      error.value = String(e);
    }
  }

  /** 確認在 pendingInit 目錄下建立 reqmira/ 工作區。 */
  async function confirmInit() {
    if (!pendingInit.value) return;
    try {
      const newRoot = await api.initWorkspace(pendingInit.value);
      pendingInit.value = "";
      setRoot(newRoot);
      await refresh();
    } catch (e) {
      error.value = String(e);
    }
  }

  function cancelInit() {
    pendingInit.value = "";
  }

  function setRoot(path: string) {
    root.value = path;
    localStorage.setItem(LS_ROOT, path);
  }

  function setActiveEnv(name: string) {
    activeEnvName.value = name;
    localStorage.setItem(LS_ENV, name);
  }

  async function saveEnvironment(env: Environment) {
    if (!root.value) return;
    await api.saveEnvironment(root.value, env);
    await refresh();
  }

  async function deleteEnvironment(name: string) {
    if (!root.value) return;
    await api.deleteEnvironment(root.value, name);
    if (activeEnvName.value === name) setActiveEnv("");
    await refresh();
  }

  return {
    root,
    collections,
    environments,
    flows,
    activeEnvName,
    activeEnv,
    activeVariables,
    loading,
    error,
    pendingInit,
    hasWorkspace,
    refresh,
    pickWorkspace,
    confirmInit,
    cancelInit,
    setRoot,
    setActiveEnv,
    saveEnvironment,
    deleteEnvironment,
  };
});
