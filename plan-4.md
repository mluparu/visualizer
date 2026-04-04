## Plan: Theme Dropdown Selector

Add a reactive theme system with **5 selectable color themes** and expose it through a dropdown in the **top-right header** of `d:\blog\visualizer\src\App.vue`. The recommended approach is to replace the current single exported `theme` object in `src/lib/theme.ts` with a small theme registry plus a `useTheme` composable so the choice updates all views immediately and can persist across reloads.

**Steps**
1. **Audit and centralize theme data**
   - Refactor `d:\blog\visualizer\src\lib\theme.ts` so it defines a shared theme shape and exports 5 named themes with the same token structure already used in the app (`bg`, `fg`, `border`, `accent`, `font`, `fontSize`, `radius`).
   - Keep typography/radius tokens shared unless a theme specifically needs overrides.
   - Recommended set: `Midnight` (current dark), `Light`, `Ocean`, `Forest`, `Sunset`.

2. **Introduce reactive theme state**
   - Add `d:\blog\visualizer\src\composables\useTheme.ts` to own the selected theme name and expose the active theme as a computed value.
   - Persist the selection in `localStorage` with a safe fallback to the default theme if the stored key is missing/invalid.
   - This step blocks the UI wiring in later steps.

3. **Wire the selector into the app shell**
   - Update `d:\blog\visualizer\src\App.vue` to consume the reactive theme state.
   - Add a dropdown control in the header’s top-right area, before the close/reset button, styled using the active theme tokens.
   - Replace direct `theme.*` lookups in `App.vue` with the reactive active theme reference.

4. **Propagate the active theme to child views**
   - Update `d:\blog\visualizer\src\components\GraphView.vue`, `d:\blog\visualizer\src\components\Timeline.vue`, and `d:\blog\visualizer\src\components\Inspector.vue` so they render from the active theme instead of the static import.
   - Preferred implementation: pass the active theme from `App.vue` as a prop to keep one source of truth; acceptable alternative: have each component consume the shared composable.
   - Verify any helper colors such as status chips stay readable under all themes.

5. **Polish accessibility and persistence**
   - Check contrast for text, borders, node fills, and timeline controls in all 5 themes.
   - Ensure the dropdown remains visible in both the landing state and loaded-session state if that is part of the desired UX.
   - Confirm page refresh restores the last selected theme.

6. **Verify behavior**
   - Run the app and confirm the dropdown switches themes instantly without breaking layout.
   - Validate the landing screen, graph canvas, inspector panel, and timeline controls under each theme.
   - If the project already has UI tests, add a lightweight regression check around the selector and persistence; otherwise perform a manual smoke test.

**Relevant files**
- `d:\blog\visualizer\src\App.vue` — add the top-right dropdown and convert shell-level styles to the reactive theme.
- `d:\blog\visualizer\src\lib\theme.ts` — replace the single static theme export with a theme registry and shared token definitions.
- `d:\blog\visualizer\src\composables\useTheme.ts` — new composable for theme selection and persistence.
- `d:\blog\visualizer\src\components\GraphView.vue` — update graph colors to read from the active theme.
- `d:\blog\visualizer\src\components\Timeline.vue` — update controls and timeline visuals to the active theme.
- `d:\blog\visualizer\src\components\Inspector.vue` — update sidebar and metadata styling to the active theme.

**Verification**
1. Start the app and load the current demo workflow; confirm the new dropdown appears in the top-right header.
2. Select each of the 5 themes and verify the background, text, borders, and accent colors update across `App.vue`, `GraphView.vue`, `Timeline.vue`, and `Inspector.vue`.
3. Refresh the page and confirm the last selected theme persists.
4. Check that error states and status colors remain readable in every theme.
5. Run the project’s relevant test/build command after implementation to ensure no Vue/TypeScript regressions.

**Decisions**
- **Included:** 5 built-in themes, dropdown-based selection, full-app reactive styling, persisted choice.
- **Excluded:** custom user-defined theme editing, per-component overrides, theme animation transitions, cross-tab sync.
- **Recommended UX:** show human-friendly labels in the dropdown and default to the existing dark theme so the current look remains intact unless changed.

**Further Considerations**
1. If you want the selector visible even before a workflow is loaded, place the same control in both header/landing layouts or move it to a shared top bar.
2. If future theming grows, consider migrating repeated inline styles toward CSS variables, but that is not required for this task.
