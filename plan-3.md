# Plan: Playback Reveal Mode for Timeline

## TL;DR
Add a second playback mode ("Reveal") alongside the current one ("Preview"). In Preview mode, future tasks are shown grayed out (current behavior). In Reveal mode, tasks and their connectors are completely hidden until execution begins, gradually unveiling the orchestration graph. A toggle button in Timeline.vue switches between modes.

## Steps

### Phase 1: Type & State Foundation
1. **Add `PlaybackMode` type** in `src/lib/types.ts` — define `type PlaybackMode = 'preview' | 'reveal'`
2. **Add `playbackMode` state** in `src/App.vue` — new `ref<PlaybackMode>('preview')`, pass as prop to `<Timeline>` and `<GraphView>`

### Phase 2: Timeline Toggle UI
3. **Add toggle button in `src/components/Timeline.vue`** — place between the speed button and the scrub bar. Show current mode label ("Preview" / "Reveal"). Emit `toggleMode` event on click. Accept `playbackMode` prop to show active state.
4. **Wire event in `src/App.vue`** — handle `@toggle-mode` by flipping `playbackMode` between `'preview'` and `'reveal'`

### Phase 3: GraphView Reveal Logic
5. **Accept `revealMode` prop** in `src/components/GraphView.vue` — boolean or the mode string
6. **Add `isNodeVisible(node)` function** — in reveal mode, returns `false` when `isNodeFuture(node)` is `true` (node hasn't started executing yet). In preview mode, always returns `true`.
7. **Add `isEdgeVisible(edge)` function** — in reveal mode, returns `false` when the target node is future (looked up via `edge.targets[0]` in the nodes list). In preview mode, always returns `true`.
8. **Filter nodes in template** — wrap each node `<g>` with `v-if="isNodeVisible(node)"` (or `v-show`). Same for compound node children.
9. **Filter edges in template** — wrap each edge `<g>` with `v-if="isEdgeVisible(edge)"`
10. **Opacity in reveal mode** — `nodeOpacity()` returns 1 for all visible nodes in reveal mode (since invisible ones are hidden entirely). Keep 0.25 for future nodes in preview mode.

### Phase 4: Polish — Fade-in Transition
11. **Add SVG fade-in** — use a CSS transition on the `<g>` elements' opacity. When a node transitions from hidden to visible (reveal mode), animate opacity from 0 → 1 over ~300ms. Can use Vue's `<transition-group>` or CSS on the `<g>` with a computed class.

## Relevant Files

- `src/lib/types.ts` — add `PlaybackMode` type export after `LayoutResult`
- `src/App.vue` — add `playbackMode` ref, pass as prop to Timeline and GraphView, handle `toggleMode` emit
- `src/components/Timeline.vue` — add `playbackMode` prop, toggle button UI, `toggleMode` emit
- `src/components/GraphView.vue` — add `revealMode` prop, `isNodeVisible()`/`isEdgeVisible()` helpers, conditional rendering with `v-if` on nodes and edges, adjust `nodeOpacity()` for reveal mode

## Verification

1. Load the demo pipeline or any sample .jsonl and play back in **Preview mode** — confirm behavior is unchanged (future tasks grayed at 0.25 opacity)
2. Switch to **Reveal mode** and reset playback to t=0 — only the `__start__` node and immediate first tasks (if started at t=0) should be visible
3. Play through the timeline in Reveal mode — verify nodes and their incoming edges appear as `currentTime` crosses each task's `startTime`
4. Verify fork/join diamonds appear at their `startTime` in Reveal mode
5. Verify compound parent nodes and their children respect reveal logic
6. Switch modes mid-playback — verify seamless transition (no layout jumps)
7. Verify the toggle button shows the current active mode clearly

## Decisions

- **Node visibility trigger**: A node becomes visible when `currentTime >= node.startTime` (not when dependencies complete). This is simpler and uses the existing `isNodeFuture()` logic.
- **Edge visibility**: An edge is hidden when its target node is hidden. This ensures no dangling arrows pointing to invisible nodes.
- **Start node**: Always visible in both modes (it has `startTime: 0`).
- **End node**: Visible only when `currentTime >= endNode.startTime` in reveal mode.
- **Toggle placement**: Between speed button and scrub bar in Timeline.vue for easy access.
- **Default mode**: Preview (preserves current behavior).

## Further Considerations

1. **Fade-in animation**: Adding a CSS/SVG transition for newly-revealed nodes would make the reveal feel smoother. Recommend a 300ms opacity transition. Alternative: no animation (instant appear).
2. **Scrub bar segments in reveal mode**: Currently the Timeline scrub bar shows all task segments. In reveal mode, should future segments also be hidden? Recommend: keep scrub bar showing all segments in both modes so the user can still see/seek the full timeline.
