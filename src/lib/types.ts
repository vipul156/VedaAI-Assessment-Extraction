export type DocKind = "question_paper" | "answer_sheet";

export interface PageImage {
  page: number;
  width: number;
  height: number;
  url: string;
}

export interface Question {
  id: string;
  displayLabel: string;
  number: number;
  subpart: string | null;
  text: string;
  marks: number | null;
  source: "text" | "vision";
  order: number;
}

export interface Region {
  page: number;
  /** all coords normalized to 0-1000 grid of that page */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Answer {
  id: string;
  label: string | null;
  text: string;
  regions: Region[];
  page: number;
  confidence: number;
  mappedQuestionId: string | null;
  unmatchedReason?: string;
}

export type Verdict = "correct" | "partial" | "incorrect" | "unanswered";

export interface GradedQuestion {
  questionId: string;
  verdict: Verdict;
  awarded: number | null;
  outOf: number | null;
  feedback: string;
  keyPoints?: string[];
}

export interface Summary {
  totalAwarded: number | null;
  totalOutOf: number | null;
  percent: number | null;
  answered: number;
  unanswered: number;
  unmatched: number;
  overallFeedback: string;
}

export interface JobResult {
  jobId: string;
  questions: Question[];
  answers: Answer[];
  graded: GradedQuestion[];
  summary: Summary;
  answerPages: PageImage[];
  questionPages: PageImage[];
  notes: string[];
}

export type JobPhase =
  | "queued"
  | "preparing"
  | "extracting_questions"
  | "extracting_answers"
  | "mapping"
  | "grading"
  | "done"
  | "error";

export interface JobState {
  jobId: string;
  phase: JobPhase;
  progress: number;
  message?: string;
  error?: { code: string; message: string };
  result?: JobResult;
  createdAt: number;
  updatedAt: number;
}

export type NormalizedLabel = { number: number; subpart: string | null };
