import { z } from "zod";

export const VisionQuestionPageSchema = z.object({
  questions: z
    .array(
      z.object({
        label: z.string().describe("The question number exactly as printed, e.g. '12', '11 (a)', 'Q.3(b)'"),
        text: z.string().describe("Full text of the question"),
        marks: z
          .union([z.number(), z.string(), z.null()])
          .optional()
          .describe("Marks printed for this question, if any"),
      }),
    )
    .describe("Questions visible on THIS page, in printed order"),
});
export type VisionQuestionPage = z.infer<typeof VisionQuestionPageSchema>;

export const VisionAnswerPageSchema = z.object({
  answers: z
    .array(
      z.object({
        label: z
          .union([z.string(), z.null()])
          .describe("Question number the student wrote next to this answer, e.g. '7', '3(b)', or null if none"),
        text: z.string().describe("Transcription of the handwritten answer"),
        bbox: z.object({
          x: z.number().min(0).max(1000),
          y: z.number().min(0).max(1000),
          w: z.number().min(0).max(1000),
          h: z.number().min(0).max(1000),
        }).describe("Bounding box of the answer region, normalized to a 1000x1000 grid over the page"),
        continuation: z.boolean().describe("true when this block continues the previous answer (e.g. 'contd.')"),
        confidence: z.number().min(0).max(1).describe("Confidence in the detected label, 0-1"),
      }),
    )
    .describe("Handwritten answer blocks on THIS page, top to bottom"),
});
export type VisionAnswerPage = z.infer<typeof VisionAnswerPageSchema>;

export const GradingOutputSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "unanswered"]).nullable(),
  awarded: z.union([z.number(), z.null()]),
  outOf: z.union([z.number(), z.null()]),
  feedback: z.string().min(1),
  keyPoints: z.array(z.string()).optional(),
});
export type GradingOutput = z.infer<typeof GradingOutputSchema>;

export const OverallFeedbackSchema = z.object({
  overallFeedback: z.string().min(1),
});
