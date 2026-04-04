## Plan: Add prompt cache fields to task schema

Add three optional fields (`prompt_cache_key`, `prompt_tokens`, `cached_tokens`) to the task schema, render them inside task boxes in GraphView, update samples, and update the skill documentation.

**Steps**

### Phase 1 — Schema & Parser

1. **Update `TaskEvent` in `src/lib/types.ts`**: Add three optional fields:
   - `prompt_cache_key?: string`
   - `prompt_tokens?: number`
   - `cached_tokens?: number`

2. **Update `GraphNode` in `src/lib/types.ts`**: Add the same three optional fields so they flow through to rendering.

3. **Update `validateTask()` in `src/lib/parser.ts`**: Parse the new optional fields from raw JSON:
   - `prompt_cache_key`: accept if `typeof === 'string'`
   - `prompt_tokens`: accept if `typeof === 'number'`
   - `cached_tokens`: accept if `typeof === 'number'`
   - Validation: if `cached_tokens` is present, `prompt_tokens` must also be present; `cached_tokens <= prompt_tokens`

### Phase 2 — Layout Adjustments

4. **Update `buildGraphData()` in `src/lib/graphLayout.ts`**:
   - Pass the new fields from `TaskEvent` to `GraphNode` (both top-level and compound children)
   - At the top of the function, scan all tasks: if ANY task has `prompt_tokens` or `prompt_cache_key`, set `baseWidth = 210`; otherwise `baseWidth = 180`. Use this for all task nodes uniformly.
   - Increase node height dynamically per-node: base height is 52px; add ~14px if `prompt_cache_key` is present; add ~36px if `prompt_tokens` / `cached_tokens` are present. This gives enough space for the sub-label, progress bar, and its labels.
   - Child nodes in compounds: similar dynamic height increase from base 36px.

### Phase 3 — GraphView Rendering

5. **Update task node template in `src/components/GraphView.vue`** (the `<!-- Task node -->` template block, around lines 270-310):
   - **prompt_cache_key**: Render a second `<text>` element below the task label (y offset ~`node.height/2 + 16`), using `theme.fontSize.xs` and `theme.fg.dim` color. Only shown when the field is non-empty.
   - **Progress bar** (when `prompt_tokens` is present):
     - Compute percentage: `Math.round((cached_tokens / prompt_tokens) * 100)`
     - Top label: `<text>` right-aligned at `x="node.width - 10"`, showing `prompt_tokens: NNNN` in `theme.fg.dim`, `theme.fontSize.xs`
     - Progress bar background: `<rect>` full width (node.width - 20px padding), height 6px, fill `theme.bg.surface`, positioned below the cache key line
     - Progress bar fill: `<rect>` width = percentage of bar width, fill with a muted accent color (e.g., `theme.accent` at reduced opacity)
     - Percentage label: `<text>` centered on the bar showing `NN%`
     - Bottom label: `<text>` left-aligned showing `cached_tokens: NNNN` in `theme.fg.dim`, `theme.fontSize.xs`

6. **Update compound child node template** in GraphView.vue: Apply the same rendering for child nodes inside compound parents (simplified, smaller).

7. **Update node width**: Increase from 180 to ~220 for nodes that have prompt token fields, so labels fit comfortably. *(Decision: keep 180 for all nodes for layout consistency; truncate numbers if needed. Or increase uniformly to ~210. Recommend increasing to 210 only for nodes with token fields — will need to test.)*

### Phase 4 — Inspector

8. **Update `src/components/Inspector.vue`**: Add a "Cache" section (after Timing, before Dependencies) that displays:
   - `prompt_cache_key` (if present)
   - `prompt_tokens` and `cached_tokens` with a visual bar (reuse same progress bar concept as in the node, but wider)

### Phase 5 — Samples

9. **Update `samples/linear-chain.jsonl`**: Add `prompt_cache_key`, `prompt_tokens`, `cached_tokens` to some tasks to demonstrate the feature. For example:
   - `fetch-data`: no cache fields (root task)
   - `validate`: `prompt_cache_key: "fetch-data"`, `prompt_tokens: 2048`, `cached_tokens: 1536`
   - `transform`: `prompt_cache_key: "validate"`, `prompt_tokens: 3200`, `cached_tokens: 2048`
   - `load`: `prompt_cache_key: "transform"`, `prompt_tokens: 4096`, `cached_tokens: 3200`
   - `notify`: no cache fields (small task)

