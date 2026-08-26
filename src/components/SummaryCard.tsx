"use client";

import type { Summary } from "@/lib/types";

export default function SummaryCard({ summary }: { summary: Summary }) {
  const showMarks = summary.totalOutOf !== null && summary.totalOutOf > 0;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Overall Result</p>
          {showMarks ? (
            <p className="mt-1 text-3xl font-bold text-[#1F2937]">
              {summary.totalAwarded ?? 0}
              <span className="text-lg font-medium text-gray-400"> / {summary.totalOutOf}</span>
            </p>
          ) : (
            <p className="mt-1 text-3xl font-bold text-[#1F2937]">
              {summary.answered}/{summary.answered + summary.unanswered}
              <span className="text-lg font-medium text-gray-400"> answered</span>
            </p>
          )}
          {summary.percent !== null && showMarks && (
            <p className="mt-1 text-sm font-semibold text-[#F97316]">{summary.percent}%</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat value={summary.answered} label="Answered" tone="text-[#16A34A]" />
          <Stat value={summary.unanswered} label="Unanswered" tone="text-gray-500" />
          <Stat value={summary.unmatched} label="Unmatched" tone="text-[#7C3AED]" />
        </div>
      </div>
      <p className="mt-4 border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
        {summary.overallFeedback}
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="min-w-[64px] rounded-xl bg-gray-50 px-3 py-2">
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
