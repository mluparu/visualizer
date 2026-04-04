## Plan: Fullscreen Player-Style Workflow UI

Refactor the loaded-session view into a layered fullscreen player layout: `GraphView` becomes the full-bleed base canvas, `Timeline` moves to a bottom overlay with idle auto-hide while playback is running, and the workflow title/description plus `Inspector` become paused-state overlays so the diagram gets the full surface during playback.

**Steps**
1. **Restructure the session shell in `d:\blog\visualizer\src\App.vue`**
   - Replace the current stacked `header -> timeline -> content` flex layout with a single `position: relative; height: 100vh; overflow: hidden` player shell.
   - Keep `GraphView` as the base layer filling the entire viewport.
   - Render the top metadata panel, bottom controls bar, and inspector as absolute-positioned overlays with explicit z-indexes.
   - Dependency: this is the foundation for all later UI updates.

2. **Add overlay-visibility state and interaction tracking in `d:\blog\visualizer\src\App.vue`**
   - Reuse `playing` from `usePlayback()` to drive overlay behavior.
   - Add lightweight state such as `showControls`, `showTopMeta`, and an idle timer.
   - Recommended behavior:
     - **Paused:** timeline + top metadata stay visible; inspector can appear over the graph when a node is selected.
     - **Playing:** graph takes the full space; controls appear on pointer move/click/seek and auto-hide after ~2.5-3 seconds of inactivity.
   - Hook interactions from container mousemove, click/tap, timeline actions, and node selection to reset/show overlays.

3. **Restyle `d:\blog\visualizer\src\components\Timeline.vue` as a fullscreen player control bar**
   - Keep its existing playback controls and scrub bar logic.
   - Change the outer wrapper from an inline row with border-bottom into a bottom overlay card spanning the viewport width with internal padding, translucent background, and fade transition.
   - Ensure hidden state also disables pointer events so the graph remains fully interactive while playing.
   - This step can proceed in parallel with step 4 once step 2’s visibility contract is defined.

4. **Convert the workflow header and `d:\blog\visualizer\src\components\Inspector.vue` into paused-state overlays**
   - Move the title/description/theme/file summary into a top overlay card in `App.vue` instead of consuming permanent layout height.
   - Update `Inspector.vue` from a fixed right sidebar to a floating panel/card anchored over the graph surface.
   - Preserve the current content structure and close behavior; only change placement, sizing, max-height, scrolling, and overlay styling.
   - Recommended rule: inspector remains selection-based and is shown when paused; while playing it should stay hidden unless the user explicitly pauses or re-engages the UI.

5. **Tune graph interactions in `d:\blog\visualizer\src\components\GraphView.vue` only as needed**
   - Keep pan/zoom/selection behavior intact.
   - Ensure background clicks still clear the selection and that overlay layering does not block wheel zoom or dragging when controls are hidden.
   - If needed, add event forwarding or container-level interaction hooks so pointer movement over the graph reveals the controls.

6. **Refine responsiveness and small-screen behavior**
   - Keep overlays fluid with width constraints like `min()`, `max-width`, and wrap-friendly control layout.
   - On narrow screens, let the bottom controls wrap and reduce top metadata width so the graph stays visible.
   - Ensure the inspector uses `max-height` with internal scroll instead of pushing content.

**Relevant files**
- `d:\blog\visualizer\src\App.vue` — primary shell refactor; overlay visibility state; top metadata panel; control-bar placement.
- `d:\blog\visualizer\src\components\Timeline.vue` — existing control bar and scrubber to restyle as bottom overlay.
- `d:\blog\visualizer\src\components\Inspector.vue` — current right sidebar to convert into floating overlay card.
- `d:\blog\visualizer\src\components\GraphView.vue` — base full-screen interaction surface; keep node selection + pan/zoom working under overlays.
- `d:\blog\visualizer\src\composables\usePlayback.ts` — existing `playing`, `seek`, and transport state reused for overlay rules.
- `d:\blog\visualizer\src\lib\theme.ts` — reuse `theme.bg.overlay`, borders, radii, and `alpha()` for player-style translucent layers.

**Verification**
1. Run `npm run typecheck` from `d:\blog\visualizer` and confirm it exits successfully.
2. Run `npm run build` from `d:\blog\visualizer` and confirm the production build succeeds.
3. Manual UI checks:
   - Load a workflow and verify the graph fills the full viewport.
   - Start playback and confirm the bottom timeline hides after idle time and reappears on mouse movement/click/seek.
   - Pause playback and confirm the title/description overlay is visible over the graph.
   - Select a node while paused and confirm the inspector floats over the diagram without shrinking the graph area.
   - Resize to a narrow viewport and confirm overlays remain usable and do not force layout overflow.

**Decisions**
- Included scope: layout/positioning/visibility behavior for the loaded-session view only.
- Excluded scope: parser/schema changes, graph layout algorithm changes, or redesigning the node visuals themselves.
- Recommended default idle timeout: ~3 seconds during playback.
- Recommended UX rule: while playing, overlay chrome should be ephemeral; while paused, it should remain visible and readable.
