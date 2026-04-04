## Plan: Execution Border Playback

Add a secondary execution-outline overlay in `src/components/GraphView.vue` so tasks that have already started/finished get a thicker rounded border, and animate that outline in playback by revealing it from left to right using existing `currentTime`, `startTime`, and `endTime` values. Reuse the current playback flow; no parser/schema changes are needed.

**Steps**
1. Add execution-border helpers in `d:\blog\visualizer\src\components\GraphView.vue`:
   - `showsExecutionBorder(node)` / `hasExecuted(node)` to decide when the extra border should appear
   - `executionProgress(node)` to clamp progress to `0..1` from `(currentTime - startTime) / (endTime - startTime)` and handle zero-duration tasks safely
   - `executionBorderColor(node)` and `executionClipId(node)` for stable SVG rendering
2. Update the main task-node SVG in `d:\blog\visualizer\src\components\GraphView.vue`:
   - Keep the existing base rectangle and glow behavior
   - Add a second `fill="none"` rounded `<rect>` with a thicker `stroke-width` as the execution border
   - In `playbackMode === 'reveal'` for active tasks, clip that overlay with a left-anchored `<clipPath>` whose width tracks `node.width * executionProgress(node)` so the border progressively reveals left → right
   - For already-finished tasks, render the full border without clipping
3. Apply the same treatment to child task rectangles inside compound nodes so nested tasks stay visually consistent with top-level tasks.
4. Preserve interaction details:
   - Keep `selectedNode` highlighting and `activeGlow`
   - Use `pointer-events="none"` on the overlay so clicks still hit the node group
   - Prefer status-based color (`nodeColor(node)`) for the execution border; only add a theme token in `d:\blog\visualizer\src\lib\theme.ts` if the current palette needs a separate outline color
5. Verify the behavior end-to-end with both preview and reveal playback modes.

**Relevant files**
- `d:\blog\visualizer\src\components\GraphView.vue` — primary implementation site for task rendering, border helpers, and SVG clip-path overlay
- `d:\blog\visualizer\src\composables\usePlayback.ts` — existing animation clock that drives `currentTime`; likely reused as-is
- `d:\blog\visualizer\src\lib\theme.ts` — optional theme token adjustments if the border needs a dedicated color or opacity rule
- `d:\blog\visualizer\src\App.vue` — confirms `currentTime` and `playbackMode` continue flowing into `GraphView`

**Verification**
1. Run `npm run typecheck` from `d:\blog\visualizer`.
2. Run `npm run build` from `d:\blog\visualizer`.
3. Run `npm run dev`, load a sample such as `samples/ci-pipeline.jsonl`, then:
   - confirm future/pending tasks do not show the new border yet
   - confirm active tasks reveal the thicker rounded border from left to right while playback advances
   - confirm completed/failed tasks retain the full border after they finish
   - confirm compound child tasks behave the same way and no border clipping/regression appears while zooming or panning

**Decisions**
- Include both top-level task nodes and child task nodes inside compound containers.
- Exclude parser/schema changes and layout changes unless visual clipping appears during verification.
- Recommended execution-border states: `running`, `completed`, and `failed`; leave `pending` and `skipped` without the extra execution border unless design feedback says otherwise.

**Further Considerations**
1. If the outline feels too heavy at small zoom levels, inset the overlay border by 1–2 px instead of enlarging the node footprint.
2. If selection needs stronger emphasis, keep `theme.accent` on the main stroke and reserve the status color for the secondary execution border.