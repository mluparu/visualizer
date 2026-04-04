// --- Raw log entry ---

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface TaskEvent {
  taskId: string
  name: string
  status: TaskStatus
  startTime: number
  endTime: number
  dependsOn: string[]
  parentTaskId?: string
  group?: string
  error?: string
  metadata?: Record<string, unknown>
  prompt_cache_key?: string
  prompt_tokens?: number
  cached_tokens?: number
}

// --- Parsed workflow ---

export interface WorkflowMetadata {
  totalTasks: number
  duration: number
  errorCount: number
  skippedCount: number
  groups: string[]
}

export interface ParsedWorkflow {
  tasks: TaskEvent[]
  metadata: WorkflowMetadata
  successors: Record<string, string[]>
  predecessors: Record<string, string[]>
}

// --- Graph structures ---

export type GraphNodeType = 'task' | 'fork' | 'join' | 'start' | 'end' | 'compound'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  status?: TaskStatus
  x: number
  y: number
  width: number
  height: number
  startTime: number
  endTime: number
  taskId?: string
  error?: string
  metadata?: Record<string, unknown>
  dependsOn?: string[]
  parentTaskId?: string
  group?: string
  children?: GraphNode[]
  branchCount?: number
  hasError?: boolean
  prompt_cache_key?: string
  prompt_tokens?: number
  cached_tokens?: number
}

export interface EdgeSection {
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
  bendPoints?: { x: number; y: number }[]
}

export interface GraphEdge {
  id: string
  sources: string[]
  targets: string[]
  sections?: EdgeSection[]
  activationTime: number
}

export interface GraphBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  bounds: GraphBounds
}

export type PlaybackMode = 'preview' | 'reveal'
