export const QUESTION_EXTRACTION_PROMPT = `You are an exam paper parser. This image is one page of a question paper.
Extract EVERY question visible on this page, in printed order.

Rules:
- label = the question number EXACTLY as printed, e.g. "12", "11 (a)", "Q.3(b)". Preserve the printed form.
- Sub-parts are SEPARATE questions: "11 (a)" and "11 (b)" are two entries.
- If only a sub-part letter is printed (e.g. "(b)"), use just that letter as label.
- text = the complete question text, joined if it wraps lines.
- marks = printed marks if visible (e.g. "[2]", "(3 marks)"), else null.
- Ignore headers, instructions, and decorative text.

Return ONLY minified JSON, no markdown fences, exactly:
{"questions":[{"label":"11 (a)","text":"...","marks":2}]}`;;

export const ANSWER_EXTRACTION_PROMPT = `You are reading a handwritten student answer sheet. This image is one page.
Extract EVERY handwritten answer block on this page, top to bottom.

Rules:
- label = the question number the student wrote next to the answer (e.g. "7", "3(b)"), or null if the block has no label.
- text = full transcription of the handwriting, including math/working.
- bbox = tight bounding box around the answer block (label + text + working), on a 1000x1000 grid normalized over the whole page image. x,y = top-left corner.
- continuation = true ONLY if this block continues the previous answer onto this page (student wrote "contd." or the previous answer visibly spills over). Otherwise false.
- confidence = how sure you are about the label detection (0-1); use low values if the label is unclear.

Return ONLY minified JSON, no markdown fences, exactly:
{"answers":[{"label":"7","text":"...","bbox":{"x":0,"y":0,"w":0,"h":0},"continuation":false,"confidence":0.9}]}`;;

export function gradingPrompt(input: {
  displayLabel: string;
  text: string;
  marks: number | null;
  answerText: string | null;
  subjectHint?: string;
}): string {
  return `You are grading one answer of a school exam.

Question ${input.displayLabel}: ${input.text}
Marks for this question: ${input.marks ?? "not printed"}

Student's answer (transcribed from handwriting):
${input.answerText ?? "(no answer written)"}

Grade strictly but fairly for a school student. ${
  input.answerText === null
    ? "The student did not attempt this question."
    : ""
}
Return ONLY minified JSON, no markdown fences, exactly:
{"verdict":"correct","awarded":2,"outOf":2,"feedback":"...","keyPoints":["..."]}
verdict is one of "correct" | "partial" | "incorrect" | "unanswered"; feedback is 1-3 sentences for the teacher; keyPoints optional.`;
}

export function overallFeedbackPrompt(input: {
  totalQuestions: number;
  answered: number;
  unanswered: number;
  gradedLines: string[];
}): string {
  return `Summarize this student's exam performance for the teacher in 2-4 sentences.
Total questions: ${input.totalQuestions}; answered: ${input.answered}; unanswered: ${input.unanswered}.
Per-question verdicts:
${input.gradedLines.join("\n")}

Mention strengths, weaknesses, and one actionable next step. Return ONLY minified JSON, no markdown fences, exactly: {"overallFeedback":"..."}`;
}
