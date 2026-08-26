import type { Answer, Question } from "@/lib/types";
import { labelKey, normalizeLabel } from "@/lib/mapping/labels";

export interface RawAnswer {
  id: string;
  label: string | null;
  text: string;
  page: number;
  region: { page: number; x: number; y: number; w: number; h: number };
  continuation: boolean;
  confidence: number;
}

const CONTINUATION_RE = /(cont(?:inued|d)?\.?(?:\s*from)?|\.{3,}|…|p\.?\s*t\.?o\.?)/i;

/**
 * Deterministic-first answer mapping:
 * 1. exact normalized label match (handles out-of-order answers and subparts)
 * 2. continuation flags merge regions into the previous answer (multi-page spans)
 * 3. remaining labeled answers with no matching question -> unmatched (label_not_in_paper
 *    or duplicate label)
 * 4. unlabeled answers -> left for caller to route (VLM assist or unmatched)
 */
export function mapAnswers(
  rawAnswers: RawAnswer[],
  questions: Question[],
): Answer[] {
  const qByKey = new Map<string, Question>();
  for (const q of questions) qByKey.set(labelKey({ number: q.number, subpart: q.subpart }), q);

  // Walk sorted answers, merging continuation regions into the head answer.
  const sorted = [...rawAnswers].sort((a, b) =>
    a.page - b.page || a.region.y - b.region.y,
  );

  // Build final answers with regions: walk sorted list, merging continuation regions
  const answers: Answer[] = [];
  let pending: { head: RawAnswer; regions: RawAnswer["region"][] } | null = null;

  const flush = () => {
    if (!pending) return;
    const { head, regions } = pending;
    let mappedQuestionId: string | null = null;
    let unmatchedReason: string | undefined;
    const norm = head.label !== null ? normalizeLabel(head.label) : null;
    if (norm) {
      const q = qByKey.get(labelKey(norm)) ?? null;
      if (q) {
        if (answers.some((ans) => ans.mappedQuestionId === q.id)) {
          unmatchedReason = "duplicate_answer_for_question";
        } else {
          mappedQuestionId = q.id;
        }
      } else {
        unmatchedReason = "label_not_in_paper";
      }
    } else if (head.label === null) {
      unmatchedReason = head.confidence < 0.5 ? "unlabeled_low_confidence" : undefined;
    }
    answers.push({
      id: head.id,
      label: head.label,
      text: head.text,
      regions: regions.sort((r1, r2) => r1.page - r2.page || r1.y - r2.y),
      page: head.page,
      confidence: head.confidence,
      mappedQuestionId,
      unmatchedReason,
    });
    pending = null;
  };

  for (const a of sorted) {
    const isCont =
      a.continuation ||
      (a.label !== null && CONTINUATION_RE.test(a.label)) ||
      (a.label === null && CONTINUATION_RE.test(a.text.slice(0, 40)));
    if (isCont && pending) {
      pending.regions.push(a.region);
      continue;
    }
    flush();
    pending = { head: a, regions: [a.region] };
  }
  flush();

  return answers;
}

export const UNMATCHED_REASONS = {
  LABEL_NOT_IN_PAPER: "label_not_in_paper",
  DUPLICATE: "duplicate_answer_for_question",
  UNLABELED_LOW_CONFIDENCE: "unlabeled_low_confidence",
} as const;
