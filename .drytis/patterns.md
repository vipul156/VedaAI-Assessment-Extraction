# Patterns

## Language
- TypeScript strict. No `any` (eslint `@typescript-eslint/no-explicit-any`). Domain types live in `src/lib/types.ts` only.
- Server-only code must never be imported by client components. Route handlers export `runtime = "nodejs"` when using sharp/pdfjs.

## Naming
- Files: components `PascalCase.tsx`, libs `camelCase.ts`, tests `*.test.ts` colocated under `src/__tests__/`.
- Functions: verbs (`parseQuestions`, `mapAnswers`, `normalizeLabel`).
- Zod schemas named `XSchema`, inferred types `X`.

## Errors
- `throw new AppError(code, message, status)` from `lib/errors.ts`. Routes catch and return the envelope `{ error: { code, message } }`. Never leak stack traces or model names.
- AI/JSON parse failures → one retry with "repair" prompt, then degrade (skip page, note it in `result.notes`).

## Logging
- `lib/logger.ts` → single-line JSON: `{ ts, level, event, jobId?, ms?, ...}`. No secrets, no base64 blobs.

## Validation
- Zod at every boundary: upload metadata, VLM JSON, API responses. `safeParse` + explicit error mapping.

## Tests (vitest)
- Unit tests for pure functions: `questionParser`, `labelNormalizer`, `matcher`, `spanMerge`, `bbox` math, `summary` aggregation.
- Integration: API route tests via `next` route handlers invoked directly with `Request` objects; fake model injected via `lib/ai` factory override (env `VEDA_FAKE_MODEL=1` uses fixture responses) so CI is deterministic.
- No browser tests here — tester agent covers those.

## Styling
- Tailwind v4 utilities only; palette: `#1F2937` (ink), `#F97316` (accent orange), `#F8FAFC` (canvas), statuses: green `#16A34A`, red `#DC2626`, amber `#D97706`, gray.
- Component-local styles via `className`; no CSS modules.

## Env access
- `process.env.X` only, always through `lib/ai` or `lib/config`. Never hardcode URLs/keys/ports.
