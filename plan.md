# Plan: Task Workflow Graph Visualizer (CLI → HTML report)

## TL;DR
Build a CLI tool (`taskviz`) that reads a workflow orchestration log (JSONL) and generates a self-contained interactive HTML report. The report renders a directed graph (DAG) with automatic fork/join when tasks execute in parallel, plus a scrubable playback timeline. Stack: Vue 3 + Vite + ELKjs. Inspired by the agentviz GraphView.

---

## Task Log Schema (JSONL)

Each line is a JSON object:

```
taskId        string   — unique task identifier
name          string   — human-readable label
status        enum     — "pending" | "running" | "completed" | "failed" | "skipped"
startTime     number   — seconds from workflow start (or ISO-8601 string, auto-detected)
endTime       number   — seconds from workflow start
dependsOn     string[] — taskIds this task waits for (drives DAG edges)
parentTaskId  string?  — optional: groups sub-tasks inside a parent (compound node)
group         string?  — optional: visual grouping label
error         string?  — error message if status === "failed"
metadata      object?  — arbitrary key-value pairs shown in inspector
```

**Parallel detection**: Two tasks are parallel when they share the same set of predecessors (or subsets) and their time ranges overlap. More precisely, the DAG structure from `dependsOn` naturally produces forks — when a completed task has 2+ successors, those successors fan out; when a task has 2+ predecessors, it's a join.

---

## Steps

### Phase 1 — Project Scaffold

1. **Initialize project** in `d:\blog\visualizer` with Vue 3 + Vite + TypeScript.
   - `package.json` with dependencies: `vue@3`, `elkjs`, `vite`, `@vitejs/plugin-vue`, `vite-plugin-singlefile` (to produce one self-contained HTML)
   - `tsconfig.json` for strict TS
   - `vite.config.ts` with `vue()` and `viteSingleFile()` plugins

2. **Define TypeScript types** in `src/lib/types.ts`
   - `TaskEvent` — raw log entry shape
   - `ParsedWorkflow` — `{ tasks: TaskEvent[], metadata: WorkflowMetadata }`
   - `GraphNode` — `{ id, type ("task" | "fork" | "join" | "start" | "end"), label, status, x, y, width, height, startTime, endTime, children?, ... }`
   - `GraphEdge` — `{ id, source, target, sections }`
   - `LayoutResult` — `{ nodes: GraphNode[], edges: GraphEdge[], bounds }`

### Phase 2 — Parser & Graph Layout Engine

3. **JSONL parser** (`src/lib/parser.ts`)
   - Read input as text → split lines → JSON.parse each → validate fields against `TaskEvent`
   - Normalize timestamps: if ISO strings, convert to seconds-from-min; shift all to 0-based
   - Build adjacency maps: `successors[taskId]`, `predecessors[taskId]`
   - Compute `WorkflowMetadata`: total tasks, duration, error count, groups
   - *No dependencies on step 4+*

4. **Graph layout engine** (`src/lib/graphLayout.ts`) — *depends on step 3*
   - `buildGraphData(workflow: ParsedWorkflow)` →
     a. Create virtual START node (predecessors of tasks with empty `dependsOn`)
     b. Create virtual END node (successors of tasks with no dependents)
     c. For each task: create a `GraphNode`
     d. For tasks with `parentTaskId`: nest as children inside parent compound node
     e. For each `dependsOn` relation: create a `GraphEdge`
     f. Detect fork points (node with 2+ outgoing edges) → insert diamond fork marker
     g. Detect join points (node with 2+ incoming edges) → insert diamond join marker
   - `runLayout(graphData)` — call ELKjs with layered left-to-right algorithm (same settings as agentviz: `elk.layered`, `LEFT_TO_RIGHT`, spacing 32/48)
   - `mergeLayout(graphData, elkResult)` — map ELK positions back to GraphNode x/y and edge sections

### Phase 3 — Vue 3 UI Components

5. **App shell** (`src/App.vue`) — *parallel with step 6, 7*
   - Read `window.__TASKVIZ_DATA__` (injected by CLI)
   - Pass parsed workflow to `GraphView` and `Timeline`
   - Manage playback state via `usePlayback` composable
   - Layout: full-viewport with timeline bar at top, graph filling remaining space, inspector as slide-over panel

6. **GraphView component** (`src/components/GraphView.vue`) — *depends on step 4*
   - SVG-based rendering (same approach as agentviz GraphView.jsx)
   - Node types rendered:
     - **TaskNode**: rounded rect, color-coded by status (completed=green, failed=red, running=blue, pending=gray, skipped=dim)
     - **ForkNode / JoinNode**: diamond shape with "⊜ N branches" / "⋈" labels
     - **StartNode / EndNode**: small circles
     - **CompoundNode**: dashed-border container for sub-tasks (when `parentTaskId` is used)
   - Edge rendering: SVG `<path>` from ELK sections with bend points
   - Interaction: click node → show in inspector, drag to pan, scroll to zoom, fit-to-view button
   - Playback sync: active node gets glow + bright color when `currentTime` is within its time range; future nodes dimmed

