# Data schemas & API

## Core types (src/lib/types.ts)
```ts
type DocKind = "question_paper" | "answer_sheet";

interface PageImage { page: number; width: number; height: number; url: string; } // url = /api/files/{jobId}/{doc}/{page}

interface Question {
  id: string;                 // q1, q2...
  displayLabel: string;       // exactly as printed: "11 (a)"
  number: number;             // 11
  subpart: string | null;     // "a" | null
  text: string;               // full question text
  marks: number | null;       // printed marks if detected
  source: "text" | "vision";  // how it was extracted
  order: number;              // printed order (stable sort key)
}

interface Region { page: number; x: number; y: number; w: number; h: number; } // 0–1000 normalized

interface Answer {
  id: string;                 // a1, a2...
  label: string | null;       // detected handwritten label, e.g. "11(a)" — null if unlabeled
  text: string;               // transcription
  regions: Region[];          // ≥1, supports multi-page spans
  page: number;               // first region's page (sort key)
  confidence: number;         // 0–1 label confidence
  mappedQuestionId: string | null;
  unmatchedReason?: string;   // when mappedQuestionId is null
}

interface GradedQuestion {
  questionId: string;
  verdict: "correct" | "partial" | "incorrect" | "unanswered";
  awarded: number | null;     // null when marks unknown
  outOf: number | null;
  feedback: string;           // AI feedback, 1–3 sentences
  keyPoints?: string[];
}

interface Summary { totalAwarded: number|null; totalOutOf: number|null; percent: number|null;
  answered: number; unanswered: number; unmatched: number; overallFeedback: string; }

interface JobResult { jobId: string; questions: Question[]; answers: Answer[];
  graded: GradedQuestion[]; summary: Summary; answerPages: PageImage[];
  questionPages: PageImage[]; notes: string[]; }

type JobPhase = "queued" | "preparing" | "extracting_questions" | "extracting_answers" |
  "mapping" | "grading" | "done" | "error";
```

## API
| Method | Path | Body/Params | Response |
|---|---|---|---|
| POST | `/api/analyze` | multipart: `questionPaper[]`, `answerSheet[]` | `{ jobId }` (415/413/422 on bad input) |
| GET | `/api/jobs/:id` | — | `{ jobId, phase, progress: 0–100, message?, error?, result? }` |
| GET | `/api/files/:jobId/:doc/:page` | doc = `question_paper`\|`answer_sheet` | PNG bytes (immutable cache) |
| GET | `/api/health` | — | `{ ok: true }` |

## Error envelope
`{ error: { code: string, message: string } }` — codes: `bad_request`, `too_large`, `unsupported_media`, `job_not_found`, `rate_limited`, `internal`.
