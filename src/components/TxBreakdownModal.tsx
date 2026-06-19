"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import CategoryIcon from "@/components/CategoryIcon";
import TransactionSheet from "@/components/TransactionSheet";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import type { Transaction } from "@/types";

interface Tx {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  date: string;
  type: string;
  category_id?: string | null;
  categories?: { name?: string; icon?: string; color?: string } | null;
}

interface Category { id: string; name: string; icon?: string; color?: string; }

interface Props {
  type: "income" | "expense";
  currency: string;
  onClose: () => void;
}

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function TxBreakdownModal({ type, currency, onClose }: Props) {
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editTx, setEditTx] = useState<Tx | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
  const monthLabel = `${MONTHS_ES[month]} ${year}`;

  const isIncome = type === "income";
  const title = isIncome ? "Ingresos" : "Gastos";
  const addLabel = isIncome ? "+ Agregar ingreso" : "+ Agregar gasto";
  const color = isIncome ? "var(--positive)" : "var(--negative)";
  const bg = isIncome ? "rgba(52,199,89,0.07)" : "rgba(255,59,48,0.06)";
  const border = isIncome ? "0.5px solid rgba(52,199,89,0.18)" : "0.5px solid rgba(255,59,48,0.16)";

  const loadTxs = useCallback(() => {
    const typeParam = type === "expense" ? "expense,installment-payment" : "income";
    fetch(`/api/transactions?type=${typeParam}&from=${from}&to=${to}&currency=${currency}&sort_by=date&sort_dir=desc&page=1&limit=100`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => { setTxs(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type, from, to, currency]);

  useEffect(() => { loadTxs(); }, [loadTxs]);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const total = txs.reduce((s, t) => s + Number(t.amount), 0);

  function handleAdd() {
    onClose();
    window.dispatchEvent(new CustomEvent("open-quick-add", { detail: { type } }));
  }

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</p>
              <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 1 }}>{monthLabel}</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* Total */}
          <div style={{ padding: "12px 14px", borderRadius: 14, background: bg, border, marginBottom: 14 }}>
            <p style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Total {title.toLowerCase()}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : fmt(total, currency)}
            </p>
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>
            {txs.length} transacciones
          </p>
        </div>

        {/* Scrollable list */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 18px 8px", touchAction: "pan-y", minHeight: 0 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "20px 0" }}>Cargando...</p>
          ) : txs.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-dim)", textAlign: "center", padding: "20px 0" }}>Sin {title.toLowerCase()} este mes</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {txs.map(tx => {
                const cat = tx.categories as { name?: string; icon?: string; color?: string } | null;
                return (
                  <button key={tx.id} onClick={() => setEditTx(tx)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--raised)", border: "0.5px solid var(--glass-border)", textAlign: "left", width: "100%", cursor: "pointer" }}>
                    {cat && (
                      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: (cat.color ?? "#7B61FF") + "22", display: "flex", alignItems: "center", justifyContent: "center", color: cat.color ?? "#7B61FF" }}>
                        <CategoryIcon icon={cat.icon} name={cat.name} color={cat.color} size={14} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</p>
                      <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                        {cat?.name ? `${cat.name} · ` : ""}{new Date(tx.date).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 6 }}>
                      {isIncome ? "+" : "−"}{tx.currency_code} {Number(tx.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: add button */}
        <div style={{ padding: "12px 18px 16px", flexShrink: 0, borderTop: "0.5px solid var(--glass-border-dim)" }}>
          <button onClick={handleAdd} style={{
            width: "100%", padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: "var(--accent)", color: "#FFFFFF",
            boxShadow: "0 0 20px var(--accent-glow)",
          }}>
            {addLabel}
          </button>
        </div>
      </div>

      {editTx && (
        <TransactionSheet
          tx={editTx as unknown as Transaction & { categories?: { name?: string; icon?: string; color?: string } | null }}
          categories={categories}
          zIndex={9400}
          onClose={() => setEditTx(null)}
          onDeleted={() => { setEditTx(null); loadTxs(); }}
          onSaved={() => { setEditTx(null); loadTxs(); }}
        />
      )}
    </div>,
    document.body
  );
}
