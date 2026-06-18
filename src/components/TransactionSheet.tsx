"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryModal from "@/components/CategoryModal";
import { useIconStyle } from "@/context/IconStyleContext";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon?: string; color?: string; }

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
};

const TX_TYPES = [
  { value: "expense",             label: "Gastos" },
  { value: "income",              label: "Ingresos" },
  { value: "installment-payment", label: "Cuotas" },
  { value: "conversion",          label: "Conversiones" },
];

const CURRENCIES_LIST = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP"];

interface Props {
  tx: Transaction & { categories?: { name?: string; icon?: string; color?: string } | null };
  categories: Category[];
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}

export default function TransactionSheet({ tx, categories, onClose, onDeleted, onSaved }: Props) {
  const { iconStyle } = useIconStyle();
  const [mode, setMode]             = useState<"view" | "edit">("view");
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

  const [desc, setDesc]           = useState(tx.description);
  const [amount, setAmount]       = useState(String(tx.amount));
  const [currency, setCurrency]   = useState(tx.currency_code ?? "ARS");
  const [date, setDate]           = useState(tx.date ?? "");
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [txType, setTxType]       = useState(tx.type);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catData = (tx as any).categories ?? tx.category;
  const currentCat = categories.find(c => c.id === categoryId)
    ?? (catData ? { id: tx.category_id ?? "", name: catData.name ?? "", icon: catData.icon, color: catData.color } : undefined);

  const isIncome  = tx.type === "income";
  const isInstall = tx.type === "installment-payment";
  const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";

  const inpSm: React.CSSProperties = {
    background: "var(--raised)", border: "0.5px solid var(--glass-border)",
    borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
    fontSize: 13, width: "100%", outline: "none",
  };

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc.trim(), amount: parseFloat(amount), currency_code: currency, date, category_id: categoryId || null, type: txType }),
    });
    setSaving(false);
    onSaved();
    onClose();
    window.dispatchEvent(new Event("transaction-added"));
  }

  async function handleDelete() {
    setSaving(true);
    await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    setSaving(false);
    onDeleted();
    onClose();
    window.dispatchEvent(new Event("transaction-added"));
  }

  async function handleCatSave(updated: Partial<{ name: string; icon?: string; color?: string }>) {
    if (!currentCat?.id) return;
    const supabase = createClient();
    await supabase.from("categories").update(updated).eq("id", currentCat.id);
  }

  const existingColors = categories.map(c => c.color ?? "").filter(Boolean);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        ref={overlayRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
          zIndex: 9000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.72)",
          padding: "20px 16px",
          touchAction: "none",
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-sm flex flex-col"
          style={{
            borderRadius: 20,
            background: "var(--base)",
            border: "0.5px solid var(--glass-border)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.40)",
            maxHeight: "100%",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0", flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              {mode === "edit" ? "Editar movimiento" : "Detalle"}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {mode === "view" && (
                <button onClick={() => setMode("edit")}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontWeight: 500 }}>
                  Editar
                </button>
              )}
              <button onClick={onClose}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{ overflowY: "auto", padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 12, touchAction: "pan-y" }}
          >
            {mode === "view" ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: catData?.color ? `${catData.color}22` : "var(--raised)", display: "flex", alignItems: "center", justifyContent: "center", color: catData?.color ?? "var(--ink-muted)" }}>
                    <CategoryIcon name={catData?.name} icon={catData?.icon} color={catData?.color} size={22}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", wordBreak: "break-word" }}>{tx.description}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 3 }}>
                      {catData?.name ?? "Sin categoría"} · {TYPE_LABELS[tx.type] ?? tx.type}
                    </p>
                  </div>
                </div>

                <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--raised)", border: "0.5px solid var(--glass-border)" }}>
                  <p style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 2 }}>Monto</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: amtColor, fontVariantNumeric: "tabular-nums" }}>
                    {isIncome ? "+" : "−"}{tx.currency_code} {Number(tx.amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </p>
                  {tx.date && <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>{tx.date}</p>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                  <button
                    onClick={() => setShowCatModal(true)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 14, background: "var(--raised)", border: "0.5px solid var(--glass-border)", textAlign: "left" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Editar categoría</p>
                      <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 1 }}>{catData?.name ? `Modificar "${catData.name}"` : "Sin categoría"}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", marginLeft: "auto", flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>

                  {confirmDel ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.25)" }}>Sí, eliminar</button>
                      <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(true)} style={{ padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "rgba(255,59,48,0.06)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}>
                      Eliminar movimiento
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 4 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Tipo</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {TX_TYPES.map(t => {
                      const on = txType === t.value;
                      return (
                        <button key={t.value} onClick={() => setTxType(t.value as typeof txType)}
                          style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: on ? "var(--accent-soft)" : "var(--raised)", color: on ? "var(--accent)" : "var(--ink-muted)", border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)" }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Descripción</p>
                  <input style={inpSm} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción"/>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Monto</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ ...inpSm, width: "auto", flexShrink: 0 }} value={currency} onChange={e => setCurrency(e.target.value)}>
                      {CURRENCIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input style={inpSm} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"/>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Fecha</p>
                  <input style={inpSm} type="date" value={date} onChange={e => setDate(e.target.value)}/>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Categoría</p>
                  <select style={inpSm} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
                  <button onClick={() => setMode("view")} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving || !desc.trim() || !amount} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCatModal && currentCat && (
        <CategoryModal
          cat={currentCat}
          existingColors={existingColors}
          currentStyle={iconStyle}
          onSave={handleCatSave}
          onClose={() => setShowCatModal(false)}
        />
      )}
    </>,
    document.body
  );
}
