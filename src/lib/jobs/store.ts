import type { JobState, JobPhase } from "@/lib/types";
import { removeJobDir } from "@/lib/extraction/rasterize";
import { logger } from "@/lib/logger";

const TTL_MS = 60 * 60 * 1000; // 60 minutes
const SWEEP_MS = 5 * 60 * 1000; // every 5 minutes

const jobs = new Map<string, JobState>();

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function createJob(jobId: string): JobState {
  const now = Date.now();
  const state: JobState = {
    jobId,
    phase: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(jobId, state);
  ensureSweep();
  return state;
}

export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

export function setPhase(jobId: string, phase: JobPhase, progress: number, message?: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.phase = phase;
  job.progress = Math.max(0, Math.min(100, Math.round(progress)));
  job.message = message;
  job.updatedAt = Date.now();
}

export function setJobError(jobId: string, code: string, message: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.phase = "error";
  job.error = { code, message };
  job.updatedAt = Date.now();
}

export function completeJob(jobId: string, result: JobState["result"]) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.phase = "done";
  job.progress = 100;
  job.result = result;
  job.updatedAt = Date.now();
}

function ensureSweep() {
  if (sweepTimer || typeof intervalOk() === "undefined") return;
  sweepTimer = setInterval(sweep, SWEEP_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}

function intervalOk() {
  return typeof setInterval;
}

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > TTL_MS) {
      jobs.delete(id);
      void removeJobDir(id).catch(() => undefined);
      logger.info("job_swept", { jobId: id });
    }
  }
}

/** test helper */
export function clearJobs() {
  jobs.clear();
}
