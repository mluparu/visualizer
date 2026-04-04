<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskEvent } from '../lib/types'
import { theme, statusColors, alpha } from '../lib/theme'

const props = defineProps<{
  currentTime: number
  totalDuration: number
  playing: boolean
  speed: number
  tasks: TaskEvent[]
}>()

const emit = defineEmits<{
  seek: [time: number]
  togglePlay: []
  toggleSpeed: []
}>()

const barRef = ref<HTMLElement | null>(null)

function formatTime(t: number): string {
  if (t < 60) return t.toFixed(1) + 's'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(0)
  return `${m}m${s.padStart(2, '0')}s`
}

function seekFromEvent(e: MouseEvent) {
  if (!barRef.value) return
  const rect = barRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  emit('seek', ratio * props.totalDuration)
}

const isDragging = ref(false)

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  seekFromEvent(e)
}

function onMouseMove(e: MouseEvent) {
  if (isDragging.value) seekFromEvent(e)
}

function onMouseUp() {
  isDragging.value = false
}

const progress = computed(() =>
  props.totalDuration > 0 ? (props.currentTime / props.totalDuration) * 100 : 0
)

const segments = computed(() => {
  if (props.totalDuration === 0) return []
  return props.tasks
    .filter(t => !t.parentTaskId)
    .map(t => ({
      left: (t.startTime / props.totalDuration) * 100,
      width: ((t.endTime - t.startTime) / props.totalDuration) * 100,
      color: statusColors[t.status],
      name: t.name,
    }))
})
</script>

<template>
  <div :style="{
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '6px 16px', borderBottom: '1px solid ' + theme.border.subtle,
    fontFamily: theme.font.mono, fontSize: theme.fontSize.sm + 'px',
    flexShrink: 0, userSelect: 'none',
  }">
    <!-- Play/Pause -->
    <button
      @click="emit('togglePlay')"
      :style="{
        background: 'none', border: '1px solid ' + theme.border.default, borderRadius: theme.radius.sm + 'px',
        color: theme.fg.primary, cursor: 'pointer', padding: '2px 10px',
        fontFamily: theme.font.mono, fontSize: theme.fontSize.sm + 'px',
      }"
    >{{ playing ? '⏸' : '▶' }}</button>

    <!-- Time -->
    <span :style="{ color: theme.fg.secondary, minWidth: '100px' }">
      {{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}
    </span>

    <!-- Speed -->
    <button
      @click="emit('toggleSpeed')"
      :style="{
        background: 'none', border: '1px solid ' + theme.border.default, borderRadius: theme.radius.sm + 'px',
        color: theme.fg.dim, cursor: 'pointer', padding: '2px 8px',
        fontFamily: theme.font.mono, fontSize: theme.fontSize.xs + 'px',
      }"
    >{{ speed }}x</button>

    <!-- Scrub bar -->
    <div
      ref="barRef"
      :style="{
        flex: 1, height: '20px', background: theme.bg.surface,
        borderRadius: theme.radius.sm + 'px', position: 'relative', overflow: 'hidden', cursor: 'pointer',
      }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <!-- Task segments -->
      <div v-for="(seg, i) in segments" :key="i"
        :style="{
          position: 'absolute', top: '2px', bottom: '2px',
          left: seg.left + '%', width: Math.max(seg.width, 0.3) + '%',
          background: alpha(seg.color, 0.35), borderRadius: '2px',
        }"
        :title="seg.name"
      />
      <!-- Playhead -->
      <div :style="{
        position: 'absolute', top: 0, bottom: 0, left: progress + '%',
        width: '2px', background: theme.accent, transition: isDragging ? 'none' : 'left 0.05s',
      }" />
    </div>
  </div>
</template>
