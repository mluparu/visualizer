import type { TaskEvent, TaskStatus, ParsedWorkflow, WorkflowMetadata } from './types'

const VALID_STATUSES: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped']

function isISOString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function isoToSeconds(value: string, minEpoch: number): number {
  const ms = new Date(value).getTime()
  return (ms - minEpoch) / 1000
}

function toComparableSeconds(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (isISOString(value)) return new Date(value).getTime() / 1000
  return null
}

function isWorkflowHeader(raw: Record<string, unknown>): boolean {
  return !('taskId' in raw) && (raw.title != null || raw.description != null)
}

function validateWorkflowHeader(raw: Record<string, unknown>, lineNum: number): Pick<WorkflowMetadata, 'title' | 'description'> {
  const errors: string[] = []

  if (raw.title != null && typeof raw.title !== 'string') errors.push('title must be a string')
  if (raw.description != null && typeof raw.description !== 'string') errors.push('description must be a string')

  if (errors.length > 0) {
    throw new Error(`Line ${lineNum}: ${errors.join('; ')}`)
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : undefined
  const description = typeof raw.description === 'string' ? raw.description.trim() : undefined

  if (!title && !description) {
    throw new Error(`Line ${lineNum}: workflow metadata must include a non-empty title or description`)
  }

  return { title, description }
}

function validateTask(raw: Record<string, unknown>, lineNum: number): TaskEvent {
  const errors: string[] = []

  if (typeof raw.taskId !== 'string' || !raw.taskId) errors.push('taskId must be a non-empty string')
  if (typeof raw.name !== 'string' || !raw.name) errors.push('name must be a non-empty string')
  if (!VALID_STATUSES.includes(raw.status as TaskStatus)) errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`)
  if (typeof raw.startTime !== 'number' && !isISOString(raw.startTime)) errors.push('startTime must be a number or ISO-8601 string')
  if (typeof raw.endTime !== 'number' && !isISOString(raw.endTime)) errors.push('endTime must be a number or ISO-8601 string')
  if (!Array.isArray(raw.dependsOn)) errors.push('dependsOn must be an array')

  const startSeconds = toComparableSeconds(raw.startTime)
  const endSeconds = toComparableSeconds(raw.endTime)
  const taskDuration = startSeconds != null && endSeconds != null ? endSeconds - startSeconds : null
  if (taskDuration != null && taskDuration < 0) {
    errors.push('endTime must be >= startTime')
  }

  const hasCost = typeof raw.cost === 'number'
  const hasTtft = typeof raw.ttft === 'number'
  if (raw.cost != null && !hasCost) {
    errors.push('cost must be a number')
  }
  if (hasCost && (raw.cost as number) < 0) {
    errors.push('cost must be >= 0')
  }
  if (raw.ttft != null && !hasTtft) {
    errors.push('ttft must be a number')
  }
  if (hasTtft && (raw.ttft as number) < 0) {
    errors.push('ttft must be >= 0')
  }
  if (hasTtft && taskDuration != null && (raw.ttft as number) > taskDuration) {
    errors.push('ttft must be <= task duration')
  }

  // Cross-field validation for prompt cache fields
  const hasPromptTokens = typeof raw.prompt_tokens === 'number'
  const hasCachedTokens = typeof raw.cached_tokens === 'number'
  if (hasCachedTokens && !hasPromptTokens) {
    errors.push('cached_tokens requires prompt_tokens to also be specified')
  }
  if (hasPromptTokens && !hasCachedTokens) {
    errors.push('prompt_tokens requires cached_tokens to also be specified')
  }
  if (hasPromptTokens && hasCachedTokens && (raw.cached_tokens as number) > (raw.prompt_tokens as number)) {
    errors.push('cached_tokens must be <= prompt_tokens')
  }

  if (errors.length > 0) {
    throw new Error(`Line ${lineNum}: ${errors.join('; ')}`)
  }

  return {
    taskId: raw.taskId as string,
    name: raw.name as string,
    status: raw.status as TaskStatus,
    startTime: raw.startTime as number,
    endTime: raw.endTime as number,
    dependsOn: (raw.dependsOn as unknown[]).map(String),
    parentTaskId: typeof raw.parentTaskId === 'string' ? raw.parentTaskId : undefined,
    group: typeof raw.group === 'string' ? raw.group : undefined,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    metadata: typeof raw.metadata === 'object' && raw.metadata !== null && !Array.isArray(raw.metadata)
      ? raw.metadata as Record<string, unknown>
      : undefined,
    prompt_cache_key: typeof raw.prompt_cache_key === 'string' ? raw.prompt_cache_key : undefined,
    prompt_tokens: hasPromptTokens ? raw.prompt_tokens as number : undefined,
    cached_tokens: hasCachedTokens ? raw.cached_tokens as number : undefined,
    cost: hasCost ? raw.cost as number : undefined,
    ttft: hasTtft ? raw.ttft as number : undefined,
  }
}

export function parseWorkflow(text: string): ParsedWorkflow {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const workflowHeader: Pick<WorkflowMetadata, 'title' | 'description'> = {}

  if (lines.length === 0) {
    return {
      tasks: [],
      metadata: { ...workflowHeader, totalTasks: 0, duration: 0, errorCount: 0, skippedCount: 0, groups: [] },
      successors: {},
      predecessors: {},
    }
  }

  // Parse and validate each line
  const rawTasks: TaskEvent[] = []
  for (let i = 0; i < lines.length; i++) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(lines[i])
    } catch {
      throw new Error(`Line ${i + 1}: invalid JSON`)
    }

    if (isWorkflowHeader(parsed)) {
      if (rawTasks.length > 0) {
        throw new Error(`Line ${i + 1}: workflow title/description must appear before task entries`)
      }
      if (workflowHeader.title || workflowHeader.description) {
        throw new Error(`Line ${i + 1}: only one workflow metadata entry is allowed per file`)
      }
      Object.assign(workflowHeader, validateWorkflowHeader(parsed, i + 1))
      continue
    }

    rawTasks.push(validateTask(parsed, i + 1))
  }

  if (rawTasks.length === 0) {
    return {
      tasks: [],
      metadata: { ...workflowHeader, totalTasks: 0, duration: 0, errorCount: 0, skippedCount: 0, groups: [] },
      successors: {},
      predecessors: {},
    }
  }

  // Normalize ISO timestamps to seconds
  const hasISO = rawTasks.some(t => isISOString(t.startTime as unknown as string))
  if (hasISO) {
    const allTimes = rawTasks.flatMap(t => [t.startTime, t.endTime]).filter(v => typeof v === 'string') as unknown as string[]
    const minEpoch = Math.min(...allTimes.map(s => new Date(s).getTime()))
    for (const task of rawTasks) {
      if (typeof task.startTime === 'string') task.startTime = isoToSeconds(task.startTime as unknown as string, minEpoch)
      if (typeof task.endTime === 'string') task.endTime = isoToSeconds(task.endTime as unknown as string, minEpoch)
    }
  }

  // Shift to 0-based
  const minStart = Math.min(...rawTasks.map(t => t.startTime))
  if (minStart !== 0) {
    for (const task of rawTasks) {
      task.startTime -= minStart
      task.endTime -= minStart
    }
  }

  // Validate references
  const taskIds = new Set(rawTasks.map(t => t.taskId))
  for (const task of rawTasks) {
    for (const dep of task.dependsOn) {
      if (!taskIds.has(dep)) {
        throw new Error(`Task "${task.taskId}" depends on unknown task "${dep}"`)
      }
    }
    if (task.parentTaskId && !taskIds.has(task.parentTaskId)) {
      throw new Error(`Task "${task.taskId}" has unknown parentTaskId "${task.parentTaskId}"`)
    }
  }

  // Build adjacency maps
  const successors: Record<string, string[]> = {}
  const predecessors: Record<string, string[]> = {}
  for (const task of rawTasks) {
    if (!successors[task.taskId]) successors[task.taskId] = []
    if (!predecessors[task.taskId]) predecessors[task.taskId] = []
  }
  for (const task of rawTasks) {
    for (const dep of task.dependsOn) {
      if (!successors[dep]) successors[dep] = []
      successors[dep].push(task.taskId)
      predecessors[task.taskId].push(dep)
    }
  }

  // Compute metadata
  const duration = rawTasks.length > 0 ? Math.max(...rawTasks.map(t => t.endTime)) : 0
  const errorCount = rawTasks.filter(t => t.status === 'failed').length
  const skippedCount = rawTasks.filter(t => t.status === 'skipped').length
  const groups = [...new Set(rawTasks.map(t => t.group).filter((g): g is string => !!g))]

  const metadata: WorkflowMetadata = {
    ...workflowHeader,
    totalTasks: rawTasks.length,
    duration,
    errorCount,
    skippedCount,
    groups,
  }

  return { tasks: rawTasks, metadata, successors, predecessors }
}
