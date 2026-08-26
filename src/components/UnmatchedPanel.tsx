"use client";

import type { Answer } from "@/lib/types";

const REASONS: Record<string, string> = {
  label_not_in_paper: "Labelled question not in the paper",
  duplicate_answer_for_question: "Duplicate answer for a question",
  unlabeled_low_confidence: "No legible label",
};

export default function UnmatchedPanel({ answers }: { answers: Answer[] }) {
  const unmatched = answers.filter((a) => !a.mappedQuestionId);
  if (unmatched.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#7C3AED]">
        Answers not matching any question ({unmatched.length})
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {unmatched.map((a) => (
          <li key={a.id} className="rounded-lg bg-gray-50 p-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-bold text-[#6D28D9]">
                {a.label ?? "no label"}
              </span>
              <span className="text-[11px] text-gray-400">
                p.{a.regions[0]?.page}
                {a.regions.length > 1 ? ` · ${a.regions.length} regions` : ""}
              </span>
              <span className="text-[11px] text-gray-400">
                {a.unmatchedReason
                  ? (REASONS[a.unmatchedReason] ?? a.unmatchedReason)
                  : "Could not be matched"}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-gray-600">{a.text || "(unreadable)"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
