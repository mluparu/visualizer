## Plan: Add cost + TTFT support

Add optional `cost` and `ttft` fields end-to-end in the workflow schema, parser, and SVG task-card rendering, then refresh the generator skill and sample JSONL files. Recommended approach: keep the JSON key lowercase as `ttft`, validate `ttft <= (endTime - startTime)`, render `cost` in the lower-left and `duration`/`TTFT` in the lower-right so the labels do not overlap.

**Steps**
1. **Phase 1 — Schema + validation**
   - Extend `TaskEvent` and `GraphNode` in `d:\blog\visualizer\src\lib\types.ts` with optional `cost?: number` and `ttft?: number`.
   - Update `validateTask()` in `d:\blog\visualizer\src\lib\parser.ts` to accept the new optional numeric fields, reject invalid/negative values, and enforce `ttft <= endTime - startTime` while preserving the existing prompt-token rules.
   - Pass the parsed values through the returned task objects so the layout/rendering pipeline receives them.
2. **Phase 2 — Node layout + rendering**
   - Update node height calculations in `d:\blog\visualizer\src\lib\graphLayout.ts` for both top-level tasks and compound child tasks so added labels have vertical space and do not collide with cache-key/token-bar content.
   - Update `d:\blog\visualizer\src\components\GraphView.vue` to compute per-task duration from `endTime - startTime` and render:
     - `cost` as a bold lower-left label prefixed with `$`
     - duration as a bold lower-right label like `12s`
     - `TTFT: Ns` beneath the duration in smaller right-aligned text when `ttft` exists
   - Apply the same visual rules to child task cards inside compound nodes.
   - Optionally update `d:\blog\visualizer\src\components\Inspector.vue` to show `cost` and `TTFT` in the selected-task details for consistency.
3. **Phase 3 — Documentation + skill updates**
   - Update the schema/docs tables in `d:\blog\visualizer\README.md` and `d:\blog\visualizer\.github\skills\generate-workflow\references\schema.md` to list `cost` and `ttft` and document the `ttft <= duration` constraint.
   - Update `d:\blog\visualizer\.github\skills\generate-workflow\SKILL.md` and `d:\blog\visualizer\.github\skills\generate-workflow\references\examples.md` so generated workflows may include realistic `cost` and `ttft` values and the validation guidance stays accurate.
4. **Phase 4 — Sample data refresh**
   - Update `d:\blog\visualizer\samples\*.jsonl` with representative `cost` and `ttft` values, ensuring each `ttft` is less than or equal to its task duration and values match the scenario complexity.
   - Prioritize `fan-out-fan-in.jsonl`, `ci-pipeline.jsonl`, `linear-chain.jsonl`, `large-scale.jsonl`, and `nested-groups.jsonl`, then align the remaining samples for consistency.

**Relevant files**
- `d:\blog\visualizer\src\lib\types.ts` — add the optional schema fields to `TaskEvent` and `GraphNode`
- `d:\blog\visualizer\src\lib\parser.ts` — validation and parsing rule for `ttft <= duration`
- `d:\blog\visualizer\src\lib\graphLayout.ts` — node/child height expansion for the new labels
- `d:\blog\visualizer\src\components\GraphView.vue` — render lower-corner labels for `cost`, duration, and `TTFT`
- `d:\blog\visualizer\src\components\Inspector.vue` — optional detail-panel parity for the new fields
- `d:\blog\visualizer\README.md` — public JSONL schema docs
- `d:\blog\visualizer\.github\skills\generate-workflow\SKILL.md` — skill guidance for generated workflows
- `d:\blog\visualizer\.github\skills\generate-workflow\references\schema.md` — authoritative skill-side schema reference
- `d:\blog\visualizer\.github\skills\generate-workflow\references\examples.md` — examples updated with `cost`/`ttft`
- `d:\blog\visualizer\samples\*.jsonl` — sample workflows updated with the new optional properties

**Verification**
1. Run `npm run typecheck` from `d:\blog\visualizer` to confirm the new types and component bindings compile.
2. Run `npm run build` from `d:\blog\visualizer` to verify the production bundle still builds successfully.
3. Generate at least one updated report, e.g. `node bin/taskviz.js samples/fan-out-fan-in.jsonl -o out/fan-out-fan-in.html --no-open`, and visually confirm all three states: cost-only, duration-only, and duration+TTFT.
4. Manually inspect compound child tasks and token-bar tasks to ensure the new labels do not overlap existing cache metadata.
5. Validate one negative case locally by temporarily setting `ttft` above a task duration and confirming the parser raises a clear error.

**Decisions**
- Use lowercase JSON field name `ttft` to stay consistent with the existing schema style.
- Use `cost` in the lower-left and `duration`/`TTFT` in the lower-right to avoid text overlap inside task cards.
- Included scope: schema/types, parser validation, graph rendering, skill docs, and sample JSONL updates.
- Excluded scope: workflow-level cost aggregation, timeline redesign, or any new analytics beyond per-task display.
