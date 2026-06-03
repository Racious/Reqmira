// Collection 樹的展開/收合與拖拉狀態（跨遞迴實例共用的單例）。
// 預設展開；記錄被「收合」的資料夾路徑。
import { reactive, ref } from "vue";

const collapsed = reactive(new Set<string>());
const dragOverPath = ref<string>("");

export function useTree() {
  return {
    isCollapsed: (path: string) => collapsed.has(path),
    toggle: (path: string) => {
      if (collapsed.has(path)) collapsed.delete(path);
      else collapsed.add(path);
    },
    expand: (path: string) => collapsed.delete(path),
    // 拖拉目標高亮
    dragOverPath,
    isDragOver: (path: string) => dragOverPath.value === path,
    setDragOver: (path: string) => (dragOverPath.value = path),
    clearDragOver: () => (dragOverPath.value = ""),
  };
}
