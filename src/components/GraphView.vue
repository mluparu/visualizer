<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { LayoutResult, GraphNode, EdgeSection, PlaybackMode, ViewportMode, GraphBounds } from '../lib/types'
import { theme, statusColors, statusBgColors, taskProgressColor, alpha, emphasize } from '../lib/theme'
import { getGraphBounds } from '../lib/graphLayout'

const props = defineProps<{
  layout: LayoutResult
  currentTime: number
  selectedNode: GraphNode | null
  playbackMode: PlaybackMode
  viewportMode: ViewportMode
  followSmoothing?: number
  toolbarBottomOffset?: number
}>()

const emit = defineEmits<{
  selectNode: [node: GraphNode | null]
  changeViewportMode: [mode: ViewportMode]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const viewBox = ref<GraphBounds>({ x: 0, y: 0, width: 800, height: 600 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0, vbX: 0, vbY: 0 })
const followTarget = ref<GraphBounds | null>(null)
const lastFollowBounds = ref<GraphBounds | null>(null)
const followUserScale = ref(1)
const followUserOffset = ref({ x: 0, y: 0 })
let followFrameId: number | null = null

const DEFAULT_FOLLOW_SMOOTHING = 0.1
const FOLLOW_EPSILON = 0.45
const FOLLOW_MIN_WIDTH = 560
const FOLLOW_MIN_HEIGHT = 360

const followLerp = computed(() => {
  const value = Number(props.followSmoothing ?? DEFAULT_FOLLOW_SMOOTHING)
  if (!Number.isFinite(value)) return DEFAULT_FOLLOW_SMOOTHING
  return Math.min(Math.max(value, 0.02), 0.5)
})

function cloneBounds(bounds: GraphBounds): GraphBounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

function resetFollowAdjustments() {
  followUserScale.value = 1
  followUserOffset.value = { x: 0, y: 0 }
}

function applyFollowAdjustments(bounds: GraphBounds): GraphBounds {
  const width = Math.max(bounds.width * followUserScale.value, 1)
  const height = Math.max(bounds.height * followUserScale.value, 1)
  const centerX = bounds.x + bounds.width / 2 + followUserOffset.value.x
  const centerY = bounds.y + bounds.height / 2 + followUserOffset.value.y

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
}

function syncFollowAdjustmentsFromViewBox(nextViewBox: GraphBounds, baseBounds: GraphBounds) {
  const baseCenterX = baseBounds.x + baseBounds.width / 2
  const baseCenterY = baseBounds.y + baseBounds.height / 2
  const nextCenterX = nextViewBox.x + nextViewBox.width / 2
  const nextCenterY = nextViewBox.y + nextViewBox.height / 2

  followUserScale.value = Math.max(nextViewBox.width / Math.max(baseBounds.width, 1), 0.1)
  followUserOffset.value = {
    x: nextCenterX - baseCenterX,
    y: nextCenterY - baseCenterY,
  }
}

function stopFollowAnimation() {
  if (followFrameId !== null) {
    cancelAnimationFrame(followFrameId)
    followFrameId = null
  }
}

function boundsDistance(a: GraphBounds, b: GraphBounds): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  )
}

function normalizeBoundsForViewport(bounds: GraphBounds): GraphBounds {
  const svgEl = svgRef.value
  const aspectRatio = svgEl && svgEl.clientWidth > 0 && svgEl.clientHeight > 0
    ? svgEl.clientWidth / svgEl.clientHeight
    : 16 / 9

  let x = bounds.x
  let y = bounds.y
  let width = Math.max(bounds.width, FOLLOW_MIN_WIDTH)
  let height = Math.max(bounds.height, FOLLOW_MIN_HEIGHT)

  if (width !== bounds.width) x -= (width - bounds.width) / 2
  if (height !== bounds.height) y -= (height - bounds.height) / 2

  const boundsRatio = width / height
  if (boundsRatio > aspectRatio) {
    const adjustedHeight = width / aspectRatio
    y -= (adjustedHeight - height) / 2
    height = adjustedHeight
  } else {
    const adjustedWidth = height * aspectRatio
    x -= (adjustedWidth - width) / 2
    width = adjustedWidth
  }

  return { x, y, width, height }
}

