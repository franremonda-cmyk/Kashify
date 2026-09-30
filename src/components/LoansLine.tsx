import Link from "next/link";
import type { LoanFlow } from "@/lib/ledger/loans";

// "Préstamos este mes": lo que prestaste y lo que te devolvieron, aparte de
// Ingresos/Gastos (lib/ledger/loans). En neutro —prestar no es bueno ni malo—
// y en dos filas para que los montos no se aprieten en 375px. Lleva a Deudas.
// `divider`: va dentro de otra tarjeta (Inicio); sin él, es su propia tarjeta (Actividad).
export default function LoansLine({ loan, prefix = "", divider = false }: { loan?: LoanFlow; prefix?: string; divider?: boolean }) {
  if (!loan || (loan.lent <= 0 && loan.returned <= 0)) return null;
  const money = (n: number) => `${prefix ? prefix + " " : ""}${Math.round(n).toLocaleString("es-AR")}`;
  const rows = [
    loan.lent > 0 && { label: "Prestaste", amount: loan.lent },
    loan.returned > 0 && { label: "Te devolvieron", amount: loan.returned },
  ].filter(Boolean) as { label: string; amount: number }[];
  return (
    <Link
      href="/deudas"
      className={divider ? "press" : "press card-glass"}
      aria-label="Préstamos de este mes: ver Deudas"
      style={{
        display: "flex", alignItems: "center", gap: 10, textDecoration: "none",
        padding: divider ? "10px 16px 12px" : "12px 16px",
        ...(divider ? { borderTop: "0.5px solid var(--glass-border-dim)" } : { borderRadius: 18 }),
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr auto", columnGap: 12, rowGap: 4, alignItems: "baseline" }}>
        <p style={{ gridColumn: "1 / -1", fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--ink-muted)" }}>
          Préstamos este mes <span style={{ fontWeight: 400, color: "var(--ink-dim)" }}>· no cuentan como gasto ni ingreso</span>
        </p>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "contents" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-dim)" }}>{r.label}</span>
            <span className="mono" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{money(r.amount)}</span>
          </div>
        ))}
      </div>
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--ink-dim)", flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}
