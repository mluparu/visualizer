<script setup lang="ts">
import type { GraphNode, ParsedWorkflow } from '../lib/types'
import { theme, statusColors, alpha } from '../lib/theme'

const props = defineProps<{
  node: GraphNode
  workflow: ParsedWorkflow
}>()

const emit = defineEmits<{
  close: []
}>()

function formatTime(t: number): string {
  if (t < 60) return t.toFixed(2) + 's'
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(1)
  return `${m}m ${s}s`
}

function getDuration(node: GraphNode): string {
  return formatTime(node.endTime - node.startTime)
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}`
}

function getDependencyNames(node: GraphNode): string[] {
  if (!node.dependsOn || node.dependsOn.length === 0) return []
  return node.dependsOn.map(id => {
    const task = props.workflow.tasks.find(t => t.taskId === id)
    return task ? task.name : id
  })
}
</script>

<template>
  <div :style="{
    width: '320px', flexShrink: 0, borderLeft: '1px solid ' + theme.border.subtle,
    background: theme.bg.raised, overflowY: 'auto', padding: '16px',
    fontFamily: theme.font.mono, fontSize: theme.fontSize.sm + 'px',
  }">
    <!-- Header -->
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }">
      <span :style="{ fontWeight: 600, color: theme.fg.primary, fontSize: theme.fontSize.md + 'px' }">
        {{ node.label || node.id }}
      </span>
      <span :style="{ cursor: 'pointer', color: theme.fg.dim }" @click="emit('close')">✕</span>
    </div>

    <!-- Status badge -->
    <div v-if="node.status" :style="{
      display: 'inline-block', padding: '2px 10px', borderRadius: theme.radius.sm + 'px',
      background: alpha(statusColors[node.status], 0.2), color: statusColors[node.status],
      fontSize: theme.fontSize.xs + 'px', fontWeight: 600, marginBottom: '16px',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }">
      {{ node.status }}
    </div>

    <!-- Type badge for fork/join -->
    <div v-else-if="node.type === 'fork' || node.type === 'join'" :style="{
      display: 'inline-block', padding: '2px 10px', borderRadius: theme.radius.sm + 'px',
      background: alpha('#f59e0b', 0.15), color: '#f59e0b',
      fontSize: theme.fontSize.xs + 'px', fontWeight: 600, marginBottom: '16px',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }">
      {{ node.type }} · {{ node.branchCount }} branches
    </div>

    <!-- Timing -->
    <div :style="{ marginBottom: '16px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Timing</div>
      <div :style="{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', color: theme.fg.secondary }">
        <span :style="{ color: theme.fg.dim }">Start</span>
        <span>{{ formatTime(node.startTime) }}</span>
        <span :style="{ color: theme.fg.dim }">End</span>
        <span>{{ formatTime(node.endTime) }}</span>
        <span :style="{ color: theme.fg.dim }">Duration</span>
        <span>{{ getDuration(node) }}</span>
        <span v-if="node.ttft != null" :style="{ color: theme.fg.dim }">TTFT</span>
        <span v-if="node.ttft != null">{{ formatTime(node.ttft) }}</span>
        <span v-if="node.cost != null" :style="{ color: theme.fg.dim }">Cost</span>
        <span v-if="node.cost != null">{{ formatCost(node.cost) }}</span>
      </div>
    </div>

    <!-- Cache -->
    <div v-if="node.prompt_cache_key || node.prompt_tokens != null" :style="{ marginBottom: '16px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Cache</div>
      <div v-if="node.prompt_cache_key" :style="{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: theme.fg.secondary, fontSize: theme.fontSize.xs + 'px' }">
        <span :style="{ color: theme.fg.dim }">prompt_cache_key</span>
        <span>{{ node.prompt_cache_key }}</span>
      </div>
      <div v-if="node.prompt_tokens != null" :style="{ marginTop: '6px' }">
        <div :style="{ display: 'flex', justifyContent: 'flex-end', fontSize: theme.fontSize.xs + 'px', color: theme.fg.dim, marginBottom: '2px' }">
          prompt_tokens: {{ node.prompt_tokens }}
        </div>
        <div :style="{ position: 'relative', height: '10px', borderRadius: '5px', background: theme.bg.surface, overflow: 'hidden' }">
          <div :style="{
            height: '100%',
            width: (node.prompt_tokens > 0 ? Math.round(((node.cached_tokens ?? 0) / node.prompt_tokens) * 100) : 0) + '%',
            borderRadius: '5px',
            background: alpha(theme.accent, 0.6),
          }" />
          <span :style="{
            position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '8px', color: theme.fg.primary, fontFamily: theme.font.mono,
          }">{{ node.prompt_tokens > 0 ? Math.round(((node.cached_tokens ?? 0) / node.prompt_tokens) * 100) : 0 }}%</span>
        </div>
        <div :style="{ display: 'flex', justifyContent: 'flex-start', fontSize: theme.fontSize.xs + 'px', color: theme.fg.dim, marginTop: '2px' }">
          cached_tokens: {{ node.cached_tokens }}
        </div>
      </div>
    </div>

    <!-- Dependencies -->
    <div v-if="getDependencyNames(node).length > 0" :style="{ marginBottom: '16px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Dependencies</div>
      <div v-for="dep in getDependencyNames(node)" :key="dep" :style="{ color: theme.fg.secondary, padding: '2px 0' }">
        → {{ dep }}
      </div>
    </div>

    <!-- Error -->
    <div v-if="node.error" :style="{ marginBottom: '16px' }">
      <div :style="{ color: statusColors.failed, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Error</div>
      <div :style="{
        background: alpha(statusColors.failed, 0.1), border: '1px solid ' + alpha(statusColors.failed, 0.3),
        borderRadius: theme.radius.sm + 'px', padding: '8px', color: '#fca5a5',
        fontSize: theme.fontSize.xs + 'px', wordBreak: 'break-word',
      }">
        {{ node.error }}
      </div>
    </div>

    <!-- Metadata -->
    <div v-if="node.metadata && Object.keys(node.metadata).length > 0" :style="{ marginBottom: '16px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Metadata</div>
      <div :style="{
        background: theme.bg.surface, borderRadius: theme.radius.sm + 'px',
        padding: '8px', fontSize: theme.fontSize.xs + 'px',
      }">
        <div v-for="(value, key) in node.metadata" :key="String(key)"
          :style="{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }"
        >
          <span :style="{ color: theme.fg.dim }">{{ key }}</span>
          <span :style="{ color: theme.fg.secondary }">{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- Task ID -->
    <div v-if="node.taskId" :style="{ marginBottom: '8px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Task ID</div>
      <div :style="{ color: theme.fg.muted, fontSize: theme.fontSize.xs + 'px', fontFamily: theme.font.mono }">
        {{ node.taskId }}
      </div>
    </div>

    <!-- Group -->
    <div v-if="node.group" :style="{ marginBottom: '8px' }">
      <div :style="{ color: theme.fg.dim, fontSize: theme.fontSize.xs + 'px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }">Group</div>
      <div :style="{ color: theme.fg.secondary }">{{ node.group }}</div>
    </div>
  </div>
</template>
