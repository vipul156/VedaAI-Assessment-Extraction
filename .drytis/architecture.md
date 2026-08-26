# Architecture

## Directory structure
```
src/
  app/
    page.tsx                  # upload screen (Figma-faithful)
    results/[jobId]/page.tsx  # processing + results (phase-driven)
    api/
      analyze/route.ts        # POST upload → jobId
      jobs/[id]/route.ts      # GET job state
      files/[jobId]/[doc]/[page]/route.ts  # rasterized page PNGs
      health/route.ts
  components/
    Sidebar.tsx TopBar.tsx DropZone.tsx FileCard.tsx
    QuestionList.tsx QuestionItem.tsx StatusBadge.tsx MarksPill.tsx
    AnswerSheetViewer.tsx RegionOverlay.tsx GradingPanel.tsx SummaryCard.tsx
    UnmatchedPanel.tsx ProgressSteps.tsx
  lib/
    types.ts                  # shared domain types (single source of truth)
    errors.ts                 # AppError + envelope helper
    logger.ts                 # structured JSON logger
    rateLimit.ts              # in-memory limiter
    id.ts                     # id helpers
    ai/                       # model factory (env-driven), prompt templates
    extraction/               # pdfjs rasterizer, text-layer reader, question parser
    mapping/                  # label matcher, span merge, unmatched classifier
    grading/                  # grading logic + prompt
    pipeline/                 # LangGraph StateGraph, nodes, state
    jobs/                     # job store + TTL sweep
  __tests__/                  # unit + integration (vitest)
fixtures/                     # synthetic question/answer images (generated)
```

## Data flow
1. Browser POSTs multipart → route validates (types, sizes, count) → writes files to `os.tmpdir()/vedaai/{jobId}/uploads/` → creates job (phase=queued) → kicks `runPipeline(jobId)` async (fire-and-forget, errors captured into job) → returns `{jobId}`.
2. Results page polls `/api/jobs/:id` → renders processing steps or final result.
3. Pipeline nodes emit progress via job store (`setPhase`, `setProgress`), each phase mapped to 0–100.
4. Page images served from tmp dir; bboxes normalized 0–1000 → client scales by rendered size.

## Extraction strategy (hybrid)
- `question_paper` PDF WITH text layer → `pdfjs-dist` `getTextContent()` → deterministic parser (`lib/extraction/questionParser.ts`) — free + exact.
- PDF without text layer (scanned) or images → VLM page-by-page → Zod-validated JSON.
- `answer_sheet` (handwriting) → always VLM page-by-page → labeled/unlabeled answer regions.

## Mapping strategy (deterministic-first)
1. Normalize labels: `Q. 3 (b)` → `{number:3, subpart:'b'}`; `12.` → `{12, null}`; `contd`/`continued`/`...from prev page` → continuation of previous answer.
2. Exact normalized match question↔answer.
3. Continuation: append region to previous answer's `regions`.
4. Unlabeled answer → VLM assist (content similarity vs question list) with confidence; below threshold → unmatched with reason.
5. Unmatched answers also arise when label number doesn't exist in question set (e.g. answered "14" but paper has 12 questions) — reason: `label_not_in_paper`.

## Grading
- Per question: prompt includes question text + marks + answer transcript → verdict/awarded/feedback (Zod-validated).
- Unanswered → verdict `unanswered`, awarded 0, canned feedback.
- Overall summary aggregates marks (null-safe when marks unknown) + one overall paragraph.

## Production posture
- Node runtime only where needed (`sharp`, `pdfjs-dist` legacy build) — API routes export `runtime = "nodejs"`.
- All AI calls retried (2 retries, exp backoff) + 90s timeout each.
- Job store TTL: 60 min; sweep every 5 min; tmp files removed with job.
- Rate limit: 10 uploads / 10 min / IP (in-memory).
