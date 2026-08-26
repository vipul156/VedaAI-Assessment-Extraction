import type { Answer, GradedQuestion, Question } from "@/lib/types";
import { getModel, aiEnabled } from "@/lib/ai/client";
import { GradingOutputSchema, OverallFeedbackSchema } from "@/lib/ai/schemas";
import { gradingPrompt, overallFeedbackPrompt } from "@/lib/ai/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "@/lib/logger";
import { z } from "zod";

async function callJson<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
  const model = getModel();
  const res = await model.invoke([new HumanMessage({ content: prompt })]);
  const raw =
    typeof res.content === "string"
      ? res.content
      : (res.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text as string)
          .join("");
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  return schema.parse(JSON.parse(candidate));
}

export async function gradeAll(
  questions: Question[],
  answers: Answer[],
  notes: string[],
): Promise<{ graded: GradedQuestion[]; overall: { overallFeedback: string } }> {
  const byQuestion = new Map<string, Answer>();
  for (const a of answers) if (a.mappedQuestionId) byQuestion.set(a.mappedQuestionId, a);

  const graded: GradedQuestion[] = [];
  const gradedLines: string[] = [];

  for (const q of questions) {
    const ans = byQuestion.get(q.id) ?? null;
    if (!ans || !ans.text.trim()) {
      graded.push({
        questionId: q.id,
        verdict: "unanswered",
        awarded: q.marks !== null ? 0 : null,
        outOf: q.marks,
        feedback: "Not attempted by the student.",
      });
      gradedLines.push(`${q.displayLabel}: unanswered`);
      continue;
    }
    if (!aiEnabled()) {
      graded.push({
        questionId: q.id,
        verdict: "incorrect",
        awarded: q.marks !== null ? 0 : null,
        outOf: q.marks,
        feedback: "Grading unavailable (AI not configured).",
      });
      gradedLines.push(`${q.displayLabel}: not graded`);
      continue;
    }
    try {
      const out = await callJson(GradingOutputSchema, gradingPrompt({
        displayLabel: q.displayLabel,
        text: q.text,
        marks: q.marks,
        answerText: ans.text,
      }));
      const verdict = out.verdict ?? "incorrect";
      graded.push({
        questionId: q.id,
        verdict,
        awarded: out.awarded ?? (q.marks !== null && verdict === "correct" ? q.marks : null),
        outOf: out.outOf ?? q.marks,
        feedback: out.feedback,
        keyPoints: out.keyPoints,
      });
      gradedLines.push(`${q.displayLabel}: ${verdict} (${out.awarded ?? "?"}/${out.outOf ?? "?"})`);
    } catch (err) {
      logger.warn("grade_failed", { jobId: q.id, err: String(err) });
      notes.push(`Grading failed for question ${q.displayLabel}.`);
      graded.push({
        questionId: q.id,
        verdict: "incorrect",
        awarded: null,
        outOf: q.marks,
        feedback: "Automatic grading failed for this question — teacher review needed.",
      });
      gradedLines.push(`${q.displayLabel}: grading error`);
    }
  }

  let overall = { overallFeedback: "" };
  if (aiEnabled()) {
    try {
      overall = await callJson(OverallFeedbackSchema, overallFeedbackPrompt({
        totalQuestions: questions.length,
        answered: byQuestion.size,
        unanswered: questions.length - byQuestion.size,
        gradedLines,
      }));
    } catch {
      notes.push("Overall feedback generation failed.");
    }
  }
  if (!overall.overallFeedback) {
    const answered = byQuestion.size;
    overall = {
      overallFeedback: `Student answered ${answered} of ${questions.length} questions. ${questions.length - answered} left blank.`,
    };
  }
  return { graded, overall };
}

export function buildSummary(
  questions: Question[],
  answers: Answer[],
  graded: GradedQuestion[],
  overallFeedback: string,
) {
  const byQuestion = new Map<string, Answer>();
  for (const a of answers) if (a.mappedQuestionId) byQuestion.set(a.mappedQuestionId, a);

  const knownOutOf = graded.filter((g) => g.outOf !== null);
  const knownAwarded = graded.filter((g) => g.awarded !== null);
  const totalOutOf = knownOutOf.length ? knownOutOf.reduce((s, g) => s + (g.outOf ?? 0), 0) : null;
  const totalAwarded =
    knownAwarded.length ? knownAwarded.reduce((s, g) => s + (g.awarded ?? 0), 0) : null;
  const percent =
    totalAwarded !== null && totalOutOf ? Math.round((totalAwarded / totalOutOf) * 100) : null;

  return {
    totalAwarded,
    totalOutOf,
    percent,
    answered: byQuestion.size,
    unanswered: questions.length - byQuestion.size,
    unmatched: answers.filter((a) => !a.mappedQuestionId).length,
    overallFeedback,
  };
}
