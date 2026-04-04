## Plan: Embed TaskViz in Astro via Package Dependency

Use **one deployed Astro site** as the GitHub Pages host, but keep the visualizer code in this repo as the **single source of truth** and consume it from the Astro repo as a package/library dependency. You will first complete the work in the `visualizer` repo, publish it to GitHub manually, and then later apply the Astro-side integration in the separate site repo using a **GitHub dependency pinned to a tag**.

### Track 1 — Actions in the `visualizer` repo

1. **Extract a reusable embeddable entry point**
   - Create a shared Vue component such as `visualizer\src\components\TaskVizEmbed.vue` that contains the loaded-session experience currently inside `App.vue`.
   - Move the current `loadWorkflow()` + layout pipeline from `App.vue` into the embed component or a small composable so it can be driven entirely by props.
   - Keep `App.vue` as the standalone CLI/demo shell, but have it reuse the shared embed logic where practical so there is one core implementation.

2. **Add the public props needed by the Astro site**
   - `jsonlPath: string` — URL/path to a static `.jsonl` file that the Astro site will serve from its own `public/` folder.
   - `theme: ThemeName` — initial theme, wired into `setTheme()` from `src/lib/theme.ts`.
   - `defaultMode: PlaybackMode` — initial `'preview'` or `'reveal'`, wired into the existing `playbackMode` state used by `GraphView.vue` and `Timeline.vue`.
   - `autoplayWhenVisible: boolean` — if true, begin playback after the workflow has loaded and the component enters the viewport.
   - Recommended optional prop: `height?: string` so the embed fits naturally inside a blog page instead of staying hardcoded at `100vh`.

3. **Refactor loading around `jsonlPath` for embedded usage**
   - Replace the current `onMounted()` dependency on `window.__TASKVIZ_DATA__` with a watcher that fetches the file at `jsonlPath`, reads the JSONL text, then calls the same `parseWorkflow()` → `buildGraphData()` → `runLayout()` → `mergeLayout()` flow.
   - Preserve the current error handling from `App.vue` so fetch and parse failures surface in-component.
   - Keep the CLI path separate: `App.vue` may still support `window.__TASKVIZ_DATA__`, but the exported embed should rely on prop-driven file loading.

4. **Implement viewport-triggered autoplay and prop-driven theme behavior**
   - Reuse `play()`/`pause()` from `src/composables/usePlayback.ts`.
   - Inside the embed component, attach an `IntersectionObserver` to the root container.
   - If `autoplayWhenVisible` is true, start playback only after the workflow is parsed, layout is ready, and the component is sufficiently visible.
   - In embedded mode, let the incoming theme prop win over `localStorage` persistence so the Astro page controls the presentation reliably.

5. **Package the repo for external consumption**
   - Add a stable public export from this repo, ideally through an entry such as `src/embed.ts`, that re-exports `TaskVizEmbed.vue` and any supported prop types.
   - Update `visualizer\package.json` exports so the Astro repo can import from the package cleanly, e.g. `import { TaskVizEmbed } from 'taskviz'`.
   - Adjust `visualizer\vite.config.ts` only as needed to support a consumable package build alongside the current standalone app/CLI build.

6. **Publish the visualizer repo to GitHub and tag a release**
   - Push the updated repo to GitHub manually.
   - Create a version tag such as `v1.2.0` once the embeddable package entry is stable.
   - This tag becomes the pinned dependency target for the Astro site CI/builds.

### Track 2 — Later actions in the Astro site repo

1. **Add the visualizer as a dependency**
   - In local development, the Astro repo can use a sibling dependency such as `file:../visualizer` while iterating.
   - For CI and production builds, switch to a **GitHub dependency pinned to a tag**, e.g. `github:owner/visualizer#v1.2.0`, so the Astro build always uses a known-good version.

2. **Create the Astro wrapper island**
   - Add `src/components/TaskViz.astro` in the Astro repo as a thin wrapper around the imported Vue component.
   - Use Astro’s Vue integration (`@astrojs/vue`) and hydrate the component with `client:visible`.

