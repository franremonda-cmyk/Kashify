"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import HeroBalanceCard from "./HeroBalanceCard";
import SpacesOverview, { type SpaceCardData } from "./SpacesOverview";
import CategoryIcon from "./CategoryIcon";
import type { ChartMonth, SpaceExpenseStack } from "./SpendingChart";
const SpendingChart = dynamic(() => import("./SpendingChart"), { ssr: false, loading: () => <div style={{ height: 200 }} /> });
import TransactionSheet from "./TransactionSheet";
import BudgetDetailModal from "./BudgetDetailModal";
import TxBreakdownModal from "./TxBreakdownModal";
import type { BalanceView, SavingsGoal } from "@/types";

interface CurrencyMetrics { currency_code: string; income: number; expense: number; prevIncome?: number; prevExpense?: number; }
interface RecentTx {
  id: string;
  description: string; amount: number; currency_code: string;
  type: string; date: string;
  categories?: { name?: string; icon?: string; color?: string } | null;
}
interface Category { id: string; name: string; icon?: string; color?: string; }

const FALLBACK_COLORS = [
  "#C8820A","#7B61FF","#34C759","#FF9500","#5AC8FA",
  "#BF5AF2","#FF6B6B","#30D158","#FFD60A","#64D2FF",
];
function catColorOrFallback(color: string | undefined | null, name: string): string {
  if (color) return color;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

interface BudgetEntry {
  id: string;
  category_id?: string;
  name: string;
  color?: string;
  icon?: string;
  monthly_limit: number;
  currency_code: string;
  spent?: number;
  period_type?: "always" | "specific_months";
  applies_months?: number[] | null;
}

interface InstallmentEntry {
  id: string;
  name: string;
  currency_code: string;
  n_installments: number;
  installment_amount: number;
  paid: number;
  color?: string;
  icon?: string;
}

interface Props {
  balances: BalanceView[];
  primaryCurrency: string;
  spacesOverview?: SpaceCardData[];
  metrics: CurrencyMetrics[];
  dayOfMonth?: number;
  daysInMonth?: number;
  chartData: Record<string, ChartMonth[]>;
  spaceStacksData?: Record<string, SpaceExpenseStack[]>;
  recent: RecentTx[];
  goals?: SavingsGoal[];
  budgets?: BudgetEntry[];
  installments?: InstallmentEntry[];
}

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/",
};

