"use client";
import { useState, useEffect, useCallback, useId } from "react";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; }

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

/* ─── SF-Symbol style category icons ───────────────────── */
function CategoryIcon({ name, size = 16 }: { name?: string; size?: number }) {
  const n = (name ?? "").toLowerCase();
  const p: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    width: size, height: size,
  };
  if (n.includes("comida") || n.includes("aliment") || n.includes("restaur") || n.includes("café") || n.includes("cafe"))
    return <svg {...p}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>;
  if (n.includes("transport") || n.includes("uber") || n.includes("nafta") || n.includes("auto") || n.includes("taxi"))
    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l2 3v3h-5z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
  if (n.includes("ocio") || n.includes("entret") || n.includes("netflix") || n.includes("cine") || n.includes("spotify"))
    return <svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  if (n.includes("hogar") || n.includes("casa") || n.includes("alquiler") || n.includes("supermercado"))
    return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (n.includes("salud") || n.includes("médic") || n.includes("medic") || n.includes("farmacia"))
    return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
  if (n.includes("educaci") || n.includes("curso") || n.includes("libro"))
    return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
  if (n.includes("ropa") || n.includes("indument") || n.includes("zapatilla"))
    return <svg {...p}><path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46A2 2 0 002 5.24l1 6.46a2 2 0 001.93 1.69h14.14a2 2 0 001.93-1.69l1-6.46a2 2 0 00-1.62-1.78z"/></svg>;
  if (n.includes("trabajo") || n.includes("oficina") || n.includes("hosting"))
    return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
  if (n.includes("suscripci") || n.includes("membresia") || n.includes("plan"))
    return <svg {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
  if (n.includes("viaje") || n.includes("hotel") || n.includes("turismo"))
    return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
  // Default: pulse
  return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}

/* ─── Donut / Bar chart ──────────────────────────────── */
const CAT_COLORS = [
  "#7B61FF","#34C759","#FF3B30","#FF9500","#5AC8FA",
  "#BF5AF2","#FF6B6B","#30D158","#FFD60A","#64D2FF",
];

interface ChartEntry { name: string; amount: number; }