10. **Update `samples/fan-out-fan-in.jsonl`**: Add cache fields to the worker tasks:
    - Workers share `prompt_cache_key: "prepare"` with varying token counts
    - `aggregate` has `prompt_cache_key` referencing the slowest worker

11. **Update `samples/diamond-dependency.jsonl`**: Add cache fields to demonstrate diamond cache key behavior.

### Phase 6 — Skill & Documentation

12. **Update `.github/skills/generate-workflow/SKILL.md`**:
    - Add `prompt_cache_key`, `prompt_tokens`, `cached_tokens` to the Schema section's field list
    - Add a new bullet under "Optional fields" in the Procedure section explaining when/how to use these fields
    - Update the Example output to include the new fields in some tasks
    - Add a constraint: `cached_tokens <= prompt_tokens`; if `prompt_tokens` is present, `cached_tokens` must also be present

13. **Update `.github/skills/generate-workflow/references/schema.md`**:
    - Add three new rows to the Optional Fields table
    - Add validation rules for the co-occurrence and value constraints
    - Update the annotated example to include the new fields

14. **Update `.github/skills/generate-workflow/references/examples.md`**:
    - Update Example 1 (linear chain) to show some tasks with cache fields
    - Add a dedicated new example showing prompt cache usage

15. **Update `plan.md`**: Add the three new fields to the Task Log Schema section.

**Relevant files**
- `src/lib/types.ts` — Add `prompt_cache_key`, `prompt_tokens`, `cached_tokens` to `TaskEvent` (line 6-18) and `GraphNode` (line 36-62)
- `src/lib/parser.ts` — Update `validateTask()` (line 18-40) to parse new fields; add cross-field validation
- `src/lib/graphLayout.ts` — Update `buildGraphData()` node creation (~lines 120-155) to pass new fields and compute dynamic heights
- `src/components/GraphView.vue` — Update task node `<template v-else>` block (~lines 270-310) and compound child rendering (~lines 245-268) to render cache key, progress bar, and token labels
- `src/components/Inspector.vue` — Add Cache section after Timing section (~line 88)
- `samples/linear-chain.jsonl` — Add cache fields to some tasks
- `samples/fan-out-fan-in.jsonl` — Add cache fields to workers
- `samples/diamond-dependency.jsonl` — Add cache fields
- `.github/skills/generate-workflow/SKILL.md` — Update schema and procedure sections
- `.github/skills/generate-workflow/references/schema.md` — Add new fields to tables
- `.github/skills/generate-workflow/references/examples.md` — Add/update examples with cache fields
- `plan.md` — Update schema documentation

**Verification**
1. Run `npm run dev` and load `samples/linear-chain.jsonl` — verify task boxes show `prompt_cache_key` subtitle, progress bar with percentage, and token labels
2. Load `samples/single-task.jsonl` (no cache fields) — verify no visual regression; nodes render at original 52px height
3. Load `samples/fan-out-fan-in.jsonl` — verify parallel nodes with cache fields don't overlap; layout handles mixed heights
4. Click a node with cache fields in the graph — verify Inspector shows Cache section with all three values
5. Run `npx tsc --noEmit` — verify no TypeScript errors
6. Verify all sample JSONL files are valid: load each in the visualizer with no parse errors

**Decisions**
- The three new fields are optional — existing JSONL files with no cache fields continue to work unchanged
- `prompt_cache_key` is rendered as a subtitle, not as metadata, to keep it visually prominent but unobtrusive
- Node height grows dynamically: +14px for cache key line, +36px for progress bar section — nodes without these fields keep their current 52px height
- `prompt_tokens` and `cached_tokens` always appear together (validated in parser). If only one is provided, the parser throws an error.
- Progress bar uses `theme.accent` at reduced opacity for the fill, `theme.bg.surface` for background — consistent with the dark theme
- Only 3 of 9 samples are updated to add cache fields, to keep coverage representative without over-saturating
- **Node width**: If ANY task in the loaded workflow has `prompt_tokens` or `prompt_cache_key`, ALL task nodes use 210px width. Otherwise, all nodes stay at 180px. This is determined once in `buildGraphData()` by scanning tasks before creating nodes, ensuring uniform width across the graph.
