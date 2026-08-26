import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";
import { errorEnvelope } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json(errorEnvelope("job_not_found", "Job not found or expired."), { status: 404 });
  }
  const { jobId, phase, progress, message, error, result, createdAt, updatedAt } = job;
  return NextResponse.json(
    { jobId, phase, progress, message, error, result, createdAt, updatedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
