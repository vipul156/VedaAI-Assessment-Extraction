"use client";

import type { JobState } from "@/lib/types";

const STEPS: { key: string; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "preparing", label: "Reading documents" },
  { key: "extracting_questions", label: "Extracting questions" },
  { key: "extracting_answers", label: "Reading answers" },
  { key: "mapping", label: "Mapping answers to questions" },
  { key: "grading", label: "Grading & feedback" },
  { key: "done", label: "Done" },
];

export default function ProgressSteps({ job }: { job: Pick<JobState, "phase" | "progress" | "message"> }) {
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.key === job.phase),
  );
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#F97316]" aria-hidden />
        <p className="text-sm font-medium text-[#1F2937]">{job.message ?? "Processing…"}</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-[#F97316] transition-all duration-500"
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <ol className="flex flex-col gap-2">
        {STEPS.slice(1).map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  state === "done"
                    ? "bg-[#16A34A] text-white"
                    : state === "active"
                      ? "bg-[#F97316] text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "todo" ? "text-gray-400" : "text-[#1F2937]"}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
