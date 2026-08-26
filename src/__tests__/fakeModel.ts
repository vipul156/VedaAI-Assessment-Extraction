import { FakeListChatModel } from "@langchain/core/utils/testing";

/**
 * Fake vision model returning fixture JSON in the exact order the pipeline
 * calls it: question page(s) → answer page(s) → per-question grading → overall.
 * The test must upload 1 question page and 2 answer pages to keep this order.
 */
export function makeFakeModel(): FakeListChatModel {
  const responses: string[] = [];

  // 1) question page (page 1)
  responses.push(
    JSON.stringify({
      questions: [
        { label: "1", text: "Solve for x: 2x + 3 = 11.", marks: 2 },
        { label: "2", text: "Find the area of a circle with radius 7 cm.", marks: 3 },
        { label: "3 (a)", text: "Differentiate f(x) = x^2.", marks: 2 },
        { label: "(b)", text: "Hence evaluate f'(3).", marks: 1 },
        { label: "7", text: "Simplify (3x + 2)(x - 5).", marks: 3 },
      ],
    }),
  );

  // 2) answer page 1
  responses.push(
    JSON.stringify({
      answers: [
        { label: "2", text: "Area = pi r^2 = 154 sq cm", bbox: { x: 40, y: 130, w: 800, h: 90 }, continuation: false, confidence: 0.95 },
        { label: "7", text: "3x^2 - 13x - 10", bbox: { x: 40, y: 400, w: 800, h: 120 }, continuation: false, confidence: 0.9 },
      ],
    }),
  );

  // 3) answer page 2 (continuation + unmatched + unlabeled)
  responses.push(
    JSON.stringify({
      answers: [
        { label: "7", text: "continuation of working", bbox: { x: 30, y: 60, w: 850, h: 100 }, continuation: true, confidence: 0.9 },
        { label: "14", text: "extra work", bbox: { x: 30, y: 300, w: 850, h: 80 }, continuation: false, confidence: 0.8 },
        { label: null, text: "some scribbles", bbox: { x: 30, y: 500, w: 850, h: 60 }, continuation: false, confidence: 0.3 },
      ],
    }),
  );

  // 4) grading — only ANSWERED questions call the model (q2, q7); unanswered
  //    questions get a canned verdict without a model call
  const graded = [
    { verdict: "correct", awarded: 3, outOf: 3, feedback: "Correct area computed." },
    { verdict: "partial", awarded: 2, outOf: 3, feedback: "Expansion right, arithmetic slip." },
  ];
  for (const g of graded) responses.push(JSON.stringify(g));

  // 5) overall
  responses.push(JSON.stringify({ overallFeedback: "Good effort; attempt all sub-parts." }));

  return new FakeListChatModel({ responses });
}
