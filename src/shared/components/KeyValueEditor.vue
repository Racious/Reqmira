<script setup lang="ts">
import { computed } from "vue";
import type { KeyValue } from "../types";

const props = defineProps<{
  modelValue: KeyValue[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: KeyValue[]): void;
}>();

// 顯示時永遠在尾端保留一列空白，輸入即自動「長出」新列。
const rows = computed<KeyValue[]>(() => {
  return [...props.modelValue, { key: "", value: "", enabled: true }];
});

function update(index: number, patch: Partial<KeyValue>) {
  const next = [...props.modelValue];
  if (index === props.modelValue.length) {
    // 編輯的是尾端空白列 → 新增一筆
    next.push({ key: "", value: "", enabled: true, ...patch });
  } else {
    next[index] = { ...next[index], ...patch };
  }
  emit("update:modelValue", next);
}

function remove(index: number) {
  const next = [...props.modelValue];
  next.splice(index, 1);
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="kv">
    <div v-for="(row, i) in rows" :key="i" class="kv-row" :class="{ ghost: i === modelValue.length }">
      <input
        type="checkbox"
        :checked="row.enabled"
        :disabled="i === modelValue.length"
        @change="update(i, { enabled: ($event.target as HTMLInputElement).checked })"
      />
      <input
        class="kv-key"
        :value="row.key"
        :placeholder="keyPlaceholder ?? 'Key'"
        @input="update(i, { key: ($event.target as HTMLInputElement).value })"
      />
      <input
        class="kv-val"
        :value="row.value"
        :placeholder="valuePlaceholder ?? 'Value'"
        @input="update(i, { value: ($event.target as HTMLInputElement).value })"
      />
      <button
        class="kv-del"
        :disabled="i === modelValue.length"
        title="移除"
        @click="remove(i)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.kv {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kv-row {
  display: grid;
  grid-template-columns: 20px 1fr 1.4fr 28px;
  gap: 8px;
  align-items: center;
}
.kv-row.ghost {
  opacity: 0.55;
}
.kv-key,
.kv-val {
  width: 100%;
}
.kv-del {
  padding: 4px 0;
  border-radius: 6px;
  font-size: 11px;
}
input[type="checkbox"] {
  accent-color: var(--accent);
}
</style>
