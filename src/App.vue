<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { parseWorkflow } from './lib/parser'
import { buildGraphData, runLayout, mergeLayout } from './lib/graphLayout'
import { usePlayback } from './composables/usePlayback'
import { theme } from './lib/theme'
import type { ParsedWorkflow, LayoutResult, GraphNode } from './lib/types'
import GraphView from './components/GraphView.vue'
import Timeline from './components/Timeline.vue'
import Inspector from './components/Inspector.vue'

const workflow = ref<ParsedWorkflow | null>(null)
const layout = ref<LayoutResult | null>(null)
const selectedNode = ref<GraphNode | null>(null)
const errorMsg = ref('')
const fileLabel = ref('')

const totalDuration = () => workflow.value?.metadata.duration ?? 0
const { currentTime, playing, speed, togglePlay, seek, toggleSpeed } = usePlayback(totalDuration)

async function loadWorkflow(text: string, label: string) {
  try {
    errorMsg.value = ''
    const wf = parseWorkflow(text)
    workflow.value = wf
    fileLabel.value = label
    if (wf.tasks.length > 0) {
      const graphData = buildGraphData(wf)
      const elkResult = await runLayout(graphData)
      layout.value = mergeLayout(graphData, elkResult)
    } else {
      layout.value = { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 800, height: 600 } }
    }
    currentTime.value = 0
    selectedNode.value = null
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to parse workflow'
  }
}

// Load injected data on mount
onMounted(() => {
  const injected = (window as any).__TASKVIZ_DATA__
  if (injected) {
    loadWorkflow(injected, 'report')
  }
})

// Drag-and-drop / file picker
function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}

function handleFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
}

function readFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => loadWorkflow(reader.result as string, file.name)
  reader.readAsText(file)
}

function loadSample() {
  const sample = `{"taskId":"checkout","name":"Checkout","status":"completed","startTime":0,"endTime":2,"dependsOn":[]}
{"taskId":"build-fe","name":"Build Frontend","status":"completed","startTime":2,"endTime":8,"dependsOn":["checkout"]}
{"taskId":"build-be","name":"Build Backend","status":"completed","startTime":2,"endTime":10,"dependsOn":["checkout"]}
{"taskId":"test-fe","name":"Test Frontend","status":"completed","startTime":8,"endTime":14,"dependsOn":["build-fe"]}
{"taskId":"test-be","name":"Test Backend","status":"failed","startTime":10,"endTime":18,"dependsOn":["build-be"],"error":"AssertionError: expected 200 got 500"}
{"taskId":"deploy","name":"Deploy Staging","status":"skipped","startTime":18,"endTime":18,"dependsOn":["test-fe","test-be"]}`
  loadWorkflow(sample, 'demo-pipeline.jsonl')
}

const showInspector = computed(() => selectedNode.value !== null)
</script>

<template>
  <!-- Landing state -->
  <div v-if="!workflow"
    :style="{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: theme.font.mono, color: theme.fg.primary, background: theme.bg.base,
    }"
    @drop.prevent="handleDrop"
    @dragover.prevent
  >
    <div :style="{ fontSize: theme.fontSize.hero + 'px', fontWeight: 700, letterSpacing: '0.04em' }">
      TASKVIZ<span :style="{ color: theme.accent }">.</span>
    </div>
    <div :style="{ color: theme.fg.secondary, marginTop: '8px', fontSize: theme.fontSize.md + 'px' }">
      Visualize your workflow execution as a directed graph.
    </div>
    <div :style="{
      marginTop: '32px', border: '1px dashed ' + theme.border.bright, borderRadius: theme.radius.lg + 'px',
      padding: '32px 48px', textAlign: 'center', cursor: 'pointer', color: theme.fg.dim,
      fontSize: theme.fontSize.sm + 'px',
    }" @click="($refs.fileInput as HTMLInputElement)?.click()">
      Drop a .jsonl file here or click to browse
      <input ref="fileInput" type="file" accept=".jsonl,.json" :style="{ display: 'none' }" @change="handleFileInput" />
    </div>
    <div :style="{ marginTop: '16px', fontSize: theme.fontSize.sm + 'px', color: theme.fg.dim }">
      or
      <span :style="{ color: theme.accent, cursor: 'pointer', textDecoration: 'underline' }" @click="loadSample">
        load a demo
      </span>
    </div>
    <div v-if="errorMsg" :style="{ marginTop: '16px', color: '#f87171', fontSize: theme.fontSize.sm + 'px', maxWidth: '600px' }">
      {{ errorMsg }}
    </div>
  </div>

  <!-- Session loaded -->
  <div v-else :style="{
    display: 'flex', flexDirection: 'column', height: '100vh',
    fontFamily: theme.font.mono, background: theme.bg.base, color: theme.fg.primary,
  }">
    <!-- Header -->
    <div :style="{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '8px 16px', borderBottom: '1px solid ' + theme.border.subtle,
      fontSize: theme.fontSize.sm + 'px', flexShrink: 0,
    }">
      <span :style="{ fontWeight: 700, letterSpacing: '0.04em' }">TASKVIZ<span :style="{ color: theme.accent }">.</span></span>
      <span :style="{ color: theme.fg.secondary }">{{ fileLabel }}</span>
      <span :style="{ color: theme.fg.dim }">{{ workflow.metadata.totalTasks }} tasks</span>
      <span v-if="workflow.metadata.errorCount" :style="{ color: '#f87171' }">{{ workflow.metadata.errorCount }} errors</span>
      <div :style="{ flex: 1 }" />
      <span :style="{ color: theme.fg.dim, cursor: 'pointer' }" @click="workflow = null; layout = null; selectedNode = null; errorMsg = ''">✕</span>
    </div>

    <!-- Timeline -->
    <Timeline
      :current-time="currentTime"
      :total-duration="workflow.metadata.duration"
      :playing="playing"
      :speed="speed"
      :tasks="workflow.tasks"
      @seek="seek"
      @toggle-play="togglePlay"
      @toggle-speed="toggleSpeed"
    />

    <!-- Main content -->
    <div :style="{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }">
      <GraphView
        v-if="layout"
        :layout="layout"
        :current-time="currentTime"
        :selected-node="selectedNode"
        :style="{ flex: 1 }"
        @select-node="(n: GraphNode | null) => selectedNode = n"
      />

      <Inspector
        v-if="showInspector"
        :node="selectedNode!"
        :workflow="workflow"
        @close="selectedNode = null"
      />
    </div>
  </div>
</template>
