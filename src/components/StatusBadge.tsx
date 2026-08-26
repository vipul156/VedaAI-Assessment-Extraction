import type { Verdict } from "@/lib/types";

const STYLES: Record<Verdict | "unmatched", { label: string; cls: string; dot: string }> = {
  correct: { label: "Correct", cls: "bg-[#16A34A]/10 text-[#15803D]", dot: "bg-[#16A34A]" },
  partial: { label: "Partial", cls: "bg-[#D97706]/10 text-[#B45309]", dot: "bg-[#D97706]" },
  incorrect: { label: "Incorrect", cls: "bg-[#DC2626]/10 text-[#B91C1C]", dot: "bg-[#DC2626]" },
  unanswered: { label: "Unanswered", cls: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  unmatched: { label: "Unmatched", cls: "bg-[#7C3AED]/10 text-[#6D28D9]", dot: "bg-[#7C3AED]" },
};

export default function StatusBadge({ kind }: { kind: Verdict | "unmatched" }) {
  const s = STYLES[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
