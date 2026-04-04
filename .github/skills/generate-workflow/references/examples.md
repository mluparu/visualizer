# Workflow Simulation Examples

## Example 1: Simple Linear Chain

**Prompt**: "3 sequential tasks that each take 2 seconds"

**Output**:
```jsonl
{"taskId":"task-1","name":"Task 1","status":"completed","startTime":0,"endTime":2.0,"dependsOn":[],"cost":0.12,"ttft":0.4}
{"taskId":"task-2","name":"Task 2","status":"completed","startTime":2.0,"endTime":4.0,"dependsOn":["task-1"],"cost":0.15,"ttft":0.5}
{"taskId":"task-3","name":"Task 3","status":"completed","startTime":4.0,"endTime":6.0,"dependsOn":["task-2"],"cost":0.17,"ttft":0.6}
```

**Key points**: Each task depends on the previous one. `startTime` of task N = `endTime` of task N-1. The optional `cost` and `ttft` values stay within each task's duration.

---

## Example 2: Fork and Join

**Prompt**: "1 task spawns 3 parallel tasks, then a final task joins all of them"

**Output**:
```jsonl
{"taskId":"start","name":"Start","status":"completed","startTime":0,"endTime":2.0,"dependsOn":[],"cost":0.09,"ttft":0.3}
{"taskId":"parallel-a","name":"Parallel A","status":"completed","startTime":2.0,"endTime":5.3,"dependsOn":["start"],"cost":0.24,"ttft":0.7}
{"taskId":"parallel-b","name":"Parallel B","status":"completed","startTime":2.0,"endTime":4.1,"dependsOn":["start"],"cost":0.18,"ttft":0.6}
{"taskId":"parallel-c","name":"Parallel C","status":"completed","startTime":2.0,"endTime":6.7,"dependsOn":["start"],"cost":0.29,"ttft":0.9}
{"taskId":"join","name":"Join Results","status":"completed","startTime":6.7,"endTime":8.5,"dependsOn":["parallel-a","parallel-b","parallel-c"],"cost":0.21,"ttft":0.8}
```

**Key points**:
- All three parallel tasks share the same `dependsOn: ["start"]` and the same `startTime: 2.0`
- Each has a different duration (randomized), so they end at different times
- The join task's `startTime` (6.7) = `max(endTime)` of all parallel tasks (parallel-c ends latest)
- Each `ttft` remains less than the task's own duration, so the sample stays schema-valid

---

## Example 3: Error with Skipped Downstream

**Prompt**: "5 tasks where task 3 fails and tasks 4-5 are skipped"

**Output**:
```jsonl
{"taskId":"task-1","name":"Initialize","status":"completed","startTime":0,"endTime":1.5,"dependsOn":[]}
{"taskId":"task-2","name":"Build","status":"completed","startTime":1.5,"endTime":4.0,"dependsOn":["task-1"]}
{"taskId":"task-3","name":"Test","status":"failed","startTime":4.0,"endTime":7.0,"dependsOn":["task-2"],"error":"Test suite failed: 5 assertions did not pass"}
{"taskId":"task-4","name":"Package","status":"skipped","startTime":7.0,"endTime":7.0,"dependsOn":["task-3"]}
{"taskId":"task-5","name":"Deploy","status":"skipped","startTime":7.0,"endTime":7.0,"dependsOn":["task-4"]}
```

**Key points**:
- Task 3 has `status: "failed"` and an `error` message
- Tasks 4 and 5 have `status: "skipped"` with `endTime = startTime` (zero duration)
- Skipped tasks still have correct `dependsOn` and `startTime` (= endTime of their dependency)

---

## Example 4: Nested Sub-tasks with parentTaskId

**Prompt**: "A deploy stage with 3 sub-tasks: provision, configure, and verify"

**Output**:
```jsonl
{"taskId":"deploy","name":"Deploy to Production","status":"completed","startTime":0,"endTime":15.0,"dependsOn":[],"group":"deploy"}
{"taskId":"provision","name":"Provision Resources","status":"completed","startTime":0.5,"endTime":6.0,"dependsOn":[],"parentTaskId":"deploy","group":"deploy","metadata":{"provider":"AWS"}}
{"taskId":"configure","name":"Configure Services","status":"completed","startTime":6.0,"endTime":11.0,"dependsOn":["provision"],"parentTaskId":"deploy","group":"deploy"}
{"taskId":"verify","name":"Verify Deployment","status":"completed","startTime":11.0,"endTime":14.5,"dependsOn":["configure"],"parentTaskId":"deploy","group":"deploy"}
```

**Key points**:
- The parent task `deploy` spans the full duration and has no `parentTaskId`
- Each sub-task has `parentTaskId: "deploy"` which renders them inside the parent's compound node
- Sub-tasks can have their own `dependsOn` chains (provision → configure → verify)
- The parent's `endTime` should be ≥ the latest sub-task's `endTime`

---

## Example 5: Prompt Cache Tokens

**Prompt**: "3 sequential AI tasks where each reuses the previous task's prompt cache. Show increasing token counts with high cache hit rates."

**Output**:
```jsonl
{"taskId":"analyze","name":"Analyze Document","status":"completed","startTime":0,"endTime":4.0,"dependsOn":[],"metadata":{"model":"gpt-4"},"cost":0.32,"ttft":0.9}
{"taskId":"summarize","name":"Summarize Findings","status":"completed","startTime":4.0,"endTime":7.5,"dependsOn":["analyze"],"prompt_cache_key":"analyze","prompt_tokens":2048,"cached_tokens":1536,"cost":0.41,"ttft":1.1}
{"taskId":"draft","name":"Draft Report","status":"completed","startTime":7.5,"endTime":12.0,"dependsOn":["summarize"],"prompt_cache_key":"summarize","prompt_tokens":4096,"cached_tokens":3072,"cost":0.68,"ttft":1.5}
```

**Key points**:
- `prompt_cache_key` references the predecessor task name whose prompt was reused
- `prompt_tokens` and `cached_tokens` must always appear together
- `cached_tokens` must be ≤ `prompt_tokens` (75% cache hit in both tasks above)
- The root task (`analyze`) has no cache fields since it has no predecessor to cache from
- These fields render as a progress bar inside each task node in the visualizer, alongside the lower-corner cost, duration, and TTFT metrics