function applyViewBoxTarget(bounds: GraphBounds, immediate = false) {
  followTarget.value = cloneBounds(bounds)

  if (immediate) {
    stopFollowAnimation()
    viewBox.value = cloneBounds(bounds)
    return
  }

  if (followFrameId !== null) return

  const step = () => {
    const target = followTarget.value
    if (!target) {
      followFrameId = null
      return
    }

    const current = viewBox.value
    const next = {
      x: current.x + (target.x - current.x) * followLerp.value,
      y: current.y + (target.y - current.y) * followLerp.value,
      width: current.width + (target.width - current.width) * followLerp.value,
      height: current.height + (target.height - current.height) * followLerp.value,
    }

    if (boundsDistance(next, target) <= FOLLOW_EPSILON) {
      viewBox.value = cloneBounds(target)
      followFrameId = null
      return
    }

    viewBox.value = next
    followFrameId = requestAnimationFrame(step)
  }

  followFrameId = requestAnimationFrame(step)
}

function fitView() {
  followTarget.value = null
  stopFollowAnimation()
  viewBox.value = normalizeBoundsForViewport(props.layout.bounds)
}

function stopFollowing() {
  lastFollowBounds.value = null
  followTarget.value = null
  resetFollowAdjustments()
  stopFollowAnimation()
  emit('changeViewportMode', 'fit')
}

function isNodeActive(node: GraphNode): boolean {
  return props.currentTime >= node.startTime && props.currentTime <= node.endTime
}

function isNodeFuture(node: GraphNode): boolean {
  return props.currentTime < node.startTime
}

function isNodePast(node: GraphNode): boolean {
  return props.currentTime > node.endTime
}

function flattenedTaskNodes(): GraphNode[] {
  const nodes: GraphNode[] = []

  for (const node of props.layout.nodes) {
    if (node.type === 'task') {
      nodes.push(node)
    }

    if (node.children?.length) {
      for (const child of node.children) {
        nodes.push({
          ...child,
          x: node.x + child.x,
          y: node.y + child.y,
        })
      }
    }
  }

  return nodes.filter(node => node.type === 'task')
}

const activeFollowNodes = computed(() => flattenedTaskNodes().filter(node => isNodeActive(node)))
const activeFollowSignature = computed(() => activeFollowNodes.value.map(node => node.id).sort().join('|'))

function resolveFollowBounds(): GraphBounds {
  if (activeFollowNodes.value.length === 0) {
    return lastFollowBounds.value ?? normalizeBoundsForViewport(props.layout.bounds)
  }

  const nextBounds = normalizeBoundsForViewport(getGraphBounds(activeFollowNodes.value))
  lastFollowBounds.value = nextBounds
  return nextBounds
}

function updateFollowTarget(immediate = false) {
  if (props.viewportMode !== 'follow') return
  applyViewBoxTarget(applyFollowAdjustments(resolveFollowBounds()), immediate)
}

watch(() => props.layout, () => {
  fitView()
  if (props.viewportMode === 'follow') {
    updateFollowTarget(false)
  }
}, { immediate: true })

watch(() => props.viewportMode, mode => {
  if (mode === 'follow') {
    updateFollowTarget(false)
    return
  }

  followTarget.value = null
  stopFollowAnimation()
})

watch(activeFollowSignature, () => {
  updateFollowTarget(false)
})

onMounted(() => {
  fitView()
  if (props.viewportMode === 'follow') {
    updateFollowTarget(false)
  }
})

onBeforeUnmount(() => {
  stopFollowAnimation()
})

