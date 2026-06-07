// Session store：目前正在編輯的 request 草稿、發送結果與狀態。

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as api from "../api";
import type { AuthSpec, BodyType, HttpResponse, KeyValue, RequestSpec, SendRequest } from "../types";
import { useWorkspaceStore } from "./workspace";
import { useHistoryStore, type HistoryRequest } from "./history";
import { useSettingsStore } from "./settings";
import { useResponses } from "./responses";

/** 編輯期的可變草稿（鍵值以陣列呈現，便於 UI 增刪與勾選）。 */
export interface RequestDraft {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: KeyValue[];
  query: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
  auth: AuthSpec;
}

/** Diff 比較基準：回應快照 + 來源標示。 */
export interface CompareBase {
  response: HttpResponse;
  /** 人類可讀的來源描述，如「建立使用者 · 200 · 02:30」 */
  label: string;
  /** 若來自 History，記其 id 以利列表高亮。 */
  sourceId?: string;
}

function recordToKv(rec?: Record<string, string>): KeyValue[] {
  if (!rec) return [];
  return Object.entries(rec).map(([key, value]) => ({ key, value, enabled: true }));
}

function kvToRecord(kv: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of kv) {
    if (item.enabled && item.key.trim()) out[item.key] = item.value;
  }
  return out;
}

function specToDraft(spec: RequestSpec): RequestDraft {
  return {
    id: spec.id,
    name: spec.name,
    method: spec.method ?? "GET",
    url: spec.url ?? "",
    headers: recordToKv(spec.headers),
    query: recordToKv(spec.query),
    bodyType: spec.body?.type ?? "none",
    bodyContent: spec.body?.content ?? "",
    auth: spec.auth ?? { type: "none" },
  };
}

function draftToSpec(draft: RequestDraft): RequestSpec {
  const spec: RequestSpec = {
    version: 1,
    id: draft.id,
    name: draft.name || draft.id,
    method: draft.method,
    url: draft.url,
    headers: kvToRecord(draft.headers),
    query: kvToRecord(draft.query),
  };
  if (draft.bodyType !== "none" && draft.bodyContent.trim()) {
    spec.body = { type: draft.bodyType, content: draft.bodyContent };
  }
  if (draft.auth && draft.auth.type !== "none") {
    spec.auth = { ...draft.auth };
  }
  return spec;
}

/** 由 auth 設定組出要附加的 header / query。 */
function buildAuth(auth?: AuthSpec): { headers: KeyValue[]; query: KeyValue[] } {
  const headers: KeyValue[] = [];
  const query: KeyValue[] = [];
  if (!auth || auth.type === "none") return { headers, query };
  if (auth.type === "bearer" && auth.token) {
    headers.push({ key: "Authorization", value: `Bearer ${auth.token}`, enabled: true });
  } else if (auth.type === "basic") {
    let enc = `${auth.username ?? ""}:${auth.password ?? ""}`;
    try {
      enc = btoa(enc);
    } catch {
      /* 非 latin1 字元時退回原文 */
    }
    headers.push({ key: "Authorization", value: `Basic ${enc}`, enabled: true });
  } else if (auth.type === "apikey" && auth.key) {
    const kv = { key: auth.key, value: auth.value ?? "", enabled: true };
    if (auth.addTo === "query") query.push(kv);
    else headers.push(kv);
  }
  return { headers, query };
}

function blankDraft(): RequestDraft {
  return {
    id: "new-request",
    name: "未命名請求",
    method: "GET",
    url: "{{baseUrl}}/",
    headers: [],
    query: [],
    bodyType: "none",
    bodyContent: "",
    auth: { type: "none" },
  };
}

