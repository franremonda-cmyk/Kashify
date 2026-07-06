"use client";
import { useState, useEffect, useCallback, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import CategoryIcon from "@/components/CategoryIcon";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import { useSpaces } from "@/context/SpaceContext";
import dynamic from "next/dynamic";
const ImportFlowLazy = dynamic(() => import("@/components/ImportFlow"), { ssr: false });
import TransactionSheet from "@/components/TransactionSheet";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import ExportSheet from "@/components/ExportSheet";
import TxBreakdownModal from "@/components/TxBreakdownModal";
import type { Transaction } from "@/types";
import { catColorOrFallback, FALLBACK_COLORS } from "@/lib/colors";

// Import modal usando el overlay estándar
function ImportModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (scrollRef.current && e.target instanceof Node && scrollRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.65)", touchAction: "none" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Importar transacciones"
        className="w-full max-w-sm flex flex-col"
        style={{ borderRadius: "24px 24px 0 0", background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "0 -8px 40px rgba(0,0,0,0.20)", maxHeight: "92dvh", minHeight: 0 }}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--glass-border-hover)", margin: "12px auto 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 0" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Importar transacciones</p>
            <button onClick={onClose} aria-label="Cerrar"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px 18px calc(28px + env(safe-area-inset-bottom, 0px))", touchAction: "pan-y" }}>
          <ImportFlowLazy
            inline
            onDone={(count) => { void count; onDone(); }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

interface Category { id: string; name: string; icon: string; color?: string; }

const TX_TYPES = [
  { value: "expense",             label: "Gastos" },
  { value: "income",              label: "Ingresos" },
  { value: "installment-payment", label: "Cuotas" },
  { value: "conversion",          label: "Conversiones" },
];

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
};

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
  color: "var(--ink)", fontSize: 16, width: "100%", outline: "none",
};

interface ChartEntry { name: string; amount: number; color?: string; }

