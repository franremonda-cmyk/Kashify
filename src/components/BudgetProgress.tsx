"use client";

interface Props {
  categoryName: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  currencyCode: string;
}

export default function BudgetProgress({ categoryName, icon, color, spent, limit, currencyCode }: Props) {
  const pct = Math.min((spent / limit) * 100, 100);
  const barColor = pct >= 100 ? "var(--accent-red)" : pct >= 80 ? "var(--accent-yellow)" : "var(--accent-green)";

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="glass p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-medium">{categoryName}</span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {currencyCode} {fmt(spent)} / {fmt(limit)}
        </span>
      </div>

      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