7. **Timeline component** (`src/components/Timeline.vue`) — *parallel with step 6*
   - Horizontal bar segmented by tasks (colored by status)
   - Scrubable: click/drag sets `currentTime`
   - Play/pause button, current time label, total duration
   - Active segment highlighted

8. **Inspector panel** (`src/components/Inspector.vue`) — *parallel with step 6, 7*
   - Slide-over sidebar (right side), shown when a node is selected
   - Displays: task name, status badge, start/end time, duration, dependencies list, error message, metadata key-value table
   - Close button

9. **usePlayback composable** (`src/composables/usePlayback.ts`) — *before steps 5-8*
   - Reactive state: `currentTime`, `playing`, `speed` (1x, 2x, 4x)
   - `play()`, `pause()`, `seek(t)`, `toggleSpeed()`
   - requestAnimationFrame loop for smooth playback

10. **Theme** (`src/lib/theme.ts`)
    - Dark theme color tokens (match agentviz palette: dark backgrounds, green/blue/red accents)
    - Status-to-color map
    - All styles inline (no CSS files, matching agentviz convention)

### Phase 4 — CLI Tool

11. **CLI entry point** (`bin/taskviz.js`) — *depends on steps 1-10 (needs built HTML)*
    - `#!/usr/bin/env node`
    - Args: `taskviz <logfile.jsonl> [-o output.html]`
    - Reads JSONL log file from disk
    - Reads pre-built `dist/index.html` (single-file HTML from Vite build)
    - Injects `<script>window.__TASKVIZ_DATA__ = ${JSON.stringify(data)}</script>` before `</head>`
    - Writes output HTML file
    - Opens output in default browser (optional `--no-open` flag)
    - Validates log: prints error + exits 1 if invalid entries found

### Phase 5 — Sample Scenarios *(parallel with Phase 4)*

Create 9 JSONL files under `samples/` covering distinct graph topologies and edge cases:

12. **`samples/ci-pipeline.jsonl`** — **CI/CD pipeline** (~15 tasks): checkout → parallel build-frontend + build-backend → parallel tests per build → deploy-staging → e2e → deploy-prod. One failed integration test with error message. Varying durations (0.5s–30s).

13. **`samples/linear-chain.jsonl`** — **Strictly sequential**: 5 tasks in a single chain, no parallelism. Validates that no spurious fork/join markers appear.

14. **`samples/fan-out-fan-in.jsonl`** — **Wide fan-out**: one "prepare" task fans out to 6 parallel worker tasks, all join into a single "aggregate" task. Stress-tests fork/join diamond rendering and ELK spacing.

15. **`samples/nested-groups.jsonl`** — **Compound nodes**: parent task "deploy" with 3 sub-tasks (`parentTaskId`), one sub-task "provision" has 2 children of its own. Tests nested compound node layout.

16. **`samples/diamond-dependency.jsonl`** — **Diamond DAG**: A → B + C (parallel) → D depends on both B and C. Classic diamond shape, verifies join marker placement with exactly 2 incoming edges.

17. **`samples/multi-stage-parallel.jsonl`** — **Multiple fork/join waves** (~20 tasks): 3 sequential stages (build, test, deploy), each with its own parallel fan-out and reconvergence. Tests repeated fork/join pattern.

18. **`samples/error-cascade.jsonl`** — **Error + skipped propagation**: early task fails, downstream dependents all have `status: "skipped"`. Tests failed (red) + skipped (dim gray) status rendering.

19. **`samples/single-task.jsonl`** — **Minimal edge case**: one task only. No edges, no forks — verifies the app doesn't crash on trivial input.

20. **`samples/long-running.jsonl`** — **Extreme time variance**: mix of very short (0.1s) and very long (120s) tasks. Tests timeline scaling, zoom behavior, and that short tasks remain visible.

### Phase 6 — Agent Skill: Workflow Simulation Generator

Create a VS Code agent skill at `.github/skills/generate-workflow/` that allows users to describe a workflow in natural language and have the agent produce a valid JSONL file matching the taskviz schema.

