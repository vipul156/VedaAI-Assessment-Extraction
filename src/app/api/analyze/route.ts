import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/id";
import { AppError, toErrorPayload } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
import { createJob, getJob, completeJob, setJobError } from "@/lib/jobs/store";
import { ensureJobDir, sniffMime, jobDir } from "@/lib/extraction/rasterize";
import { buildPipeline } from "@/lib/pipeline/graph";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DOC_MB = parseInt(process.env.MAX_DOC_MB || "10", 10);
const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;
const MAX_FILES_PER_DOC = 12;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const rl = rateLimit(`analyze:${clientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: `Too many uploads. Retry in ${rl.retryAfterSec}s.` } },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const form = await req.formData().catch(() => {
      throw new AppError("bad_request", "Expected multipart/form-data with questionPaper and answerSheet files.");
    });

    async function readDoc(field: string): Promise<{ name: string; buf: Buffer; mime: string }[]> {
      const entries = form.getAll(field);
      if (entries.length === 0) {
        throw new AppError("bad_request", `Missing "${field}" file(s).`);
      }
      if (entries.length > MAX_FILES_PER_DOC) {
        throw new AppError("bad_request", `Too many files in "${field}" (max ${MAX_FILES_PER_DOC}).`);
      }
      const out: { name: string; buf: Buffer; mime: string }[] = [];
      for (const entry of entries) {
        if (typeof entry === "string") {
          throw new AppError("bad_request", `"${field}" must be file uploads, not text fields.`);
        }
        const buf = Buffer.from(await entry.arrayBuffer());
        const sniffed = sniffMime(buf, entry.name || "");
        if (!sniffed) {
          throw new AppError(
            "unsupported_media",
            `Unsupported file type for "${entry.name || "file"}". Use PDF, PNG, JPG or WEBP.`,
          );
        }
        out.push({ name: entry.name || `${field}-${out.length + 1}`, buf, mime: sniffed });
      }
      const total = out.reduce((s, f) => s + f.buf.length, 0);
      if (total > MAX_DOC_BYTES) {
        throw new AppError("too_large", `"${field}" exceeds the ${MAX_DOC_MB}MB limit.`);
      }
      return out;
    }

    const questionFiles = await readDoc("questionPaper");
    const answerFiles = await readDoc("answerSheet");

    const jobId = newId("job");
    await ensureJobDir(jobId);
    createJob(jobId);

    const persist = async (files: { name: string; buf: Buffer; mime: string }[], field: string) => {
      const { writeFile } = await import("node:fs/promises");
      const path = await import("node:path");
      for (const f of files) {
        const safe = f.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "upload";
        await writeFile(path.join(jobDir(jobId), "uploads", `${field}-${safe}`), f.buf).catch(() => undefined);
      }
    };
    await persist(questionFiles, "questionPaper");
    await persist(answerFiles, "answerSheet");

    // fire-and-forget pipeline; errors land in the job store
    void (async () => {
      try {
        const app = buildPipeline();
        const final = await app.invoke({
          jobId,
          questionFiles,
          answerFiles,
          questionPages: [],
          answerPages: [],
          textLines: null,
          questions: [],
          rawAnswers: [],
          answers: [],
          result: null,
          notes: [],
          warnings: [],
        });
        if (!final.result) throw new Error("pipeline produced no result");
        completeJob(jobId, final.result);
        logger.info("job_done", { jobId, ms: Date.now() - t0 });
      } catch (err) {
        const appErr = err instanceof AppError ? err : null;
        setJobError(jobId, appErr?.code ?? "internal", appErr?.message ?? "Processing failed. Please try again.");
        logger.error("job_failed", { jobId, err: String(err) });
      }
    })();

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    logger.warn("analyze_rejected", { status, err: String(err) });
    return NextResponse.json(body, { status });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: { code: "bad_request", message: "Use POST with multipart/form-data." } },
    { status: 405 },
  );
}
