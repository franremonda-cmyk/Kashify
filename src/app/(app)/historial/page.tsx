"use client";
import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import CategoryIcon from "@/components/CategoryIcon";
import ImportFlow from "@/components/ImportFlow";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; color?: string; }

const TX_TYPES = [
  { value: "expense",             label: "Gastos" },
  { value: "income",              label: "Ingresos" },
  { value: "installment-payment", label: "Cuotas" },
  { value: "conversion",          label: "Conversiones" },
];

const SORT_OPTIONS = [
  { value: "date_desc",    label: "Más reciente" },
  { value: "date_asc",     label: "Más antiguo" },
  { value: "amount_desc",  label: "Mayor monto" },
  { value: "amount_asc",   label: "Menor monto" },
  { value: "category_asc", label: "Categoría A→Z" },
  { value: "type_asc",     label: "Tipo" },
];

const inp: React.CSSProperties = {
  background: "var(--base)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 12, padding: "11px 14px",
  color: "var(--ink)", fontSize: 14, width: "100%", outline: "none",
};

const CAT_COLORS = [
  "#7B61FF","#34C759","#FF3B30","#FF9500","#5AC8FA",
  "#BF5AF2","#FF6B6B","#30D158","#FFD60A","#64D2FF",
];

interface ChartEntry { name: string; amount: number; }

function DonutChart({ data, total }: { data: ChartEntry[]; total: number }) {
  const uid = useId().replace(/:/g,"");
  const R = 44, CX = 58, CY = 58, stroke = 15;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const slices = data.slice(0, 8).map((d, i) => {
    const pct = d.amount / total;
    const dash = pct * circ;
    const s = { pct, dash, offset, color: CAT_COLORS[i % CAT_COLORS.length], name: d.name };
    offset += dash;
    return s;
  });
  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n/1_000)}K`;
    return String(Math.round(n));
  }
  function fmtPct(pct: number) {
    return pct > 0 && pct < 0.005 ? "<1%" : `${Math.round(pct * 100)}%`;
  }
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width="116" height="116" viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--glass-border)" strokeWidth={stroke}/>
        {slices.map((s, i) => (
          <circle key={`${uid}-${i}`} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt"/>
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{fmt(total)}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="var(--ink-muted)">total</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtPct(s.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, total }: { data: ChartEntry[]; total: number }) {
  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n/1_000)}K`;
    return String(Math.round(n));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.slice(0, 6).map((d, i) => {
        const pct = total > 0 ? (d.amount / total) * 100 : 0;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <CategoryIcon name={d.name} size={12}/>{d.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(d.amount)}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--raised)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: CAT_COLORS[i % CAT_COLORS.length], width: `${pct}%`, transition: "width 500ms cubic-bezier(0.22,1,0.36,1)" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseBreakdown({ data, allCurrencies }: { data: Record<string, ChartEntry[]>; allCurrencies: string[] }) {
  const [mode, setMode]         = useState<"donut" | "bar">("donut");
  const [currency, setCurrency] = useState(allCurrencies[0] ?? "ARS");
  const active = data[currency] ?? [];
  const total  = active.reduce((s, d) => s + d.amount, 0);
  if (allCurrencies.length === 0 || total === 0) return null;
  return (
    <div style={{ borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "var(--shadow-sm)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)" }}>Gastos por categoría</p>
        <div style={{ display: "flex", gap: 1, background: "var(--raised)", borderRadius: 7, padding: 2 }}>
          {(["donut","bar"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
              background: mode === m ? "var(--base)" : "transparent",
              color: mode === m ? "var(--accent)" : "var(--ink-muted)",
              boxShadow: mode === m ? "var(--shadow-sm)" : "none",
            }}>{m === "donut" ? "Circular" : "Barras"}</button>
          ))}
        </div>
      </div>
      {allCurrencies.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {allCurrencies.map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: currency === c ? "var(--accent)" : "var(--raised)",
              color: currency === c ? "#FFFFFF" : "var(--ink-muted)",
              border: currency === c ? "none" : "0.5px solid var(--glass-border)",
            }}>{c}</button>
          ))}
        </div>
      )}
      {mode === "donut" ? <DonutChart data={active} total={total}/> : <BarChart data={active} total={total}/>}
    </div>
  );
}

interface Filters { categories: string[]; types: string[]; sort: string; }

