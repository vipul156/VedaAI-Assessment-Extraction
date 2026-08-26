"use client";

import type { Answer, GradedQuestion, Question } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  questions: Question[];
  answers: Answer[];
  graded: GradedQuestion[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function QuestionList({ questions, answers, graded, selectedId, onSelect }: Props) {
  const answerByQ = new Map<string, Answer>();
  for (const a of answers) if (a.mappedQuestionId) answerByQ.set(a.mappedQuestionId, a);
  const gradeByQ = new Map(graded.map((g) => [g.questionId, g]));

  return (
    <div className="veda-scroll h-full overflow-y-auto p-3">
      <ul className="flex flex-col gap-2">
        {questions.map((q) => {
          const ans = answerByQ.get(q.id);
          const grade = gradeByQ.get(q.id);
          const selected = selectedId === q.id;
          return (
            <li key={q.id}>
              <button
                onClick={() => onSelect(selected ? null : q.id)}
                aria-pressed={selected}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-[#F97316] bg-orange-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded-md bg-[#1F2937] px-2 py-0.5 text-xs font-bold text-white">
                      {q.displayLabel}
                    </span>
                    <p className="line-clamp-2 text-sm text-[#1F2937]">{q.text || "(text not captured)"}</p>
                  </div>
                  {q.marks !== null && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {grade?.awarded ?? "–"}/{q.marks}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {ans ? (
                    <>
                      <StatusBadge kind={grade?.verdict ?? "incorrect"} />
                      <span className="text-[11px] text-gray-400">
                        p.{ans.regions[0]?.page}
                        {ans.regions.length > 1 ? ` · ${ans.regions.length} regions` : ""}
                      </span>
                    </>
                  ) : (
                    <StatusBadge kind="unanswered" />
                  )}
                </div>
                {selected && grade && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-2.5">
                    <p className="text-xs leading-relaxed text-gray-600">{grade.feedback}</p>
                    {grade.keyPoints && grade.keyPoints.length > 0 && (
                      <ul className="mt-1.5 list-inside list-disc text-[11px] text-gray-500">
                        {grade.keyPoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
