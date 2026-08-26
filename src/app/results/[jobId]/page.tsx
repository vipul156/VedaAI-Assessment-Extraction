"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { JobState } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ProgressSteps from "@/components/ProgressSteps";
import QuestionList from "@/components/QuestionList";
import AnswerSheetViewer from "@/components/AnswerSheetViewer";
import SummaryCard from "@/components/SummaryCard";
import UnmatchedPanel from "@/components/UnmatchedPanel";

export default function ResultsPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [job, setJob] = useState<JobState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (active) setNotFound(true);
          return;
        }
        const body = (await res.json()) as JobState;
        if (!active) return;
        setJob(body);
        if (body.phase !== "done" && body.phase !== "error") {
          timer = setTimeout(poll, 1200);
        }
      } catch {
        if (active) timer = setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  if (notFound) {
    return (
      <Centered>
        <p className="text-lg font-semibold">This job has expired or doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 rounded-xl bg-[#1F2937] px-6 py-2.5 text-sm font-semibold text-white">
          Start over
        </Link>
      </Centered>
    );
  }

  if (!job) {
    return (
      <Centered>
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#F97316]" />
      </Centered>
    );
  }

  if (job.phase === "error") {
    return (
      <Centered>
        <p className="text-4xl" aria-hidden>⚠️</p>
        <p className="mt-2 text-lg font-semibold text-red-600">Processing failed</p>
        <p className="mt-1 max-w-md text-sm text-gray-500">{job.error?.message ?? "Unknown error"}</p>
        <Link href="/" className="mt-6 rounded-xl bg-[#1F2937] px-6 py-2.5 text-sm font-semibold text-white">
          Try again
        </Link>
      </Centered>
    );
  }

  if (job.phase !== "done" || !job.result) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title="Exams" />
          <main className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <h2 className="mb-8 text-center text-2xl font-bold text-[#1F2937]">
                Mapping answers<span className="text-[#F97316]">…</span>
              </h2>
              <ProgressSteps job={job} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { result } = job;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Exams" />
        <main className="veda-scroll flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-7xl space-y-4">
            <SummaryCard summary={result.summary} />
            {result.warnings && result.warnings.length > 0 && (
              <div className="rounded-2xl bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>⚠️</span>
                  <p className="text-sm font-semibold text-amber-800">
                    Processing warnings ({result.warnings.length})
                  </p>
                </div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-700">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
              <section className="flex h-[75vh] flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <header className="border-b border-gray-200 px-4 py-3">
                  <p className="text-sm font-semibold text-[#1F2937]">
                    Questions
                    <span className="ml-2 font-normal text-gray-400">
                      {result.questions.length} extracted
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">Click a question to highlight its answer</p>
                </header>
                <QuestionList
                  questions={result.questions}
                  answers={result.answers}
                  graded={result.graded}
                  selectedId={selectedQuestionId}
                  onSelect={setSelectedQuestionId}
                />
              </section>
              <section className="flex h-[75vh] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <AnswerSheetViewer result={result} selectedQuestionId={selectedQuestionId} />
              </section>
            </div>
            <UnmatchedPanel answers={result.answers} />
            {result.notes.length > 0 && (
              <details className="rounded-2xl bg-white p-4 text-xs text-gray-500 shadow-sm ring-1 ring-gray-100">
                <summary className="cursor-pointer font-semibold text-gray-600">
                  Processing notes ({result.notes.length})
                </summary>
                <ul className="mt-2 list-inside list-disc">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="pt-2 pb-6 text-center">
              <Link
                href="/"
                className="rounded-xl bg-[#1F2937] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Grade another submission
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F4F5F7] px-6 text-center">
      {children}
    </div>
  );
}