3. **Host the workflow data in the Astro site**
   - Put `.jsonl` files under `astro-site/public/taskviz/` and pass paths like `/taskviz/my-run.jsonl` to `jsonlPath`.
   - Keep the JSONL files in the Astro repo, not the visualizer package, since they are site content rather than library code.

4. **Configure and deploy the Astro site on GitHub Pages**
   - Set the correct `site` and `base` in `astro.config.mjs` for the repository subpath.
   - Deploy only the Astro site to GitHub Pages; the visualizer does **not** need its own separate Pages deployment.

5. **Update workflow for future changes**
   - When the embed changes in the visualizer repo, cut a new tag such as `v1.2.1`.
   - Update the Astro repo dependency to that tag and rebuild.
   - This keeps updates explicit, versioned, and reproducible without copying Vue files between repos.

**Relevant files — `visualizer` repo**
- `visualizer\src\App.vue` — current all-in-one shell; source of `workflow`, `layout`, `playbackMode`, and `loadWorkflow()`.
- `visualizer\src\components\TaskVizEmbed.vue` — new embeddable Vue component to expose publicly.
- `visualizer\src\composables\usePlayback.ts` — reusable playback logic for autoplay.
- `visualizer\src\lib\theme.ts` — `ThemeName`, `themeOptions`, `currentThemeName`, and `setTheme()`.
- `visualizer\src\lib\parser.ts` — existing JSONL parsing/validation pipeline.
- `visualizer\src\lib\graphLayout.ts` — existing ELK graph build/layout pipeline.
- `visualizer\src\components\GraphView.vue` — already respects the `playbackMode` prop.
- `visualizer\src\components\Timeline.vue` — already exposes the preview/reveal mode toggle.
- `visualizer\src\main.ts` — standalone mount for the current full-page app.
- `visualizer\package.json` — add package exports for the embeddable entry point.
- `visualizer\vite.config.ts` — adjust only as needed to support the consumable package build.

**Relevant files — Astro site repo**
- `astro-site/package.json` — consume the visualizer via a GitHub dependency pinned to a tag.
- `astro-site/src/components/TaskViz.astro` — thin Astro wrapper around the imported Vue island.
- `astro-site/public/taskviz/*.jsonl` — static workflow files served by the Astro site itself.
- `astro-site/astro.config.mjs` — Astro GitHub Pages `site`/`base` + Vue integration.

**Verification**
1. In `visualizer`, run `npm run typecheck` after the refactor to confirm the extracted component and exports remain type-safe.
2. In `visualizer`, run `npm run build` to ensure the existing standalone/CLI build still succeeds.
3. After publishing to GitHub, confirm the repo tag intended for Astro consumption exists and points to the correct commit.
4. Later, in the Astro site repo, install the dependency from the visualizer GitHub repo and verify the import resolves correctly.
5. Run the Astro local dev server and verify four scenarios:
   - a valid `jsonlPath` from `public/taskviz/` loads the graph,
   - theme prop changes the visual palette,
   - `defaultMode='reveal'` starts in reveal mode,
   - `autoplayWhenVisible=true` starts playback when the component scrolls into view.
6. Build the Astro site for GitHub Pages and confirm the generated page resolves both the imported island assets and the `.jsonl` files under the repo `base` path.

**Decisions**
- Chosen approach: **package/library dependency** with one GitHub Pages deployment hosted by the Astro site.
- The `visualizer` repo is completed and published first; the Astro site integration happens later in its own repo.
- CI should use a **GitHub dependency pinned to a tag**.
- Exclude from scope unless wanted later: npm publishing, separate Pages hosting for the visualizer, SSR-only rendering, or replacing the current CLI generator.

**Further Considerations**
1. If you want the embed to feel more article-friendly, add a `height` prop and optionally a `showChrome` prop to hide upload/close controls in embedded contexts.
2. If the package surface should stay minimal, export only the main `TaskVizEmbed` component and the public prop/type definitions, not all internal helpers.