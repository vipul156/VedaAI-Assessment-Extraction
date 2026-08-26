import { StateGraph, START, END } from "@langchain/langgraph";
import { PipelineState, type PipelineStateType } from "@/lib/pipeline/state";
import { rasterizeDocument } from "@/lib/extraction/rasterize";
import { parseQuestionsFromText, questionsFromVision } from "@/lib/extraction/questionParser";
import { mapAnswers, type RawAnswer } from "@/lib/mapping/matcher";
import { gradeAll, buildSummary } from "@/lib/grading/grader";
import { setPhase } from "@/lib/jobs/store";
import { getModel, aiEnabled } from "@/lib/ai/client";
import {
  VisionQuestionPageSchema,
  VisionAnswerPageSchema,
} from "@/lib/ai/schemas";
import {
  QUESTION_EXTRACTION_PROMPT,
  ANSWER_EXTRACTION_PROMPT,
} from "@/lib/ai/prompts";
import { HumanMessage } from "@langchain/core/messages";
import type { PageImage, Question } from "@/lib/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jobDir } from "@/lib/extraction/rasterize";
import { logger } from "@/lib/logger";
import { z } from "zod";

export async function prepareNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  setPhase(state.jobId, "preparing", 8, "Reading and rasterizing documents");
  const t0 = Date.now();
  const [qRes, aRes] = await Promise.all([
    rasterizeDocument(state.jobId, "question_paper", state.questionFiles),
    rasterizeDocument(state.jobId, "answer_sheet", state.answerFiles),
  ]);
  const pageUrl = (doc: string, page: number) => `/api/files/${state.jobId}/${doc}/${page}`;
  const questionPages: PageImage[] = qRes.pages.map((p) => ({
    page: p.page,
    width: p.width,
    height: p.height,
    url: pageUrl("question_paper", p.page),
  }));
  const answerPages: PageImage[] = aRes.pages.map((p) => ({
    page: p.page,
    width: p.width,
    height: p.height,
    url: pageUrl("answer_sheet", p.page),
  }));
  logger.info("prepare_done", { jobId: state.jobId, ms: Date.now() - t0, qPages: questionPages.length, aPages: answerPages.length, hasText: !!qRes.textLines });
  return {
    questionPages,
    answerPages,
    textLines: qRes.textLines,
    notes: [
      qRes.textLines ? "Question paper parsed from embedded PDF text (deterministic path)." : null,
    ].filter((n): n is string => n !== null),
  };
}

async function callVisionJson<T>(schema: z.ZodType<T>, imageDataUrl: string, prompt: string): Promise<T> {
  const model = getModel();
  const res = await model.invoke([
    new HumanMessage({
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    }),
  ]);
  const raw = extractText(res.content);
  const parsed = parseJsonLoose(raw);
  const checked = schema.safeParse(parsed);
  if (!checked.success) {
    // one repair round-trip: show the model what was wrong
    const repair = await model.invoke([
      new HumanMessage({
        content: `Your previous response failed schema validation:\n${JSON.stringify(checked.error.issues.slice(0, 5))}\n\nPrevious response:\n${raw.slice(0, 4000)}\n\nReturn the corrected JSON ONLY, matching the required schema.`,
      }),
    ]);
    return schema.parse(parseJsonLoose(extractText(repair.content)));
  }
  return checked.data;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: string; text?: string } => typeof p === "object" && p !== null && "text" in (p as object))
      .map((p) => p.text ?? "")
      .join("");
  }
  return String(content);
}

function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  return JSON.parse(candidate);
}

