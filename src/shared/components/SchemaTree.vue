<script setup lang="ts">
// 遞迴呈現型別推測結果（SchemaNode）。型別著色、格式標籤、陣列長度、required。
import { ref, computed } from "vue";
import type { SchemaNode } from "../analyze";

const props = defineProps<{
  node: SchemaNode;
  nodeKey?: string;
  required?: boolean;
  depth?: number;
  /** 是否顯示 required 標記（response 推測無「必填」語意，可關閉）。 */
  showRequired?: boolean;
}>();

const expanded = ref((props.depth ?? 0) < 2);

const isBranch = computed(() => props.node.type === "object" || props.node.type === "array");

const typeLabel = computed(() => {
  const n = props.node;
  if (n.type === "array") return n.length !== undefined ? `array(${n.length})` : "array";
  return n.type;
});

const children = computed(() => {
  const n = props.node;
  if (n.type === "object") return n.fields ?? [];
  if (n.type === "array" && n.items) return [{ key: "[ ]", node: n.items, required: true }];
  return [];
});
</script>

<template>
  <div class="snode">
    <div class="sline" @click="isBranch && (expanded = !expanded)">
      <span class="stwist" :class="{ open: expanded, leaf: !isBranch }">{{ isBranch ? "▸" : "" }}</span>
      <span v-if="nodeKey !== undefined" class="skey">{{ nodeKey }}</span>
      <span v-if="nodeKey !== undefined" class="scolon">:</span>
      <span class="stype" :class="`tt-${node.type}`">{{ typeLabel }}</span>
      <span v-if="node.format" class="sfmt">{{ node.format }}</span>
      <span v-if="showRequired && nodeKey !== undefined && !required" class="sopt">可選</span>
      <span v-if="node.sample && !isBranch" class="ssample mono">{{ node.sample }}</span>
    </div>
    <div v-if="isBranch && expanded && children.length" class="schildren">
      <SchemaTree
        v-for="c in children"
        :key="c.key"
        :node="c.node"
        :node-key="c.key"
        :required="c.required"
        :show-required="showRequired"
        :depth="(depth ?? 0) + 1"
      />
    </div>
    <div v-else-if="isBranch && expanded && !children.length" class="sempty">（空）</div>
  </div>
</template>

<style scoped>
.snode {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.75;
}
.sline {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}
.stwist {
  display: inline-block;
  width: 12px;
  color: var(--fg-faint);
  cursor: pointer;
  transition: transform 0.12s;
}
.stwist.open {
  transform: rotate(90deg);
}
.stwist.leaf {
  cursor: default;
}
.skey {
  color: var(--accent);
}
.scolon {
  color: var(--fg-faint);
}
.stype {
  font-size: 11px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.sfmt {
  font-size: 10.5px;
  color: var(--accent-2);
  border: 1px solid rgba(216, 180, 106, 0.3);
  border-radius: 999px;
  padding: 0 7px;
}
.sopt {
  font-size: 10.5px;
  color: var(--fg-faint);
}
.ssample {
  font-size: 11px;
  color: var(--fg-faint);
}
.schildren {
  padding-left: 16px;
  border-left: 1px dashed var(--border);
  margin-left: 5px;
}
.sempty {
  padding-left: 22px;
  color: var(--fg-faint);
  font-size: 11.5px;
}
/* 型別色票 */
.tt-string {
  color: var(--good);
}
.tt-integer,
.tt-number {
  color: var(--accent-2);
}
.tt-boolean {
  color: var(--accent-3);
}
.tt-null,
.tt-mixed {
  color: var(--bad);
}
.tt-variable {
  color: var(--accent);
}
.tt-object,
.tt-array {
  color: var(--fg-dim);
}
</style>