function FilterSheet({ categories, filters, onApply, onClose }: {
  categories: Category[]; filters: Filters;
  onApply: (f: Filters) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>({ ...filters });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm p-5 flex flex-col gap-5 scale-up" style={{
        borderRadius: "20px 20px 0 0", background: "var(--base)",
        borderTop: "0.5px solid var(--glass-border)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.10)",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        maxHeight: "85dvh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--glass-border)", margin: "0 auto -8px" }}/>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Filtrar y ordenar</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--raised)", border: "0.5px solid var(--glass-border)",
            color: "var(--ink)", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>Ordenar por</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {SORT_OPTIONS.map(o => {
              const on = local.sort === o.value;
              return (
                <button key={o.value} onClick={() => setLocal(f => ({ ...f, sort: o.value }))} style={{
                  padding: "8px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, textAlign: "left",
                  background: on ? "var(--accent-soft)" : "var(--raised)",
                  color: on ? "var(--accent)" : "var(--ink-muted)",
                  border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                }}>{o.label}</button>
              );
            })}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>Tipo</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TX_TYPES.map(t => {
              const on = local.types.includes(t.value);
              return (
                <button key={t.value} onClick={() => setLocal(f => ({ ...f, types: on ? f.types.filter(x=>x!==t.value) : [...f.types, t.value] }))} style={{
                  padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: on ? "var(--accent-soft)" : "var(--raised)",
                  color: on ? "var(--accent)" : "var(--ink-muted)",
                  border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                }}>{t.label}</button>
              );
            })}
          </div>
        </div>
        {categories.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>Categoría</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map(cat => {
                const on = local.categories.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => setLocal(f => ({ ...f, categories: on ? f.categories.filter(x=>x!==cat.id) : [...f.categories, cat.id] }))} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: on ? "var(--accent-soft)" : "var(--raised)",
                    color: on ? "var(--accent)" : "var(--ink-muted)",
                    border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                  }}><CategoryIcon name={cat.name} size={11}/>{cat.name}</button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setLocal({ categories: [], types: [], sort: "date_desc" })} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Limpiar</button>
          <button onClick={() => { onApply(local); onClose(); }} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF" }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Transaction action sheet ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
};

const CURRENCIES_LIST = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP"];

interface TxSheetProps {
  tx: Transaction;
  categories: Category[];
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}

