// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from "vitest";
import { POST as analyze } from "@/app/api/analyze/route";
import { GET as getJob } from "@/app/api/jobs/[id]/route";
import { GET as getFile } from "@/app/api/files/[jobId]/[doc]/[page]/route";
import { setModelOverride } from "@/lib/ai/client";
import { makeFakeModel } from "./fakeModel";
import { clearJobs } from "@/lib/jobs/store";
import { writeFixtures } from "../../fixtures/makeFixtures";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

async function buildForm(): Promise<FormData> {
  await writeFixtures();
  const form = new FormData();
  const pdf = await readFile(path.join(process.cwd(), "fixtures/questionPaper.pdf"));
  const png = await readFile(path.join(process.cwd(), "fixtures/answerSheet.png"));
  // question paper: PNG only (forces vision path since no text layer)
  form.append("questionPaper", new File([png], "qp.png", { type: "image/png" }));
  form.append("answerSheet", new File([png], "answers.png", { type: "image/png" }));
  void pdf;
  return form;
}

async function waitForDone(jobId: string, timeoutMs = 60000): Promise<unknown> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await getJob(makeRequest(`http://localhost/api/jobs/${jobId}`), {
      params: Promise.resolve({ id: jobId }),
    });
    const body = await res.json();
    if (body.phase === "done" || body.phase === "error") return body;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("job did not finish in time");
}

describe("API integration", () => {
  beforeEach(() => {
    clearJobs();
    setModelOverride(makeFakeModel() as never);
    vi.stubEnv("MAX_DOC_MB", "10");
  });

  it("runs the full pipeline via /api/analyze -> /api/jobs/:id", async () => {
    const png = await readFile(path.join(process.cwd(), "fixtures/answerSheet.png"));
    const form = new FormData();
    form.append("questionPaper", new File([png], "qp.png", { type: "image/png" }));
    form.append("answerSheet", new File([png], "answers-p1.png", { type: "image/png" }));
    form.append("answerSheet", new File([png], "answers-p2.png", { type: "image/png" }));
    const res = await analyze(makeRequest("http://localhost/api/analyze", { method: "POST", body: form }));
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    expect(jobId).toBeTruthy();

    const final = (await waitForDone(jobId)) as {
      phase: string;
      result: {
        questions: { displayLabel: string }[];
        answers: { label: string | null; mappedQuestionId: string | null; unmatchedReason?: string; regions: unknown[] }[];
        summary: { totalAwarded: number | null; totalOutOf: number; answered: number; unanswered: number; unmatched: number };
        graded: { verdict: string }[];
      };
    };
    expect(final.phase).toBe("done");
    expect(final.result.questions.map((q) => q.displayLabel)).toEqual([
      "1", "2", "3 (a)", "3 (b)", "7",
    ]);
    // mapping outcomes
    const answers = final.result.answers;
    expect(answers.find((a) => a.label === "2")?.mappedQuestionId).toBeTruthy();
    const q7 = answers.find((a) => a.label === "7" && !a.unmatchedReason);
    expect(q7?.regions.length).toBeGreaterThanOrEqual(2); // multi-page continuation merged
    expect(answers.find((a) => a.label === "14")?.unmatchedReason).toBe("label_not_in_paper");
    expect(answers.filter((a) => a.label === null).length).toBe(1);
    // summary
    expect(final.result.summary.answered).toBe(2);
    expect(final.result.summary.unanswered).toBe(3);
    expect(final.result.summary.unmatched).toBe(2);
    expect(final.result.summary.totalAwarded).toBe(5);
    expect(final.result.summary.totalOutOf).toBe(11);
    expect(final.result.graded.filter((g) => g.verdict === "unanswered")).toHaveLength(3);
  }, 90000);

  it("rejects unsupported file types with 415", async () => {
    const form = new FormData();
    form.append("questionPaper", new File([Buffer.from("hello")], "notes.txt", { type: "text/plain" }));
    form.append("answerSheet", new File([Buffer.from("hi")], "a.txt", { type: "text/plain" }));
    const res = await analyze(makeRequest("http://localhost/api/analyze", { method: "POST", body: form }));
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error.code).toBe("unsupported_media");
  });

  it("rejects missing fields with 400", async () => {
    const form = new FormData();
    form.append("questionPaper", new File([Buffer.from("%PDF-1.4 fake")], "q.pdf", { type: "application/pdf" }));
    const res = await analyze(makeRequest("http://localhost/api/analyze", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });

  it("rejects oversize docs with 413", async () => {
    const png = await readFile(path.join(process.cwd(), "fixtures/answerSheet.png"));
    const big = Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024, 0)]);
    const form = new FormData();
    form.append("questionPaper", new File([big], "qp.png", { type: "image/png" }));
    form.append("answerSheet", new File([png], "answers.png", { type: "image/png" }));
    const res = await analyze(makeRequest("http://localhost/api/analyze", { method: "POST", body: form }));
    expect(res.status).toBe(413);
  });

  it("404s unknown jobs", async () => {
    const res = await getJob(makeRequest("http://localhost/api/jobs/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("serves rasterized page images after a job completes", async () => {
    const form = await buildForm();
    const res = await analyze(makeRequest("http://localhost/api/analyze", { method: "POST", body: form }));
    const { jobId } = await res.json();
    await waitForDone(jobId);
    const img = await getFile(
      makeRequest(`http://localhost/api/files/${jobId}/answer_sheet/1`),
      { params: Promise.resolve({ jobId, doc: "answer_sheet", page: "1" }) },
    );
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
  }, 90000);
});
