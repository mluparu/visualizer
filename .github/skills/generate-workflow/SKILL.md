---
name: generate-workflow
description: "Generate simulated workflow execution JSONL files for taskviz. Use when: generate workflow, simulate tasks, create task log, workflow simulation, sample jsonl, mock pipeline, test data for taskviz, create execution trace."
argument-hint: "Describe the workflow to simulate (e.g., '5 tasks: first spawns 3 parallel, 5th waits for all')"
---

# Workflow Simulation Generator

Generate valid JSONL files that simulate workflow task execution for visualization with taskviz.

## When to Use

- Creating test data for the taskviz graph visualizer
- Simulating workflow execution traces from a natural-language description
- Generating sample JSONL files with realistic timing and dependency structures
- Prototyping workflow DAGs before implementation

## Schema

See the full schema at [references/schema.md](./references/schema.md).

Each line is one JSON object with these required fields: `taskId`, `name`, `status`, `startTime`, `endTime`, `dependsOn`. Optional fields include `prompt_cache_key`, `prompt_tokens`, and `cached_tokens` for prompt caching metadata.

## Procedure

Follow these steps exactly when generating a workflow JSONL file:

1. **Parse the description**: Identify task count, names (use meaningful slugs like `build-frontend`), dependency structure (sequential chains, parallel forks, joins), duration ranges, and any failure/skip scenarios.

2. **Assign task IDs**: Use kebab-case slugs that describe the task (e.g., `checkout`, `build-fe`, `run-tests`). If the user gives generic descriptions, number them (`task-1`, `task-2`).

3. **Determine dependencies**: Map the described flow to `dependsOn` arrays:
   - "runs after" / "waits for" / "depends on" → `dependsOn: ["predecessor-id"]`
   - "parallel" / "spawned together" / "concurrent" → give all parallel tasks the same predecessor(s)
   - "fan-in" / "join" / "waits for all" → list all predecessors in `dependsOn`

4. **Simulate timing**: 
   - A task's `startTime` must be ≥ `max(endTime)` of all its dependencies
   - If the user specifies duration ranges (e.g., "2-5 seconds"), pick a random value in that range for each task
   - If no duration specified, use 1–5 seconds as default
   - Set `endTime = startTime + duration`
   - Parallel tasks should start at the same time (= endTime of their shared predecessor)

5. **Set statuses**:
   - Default: `"completed"` for all tasks
   - If the user describes failures: set those to `"failed"` with an `error` message
   - Tasks downstream of a failed task (that cannot proceed) should be `"skipped"` with `endTime = startTime`

6. **Optional fields**:
   - Use `parentTaskId` if the user describes grouped/nested sub-tasks
   - Use `group` for logical grouping labels (e.g., "build", "test", "deploy")
   - Add `metadata` with contextual info for realism (e.g., `{"cpu": "2 cores", "tests": 142}`)
   - Use `prompt_cache_key` (string) to indicate which predecessor task's prompt was reused for caching. Usually the name of a task in `dependsOn`.
   - Use `prompt_tokens` (number) and `cached_tokens` (number) together to show token usage. `cached_tokens` must be ≤ `prompt_tokens`. Both must be present if either is specified.

7. **Output format**: One JSON object per line (JSONL), ordered by `startTime`. No trailing comma, no array wrapper.

8. **Validate before output**:
   - Every `dependsOn` reference points to an existing `taskId`
   - `startTime >= max(endTime of all dependencies)` for every task
   - `startTime < endTime` for non-skipped tasks
   - No circular dependencies
   - All required fields present and correctly typed

## Example

**User prompt**: "5 tasks: first task spawns 3 parallel tasks that each take between 2 and 5 seconds. The 5th task waits for all tasks to complete before running and takes 2 seconds"

**Output** (`samples/five-tasks.jsonl`):
```jsonl
{"taskId":"init","name":"Initialize","status":"completed","startTime":0,"endTime":3.0,"dependsOn":[]}
{"taskId":"worker-a","name":"Worker A","status":"completed","startTime":3.0,"endTime":7.2,"dependsOn":["init"],"prompt_cache_key":"init","prompt_tokens":2048,"cached_tokens":1536}
{"taskId":"worker-b","name":"Worker B","status":"completed","startTime":3.0,"endTime":5.5,"dependsOn":["init"],"prompt_cache_key":"init","prompt_tokens":2048,"cached_tokens":1800}
{"taskId":"worker-c","name":"Worker C","status":"completed","startTime":3.0,"endTime":6.8,"dependsOn":["init"],"prompt_cache_key":"init","prompt_tokens":2048,"cached_tokens":1024}
{"taskId":"finalize","name":"Finalize","status":"completed","startTime":7.2,"endTime":9.2,"dependsOn":["worker-a","worker-b","worker-c"],"prompt_cache_key":"worker-a","prompt_tokens":4096,"cached_tokens":2048}
```

## Constraints

- Never produce invalid JSON — each line must be a valid JSON object
- Always include all required fields: `taskId`, `name`, `status`, `startTime`, `endTime`, `dependsOn`
- Durations must be realistic (never all zero unless explicitly "skipped")
- If `prompt_tokens` is specified, `cached_tokens` must also be specified, and `cached_tokens` ≤ `prompt_tokens`
- The output file must be directly consumable by `node bin/taskviz.js <file>`

## More Examples

See [references/examples.md](./references/examples.md) for additional worked examples.
