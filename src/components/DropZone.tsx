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
  hint?: string;
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

export default function DropZone({ title, files, onFiles, onRemove }: DropZoneProps) {
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
        className={`w-full max-w-[460px] rounded-[36px] border-2 border-dashed bg-white px-6 py-11 text-center transition-colors ${
          dragging ? "border-[#FF5A36] bg-orange-50" : "border-gray-300"
        } cursor-pointer hover:border-[#FF5A36]`}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center">
            <div className="mb-3 flex h-13 w-13 items-center justify-center rounded-[10px] bg-[#F4F4F5]">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1F2937"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-[22px] font-semibold text-[#1F2937]">
              Upload <span className="text-[#FF5A36]">{title}</span>
            </p>
            <p className="text-[15px] font-medium text-gray-400">Max 10MB</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left"
              >
                <span className="text-2xl" aria-hidden>
                  📕
                </span>
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