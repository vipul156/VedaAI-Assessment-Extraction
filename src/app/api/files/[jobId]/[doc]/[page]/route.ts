import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jobDir } from "@/lib/extraction/rasterize";
import { getJob } from "@/lib/jobs/store";
import { errorEnvelope } from "@/lib/errors";

export const runtime = "nodejs";

const DOCS = new Set(["question_paper", "answer_sheet"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; doc: string; page: string }> },
) {
  const { jobId, doc, page } = await params;
  if (!DOCS.has(doc) || !/^\d{1,3}$/.test(page)) {
    return NextResponse.json(errorEnvelope("bad_request", "Invalid file request."), { status: 400 });
  }
  // only serve pages for known jobs (auth-free, but unguessable ids)
  if (!getJob(jobId)) {
    return NextResponse.json(errorEnvelope("job_not_found", "Job not found or expired."), { status: 404 });
  }
  const file = path.join(jobDir(jobId), "pages", doc, `page-${parseInt(page, 10)}.png`);
  try {
    const buf = await readFile(file);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch {
    return NextResponse.json(errorEnvelope("job_not_found", "Page not found."), { status: 404 });
  }
}