export const useSessionStore = defineStore("session", () => {
  const draft = ref<RequestDraft | null>(null);
  const activePath = ref<string>("");
  const response = ref<HttpResponse | null>(null);
  // 目前顯示的回應對應的 History 紀錄 id（用於將「設為基準」關聯到該紀錄）。
  const currentEntryId = ref<string>("");
  // 目前檢視之歷史紀錄當時送出的請求（供「重新送出」用；無則為 null）。
  const viewedRequest = ref<HistoryRequest | null>(null);
  const sending = ref(false);
  const sendError = ref<string>("");
  const saveError = ref<string>("");
  // Diff 比較基準（另一筆回應，通常來自歷史或上一次送出）。
  const compareBase = ref<CompareBase | null>(null);
  // 已儲存狀態快照，用於判斷「未儲存變更」。
  const savedSnapshot = ref<string>("");

  const hasDraft = computed(() => draft.value !== null);
  const dirty = computed(
    () => !!draft.value && JSON.stringify(draft.value) !== savedSnapshot.value,
  );

  function markSaved() {
    savedSnapshot.value = draft.value ? JSON.stringify(draft.value) : "";
  }

  async function openRequest(path: string) {
    const ws = useWorkspaceStore();
    try {
      const spec = await api.loadRequest(ws.root, path);
      draft.value = specToDraft(spec);
      activePath.value = path;
      response.value = null;
      currentEntryId.value = "";
      sendError.value = "";
      saveError.value = "";
      markSaved();
    } catch (e) {
      sendError.value = String(e);
    }
  }

  function newRequest() {
    draft.value = blankDraft();
    activePath.value = "";
    response.value = null;
    currentEntryId.value = "";
    sendError.value = "";
    saveError.value = "";
    markSaved();
  }

  /** 由匯入（如 curl）建立一個未儲存的新請求草稿。 */
  function importDraft(p: {
    method: string;
    url: string;
    headers: KeyValue[];
    body: string;
    bodyType: BodyType;
  }) {
    draft.value = {
      id: "imported-request",
      name: "匯入的請求",
      method: p.method,
      url: p.url,
      headers: p.headers,
      query: [],
      bodyType: p.bodyType,
      bodyContent: p.body,
      auth: { type: "none" },
    };
    activePath.value = "";
    response.value = null;
    currentEntryId.value = "";
    sendError.value = "";
    saveError.value = "";
    markSaved();
  }

  async function send() {
    if (!draft.value) return;
    const ws = useWorkspaceStore();
    sending.value = true;
    sendError.value = "";
    try {
      const authAdd = buildAuth(draft.value.auth);
      const payload: SendRequest = {
        method: draft.value.method,
        url: draft.value.url,
        headers: [...draft.value.headers, ...authAdd.headers],
        query: [...draft.value.query, ...authAdd.query],
        body: draft.value.bodyContent,
        bodyType: draft.value.bodyType,
        insecure: useSettingsStore().insecureSkipTlsVerify,
      };
      // 回應引用：掃描各欄位中的 {{responses.*}} 解析成值，併入變數。
      const responses = useResponses();
      const refVars = responses.refVars([
        payload.url,
        payload.body,
        ...payload.headers.map((h) => h.value),
        ...payload.query.map((q) => q.value),
      ]);
      const variables = { ...ws.activeVariables, ...refVars };
      const resp = await api.sendRequest(payload, variables);
      response.value = resp;
      responses.record(draft.value.id, resp.body);
      // 保留當次送出的請求快照（深拷貝鍵值陣列，避免日後編輯草稿時連動竄改歷史）。
      const reqSnapshot: HistoryRequest = {
        name: draft.value.name,
        method: draft.value.method,
        url: draft.value.url,
        headers: draft.value.headers.map((kv) => ({ ...kv })),
        query: draft.value.query.map((kv) => ({ ...kv })),
        bodyType: draft.value.bodyType,
        bodyContent: draft.value.bodyContent,
      };
      viewedRequest.value = reqSnapshot;
      currentEntryId.value = useHistoryStore().add(
        draft.value.name || draft.value.id,
        draft.value.method,
        resp,
        reqSnapshot,
      );
    } catch (e) {
      sendError.value = String(e);
    } finally {
      sending.value = false;
    }
  }

  /** 從歷史紀錄載入當次送出的請求到編輯器（不自動送出、不覆寫回應）。 */
  function loadHistoryRequest(req: HistoryRequest) {
    draft.value = {
      id: "history-request",
      name: req.name || "歷史請求",
      method: req.method,
      url: req.url,
      headers: req.headers.map((kv) => ({ ...kv })),
      query: req.query.map((kv) => ({ ...kv })),
      bodyType: req.bodyType,
      bodyContent: req.bodyContent,
      auth: { type: "none" },
    };
    activePath.value = "";
    sendError.value = "";
    saveError.value = "";
    markSaved();
  }

  /** 顯示一筆歷史回應（不重新送出）。entryId 為該回應對應的 History id，
   *  request 為該筆當時送出的請求（供截斷提示的「重新送出」用）。 */
  function showResponse(resp: HttpResponse, entryId = "", request: HistoryRequest | null = null) {
    response.value = resp;
    currentEntryId.value = entryId;
    viewedRequest.value = request;
    sendError.value = "";
  }

  /** 載入指定請求並立即送出（截斷的舊紀錄一鍵取回完整回應）。 */
  async function resendRequest(req: HistoryRequest) {
    loadHistoryRequest(req);
    await send();
  }

  /** 設定 Diff 比較基準；傳 null 清除。 */
  function setCompareBase(response: HttpResponse | null, label = "", sourceId?: string) {
    compareBase.value = response ? { response, label, sourceId } : null;
  }

  /** 儲存。新請求需傳入目標相對路徑（如 collections/users/get-user.api.yaml）。 */
  async function save(path?: string): Promise<boolean> {
    if (!draft.value) return false;
    const ws = useWorkspaceStore();
    const target = path ?? activePath.value;
    if (!target) {
      saveError.value = "尚未指定儲存路徑";
      return false;
    }
    saveError.value = "";
    try {
      await api.saveRequest(ws.root, target, draftToSpec(draft.value));
      activePath.value = target;
      markSaved();
      await ws.refresh();
      return true;
    } catch (e) {
      saveError.value = String(e);
      return false;
    }
  }

  return {
    draft,
    activePath,
    response,
    sending,
    sendError,
    saveError,
    compareBase,
    currentEntryId,
    dirty,
    hasDraft,
    openRequest,
    newRequest,
    importDraft,
    send,
    save,
    showResponse,
    loadHistoryRequest,
    resendRequest,
    viewedRequest,
    setCompareBase,
  };
});
