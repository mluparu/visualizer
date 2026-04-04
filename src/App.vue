<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, type CSSProperties } from 'vue'
import { parseWorkflow } from './lib/parser'
import { buildGraphData, runLayout, mergeLayout } from './lib/graphLayout'
import { usePlayback } from './composables/usePlayback'
import { theme, themeOptions, currentThemeName, setTheme, alpha, type ThemeName } from './lib/theme'
import type { ParsedWorkflow, LayoutResult, GraphNode, PlaybackMode } from './lib/types'
import GraphView from './components/GraphView.vue'
import Timeline from './components/Timeline.vue'
import Inspector from './components/Inspector.vue'

const workflow = ref<ParsedWorkflow | null>(null)
const layout = ref<LayoutResult | null>(null)
const selectedNode = ref<GraphNode | null>(null)
const errorMsg = ref('')
const fileLabel = ref('')
const playbackMode = ref<PlaybackMode>('preview')

const totalDuration = () => workflow.value?.metadata.duration ?? 0
const { currentTime, playing, speed, pause, togglePlay, seek, toggleSpeed } = usePlayback(totalDuration)

const controlsVisible = ref(true)
const metaExpanded = ref(true)
const metaOverlayRef = ref<HTMLElement | null>(null)
let controlsHideTimer: number | null = null

function clearControlsHideTimer() {
  if (controlsHideTimer !== null) {
    window.clearTimeout(controlsHideTimer)
    controlsHideTimer = null
  }
}

function scheduleControlsHide() {
  clearControlsHideTimer()
  if (!playing.value) {
    controlsVisible.value = true
    return
  }

  controlsHideTimer = window.setTimeout(() => {
    controlsVisible.value = false
  }, 2400)
}

function revealControls() {
  controlsVisible.value = true
  scheduleControlsHide()
}

function handlePlayerInteraction() {
  revealControls()
}

function handleShellClick(event: MouseEvent) {
  revealControls()

  if (
    !playing.value &&
    metaExpanded.value &&
    metaOverlayRef.value &&
    event.target instanceof Node &&
    !metaOverlayRef.value.contains(event.target)
  ) {
    metaExpanded.value = false
  }
}

function handleMetaOverlayClick() {
  revealControls()

  if (!playing.value && !metaExpanded.value) {
    metaExpanded.value = true
  }
}

function handleTogglePlay() {
  togglePlay()
  metaExpanded.value = !playing.value
  revealControls()
}

function handleSeek(time: number) {
  seek(time)
  revealControls()
}

function handleToggleSpeed() {
  toggleSpeed()
  revealControls()
}

function handleToggleMode() {
  playbackMode.value = playbackMode.value === 'preview' ? 'reveal' : 'preview'
  revealControls()
}

function handleNodeSelection(node: GraphNode | null) {
  selectedNode.value = node
  revealControls()
}

function closeWorkflow() {
  pause()
  workflow.value = null
  layout.value = null
  selectedNode.value = null
  errorMsg.value = ''
  controlsVisible.value = true
  clearControlsHideTimer()
}

watch(playing, (isPlaying) => {
  controlsVisible.value = true
  metaExpanded.value = !isPlaying
  if (isPlaying) scheduleControlsHide()
  else clearControlsHideTimer()
})

onBeforeUnmount(() => {
  clearControlsHideTimer()
})

async function loadWorkflow(text: string, label: string) {
  try {
    errorMsg.value = ''
    pause()
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
    controlsVisible.value = true
    metaExpanded.value = true
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to parse workflow'
  }
}

