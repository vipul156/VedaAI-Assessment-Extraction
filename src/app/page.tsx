"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import DropZone, { type DroppedFile } from "@/components/DropZone";

const MAX_TOTAL = 10 * 1024 * 1024;

async function pdfPageCount(file: File): Promise<number | null> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return null;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [questionFiles, setQuestionFiles] = useState<DroppedFile[]>([]);
  const [answerFiles, setAnswerFiles] = useState<DroppedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addFiles = async (existing: DroppedFile[], incoming: File[], kind: string) => {
    setError(null);
    const next: DroppedFile[] = [...existing];
    for (const file of incoming) {
      const lower = file.name.toLowerCase();
      const okType =
        file.type === "application/pdf" ||
        ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type) ||
        /\.(pdf|png|jpe?g|webp)$/.test(lower);
      if (!okType) {
        setError(`${file.name}: unsupported type. Use PDF, PNG, JPG or WEBP.`);
        continue;
      }
      const dupe = next.find((f) => f.name === file.name && f.size === file.size);
      if (dupe) continue;
      next.push({ name: file.name, size: file.size, pages: null, file });
    }
    const total = next.reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL) {
      setError(`The ${kind} exceeds the 10MB limit.`);
      return existing;
    }
    // resolve page counts async
    const resolved = await Promise.all(
      next.map(async (f) =>
        f.pages === null && f.file ? { ...f, pages: await pdfPageCount(f.file) } : f,
      ),
    );
    return resolved;
  };

  const ready = questionFiles.length > 0 && answerFiles.length > 0 && !submitting;

  const start = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of questionFiles) form.append("questionPaper", f.file);
      for (const f of answerFiles) form.append("answerSheet", f.file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = (await res.json()) as { jobId?: string; error?: { message: string } };
      if (!res.ok || !body.jobId) {
        throw new Error(body.error?.message ?? "Upload failed. Please try again.");
      }
      router.push(`/results/${body.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setSubmitting(false);
    }
  };

  const totalLabel = useMemo(() => {
    const pages =
      questionFiles.reduce((s, f) => s + (f.pages ?? 0), 0) +
      answerFiles.reduce((s, f) => s + (f.pages ?? 0), 0);
    return pages > 0 ? `${pages} pages total` : "";
  }, [questionFiles, answerFiles]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Exams" />
        <main className="veda-scroll flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-10">
            <h1 className="text-3xl font-bold text-[#1F2937]">
              Upload <span className="text-[#F97316]">Question Paper &amp; Answer Sheets</span>
            </h1>
            <p className="mt-2 text-sm text-gray-500">Upload both files to get started</p>

            <div className="my-8 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
              <span className="text-5xl" aria-hidden>👩‍🏫</span>
            </div>

            <div className="grid w-full gap-6 md:grid-cols-2">
              <DropZone
                title="Question Paper"
                hint="PDF or images"
                files={questionFiles}
                onFiles={(fs) => void addFiles(questionFiles, fs, "question paper").then(setQuestionFiles)}
                onRemove={(name) => setQuestionFiles((prev) => prev.filter((f) => f.name !== name))}
              />
              <DropZone
                title="Answer Sheet"
                hint="PDF or images"
                files={answerFiles}
                onFiles={(fs) => void addFiles(answerFiles, fs, "answer sheet").then(setAnswerFiles)}
                onRemove={(name) => setAnswerFiles((prev) => prev.filter((f) => f.name !== name))}
              />
            </div>

            {error && (
              <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              onClick={start}
              disabled={!ready}
              className={`mt-8 flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white transition ${
                ready ? "bg-[#1F2937] hover:bg-black" : "cursor-not-allowed bg-gray-300"
              }`}
            >
              {submitting ? "Uploading…" : "Start Mapping"}
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-xs text-gray-400">
              {submitting
                ? "Sending files…"
                : "Once both files are uploaded, you’ll be able to map answers with questions"}
            </p>
            {totalLabel && <p className="mt-1 text-xs text-gray-400">{totalLabel}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
