import { describe, expect, it } from "vitest";
import { mapAnswers, type RawAnswer } from "@/lib/mapping/matcher";
import type { Question } from "@/lib/types";

const qs: Question[] = [
  { id: "q1", displayLabel: "1", number: 1, subpart: null, text: "Q1", marks: 2, source: "text", order: 1 },
  { id: "q2", displayLabel: "3 (a)", number: 3, subpart: "a", text: "Q3a", marks: 2, source: "text", order: 2 },
  { id: "q3", displayLabel: "3 (b)", number: 3, subpart: "b", text: "Q3b", marks: 1, source: "text", order: 3 },
  { id: "q4", displayLabel: "7", number: 7, subpart: null, text: "Q7", marks: 4, source: "text", order: 4 },
];

const r = (i: number, over: Partial<RawAnswer> = {}): RawAnswer => ({
  id: `a${i}`,
  label: null,
  text: "",
  page: 1,
  region: { page: over.page ?? 1, x: 50, y: 100 * i, w: 900, h: 80 },
  continuation: false,
  confidence: 0.9,
  ...over,
});

describe("mapAnswers", () => {
  it("maps exact labels including subparts, out-of-order ok", () => {
    const answers = mapAnswers(
      [r(1, { label: "7", page: 1 }), r(2, { label: "3(b)", page: 1 }), r(3, { label: "Q. 3(a)", page: 2 }), r(4, { label: "1.", page: 2 })],
      qs,
    );
    expect(answers.find((a) => a.id === "a1")?.mappedQuestionId).toBe("q4");
    expect(answers.find((a) => a.id === "a2")?.mappedQuestionId).toBe("q3");
    expect(answers.find((a) => a.id === "a3")?.mappedQuestionId).toBe("q2");
    expect(answers.find((a) => a.id === "a4")?.mappedQuestionId).toBe("q1");
  });

  it("flags label not in paper", () => {
    const answers = mapAnswers([r(1, { label: "14", page: 1 })], qs);
    expect(answers[0].mappedQuestionId).toBeNull();
    expect(answers[0].unmatchedReason).toBe("label_not_in_paper");
  });

  it("flags duplicate answers for the same question", () => {
    const answers = mapAnswers([r(1, { label: "7" }), r(2, { label: "7", page: 2 })], qs);
    expect(answers[0].mappedQuestionId).toBe("q4");
    expect(answers[1].mappedQuestionId).toBeNull();
    expect(answers[1].unmatchedReason).toBe("duplicate_answer_for_question");
  });

  it("merges continuation pages into one multi-region answer", () => {
    const answers = mapAnswers(
      [
        r(1, { label: "7", page: 1 }),
        r(2, { label: "contd.", page: 2 }),
        r(3, { label: "contd", page: 3 }),
        r(4, { label: "1", page: 3 }),
      ],
      qs,
    );
    expect(answers).toHaveLength(2);
    const q7 = answers[0];
    expect(q7.mappedQuestionId).toBe("q4");
    expect(q7.regions).toHaveLength(3);
    expect(q7.regions.map((rg) => rg.page)).toEqual([1, 2, 3]);
  });

  it("unlabeled answers pass through unmapped; low-confidence flagged", () => {
    const highConf = mapAnswers([r(1, { label: null, confidence: 0.7 })], qs);
    expect(highConf[0].mappedQuestionId).toBeNull();
    expect(highConf[0].unmatchedReason).toBeUndefined();
    const lowConf = mapAnswers([r(1, { label: null, confidence: 0.3 })], qs);
    expect(lowConf[0].mappedQuestionId).toBeNull();
    expect(lowConf[0].unmatchedReason).toBe("unlabeled_low_confidence");
  });
});
