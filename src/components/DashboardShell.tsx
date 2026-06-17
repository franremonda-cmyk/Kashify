"use client";
import { useState, useRef, useEffect } from "react";
import HeroBalanceCard from "./HeroBalanceCard";
import SpendingChart, { type ChartMonth } from "./SpendingChart";
import type { Balance } from "@/types";

interface CurrencyMetrics { currency_code: string; income: number; expense: number; }
interface RecentTx {
  description: string;
  amount: number;
  currency_code: string;
  type: string;
  date: string;
  categories?: { name?: string; icon?: string } | null;
}

interface Props {
  balances: Balance[];
  primaryCurrency: string;
  metrics: CurrencyMetrics[];
  chartData: Record<string, ChartMonth[]>;
  recent: RecentTx[];
}

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/",
};

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000)       return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

// Metric card with animated number on value change
function MetricCard({ label, value, sym, color, bg, border }: {
  label: string; value: number; sym: string;
  color: string; bg: string; border: string;
}) {
  const [display, setDisplay] = useState(value);
  const [animKey, setAnimKey] = useState(0);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setDisplay(value);
      setAnimKey((k) => k + 1);
    }
  }, [value]);

  return (
    <div className="glass flex-1" style={{ padding: "14px 16px", borderRadius: 14, background: bg, border }}>
      <p style={{
        fontSize: 9, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--ink-dim)", marginBottom: 6,
      }}>
        {label}
      </p>
      <p
        key={animKey}
        className="display metric-pop"
        style={{
          fontSize: "clamp(1.05rem, 4vw, 1.3rem)",
          fontWeight: 700,
          color,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {sym} {compact(display)}
      </p>
    </div>
  );
}

export default function DashboardShell({ balances, primaryCurrency, metrics, chartData, recent }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState(primaryCurrency);

  const m = metrics.find((x) => x.currency_code === selectedCurrency)
    ?? { currency_code: selectedCurrency, income: 0, expense: 0 };
  const sym = SYMBOLS[selectedCurrency] ?? selectedCurrency;
  const chartMonths = chartData[selectedCurrency] ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Balance card */}
      <HeroBalanceCard
        balances={balances}
        primaryCurrency={primaryCurrency}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={setSelectedCurrency}
      />

      {/* Ingresos / Gastos — animated on currency switch */}
      <div className="flex gap-2 enter-up" data-delay="2">
        <MetricCard
          label="Ingresos"
          value={m.income}
          sym={sym}
          color="var(--positive)"
          bg="rgba(48,209,88,0.06)"
          border="0.5px solid rgba(48,209,88,0.18)"
        />
        <MetricCard
          label="Gastos"
          value={m.expense}
          sym={sym}
          color="var(--negative)"
          bg="rgba(255,69,58,0.06)"
          border="0.5px solid rgba(255,69,58,0.18)"
        />
      </div>

      {/* Recent transactions */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3 enter-up" data-delay="3">
          <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            Últimas transacciones
          </p>
          <div className="glass flex flex-col">
            {recent.map((t, i) => {
              const cat = t.categories as { name?: string; icon?: string } | null;
              const isIncome = t.type === "income";
              return (
                <div
                  key={`${t.description}-${i}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < recent.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isIncome ? "rgba(48,209,88,0.10)" : "rgba(255,255,255,0.06)", fontSize: 14 }}
                  >
                    {cat?.icon ? (
                      <span>{cat.icon}</span>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: isIncome ? "var(--positive)" : "var(--ink-dim)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                      {t.description}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--ink-dim)" }}>
                      {cat?.name ?? "Sin categoría"} · {t.date}
                    </p>
                  </div>
                  <span
                    className="display font-semibold text-sm flex-shrink-0"
                    style={{ color: isIncome ? "var(--positive)" : "var(--negative)" }}
                  >
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Spending chart — at the bottom, synced with selected currency */}
      <div className="enter-up" data-delay="4">
        <SpendingChart data={chartMonths} currencySymbol={sym} />
      </div>
    </div>
  );
}
