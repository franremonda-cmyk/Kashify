"use client";
import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; }

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN", "GBP"];

const TX_TYPES = [
  { value: "expense",              label: "Gastos" },
  { value: "income",               label: "Ingresos" },
  { value: "installment-payment",  label: "Cuotas" },
  { value: "conversion",           label: "Conversiones" },
];

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(0,200,83,0.16)",
  borderRadius: 12,
  padding: "11px 14px",
  color: "var(--ink)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    type: "expense" as "expense" | "income",
    description: "", amount: "", currency_code: "ARS", category_id: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {}); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount) { setError("Completá descripción y monto"); return; }
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { onSaved(); onClose(); } else { setError("Error al guardar"); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm p-5 flex flex-col gap-4 mb-14 scale-up"
        style={{ borderRadius: 24, background: "rgba(10,20,13,0.96)", backdropFilter: "blur(48px)", border: "0.5px solid rgba(0,200,83,0.26)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 24px 80px rgba(0,0,0,0.80)" }}>
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>Registrar</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.10)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {(["expense","income"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: form.type===t ? (t==="expense"?"rgba(255,83,112,0.20)":"rgba(105,255,218,0.15)") : "transparent", color: form.type===t ? (t==="expense"?"var(--negative)":"var(--positive)") : "var(--ink-muted)" }}>
                {t==="expense"?"Gasto":"Ingreso"}
              </button>
            ))}
          </div>
          <input style={inp} placeholder="¿En qué gastaste?" value={form.description} autoFocus onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-2">
            <input style={{ ...inp, width: "60%" }} placeholder="0.00" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <select style={{ ...inp, width: "40%" }} value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select style={{ ...inp, color: form.category_id ? "var(--ink)" : "var(--ink-dim)" }} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">Categoría (opcional)</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <input style={inp} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ background: "var(--accent)", color: "#060C09", fontSize: 15 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

interface Filters {
  categories: string[];
  types: string[];
}