onMounted(() => {
  const injected = (window as any).__TASKVIZ_DATA__
  if (injected) {
    loadWorkflow(injected, 'report')
  }
})

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
  const sample = `{"title":"Demo CI Pipeline","description":"Parallel frontend and backend workstreams converge on tests, with one failure blocking deployment."}
{"taskId":"checkout","name":"Checkout","status":"completed","startTime":0,"endTime":2,"dependsOn":[]}
{"taskId":"build-fe","name":"Build Frontend","status":"completed","startTime":2,"endTime":8,"dependsOn":["checkout"]}
{"taskId":"build-be","name":"Build Backend","status":"completed","startTime":2,"endTime":10,"dependsOn":["checkout"]}
{"taskId":"test-fe","name":"Test Frontend","status":"completed","startTime":8,"endTime":14,"dependsOn":["build-fe"]}
{"taskId":"test-be","name":"Test Backend","status":"failed","startTime":10,"endTime":18,"dependsOn":["build-be"],"error":"AssertionError: expected 200 got 500"}
{"taskId":"deploy","name":"Deploy Staging","status":"skipped","startTime":18,"endTime":18,"dependsOn":["test-fe","test-be"]}`
  loadWorkflow(sample, 'demo-pipeline.jsonl')
}

function handleThemeChange(e: Event) {
  setTheme((e.target as HTMLSelectElement).value as ThemeName)
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

const workflowTitle = computed(() => workflow.value?.metadata.title?.trim() || 'TASKVIZ')
const workflowDescription = computed(() => workflow.value?.metadata.description?.trim() || '')
const showInspector = computed(() => selectedNode.value !== null && !playing.value)
const showBottomControls = computed(() => !playing.value || controlsVisible.value)
const isCompactMeta = computed(() => playing.value || !metaExpanded.value)

const playerShellStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  height: '100vh',
  overflow: 'hidden',
  fontFamily: theme.font.mono,
  background: theme.bg.base,
  color: theme.fg.primary,
}))

const playbackWashStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  pointerEvents: 'none',
  background: playing.value
    ? `linear-gradient(to bottom, ${alpha(theme.bg.base, 0.34)} 0%, ${alpha(theme.bg.base, 0.08)} 18%, transparent 34%, transparent 72%, ${alpha(theme.bg.base, showBottomControls.value ? 0.28 : 0.08)} 100%)`
    : `linear-gradient(to bottom, ${alpha(theme.bg.base, 0.16)} 0%, transparent 24%, transparent 72%, ${alpha(theme.bg.base, 0.16)} 100%)`,
  transition: 'background 0.22s ease',
}))

const metaOverlayStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  top: '16px',
  left: '16px',
  right: '16px',
  zIndex: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: isCompactMeta.value ? 'center' : 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  padding: isCompactMeta.value ? '10px 12px' : '18px 20px',
  border: '1px solid ' + alpha(theme.border.bright, isCompactMeta.value ? 0.42 : 0.72),
  borderRadius: theme.radius.lg + 'px',
  background: alpha(theme.bg.overlay, isCompactMeta.value ? 0.4 : 0.72),
  boxShadow: '0 18px 40px ' + alpha(theme.bg.base, isCompactMeta.value ? 0.12 : 0.34),
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  transition: 'all 0.22s ease',
}))

const controlsOverlayStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  left: '16px',
  right: '16px',
  bottom: '16px',
  zIndex: 24,
  opacity: showBottomControls.value ? 1 : 0,
  transform: `translateY(${showBottomControls.value ? 0 : 12}px)`,
  pointerEvents: showBottomControls.value ? 'auto' : 'none',
  transition: 'opacity 0.2s ease, transform 0.2s ease',
}))

const inspectorOverlayStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  top: isCompactMeta.value ? '72px' : '124px',
  right: '16px',
  bottom: showBottomControls.value ? '96px' : '16px',
  zIndex: 22,
  pointerEvents: 'auto',
  transition: 'all 0.22s ease',
}))
</script>

