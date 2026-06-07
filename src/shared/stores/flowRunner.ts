// Flow Runner：前端編排多步驟流程。
// 依序載入 request → 合併變數 → 送出 → 抽取 runtime 變數 → 斷言 → 收集結果。
// IO 等待為主、非運算密集，故置於前端以即時更新進度；重用既有 Rust commands。

import { defineStore } from "pinia";
import { ref } from "vue";
import * as api from "../api";
import { getByPath } from "../jsonpath";
import { useWorkspaceStore } from "./workspace";
import { useSettingsStore } from "./settings";
import { useResponses } from "./responses";
import type {
  AssertResult,
  FlowSpec,
  KeyValue,
  RequestSpec,
  SendRequest,
  StepResult,
} from "../types";

function recordToKv(rec?: Record<string, string>): KeyValue[] {
  return rec ? Object.entries(rec).map(([key, value]) => ({ key, value, enabled: true })) : [];
}

function specToSend(spec: RequestSpec): SendRequest {
  return {
    method: spec.method,
    url: spec.url,
    headers: recordToKv(spec.headers),
    query: recordToKv(spec.query),
    body: spec.body?.content ?? null,
    bodyType: spec.body?.type ?? "none",
  };
}

function looseEq(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual == null) return false;
  return String(actual) === String(expected);
}

export const useFlowRunnerStore = defineStore("flowRunner", () => {
  const currentFlow = ref<FlowSpec | null>(null);
  const results = ref<StepResult[]>([]);
  const running = ref(false);
  const openPath = ref<string>(""); // 目前開啟的 flow 路徑（模態用）

  async function open(path: string) {
    const ws = useWorkspaceStore();
    openPath.value = path;
    results.value = [];
    currentFlow.value = null;
    try {
      currentFlow.value = await api.loadFlow(ws.root, path);
    } catch (e) {
      // 載入失敗以一筆錯誤結果呈現
      results.value = [
        { name: "載入 flow", request: path, extracted: {}, asserts: [], error: String(e), passed: false },
      ];
    }
  }

  function close() {
    openPath.value = "";
    currentFlow.value = null;
    results.value = [];
  }

  async function run() {
    const ws = useWorkspaceStore();
    const flow = currentFlow.value;
    if (!flow || running.value) return;

    running.value = true;
    results.value = [];
    const runtime: Record<string, string> = {};

    try {
      for (const step of flow.steps) {
        const result: StepResult = {
          name: step.name,
          request: step.request,
          extracted: {},
          asserts: [],
          passed: false,
        };

        try {
          const spec = await api.loadRequest(ws.root, step.request);
          const send = specToSend(spec);
          send.insecure = useSettingsStore().insecureSkipTlsVerify;
          const responses = useResponses();
          const refVars = responses.refVars([
            send.url,
            send.body,
            ...send.headers.map((h) => h.value),
            ...send.query.map((q) => q.value),
          ]);
          const variables = {
            ...ws.activeVariables,
            ...refVars,
            ...runtime,
            ...(step.variables ?? {}),
          };
          const resp = await api.sendRequest(send, variables);
          responses.record(spec.id, resp.body);

          result.status = resp.status;
          result.durationMs = resp.durationMs;
          result.finalUrl = resp.finalUrl;

          let parsed: unknown = undefined;
          try {
            parsed = JSON.parse(resp.body);
          } catch {
            /* 非 JSON，extract/json 斷言將取不到值 */
          }

          // 抽取 → runtime 變數
          for (const [name, path] of Object.entries(step.extract ?? {})) {
            const v = getByPath(parsed, path);
            const sv = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
            runtime[name] = sv;
            result.extracted[name] = sv;
          }

          // 斷言
          const asserts: AssertResult[] = [];
          for (const [key, expected] of Object.entries(step.assert ?? {})) {
            let actual: unknown;
            if (key === "status") {
              actual = resp.status;
            } else {
              const path = key.startsWith("json.") ? key.slice(5) : key;
              actual = getByPath(parsed, path);
            }
            asserts.push({ key, expected, actual, passed: looseEq(actual, expected) });
          }
          result.asserts = asserts;
          result.passed = asserts.every((a) => a.passed);
        } catch (e) {
          result.error = String(e);
          result.passed = false;
          results.value = [...results.value, result];
          break; // 硬錯誤（如網路失敗）中止後續步驟
        }

        results.value = [...results.value, result];
      }
    } finally {
      running.value = false;
    }
  }

  return { currentFlow, results, running, openPath, open, close, run };
});
