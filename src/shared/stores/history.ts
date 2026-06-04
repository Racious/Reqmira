// History store：保存最近送出的回應快照（localStorage），供回顧與 Diff 基準。

import { defineStore } from "pinia";
import { ref } from "vue";
import type { BodyType, HttpResponse, KeyValue } from "../types";

const KEY = "reqmira.history";
const MAX_ENTRIES = 50;
const MAX_BODY = 100_000; // 單筆 body 上限，避免 localStorage 爆量

/** 當次送出的請求快照（供「載入此請求」回填編輯器）。 */
export interface HistoryRequest {
  name: string;
  method: string;
  url: string;
  headers: KeyValue[];
  query: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
}

export interface HistoryEntry {
  id: string;
  name: string;
  method: string;
  sentAt: number;
  response: HttpResponse;
  /** 當次送出的請求（舊紀錄可能沒有，故為選用）。 */
  request?: HistoryRequest;
}

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const useHistoryStore = defineStore("history", () => {
  const entries = ref<HistoryEntry[]>(load());

  function persist() {
    try {
      // localStorage 容量有限：僅在「寫入磁碟」時截斷過大的 body，避免超出配額。
      // 記憶體中的 entries 保留完整 body，確保本次工作階段重看歷史時 Pretty 仍可解析。
      const slim = entries.value.map((e) =>
        e.response.body.length > MAX_BODY
          ? {
              ...e,
              response: { ...e.response, body: e.response.body.slice(0, MAX_BODY), truncated: true },
            }
          : e,
      );
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* 容量不足時放棄保存，不影響使用 */
    }
  }

  function add(
    name: string,
    method: string,
    response: HttpResponse,
    request?: HistoryRequest,
  ): string {
    const id = genId();
    // 記憶體保留完整回應；截斷只發生在 persist()，故當下重看歷史可完整解析。
    entries.value.unshift({ id, name, method, sentAt: Date.now(), response, request });
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES);
    }
    persist();
    return id;
  }

  /** 刪除單筆紀錄。 */
  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id);
    persist();
  }

  /** 重新命名單筆紀錄（空白則不變更）。 */
  function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const e = entries.value.find((x) => x.id === id);
    if (e && e.name !== trimmed) {
      e.name = trimmed;
      persist();
    }
  }

  function clear() {
    entries.value = [];
    persist();
  }

  return { entries, add, remove, rename, clear };
});
