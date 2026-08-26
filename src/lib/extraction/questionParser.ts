import type { Question, NormalizedLabel } from "@/lib/types";
import { isSubpartOnly, normalizeLabel, displayLabel } from "@/lib/mapping/labels";

export interface QuestionItemInput {
  /** raw printed label, e.g. "11 (a)", "Q.3", "12." */
  label: string;
  text: string;
  marks?: number | null;
}

/**
 * Parse questions from a plain-text rendering of a question paper.
 * Splits on lines that START with a question label; attaches subpart-only
 * labels (e.g. "(b)") to the most recent numbered question as separate
 * entries, preserving original numbering.
 */
export function parseQuestionsFromText(
  lines: string[],
  source: "text" | "vision" = "text",
): Question[] {
  const items: { label: NormalizedLabel | null; subOnly: string | null; text: string }[] = [];
  let current: (typeof items)[number] | null = null;

  // Common non-question noise: instructions, notes, section footers.
  const NOISE = /^(?:instructions?|note|notes|end of (?:question )?paper|good luck|\*{3,}|page \d)/i;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (NOISE.test(line.trim())) continue;

    const labelMatch = line.match(
      /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*(?:[\.\):\-]\s*(?:\(([a-hA-H][\dIVXivx]?)\)|([a-hA-H][\dIVXivx]?)[\.\):])|\(([a-hA-H][\dIVXivx]?)\))?[\.\):]?\s+(.*)$/,
    );

    const subOnlyMatch = line.match(/^\(?([a-hA-H][\dIVXivx]?)[\.\):]\s+(.*)$/);

    if (labelMatch) {
      const number = parseInt(labelMatch[1], 10);
      const subRaw = labelMatch[2] ?? labelMatch[3] ?? labelMatch[4] ?? null;
      current = {
        label: { number, subpart: subRaw ? subRaw.toLowerCase() : null },
        subOnly: null,
        text: labelMatch[5] ?? "",
      };
      items.push(current);
    } else if (subOnlyMatch && current && current.label) {
      current = {
        label: { number: current.label.number, subpart: subOnlyMatch[1].toLowerCase() },
        subOnly: subOnlyMatch[1].toLowerCase(),
        text: subOnlyMatch[2] ?? "",
      };
      items.push(current);
    } else if (current) {
      current.text = (current.text + " " + line.trim()).trim();
    }
    // text before any label is treated as header noise (instructions etc.)
  }

  // extract trailing marks like "[5]", "(3 marks)", "(3 M)", "Marks: 4"
  const questions: Question[] = [];
  let order = 0;
  for (const item of items) {
    if (!item.label) continue;
    let text = item.text.trim();
    let marks: number | null = null;
    const marksMatch =
      text.match(/\[\s*(\d{1,3})\s*(?:marks?|m)?\s*\]\s*$/i) ??
      text.match(/\(\s*(\d{1,3})\s*(?:marks?|m)\s*\)\s*$/i) ??
      text.match(/\(\s*(\d{1,3})\s*\)\s*$/);
    if (marksMatch) {
      marks = parseInt(marksMatch[1], 10);
      text = text.slice(0, marksMatch.index).trim();
    }
    if (!text && !item.subOnly) continue; // ignore empty numbered lines
    questions.push({
      id: `q${++order}`,
      displayLabel: displayLabel(item.label),
      number: item.label.number,
      subpart: item.label.subpart,
      text,
      marks,
      source,
      order,
    });
  }

  return sortPrintedOrder(questions);
}

/**
 * Stable printed order: primary by number asc, then subpart (null first,
 * then alphabetical). Keeps original numbering intact while producing a
 * deterministic, readable order.
 */
export function sortPrintedOrder(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      if (a.subpart === null && b.subpart === null) return a.order - b.order;
      if (a.subpart === null) return -1;
      if (b.subpart === null) return 1;
      return a.subpart.localeCompare(b.subpart) || a.order - b.order;
    })
    .map((q, i) => ({ ...q, order: i + 1 }));
}

/** Group vision-extracted question items (already labeled) into Questions. */
export function questionsFromVision(
  items: QuestionItemInput[],
): Question[] {
  const out: Question[] = [];
  let lastNumber: number | null = null;
  let order = 0;
  for (const item of items) {
    let label = normalizeLabel(item.label ?? "");
    if (!label && isSubpartOnly(item.label ?? "") && lastNumber !== null) {
      label = { number: lastNumber, subpart: item.label.trim().replace(/[()\.]/g, "").toLowerCase() };
    }
    if (!label) continue;
    lastNumber = label.number;
    out.push({
      id: `q${++order}`,
      displayLabel: displayLabel(label),
      number: label.number,
      subpart: label.subpart,
      text: item.text.trim(),
      marks: item.marks ?? null,
      source: "vision",
      order,
    });
  }
  return sortPrintedOrder(out);
}
