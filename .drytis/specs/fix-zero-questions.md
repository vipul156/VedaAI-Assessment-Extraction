# Fix: Zero Questions Returned on Image Uploads

## Problem

When users upload images of quiz/assessment papers, the pipeline returns 0 questions even though the LLM successfully extracts them. Two root causes:

### Root Cause 1: Label format mismatch (ALL questions dropped)
- The LLM returns labels like `"Q1: Science"`, `"Q2: Math"` — the subject name is attached.
- `normalizeLabel()` in `src/lib/mapping/labels.ts` has a regex that only matches pure number labels (`"12"`, `"11 (a)"`, `"Q.3(b)"`).
- Trailing text like `": Science"` causes the regex to fail → `null` returned → question silently dropped in `questionsFromVision()`.
- **All 10 questions get dropped**, resulting in 0 questions.

### Root Cause 2: Vision call failures silently swallowed
- When the LLM call throws (e.g., 429 rate limit, timeout, malformed JSON), the per-page `try/catch` in `extractQuestionsNode` logs a warning and adds a note but the job completes as "done" with 0 questions.
- The user sees a results page with "0 extracted" and no indication of what went wrong.
- Same issue in `extractAnswersNode`.

### Root Cause 3: Prompt doesn't forbid subject-in-label
- `QUESTION_EXTRACTION_PROMPT` says "label = the question number EXACTLY as printed" — but quiz papers print `Q1: Science`, so the LLM includes the subject.

## Files to Change

1. `src/lib/mapping/labels.ts` — Fix `normalizeLabel()` to extract the leading number even when trailing text follows (e.g., `"Q1: Science"` → `{number: 1, subpart: null}`).
2. `src/lib/ai/prompts.ts` — Update `QUESTION_EXTRACTION_PROMPT` to explicitly instruct: label should contain ONLY the question number, not the subject or category name.
3. `src/lib/pipeline/graph.ts` — Improve error surfacing: collect vision failures into a `warnings` list that propagates to the result, so the user can see WHY extraction returned 0.
4. `src/lib/pipeline/state.ts` — Add `warnings: string[]` to pipeline state if not already present.
5. `src/lib/types.ts` — Add `warnings?: string[]` to result type if needed.
6. `src/__tests__/` — Add/update tests for:
   - `normalizeLabel("Q1: Science")` → `{number: 1, subpart: null}`
   - `normalizeLabel("Q10: General")` → `{number: 10, subpart: null}`
   - `normalizeLabel("3(b): History")` → `{number: 3, subpart: "b"}`
   - `questionsFromVision()` with subject-suffixed labels returns non-empty
   - Error surfacing: when vision call fails, warnings are populated

## Acceptance Criteria

- [ ] `normalizeLabel("Q1: Science")` returns `{number: 1, subpart: null}`
- [ ] `normalizeLabel("Q10: General")` returns `{number: 10, subpart: null}`
- [ ] `normalizeLabel("3(b): Some Subject")` returns `{number: 3, subpart: "b"}`
- [ ] `normalizeLabel("12")` still returns `{number: 12, subpart: null}` (no regression)
- [ ] `normalizeLabel("11 (a)")` still returns `{number: 11, subpart: "a"}` (no regression)
- [ ] `QUESTION_EXTRACTION_PROMPT` explicitly tells the LLM to return ONLY the question number as the label, not the subject/category
- [ ] When vision call fails, the result includes a `warnings` array explaining the failure
- [ ] The `warnings` are visible in the results page UI (or at least in the result JSON)
- [ ] All existing tests pass
- [ ] New tests for the label parsing fix pass
- [ ] Manual test: uploading the quiz images should return all 10 questions

## Test Plan

### Unit Tests
- `normalizeLabel` with various inputs including trailing text
- `questionsFromVision` with LLM-style output containing subject labels

### Integration Tests
- Full pipeline with FakeListChatModel returning subject-suffixed labels → questions parsed correctly
- Full pipeline where FakeListChatModel throws → warnings populated, job still completes

### Manual/Browser Test
- Upload the three user quiz images via the UI → verify questions are extracted