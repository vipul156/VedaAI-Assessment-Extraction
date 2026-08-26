export default function TopBar({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <button aria-label="Back" className="text-gray-500 hover:text-gray-800">
          ←
        </button>
        <span aria-hidden>📋</span>
        <h1 className="text-base font-semibold text-[#1F2937]">{title}</h1>
      </div>
      <div className="flex items-center gap-4 text-gray-500">
        <button aria-label="Help" className="hover:text-gray-800">?</button>
        <button aria-label="Notifications" className="relative hover:text-gray-800">
          🔔
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#F97316]" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            MR
          </div>
          <span className="hidden text-sm font-medium text-[#1F2937] md:inline">Madhur Rastogi</span>
        </div>
      </div>
    </header>
  );
}