<template>
  <!-- Landing state -->
  <div v-if="!workflow"
    :style="{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: theme.font.mono, color: theme.fg.primary, background: theme.bg.base,
      position: 'relative',
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
  <div
    v-else
    :style="playerShellStyle"
    @mousemove="handlePlayerInteraction"
    @touchstart="handlePlayerInteraction"
    @click="handleShellClick"
  >
    <div :style="{ position: 'absolute', inset: 0, zIndex: 0 }">
      <GraphView
        v-if="layout"
        :layout="layout"
        :current-time="currentTime"
        :selected-node="selectedNode"
        :playback-mode="playbackMode"
        :style="{ width: '100%', height: '100%' }"
        @select-node="handleNodeSelection"
      />
    </div>

    <div :style="playbackWashStyle" />

    <div
      ref="metaOverlayRef"
      :style="{ ...metaOverlayStyle, cursor: !playing && isCompactMeta ? 'pointer' : 'default' }"
      @click.stop="handleMetaOverlayClick"
    >
      <div :style="{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: isCompactMeta ? '2px' : '8px', flex: '1 1 420px' }">
        <div :style="{
          fontSize: (isCompactMeta ? theme.fontSize.lg : Math.round(theme.fontSize.hero * 1.8)) + 'px',
          fontWeight: isCompactMeta ? 700 : 800,
          lineHeight: isCompactMeta ? 1.15 : 1.02,
          letterSpacing: isCompactMeta ? '-0.01em' : '-0.035em',
        }">
          {{ workflowTitle }}
        </div>
        <div
          v-if="workflowDescription"
          :style="{
            color: theme.fg.secondary,
            fontSize: (isCompactMeta ? theme.fontSize.sm : theme.fontSize.xl) + 'px',
            lineHeight: isCompactMeta ? 1.3 : 1.35,
            maxWidth: isCompactMeta ? '720px' : '840px',
            whiteSpace: isCompactMeta ? 'nowrap' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }"
        >
          {{ workflowDescription }}
        </div>
      </div>

      <div :style="{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isCompactMeta ? 'flex-end' : 'flex-start',
        gap: isCompactMeta ? '6px' : '10px',
        flex: '0 1 auto',
      }">
        <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }">
          <span :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px' }">Theme</span>
          <select :value="currentThemeName" @change="handleThemeChange" :style="themeSelectStyle">
            <option v-for="option in themeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <button
            @click="closeWorkflow"
            :style="{
              background: alpha(theme.bg.surface, 0.74),
              border: '1px solid ' + alpha(theme.border.default, 0.9),
              color: theme.fg.dim,
              borderRadius: theme.radius.sm + 'px',
              cursor: 'pointer',
              padding: '3px 8px',
              fontFamily: theme.font.mono,
              fontSize: theme.fontSize.xs + 'px',
            }"
          >✕</button>
        </div>

        <div :style="{
          display: 'flex',
          flexDirection: isCompactMeta ? 'row' : 'column',
          alignItems: isCompactMeta ? 'center' : 'flex-start',
          gap: isCompactMeta ? '10px' : '4px',
          flexWrap: 'wrap',
          fontSize: (isCompactMeta ? theme.fontSize.xs : theme.fontSize.sm) + 'px',
        }">
          <span :style="{ color: theme.fg.secondary }">{{ fileLabel }}</span>
          <div :style="{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }">
            <span :style="{ color: theme.fg.dim }">{{ workflow.metadata.totalTasks }} tasks</span>
            <span v-if="workflow.metadata.errorCount" :style="{ color: '#f87171' }">{{ workflow.metadata.errorCount }} errors</span>
          </div>
        </div>
      </div>
    </div>

    <div :style="controlsOverlayStyle" @click.stop>
      <Timeline
        :current-time="currentTime"
        :total-duration="workflow.metadata.duration"
        :playing="playing"
        :speed="speed"
        :tasks="workflow.tasks"
        :playback-mode="playbackMode"
        @seek="handleSeek"
        @toggle-play="handleTogglePlay"
        @toggle-speed="handleToggleSpeed"
        @toggle-mode="handleToggleMode"
      />
    </div>

    <div v-if="showInspector" :style="inspectorOverlayStyle">
      <Inspector
        :node="selectedNode!"
        :workflow="workflow"
        @close="selectedNode = null"
      />
    </div>
  </div>
</template>