function TransactionSheet({ tx, categories, onClose, onDeleted, onSaved }: TxSheetProps) {
  const router = useRouter();
  const [mode, setMode]         = useState<"view" | "edit">("view");
  const [saving, setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Edit fields
  const [desc, setDesc]           = useState(tx.description);
  const [amount, setAmount]       = useState(String(tx.amount));
  const [currency, setCurrency]   = useState(tx.currency_code ?? "ARS");
  const [date, setDate]           = useState(tx.date ?? "");
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [txType, setTxType]       = useState(tx.type);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catData = (tx as any).categories ?? tx.category;
  const isIncome  = tx.type === "income";
  const isInstall = tx.type === "installment-payment";
  const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: desc.trim(),
        amount: parseFloat(amount),
        currency_code: currency,
        date,
        category_id: categoryId || null,
        type: txType,
      }),
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

  const inpSm: React.CSSProperties = {
    background: "var(--raised)", border: "0.5px solid var(--glass-border)",
    borderRadius: 10, padding: "10px 12px", color: "var(--ink)",
    fontSize: 13, width: "100%", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm flex flex-col scale-up"
        style={{
          borderRadius: "24px 24px 0 0",
          background: "var(--base)",
          border: "0.5px solid var(--glass-border)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
          maxHeight: "90dvh",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--glass-border-hover)", margin: "12px auto 0" }}/>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 0" }}>
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

        <div style={{ overflowY: "auto", padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "view" ? (
            <>
              {/* View mode — transaction summary */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: isIncome ? "rgba(52,199,89,0.09)" : isInstall ? "rgba(255,149,0,0.09)" : "rgba(255,59,48,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: amtColor,
                }}>
                  <CategoryIcon name={catData?.name} icon={catData?.icon} color={catData?.color} size={22}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", wordBreak: "break-word" }}>{tx.description}</p>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 3 }}>
                    {catData?.name ?? "Sin categoría"} · {TYPE_LABELS[tx.type] ?? tx.type}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--raised)", border: "0.5px solid var(--glass-border)" }}>
                <p style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 2 }}>Monto</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: amtColor, fontVariantNumeric: "tabular-nums" }}>
                  {isIncome ? "+" : "−"}{tx.currency_code} {Number(tx.amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                </p>
                {tx.date && <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>{tx.date}</p>}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Ir a categorías */}
                <button
                  onClick={() => { onClose(); router.push("/perfil?section=categories"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 16px", borderRadius: 14,
                    background: "var(--raised)", border: "0.5px solid var(--glass-border)",
                    textAlign: "left",
                  }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Editar categoría</p>
                    <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 1 }}>
                      {catData?.name ? `Ir a "${catData.name}"` : "Ir a Mis categorías"}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", marginLeft: "auto", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>

                {/* Delete */}
                {confirmDel ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleDelete} disabled={saving}
                      style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.25)" }}>
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmDel(false)}
                      style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(true)}
                    style={{ padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "rgba(255,59,48,0.06)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}>
                    Eliminar movimiento
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Edit mode */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Tipo */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Tipo</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {TX_TYPES.map(t => {
                      const on = txType === t.value;
                      return (
                        <button key={t.value} onClick={() => setTxType(t.value as typeof txType)}
                          style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                            background: on ? "var(--accent-soft)" : "var(--raised)",
                            color: on ? "var(--accent)" : "var(--ink-muted)",
                            border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)" }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Descripción</p>
                  <input style={inpSm} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción"/>
                </div>

                {/* Monto + Moneda */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Monto</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ ...inpSm, width: "auto", flexShrink: 0 }} value={currency} onChange={e => setCurrency(e.target.value)}>
                      {CURRENCIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input style={inpSm} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"/>
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Fecha</p>
                  <input style={inpSm} type="date" value={date} onChange={e => setDate(e.target.value)}/>
                </div>

                {/* Categoría */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 6 }}>Categoría</p>
                  <select style={inpSm} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                  <button onClick={() => setMode("view")}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving || !desc.trim() || !amount}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function sortTransactions(txs: Transaction[], sort: string): Transaction[] {
  const arr = [...txs];
  switch (sort) {
    case "date_asc":     return arr.sort((a,b) => a.date.localeCompare(b.date));
    case "amount_desc":  return arr.sort((a,b) => Number(b.amount) - Number(a.amount));
    case "amount_asc":   return arr.sort((a,b) => Number(a.amount) - Number(b.amount));
    case "category_asc": return arr.sort((a,b) => (a.category?.name ?? "").localeCompare(b.category?.name ?? ""));
    case "type_asc":     return arr.sort((a,b) => a.type.localeCompare(b.type));
    default:             return arr.sort((a,b) => b.date.localeCompare(a.date));
  }
}

export default function ActividadPage() {
  const [transactions, setTransactions]     = useState<Transaction[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [search, setSearch]                 = useState("");
  const [filters, setFilters]               = useState<Filters>({ categories: [], types: [], sort: "date_desc" });
  const [page, setPage]                     = useState(1);
  const [total, setTotal]                   = useState(0);
  const [loading, setLoading]               = useState(false);
  const [showFilter, setShowFilter]         = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [selectedTx, setSelectedTx]         = useState<Transaction | null>(null);
  const [showImport, setShowImport]         = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (filters.categories.length === 1) params.set("category_id", filters.categories[0]);
    if (filters.types.length === 1) params.set("type", filters.types[0]);
    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }, [page, search, filters.categories, filters.types]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    const handler = () => fetchTransactions();
    window.addEventListener("transaction-added", handler);
    return () => window.removeEventListener("transaction-added", handler);
  }, [fetchTransactions]);

  const sorted = sortTransactions(transactions, filters.sort);

  const availableCurrencies = useMemo(() => {
    const set = new Set(transactions.map(t => t.currency_code ?? "ARS"));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() =>
    selectedCurrency
      ? sorted.filter(t => (t.currency_code ?? "ARS") === selectedCurrency)
      : sorted,
  [sorted, selectedCurrency]);

  const incomeTotal  = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenseTotal = filtered.filter(t => t.type === "expense" || t.type === "installment-payment").reduce((s, t) => s + Number(t.amount), 0);
  const net          = incomeTotal - expenseTotal;

  const expenseByCurrency: Record<string, Record<string, ChartEntry>> = {};
  filtered.filter(t => t.type === "expense" || t.type === "installment-payment").forEach(t => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName = (t as any).categories?.name ?? t.category?.name ?? "Otros";
    const cur = t.currency_code ?? "ARS";
    if (!expenseByCurrency[cur]) expenseByCurrency[cur] = {};
    if (!expenseByCurrency[cur][catName]) expenseByCurrency[cur][catName] = { name: catName, amount: 0 };
    expenseByCurrency[cur][catName].amount += Number(t.amount);
  });
  const chartDataByCurrency: Record<string, ChartEntry[]> = {};
  for (const [cur, byName] of Object.entries(expenseByCurrency)) {
    chartDataByCurrency[cur] = Object.values(byName).sort((a, b) => b.amount - a.amount);
  }
  const chartCurrencies = Object.keys(chartDataByCurrency);
  const activeFilters   = filters.categories.length + filters.types.length;
  const activeSort      = filters.sort !== "date_desc";

  return (
    <div className="flex flex-col gap-4">
      {showFilter && (
        <FilterSheet categories={categories} filters={filters}
          onApply={(f) => { setFilters(f); setPage(1); }}
          onClose={() => setShowFilter(false)}/>
      )}

      {showImport && (
        <ImportFlow
          onDone={() => { setShowImport(false); fetchTransactions(); }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {selectedTx && (
        <TransactionSheet
          tx={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={() => { setSelectedTx(null); fetchTransactions(); }}
          onSaved={() => { setSelectedTx(null); fetchTransactions(); }}
        />
      )}

      <div className="flex items-center justify-between enter-up">
        <h1 className="display font-semibold" style={{ fontSize: "1.35rem", color: "var(--ink)" }}>Actividad</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)", fontWeight: 600 }}>↑ Importar</button>
          <button onClick={() => window.open("/api/export?format=csv")} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>CSV</button>
          <button onClick={() => window.open("/api/export?format=xlsx")} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>Excel</button>
        </div>
      </div>

      {availableCurrencies.length > 1 && (
        <div className="enter-up" data-delay="1" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedCurrency(null)}
            style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: selectedCurrency === null ? "var(--accent)" : "var(--raised)",
              color: selectedCurrency === null ? "#FFFFFF" : "var(--ink-muted)",
              border: selectedCurrency === null ? "none" : "0.5px solid var(--glass-border)",
              transition: "all 180ms ease-out",
            }}>
            Todos
          </button>
          {availableCurrencies.map(c => (
            <button key={c}
              onClick={() => setSelectedCurrency(c === selectedCurrency ? null : c)}
              style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: selectedCurrency === c ? "var(--accent)" : "var(--raised)",
                color: selectedCurrency === c ? "#FFFFFF" : "var(--ink-muted)",
                border: selectedCurrency === c ? "none" : "0.5px solid var(--glass-border)",
                transition: "all 180ms ease-out",
              }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }} className="enter-up" data-delay="1">
          {[
            { label: "Ingresos", value: incomeTotal, color: "var(--positive)" },
            { label: "Gastos",   value: expenseTotal, color: "var(--negative)" },
            { label: "Neto",     value: net, color: net >= 0 ? "var(--positive)" : "var(--negative)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "var(--shadow-sm)" }}>
              <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 enter-up" data-delay="2">
        <input style={{ ...inp, borderRadius: 12, flex: 1 }} placeholder="Buscar..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/>
        <button onClick={() => setShowFilter(true)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "0 14px", borderRadius: 12, flexShrink: 0,
          background: (activeFilters > 0 || activeSort) ? "var(--accent-soft)" : "var(--base)",
          border: (activeFilters > 0 || activeSort) ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
          color: (activeFilters > 0 || activeSort) ? "var(--accent)" : "var(--ink-muted)",
          fontSize: 13, fontWeight: 500,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtrar{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>

      {chartCurrencies.length > 0 && <ExpenseBreakdown data={chartDataByCurrency} allCurrencies={chartCurrencies}/>}

      <div className="flex flex-col">
        {loading && (
          <div style={{ padding: 24, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)" }}>
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>Cargando...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>Sin movimientos</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)" }}>
            {filtered.map((t, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const catData   = (t as any).categories ?? t.category;
              const isIncome  = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              const iconBg    = isIncome ? "rgba(52,199,89,0.09)" : isInstall ? "rgba(255,149,0,0.09)" : "rgba(255,59,48,0.07)";
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTx(t)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: i < filtered.length-1 ? "0.5px solid var(--glass-border-dim)" : "none",
                    width: "100%", textAlign: "left",
                    background: "transparent",
                    transition: "background 120ms ease-out",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: iconBg, color: amtColor }}>
                    <CategoryIcon name={catData?.name} icon={catData?.icon} color={catData?.color} size={16}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</p>
                    <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>{catData?.name ?? "Sin categoría"}{t.date ? ` · ${t.date}` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: amtColor, fontVariantNumeric: "tabular-nums" }}>
                      {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{TYPE_LABELS[t.type] ?? t.type}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {total > 50 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page===1?0.3:1 }}>← Ant</button>
          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{(page-1)*50+1}–{Math.min(page*50, total)} de {total}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page*50>=total} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page*50>=total?0.3:1 }}>Sig →</button>
        </div>
      )}
    </div>
  );
}
