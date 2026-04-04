# TaskViz JSONL Schema

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` | Unique identifier for the task. Use kebab-case slugs (e.g., `build-frontend`). |
| `name` | `string` | Human-readable display label (e.g., "Build Frontend"). |
| `status` | `enum` | One of: `"pending"`, `"running"`, `"completed"`, `"failed"`, `"skipped"`. |
| `startTime` | `number` | Start time in seconds from workflow start. |
| `endTime` | `number` | End time in seconds from workflow start. Must be ≥ `startTime`. |
| `dependsOn` | `string[]` | Array of `taskId` values this task waits for. Empty array `[]` for root tasks. |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `parentTaskId` | `string` | Groups this task as a child inside a parent compound node. Must reference an existing `taskId`. |
| `group` | `string` | Visual grouping label (e.g., `"build"`, `"test"`, `"deploy"`). |
| `error` | `string` | Error message. Only meaningful when `status` is `"failed"`. |
| `metadata` | `object` | Arbitrary key-value pairs displayed in the inspector panel. |
| `prompt_cache_key` | `string` | Name of a predecessor task whose prompt was reused for caching. Rendered as a subtitle under the task name. |
| `prompt_tokens` | `number` | Total prompt tokens for this task. Must be specified together with `cached_tokens`. |
| `cached_tokens` | `number` | Number of cached tokens reused from the prompt cache. Must be ≤ `prompt_tokens`. |

## Validation Rules

1. **Referential integrity**: Every ID in `dependsOn` must match an existing `taskId` in the file.
2. **Referential integrity**: If `parentTaskId` is set, it must match an existing `taskId`.
3. **Timing constraint**: `startTime >= max(endTime of all tasks in dependsOn)` — a task cannot start before its dependencies finish.
4. **Duration**: `endTime >= startTime`. For skipped tasks, `endTime` may equal `startTime`.
5. **No cycles**: The dependency graph must be a DAG (directed acyclic graph).
6. **Unique IDs**: Every `taskId` must be unique within the file.
7. **Status values**: Must be exactly one of the five enum values listed above.
8. **Token co-occurrence**: If `prompt_tokens` is specified, `cached_tokens` must also be specified, and vice versa.
9. **Token constraint**: `cached_tokens` must be ≤ `prompt_tokens`.

## Complete Annotated Example

```jsonl
{"taskId":"checkout","name":"Checkout Code","status":"completed","startTime":0,"endTime":1.5,"dependsOn":[],"group":"setup","metadata":{"branch":"main"}}
{"taskId":"build","name":"Build Project","status":"completed","startTime":1.5,"endTime":6.0,"dependsOn":["checkout"],"group":"build","prompt_cache_key":"checkout","prompt_tokens":2048,"cached_tokens":1536}
{"taskId":"test","name":"Run Tests","status":"failed","startTime":6.0,"endTime":12.0,"dependsOn":["build"],"group":"test","error":"3 tests failed: test_auth, test_payment, test_export","metadata":{"tests":150,"passed":147,"failed":3},"prompt_cache_key":"build","prompt_tokens":3200,"cached_tokens":2048}
{"taskId":"deploy","name":"Deploy","status":"skipped","startTime":12.0,"endTime":12.0,"dependsOn":["test"],"group":"deploy"}
```

**Reading this example:**
- `checkout` is a root task (empty `dependsOn`), runs from 0s to 1.5s
- `build` starts at 1.5s (= checkout's endTime), depends on checkout, reuses 1536 of 2048 prompt tokens from checkout (75% cache hit)
- `test` starts at 6.0s (= build's endTime), fails with an error message, reuses 2048 of 3200 prompt tokens from build (64% cache hit)
- `deploy` is skipped because its dependency (`test`) failed; startTime = endTime = 12.0s
