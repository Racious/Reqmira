// 極簡全域 toast：複製等動作的即時反饋。單例 reactive，全站共用。
import { ref } from "vue";

const message = ref("");
let timer: number | undefined;

export function useToast() {
  function show(msg: string, ms = 1500) {
    message.value = msg;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => (message.value = ""), ms);
  }
  return { message, show };
}

/** 複製文字並彈出反饋。 */
export async function copyWithToast(text: string, label: string) {
  const { show } = useToast();
  try {
    await navigator.clipboard?.writeText(text);
    show(label);
  } catch {
    show("複製失敗");
  }
}
