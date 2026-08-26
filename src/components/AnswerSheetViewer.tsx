"use client";

import type { Answer, JobResult, PageImage } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

interface ViewerProps {
  result: JobResult;
  selectedQuestionId: string | null;
}

export default function AnswerSheetViewer({ result, selectedQuestionId }: ViewerProps) {
  const pagesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const [sizes, setSizes] = useState<Map<number, { w: number; h: number }>>(new Map());
  const [zoom, setZoom] = useState(1);

  const selectedRegions = useMemo(() => {
    if (!selectedQuestionId) return [];
    const answer = result.answers.find((a) => a.mappedQuestionId === selectedQuestionId);
    return answer ? answer.regions : [];
  }, [result.answers, selectedQuestionId]);

  const regionPages = useMemo(
    () => new Set(selectedRegions.map((r) => r.page)),
    [selectedRegions],
  );

  useEffect(() => {
    if (selectedRegions.length === 0) return;
    const first = [...selectedRegions].sort((a, b) => a.page - b.page || a.y - b.y)[0];
    const el = pagesRef.current.get(first.page);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedRegions]);

  const highlightFor = (page: number) =>
    selectedRegions.filter((r) => r.page === page);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <p className="text-sm font-semibold text-[#1F2937]">
          Answer Sheet
          <span className="ml-2 font-normal text-gray-400">
            {result.answerPages.length} page{result.answerPages.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>
      <div className="veda-scroll flex-1 space-y-6 overflow-y-auto bg-[#EEF0F3] p-4">
        {result.answerPages.map((page) => (
          <PageView
            key={page.page}
            page={page}
            zoom={zoom}
            isTarget={regionPages.has(page.page)}
            regions={highlightFor(page.page)}
            registerRef={(el) => {
              if (el) pagesRef.current.set(page.page, el);
              else pagesRef.current.delete(page.page);
            }}
            onSize={(s) =>
              setSizes((prev) => {
                if (prev.get(page.page)?.w === s.w) return prev;
                const next = new Map(prev);
                next.set(page.page, s);
                return next;
              })
            }
            sizesKnown={sizes.size > 0}
          />
        ))}
      </div>
    </div>
  );
}

interface PageViewProps {
  page: PageImage;
  zoom: number;
  isTarget: boolean;
  regions: { x: number; y: number; w: number; h: number }[];
  registerRef: (el: HTMLDivElement | null) => void;
  onSize: (s: { w: number; h: number }) => void;
  sizesKnown: boolean;
}

function PageView({ page, zoom, isTarget, regions, registerRef, onSize }: PageViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const report = () => {
      const el = imgRef.current;
      if (el && el.clientWidth > 0) onSize({ w: el.clientWidth, h: el.clientHeight });
    };
    report();
    window.addEventListener("resize", report);
    return () => window.removeEventListener("resize", report);
  }, [onSize, zoom]);

  return (
    <div
      ref={registerRef}
      className={`relative mx-auto rounded-lg bg-white shadow-sm ring-1 transition ${
        isTarget ? "ring-2 ring-[#F97316]" : "ring-gray-200"
      }`}
      style={{ width: `${zoom * 100}%`, maxWidth: `${820 * zoom}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={page.url}
        alt={`Answer sheet page ${page.page}`}
        className="block w-full select-none rounded-lg"
        draggable={false}
      />
      {regions.map((r, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-md border-2 border-[#F97316] bg-[#F97316]/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.08)]"
          style={{
            left: `${r.x / 10}%`,
            top: `${r.y / 10}%`,
            width: `${r.w / 10}%`,
            height: `${r.h / 10}%`,
          }}
        />
      ))}
      <span className="absolute -top-2 left-3 rounded bg-[#1F2937] px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Page {page.page}
      </span>
    </div>
  );
}
