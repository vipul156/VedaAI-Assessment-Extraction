import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { rasterizeDocument, ensureJobDir, jobDir, removeJobDir } from "@/lib/extraction/rasterize";
import { parseQuestionsFromText } from "@/lib/extraction/questionParser";
import { readFile } from "node:fs/promises";
import path from "node:path";

const JOB = "it_raster";

async function filesFromFixtures(): Promise<{ name: string; buf: Buffer; mime: string }[]> {
  const { writeFixtures } = await import("../../fixtures/makeFixtures");
  await writeFixtures();
  const pdf = await readFile(path.join(process.cwd(), "fixtures/questionPaper.pdf"));
  return [{ name: "qp.pdf", buf: pdf, mime: "application/pdf" }];
}

describe("rasterizeDocument (pdfjs-dist)", () => {
  beforeEach(async () => {
    await ensureJobDir(JOB);
  });
  afterEach(async () => {
    await removeJobDir(JOB);
  });

  it("rasterizes a born-digital PDF and extracts its text layer", async () => {
    const { pages, textLines } = await rasterizeDocument(JOB, "question_paper", await filesFromFixtures());
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(textLines).not.toBeNull();
    const questions = parseQuestionsFromText(textLines!);
    expect(questions.map((q) => q.displayLabel)).toEqual([
      "1", "2", "3 (a)", "3 (b)", "4", "5", "6 (a)", "6 (b)", "7",
    ]);
  }, 30000);

  it("rejects corrupt PDFs with a readable error", async () => {
    await expect(
      rasterizeDocument(JOB, "question_paper", [
        { name: "bad.pdf", buf: Buffer.from("not a pdf at all"), mime: "application/pdf" },
      ]),
    ).rejects.toThrow(/could not be read/i);
  });

  it("normalizes a plain image page", async () => {
    const { writeFixtures } = await import("../../fixtures/makeFixtures");
    await writeFixtures();
    const png = await readFile(path.join(process.cwd(), "fixtures/answerSheet.png"));
    const { pages, textLines } = await rasterizeDocument(JOB, "answer_sheet", [
      { name: "a.png", buf: png, mime: "image/png" },
    ]);
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBeGreaterThan(0);
    expect(textLines).toBeNull();
  }, 30000);
});
