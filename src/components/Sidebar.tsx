export default function Sidebar() {
  const nav = [
    { label: "Home", icon: "🏠" },
    { label: "My Classroom", icon: "👥" },
    { label: "Assignments", icon: "📄" },
    { label: "Exams", icon: "📋", active: true },
    { label: "My Library", icon: "🕘" },
  ];
  return (
    <aside className="hidden w-64 shrink-0 p-4 lg:block">
      <div className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1F2937] text-sm font-bold text-[#22C55E]">
              V
            </div>
            <span className="text-lg font-bold text-[#1F2937]">VedaAI</span>
          </div>
          <button aria-label="Collapse sidebar" className="text-gray-400 hover:text-gray-600">
            ⧉
          </button>
        </div>

        <button className="mt-5 flex items-center gap-2 rounded-xl border border-[#F97316] bg-[#1F2937] px-3 py-2.5 text-sm font-medium text-white">
          <span className="text-[#F97316]">★</span> AI Teacher&apos;s Toolkit
        </button>

        <nav className="mt-5 flex flex-col gap-1">
          {nav.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                item.active ? "bg-gray-100 font-semibold text-[#1F2937]" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 rounded-xl bg-gray-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16A34A]/10 text-sm">
            🏫
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#1F2937]">Delhi Public School</p>
            <p className="truncate text-[11px] text-gray-500">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
