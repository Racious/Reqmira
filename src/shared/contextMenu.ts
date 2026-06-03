// 全域右鍵選單（單例）。
import { reactive } from "vue";

export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

interface MenuState {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
}

const state = reactive<MenuState>({ open: false, x: 0, y: 0, items: [] });

export function useContextMenu() {
  function openMenu(e: MouseEvent, items: MenuItem[]) {
    e.preventDefault();
    e.stopPropagation();
    state.x = e.clientX;
    state.y = e.clientY;
    state.items = items;
    state.open = true;
  }
  function close() {
    state.open = false;
    state.items = [];
  }
  function run(item: MenuItem) {
    close();
    item.action();
  }
  return { state, openMenu, close, run };
}
