<script setup lang="ts">
// 輕量 CodeMirror 6 編輯器：JSON 語法高亮、括號配對、行號。
// 節制引入（不含 autocomplete/search/lint），維持輕量。
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
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

// ── epoch timestamp 內嵌提示（與 JsonTree 的 tsHint 同規則）──
// 10 位（秒）/ 13 位（毫秒）純數字，換算年份 2001–2099 才標註，避免誤判一般 ID。
function fmtEpoch(raw: string): string | null {
  const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
  const d = new Date(ms);
  const y = d.getFullYear();
  if (y < 2001 || y > 2099) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

class TsHintWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: TsHintWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-tshint";
    span.textContent = ` ⇢ ${this.text}`;
    return span;
  }
  ignoreEvent() {
    return true;
  }
}

const tsMatcher = new MatchDecorator({
  regexp: /\b(\d{10}|\d{13})\b/g,
  decorate(add, _from, to, match) {
    const text = fmtEpoch(match[1]);
    if (text) add(to, to, Decoration.widget({ widget: new TsHintWidget(text), side: 1 }));
  },
});

const timestampHints = ViewPlugin.fromClass(
  class {
    hints: DecorationSet;
    constructor(v: EditorView) {
      this.hints = tsMatcher.createDeco(v);
    }
    update(u: ViewUpdate) {
      this.hints = tsMatcher.updateDeco(u, this.hints);
    }
  },
  { decorations: (v) => v.hints },
);

// 融入 Reqmira 暗色（覆蓋 oneDark 的背景）。
const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--fg-faint)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { caretColor: "var(--accent)" },
  // timestamp 內嵌提示：IDE inlay hint 風格的淡色註記
  ".cm-tshint": {
    color: "var(--fg-faint)",
    fontSize: "11px",
    fontStyle: "italic",
    opacity: "0.85",
  },
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
      timestampHints,
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
