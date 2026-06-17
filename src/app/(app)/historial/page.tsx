"use client";
import { useState, useEffect, useCallback, useId } from "react";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; }

const CURRENCIES = ["ARS","USD","EUR","CHF","BRL","UYU","CLP","PYG","BOB","COP","PEN","GBP"];

const TX_TYPES = [
  { value: "expense",             label: "Gastos" },
  { value: "income",              label: "Ingresos" },
  { value: "installment-payment", label: "Cuotas" },
  { value: "conversion",          label: "Conversiones" },
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

/* ─── Category SVG icons ──────────────────────────────── */
function CategoryIcon({ name, size = 16 }: { name?: string; size?: number }) {
  const n = (name ?? "").toLowerCase();
  const s = { width: size, height: size, flexShrink: 0 as const };
  const p: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };

  if (n.includes("comida") || n.includes("aliment") || n.includes("restaur") || n.includes("café"))
    return <svg {...p} style={s}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>;

  if (n.includes("transport") || n.includes("auto") || n.includes("nafta") || n.includes("uber"))
    return <svg {...p} style={s}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l2 3v3h-5z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;

  if (n.includes("ocio") || n.includes("entretenimiento") || n.includes("netflix") || n.includes("cine"))
    return <svg {...p} style={s}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;

  if (n.includes("hogar") || n.includes("casa") || n.includes("alquiler") || n.includes("supermercado"))
    return <svg {...p} style={s}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;

  if (n.includes("salud") || n.includes("médic") || n.includes("farmacia"))
    return <svg {...p} style={s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;

  if (n.includes("educaci") || n.includes("curso") || n.includes("libro"))
    return <svg {...p} style={s}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;

  if (n.includes("indumentaria") || n.includes("ropa") || n.includes("zapatillas"))
    return <svg {...p} style={s}><path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46A2 2 0 002 5.24l1 6.46a2 2 0 001.93 1.69h14.14a2 2 0 001.93-1.69l1-6.46a2 2 0 00-1.62-1.78z"/><path d="M8 12v9M16 12v9"/></svg>;

  if (n.includes("trabajo") || n.includes("oficina") || n.includes("hosting"))
    return <svg {...p} style={s}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;

  if (n.includes("suscripci") || n.includes("spotify") || n.includes("plan"))
    return <svg {...p} style={s}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;

  if (n.includes("viaje") || n.includes("hotel") || n.includes("turismo"))
    return <svg {...p} style={s}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.6a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .97h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;

  if (n.includes("mascota") || n.includes("pet"))
    return <svg {...p} style={s}><path d="M10 5.172C10 3.022 8.978 2 7.5 2S5 3.022 5 5.172c0 1.9 1.1 3.39 2 4.828h2c.9-1.437 1-2.928 1-4.828zM21.5 5.172C21.5 3.022 20.478 2 19 2S16.5 3.022 16.5 5.172c0 1.9 1.1 3.39 2 4.828h2c.9-1.437 1-2.928 1-4.828zM4 15s1-1 3-1 4 2 6 2 3-1 3-1"/><path d="M5 21.5C5 20 6.3 17 12 17s7 3 7 4.5V22H5z"/></svg>;

  // Default: activity pulse
  return <svg {...p} style={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}

/* ─── Expense breakdown donut (SVG) ─────────────────── */
const CAT_COLORS = [
  "#00E676","#FF453A","#FFD60A","#64D2FF","#BF5AF2",
  "#FF9F0A","#30D158","#FF6B6B","#5AC8FA","#AC8CF7",
];

function ExpenseDonut({ data }: { data: { name: string; amount: number }[] }) {
  const uid = useId().replace(/:/g, "");
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0 || data.length === 0) return null;

  const R = 42, CX = 56, CY = 56, stroke = 14;
  const circ = 2 * Math.PI * R;

  let offset = 0;
  const slices = data.slice(0, 8).map((d, i) => {
    const pct = d.amount / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const s = { pct, dash, gap, offset, color: CAT_COLORS[i % CAT_COLORS.length], name: d.name, amount: d.amount };
    offset += dash;
    return s;
  });

  function compact(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n/1_000)}K`;
    return String(Math.round(n));
  }

  return (
    <div className="glass enter-up" style={{ borderRadius: 16, padding: "16px" }} data-delay="1">
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 14 }}>
        Gastos por categoría
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {/* Donut */}
        <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
          <defs>
            <filter id={`glow-${uid}`}>
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {slices.map((s, i) => (
            <circle
              key={i}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={-(s.offset - circ / 4)}
              strokeLinecap="butt"
              style={{ opacity: 0.9 }}
            />
          ))}
          {/* Center */}
          <text x={CX} y={CY - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">
            {compact(total)}
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" fontSize="7" fill="rgba(235,235,245,0.40)">
            total
          </text>
        </svg>

        {/* Legend */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {Math.round(s.pct * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Filter sheet ──────────────────────────────────── */
interface Filters { categories: string[]; types: string[]; }

function FilterSheet({ categories, filters, onApply, onClose }: {
  categories: Category[]; filters: Filters;
  onApply: (f: Filters) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>({ ...filters });
  const activeCount = local.categories.length + local.types.length;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm p-5 flex flex-col gap-5 scale-up"
        style={{ borderRadius: "24px 24px 0 0", background: "rgba(10,20,13,0.97)", backdropFilter: "blur(48px)",
          border: "0.5px solid rgba(0,200,83,0.20)", borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.10)",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>Filtrar</h2>
          <button onClick={onClose} style={{ fontSize: 12, color: "var(--ink-dim)" }}>✕</button>
        </div>
        <div className="flex flex-col gap-2">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)" }}>Tipo</p>
          <div className="flex flex-wrap gap-2">
            {TX_TYPES.map(t => {
              const on = local.types.includes(t.value);
              return (
                <button key={t.value} onClick={() => setLocal(f => ({ ...f, types: on ? f.types.filter(x=>x!==t.value) : [...f.types, t.value] }))}
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
        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)" }}>Categoría</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const on = local.categories.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => setLocal(f => ({ ...f, categories: on ? f.categories.filter(x=>x!==cat.id) : [...f.categories, cat.id] }))}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                      background: on ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.06)",
                      color: on ? "var(--accent)" : "var(--ink-muted)",
                      border: on ? "0.5px solid rgba(0,200,83,0.30)" : "0.5px solid rgba(255,255,255,0.10)" }}>
                    <CategoryIcon name={cat.name} size={12} />{cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={() => setLocal({ categories: [], types: [] })}
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

/* ─── Page ─────────────────────────────────────────── */
export default function ActividadPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [search, setSearch]             = useState("");
  const [filters, setFilters]           = useState<Filters>({ categories: [], types: [] });
  const [page, setPage]                 = useState(1);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const [showFilter, setShowFilter]     = useState(false);

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

  // Expense breakdown for donut chart
  const expenseByCategory = transactions
    .filter((t) => t.type === "expense" || t.type === "installment-payment")
    .reduce<Record<string, { name: string; amount: number }>>((acc, t) => {
      const catName = t.category?.name ?? "Otros";
      if (!acc[catName]) acc[catName] = { name: catName, amount: 0 };
      acc[catName].amount += Number(t.amount);
      return acc;
    }, {});

  const expenseChartData = Object.values(expenseByCategory)
    .sort((a, b) => b.amount - a.amount);

  const activeFilters = filters.categories.length + filters.types.length;

  return (
    <div className="flex flex-col gap-4">
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
        <h1 className="display font-semibold" style={{ fontSize: "1.35rem", color: "var(--ink)" }}>Actividad</h1>
        <div className="flex gap-2">
          <button onClick={() => window.open("/api/export?format=csv")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
            CSV
          </button>
          <button onClick={() => window.open("/api/export?format=xlsx")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
            Excel
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 enter-up" data-delay="1">
        <input
          style={{ ...inp, borderRadius: 14, flex: 1 }}
          placeholder="Buscar..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <button onClick={() => setShowFilter(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px", borderRadius: 14, flexShrink: 0,
            background: activeFilters > 0 ? "rgba(0,230,118,0.15)" : "rgba(255,255,255,0.06)",
            border: activeFilters > 0 ? "0.5px solid rgba(0,230,118,0.30)" : "0.5px solid rgba(0,200,83,0.16)",
            color: activeFilters > 0 ? "var(--accent)" : "var(--ink-muted)", fontSize: 13, fontWeight: 500 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtrar{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>

      {/* Active filter pills */}
      {activeFilters > 0 && (
        <div className="flex gap-2 flex-wrap" style={{ marginTop: -8 }}>
          {filters.types.map(t => (
            <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(0,230,118,0.12)", color: "var(--accent)", border: "0.5px solid rgba(0,230,118,0.25)" }}>
              {TX_TYPES.find(x => x.value === t)?.label}
            </span>
          ))}
          {filters.categories.map(id => {
            const cat = categories.find(c => c.id === id);
            return cat ? (
              <span key={id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(0,230,118,0.12)", color: "var(--accent)", border: "0.5px solid rgba(0,230,118,0.25)" }}>
                {cat.name}
              </span>
            ) : null;
          })}
          <button onClick={() => { setFilters({ categories: [], types: [] }); setPage(1); }}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, color: "var(--ink-dim)", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            Limpiar
          </button>
        </div>
      )}

      {/* Expense donut */}
      {expenseChartData.length > 0 && (
        <ExpenseDonut data={expenseChartData} />
      )}

      {/* Transaction list */}
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
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>Sin movimientos</p>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="glass flex flex-col" style={{ borderRadius: 18 }}>
            {transactions.map((t, i) => {
              const isIncome  = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              const iconBg    = isIncome ? "rgba(48,209,88,0.10)" : isInstall ? "rgba(255,179,0,0.09)" : "rgba(255,255,255,0.07)";
              const iconColor = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--ink-dim)";
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i < transactions.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                }}>
                  {/* Category icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: iconBg,
                    color: iconColor,
                  }}>
                    <CategoryIcon name={t.category?.name} size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                      {t.category?.name ?? "Sin categoría"}{t.date ? ` · ${t.date}` : ""}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: amtColor, fontVariantNumeric: "tabular-nums" }}>
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

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-between items-center">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 12, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page===1?0.3:1 }}>
            ← Ant
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
            {(page-1)*50+1}–{Math.min(page*50, total)} de {total}
          </span>
          <button onClick={() => setPage(p => p+1)} disabled={page*50>=total}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 12, background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page*50>=total?0.3:1 }}>
            Sig →
          </button>
        </div>
      )}
    </div>
  );
}
