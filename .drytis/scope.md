# Scope

## Modules (in scope)
1. **Upload** — sidebar + top bar + two drop zones (question paper, answer sheet). Accepts PDF/PNG/JPG/WEBP, multiple images per document, ≤10MB per drop zone total. File cards show name/size/pages + remove. "Start Mapping" disabled until both present.
2. **Processing** — live progress: Rasterizing → Extracting questions → Extracting answers → Mapping → Grading. Poll `GET /api/jobs/:id` every 1.2s.
3. **Results** — left: question list (printed order, sub-parts as separate entries with original numbering, status badges Answered/Unanswered/Unmatched, marks); right: answer-sheet page viewer with bbox highlight; clicking a question scrolls to + highlights its region(s), incl. multi-page; grading panel (verdict, awarded/total marks, AI feedback); overall summary card; unmatched-answers bucket.

## Edge cases (required by assignment — all in scope)
- [x] Sub-parts as separate questions: `11(a)` and `11(b)` are two entries
- [x] Original question numbering preserved (`displayLabel` = exactly what's printed)
- [x] Out-of-order answers (answered Q7 before Q3)
- [x] Unanswered questions
- [x] Answers matching no question → unmatched bucket with reason
- [x] Exact region highlight (bbox per page)
- [x] Answers spanning multiple pages (continuation detection)

## Out of scope (per assignment)
- Authentication, persistence/DB, multi-student batch, rubric authoring UI, exports/PDF reports.

## Phases (ordering of work, not durations)
1. Scaffold + blueprint + env + service registration
2. Core libs: parsing (questions from text/VLM), mapping — TDD
3. LangGraph pipeline + AI client + job store
4. API routes
5. UI screens
6. Fixtures + integration tests
7. Infrastructure gate + review + browser test + fixes
