// History store：保存最近送出的回應快照（localStorage），供回顧與 Diff 基準。

import { defineStore } from "pinia";
import { ref } from "vue";
import type { HttpResponse } from "../types";

const KEY = "reqmira.history";
const MAX_ENTRIES = 50;
const MAX_BODY = 100_000; // 單筆 body 上限，避免 localStorage 爆量

export interface HistoryEntry {
  id: string;
  name: string;
  method: string;
  sentAt: number;
  response: HttpResponse;
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
      localStorage.setItem(KEY, JSON.stringify(entries.value));
    } catch {
      /* 容量不足時放棄保存，不影響使用 */
    }
  }

  function add(name: string, method: string, response: HttpResponse): string {
    const snapshot: HttpResponse = {
      ...response,
      body: response.body.length > MAX_BODY ? response.body.slice(0, MAX_BODY) : response.body,
    };
    const id = genId();
    entries.value.unshift({ id, name, method, sentAt: Date.now(), response: snapshot });
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES);
    }
    persist();
    return id;
  }

  function clear() {
    entries.value = [];
    persist();
  }

  return { entries, add, clear };
});
