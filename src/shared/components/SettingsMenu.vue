<script setup lang="ts">
// ⚙ 設定選單：版面與顯示的客製化偏好。點背景或選項外即關閉。
import { ref } from "vue";
import { useSettingsStore } from "../stores/settings";

const settings = useSettingsStore();
const open = ref(false);
</script>

<template>
  <div class="set-wrap">
    <button class="icon" :class="{ on: open }" title="版面與顯示設定" @click="open = !open">⚙</button>

    <template v-if="open">
      <div class="set-backdrop" @click="open = false" />
      <div class="set-menu" role="menu">
        <div class="set-group">面板</div>
        <label class="set-row">
          <input type="checkbox" v-model="settings.sidebarCollapsed" />
          收合左側欄
        </label>
        <label class="set-row">
          <input type="checkbox" v-model="settings.inspectorCollapsed" />
          收合右側檢視器
        </label>
        <button class="set-btn" @click="settings.resetPanelWidths()">重設面板寬度</button>
        <p class="set-hint">提示：拖曳欄位之間的分隔線可調整寬度，雙擊分隔線可收合。</p>

        <div class="set-group">顯示</div>
        <label class="set-row">
          <input type="checkbox" v-model="settings.alwaysShowRowActions" />
          常駐顯示列上操作按鈕
        </label>
        <p class="set-hint">關閉時，「設為基準」等按鈕僅在滑鼠移過該列時出現。</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.set-wrap {
  position: relative;
  display: inline-flex;
}
.icon.on {
  color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
}
.set-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}
.set-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 91;
  width: 250px;
  padding: 10px;
  background: var(--panel-2, #0d1828);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  font-size: 13px;
}
.set-group {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--fg-faint, #64748b);
  margin: 8px 4px 4px;
}
.set-group:first-child {
  margin-top: 2px;
}
.set-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--fg);
}
.set-row:hover {
  background: var(--bg-soft);
}
.set-row input {
  cursor: pointer;
}
.set-btn {
  width: 100%;
  margin: 4px 0 2px;
  font-size: 12px;
}
.set-hint {
  margin: 4px 6px 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--fg-dim);
}
</style>
