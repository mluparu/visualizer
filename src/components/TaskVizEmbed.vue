<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { parseWorkflow } from '../lib/parser'
import { buildGraphData, mergeLayout, runLayout } from '../lib/graphLayout'
import { usePlayback } from '../composables/usePlayback'
import { theme as themeTokens, themeOptions, currentThemeName, setTheme, alpha, type ThemeName } from '../lib/theme'
import type { GraphNode, LayoutResult, ParsedWorkflow, PlaybackMode } from '../lib/types'
import type { TaskVizEmbedProps } from '../lib/embedTypes'
import GraphView from './GraphView.vue'
import Timeline from './Timeline.vue'
import Inspector from './Inspector.vue'

const props = withDefaults(defineProps<TaskVizEmbedProps>(), {
  jsonlPath: '',
  jsonlText: '',
  fileLabel: '',
  theme: 'midnight',
  defaultMode: 'preview',
  autoplayWhenVisible: false,
  height: '100vh',
  showChrome: true,
  showThemePicker: true,
  showCloseButton: false,
})

const emit = defineEmits<{
  close: []
  loaded: [workflow: ParsedWorkflow]
  error: [message: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const workflow = ref<ParsedWorkflow | null>(null)
const layout = ref<LayoutResult | null>(null)
const selectedNode = ref<GraphNode | null>(null)
const errorMsg = ref('')
const loading = ref(false)
const activeFileLabel = ref(props.fileLabel)
const playbackMode = ref<PlaybackMode>(props.defaultMode)
const isVisible = ref(!props.autoplayWhenVisible)
const autoplayConsumed = ref(false)

const totalDuration = () => workflow.value?.metadata.duration ?? 0
const { currentTime, playing, speed, play, pause, togglePlay, seek, toggleSpeed } = usePlayback(totalDuration)

const controlsVisible = ref(true)
const metaExpanded = ref(true)
const metaOverlayRef = ref<HTMLElement | null>(null)
let controlsHideTimer: number | null = null
let intersectionObserver: IntersectionObserver | null = null
let loadSequence = 0

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

function handleClose() {
  pause()
  emit('close')
}

function handleThemeChange(event: Event) {
  setTheme((event.target as HTMLSelectElement).value as ThemeName)
}

function deriveFileLabel(path: string): string {
  if (!path) return 'report'

  try {
    const resolved = typeof window !== 'undefined' ? new URL(path, window.location.href) : new URL(path, 'https://example.invalid')
    const segment = resolved.pathname.split('/').filter(Boolean).pop()
    return segment || 'report'
  } catch {
    const sanitized = path.split('?')[0].split('#')[0]
    return sanitized.split('/').filter(Boolean).pop() || 'report'
  }
}

function resetLoadedState() {
  pause()
  workflow.value = null
  layout.value = null
  selectedNode.value = null
  currentTime.value = 0
  controlsVisible.value = true
  metaExpanded.value = true
  autoplayConsumed.value = false
}

async function loadWorkflowText(text: string, label: string) {
  const requestId = ++loadSequence

  try {
    loading.value = true
    errorMsg.value = ''
    resetLoadedState()

    const parsedWorkflow = parseWorkflow(text)
    let nextLayout: LayoutResult

    if (parsedWorkflow.tasks.length > 0) {
      const graphData = buildGraphData(parsedWorkflow)
      const elkResult = await runLayout(graphData)
      nextLayout = mergeLayout(graphData, elkResult)
    } else {
      nextLayout = { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 800, height: 600 } }
    }

    if (requestId !== loadSequence) return

    workflow.value = parsedWorkflow
    layout.value = nextLayout
    activeFileLabel.value = label
    emit('loaded', parsedWorkflow)
    maybeAutoplay()
  } catch (error: any) {
    if (requestId !== loadSequence) return

    resetLoadedState()
    errorMsg.value = error?.message || 'Failed to load workflow'
    activeFileLabel.value = label
    emit('error', errorMsg.value)
  } finally {
    if (requestId === loadSequence) {
      loading.value = false
    }
  }
}

async function reloadFromProps() {
  const inlineText = props.jsonlText.trim()
  const path = props.jsonlPath.trim()

  if (inlineText) {
    await loadWorkflowText(inlineText, props.fileLabel || 'report')
    return
  }

  if (!path) {
    loading.value = false
    errorMsg.value = ''
    resetLoadedState()
    activeFileLabel.value = props.fileLabel || ''
    return
  }

  const label = props.fileLabel || deriveFileLabel(path)

  try {
    loading.value = true
    errorMsg.value = ''
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow from ${path} (${response.status} ${response.statusText})`)
    }

    const text = await response.text()
    await loadWorkflowText(text, label)
  } catch (error: any) {
    resetLoadedState()
    loading.value = false
    errorMsg.value = error?.message || 'Failed to load workflow'
    activeFileLabel.value = label
    emit('error', errorMsg.value)
  }
}

function maybeAutoplay() {
  if (!props.autoplayWhenVisible || autoplayConsumed.value || !isVisible.value || !workflow.value || !layout.value) {
    return
  }

  play()
  autoplayConsumed.value = true
  revealControls()
}

watch(playing, isPlaying => {
  controlsVisible.value = true
  metaExpanded.value = !isPlaying
  if (isPlaying) scheduleControlsHide()
  else clearControlsHideTimer()
})

watch(
  () => props.defaultMode,
  mode => {
    playbackMode.value = mode
  },
  { immediate: true }
)

watch(
  () => props.theme,
  name => {
    setTheme(name)
  },
  { immediate: true }
)

watch(
  () => [props.jsonlPath, props.jsonlText, props.fileLabel],
  () => {
    void reloadFromProps()
  },
  { immediate: true }
)

watch([isVisible, workflow, layout, () => props.autoplayWhenVisible], () => {
  maybeAutoplay()
})

onMounted(() => {
  if (!props.autoplayWhenVisible) {
    isVisible.value = true
    return
  }

  if (typeof IntersectionObserver === 'undefined' || !rootRef.value) {
    isVisible.value = true
    maybeAutoplay()
    return
  }

  intersectionObserver = new IntersectionObserver(
    entries => {
      const entry = entries[0]
      isVisible.value = !!entry?.isIntersecting && entry.intersectionRatio >= 0.35
      if (isVisible.value) maybeAutoplay()
    },
    { threshold: [0, 0.35, 0.6, 1] }
  )

  intersectionObserver.observe(rootRef.value)
})

onBeforeUnmount(() => {
  clearControlsHideTimer()
  intersectionObserver?.disconnect()
})

const isReady = computed(() => workflow.value !== null && layout.value !== null)
const hasSource = computed(() => props.jsonlText.trim().length > 0 || props.jsonlPath.trim().length > 0)
const workflowTitle = computed(() => workflow.value?.metadata.title?.trim() || 'Workflow Visualizer')
const workflowDescription = computed(() => workflow.value?.metadata.description?.trim() || '')
const showInspector = computed(() => props.showChrome && selectedNode.value !== null && !playing.value)
const showBottomControls = computed(() => props.showChrome && (!playing.value || controlsVisible.value))
const isCompactMeta = computed(() => playing.value || !metaExpanded.value)

const themeSelectStyle = computed<CSSProperties>(() => ({
  background: alpha(themeTokens.bg.surface, 0.84),
  color: themeTokens.fg.primary,
  border: '1px solid ' + alpha(themeTokens.border.default, 0.95),
  borderRadius: themeTokens.radius.sm + 'px',
  padding: '4px 8px',
  fontFamily: themeTokens.font.mono,
  fontSize: themeTokens.fontSize.xs + 'px',
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}))

const shellStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  height: props.height,
  minHeight: '320px',
  overflow: 'hidden',
  fontFamily: themeTokens.font.mono,
  background: themeTokens.bg.base,
  color: themeTokens.fg.primary,
  borderRadius: themeTokens.radius.lg + 'px',
}))

const emptyStateStyle = computed<CSSProperties>(() => ({
  ...shellStyle.value,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid ' + alpha(themeTokens.border.default, 0.7),
}))

const playbackWashStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  pointerEvents: 'none',
  background: playing.value
    ? `linear-gradient(to bottom, ${alpha(themeTokens.bg.base, 0.34)} 0%, ${alpha(themeTokens.bg.base, 0.08)} 18%, transparent 34%, transparent 72%, ${alpha(themeTokens.bg.base, showBottomControls.value ? 0.28 : 0.08)} 100%)`
    : `linear-gradient(to bottom, ${alpha(themeTokens.bg.base, 0.16)} 0%, transparent 24%, transparent 72%, ${alpha(themeTokens.bg.base, 0.16)} 100%)`,
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
  border: '1px solid ' + alpha(themeTokens.border.bright, isCompactMeta.value ? 0.42 : 0.72),
  borderRadius: themeTokens.radius.lg + 'px',
  background: alpha(themeTokens.bg.overlay, isCompactMeta.value ? 0.4 : 0.72),
  boxShadow: '0 18px 40px ' + alpha(themeTokens.bg.base, isCompactMeta.value ? 0.12 : 0.34),
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
  <div ref="rootRef" :style="shellStyle">
    <div v-if="!hasSource" :style="emptyStateStyle">
      <div :style="{ textAlign: 'center', padding: '24px', maxWidth: '520px' }">
        <div :style="{ fontSize: themeTokens.fontSize.lg + 'px', fontWeight: 700 }">Workflow Visualizer is waiting for data</div>
        <div :style="{ marginTop: '8px', color: themeTokens.fg.secondary, fontSize: themeTokens.fontSize.sm + 'px' }">
          Provide a `jsonlPath` or `jsonlText` prop to render a workflow.
        </div>
      </div>
    </div>

    <div v-else-if="loading && !isReady" :style="emptyStateStyle">
      <div :style="{ textAlign: 'center', padding: '24px' }">
        <div :style="{ fontSize: themeTokens.fontSize.lg + 'px', fontWeight: 700 }">Loading workflow…</div>
        <div :style="{ marginTop: '8px', color: themeTokens.fg.secondary, fontSize: themeTokens.fontSize.sm + 'px' }">
          {{ activeFileLabel || 'Preparing visualization' }}
        </div>
      </div>
    </div>

    <div v-else-if="errorMsg && !isReady" :style="emptyStateStyle">
      <div :style="{ textAlign: 'center', padding: '24px', maxWidth: '680px' }">
        <div :style="{ fontSize: themeTokens.fontSize.lg + 'px', fontWeight: 700, color: '#fca5a5' }">Unable to load workflow</div>
        <div :style="{ marginTop: '10px', color: themeTokens.fg.secondary, fontSize: themeTokens.fontSize.sm + 'px', lineHeight: 1.5 }">
          {{ errorMsg }}
        </div>
      </div>
    </div>

    <div
      v-else-if="workflow && layout"
      :style="shellStyle"
      @mousemove="handlePlayerInteraction"
      @touchstart="handlePlayerInteraction"
      @click="handleShellClick"
    >
      <div :style="{ position: 'absolute', inset: 0, zIndex: 0 }">
        <GraphView
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
        v-if="props.showChrome"
        ref="metaOverlayRef"
        :style="{ ...metaOverlayStyle, cursor: !playing && isCompactMeta ? 'pointer' : 'default' }"
        @click.stop="handleMetaOverlayClick"
      >
        <div :style="{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: isCompactMeta ? '2px' : '8px', flex: '1 1 420px' }">
          <div :style="{
            fontSize: (isCompactMeta ? themeTokens.fontSize.lg : Math.round(themeTokens.fontSize.hero * 1.8)) + 'px',
            fontWeight: isCompactMeta ? 700 : 800,
            lineHeight: isCompactMeta ? 1.15 : 1.02,
            letterSpacing: isCompactMeta ? '-0.01em' : '-0.035em',
          }">
            {{ workflowTitle }}
          </div>
          <div
            v-if="workflowDescription"
            :style="{
              color: themeTokens.fg.secondary,
              fontSize: (isCompactMeta ? themeTokens.fontSize.sm : themeTokens.fontSize.xl) + 'px',
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
            <template v-if="props.showThemePicker">
              <span :style="{ color: themeTokens.fg.dim, fontSize: themeTokens.fontSize.xs + 'px' }">Theme</span>
              <select :value="currentThemeName" @change="handleThemeChange" :style="themeSelectStyle">
                <option v-for="option in themeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </template>
            <button
              v-if="props.showCloseButton"
              @click.stop="handleClose"
              :style="{
                background: alpha(themeTokens.bg.surface, 0.74),
                border: '1px solid ' + alpha(themeTokens.border.default, 0.9),
                color: themeTokens.fg.dim,
                borderRadius: themeTokens.radius.sm + 'px',
                cursor: 'pointer',
                padding: '3px 8px',
                fontFamily: themeTokens.font.mono,
                fontSize: themeTokens.fontSize.xs + 'px',
              }"
            >✕</button>
          </div>

          <div :style="{
            display: 'flex',
            flexDirection: isCompactMeta ? 'row' : 'column',
            alignItems: isCompactMeta ? 'center' : 'flex-start',
            gap: isCompactMeta ? '10px' : '4px',
            flexWrap: 'wrap',
            fontSize: (isCompactMeta ? themeTokens.fontSize.xs : themeTokens.fontSize.sm) + 'px',
          }">
            <span :style="{ color: themeTokens.fg.secondary }">{{ activeFileLabel }}</span>
            <div :style="{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }">
              <span :style="{ color: themeTokens.fg.dim }">{{ workflow.metadata.totalTasks }} tasks</span>
              <span v-if="workflow.metadata.errorCount" :style="{ color: '#f87171' }">{{ workflow.metadata.errorCount }} errors</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="props.showChrome" :style="controlsOverlayStyle" @click.stop>
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
  </div>
</template>