function onWheel(e: WheelEvent) {
  e.preventDefault()

  const factor = e.deltaY > 0 ? 1.1 : 0.9
  const svgEl = svgRef.value
  if (!svgEl) return

  const rect = svgEl.getBoundingClientRect()
  const mx = (e.clientX - rect.left) / rect.width
  const my = (e.clientY - rect.top) / rect.height

  const vb = viewBox.value
  const newW = vb.width * factor
  const newH = vb.height * factor
  const nextViewBox = {
    x: vb.x - (newW - vb.width) * mx,
    y: vb.y - (newH - vb.height) * my,
    width: newW,
    height: newH,
  }

  viewBox.value = nextViewBox

  if (props.viewportMode === 'follow') {
    syncFollowAdjustmentsFromViewBox(nextViewBox, resolveFollowBounds())
    applyViewBoxTarget(applyFollowAdjustments(resolveFollowBounds()), true)
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return

  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY, vbX: viewBox.value.x, vbY: viewBox.value.y }
}

function onMouseMove(e: MouseEvent) {
  if (!isPanning.value || !svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const dx = (e.clientX - panStart.value.x) / rect.width * viewBox.value.width
  const dy = (e.clientY - panStart.value.y) / rect.height * viewBox.value.height
  const nextViewBox = { ...viewBox.value, x: panStart.value.vbX - dx, y: panStart.value.vbY - dy }
  viewBox.value = nextViewBox

  if (props.viewportMode === 'follow') {
    syncFollowAdjustmentsFromViewBox(nextViewBox, resolveFollowBounds())
  }
}

function onMouseUp() {
  isPanning.value = false
}

function showsExecutionBorder(node: GraphNode): boolean {
  if (node.type !== 'task' || !node.status) return false
  if (node.status === 'pending' || node.status === 'skipped') return false
  return !isNodeFuture(node)
}

function executionProgress(node: GraphNode): number {
  if (!showsExecutionBorder(node)) return 0
  if (isNodePast(node)) return 1

  const duration = node.endTime - node.startTime
  if (duration <= 0) return props.currentTime >= node.startTime ? 1 : 0

  return Math.max(0, Math.min(1, (props.currentTime - node.startTime) / duration))
}

function hasAnimatedExecutionBorder(node: GraphNode): boolean {
  return isNodeActive(node) && executionProgress(node) < 1
}

function executionBorderColor(node: GraphNode): string {
  const base = props.selectedNode?.id === node.id ? theme.accent : nodeColor(node)
  return alpha(base, isNodeActive(node) ? 0.95 : 0.78)
}

function executionClipId(node: GraphNode): string {
  const safeId = node.id.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `execution-clip-${safeId}`
}

function executionBorderInset(node: GraphNode): number {
  return node.height <= 40 ? 1 : 1.5
}

function executionBorderWidth(node: GraphNode): number {
  return node.height <= 40 ? 2.2 : 3.2
}

function nodeOpacity(node: GraphNode): number {
  if (isNodeActive(node)) return 1
  if (props.playbackMode === 'reveal') return isNodeFuture(node) ? 0.18 : 0.58
  if (isNodeFuture(node)) return 0.25
  return 0.72
}

function isNodeVisible(node: GraphNode): boolean {
  if (props.playbackMode === 'preview') return true
  return !isNodeFuture(node)
}

function isEdgeVisible(edge: { targets: string[]; activationTime: number }): boolean {
  if (props.playbackMode === 'preview') return true
  const targetId = edge.targets[0]
  const targetNode = props.layout.nodes.find(n => n.id === targetId)
  if (!targetNode) return true
  return !isNodeFuture(targetNode)
}

function isHighlightedTask(node: GraphNode): boolean {
  return node.type !== 'start' && node.type !== 'end' && isNodeActive(node)
}

function baseNodeColor(node: GraphNode): string {
  if (node.type === 'fork' || node.type === 'join') return '#f59e0b'
  if (node.type === 'start' || node.type === 'end') return theme.fg.dim
  if (node.status) return statusColors[node.status]
  return theme.fg.secondary
}

function nodeColor(node: GraphNode): string {
  const base = baseNodeColor(node)
  return isHighlightedTask(node) ? emphasize(base, 0.28) : base
}

function nodeBg(node: GraphNode): string {
  if (node.type === 'fork' || node.type === 'join') {
    return alpha(nodeColor(node), isHighlightedTask(node) ? 0.24 : 0.15)
  }
  if (node.type === 'start' || node.type === 'end') return theme.bg.surface
  if (node.status && isHighlightedTask(node)) return alpha(nodeColor(node), 0.2)
  if (node.status) return statusBgColors[node.status]
  return theme.bg.surface
}

function edgePath(sections: EdgeSection[] | undefined | null): string {
  if (!sections || sections.length === 0) return ''
  const s = sections[0]
  let d = `M ${s.startPoint.x} ${s.startPoint.y}`
  if (s.bendPoints) {
    for (const bp of s.bendPoints) {
      d += ` L ${bp.x} ${bp.y}`
    }
  }
  d += ` L ${s.endPoint.x} ${s.endPoint.y}`
  return d
}

function isEdgeActive(edge: { activationTime: number }): boolean {
  return props.currentTime >= edge.activationTime
}

function onNodeClick(node: GraphNode, e: MouseEvent) {
  e.stopPropagation()
  if (node.type === 'start' || node.type === 'end') return
  emit('selectNode', node)
}

function onBgClick() {
  emit('selectNode', null)
}

function handleFitButton() {
  stopFollowing()
  fitView()
}

function toggleFollowMode() {
  if (props.viewportMode === 'follow') {
    stopFollowing()
    return
  }

  resetFollowAdjustments()
  emit('changeViewportMode', 'follow')
  applyViewBoxTarget(applyFollowAdjustments(resolveFollowBounds()), false)
}

function cachePercent(node: GraphNode): number {
  if (node.prompt_tokens == null || node.prompt_tokens === 0) return 0
  return Math.round(((node.cached_tokens ?? 0) / node.prompt_tokens) * 100)
}

function taskBaseY(node: GraphNode): number {
  // The vertical center for the label row
  return node.prompt_cache_key || node.prompt_tokens != null ? 18 : node.height / 2
}

function formatCompactNumber(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function formatDuration(node: GraphNode): string {
  return `${formatCompactNumber(Math.max(0, node.endTime - node.startTime), 1)}s`
}

function formatTtft(node: GraphNode): string {
  if (node.ttft == null) return ''
  return `TTFT: ${formatCompactNumber(node.ttft, 1)}s`
}

function formatCost(node: GraphNode): string {
  if (node.cost == null) return ''
  return `$${formatCompactNumber(node.cost, 2)}`
}

const viewBoxStr = computed(() => {
  const vb = viewBox.value
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
})
</script>

<template>
  <div :style="{ position: 'relative', width: '100%', height: '100%' }">
    <svg
      ref="svgRef"
      :viewBox="viewBoxStr"
      :style="{
        width: '100%', height: '100%', background: theme.bg.base, cursor: isPanning ? 'grabbing' : 'grab',
        display: 'block',
      }"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @click="onBgClick"
    >
    <defs>
      <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feColorMatrix type="matrix"
          values="0.3 0 0 0 0.2
                  0.3 0 0 0 0.4
                  1   0 0 0 0.8
                  0   0 0 0.6 0"
          in="blur" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Edges -->
    <g v-for="edge in layout.edges" :key="edge.id"
      :style="{ transition: 'opacity 0.3s ease' }"
    >
      <path
        v-if="edge.sections && isEdgeVisible(edge)"
        :d="edgePath(edge.sections)"
        fill="none"
        :stroke="isEdgeActive(edge) ? theme.accent : theme.border.default"
        :stroke-width="isEdgeActive(edge) ? 2 : 1.5"
        :opacity="isEdgeActive(edge) ? 1 : 0.3"
        stroke-linecap="round"
      />
    </g>

    <!-- Nodes -->
    <g v-for="node in layout.nodes" :key="node.id"
      v-show="isNodeVisible(node)"
      :transform="`translate(${node.x}, ${node.y})`"
      :opacity="nodeOpacity(node)"
      :style="{ cursor: (node.type === 'start' || node.type === 'end') ? 'default' : 'pointer', transition: 'opacity 0.3s ease' }"
      @click="onNodeClick(node, $event)"
    >
      <!-- Start/End: circle -->
      <template v-if="node.type === 'start' || node.type === 'end'">
        <circle
          :cx="node.width / 2" :cy="node.height / 2" :r="10"
          :fill="node.type === 'start' ? alpha(theme.accent, 0.2) : alpha(theme.fg.dim, 0.2)"
          :stroke="node.type === 'start' ? theme.accent : theme.fg.dim"
          stroke-width="2"
        />
        <circle v-if="node.type === 'end'"
          :cx="node.width / 2" :cy="node.height / 2" :r="6"
          :fill="theme.fg.dim"
        />
      </template>

      <!-- Fork/Join: diamond -->
      <template v-else-if="node.type === 'fork' || node.type === 'join'">
        <polygon
          :points="`${node.width/2},0 ${node.width},${node.height/2} ${node.width/2},${node.height} 0,${node.height/2}`"
          :fill="nodeBg(node)"
          :stroke="nodeColor(node)"
          stroke-width="1.5"
          :filter="isNodeActive(node) ? 'url(#activeGlow)' : undefined"
        />
        <text
          :x="node.width / 2" :y="node.height / 2 + 4"
          text-anchor="middle"
          :fill="nodeColor(node)"
          :font-size="theme.fontSize.xs"
          :font-family="theme.font.mono"
        >
          {{ node.type === 'fork' ? '⊜' : '⋈' }}
        </text>
      </template>

      <!-- Compound node -->
      <template v-else-if="node.type === 'compound'">
        <rect
          :width="node.width" :height="node.height"
          :rx="theme.radius.lg" :ry="theme.radius.lg"
          :fill="theme.bg.raised"
          :stroke="selectedNode?.id === node.id ? theme.accent : theme.border.bright"
          stroke-width="1.5"
          stroke-dasharray="6 3"
          :filter="isNodeActive(node) ? 'url(#activeGlow)' : undefined"
        />
        <text
          :x="12" :y="20"
          :fill="nodeColor(node)"
          :font-size="theme.fontSize.sm"
          :font-family="theme.font.mono"
          font-weight="600"
        >
          {{ node.label }}
        </text>
        <text v-if="node.cost != null"
          :x="12"
          :y="node.height - (node.ttft != null ? 18 : 10)"
          :fill="theme.fg.primary"
          :font-size="theme.fontSize.md"
          :font-family="theme.font.mono"
          font-weight="700"
        >{{ formatCost(node) }}</text>
        <text
          :x="node.width - 12"
          :y="node.height - (node.ttft != null ? 18 : 10)"
          text-anchor="end"
          :fill="theme.fg.primary"
          :font-size="theme.fontSize.md"
          :font-family="theme.font.mono"
          font-weight="700"
        >{{ formatDuration(node) }}</text>
        <text v-if="node.ttft != null"
          :x="node.width - 12"
          :y="node.height - 6"
          text-anchor="end"
          :fill="theme.fg.secondary"
          :font-size="theme.fontSize.xs"
          :font-family="theme.font.mono"
        >{{ formatTtft(node) }}</text>
        <!-- Child nodes inside compound -->
        <g v-if="node.children" v-for="child in node.children" :key="child.id"
          v-show="isNodeVisible(child)"
          :transform="`translate(${child.x}, ${child.y})`"
          :opacity="nodeOpacity(child)"
          :style="{ cursor: 'pointer', transition: 'opacity 0.3s ease' }"
          @click="onNodeClick(child, $event)"
        >
          <defs v-if="showsExecutionBorder(child) && hasAnimatedExecutionBorder(child)">
            <clipPath :id="executionClipId(child)" clipPathUnits="objectBoundingBox">
              <rect x="0" y="0" :width="executionProgress(child)" height="1" />
            </clipPath>
          </defs>
          <rect
            :width="child.width" :height="child.height"
            :rx="theme.radius.sm" :ry="theme.radius.sm"
            :fill="nodeBg(child)"
            :stroke="selectedNode?.id === child.id ? theme.accent : nodeColor(child)"
            :stroke-width="isNodeActive(child) ? 1.6 : 1"
          />
          <rect
            v-if="showsExecutionBorder(child)"
            :x="executionBorderInset(child)"
            :y="executionBorderInset(child)"
            :width="Math.max(child.width - executionBorderInset(child) * 2, 0)"
            :height="Math.max(child.height - executionBorderInset(child) * 2, 0)"
            :rx="theme.radius.sm + 0.5"
            :ry="theme.radius.sm + 0.5"
            fill="none"
            :stroke="executionBorderColor(child)"
            :stroke-width="executionBorderWidth(child)"
            stroke-linejoin="round"
            pointer-events="none"
            :clip-path="hasAnimatedExecutionBorder(child) ? `url(#${executionClipId(child)})` : undefined"
          />
          <text
            :x="8" :y="(child.prompt_cache_key || child.prompt_tokens != null ? 14 : child.height / 2 + 4)"
            :fill="nodeColor(child)"
            :font-size="theme.fontSize.xs"
            :font-family="theme.font.mono"
          >
            {{ child.label }}
          </text>
          <!-- Child prompt cache key -->
          <text v-if="child.prompt_cache_key"
            :x="8" :y="26"
            :fill="theme.fg.secondary"
            :font-size="8"
            :font-family="theme.font.mono"
          >
            prompt_cache_key=&quot;{{ child.prompt_cache_key }}&quot;
          </text>
          <!-- Child token progress bar -->
          <g v-if="child.prompt_tokens != null">
            <text
              :x="child.width - 6"
              :y="(child.prompt_cache_key ? 38 : 24)"
              text-anchor="end"
              :fill="theme.fg.secondary"
              :font-size="7"
              :font-family="theme.font.mono"
            >prompt_tokens: {{ child.prompt_tokens }}</text>
            <rect
              :x="6"
              :y="(child.prompt_cache_key ? 41 : 27)"
              :width="child.width - 12" :height="12"
              :rx="3" :ry="3"
              :fill="theme.bg.surface"
            />
            <rect
              :x="6"
              :y="(child.prompt_cache_key ? 41 : 27)"
              :width="(child.width - 12) * cachePercent(child) / 100" :height="12"
              :rx="3" :ry="3"
              :fill="taskProgressColor"
            />
            <text
              :x="child.width / 2"
              :y="(child.prompt_cache_key ? 41 : 27) + 9"
              text-anchor="middle"
              :fill="theme.fg.primary"
              :font-size="8"
              font-weight="600"
              :font-family="theme.font.mono"
            >{{ cachePercent(child) }}%</text>
            <text
              :x="6"
              :y="(child.prompt_cache_key ? 41 : 27) + 21"
              :fill="theme.fg.secondary"
              :font-size="7"
              :font-family="theme.font.mono"
            >cached_tokens: {{ child.cached_tokens }}</text>
          </g>
          <text v-if="child.cost != null"
            :x="6"
            :y="child.height - (child.ttft != null ? 16 : 8)"
            :fill="theme.fg.primary"
            :font-size="9"
            :font-family="theme.font.mono"
            font-weight="700"
          >{{ formatCost(child) }}</text>
          <text
            :x="child.width - 6"
            :y="child.height - (child.ttft != null ? 16 : 8)"
            text-anchor="end"
            :fill="theme.fg.primary"
            :font-size="9"
            :font-family="theme.font.mono"
            font-weight="700"
          >{{ formatDuration(child) }}</text>
          <text v-if="child.ttft != null"
            :x="child.width - 6"
            :y="child.height - 4"
            text-anchor="end"
            :fill="theme.fg.secondary"
            :font-size="7"
            :font-family="theme.font.mono"
          >{{ formatTtft(child) }}</text>
        </g>
      </template>

      <!-- Task node -->
      <template v-else>
        <defs v-if="showsExecutionBorder(node) && hasAnimatedExecutionBorder(node)">
          <clipPath :id="executionClipId(node)" clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" :width="executionProgress(node)" height="1" />
          </clipPath>
        </defs>
        <rect
          :width="node.width" :height="node.height"
          :rx="theme.radius.md" :ry="theme.radius.md"
          :fill="nodeBg(node)"
          :stroke="selectedNode?.id === node.id ? theme.accent : nodeColor(node)"
          :stroke-width="isNodeActive(node) ? 2.4 : 1.5"
          :filter="isNodeActive(node) ? 'url(#activeGlow)' : undefined"
        >
          <animate v-if="isNodeActive(node)"
            attributeName="opacity"
            values="1;0.7;1" dur="2s" repeatCount="indefinite"
          />
        </rect>
        <rect
          v-if="showsExecutionBorder(node)"
          :x="executionBorderInset(node)"
          :y="executionBorderInset(node)"
          :width="Math.max(node.width - executionBorderInset(node) * 2, 0)"
          :height="Math.max(node.height - executionBorderInset(node) * 2, 0)"
          :rx="theme.radius.md + 1"
          :ry="theme.radius.md + 1"
          fill="none"
          :stroke="executionBorderColor(node)"
          :stroke-width="executionBorderWidth(node)"
          stroke-linejoin="round"
          pointer-events="none"
          :clip-path="hasAnimatedExecutionBorder(node) ? `url(#${executionClipId(node)})` : undefined"
        />
        <!-- Status dot -->
        <circle
          :cx="14" :cy="taskBaseY(node)"
          :r="isNodeActive(node) ? 5 : 4"
          :fill="nodeColor(node)"
        />
        <!-- Label -->
        <text
          :x="26" :y="taskBaseY(node) + 4"
          :fill="isNodeActive(node) ? nodeColor(node) : theme.fg.primary"
          :font-size="theme.fontSize.sm"
          :font-family="theme.font.mono"
          :font-weight="isNodeActive(node) ? 700 : 500"
        >
          {{ node.label.length > 20 ? node.label.slice(0, 20) + '…' : node.label }}
        </text>
        <!-- Error indicator -->
        <text v-if="node.hasError"
          :x="node.width - 14" :y="taskBaseY(node) + 4"
          text-anchor="end"
          :fill="statusColors.failed"
          :font-size="theme.fontSize.xs"
          :font-family="theme.font.mono"
        >✕</text>
        <!-- Prompt cache key -->
        <text v-if="node.prompt_cache_key"
          :x="26" :y="taskBaseY(node) + 16"
          :fill="theme.fg.secondary"
          :font-size="theme.fontSize.xs"
          :font-family="theme.font.mono"
        >
          prompt_cache_key=&quot;{{ node.prompt_cache_key }}&quot;
        </text>
        <!-- Token progress bar -->
        <g v-if="node.prompt_tokens != null">
          <!-- prompt_tokens label (right-aligned, above bar) -->
          <text
            :x="node.width - 10"
            :y="(node.prompt_cache_key ? 46 : 32)"
            text-anchor="end"
            :fill="theme.fg.secondary"
            :font-size="8"
            :font-family="theme.font.mono"
          >prompt_tokens: {{ node.prompt_tokens }}</text>
          <!-- Bar background -->
          <rect
            :x="10"
            :y="(node.prompt_cache_key ? 50 : 36)"
            :width="node.width - 20" :height="14"
            :rx="4" :ry="4"
            :fill="theme.bg.surface"
          />
          <!-- Bar fill -->
          <rect
            :x="10"
            :y="(node.prompt_cache_key ? 50 : 36)"
            :width="(node.width - 20) * cachePercent(node) / 100" :height="14"
            :rx="4" :ry="4"
            :fill="taskProgressColor"
          />
          <!-- Percentage text inside bar -->
          <text
            :x="node.width / 2"
            :y="(node.prompt_cache_key ? 50 : 36) + 11"
            text-anchor="middle"
            :fill="theme.fg.primary"
            :font-size="9"
            font-weight="600"
            :font-family="theme.font.mono"
          >{{ cachePercent(node) }}%</text>
          <!-- cached_tokens label (left-aligned, below bar) -->
          <text
            :x="10"
            :y="(node.prompt_cache_key ? 50 : 36) + 24"
            :fill="theme.fg.secondary"
            :font-size="8"
            :font-family="theme.font.mono"
          >cached_tokens: {{ node.cached_tokens }}</text>
        </g>
        <text v-if="node.cost != null"
          :x="10"
          :y="node.height - (node.ttft != null ? 18 : 10)"
          :fill="theme.fg.primary"
          :font-size="theme.fontSize.md"
          :font-family="theme.font.mono"
          font-weight="700"
        >{{ formatCost(node) }}</text>
        <text
          :x="node.width - 10"
          :y="node.height - (node.ttft != null ? 18 : 10)"
          text-anchor="end"
          :fill="theme.fg.primary"
          :font-size="theme.fontSize.md"
          :font-family="theme.font.mono"
          font-weight="700"
        >{{ formatDuration(node) }}</text>
        <text v-if="node.ttft != null"
          :x="node.width - 10"
          :y="node.height - 6"
          text-anchor="end"
          :fill="theme.fg.secondary"
          :font-size="theme.fontSize.xs"
          :font-family="theme.font.mono"
        >{{ formatTtft(node) }}</text>
      </template>
    </g>

    </svg>

    <div
      :style="{
        position: 'absolute',
        right: '16px',
        bottom: (props.toolbarBottomOffset ?? 16) + 'px',
        zIndex: 6,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
        transition: 'bottom 0.2s ease',
      }"
    >
      <button
        type="button"
        @click.stop="handleFitButton"
        :style="{
          border: '1px solid ' + theme.border.default,
          background: alpha(theme.bg.overlay, 0.92),
          color: theme.fg.secondary,
          borderRadius: theme.radius.sm + 'px',
          padding: '5px 10px',
          fontFamily: theme.font.mono,
          fontSize: theme.fontSize.xs + 'px',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 8px 24px ' + alpha(theme.bg.base, 0.28),
        }"
      >⟲ Fit</button>

      <button
        type="button"
        @click.stop="toggleFollowMode"
        :style="{
          border: '1px solid ' + (props.viewportMode === 'follow' ? alpha(theme.accent, 0.92) : theme.border.default),
          background: props.viewportMode === 'follow' ? alpha(theme.accent, 0.18) : alpha(theme.bg.overlay, 0.92),
          color: props.viewportMode === 'follow' ? theme.accent : theme.fg.secondary,
          borderRadius: theme.radius.sm + 'px',
          padding: '5px 10px',
          fontFamily: theme.font.mono,
          fontSize: theme.fontSize.xs + 'px',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 8px 24px ' + alpha(theme.bg.base, 0.28),
        }"
      >◎ Follow</button>
    </div>
  </div>
</template>
