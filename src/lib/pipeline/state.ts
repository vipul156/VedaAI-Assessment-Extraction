import { Annotation } from "@langchain/langgraph";
import type { Answer, JobResult, PageImage, Question } from "@/lib/types";
import type { RawAnswer } from "@/lib/mapping/matcher";

export const PipelineState = Annotation.Root({
  jobId: Annotation<string>,
  questionFiles: Annotation<{ name: string; buf: Buffer; mime: string }[]>,
  answerFiles: Annotation<{ name: string; buf: Buffer; mime: string }[]>,
  questionPages: Annotation<PageImage[]>,
  answerPages: Annotation<PageImage[]>,
  textLines: Annotation<string[] | null>,
  questions: Annotation<Question[]>,
  rawAnswers: Annotation<RawAnswer[]>,
  answers: Annotation<Answer[]>,
  result: Annotation<JobResult | null>,
  notes: Annotation<string[]>,
});

export type PipelineStateType = typeof PipelineState.State;