function useCounter(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const raf = useRef<number>(0);
  const from = useRef(target);
  useEffect(() => {
    // Respeta prefers-reduced-motion: sin conteo animado, salta al valor final.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => { setValue(target); from.current = target; });
      return () => cancelAnimationFrame(raf.current);
    }
    const start = performance.now();
    const startVal = from.current;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(startVal + (target - startVal) * ease);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function MetricCard({ label, value, sym, isIncome, deltaPct, onClick }: {
  label: string; value: number; sym: string; isIncome: boolean; deltaPct?: number | null; onClick?: () => void;
}) {
  const animated = useCounter(value);
  const color  = isIncome ? "var(--positive)" : "var(--negative)";
  const full   = animated.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct);
  // Para ingresos subir es bueno; para gastos, bajar es bueno.
  const good = hasDelta ? (isIncome ? deltaPct! >= 0 : deltaPct! <= 0) : null;

  return (
    <button onClick={onClick} className="press glow-hover glass-card" style={{ flex: 1, minWidth: 0, containerType: "inline-size", padding: "16px 16px", borderRadius: 18, textAlign: "left", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>{label}</p>
      </div>
      <p className="mono metric-value" style={{
        fontWeight: 700, color, letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums", lineHeight: 1.05, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "clip", maxWidth: "100%",
      }}>
        {sym} {full}
      </p>
      {hasDelta ? (
        <p style={{ fontSize: 12, marginTop: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ color: good ? "var(--positive)" : "var(--negative)" }}>{deltaPct! >= 0 ? "▲" : "▼"} {Math.abs(deltaPct!).toFixed(0)}%</span>
          <span style={{ color: "var(--ink-dim)", fontWeight: 500 }}>vs mes ant.</span>
        </p>
      ) : onClick ? (
        <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8, fontWeight: 500 }}>Ver desglose →</p>
      ) : null}
    </button>
  );
}

// Tasa de ahorro del mes (ingresos vs gastos). Se oculta si no hay ingresos.
function SavingsCard({ income, expense, sym }: { income: number; expense: number; sym: string }) {
  if (income <= 0) return null;
  const saved = income - expense;
  const rate = (saved / income) * 100;
  const positive = saved >= 0;
  const barPct = Math.max(0, Math.min(100, rate));
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const col = positive ? "var(--positive)" : "var(--negative)";
  return (
    <div className="glass-card enter-up" data-delay="2" style={{ padding: "16px 18px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>Tasa de ahorro · este mes</p>
        <p className="mono" style={{ fontSize: 20, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums" }}>{Math.round(rate)}%</p>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
        <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 999, background: col, transition: "width 500ms ease-out" }} />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>
        {positive
          ? `Guardaste ${sym} ${fmt(saved)} de ${sym} ${fmt(income)} de ingresos.`
          : `Gastaste ${sym} ${fmt(-saved)} más de lo que ingresó este mes.`}
      </p>
    </div>
  );
}

// Mini donut solo el círculo — colapsable
function MiniDonut({ data, income, sym }: { data: { name: string; amount: number; color?: string }[]; income: number; sym: string }) {
  const [expanded, setExpanded] = useState(false);
  const R = 40, CX = 50, CY = 50, stroke = 7;
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
  const totalExp = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div style={{ borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px" }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--raised)" strokeWidth={stroke}/>
          {slices.map((s, i) => (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-(s.offset - circ / 4)}
              strokeLinecap="butt"/>
          ))}
          <text x={CX} y={CY - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--positive)" fontFamily="monospace">{sym}{fmt(income)}</text>
          <text x={CX} y={CY + 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--negative)" fontFamily="monospace">{sym}{fmt(totalExp)}</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 8 }}>Gastos por categoría</p>
          {/* Top 2 categorías siempre visibles */}
          {slices.slice(0, 2).map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <div style={{ width: 3, height: 12, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 13, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ fontSize: 12, color: "var(--ink-dim)", fontVariantNumeric: "tabular-nums" }}>
                {income > 0 ? `${Math.round(s.pct * 100)}%` : fmt(s.amount)}
              </span>
            </div>
          ))}
          {slices.length > 2 && (
            <button onClick={() => setExpanded(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "transparent", marginTop: 2 }}>
              {expanded ? "Ver menos ↑" : `+${slices.length - 2} más ↓`}
            </button>
          )}
        </div>
      </div>
      {/* Detalle expandido */}
      {expanded && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 6, borderTop: "0.5px solid var(--glass-border-dim)" }}>
          {slices.slice(2).map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: i === 0 ? 10 : 0 }}>
              <div style={{ width: 3, height: 12, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 13, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ fontSize: 12, color: "var(--ink-dim)", fontVariantNumeric: "tabular-nums" }}>
                {income > 0 ? `${Math.round(s.pct * 100)}%` : fmt(s.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Ritmo de gasto: pace lineal → proyección de cierre de mes. Estimación.
function ProjectionCard({ expense, dayOfMonth, daysInMonth, sym }: { expense: number; dayOfMonth: number; daysInMonth: number; sym: string }) {
  if (expense <= 0 || dayOfMonth < 1 || dayOfMonth >= daysInMonth) return null;
  const projected = (expense / dayOfMonth) * daysInMonth;
  const elapsed = Math.min(100, (dayOfMonth / daysInMonth) * 100);
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return (
    <div className="glass-card enter-up" data-delay="3" style={{ padding: "16px 18px", borderRadius: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>Ritmo de gasto</p>
        <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>día {dayOfMonth} de {daysInMonth}</p>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
        <div style={{ width: `${elapsed}%`, height: "100%", borderRadius: 999, background: "var(--warning)", transition: "width 500ms ease-out" }} />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", lineHeight: 1.45 }}>
        Llevás <strong style={{ color: "var(--ink)" }}>{sym} {fmt(expense)}</strong> gastados. A este ritmo cerrás el mes en <strong style={{ color: "var(--ink)" }}>~{sym} {fmt(projected)}</strong>.
      </p>
    </div>
  );
}

// Widget compacto de metas — máx 2
function GoalsWidget({ goals }: { goals: SavingsGoal[] }) {
  const visible = goals.slice(0, 2);
  if (visible.length === 0) return null;
  function fmt(n: number, currency: string) {
    if (n >= 1_000_000) return `${currency} ${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${currency} ${Math.round(n/1_000)}K`;
    return `${currency} ${Math.round(n).toLocaleString("es-AR")}`;
  }
  return (
    <section className="flex flex-col gap-2 enter-up" data-delay="3">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title">Metas de ahorro</h2>
        <Link href="/metas" className="section-link">Ver todo →</Link>
      </div>
      <div className="card-glass" style={{ overflow: "hidden" }}>
        {visible.map((g) => {
          const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
          const reached = g.status === "reached" || g.current_amount >= g.target_amount;
          return (
            <Link key={g.id} href="/metas" className="list-row">
              <div className="list-row__icon" style={{ background: g.color + "22", border: `1px solid ${g.color}33`, color: g.color }}>
                <CategoryIcon icon={g.icon} name={g.name} color={g.color} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{g.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: reached ? "var(--positive)" : "var(--ink-muted)", flexShrink: 0 }}>
                    {reached ? "✓ Lograda" : `${pct.toFixed(0)}%`}
                  </span>
                </div>
                <div style={{ width: "100%", height: 5, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: reached ? "var(--positive)" : g.color, transition: "width 400ms ease-out" }} />
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                  {fmt(g.current_amount, g.currency_code)} de {fmt(g.target_amount, g.currency_code)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Widget de cuotas activas — solo desktop
function CuotasWidget({ installments }: { installments: InstallmentEntry[] }) {
  if (installments.length === 0) return null;
  function fmt(n: number, c: string) {
    if (n >= 1_000_000) return `${c} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${c} ${Math.round(n / 1_000)}K`;
    return `${c} ${Math.round(n).toLocaleString("es-AR")}`;
  }
  return (
    <section className="desktop-only flex flex-col gap-2 enter-up" data-delay="5">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title">Cuotas activas</h2>
        <Link href="/cuotas" className="section-link">Ver todo →</Link>
      </div>
      <div className="card-glass" style={{ overflow: "hidden" }}>
        {installments.map((p) => {
          const pct = Math.min(100, (p.paid / p.n_installments) * 100);
          const color = p.color ?? "#46B58C";
          return (
            <Link key={p.id} href="/cuotas" className="list-row">
              <div className="list-row__icon" style={{ background: color + "22", border: `1px solid ${color}33`, color }}>
                <CategoryIcon icon={p.icon ?? "💳"} name={p.name} color={p.color} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", flexShrink: 0 }}>{p.paid}/{p.n_installments}</span>
                </div>
                <div style={{ width: "100%", height: 5, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 400ms ease-out" }} />
                </div>
                <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(p.installment_amount, p.currency_code)} / mes
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Franja horizontal de límites de categoría
function BudgetStrip({ budgets, currency, onSelect }: { budgets: BudgetEntry[]; currency: string; onSelect: (b: BudgetEntry) => void }) {
  // Sin tope: todas las categorías con límite, ordenadas por cercanía al 100%
  const pctOf = (b: BudgetEntry) =>
    b.monthly_limit > 0 ? Math.min(100, ((b.spent ?? 0) / b.monthly_limit) * 100) : 0;
  const relevant = budgets
    .filter(b => b.currency_code === currency)
    .sort((a, b) => pctOf(b) - pctOf(a));
  if (relevant.length === 0) return null;
  return (
    <section className="enter-up" data-delay="4" data-tour="budgets">
      <div className="section-head">
        <h2 className="section-title">Límites por categoría</h2>
        <Link href="/categorias" className="section-link">Ver todo →</Link>
      </div>
      {/* 1 row on mobile, 2 rows on tablet/desktop (CSS max-height clips the rest) */}
      <div className="budget-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {/* "Agregar" primero para que siempre se vea (incluida la única fila de mobile) */}
        <Link href="/categorias" className="press glow-hover" style={{ textDecoration: "none", flexShrink: 0, background: "none", border: "none", padding: 0, borderRadius: "var(--radius-chip)" }} aria-label="Agregar límite por categoría">
          <div className="glass-card budget-chip" style={{ borderStyle: "dashed", borderColor: "var(--glass-border-hover)" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 18, fontWeight: 400 }}>+</span>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-muted)", textAlign: "center" }}>Agregar</p>
          </div>
        </Link>
        {relevant.slice(0, 9).map((b) => {
          const pct = b.monthly_limit > 0 ? Math.min(100, ((b.spent ?? 0) / b.monthly_limit) * 100) : 0;
          const textColor = pct >= 100 ? "var(--negative)" : pct >= 80 ? "var(--warning)" : "var(--positive)";
          // Gradiente dinámico: verde→amarillo→rojo según porcentaje
          const gradientColor = pct < 50
            ? `hsl(${120 - pct * 0.6}, 72%, 50%)`
            : pct < 80
            ? `hsl(${90 - (pct - 50) * 2.4}, 80%, 48%)`
            : `hsl(${16 - Math.max(0, pct - 80) * 0.4}, 88%, 52%)`;
          return (
            <button key={b.id} className="press glow-hover" style={{ flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "var(--radius-chip)" }}
              onClick={() => onSelect(b)}>
              <div className="glass-card budget-chip">
                <div style={{ width: 28, height: 28, borderRadius: 8, background: (b.color ?? "#46B58C") + "22", border: `1px solid ${b.color ?? "#46B58C"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: b.color ?? "#46B58C" }}>
                  <CategoryIcon icon={b.icon} name={b.name} color={b.color} size={14} />
                </div>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{b.name}</p>
                <div style={{ width: "100%", height: 4, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: gradientColor, transition: "width 400ms ease-out" }} />
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: textColor, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardShell({ balances, primaryCurrency, spacesOverview = [], metrics, dayOfMonth = 1, daysInMonth = 30, chartData, spaceStacksData = {}, recent, goals = [], budgets = [], installments = [] }: Props) {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState(primaryCurrency);
  const [selectedTx, setSelectedTx] = useState<RecentTx | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetEntry | null>(null);
  const [breakdownType, setBreakdownType] = useState<"income" | "expense" | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAllTx, setShowAllTx] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  const m = metrics.find((x) => x.currency_code === selectedCurrency)
    ?? { currency_code: selectedCurrency, income: 0, expense: 0, prevIncome: 0, prevExpense: 0 };
  const sym = SYMBOLS[selectedCurrency] ?? selectedCurrency;
  const incomeDelta  = (m.prevIncome ?? 0)  > 0 ? ((m.income  - (m.prevIncome ?? 0))  / (m.prevIncome ?? 1))  * 100 : null;
  const expenseDelta = (m.prevExpense ?? 0) > 0 ? ((m.expense - (m.prevExpense ?? 0)) / (m.prevExpense ?? 1)) * 100 : null;
  const chartMonths = chartData[selectedCurrency] ?? [];

  // Categorías de gasto para el donut (mes actual, moneda seleccionada)
  const expenseByCategory: Record<string, { name: string; amount: number; color?: string }> = {};
  recent
    .filter(t => (t.type === "expense" || t.type === "installment-payment") && t.currency_code === selectedCurrency)
    .forEach(t => {
      const cat = t.categories as { name?: string; color?: string } | null;
      const catName = cat?.name ?? "Otros";
      const catColor = catColorOrFallback(cat?.color, catName);
      if (!expenseByCategory[catName]) expenseByCategory[catName] = { name: catName, amount: 0, color: catColor };
      expenseByCategory[catName].amount += Number(t.amount);
    });
  const donutData = Object.values(expenseByCategory).sort((a, b) => b.amount - a.amount);

  const visibleTx = showAllTx ? recent : recent.slice(0, 5);

  return (
    <div className="dashboard-shell flex flex-col gap-8">
      <div className="dash-full">
        <HeroBalanceCard
          balances={balances}
          primaryCurrency={primaryCurrency}
          selectedCurrency={selectedCurrency}
          onSelectCurrency={setSelectedCurrency}
        />
      </div>

      <div className="dash-metrics flex gap-3 enter-up" data-delay="2" data-tour="metrics">
        <MetricCard label="Ingresos" value={m.income}  sym={sym} isIncome={true}  deltaPct={incomeDelta}  onClick={() => setBreakdownType("income")} />
        <MetricCard label="Gastos"   value={m.expense} sym={sym} isIncome={false} deltaPct={expenseDelta} onClick={() => setBreakdownType("expense")} />
      </div>

      {/* Tasa de ahorro del mes */}
      {m.income > 0 && <div className="dash-full"><SavingsCard income={m.income} expense={m.expense} sym={sym} /></div>}

      {/* Ritmo de gasto / proyección */}
      {m.expense > 0 && dayOfMonth < daysInMonth && <div className="dash-full"><ProjectionCard expense={m.expense} dayOfMonth={dayOfMonth} daysInMonth={daysInMonth} sym={sym} /></div>}

      {/* Vista Total: desglose por espacio (cards horizontales) */}
      {spacesOverview.length > 1 && (
        <div className="dash-full">
          <SpacesOverview cards={spacesOverview} />
        </div>
      )}

      {/* Franja de límites por categoría */}
      <BudgetStrip budgets={budgets} currency={selectedCurrency} onSelect={setSelectedBudget} />

      {/* Últimas transacciones — máx 5 con botón ver todas */}
      {recent.length > 0 && (
        <section className="dash-tx-tile flex flex-col gap-2 enter-up" data-delay="4">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2 className="section-title">Últimas transacciones</h2>
            <Link href="/historial" className="section-link">Ver todo →</Link>
          </div>
          <div className="card-glass dash-tx-card" style={{ overflow: "hidden" }}>
            {visibleTx.map((t, i) => {
              const cat = t.categories as { name?: string; icon?: string; color?: string } | null;
              const isIncome  = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              const catColor  = catColorOrFallback(cat?.color, cat?.name ?? "");
              return (
                <button key={`${t.id}-${i}`} onClick={() => setSelectedTx(t)} className="press list-row" style={{ transition: "background 120ms ease-out" }}>
                  <div className="list-row__icon" style={{ background: catColor + "1F", color: catColor }}>
                    <CategoryIcon name={cat?.name} icon={cat?.icon} color={cat?.color} size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </p>
                    <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
                      {cat?.name ?? "Sin categoría"} · {t.date}
                    </p>
                  </div>
                  <span className="mono" style={{ fontSize: 14.5, fontWeight: 700, color: amtColor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </button>
              );
            })}
            {recent.length > 5 && (
              <button onClick={() => setShowAllTx(v => !v)} style={{
                width: "100%", padding: "10px 16px", fontSize: 12, fontWeight: 600,
                color: "var(--accent)", background: "var(--raised)",
                borderTop: "0.5px solid var(--glass-border-dim)", textAlign: "center",
              }}>
                {showAllTx ? "Ver menos ↑" : `Ver ${recent.length - 5} más ↓`}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Metas + Cuotas apiladas (en desktop comparten la columna derecha) */}
      <div className="flex flex-col gap-6">
        <GoalsWidget goals={goals} />
        {/* Cuotas activas — solo desktop, debajo de metas */}
        <CuotasWidget installments={installments} />
      </div>

      {/* Gráfico de líneas mensual */}
      <div className="dash-full enter-up" data-delay="6">
        <SpendingChart data={chartMonths} currencySymbol={sym} spaceStacks={spaceStacksData[selectedCurrency] ?? []} />
      </div>

      {selectedTx && (
        <TransactionSheet
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tx={selectedTx as any}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={() => setSelectedTx(null)}
          onSaved={() => setSelectedTx(null)}
        />
      )}

      {selectedBudget && (
        <BudgetDetailModal
          budget={selectedBudget}
          onClose={() => setSelectedBudget(null)}
          onUpdated={() => router.refresh()}
        />
      )}

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