function DonutChart({ data, total }: { data: ChartEntry[]; total: number }) {
  const uid = useId().replace(/:/g, "");
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

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width="116" height="116" viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--glass-border)" strokeWidth={stroke}/>
        {slices.map((s, i) => (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt"
          />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{fmt(total)}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="var(--ink-dim)">total</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{Math.round(s.pct * 100)}%</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.slice(0, 6).map((d, i) => {
        const pct = total > 0 ? (d.amount / total) * 100 : 0;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <CategoryIcon name={d.name} size={11} />
                {d.name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {fmt(d.amount)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--raised)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: CAT_COLORS[i % CAT_COLORS.length],
                width: `${pct}%`,
                transition: "width 500ms cubic-bezier(0.22,1,0.36,1)",
              }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseBreakdown({ data }: { data: ChartEntry[] }) {
  const [mode, setMode] = useState<"donut" | "bar">("donut");
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0 || data.length === 0) return null;

  return (
    <div style={{
      borderRadius: 16, background: "var(--base)",
      border: "0.5px solid var(--glass-border)", boxShadow: "var(--shadow-sm)",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)" }}>Gastos por categoría</p>
        <div style={{ display: "flex", gap: 1, background: "var(--raised)", borderRadius: 7, padding: 2 }}>
          {(["donut","bar"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                background: mode === m ? "var(--base)" : "transparent",
                color: mode === m ? "var(--accent)" : "var(--ink-dim)",
                boxShadow: mode === m ? "var(--shadow-sm)" : "none",
              }}>
              {m === "donut" ? "Circular" : "Barras"}
            </button>
          ))}
        </div>
      </div>
      {mode === "donut" ? <DonutChart data={data} total={total}/> : <BarChart data={data} total={total}/>}
    </div>
  );
}

/* ─── Filter + Sort sheet ────────────────────────────── */
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
      <div className="w-full max-w-sm p-5 flex flex-col gap-5 scale-up"
        style={{
          borderRadius: "20px 20px 0 0",
          background: "var(--base)",
          borderTop: "0.5px solid var(--glass-border)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.10)",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Filtrar y ordenar</h2>
          <button onClick={onClose} style={{ fontSize: 12, color: "var(--ink-dim)", padding: "4px 8px" }}>✕</button>
        </div>

        {/* Sort */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", marginBottom: 8 }}>Ordenar por</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {SORT_OPTIONS.map(o => {
              const on = local.sort === o.value;
              return (
                <button key={o.value} onClick={() => setLocal(f => ({ ...f, sort: o.value }))}
                  style={{
                    padding: "7px 10px", borderRadius: 9, fontSize: 11, fontWeight: 500,
                    textAlign: "left",
                    background: on ? "var(--accent-soft)" : "var(--raised)",
                    color: on ? "var(--accent)" : "var(--ink-muted)",
                    border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                  }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", marginBottom: 8 }}>Tipo</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TX_TYPES.map(t => {
              const on = local.types.includes(t.value);
              return (
                <button key={t.value} onClick={() => setLocal(f => ({
                  ...f, types: on ? f.types.filter(x=>x!==t.value) : [...f.types, t.value],
                }))}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: on ? "var(--accent-soft)" : "var(--raised)",
                    color: on ? "var(--accent)" : "var(--ink-muted)",
                    border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", marginBottom: 8 }}>Categoría</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map(cat => {
                const on = local.categories.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => setLocal(f => ({
                    ...f, categories: on ? f.categories.filter(x=>x!==cat.id) : [...f.categories, cat.id],
                  }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: on ? "var(--accent-soft)" : "var(--raised)",
                      color: on ? "var(--accent)" : "var(--ink-muted)",
                      border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                    }}>
                    <CategoryIcon name={cat.name} size={11}/>{cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setLocal({ categories: [], types: [], sort: "date_desc" })}
            style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 500,
              background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>
            Limpiar
          </button>
          <button onClick={() => { onApply(local); onClose(); }}
            style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: "var(--accent)", color: "#FFFFFF" }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
};

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

/* ─── Page ─────────────────────────────────────────── */
export default function ActividadPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [search, setSearch]             = useState("");
  const [filters, setFilters]           = useState<Filters>({ categories: [], types: [], sort: "date_desc" });
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
  }, [page, search, filters.categories, filters.types]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const sorted = sortTransactions(transactions, filters.sort);

  // Expense breakdown — fix: Supabase join returns "categories" key, not "category"
  const expenseByCategory = sorted
    .filter(t => t.type === "expense" || t.type === "installment-payment")
    .reduce<Record<string, ChartEntry>>((acc, t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catName = (t as any).categories?.name ?? t.category?.name ?? "Otros";
      if (!acc[catName]) acc[catName] = { name: catName, amount: 0 };
      acc[catName].amount += Number(t.amount);
      return acc;
    }, {});

  const expenseChartData = Object.values(expenseByCategory).sort((a,b) => b.amount - a.amount);

  const activeFilters = filters.categories.length + filters.types.length;
  const activeSort    = filters.sort !== "date_desc";

  return (
    <div className="flex flex-col gap-4">
      {showFilter && (
        <FilterSheet categories={categories} filters={filters}
          onApply={(f) => { setFilters(f); setPage(1); }}
          onClose={() => setShowFilter(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <h1 className="display font-semibold" style={{ fontSize: "1.35rem", color: "var(--ink)" }}>Actividad</h1>
        <div className="flex gap-2">
          <button onClick={() => window.open("/api/export?format=csv")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
            CSV
          </button>
          <button onClick={() => window.open("/api/export?format=xlsx")}
            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
            Excel
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 enter-up" data-delay="1">
        <input style={{ ...inp, borderRadius: 12, flex: 1 }} placeholder="Buscar..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <button onClick={() => setShowFilter(true)}
          style={{
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

      {/* Expense chart */}
      {expenseChartData.length > 0 && <ExpenseBreakdown data={expenseChartData} />}

      {/* Transaction list */}
      <div className="flex flex-col">
        {loading && (
          <div style={{ padding: 24, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)" }}>
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>Cargando...</p>
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>Sin movimientos</p>
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)" }}>
            {sorted.map((t, i) => {
              // Fix: Supabase join field is "categories" (table name), not "category"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const catData = (t as any).categories ?? t.category;
              const isIncome  = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              const iconBg    = isIncome ? "rgba(52,199,89,0.09)" : isInstall ? "rgba(255,149,0,0.09)" : "rgba(255,59,48,0.07)";
              const iconColor = amtColor;
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i < sorted.length-1 ? "0.5px solid var(--glass-border-dim)" : "none",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: iconBg, color: iconColor,
                  }}>
                    <CategoryIcon name={catData?.name} size={16}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                      {catData?.name ?? "Sin categoría"}{t.date ? ` · ${t.date}` : ""}
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

      {total > 50 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page===1?0.3:1 }}>
            ← Ant
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
            {(page-1)*50+1}–{Math.min(page*50, total)} de {total}
          </span>
          <button onClick={() => setPage(p => p+1)} disabled={page*50>=total}
            style={{ fontSize: 13, padding: "8px 16px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", opacity: page*50>=total?0.3:1 }}>
            Sig →
          </button>
        </div>
      )}
    </div>
  );
}
