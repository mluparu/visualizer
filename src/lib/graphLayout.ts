import ELK from 'elkjs/lib/elk.bundled.js'
import type { ParsedWorkflow, GraphNode, GraphEdge, GraphBounds, LayoutResult, GraphNodeType } from './types'

const elk = new ELK()

function makeEdge(id: string, source: string, target: string, activationTime: number): GraphEdge {
  return { id, sources: [source], targets: [target], activationTime }
}

export function buildGraphData(workflow: ParsedWorkflow): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { tasks, successors, predecessors } = workflow
  if (tasks.length === 0) return { nodes: [], edges: [] }

  // Determine uniform task node width: 210 if any task has cache fields, else 180
  const hasCacheFields = tasks.some(t => t.prompt_cache_key || t.prompt_tokens != null)
  const baseTaskWidth = hasCacheFields ? 210 : 180

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const taskById = new Map(tasks.map(t => [t.taskId, t]))

  // Find root tasks (no dependencies) and leaf tasks (no successors)
  const roots = tasks.filter(t => t.dependsOn.length === 0 && !t.parentTaskId)
  const leaves = tasks.filter(t => (successors[t.taskId]?.length ?? 0) === 0 && !t.parentTaskId)

  // Virtual START node
  const startNode: GraphNode = {
    id: '__start__',
    type: 'start',
    label: '',
    x: 0, y: 0, width: 28, height: 28,
    startTime: 0,
    endTime: 0,
  }
  nodes.push(startNode)

  // Virtual END node
  const maxEnd = tasks.length > 0 ? Math.max(...tasks.map(t => t.endTime)) : 0
  const endNode: GraphNode = {
    id: '__end__',
    type: 'end',
    label: '',
    x: 0, y: 0, width: 28, height: 28,
    startTime: maxEnd,
    endTime: maxEnd,
  }
  nodes.push(endNode)

  // Collect top-level tasks (no parentTaskId) and compound parents
  const topLevelTasks = tasks.filter(t => !t.parentTaskId)
  const childrenOf = new Map<string, typeof tasks>()
  for (const t of tasks) {
    if (t.parentTaskId) {
      if (!childrenOf.has(t.parentTaskId)) childrenOf.set(t.parentTaskId, [])
      childrenOf.get(t.parentTaskId)!.push(t)
    }
  }

  // Track which task IDs have outgoing edges so we can detect fork/join points
  const outDegree = new Map<string, number>()
  const inDegree = new Map<string, number>()
  for (const t of topLevelTasks) {
    outDegree.set(t.taskId, successors[t.taskId]?.filter(sid => !taskById.get(sid)?.parentTaskId).length ?? 0)
    inDegree.set(t.taskId, predecessors[t.taskId]?.filter(pid => !taskById.get(pid)?.parentTaskId).length ?? 0)
  }

  // Identify fork points: nodes whose successors fan out to 2+
  // and join points: nodes with 2+ incoming edges
  // We insert diamond markers between the source and its multiple targets
  const forkNodes = new Map<string, GraphNode>() // sourceTaskId -> fork diamond
  const joinNodes = new Map<string, string>() // key = sorted incoming taskIds -> join node id

  // Detect forks: a task with 2+ top-level successors
  for (const t of topLevelTasks) {
    const succs = (successors[t.taskId] ?? []).filter(sid => !taskById.get(sid)?.parentTaskId)
    if (succs.length >= 2) {
      const forkId = `fork-${t.taskId}`
      const forkNode: GraphNode = {
        id: forkId,
        type: 'fork',
        label: `${succs.length}`,
        x: 0, y: 0, width: 36, height: 36,
        startTime: t.endTime,
        endTime: t.endTime,
        branchCount: succs.length,
      }
      nodes.push(forkNode)
      forkNodes.set(t.taskId, forkNode)
    }
  }

  // Detect joins: tasks with 2+ top-level predecessors
  // Group by the exact set of predecessors to share a join node
  const joinGroupMap = new Map<string, { joinNode: GraphNode; predIds: string[] }>()
  for (const t of topLevelTasks) {
    const preds = (predecessors[t.taskId] ?? []).filter(pid => !taskById.get(pid)?.parentTaskId)
    if (preds.length >= 2) {
      const key = [...preds].sort().join(',')
      if (!joinGroupMap.has(key)) {
        const joinId = `join-${key.replace(/,/g, '-')}`
        const joinTime = Math.max(...preds.map(pid => taskById.get(pid)?.endTime ?? 0))
        const joinNode: GraphNode = {
          id: joinId,
          type: 'join',
          label: `${preds.length}`,
          x: 0, y: 0, width: 36, height: 36,
          startTime: joinTime,
          endTime: joinTime,
          branchCount: preds.length,
          hasError: preds.some(pid => taskById.get(pid)?.status === 'failed'),
        }
        nodes.push(joinNode)
        joinGroupMap.set(key, { joinNode, predIds: preds })
      }
      joinNodes.set(t.taskId, joinGroupMap.get(key)!.joinNode.id)
    }
  }

  // Create task nodes
  for (const t of topLevelTasks) {
    const children = childrenOf.get(t.taskId)
    const isCompound = !!children && children.length > 0

    // Dynamic height: base 52 + 14 for cache key + 36 for token bar
    let taskHeight = 52
    if (t.prompt_cache_key) taskHeight += 14
    if (t.prompt_tokens != null) taskHeight += 36

    // For compound nodes, compute total height from children
    let compoundHeight = 60
    if (isCompound) {
      for (const child of children!) {
        let ch = 36
        if (child.prompt_cache_key) ch += 14
        if (child.prompt_tokens != null) ch += 36
        compoundHeight += ch + 8
      }
    }

    const node: GraphNode = {
      id: `task-${t.taskId}`,
      type: isCompound ? 'compound' : 'task',
      label: t.name,
      status: t.status,
      x: 0, y: 0,
      width: isCompound ? 260 : baseTaskWidth,
      height: isCompound ? compoundHeight : taskHeight,
      startTime: t.startTime,
      endTime: t.endTime,
      taskId: t.taskId,
      error: t.error,
      metadata: t.metadata,
      dependsOn: t.dependsOn,
      group: t.group,
      hasError: t.status === 'failed',
      prompt_cache_key: t.prompt_cache_key,
      prompt_tokens: t.prompt_tokens,
      cached_tokens: t.cached_tokens,
    }

    if (isCompound) {
      node.children = children!.map(child => {
        let childHeight = 36
        if (child.prompt_cache_key) childHeight += 14
        if (child.prompt_tokens != null) childHeight += 36
        return {
          id: `task-${child.taskId}`,
          type: 'task' as GraphNodeType,
          label: child.name,
          status: child.status,
          x: 16, y: 0, width: 200, height: childHeight,
          startTime: child.startTime,
          endTime: child.endTime,
          taskId: child.taskId,
          error: child.error,
          metadata: child.metadata,
          dependsOn: child.dependsOn,
          parentTaskId: child.parentTaskId,
          hasError: child.status === 'failed',
          prompt_cache_key: child.prompt_cache_key,
          prompt_tokens: child.prompt_tokens,
          cached_tokens: child.cached_tokens,
        }
      })
    }

    nodes.push(node)
  }

  // Create edges
  for (const t of topLevelTasks) {
    const nodeId = `task-${t.taskId}`
    const preds = (predecessors[t.taskId] ?? []).filter(pid => !taskById.get(pid)?.parentTaskId)

    // If this task has no predecessors, connect from START
    if (preds.length === 0) {
      // If there's a fork after START (multiple roots), route through a fork
      if (roots.length >= 2) {
        // We need a single START fork
        if (!forkNodes.has('__start__')) {
          const sf: GraphNode = {
            id: 'fork-__start__',
            type: 'fork',
            label: `${roots.length}`,
            x: 0, y: 0, width: 36, height: 36,
            startTime: 0, endTime: 0,
            branchCount: roots.length,
          }
          nodes.push(sf)
          forkNodes.set('__start__', sf)
          edges.push(makeEdge('__start__->fork-__start__', '__start__', 'fork-__start__', 0))
        }
        edges.push(makeEdge(`fork-__start__->${nodeId}`, 'fork-__start__', nodeId, 0))
      } else {
        edges.push(makeEdge(`__start__->${nodeId}`, '__start__', nodeId, 0))
      }
    }

    // If this task has a join node, connect from join to task
    if (joinNodes.has(t.taskId)) {
      const joinId = joinNodes.get(t.taskId)!
      edges.push(makeEdge(`${joinId}->${nodeId}`, joinId, nodeId, t.startTime))
    } else if (preds.length === 1) {
      // Single predecessor - connect directly (or through fork if predecessor forks)
      const predId = preds[0]
      const predNodeId = `task-${predId}`
      if (forkNodes.has(predId)) {
        const forkId = forkNodes.get(predId)!.id
        edges.push(makeEdge(`${forkId}->${nodeId}`, forkId, nodeId, t.startTime))
      } else {
        edges.push(makeEdge(`${predNodeId}->${nodeId}`, predNodeId, nodeId, t.startTime))
      }
    }

    // Connect predecessor to fork (if fork) or to join (if join)
    if (forkNodes.has(t.taskId)) {
      const forkId = forkNodes.get(t.taskId)!.id
      // Task -> Fork
      edges.push(makeEdge(`${nodeId}->${forkId}`, nodeId, forkId, t.endTime))
    }

    // If this task is a predecessor participant in a join, connect to the join
    for (const [key, { joinNode, predIds }] of joinGroupMap) {
      if (predIds.includes(t.taskId)) {
        const edgeId = `${nodeId}->${joinNode.id}`
        // Don't add duplicate edges
        if (!edges.some(e => e.id === edgeId)) {
          if (forkNodes.has(t.taskId)) {
            // Skip — the fork already handles outgoing edges
          } else {
            edges.push(makeEdge(edgeId, nodeId, joinNode.id, t.endTime))
          }
        }
      }
    }

    // If this task is a leaf (no successors), connect to END
    const succs = (successors[t.taskId] ?? []).filter(sid => !taskById.get(sid)?.parentTaskId)
    if (succs.length === 0) {
      if (leaves.length >= 2) {
        if (!joinNodes.has('__end__') && !joinGroupMap.has('__end__')) {
          const leafIds = leaves.map(l => l.taskId)
          const jn: GraphNode = {
            id: 'join-__end__',
            type: 'join',
            label: `${leaves.length}`,
            x: 0, y: 0, width: 36, height: 36,
            startTime: maxEnd, endTime: maxEnd,
            branchCount: leaves.length,
            hasError: leaves.some(l => l.status === 'failed'),
          }
          nodes.push(jn)
          joinGroupMap.set('__end__', { joinNode: jn, predIds: leafIds })
          edges.push(makeEdge('join-__end__->__end__', 'join-__end__', '__end__', maxEnd))
        }
        const jnId = joinGroupMap.get('__end__')!.joinNode.id
        const edgeId = `${nodeId}->${jnId}`
        if (!edges.some(e => e.id === edgeId)) {
          // Check if there's already a fork from this task
          if (forkNodes.has(t.taskId)) {
            // Don't connect: the fork handles it
          } else {
            edges.push(makeEdge(edgeId, nodeId, jnId, t.endTime))
          }
        }
      } else {
        edges.push(makeEdge(`${nodeId}->__end__`, nodeId, '__end__', t.endTime))
      }
    }
  }

  // Deduplicate edges
  const seen = new Set<string>()
  const dedupedEdges = edges.filter(e => {
    const key = `${e.sources[0]}->${e.targets[0]}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { nodes, edges: dedupedEdges }
}

export async function runLayout(graphData: { nodes: GraphNode[]; edges: GraphEdge[] }): Promise<any> {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'elk.spacing.nodeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': '48',
      'elk.spacing.edgeNode': '16',
      'elk.layered.mergeEdges': 'true',
    },
    children: graphData.nodes.map(node => {
      const elkNode: any = {
        id: node.id,
        width: node.width || 180,
        height: node.height || 52,
      }
      if (node.type === 'compound' && node.children) {
        elkNode.children = node.children.map(child => ({
          id: child.id,
          width: child.width || 160,
          height: child.height || 36,
        }))
        elkNode.layoutOptions = {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '8',
          'elk.padding': '[top=36,left=16,bottom=12,right=16]',
        }
      }
      return elkNode
    }),
    edges: graphData.edges.map(e => ({
      id: e.id,
      sources: e.sources,
      targets: e.targets,
    })),
  }

  return elk.layout(elkGraph)
}

export function mergeLayout(graphData: { nodes: GraphNode[]; edges: GraphEdge[] }, elkResult: any): LayoutResult {
  const positionMap = new Map<string, { x: number; y: number; width: number; height: number }>()

  if (elkResult.children) {
    for (const elkNode of elkResult.children) {
      positionMap.set(elkNode.id, { x: elkNode.x, y: elkNode.y, width: elkNode.width, height: elkNode.height })
      if (elkNode.children) {
        for (const elkChild of elkNode.children) {
          positionMap.set(elkChild.id, { x: elkChild.x, y: elkChild.y, width: elkChild.width, height: elkChild.height })
        }
      }
    }
  }

  const nodes = graphData.nodes.map(node => {
    const pos = positionMap.get(node.id) ?? { x: 0, y: 0, width: node.width, height: node.height }
    const result = { ...node, ...pos }

    if (node.type === 'compound' && node.children) {
      result.children = node.children.map(child => {
        const childPos = positionMap.get(child.id) ?? { x: 0, y: 0, width: child.width, height: child.height }
        return { ...child, ...childPos }
      })
    }
    return result
  })

  // Process edges with sections from ELK
  const elkEdgeMap = new Map<string, any>()
  if (elkResult.edges) {
    for (const e of elkResult.edges) {
      elkEdgeMap.set(e.id, e)
    }
  }

  const edges = graphData.edges.map(edge => {
    const elkEdge = elkEdgeMap.get(edge.id)
    return { ...edge, sections: elkEdge?.sections ?? null }
  })

  // Compute bounds
  const bounds = getGraphBounds(nodes)

  return { nodes, edges, bounds }
}

export function getGraphBounds(nodes: GraphNode[]): GraphBounds {
  if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 600 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y + n.height > maxY) maxY = n.y + n.height
  }

  const padding = 40
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}
