# VedaAI — AI Assessment Extraction & Answer Mapping

## Overview
Teacher uploads a question paper + one handwritten answer sheet (PDF or images). The app extracts questions in printed order (sub-parts as separate entries), extracts answers with exact page regions, maps answers→questions (out-of-order, unanswered, unmatched, multi-page spans), highlights the clicked question's answer region, and grades with AI feedback + overall summary.

## Tech stack (decided)
- Next.js 15 App Router + TypeScript + Tailwind v4 — matches Figma (white/dark-gray, orange `#F97316`-family accent, left sidebar)
- LangChain + LangGraph `StateGraph` pipeline (prepare → extractQuestions → extractAnswers → map → grade), Zod schemas on every boundary
- Open-source extraction: `pdfjs-dist` (rasterize + embedded text layer fast path), `sharp` (normalize/downscale), `pdf-lib` (page count)
- AI: vision LLM through OpenAI-compatible gateway (key via env `OPENAI_API_KEY`/`OPENAI_BASE_URL`, minted server-side, never hardcoded). Used only for: handwriting OCR-ish extraction, unlabeled-answer mapping assist, grading feedback.
- No DB. In-memory job store with TTL sweep; uploads/pages under `os.tmpdir()` keyed by jobId.

## Key decisions
1. **Hybrid extraction**: if a PDF has an embedded text layer, questions are parsed deterministically (free, exact). VLM is only the fallback / for handwritten answers. This is both cheaper and more accurate.
2. **Normalized bboxes**: every answer region is `{page, x, y, w, h}` on a 0–1000 grid per page; UI scales to rendered size. Multi-page answers = array of regions.
3. **Deterministic-first mapping**: label matcher handles `12`, `12(a)`, `Q.3(b)`, `12.`, `contd.` continuation. VLM fallback only for unlabeled regions.
4. **Pipeline is dataflow, not chat**: every node gets typed state, returns partial state; progress events are written to the job store so polling works.
5. **Graceful degradation**: any node can fail without killing the job — partial results with explicit error notes.

## Constraints honored from the assignment
- Any stack allowed → Next.js (recommended) ✓
- Free/open-source extraction ✓ (pdfjs-dist, sharp, pdf-lib)
- No auth ✓, no DB ✓, in-memory storage ✓
- Deployed live URL ✓ (platform preview + production deploy on request)

See also: scope.md, schema.md, architecture.md, patterns.md, infrastructure.md
