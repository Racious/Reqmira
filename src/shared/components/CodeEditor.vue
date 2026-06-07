<script setup lang="ts">
// 輕量 CodeMirror 6 編輯器：JSON 語法高亮、括號配對、行號。
// 節制引入（不含 autocomplete/search/lint），維持輕量。
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";

const props = defineProps<{
  modelValue: string;
  language?: "json" | "text";
  readonly?: boolean;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const el = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
const langComp = new Compartment();

// 融入 Reqmira 暗色（覆蓋 oneDark 的背景）。
const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--fg-faint)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { caretColor: "var(--accent)" },
});

function langExt() {
  return props.language === "json" ? json() : [];
}

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    parent: el.value!,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      indentOnInput(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      oneDark,
      theme,
      langComp.of(langExt()),
      EditorState.readOnly.of(!!props.readonly),
      EditorView.editable.of(!props.readonly),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit("update:modelValue", u.state.doc.toString());
      }),
    ],
  });
});

// 外部值變更（如格式化、切換請求）→ 同步進編輯器。
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  },
);

// 語言切換（json ↔ text）→ 重配語法。
watch(
  () => props.language,
  () => {
    view?.dispatch({ effects: langComp.reconfigure(langExt()) });
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="el" class="cm-host" />
</template>

<style scoped>
.cm-host {
  height: 100%;
  min-height: 220px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  overflow: hidden;
}
</style>
