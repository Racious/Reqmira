// Settings store：使用者層級的全域偏好，持久化於 localStorage。

import { defineStore } from "pinia";
import { ref, watch } from "vue";

const KEY = "reqmira.settings";

interface Persisted {
  /** 略過 TLS 憑證驗證（自簽憑證的內網設備用）。 */
  insecureSkipTlsVerify: boolean;
  /** 左側欄寬度（px）。 */
  sidebarWidth: number;
  /** 右側檢視器寬度（px）。 */
  inspectorWidth: number;
  /** 左側欄是否收合。 */
  sidebarCollapsed: boolean;
  /** 右側檢視器是否收合。 */
  inspectorCollapsed: boolean;
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
  sidebarWidth: SIDEBAR_DEFAULT,
  inspectorWidth: INSPECTOR_DEFAULT,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
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

  // 版面客製：欄寬、收合、列操作常駐顯示。
  const sidebarWidth = ref(init.sidebarWidth);
  const inspectorWidth = ref(init.inspectorWidth);
  const sidebarCollapsed = ref(init.sidebarCollapsed);
  const inspectorCollapsed = ref(init.inspectorCollapsed);
  const alwaysShowRowActions = ref(init.alwaysShowRowActions);

  watch(
    [
      insecureSkipTlsVerify,
      sidebarWidth,
      inspectorWidth,
      sidebarCollapsed,
      inspectorCollapsed,
      alwaysShowRowActions,
    ],
    () => {
      try {
        const data: Persisted = {
          insecureSkipTlsVerify: insecureSkipTlsVerify.value,
          sidebarWidth: sidebarWidth.value,
          inspectorWidth: inspectorWidth.value,
          sidebarCollapsed: sidebarCollapsed.value,
          inspectorCollapsed: inspectorCollapsed.value,
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
    sidebarWidth,
    inspectorWidth,
    sidebarCollapsed,
    inspectorCollapsed,
    alwaysShowRowActions,
    resetPanelWidths,
  };
});
