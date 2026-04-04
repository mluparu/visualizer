<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { LayoutResult, GraphNode, EdgeSection, PlaybackMode } from '../lib/types'
import { theme, statusColors, statusBgColors, alpha } from '../lib/theme'
import { getGraphBounds } from '../lib/graphLayout'

const props = defineProps<{
  layout: LayoutResult
  currentTime: number
  selectedNode: GraphNode | null
  playbackMode: PlaybackMode
}>()

const emit = defineEmits<{
  selectNode: [node: GraphNode | null]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const viewBox = ref({ x: 0, y: 0, width: 800, height: 600 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0, vbX: 0, vbY: 0 })

watch(() => props.layout, () => {
  if (props.layout) fitView()
}, { immediate: true })

function fitView() {
  const b = props.layout.bounds
  viewBox.value = { x: b.x, y: b.y, width: b.width, height: b.height }
}

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
  viewBox.value = {
    x: vb.x - (newW - vb.width) * mx,
    y: vb.y - (newH - vb.height) * my,
    width: newW,
    height: newH,
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
  viewBox.value = { ...viewBox.value, x: panStart.value.vbX - dx, y: panStart.value.vbY - dy }
}

function onMouseUp() {
  isPanning.value = false
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

function nodeOpacity(node: GraphNode): number {
  if (props.playbackMode === 'reveal') return 1
  if (isNodeFuture(node)) return 0.25
  return 1
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

function nodeColor(node: GraphNode): string {
  if (node.type === 'fork' || node.type === 'join') return '#f59e0b'
  if (node.type === 'start' || node.type === 'end') return theme.fg.dim
  if (node.status) return statusColors[node.status]
  return theme.fg.secondary
}

function nodeBg(node: GraphNode): string {
  if (node.type === 'fork' || node.type === 'join') return alpha('#f59e0b', 0.15)
  if (node.type === 'start' || node.type === 'end') return theme.bg.surface
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

function cachePercent(node: GraphNode): number {
  if (node.prompt_tokens == null || node.prompt_tokens === 0) return 0
  return Math.round(((node.cached_tokens ?? 0) / node.prompt_tokens) * 100)
}

function taskBaseY(node: GraphNode): number {
  // The vertical center for the label row
  return node.prompt_cache_key || node.prompt_tokens != null ? 18 : node.height / 2
}

const viewBoxStr = computed(() => {
  const vb = viewBox.value
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
})
</script>

<template>
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
        <!-- Child nodes inside compound -->
        <g v-if="node.children" v-for="child in node.children" :key="child.id"
          v-show="isNodeVisible(child)"
          :transform="`translate(${child.x}, ${child.y})`"
          :opacity="nodeOpacity(child)"
          :style="{ cursor: 'pointer', transition: 'opacity 0.3s ease' }"
          @click="onNodeClick(child, $event)"
        >
          <rect
            :width="child.width" :height="child.height"
            :rx="theme.radius.sm" :ry="theme.radius.sm"
            :fill="nodeBg(child)"
            :stroke="selectedNode?.id === child.id ? theme.accent : nodeColor(child)"
            stroke-width="1"
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
              fill="#c2610a"
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
        </g>
      </template>

      <!-- Task node -->
      <template v-else>
        <rect
          :width="node.width" :height="node.height"
          :rx="theme.radius.md" :ry="theme.radius.md"
          :fill="nodeBg(node)"
          :stroke="selectedNode?.id === node.id ? theme.accent : nodeColor(node)"
          stroke-width="1.5"
          :filter="isNodeActive(node) ? 'url(#activeGlow)' : undefined"
        >
          <animate v-if="isNodeActive(node)"
            attributeName="opacity"
            values="1;0.7;1" dur="2s" repeatCount="indefinite"
          />
        </rect>
        <!-- Status dot -->
        <circle
          :cx="14" :cy="taskBaseY(node)"
          r="4"
          :fill="nodeColor(node)"
        />
        <!-- Label -->
        <text
          :x="26" :y="taskBaseY(node) + 4"
          :fill="theme.fg.primary"
          :font-size="theme.fontSize.sm"
          :font-family="theme.font.mono"
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
            fill="#c2610a"
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
      </template>
    </g>

    <!-- Fit button -->
    <g :transform="`translate(${viewBox.x + viewBox.width - 80}, ${viewBox.y + viewBox.height - 40})`"
      :style="{ cursor: 'pointer' }"
      @click.stop="fitView"
    >
      <rect width="60" height="24" rx="4" :fill="theme.bg.overlay" :stroke="theme.border.default" stroke-width="1" />
      <text x="30" y="16" text-anchor="middle" :fill="theme.fg.secondary" :font-size="theme.fontSize.xs" :font-family="theme.font.mono">⟲ Fit</text>
    </g>
  </svg>
</template>
