<script setup lang="ts">
// Flow Runner 模態：呈現步驟、執行、逐步結果（狀態 / 通過 / 抽取 / 斷言）。
import { computed } from "vue";
import { useFlowRunnerStore } from "../../shared/stores/flowRunner";

const runner = useFlowRunnerStore();

const summary = computed(() => {
  const rs = runner.results;
  if (!rs.length) return null;
  const passed = rs.filter((r) => r.passed).length;
  return { passed, total: rs.length, allPass: passed === rs.length && !rs.some((r) => r.error) };
});

function fmtVal(v: unknown): string {
  if (v === undefined) return "（無）";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
</script>

<template>
  <div v-if="runner.openPath" class="overlay" @click.self="runner.close()">
    <div class="modal">
      <header class="m-head">
        <div>
          <h3>{{ runner.currentFlow?.name ?? "Flow" }}</h3>
          <p v-if="runner.currentFlow?.description" class="dim desc">{{ runner.currentFlow.description }}</p>
        </div>
        <div class="m-actions">
          <button class="primary" :disabled="runner.running || !runner.currentFlow" @click="runner.run()">
            {{ runner.running ? "執行中…" : "▶ 執行" }}
          </button>
          <button @click="runner.close()">關閉</button>
        </div>
      </header>

      <div v-if="summary" class="runsum" :class="summary.allPass ? 'ok' : 'fail'">
        {{ summary.allPass ? "✓ 全部通過" : "✗ 有步驟未通過" }} · {{ summary.passed }}/{{ summary.total }} 步驟通過
      </div>

      <div class="m-body">
        <!-- 尚未執行：列出步驟 -->
        <ol v-if="!runner.results.length && runner.currentFlow" class="steps">
          <li v-for="(s, i) in runner.currentFlow.steps" :key="i" class="step-def">
            <span class="sname">{{ s.name }}</span>
            <span class="sreq mono dim">{{ s.request }}</span>
          </li>
        </ol>

        <!-- 執行結果 -->
        <div v-for="(r, i) in runner.results" :key="i" class="res" :class="{ failed: !r.passed }">
          <div class="res-head">
            <span class="badge" :class="r.passed ? 'ok' : 'bad'">{{ r.passed ? "✓" : "✗" }}</span>
            <span class="sname">{{ i + 1 }}. {{ r.name }}</span>
            <span v-if="r.status" class="rstat mono" :class="r.status < 400 ? 'good' : 'bad'">{{ r.status }}</span>
            <span v-if="r.durationMs != null" class="dim small">{{ r.durationMs }} ms</span>
          </div>
          <p v-if="r.error" class="err small">⚠ {{ r.error }}</p>
          <p v-if="r.finalUrl" class="dim small mono url">{{ r.finalUrl }}</p>

          <div v-if="Object.keys(r.extracted).length" class="sub">
            <span class="lbl">抽取</span>
            <span v-for="(v, k) in r.extracted" :key="k" class="chip mono">{{ k }} = {{ v }}</span>
          </div>

          <div v-if="r.asserts.length" class="sub asserts">
            <span class="lbl">斷言</span>
            <div v-for="(a, j) in r.asserts" :key="j" class="arow" :class="a.passed ? 'pass' : 'failx'">
              <span class="amark">{{ a.passed ? "✓" : "✗" }}</span>
              <span class="mono akey">{{ a.key }}</span>
              <span class="dim">期望 {{ fmtVal(a.expected) }}</span>
              <span v-if="!a.passed" class="bad">實得 {{ fmtVal(a.actual) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 9, 18, 0.6);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(760px, 92vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.m-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.m-head h3 {
  margin: 0;
  font-size: 17px;
  color: var(--accent);
}
.desc {
  margin: 4px 0 0;
  font-size: 12.5px;
}
.m-actions {
  display: flex;
  gap: 8px;
}
.runsum {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
}
.runsum.ok {
  background: rgba(95, 211, 141, 0.12);
  color: var(--good);
}
.runsum.fail {
  background: rgba(229, 119, 138, 0.12);
  color: var(--bad);
}
.m-body {
  padding: 14px 20px;
  overflow-y: auto;
}
.steps {
  margin: 0;
  padding-left: 20px;
}
.step-def {
  margin: 6px 0;
}
.step-def .sname {
  font-weight: 600;
}
.sreq {
  margin-left: 8px;
  font-size: 12px;
}
.res {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.res.failed {
  border-color: rgba(229, 119, 138, 0.4);
}
.res-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.badge {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}
.badge.ok {
  background: rgba(95, 211, 141, 0.2);
  color: var(--good);
}
.badge.bad {
  background: rgba(229, 119, 138, 0.2);
  color: var(--bad);
}
.sname {
  flex: 1;
}
.rstat.good {
  color: var(--good);
}
.rstat.bad {
  color: var(--bad);
}
.small {
  font-size: 11.5px;
}
.url {
  word-break: break-all;
  margin: 4px 0 0;
}
.sub {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.lbl {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-faint);
}
.chip {
  font-size: 11.5px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 9px;
  color: var(--accent-2);
}
.asserts {
  flex-direction: column;
  align-items: stretch;
}
.arow {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12.5px;
}
.arow .amark {
  width: 14px;
}
.arow.pass .amark {
  color: var(--good);
}
.arow.failx .amark {
  color: var(--bad);
}
.akey {
  color: var(--accent);
}
.err {
  color: var(--bad);
}
</style>
