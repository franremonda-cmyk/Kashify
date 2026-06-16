"use client";

interface Props {
  categoryName: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  currencyCode: string;
}

export default function BudgetProgress({ categoryName, icon, spent, limit, currencyCode }: Props) {
  const pct = Math.min((spent / limit) * 100, 100);
  const barColor =
    pct >= 100 ? "var(--accent-red)" :
    pct >= 80  ? "var(--accent-yellow)" :
                 "var(--accent-green)";

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-2 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium">{categoryName}</span>
        </div>
        <span className="num text-xs" style={{ color: "var(--ink-muted)" }}>
          {currencyCode} {fmt(spent)} / {fmt(limit)}
        </span>
      </div>

      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: barColor,
            transition: "width 300ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
