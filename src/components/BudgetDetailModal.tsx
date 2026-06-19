"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CategoryIcon from "@/components/CategoryIcon";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";

interface BudgetEntry {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  monthly_limit: number;
  currency_code: string;
  spent?: number;
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
}

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function BudgetDetailModal({ budget, onClose }: Props) {
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    fetch(`/api/transactions?category_id=${budget.id}&from=${from}&to=${to}&sort_by=date&sort_dir=desc&page=1`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => { setTxs(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [budget.id]);

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