async function pageDataUrl(jobId: string, doc: "question_paper" | "answer_sheet", file: string): Promise<string> {
  const buf = await readFile(path.join(jobDir(jobId), "pages", doc, file));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function extractQuestionsNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  setPhase(state.jobId, "extracting_questions", 20, "Extracting questions");
  const notes: string[] = [...state.notes];

  if (state.textLines && state.textLines.length > 0) {
    const questions = parseQuestionsFromText(state.textLines, "text");
    if (questions.length > 0) {
      logger.info("questions_from_text", { jobId: state.jobId, count: questions.length });
      return { questions };
    }
    notes.push("Text layer found but no questions parsed — falling back to vision.");
  }

  if (!aiEnabled()) {
    notes.push("AI not configured: question extraction limited to PDF text layer.");
    return { questions: [], notes };
  }

  const items: { label: string; text: string; marks: number | null }[] = [];
  for (let i = 0; i < state.questionPages.length; i++) {
    setPhase(state.jobId, "extracting_questions", 20 + (25 * i) / Math.max(1, state.questionPages.length), `Extracting questions (page ${i + 1}/${state.questionPages.length})`);
    const url = await pageDataUrl(state.jobId, "question_paper", `page-${i + 1}.png`);
    try {
      const out = await callVisionJson(VisionQuestionPageSchema, url, QUESTION_EXTRACTION_PROMPT);
      for (const q of out.questions) {
        const marksNum = typeof q.marks === "string" ? parseInt(q.marks.replace(/\D/g, ""), 10) : q.marks ?? null;
        items.push({ label: q.label, text: q.text, marks: Number.isFinite(marksNum as number) ? (marksNum as number) : null });
      }
    } catch (err) {
      logger.warn("vision_question_page_failed", { jobId: state.jobId, page: i + 1, err: String(err) });
      notes.push(`Question extraction failed on page ${i + 1}; skipped.`);
    }
  }
  const questions: Question[] = questionsFromVision(items);
  logger.info("questions_from_vision", { jobId: state.jobId, count: questions.length });
  return { questions, notes };
}

export async function extractAnswersNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  setPhase(state.jobId, "extracting_answers", 45, "Reading handwritten answers");
  const notes: string[] = [...state.notes];
  const rawAnswers: RawAnswer[] = [];
  let seq = 0;

  if (!aiEnabled()) {
    notes.push("AI not configured: cannot read handwritten answers.");
    return { rawAnswers, notes };
  }

  for (let i = 0; i < state.answerPages.length; i++) {
    setPhase(state.jobId, "extracting_answers", 45 + (25 * i) / Math.max(1, state.answerPages.length), `Reading answers (page ${i + 1}/${state.answerPages.length})`);
    const url = await pageDataUrl(state.jobId, "answer_sheet", `page-${i + 1}.png`);
    try {
      const out = await callVisionJson(VisionAnswerPageSchema, url, ANSWER_EXTRACTION_PROMPT);
      for (const a of out.answers) {
        seq += 1;
        rawAnswers.push({
          id: `a${seq}`,
          label: a.label,
          text: a.text,
          page: i + 1,
          region: { page: i + 1, ...a.bbox },
          continuation: a.continuation,
          confidence: a.confidence,
        });
      }
    } catch (err) {
      logger.warn("vision_answer_page_failed", { jobId: state.jobId, page: i + 1, err: String(err) });
      notes.push(`Answer extraction failed on page ${i + 1}; skipped.`);
    }
  }
  logger.info("answers_extracted", { jobId: state.jobId, count: rawAnswers.length });
  return { rawAnswers, notes };
}

export async function mapNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  setPhase(state.jobId, "mapping", 72, "Mapping answers to questions");
  const answers = mapAnswers(state.rawAnswers, state.questions);
  const notes: string[] = [...state.notes];
  const unlabeled = answers.filter((a) => a.label === null).length;
  if (unlabeled > 0) notes.push(`${unlabeled} answer block(s) had no legible label.`);
  logger.info("mapping_done", { jobId: state.jobId, mapped: answers.filter((a) => a.mappedQuestionId).length, unmatched: answers.filter((a) => !a.mappedQuestionId).length });
  return { answers, notes };
}

export async function gradeNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  setPhase(state.jobId, "grading", 82, "Grading and feedback");
  const notes = [...state.notes];
  const { graded, overall } = await gradeAll(state.questions, state.answers, notes);
  const result = {
    jobId: state.jobId,
    questions: state.questions,
    answers: state.answers,
    graded,
    summary: buildSummary(state.questions, state.answers, graded, overall.overallFeedback),
    answerPages: state.answerPages,
    questionPages: state.questionPages,
    notes,
  };
  return { result };
}

export function buildPipeline() {
  const graph = new StateGraph(PipelineState)
    .addNode("prepare", prepareNode)
    .addNode("extractQuestions", extractQuestionsNode)
    .addNode("extractAnswers", extractAnswersNode)
    .addNode("map", mapNode)
    .addNode("grade", gradeNode)
    .addEdge(START, "prepare")
    .addEdge("prepare", "extractQuestions")
    .addEdge("extractQuestions", "extractAnswers")
    .addEdge("extractAnswers", "map")
    .addEdge("map", "grade")
    .addEdge("grade", END);
  return graph.compile();
}
