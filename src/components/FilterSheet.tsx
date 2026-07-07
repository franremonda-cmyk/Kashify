"use client";
// Filtro/orden de transacciones compartido entre Actividad e Inicio.
// Client-side puro: recibe filtros, devuelve filtros; el caller aplica.
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CategoryIcon from "@/components/CategoryIcon";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";

export interface FilterCategory { id: string; name: string; icon?: string; color?: string; }
export interface Filters { categories: string[]; types: string[]; sort: string; }

export const TX_TYPES = [
  { value: "expense",             label: "Gastos" },
  { value: "income",              label: "Ingresos" },
  { value: "installment-payment", label: "Cuotas" },
  { value: "conversion",          label: "Conversiones" },
];

export const SORT_OPTIONS = [
  { value: "date_desc",    label: "Más reciente" },
  { value: "date_asc",     label: "Más antiguo" },
  { value: "amount_desc",  label: "Mayor monto" },
  { value: "amount_asc",   label: "Menor monto" },
  { value: "category_asc", label: "Categoría A→Z" },
  { value: "type_asc",     label: "Tipo" },
];

type SortableTx = {
  date: string; amount: number | string; type: string;
  category?: { name?: string } | null;
  categories?: { name?: string } | null;
};

export function sortTransactions<T extends SortableTx>(txs: T[], sort: string): T[] {
  const arr = [...txs];
  const catName = (t: SortableTx) => (t.categories ?? t.category)?.name ?? "";
  switch (sort) {
    case "date_asc":     return arr.sort((a,b) => a.date.localeCompare(b.date));
    case "amount_desc":  return arr.sort((a,b) => Number(b.amount) - Number(a.amount));
    case "amount_asc":   return arr.sort((a,b) => Number(a.amount) - Number(b.amount));
    case "category_asc": return arr.sort((a,b) => catName(a).localeCompare(catName(b)));
    case "type_asc":     return arr.sort((a,b) => a.type.localeCompare(b.type));
    default:             return arr.sort((a,b) => b.date.localeCompare(a.date));
  }
}

export default function FilterSheet({ categories, filters, onApply, onClose }: {
  categories: FilterCategory[]; filters: Filters;
  onApply: (f: Filters) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>({ ...filters });
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        padding: "20px 16px",
        touchAction: "none",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog" aria-modal="true" aria-label="Filtrar y ordenar"
        className="w-full max-w-sm flex flex-col"
        style={{
          borderRadius: 20, background: "var(--base)",
          border: "0.5px solid var(--glass-border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.30)",
          maxHeight: "85dvh", minHeight: 0,
        }}
      >
        {/* Fixed header */}
        <div style={{ flexShrink: 0, padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Filtrar y ordenar</h2>
            <button onClick={onClose} aria-label="Cerrar" style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--raised)", border: "0.5px solid var(--glass-border)",
              color: "var(--ink-muted)", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 20px", display: "flex", flexDirection: "column", gap: 20, touchAction: "pan-y" }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8 }}>Ordenar por</p>
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
            <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8 }}>Tipo</p>
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
            <div style={{ paddingBottom: 4 }}>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8 }}>Categoría</p>
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
        </div>

        {/* Fixed footer */}
        <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "16px 20px" }}>
          <button onClick={() => setLocal({ categories: [], types: [], sort: "date_desc" })} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Limpiar</button>
          <button onClick={() => { onApply(local); onClose(); }} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#04130D" }}>Aplicar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
