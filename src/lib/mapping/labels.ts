import type { NormalizedLabel } from "@/lib/types";

/**
 * Normalize a printed or handwritten question label into {number, subpart}.
 * Handles: "12", "12.", "Q. 3", "Q3)", "3 (b)", "3(b)", "11 (a)", "11a)",
 * "Q. 3(b)", "(c)" [subpart-only], "" → null.
 */
export function normalizeLabel(raw: string): NormalizedLabel | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // strip common prefixes like "Q", "Q.", "Question", "Ans", "A"
  s = s.replace(/^Q(?:uestion)?\.?\s*(?=\d)/i, "").trim();

  const m = s.match(/^(\d{1,3})\s*(?:[\.\):\-]?\s*(?:\(?([a-hA-H][\dIVXivx]?)\)?)?)?\s*[\.\):\-]?$/);
  if (!m) return null;
  const number = parseInt(m[1], 10);
  if (!Number.isFinite(number) || number < 1) return null;
  let subpart: string | null = m[2] ?? null;
  if (subpart) {
    subpart = subpart.toLowerCase();
    // "3)" style where the letter got captured — fine; strip trailing punct
    subpart = subpart.replace(/[)\.\-:]+$/, "");
    if (!subpart) subpart = null;
  }
  return { number, subpart };
}

/** True when label has only a subpart like "(c)" with no number. */
export function isSubpartOnly(raw: string): boolean {
  return /^\(?\s*[a-hA-H][\dIVXivx]?\s*\)?$/.test(raw.trim());
}

/** Canonical key for matching: "3" or "3|b" */
export function labelKey(l: NormalizedLabel): string {
  return l.subpart ? `${l.number}|${l.subpart}` : `${l.number}`;
}

/** Human-facing display: "3" or "3 (b)" */
export function displayLabel(l: NormalizedLabel): string {
  return l.subpart ? `${l.number} (${l.subpart})` : `${l.number}`;
}
