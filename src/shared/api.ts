// Tauri command 封裝。前端一律透過此處呼叫 Rust 核心，集中錯誤處理。

import { invoke } from "@tauri-apps/api/core";
import type {
  CollectionNode,
  DiffEntry,
  Environment,
  FlowSpec,
  FlowSummary,
  HttpResponse,
  RequestSpec,
  SendRequest,
  WorkspaceProbe,
} from "./types";

export function sendRequest(
  request: SendRequest,
  variables: Record<string, string>,
): Promise<HttpResponse> {
  return invoke("send_request", { request, variables });
}

export function listCollections(root: string): Promise<CollectionNode[]> {
  return invoke("list_collections", { root });
}

export function loadRequest(root: string, path: string): Promise<RequestSpec> {
  return invoke("load_request", { root, path });
}

export function saveRequest(root: string, path: string, spec: RequestSpec): Promise<void> {
  return invoke("save_request", { root, path, spec });
}

export function deleteRequest(root: string, path: string): Promise<void> {
  return invoke("delete_request", { root, path });
}

export function createFolder(root: string, path: string): Promise<void> {
  return invoke("create_folder", { root, path });
}

export function renameEntry(root: string, from: string, to: string): Promise<void> {
  return invoke("rename_entry", { root, from, to });
}

export function deleteEntry(root: string, path: string): Promise<void> {
  return invoke("delete_entry", { root, path });
}

export function listEnvironments(root: string): Promise<Environment[]> {
  return invoke("list_environments", { root });
}

export function diffJson(left: string, right: string): Promise<DiffEntry[]> {
  return invoke("diff_json", { left, right });
}

export function listFlows(root: string): Promise<FlowSummary[]> {
  return invoke("list_flows", { root });
}

export function probeWorkspace(path: string): Promise<WorkspaceProbe> {
  return invoke("probe_workspace", { path });
}

export function initWorkspace(parent: string): Promise<string> {
  return invoke("init_workspace", { parent });
}

export function loadFlow(root: string, path: string): Promise<FlowSpec> {
  return invoke("load_flow", { root, path });
}
