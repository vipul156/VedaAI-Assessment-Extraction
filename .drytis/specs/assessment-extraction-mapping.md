# Task: AI Assessment Extraction & Answer Mapping — full build

## Goal
Teacher uploads question paper + handwritten answer sheet (PDF/images) → extract questions (printed order, sub-parts split, original numbering) → extract answers with exact regions → map (out-of-order, unanswered, unmatched, multi-page) → grade + AI feedback + summary. Side-by-side results with bbox highlight on question click.

## Files to create/modify
- `src/lib/types.ts`, `errors.ts`, `logger.ts`, `rateLimit.ts`, `id.ts`
- `src/lib/ai/{client.ts,prompts.ts}` — env-driven ChatOpenAI factory
- `src/lib/extraction/{rasterize.ts,textLayer.ts,questionParser.ts}`
- `src/lib/mapping/{labels.ts,matcher.ts}`
- `src/lib/grading/grader.ts`
- `src/lib/pipeline/{state.ts,graph.ts}`
- `src/lib/jobs/store.ts`
- `src/app/api/{analyze,jobs/[id],files/[jobId]/[doc]/[page],health}/route.ts`
- `src/app/page.tsx`, `src/app/results/[jobId]/page.tsx`
- `src/components/*` (Sidebar, TopBar, DropZone, FileCard, QuestionList, QuestionItem, StatusBadge, MarksPill, AnswerSheetViewer, RegionOverlay, GradingPanel, SummaryCard, UnmatchedPanel, ProgressSteps)
- `src/__tests__/*.test.ts`, `fixtures/` generator
- `.drytis/specs/*` (this file), vitest config, setup script update

## Acceptance criteria
- [ ] Upload accepts PDF + PNG/JPG/WEBP per drop zone; rejects >10MB or wrong MIME with 413/415; both zones required for Start Mapping; file cards show name/size/pages with remove.
- [ ] Processing screen shows live phase + progress from polling; errors surface readably.
- [ ] Every question extracted in printed order; `11 (a)` and `11 (b)` are separate entries; `displayLabel` preserves printed numbering; marks captured when printed.
- [ ] Answers extracted with ≥1 normalized region (0–1000 grid); continuation pages merged into one answer with multiple regions.
- [ ] Deterministic mapping handles: exact label match incl. subparts, out-of-order answers, `Q.3(b)` styles; unmatched answers bucketed with reason; unanswered questions flagged.
- [ ] Clicking a question scrolls the answer-sheet viewer to the page containing its region and highlights the exact bbox; multi-page regions highlight on every page they appear.
- [ ] Per-question grading: verdict correct/partial/incorrect/unanswered, awarded/outOf, feedback; overall summary with totals and paragraph.
- [ ] API error envelope on all failure paths; rate limited; health endpoint 200.
- [ ] No hardcoded URLs/keys/creds; AI config via env only.
- [ ] Unit tests green for parser/normalizer/matcher/merge/summary; integration test of `/api/analyze` + `/api/jobs/:id` with fake model; tester agent PASS on live preview.
- [ ] Production background service runs `npm run start` (no dev server); setup script installs + builds.

## Tests
- Unit: questionParser (labels, subparts, marks, order), normalizeLabel variants, matcher (exact/subpart/out-of-order/missing/unlabeled), spanMerge continuation, summary aggregation null-safety.
- Integration: fake AI (fixture JSON) → analyze → poll → assert full JobResult shape, mapping outcomes, file serving.
- Browser (tester agent): upload fixture files → progress → results → click Q → highlight visible.

## Edge cases
- Scanned (image-only) question paper → vision path. Text-layer PDF → deterministic path.
- Answer labeled "14" when paper has 12 questions → unmatched, reason label_not_in_paper.
- Answer with no label → VLM-assisted mapping or unmatched (reason unlabeled_low_confidence).
- Unanswered question → verdict unanswered, 0 marks, no region.
- Multi-page answer → regions array length >1 across different pages.
- Corrupt PDF → AppError bad_request, job phase=error, readable message.
