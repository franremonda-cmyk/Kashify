"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CategoryIcon from "@/components/CategoryIcon";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";

interface BudgetEntry {
  id: string;
  category_id?: string;
  name: string;
  icon?: string;
  color?: string;
  monthly_limit: number;
  currency_code: string;
  spent?: number;
  period_type?: "always" | "specific_months";
  applies_months?: number[] | null;
}

interface Tx {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
}

interface Props {
  budget: BudgetEntry;
  onClose: () => void;
  onUpdated?: () => void;
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function BudgetDetailModal({ budget, onClose, onUpdated }: Props) {
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [limitVal, setLimitVal] = useState(String(budget.monthly_limit ?? ""));
  const [period, setPeriod] = useState<"always" | "specific_months">(budget.period_type ?? "always");
  const [months, setMonths] = useState<number[]>(budget.applies_months ?? []);
  const [savingLimit, setSavingLimit] = useState(false);

  const catId = budget.category_id ?? budget.id;

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    fetch(`/api/transactions?category=${catId}&type=expense,installment-payment&from=${from}&to=${to}&sort_by=date&sort_dir=desc&page=1&limit=100`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => { setTxs(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [catId]);

  async function saveLimit() {
    if (!limitVal || isNaN(parseFloat(limitVal))) return;
    setSavingLimit(true);
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: catId, monthly_limit: parseFloat(limitVal), currency_code: budget.currency_code,
        period_type: period, applies_months: period === "specific_months" ? months : null,
      }),
    });
    setSavingLimit(false);
    setEditing(false);
    onUpdated?.();
    onClose();
  }

  const pct = budget.monthly_limit > 0 ? Math.min(100, ((budget.spent ?? 0) / budget.monthly_limit) * 100) : 0;
  const textColor = pct >= 100 ? "var(--negative)" : pct >= 80 ? "var(--warning)" : "var(--positive)";
  const gradientColor = pct < 50
    ? `hsl(${120 - pct * 0.6}, 72%, 50%)`
    : pct < 80
    ? `hsl(${90 - (pct - 50) * 2.4}, 80%, 48%)`
    : `hsl(${16 - Math.max(0, pct - 80) * 0.4}, 88%, 52%)`;

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 9200,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        padding: "20px 16px",
        touchAction: "none",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true"
        style={{
          width: "100%", maxWidth: 420, borderRadius: 20,
          background: "var(--base)", border: "0.5px solid var(--glass-border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.40)",
          maxHeight: "calc(100dvh - 40px)", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: (budget.color ?? "#7B61FF") + "22", border: `1px solid ${budget.color ?? "#7B61FF"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: budget.color ?? "#7B61FF", flexShrink: 0 }}>
                <CategoryIcon icon={budget.icon} name={budget.name} color={budget.color} size={20} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{budget.name}</p>
                <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 1 }}>Límite del mes</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* Progress */}
          <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--raised)", border: "0.5px solid var(--glass-border)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: textColor, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(pct)}%
              </p>
              <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                {fmt(budget.spent ?? 0, budget.currency_code)} / {fmt(budget.monthly_limit, budget.currency_code)}
              </p>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 999, background: "var(--base)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: gradientColor, transition: "width 400ms ease-out" }} />
            </div>
            {budget.monthly_limit > (budget.spent ?? 0) ? (
              <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 6 }}>
                Quedan {fmt(budget.monthly_limit - (budget.spent ?? 0), budget.currency_code)} disponibles
              </p>
            ) : (
              <p style={{ fontSize: 10, color: "var(--negative)", marginTop: 6, fontWeight: 600 }}>
                Límite superado por {fmt((budget.spent ?? 0) - budget.monthly_limit, budget.currency_code)}
              </p>
            )}
          </div>

          {/* Editar límite */}
          {!editing ? (
            <button onClick={() => setEditing(true)}
              style={{ width: "100%", padding: "9px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--accent)", marginBottom: 14 }}>
              Editar límite
            </button>
          ) : (
            <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--raised)", border: "0.5px solid var(--glass-border)", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 6, fontWeight: 600 }}>Límite mensual ({budget.currency_code})</p>
                <input type="number" inputMode="decimal" value={limitVal} onChange={e => setLimitVal(e.target.value)} placeholder="Monto"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--base)", border: "0.5px solid var(--glass-border)", borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 15, outline: "none" }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 6, fontWeight: 600 }}>¿Cuándo aplica?</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["always", "specific_months"] as const).map(pt => (
                    <button key={pt} onClick={() => setPeriod(pt)}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: period === pt ? "var(--accent-soft)" : "var(--base)", border: period === pt ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: period === pt ? "var(--accent)" : "var(--ink-muted)" }}>
                      {pt === "always" ? "Siempre" : "Mes específico"}
                    </button>
                  ))}
                </div>
              </div>
              {period === "specific_months" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                  {MONTHS.map((m, i) => {
                    const month = i + 1;
                    const on = months.includes(month);
                    return (
                      <button key={m} onClick={() => setMonths(arr => arr.includes(month) ? arr.filter(x => x !== month) : [...arr, month].sort((a, b) => a - b))}
                        style={{ padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: on ? "var(--accent-soft)" : "var(--base)", border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: on ? "var(--accent)" : "var(--ink-dim)" }}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>Cancelar</button>
                <button onClick={saveLimit} disabled={savingLimit}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: savingLimit ? 0.6 : 1 }}>
                  {savingLimit ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>
            Gastos este mes
          </p>
        </div>

        {/* Scrollable tx list */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 18px 20px", touchAction: "pan-y", minHeight: 0 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "20px 0" }}>Cargando...</p>
          ) : txs.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-dim)", textAlign: "center", padding: "20px 0" }}>Sin gastos este mes</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {txs.map(tx => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: "var(--raised)", border: "0.5px solid var(--glass-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</p>
                    <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                      {new Date(tx.date).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--negative)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 10 }}>
                    −{budget.currency_code} {Number(tx.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
