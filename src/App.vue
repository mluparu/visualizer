<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from 'vue'
import TaskVizEmbed from './components/TaskVizEmbed.vue'
import { theme, themeOptions, currentThemeName, setTheme, alpha, type ThemeName } from './lib/theme'

const workflowText = ref('')
const fileLabel = ref('')
const errorMsg = ref('')
const pastedText = ref('')
const canOpenPastedText = computed(() => pastedText.value.trim().length > 0)

function openWorkflow(text: string, label: string) {
  workflowText.value = text
  fileLabel.value = label
  errorMsg.value = ''
}

function closeWorkflow() {
  workflowText.value = ''
  fileLabel.value = ''
  errorMsg.value = ''
}

onMounted(() => {
  const injected = window.__TASKVIZ_DATA__
  if (injected) {
    openWorkflow(injected, 'report')
  }
})

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file) readFile(file)
}

function handleFileInput(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
}

function readFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => openWorkflow(reader.result as string, file.name)
  reader.onerror = () => {
    errorMsg.value = `Failed to read ${file.name}`
  }
  reader.readAsText(file)
}

function openPastedWorkflow() {
  const text = pastedText.value.trim()
  if (!text) {
    errorMsg.value = 'Paste JSONL content first.'
    return
  }

  openWorkflow(text, 'pasted-workflow.jsonl')
}

function loadSample() {
  const sample = `{"title":"Demo CI Pipeline","description":"Parallel frontend and backend workstreams converge on tests, with one failure blocking deployment."}
{"taskId":"checkout","name":"Checkout","status":"completed","startTime":0,"endTime":2,"dependsOn":[]}
{"taskId":"build-fe","name":"Build Frontend","status":"completed","startTime":2,"endTime":8,"dependsOn":["checkout"]}
{"taskId":"build-be","name":"Build Backend","status":"completed","startTime":2,"endTime":10,"dependsOn":["checkout"]}
{"taskId":"test-fe","name":"Test Frontend","status":"completed","startTime":8,"endTime":14,"dependsOn":["build-fe"]}
{"taskId":"test-be","name":"Test Backend","status":"failed","startTime":10,"endTime":18,"dependsOn":["build-be"],"error":"AssertionError: expected 200 got 500"}
{"taskId":"deploy","name":"Deploy Staging","status":"skipped","startTime":18,"endTime":18,"dependsOn":["test-fe","test-be"]}`
  openWorkflow(sample, 'demo-pipeline.jsonl')
}

function handleThemeChange(event: Event) {
  setTheme((event.target as HTMLSelectElement).value as ThemeName)
}

const themeSelectStyle = computed<CSSProperties>(() => ({
  background: alpha(theme.bg.surface, 0.84),
  color: theme.fg.primary,
  border: '1px solid ' + alpha(theme.border.default, 0.95),
  borderRadius: theme.radius.sm + 'px',
  padding: '4px 8px',
  fontFamily: theme.font.mono,
  fontSize: theme.fontSize.xs + 'px',
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}))
</script>

<template>
  <div
    v-if="!workflowText"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '32px 16px',
      fontFamily: theme.font.mono,
      color: theme.fg.primary,
      background: theme.bg.base,
      position: 'relative',
      overflowY: 'auto',
    }"
    @drop.prevent="handleDrop"
    @dragover.prevent
  >
    <div :style="{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px' }">
      <span :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px' }">Theme</span>
      <select :value="currentThemeName" @change="handleThemeChange" :style="themeSelectStyle">
        <option v-for="option in themeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div :style="{ fontSize: theme.fontSize.hero + 'px', fontWeight: 700, letterSpacing: '0.04em' }">
      Workflow Visualizer
    </div>
    <div :style="{ color: theme.fg.secondary, marginTop: '8px', fontSize: theme.fontSize.md + 'px' }">
      Visualize your workflow execution as a directed graph.
    </div>

    <div
      :style="{
        marginTop: '32px',
        border: '1px dashed ' + theme.border.bright,
        borderRadius: theme.radius.lg + 'px',
        padding: '32px 48px',
        textAlign: 'center',
        cursor: 'pointer',
        color: theme.fg.dim,
        fontSize: theme.fontSize.sm + 'px',
      }"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
    >
      Drop a `.jsonl` file here or click to browse
      <input ref="fileInput" type="file" accept=".jsonl,.json" :style="{ display: 'none' }" @change="handleFileInput" />
    </div>

    <div :style="{ marginTop: '16px', fontSize: theme.fontSize.sm + 'px', color: theme.fg.dim }">
      or paste `.jsonl` content below, or
      <span :style="{ color: theme.accent, cursor: 'pointer', textDecoration: 'underline' }" @click="loadSample">
        load a demo
      </span>
    </div>

    <div
      :style="{
        width: 'min(720px, 100%)',
        marginTop: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }"
    >
      <textarea
        v-model="pastedText"
        :style="{
          width: '100%',
          minHeight: '180px',
          padding: '14px 16px',
          borderRadius: theme.radius.md + 'px',
          border: '1px solid ' + theme.border.default,
          background: alpha(theme.bg.surface, 0.92),
          color: theme.fg.primary,
          fontFamily: theme.font.mono,
          fontSize: theme.fontSize.sm + 'px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }"
        placeholder='Paste JSONL lines here, then click "Visualize pasted content"'
        @input="errorMsg = ''"
      />

      <div :style="{ display: 'flex', justifyContent: 'flex-end' }">
        <button
          type="button"
          :disabled="!canOpenPastedText"
          :style="{
            padding: '10px 14px',
            borderRadius: theme.radius.sm + 'px',
            border: '1px solid ' + theme.border.default,
            background: canOpenPastedText ? theme.accent : alpha(theme.bg.surface, 0.65),
            color: canOpenPastedText ? theme.bg.base : theme.fg.dim,
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm + 'px',
            cursor: canOpenPastedText ? 'pointer' : 'not-allowed',
          }"
          @click="openPastedWorkflow"
        >
          Visualize pasted content
        </button>
      </div>
    </div>

    <div v-if="errorMsg" :style="{ marginTop: '16px', color: '#f87171', fontSize: theme.fontSize.sm + 'px', maxWidth: '720px' }">
      {{ errorMsg }}
    </div>
  </div>

  <TaskVizEmbed
    v-else
    :jsonl-text="workflowText"
    :file-label="fileLabel"
    :theme="currentThemeName"
    default-mode="preview"
    :autoplay-when-visible="false"
    height="100vh"
    :show-close-button="true"
    @close="closeWorkflow"
  />
</template>
