<script setup lang="ts">
import { useContextMenu } from "../contextMenu";

const { state, close, run } = useContextMenu();
</script>

<template>
  <div v-if="state.open" class="cm-overlay" @click="close()" @contextmenu.prevent="close()">
    <ul class="cm" :style="{ left: state.x + 'px', top: state.y + 'px' }" @click.stop>
      <li v-for="(it, i) in state.items" :key="i" :class="{ danger: it.danger }" @click="run(it)">
        {{ it.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cm-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
}
.cm {
  position: fixed;
  min-width: 160px;
  list-style: none;
  margin: 0;
  padding: 5px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
.cm li {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.cm li:hover {
  background: var(--bg-soft);
  color: var(--accent);
}
.cm li.danger {
  color: var(--bad);
}
.cm li.danger:hover {
  background: rgba(229, 119, 138, 0.12);
  color: var(--bad);
}
</style>
