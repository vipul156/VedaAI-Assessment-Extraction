"use client";

import { useCallback, useRef, useState } from "react";

export interface DroppedFile {
  name: string;
  size: number;
  pages: number | null;
  file: File;
}

interface DropZoneProps {
  title: string;
  hint: string;
  files: DroppedFile[];
  onFiles: (files: File[]) => void;
  onRemove: (name: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function pageCount(files: DroppedFile[]): string {
  const withPages = files.filter((f) => f.pages !== null);
  if (files.length === 0) return "";
  if (withPages.length === files.length) {
    const total = withPages.reduce((s, f) => s + (f.pages ?? 0), 0);
    return `${total} Page${total === 1 ? "" : "s"}`;
  }
  return "";
}

export default function DropZone({ title, hint, files, onFiles, onRemove }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length) onFiles(dropped);
    },
    [onFiles],
  );

  return (
    <div className="flex flex-col items-center">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${title}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-md rounded-2xl border-2 border-dashed bg-white p-6 text-center transition ${
          dragging ? "border-[#F97316] bg-orange-50" : "border-gray-300"
        } hover:border-[#F97316] cursor-pointer`}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#F97316] text-[#F97316]">
              ↑
            </div>
            <p className="text-sm text-[#1F2937]">
              Upload <span className="font-bold text-[#F97316]">{title}</span>
            </p>
            <p className="text-xs text-gray-400">{hint} · Max 10MB</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left"
              >
                <span className="text-2xl" aria-hidden>📕</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1F2937]">{f.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatSize(f.size)}
                    {pageCount([f]) ? ` • ${pageCount([f])}` : ""}
                  </p>
                </div>
                <button
                  aria-label={`Remove ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(f.name);
                  }}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-400">Click or drop to add more pages</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onFiles(picked);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