21. **`SKILL.md`** (`.github/skills/generate-workflow/SKILL.md`)
    - Frontmatter: `name: generate-workflow`, description with trigger phrases like "generate workflow", "simulate tasks", "create task log", "workflow simulation", "sample jsonl"
    - `argument-hint`: "Describe the workflow to simulate (e.g., '5 tasks: first spawns 3 parallel, 5th waits for all')"
    - Body sections:
      - **When to Use**: generating test data for taskviz, simulating workflow execution, creating sample JSONL files
      - **Schema Reference**: link to `./references/schema.md`
      - **Procedure** (step-by-step for the agent):
        1. Parse the user's natural-language description to identify: task count, names, dependency structure (sequential, parallel forks, joins), duration ranges, and any error/failure scenarios
        2. Assign each task a `taskId` (e.g., `task-1`, `task-2`, or meaningful slugs like `build-frontend`)
        3. Compute `dependsOn` arrays from the described flow — if task B "waits for" or "runs after" task A, set `dependsOn: ["task-a"]`; if tasks are "parallel" or "spawned together", give them the same predecessor
        4. Simulate realistic timing: assign `startTime` so that a task starts only after all its dependencies have ended; randomize duration within any user-specified range (or default 1–5s); set `endTime = startTime + duration`
        5. Set `status: "completed"` for all tasks unless the user describes failures — then mark those `"failed"` with an `error` message and optionally mark downstream tasks as `"skipped"`
        6. Use `parentTaskId` if the user describes grouped/nested sub-tasks
        7. Optionally add `metadata` with contextual info (e.g., `{ "cpu": "2 cores", "memory": "4GB" }`) for realism
        8. Output one JSON object per line (JSONL), ordered by `startTime`
        9. Validate: every `dependsOn` reference must point to an existing `taskId`; `startTime >= max(endTime of dependencies)`; no circular dependencies
      - **Example**: full worked example showing input prompt → output JSONL (the "5 tasks with 3 parallel" example from the user's description)
      - **Constraints**: remind the agent to never produce invalid JSON, always include all required fields, and that durations should be realistic (not all zero)

22. **`references/schema.md`** (`.github/skills/generate-workflow/references/schema.md`)
    - Full schema documentation with field names, types, required/optional status, enum values, and a complete annotated example
    - Copy of the schema table from the plan (taskId, name, status, startTime, endTime, dependsOn, parentTaskId, group, error, metadata)
    - Validation rules: `startTime < endTime`, `dependsOn` must reference existing taskIds, status enum values, `endTime` of dependency ≤ `startTime` of dependent task

23. **`references/examples.md`** (`.github/skills/generate-workflow/references/examples.md`)
    - 3–4 worked examples at varying complexity:
      a. **Simple linear**: "3 sequential tasks" → JSONL output
      b. **Fork/join**: "1 task spawns 3 parallel tasks, then a final task joins" → JSONL output with parallel timing
      c. **Error scenario**: "5 tasks where task 3 fails and task 4-5 are skipped" → JSONL with failed + skipped statuses
      d. **Nested groups**: "deploy stage with 3 sub-tasks" → JSONL with parentTaskId

### Phase 7 — Polish & Verify

24. **package.json bin field** — register `taskviz` command
    - `"bin": { "taskviz": "./bin/taskviz.js" }`
    - `"files": ["bin/", "dist/"]`

25. **Build script** — `npm run build` produces `dist/index.html` (single file)

---

## Relevant Files (to create)

- `package.json` — project config, dependencies, scripts, bin
- `vite.config.ts` — Vue + singlefile plugins
- `tsconfig.json` — strict TypeScript config
- `index.html` — Vite entry HTML (loads JetBrains Mono via Google Fonts)
- `src/main.ts` — Vue app mount
- `src/App.vue` — Root: reads injected data, orchestrates layout
- `src/lib/types.ts` — TaskEvent, GraphNode, GraphEdge, LayoutResult interfaces
- `src/lib/parser.ts` — JSONL parsing, validation, normalization
- `src/lib/graphLayout.ts` — DAG construction + ELKjs layout (adapted from agentviz graphLayout.js)
- `src/lib/theme.ts` — color tokens, status colors
- `src/components/GraphView.vue` — SVG DAG renderer (adapted from agentviz GraphView.jsx)
- `src/components/Timeline.vue` — playback timeline bar
- `src/components/Inspector.vue` — selected-task detail panel
- `src/composables/usePlayback.ts` — reactive playback state
- `bin/taskviz.js` — CLI: read log → inject into HTML → write report
- `samples/ci-pipeline.jsonl` — CI/CD fork/join pipeline
- `samples/linear-chain.jsonl` — sequential chain, no forks
- `samples/fan-out-fan-in.jsonl` — wide 6-way parallel fan-out
- `samples/nested-groups.jsonl` — compound nodes with parentTaskId
- `samples/diamond-dependency.jsonl` — classic A→B+C→D diamond
- `samples/multi-stage-parallel.jsonl` — repeated fork/join waves
- `samples/error-cascade.jsonl` — failed + skipped propagation
- `samples/single-task.jsonl` — minimal one-task edge case
- `samples/long-running.jsonl` — extreme time variance (0.1s–120s)
- `.github/skills/generate-workflow/SKILL.md` — agent skill: generate JSONL from natural language
- `.github/skills/generate-workflow/references/schema.md` — full schema documentation with validation rules
- `.github/skills/generate-workflow/references/examples.md` — 3–4 worked input→output examples

## Reference files (from agentviz, patterns to adapt)

- `reference/agentviz/src/lib/graphLayout.js` — `buildGraphData()`, `runLayout()`, `mergeLayout()`, ELKjs config, fork/join detection via `findParallelTaskGroup()` and `buildParallelAgentTurnGraph()`
- `reference/agentviz/src/components/GraphView.jsx` — SVG rendering pattern (TurnNode, BranchMarkerNode, GraphEdge, viewBox pan/zoom), playback glow animation
- `reference/agentviz/src/lib/theme.js` — color palette tokens
- `reference/agentviz/src/contexts/PlaybackContext.jsx` — playback state shape (time, playing, speed)

---

## Verification

1. **Build check**: `npm run build` produces a single `dist/index.html` file (< 500KB)
2. **CLI smoke test per scenario**: run `node bin/taskviz.js samples/<file>.jsonl -o out/<file>.html` for each of the 9 sample files — all should produce valid HTML that opens in a browser
3. **ci-pipeline.jsonl**: graph shows checkout → two parallel branches → parallel tests → join at deploy-staging → e2e → deploy-prod; fork/join diamonds present; failed integration-tests in red
4. **linear-chain.jsonl**: 5 nodes in a straight horizontal line, zero fork/join diamond markers
5. **fan-out-fan-in.jsonl**: one fork diamond fanning to 6 parallel nodes, one join diamond converging — ELK spacing keeps nodes from overlapping
6. **nested-groups.jsonl**: compound node containers rendered with dashed borders, sub-tasks visible inside
7. **diamond-dependency.jsonl**: classic diamond shape with exactly one fork and one join marker
8. **multi-stage-parallel.jsonl**: 3 distinct fork/join clusters rendered sequentially left-to-right
9. **error-cascade.jsonl**: first task red (failed), downstream tasks dim gray (skipped)
10. **single-task.jsonl**: one node centered, no edges, no crash
11. **long-running.jsonl**: timeline scales correctly; short tasks still visible when zoomed out; zoom in reveals short tasks
12. **Interaction check** (any sample):
    - Click a task node → inspector slides in with details
    - Play button → currentTime advances, nodes light up in sequence
    - Scroll to zoom, drag to pan, fit-to-view button resets
13. **Skill discovery**: type `/` in VS Code chat → `generate-workflow` appears as a slash command
14. **Skill generation — simple**: invoke `/generate-workflow 3 sequential tasks that each take 2 seconds` → produces valid JSONL with 3 tasks, `dependsOn` chaining, `startTime` 0/2/4, `endTime` 2/4/6 → feed to `taskviz` CLI → renders 3-node straight-line graph
15. **Skill generation — parallel**: invoke `/generate-workflow 5 tasks: first task spawns 3 parallel tasks (2-5s each), 5th task waits for all` → JSONL has task-1 with no deps, task-2/3/4 all `dependsOn: ["task-1"]` with overlapping time ranges, task-5 `dependsOn: ["task-2","task-3","task-4"]` → renders fork/join graph
16. **Skill generation — errors**: invoke `/generate-workflow 4 tasks where task 2 fails and tasks 3-4 are skipped` → JSONL has task-2 with `status: "failed"` + `error` field, task-3/4 with `status: "skipped"` → renders red + gray nodes
17. **Skill output validation**: every JSONL file produced by the skill must parse successfully through the `parser.ts` → no validation errors; all `dependsOn` references resolve; `startTime` respects dependency ordering

---

## Decisions

- **JSONL over JSON array**: one object per line, easier to stream/append, matches agentviz convention
- **ELKjs layered layout**: proven approach from agentviz, handles DAGs with compound nodes well
- **vite-plugin-singlefile**: bundles all JS/CSS into one HTML file so CLI can inject data and produce a standalone report
- **Fork/join from DAG structure, not time overlap**: unlike agentviz which infers parallelism from overlapping timestamps, here we use explicit `dependsOn` edges — more reliable for workflow engines
- **Vue 3 Composition API**: all components use `<script setup>` with TypeScript
- **Inline styles only**: matching agentviz convention, no CSS files
- **Scope boundary**: NO server/backend, NO session library, NO multi-format parser, NO AI coach — just the graph + timeline + inspector + CLI + skill
- **Agent skill over prompt file**: a skill (not a `.prompt.md`) because it bundles reference assets (schema.md, examples.md) that the agent loads progressively — a prompt file can't include bundled resources
- **Skill placement**: `.github/skills/` (project-scoped, team-shared) so anyone who clones the repo gets the generator
