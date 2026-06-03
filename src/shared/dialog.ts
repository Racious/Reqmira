// Promise 式輸入/確認對話框（單例）。取代瀏覽器 prompt/confirm（webview 可能禁用）。
import { reactive } from "vue";

interface DialogState {
  open: boolean;
  mode: "prompt" | "confirm";
  title: string;
  value: string;
  placeholder: string;
  danger: boolean;
}

const state = reactive<DialogState>({
  open: false,
  mode: "prompt",
  title: "",
  value: "",
  placeholder: "",
  danger: false,
});

let resolver: ((v: string | boolean | null) => void) | null = null;

export function useDialog() {
  function prompt(title: string, def = "", placeholder = ""): Promise<string | null> {
    state.open = true;
    state.mode = "prompt";
    state.title = title;
    state.value = def;
    state.placeholder = placeholder;
    state.danger = false;
    return new Promise((res) => {
      resolver = res as (v: string | boolean | null) => void;
    });
  }

  function confirm(title: string, danger = true): Promise<boolean> {
    state.open = true;
    state.mode = "confirm";
    state.title = title;
    state.value = "";
    state.danger = danger;
    return new Promise((res) => {
      resolver = res as (v: string | boolean | null) => void;
    });
  }

  function submit() {
    const r = resolver;
    state.open = false;
    resolver = null;
    if (r) r(state.mode === "prompt" ? state.value : true);
  }

  function cancel() {
    const r = resolver;
    state.open = false;
    resolver = null;
    if (r) r(state.mode === "prompt" ? null : false);
  }

  return { state, prompt, confirm, submit, cancel };
}
