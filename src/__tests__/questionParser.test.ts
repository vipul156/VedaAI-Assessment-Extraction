import { describe, expect, it } from "vitest";
import { normalizeLabel, isSubpartOnly, labelKey, displayLabel } from "@/lib/mapping/labels";
import { parseQuestionsFromText, questionsFromVision, sortPrintedOrder } from "@/lib/extraction/questionParser";

describe("normalizeLabel", () => {
  it.each([
    ["12", { number: 12, subpart: null }],
    ["12.", { number: 12, subpart: null }],
    ["Q. 3", { number: 3, subpart: null }],
    ["Q3)", { number: 3, subpart: null }],
    ["3 (b)", { number: 3, subpart: "b" }],
    ["3(b)", { number: 3, subpart: "b" }],
    ["11 (a)", { number: 11, subpart: "a" }],
    ["11a)", { number: 11, subpart: "a" }],
    ["Q. 3(b)", { number: 3, subpart: "b" }],
    // Labels with trailing text (subject/category names)
    ["Q1: Science", { number: 1, subpart: null }],
    ["Q2: Math", { number: 2, subpart: null }],
    ["Q10: General", { number: 10, subpart: null }],
    ["3(b): History", { number: 3, subpart: "b" }],
    ["1 - Science", { number: 1, subpart: null }],
    ["2. Math", { number: 2, subpart: null }],
    ["Q1. Science quiz", { number: 1, subpart: null }],
  ])("%s -> %j", (input, expected) => {
    expect(normalizeLabel(input)).toEqual(expected);
  });

  it("rejects garbage", () => {
    expect(normalizeLabel("")).toBeNull();
    expect(normalizeLabel("intro")).toBeNull();
    expect(normalizeLabel("0")).toBeNull();
  });
});

describe("isSubpartOnly", () => {
  it("detects (c) and b)", () => {
    expect(isSubpartOnly("(c)")).toBe(true);
    expect(isSubpartOnly("b)")).toBe(true);
    expect(isSubpartOnly("12")).toBe(false);
  });
});

describe("labelKey / displayLabel", () => {
  it("builds canonical keys", () => {
    expect(labelKey({ number: 3, subpart: "b" })).toBe("3|b");
    expect(labelKey({ number: 3, subpart: null })).toBe("3");
    expect(displayLabel({ number: 11, subpart: "a" })).toBe("11 (a)");
    expect(displayLabel({ number: 5, subpart: null })).toBe("5");
  });
});

describe("parseQuestionsFromText", () => {
  const lines = [
    "Class 10 Mathematics — Unit Test",
    "Time: 1 hour    Max Marks: 25",
    "",
    "1. Solve for x: 2x + 3 = 11. [2]",
    "2. Find the area of a circle with radius 7 cm. (3 marks)",
    "3 (a) Differentiate f(x) = x^2. [2]",
    "(b) Evaluate f'(3). [1]",
    "Q. 4 State the Pythagoras theorem. (2 M)",
    "5. A train travels 60 km in 45 minutes. What is its speed in km/h? [3]",
    "Instructions: Attempt all questions.",
  ];

  it("extracts every question with sub-parts split", () => {
    const qs = parseQuestionsFromText(lines);
    expect(qs.map((q) => q.displayLabel)).toEqual([
      "1", "2", "3 (a)", "3 (b)", "4", "5",
    ]);
  });

  it("captures marks", () => {
    const qs = parseQuestionsFromText(lines);
    expect(qs.find((q) => q.displayLabel === "1")?.marks).toBe(2);
    expect(qs.find((q) => q.displayLabel === "2")?.marks).toBe(3);
    expect(qs.find((q) => q.displayLabel === "4")?.marks).toBe(2);
    expect(qs.find((q) => q.displayLabel === "5")?.marks).toBe(3);
  });

  it("marks: 5 gets its [3] and drops trailing instruction noise", () => {
    const qs = parseQuestionsFromText(lines);
    const q5 = qs.find((q) => q.displayLabel === "5");
    expect(q5?.marks).toBe(3);
    expect(q5?.text).not.toContain("Instructions");
  });

  it("joins wrapped lines into the question text", () => {
    const qs = parseQuestionsFromText([
      "1. The perimeter of a rectangle is 36 cm.",
      "If the length is twice the breadth, find both dimensions. [4]",
    ]);
    expect(qs).toHaveLength(1);
    expect(qs[0].text).toContain("twice the breadth");
    expect(qs[0].marks).toBe(4);
  });

  it("handles out-of-order printed numbering by sorting", () => {
    const qs = parseQuestionsFromText([
      "2. Second question first. [1]",
      "1. Actually first. [1]",
      "1(b) B part. [1]",
      "1(a) A part. [1]",
    ]);
    expect(qs.map((q) => q.displayLabel)).toEqual(["1", "1 (a)", "1 (b)", "2"]);
  });
});

describe("questionsFromVision", () => {
  it("attaches subpart-only labels to the last numbered question", () => {
    const qs = questionsFromVision([
      { label: "11 (a)", text: "Prove the identity.", marks: 2 },
      { label: "(b)", text: "Hence solve.", marks: 2 },
      { label: "12", text: "Explain photosynthesis.", marks: 3 },
    ]);
    expect(qs.map((q) => q.displayLabel)).toEqual(["11 (a)", "11 (b)", "12"]);
    expect(qs[1].source).toBe("vision");
  });

  it("drops items without usable labels", () => {
    const qs = questionsFromVision([{ label: "nonsense", text: "x" }]);
    expect(qs).toHaveLength(0);
  });

  it("parses subject-suffixed labels from LLM vision output", () => {
    const qs = questionsFromVision([
      { label: "Q1: Science", text: "What are the three main states of matter?", marks: null },
      { label: "Q2: Math", text: "Solve: 25 x 4 + 10 = ?", marks: null },
      { label: "Q3: History", text: "Who was the first President?", marks: null },
      { label: "Q4: English", text: "Find the verb.", marks: null },
      { label: "Q10: General", text: "Name the seven colors of the rainbow.", marks: null },
    ]);
    expect(qs).toHaveLength(5);
    expect(qs.map((q) => q.displayLabel)).toEqual(["1", "2", "3", "4", "10"]);
    expect(qs[0].text).toBe("What are the three main states of matter?");
    expect(qs[4].number).toBe(10);
  });
});

describe("sortPrintedOrder", () => {
  it("is stable across equal keys", () => {
    const qs = sortPrintedOrder([
      { id: "q1", displayLabel: "2", number: 2, subpart: null, text: "a", marks: null, source: "text", order: 1 },
      { id: "q2", displayLabel: "1", number: 1, subpart: null, text: "b", marks: null, source: "text", order: 2 },
    ]);
    expect(qs.map((q) => q.number)).toEqual([1, 2]);
    expect(qs[0].order).toBe(1);
  });
});
