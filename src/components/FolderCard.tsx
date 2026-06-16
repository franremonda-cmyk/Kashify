interface Props {
  name: string;
  icon: string;
  color: string;
  spent?: number;
  limit?: number;
  currencyCode?: string;
  delay?: string;
}

export default function FolderCard({ name, icon, color, spent = 0, limit, currencyCode = "ARS", delay }: Props) {
  const pct = limit ? Math.min((spent / limit) * 100, 100) : 0;
  const barColor = pct >= 100 ? "var(--negative)" : pct >= 80 ? "var(--warning)" : "var(--accent)";
  const hasBudget = !!limit;

  return (
    <div
      className="folder-3d flex-shrink-0 w-36 enter-up"
      data-delay={delay}
      style={{ cursor: "pointer" }}
    >
      <div
        className="glass lift h-full flex flex-col gap-3 p-4"
        style={{
          background: `linear-gradient(145deg, ${color}18, rgba(255,255,255,0.05))`,
          border: `0.5px solid ${color}30`,
          minHeight: 140,
        }}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
          style={{
            background: `${color}20`,
            border: `0.5px solid ${color}40`,
          }}
        >
          {icon}
        </div>

        {/* Name */}
        <p
          className="text-sm font-medium leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {name}
        </p>

        {/* Budget bar */}
        {hasBudget && (
          <div className="mt-auto flex flex-col gap-1.5">
            <div
              className="w-full h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: barColor,
                  transition: "width 500ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
            <span className="text-[10px]" style={{ color: "var(--ink-dim)" }}>
              {currencyCode} {Math.round(spent).toLocaleString("es-AR")} / {Math.round(limit!).toLocaleString("es-AR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
