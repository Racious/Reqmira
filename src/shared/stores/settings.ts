// Settings store：使用者層級的全域偏好，持久化於 localStorage。

import { defineStore } from "pinia";
import { ref, watch } from "vue";

const KEY = "reqmira.settings";

/** 中欄 Request/Response 的排列方向。 */
export type CenterLayout = "vertical" | "horizontal";

interface Persisted {
  /** 略過 TLS 憑證驗證（自簽憑證的內網設備用）。 */
  insecureSkipTlsVerify: boolean;
  /** 中欄佈局：vertical = Request 上 / Response 下；horizontal = 左右並排。 */
  centerLayout: CenterLayout;
  /** Request 區佔中欄的百分比（其餘給 Response），15–85。 */
  centerSplit: number;
  /** 左側欄寬度（px）。 */
  sidebarWidth: number;
  /** 右側檢視器寬度（px）。 */
  inspectorWidth: number;
  /** 左側欄是否收合。 */
  sidebarCollapsed: boolean;
  /** 右側檢視器是否收合。 */
  inspectorCollapsed: boolean;
  /** 中欄 Request 區是否收合。 */
  editorCollapsed: boolean;
  /** 中欄 Response 區是否收合。 */
  respCollapsed: boolean;
  /** 列上操作按鈕（如「設為基準」）是否常駐顯示，而非僅滑鼠移過才出現。 */
  alwaysShowRowActions: boolean;
}

export const SIDEBAR_DEFAULT = 260;
export const INSPECTOR_DEFAULT = 300;
/** 拖曳寬度的可調範圍。 */
export const PANEL_MIN = 180;
export const PANEL_MAX = 480;

const DEFAULTS: Persisted = {
  insecureSkipTlsVerify: false,
  centerLayout: "vertical",
  centerSplit: 55,
  sidebarWidth: SIDEBAR_DEFAULT,
  inspectorWidth: INSPECTOR_DEFAULT,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  editorCollapsed: false,
  respCollapsed: false,
  alwaysShowRowActions: false,
};

function clampWidth(n: unknown, fallback: number): number {
  const v = typeof n === "number" && isFinite(n) ? n : fallback;
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, v));
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) };
      p.sidebarWidth = clampWidth(p.sidebarWidth, SIDEBAR_DEFAULT);
      p.inspectorWidth = clampWidth(p.inspectorWidth, INSPECTOR_DEFAULT);
      p.centerSplit = Math.min(85, Math.max(15, typeof p.centerSplit === "number" ? p.centerSplit : 55));
      return p;
    }
  } catch {
    /* 解析失敗則退回預設 */
  }
  return { ...DEFAULTS };
}

export const useSettingsStore = defineStore("settings", () => {
  const init = load();

  // 略過 TLS 憑證驗證：預設關閉（安全）。開啟後仍走 HTTPS 加密，但不驗證對端身分，
  // 失去防中間人攻擊的保護——僅建議對自家內網設備使用。
  const insecureSkipTlsVerify = ref(init.insecureSkipTlsVerify);

  // 中欄 Request/Response 排列方向。
  const centerLayout = ref<CenterLayout>(init.centerLayout);
  function toggleCenterLayout() {
    centerLayout.value = centerLayout.value === "vertical" ? "horizontal" : "vertical";
  }
  const centerSplit = ref(init.centerSplit);

  // 版面客製：欄寬、收合、列操作常駐顯示。
  const sidebarWidth = ref(init.sidebarWidth);
  const inspectorWidth = ref(init.inspectorWidth);
  const sidebarCollapsed = ref(init.sidebarCollapsed);
  const inspectorCollapsed = ref(init.inspectorCollapsed);
  const editorCollapsed = ref(init.editorCollapsed);
  const respCollapsed = ref(init.respCollapsed);
  const alwaysShowRowActions = ref(init.alwaysShowRowActions);

  // Request / Response 互斥：收掉一個時，確保另一個展開（中欄不致全空）。
  function toggleEditor() {
    editorCollapsed.value = !editorCollapsed.value;
    if (editorCollapsed.value) respCollapsed.value = false;
  }
  function toggleResp() {
    respCollapsed.value = !respCollapsed.value;
    if (respCollapsed.value) editorCollapsed.value = false;
  }

  watch(
    [
      insecureSkipTlsVerify,
      centerLayout,
      centerSplit,
      sidebarWidth,
      inspectorWidth,
      sidebarCollapsed,
      inspectorCollapsed,
      editorCollapsed,
      respCollapsed,
      alwaysShowRowActions,
    ],
    () => {
      try {
        const data: Persisted = {
          insecureSkipTlsVerify: insecureSkipTlsVerify.value,
          centerLayout: centerLayout.value,
          centerSplit: centerSplit.value,
          sidebarWidth: sidebarWidth.value,
          inspectorWidth: inspectorWidth.value,
          sidebarCollapsed: sidebarCollapsed.value,
          inspectorCollapsed: inspectorCollapsed.value,
          editorCollapsed: editorCollapsed.value,
          respCollapsed: respCollapsed.value,
          alwaysShowRowActions: alwaysShowRowActions.value,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* 容量不足時放棄保存，不影響使用 */
      }
    },
  );

  function resetPanelWidths() {
    sidebarWidth.value = SIDEBAR_DEFAULT;
    inspectorWidth.value = INSPECTOR_DEFAULT;
  }

  return {
    insecureSkipTlsVerify,
    centerLayout,
    toggleCenterLayout,
    centerSplit,
    sidebarWidth,
    inspectorWidth,
    sidebarCollapsed,
    inspectorCollapsed,
    editorCollapsed,
    respCollapsed,
    toggleEditor,
    toggleResp,
    alwaysShowRowActions,
    resetPanelWidths,
  };
});