function DonutChart({ data, income }: { data: ChartEntry[]; income: number }) {
  const uid = useId().replace(/:/g,"");
  const R = 44, CX = 56, CY = 56, stroke = 6;
  const GAP = 0.008;
  const circ = 2 * Math.PI * R;
  const base = income > 0 ? income : data.reduce((s, d) => s + d.amount, 0);
  let offset = 0;
  const slices = data.slice(0, 6).map((d, i) => {
    const pct = Math.min(d.amount / base, 1);
    const dash = Math.max(0, pct * circ - GAP * circ);
    const s = { pct, dash, offset: offset + (GAP * circ) / 2, color: d.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length], name: d.name, amount: d.amount };
    offset += pct * circ;
    return s;
  });
  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n/1_000)}K`;
    return String(Math.round(n));
  }
  const totalExpense = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        {/* Track = ingresos totales */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--raised)" strokeWidth={stroke}/>
        {/* Arcos = gastos por categoría sobre base de ingresos */}
        {slices.map((s, i) => (
          <circle key={`${uid}-${i}`} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt"/>
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#34C759" fontFamily="monospace">{fmt(income)}</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#FF453A" fontFamily="monospace">{fmt(totalExpense)}</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 13, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            <span style={{ fontSize: 12, color: "var(--ink-dim)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {income > 0 ? `${Math.round(s.pct * 100)}%` : fmt(s.amount)}
            </span>
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
        const color = d.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <CategoryIcon name={d.name} size={12}/>{d.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(d.amount)}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--raised)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: color, width: "100%", transform: `scaleX(${pct / 100})`, transformOrigin: "left", transition: "transform 500ms cubic-bezier(0.22,1,0.36,1)" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const segBtn = (on: boolean): React.CSSProperties => ({
  minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "0 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  background: on ? "var(--base)" : "transparent",
  color: on ? "var(--accent)" : "var(--ink-muted)",
  boxShadow: on ? "var(--shadow-sm)" : "none",
});

function ExpenseBreakdown({ data, spaceData, incomeData, allCurrencies, canSplitBySpace }: {
  data: Record<string, ChartEntry[]>; spaceData?: Record<string, ChartEntry[]>;
  incomeData: Record<string, number>; allCurrencies: string[]; canSplitBySpace?: boolean;
}) {
  const [mode, setMode]         = useState<"donut" | "bar">("donut");
  const [groupBy, setGroupBy]   = useState<"categoria" | "espacio">("categoria");
  const [currency, setCurrency] = useState(allCurrencies[0] ?? "ARS");
  const group  = canSplitBySpace ? groupBy : "categoria";
  const active = (group === "espacio" ? (spaceData ?? {}) : data)[currency] ?? [];
  const total  = active.reduce((s, d) => s + d.amount, 0);
  if (allCurrencies.length === 0 || total === 0) return null;
  return (
    <div style={{ borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "var(--shadow-sm)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>{group === "espacio" ? "Gastos por espacio" : "Gastos por categoría"}</p>
        <div style={{ display: "flex", gap: 1, background: "var(--raised)", borderRadius: 7, padding: 2 }}>
          {(["donut","bar"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={segBtn(mode === m)}>{m === "donut" ? "Circular" : "Barras"}</button>
          ))}
        </div>
      </div>
      {canSplitBySpace && (
        <div style={{ display: "flex", gap: 1, background: "var(--raised)", borderRadius: 7, padding: 2, marginBottom: 12, width: "fit-content" }}>
          {(["categoria","espacio"] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)} style={segBtn(group === g)}>{g === "categoria" ? "Categoría" : "Espacio"}</button>
          ))}
        </div>
      )}
      {allCurrencies.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {allCurrencies.map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              minHeight: 44, display: "inline-flex", alignItems: "center",
              padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              background: currency === c ? "var(--accent)" : "var(--raised)",
              color: currency === c ? "#04130D" : "var(--ink-muted)",
              border: currency === c ? "none" : "0.5px solid var(--glass-border)",
            }}>{c}</button>
          ))}
        </div>
      )}
      {mode === "donut" ? <DonutChart data={active} income={incomeData[currency] ?? 0}/> : <BarChart data={active} total={total}/>}
    </div>
  );
}

interface Filters { categories: string[]; types: string[]; sort: string; }

function FilterSheet({ categories, filters, onApply, onClose }: {
  categories: Category[]; filters: Filters;
  onApply: (f: Filters) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>({ ...filters });
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

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
  const { activeId, spaces } = useSpaces();
  const [transactions, setTransactions]     = useState<Transaction[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [search, setSearch]                 = useState("");
  const [filters, setFilters]               = useState<Filters>({ categories: [], types: [], sort: "date_desc" });
  const [loading, setLoading]               = useState(false);
  const [loadError, setLoadError]           = useState(false);
  const [showFilter, setShowFilter]         = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ARS");
  const [selectedTx, setSelectedTx]         = useState<Transaction | null>(null);
  const [showImport, setShowImport]         = useState(false);
  const [showExport, setShowExport]         = useState(false);
  const [viewYear, setViewYear]             = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth]           = useState(() => new Date().getMonth() + 1);
  const [breakdownType, setBreakdownType] = useState<"income" | "expense" | null>(null);
  const currencyInitialized = useRef(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then((cats: { id: string; name: string; color?: string; icon?: string }[]) => {
      setCategories(cats.map(c => ({ id: c.id, name: c.name, icon: c.icon ?? "", color: c.color })));
    }).catch(() => {});
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.primary_currency && !currencyInitialized.current) {
            currencyInitialized.current = true;
            setSelectedCurrency(data.primary_currency);
          }
        });
    });
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const from = `${viewYear}-${String(viewMonth).padStart(2,"0")}-01`;
    const lastDay = new Date(viewYear, viewMonth, 0).getDate();
    const to = `${viewYear}-${String(viewMonth).padStart(2,"0")}-${lastDay}`;
    // ponytail: el mes completo de una (cap 1000) — lista, totales y donut salen
    // del MISMO set; filtros/búsqueda/orden son client-side y no se desincronizan.
    try {
      const res = await fetch(`/api/transactions?from=${from}&to=${to}&space=${activeId}&limit=1000`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setTransactions(json.data ?? []);
    } catch {
      setTransactions([]);
      setLoadError(true);
    }
    setLoading(false);
  }, [viewYear, viewMonth, activeId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    const handler = () => fetchTransactions();
    window.addEventListener("transaction-added", handler);
    return () => window.removeEventListener("transaction-added", handler);
  }, [fetchTransactions]);

  const availableCurrencies = useMemo(() => {
    const set = new Set(transactions.map(t => t.currency_code ?? "ARS"));
    return Array.from(set).sort();
  }, [transactions]);

  // Una sola pipeline: moneda → categorías → tipos → búsqueda → orden.
  // Todo lo que se muestra (lista, totales, donut) sale de acá.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortTransactions(
      transactions.filter(t =>
        (t.currency_code ?? "ARS") === selectedCurrency
        && (filters.categories.length === 0 || filters.categories.includes(t.category_id ?? ""))
        && (filters.types.length === 0 || filters.types.includes(t.type))
        && (!q || (t.description ?? "").toLowerCase().includes(q))
      ),
      filters.sort,
    );
  }, [transactions, selectedCurrency, filters, search]);

  const incomeTotal  = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenseTotal = filtered.filter(t => t.type === "expense" || t.type === "installment-payment").reduce((s, t) => s + Number(t.amount), 0);
  const net          = incomeTotal - expenseTotal;

  const incomeByCurrency: Record<string, number> = {};
  const expenseByCurrency: Record<string, Record<string, ChartEntry>> = {};
  filtered.forEach(t => {
    const cur = t.currency_code ?? "ARS";
    if (t.type === "income") {
      incomeByCurrency[cur] = (incomeByCurrency[cur] ?? 0) + Number(t.amount);
    } else if (t.type === "expense" || t.type === "installment-payment") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = (t as any).categories ?? t.category;
      const catName = cat?.name ?? "Otros";
      const catColor = catColorOrFallback(cat?.color, catName);
      if (!expenseByCurrency[cur]) expenseByCurrency[cur] = {};
      if (!expenseByCurrency[cur][catName]) expenseByCurrency[cur][catName] = { name: catName, amount: 0, color: catColor };
      expenseByCurrency[cur][catName].amount += Number(t.amount);
    }
  });
  const chartDataByCurrency: Record<string, ChartEntry[]> = {};
  for (const [cur, byName] of Object.entries(expenseByCurrency)) {
    chartDataByCurrency[cur] = Object.values(byName).sort((a, b) => b.amount - a.amount);
  }
  const chartCurrencies = Object.keys(chartDataByCurrency);

  // Gastos agrupados por espacio (toggle Categoría/Espacio en Total).
  const includedSpacesCount = spaces.filter(s => s.include_in_total).length;
  const canSplitBySpace = activeId === "total" && includedSpacesCount > 1;
  const spaceChartByCurrency: Record<string, ChartEntry[]> = {};
  if (canSplitBySpace) {
    const byId: Record<string, ChartEntry> = {};
    filtered.forEach(t => {
      if (t.type !== "expense" && t.type !== "installment-payment") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sid = (t as any).space_id ?? "none";
      const sp = spaces.find(s => s.id === sid);
      if (!byId[sid]) byId[sid] = { name: sp?.name ?? "Sin espacio", amount: 0, color: sp?.color ?? "#6b7280" };
      byId[sid].amount += Number(t.amount);
    });
    const arr = Object.values(byId).sort((a, b) => b.amount - a.amount);
    if (arr.length) spaceChartByCurrency[selectedCurrency] = arr;
  }

  const activeFilters   = filters.categories.length + filters.types.length;
  const activeSort      = filters.sort !== "date_desc";

  return (
    <div className="flex flex-col gap-6">
      {showFilter && (
        <FilterSheet categories={categories} filters={filters}
          onApply={setFilters}
          onClose={() => setShowFilter(false)}/>
      )}

      {showImport && (
        <ImportModal
          onDone={() => { setShowImport(false); fetchTransactions(); }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showExport && <ExportSheet onClose={() => setShowExport(false)} />}

      {selectedTx && (
        <TransactionSheet
          tx={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={() => { setSelectedTx(null); fetchTransactions(); }}
          onSaved={() => { setSelectedTx(null); fetchTransactions(); }}
        />
      )}

      <div className="flex items-center justify-between enter-up" style={{ position: "relative", zIndex: 10 }}>
        <h1 className="page-title">Actividad</h1>
        <div className="flex gap-2" style={{ position: "relative" }}>
          <button onClick={() => setShowImport(true)} style={{ fontSize: 13, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 8, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)", fontWeight: 600 }}>↑ Importar</button>
          <button onClick={() => setShowExport(true)} style={{ fontSize: 13, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 8, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontWeight: 500 }}>↓ Exportar</button>
        </div>
      </div>

      {/* Selector de espacio (se autoesconde si hay uno solo) */}
      <SpaceSwitcher />

      {/* Navegador de meses */}
      {(() => {
        const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const now = new Date();
        const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
        function prevMonth() {
          if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
          else setViewMonth(m => m - 1);
        }
        function nextMonth() {
          if (isCurrentMonth) return;
          if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
          else setViewMonth(m => m + 1);
        }
        return (
          <div className="enter-up flex items-center justify-between" style={{ background: "var(--base)", border: "0.5px solid var(--glass-border)", borderRadius: 14, padding: "6px 10px", boxShadow: "var(--shadow-sm)" }}>
            <button onClick={prevMonth} aria-label="Mes anterior"
              style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {MONTHS_ES[viewMonth - 1]} {viewYear}
              </p>
              {isCurrentMonth && <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 1 }}>mes actual</p>}
            </div>
            <button onClick={nextMonth} aria-label="Mes siguiente"
              disabled={isCurrentMonth}
              style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: isCurrentMonth ? "var(--ink-dim)" : "var(--ink-muted)", opacity: isCurrentMonth ? 0.4 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        );
      })()}

      {availableCurrencies.length > 1 && (
        <div className="enter-up" data-delay="1" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {availableCurrencies.map(c => (
            <button key={c}
              onClick={() => setSelectedCurrency(c)}
              style={{
                minHeight: 44, display: "inline-flex", alignItems: "center",
                padding: "0 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: selectedCurrency === c ? "var(--accent)" : "var(--raised)",
                color: selectedCurrency === c ? "#04130D" : "var(--ink-muted)",
                border: selectedCurrency === c ? "none" : "0.5px solid var(--glass-border)",
                transition: "all 180ms ease-out",
              }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }} className="enter-up" data-delay="1">
          <button onClick={() => setBreakdownType("income")} className="card-glass" style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 78 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--positive)", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>Ingresos</p>
            </div>
            <p className="mono" style={{ fontSize: "clamp(0.78rem, 3vw, 1.4rem)", fontWeight: 700, whiteSpace: "nowrap", color: "var(--positive)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{incomeTotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
          </button>
          <button onClick={() => setBreakdownType("expense")} className="card-glass" style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 78 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--negative)", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>Gastos</p>
            </div>
            <p className="mono" style={{ fontSize: "clamp(0.78rem, 3vw, 1.4rem)", fontWeight: 700, whiteSpace: "nowrap", color: "var(--negative)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{expenseTotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
          </button>
          <div className="card-glass" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 8, minHeight: 78 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: net >= 0 ? "var(--positive)" : "var(--negative)", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>Neto</p>
            </div>
            <p className="mono" style={{ fontSize: "clamp(0.78rem, 3vw, 1.4rem)", fontWeight: 700, whiteSpace: "nowrap", color: net >= 0 ? "var(--positive)" : "var(--negative)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{net.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}

      {chartCurrencies.length > 0 && <ExpenseBreakdown data={chartDataByCurrency} spaceData={spaceChartByCurrency} incomeData={incomeByCurrency} allCurrencies={chartCurrencies} canSplitBySpace={canSplitBySpace}/>}

      <div className="flex gap-2 enter-up" data-delay="2">
        <input style={{ ...inp, borderRadius: 12, flex: 1 }} placeholder="Buscar…"
          type="search" aria-label="Buscar transacciones" autoComplete="off"
          value={search} onChange={(e) => setSearch(e.target.value)}/>
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

      <div className="flex flex-col gap-2">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 className="section-title">Transacciones</h2>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-quick-add", { detail: { type: "expense" } }))}
            className="section-link"
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            + Agregar
          </button>
        </div>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)" }}>
            <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>Cargando...</p>
          </div>
        )}
        {!loading && loadError && (
          <div style={{ padding: 32, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>No pudimos cargar tus movimientos.</p>
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Puede ser la conexión — tus datos están a salvo.</p>
            <button onClick={fetchTransactions}
              style={{ padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#04130D" }}>
              Reintentar
            </button>
          </div>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>Sin movimientos</p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-quick-add", { detail: { type: "expense" } }))}
              style={{ padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#04130D" }}>
              + Agregar movimiento
            </button>
          </div>
        )}
        {!loading && filtered.length > 0 && (() => {
          // Libro diario: agrupado por día cuando el orden es cronológico; con
          // otros órdenes (monto, categoría, tipo) la lista va plana.
          const byDay = filters.sort.startsWith("date");
          const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
          const labelFor = (iso: string) => {
            const diff = Math.round((Date.parse(todayISO) - Date.parse(iso)) / 86_400_000);
            if (diff === 0) return "Hoy";
            if (diff === 1) return "Ayer";
            const l = new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
            return l.charAt(0).toUpperCase() + l.slice(1);
          };
          const groups: { key: string; label: string; txs: typeof filtered }[] = [];
          for (const t of filtered) {
            const key = byDay ? t.date : "all";
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.txs.push(t);
            else groups.push({ key, label: byDay ? labelFor(t.date) : "", txs: [t] });
          }
          const row = (t: (typeof filtered)[number]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const catData   = (t as any).categories ?? t.category;
            const isIncome  = t.type === "income";
            const isInstall = t.type === "installment-payment";
            const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
            const catColor  = catColorOrFallback(catData?.color, catData?.name ?? "");
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTx(t)}
                className="press list-row"
                style={{ transition: "background 120ms ease-out" }}
              >
                <div className="list-row__icon" style={{ background: `${catColor}22`, color: catColor }}>
                  <CategoryIcon name={catData?.name} icon={catData?.icon} color={catData?.color} size={18}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</p>
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>{catData?.name ?? "Sin categoría"}{!byDay && t.date ? ` · ${new Date(t.date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p className="mono" style={{ fontSize: 14.5, fontWeight: 700, color: amtColor, fontVariantNumeric: "tabular-nums" }}>
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{TYPE_LABELS[t.type] ?? t.type}</p>
                </div>
              </button>
            );
          };
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {groups.map((g) => (
                <div key={g.key}>
                  {g.label && (
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-dim)", padding: "0 2px 6px" }}>{g.label}</p>
                  )}
                  <div className="card-solid" style={{ overflow: "hidden" }}>
                    {g.txs.map(row)}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {breakdownType && (
        <TxBreakdownModal
          type={breakdownType}
          currency={selectedCurrency}
          onClose={() => setBreakdownType(null)}
        />
      )}
    </div>
  );
}