function FilterSheet({ categories, filters, onApply, onClose }: {
  categories: Category[];
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>({ ...filters });

  function toggleCat(id: string) {
    setLocal(f => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter(x => x !== id) : [...f.categories, id],
    }));
  }
  function toggleType(v: string) {
    setLocal(f => ({
      ...f,
      types: f.types.includes(v) ? f.types.filter(x => x !== v) : [...f.types, v],
    }));
  }

  const activeCount = local.categories.length + local.types.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm p-5 flex flex-col gap-5 scale-up"
        style={{ borderRadius: "24px 24px 0 0", background: "rgba(10,20,13,0.97)", backdropFilter: "blur(48px)", border: "0.5px solid rgba(0,200,83,0.20)", borderBottom: "none", boxShadow: "0 -8px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.10)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>Filtrar</h2>
          <button onClick={onClose} style={{ fontSize: 12, color: "var(--ink-dim)" }}>✕</button>
        </div>

        {/* Tipo de movimiento */}
        <div className="flex flex-col gap-2">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)" }}>
            Tipo
          </p>
          <div className="flex flex-wrap gap-2">
            {TX_TYPES.map(t => {
              const on = local.types.includes(t.value);
              return (
                <button key={t.value} onClick={() => toggleType(t.value)}
                  style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                    background: on ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.06)",
                    color: on ? "var(--accent)" : "var(--ink-muted)",
                    border: on ? "0.5px solid rgba(0,200,83,0.30)" : "0.5px solid rgba(255,255,255,0.10)" }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categorías */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)" }}>
              Categoría
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const on = local.categories.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => toggleCat(cat.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                      background: on ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.06)",
                      color: on ? "var(--accent)" : "var(--ink-muted)",
                      border: on ? "0.5px solid rgba(0,200,83,0.30)" : "0.5px solid rgba(255,255,255,0.10)" }}>
                    <span>{cat.icon}</span>{cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <button onClick={() => { setLocal({ categories: [], types: [] }); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--ink-muted)", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            Limpiar
          </button>
          <button onClick={() => { onApply(local); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#060C09" }}>
            Aplicar{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
};

export default function ActividadPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ categories: [], types: [] });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

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
  }, [page, search, filters]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const activeFilters = filters.categories.length + filters.types.length;

  return (
    <div className="flex flex-col gap-4">
      {showModal && <AddModal onClose={() => setShowModal(false)} onSaved={fetchTransactions} />}
      {showFilter && (
        <FilterSheet
          categories={categories}
          filters={filters}
          onApply={(f) => { setFilters(f); setPage(1); }}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <h1 className="display font-semibold" style={{ fontSize: "1.35rem", color: "var(--ink)" }}>
          Actividad
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.open("/api/export?format=csv")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            CSV
          </button>
          <button
            onClick={() => window.open("/api/export?format=xlsx")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            Excel
          </button>
        </div>
      </div>

      {/* Search + Filter row */}
      <div className="flex gap-2 enter-up" data-delay="1">
        <input
          style={{ ...inp, borderRadius: 14, flex: 1 }}
          placeholder="Buscar..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <button
          onClick={() => setShowFilter(true)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "0 14px", borderRadius: 14, flexShrink: 0,
            background: activeFilters > 0 ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.06)",
            border: activeFilters > 0 ? "0.5px solid rgba(0,200,83,0.30)" : "0.5px solid rgba(0,200,83,0.16)",
            color: activeFilters > 0 ? "var(--accent)" : "var(--ink-muted)",
            fontSize: 13, fontWeight: 500,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Filtrar{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>

      {/* Active filter pills */}
      {activeFilters > 0 && (
        <div className="flex gap-2 flex-wrap" style={{ marginTop: -8 }}>
          {filters.types.map(t => (
            <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(0,200,83,0.12)", color: "var(--accent)", border: "0.5px solid rgba(0,200,83,0.25)" }}>
              {TX_TYPES.find(x => x.value === t)?.label}
            </span>
          ))}
          {filters.categories.map(id => {
            const cat = categories.find(c => c.id === id);
            return cat ? (
              <span key={id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(0,200,83,0.12)", color: "var(--accent)", border: "0.5px solid rgba(0,200,83,0.25)" }}>
                {cat.icon} {cat.name}
              </span>
            ) : null;
          })}
          <button onClick={() => { setFilters({ categories: [], types: [] }); setPage(1); }}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, color: "var(--ink-dim)", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            Limpiar
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col">
        {loading && (
          <div className="glass p-6 text-center" style={{ borderRadius: 18 }}>
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>Cargando...</p>
          </div>
        )}

        {!loading && transactions.length === 0 && (
          <div className="glass p-8 text-center flex flex-col items-center gap-3" style={{ borderRadius: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft)", border: "0.5px solid var(--glass-border-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--accent)" }}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>Sin movimientos</p>
            <button onClick={() => setShowModal(true)} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
              + Agregar el primero
            </button>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="glass flex flex-col" style={{ borderRadius: 18 }}>
            {transactions.map((t, i) => {
              const isIncome = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i < transactions.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isIncome ? "rgba(105,255,218,0.09)" : isInstall ? "rgba(255,179,0,0.09)" : "rgba(255,255,255,0.06)",
                  }}>
                    {t.category?.icon ? (
                      <span style={{ fontSize: 16 }}>{t.category.icon}</span>
                    ) : (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: amtColor, opacity: 0.7 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                      {t.date}{t.category?.name ? ` · ${t.category.name}` : ""}{t.card_name ? ` · ${t.card_name}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: amtColor, fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums" }}>
                      {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontSize: 9, color: "var(--ink-dim)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > 50 && (
        <div className="flex justify-between items-center">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 12, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page === 1 ? 0.3 : 1 }}>
            ← Ant
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
            {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} de {total}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 12, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page * 50 >= total ? 0.3 : 1 }}>
            Sig →
          </button>
        </div>
      )}
    </div>
  );
}
