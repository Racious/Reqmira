<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useDialog } from "../dialog";

const { state, submit, cancel } = useDialog();
const inputEl = ref<HTMLInputElement | null>(null);

watch(
  () => state.open,
  async (open) => {
    if (open && state.mode === "prompt") {
      await nextTick();
      inputEl.value?.focus();
      inputEl.value?.select();
    }
  },
);
</script>

<template>
  <Transition name="dlg">
    <div v-if="state.open" class="overlay" @click.self="cancel()">
      <div class="dlg">
        <h4 class="title">{{ state.title }}</h4>
        <input
          v-if="state.mode === 'prompt'"
          ref="inputEl"
          v-model="state.value"
          class="dlg-input"
          :placeholder="state.placeholder"
          spellcheck="false"
          @keyup.enter="submit()"
          @keyup.esc="cancel()"
        />
        <div class="actions">
          <button :class="state.danger ? 'danger' : 'primary'" @click="submit()">
            {{ state.mode === "confirm" ? (state.danger ? "刪除" : "確定") : "確定" }}
          </button>
          <button @click="cancel()">取消</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 9, 18, 0.5);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 80;
}
.dlg {
  width: min(420px, 90vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
}
.title {
  margin: 0 0 12px;
  font-size: 14.5px;
}
.dlg-input {
  width: 100%;
  margin-bottom: 14px;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
button.danger {
  background: var(--bad);
  border: none;
  color: #1a0608;
  font-weight: 600;
}
.dlg-enter-active,
.dlg-leave-active {
  transition: opacity 0.15s;
}
.dlg-enter-from,
.dlg-leave-to {
  opacity: 0;
}
</style>
