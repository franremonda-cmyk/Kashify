"use client";
import { useState, useRef, useEffect } from "react";
import HeroBalanceCard from "./HeroBalanceCard";
import CategoryIcon from "./CategoryIcon";
import SpendingChart, { type ChartMonth } from "./SpendingChart";
import type { Balance } from "@/types";

interface CurrencyMetrics { currency_code: string; income: number; expense: number; }
interface RecentTx {
  description: string; amount: number; currency_code: string;
  type: string; date: string;
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

function useCounter(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const raf = useRef<number>(0);
  const from = useRef(target);
  useEffect(() => {
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

function MetricCard({ label, value, sym, isIncome }: {
  label: string; value: number; sym: string; isIncome: boolean;
}) {
  const animated = useCounter(value);
  const color  = isIncome ? "var(--positive)" : "var(--negative)";
  const bg     = isIncome ? "rgba(52,199,89,0.07)"  : "rgba(255,59,48,0.06)";
  const border = isIncome ? "0.5px solid rgba(52,199,89,0.18)" : "0.5px solid rgba(255,59,48,0.16)";
  const full   = animated.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  return (
    <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: bg, border, boxShadow: "var(--shadow-sm)" }}>
      <p style={{
        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: 8,
      }}>{label}</p>
      <p className="display" style={{
        fontSize: "clamp(0.85rem, 3.2vw, 1.1rem)",
        fontWeight: 700, color, letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>
        {sym} {full}
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
    <div className="flex flex-col gap-4">
      <HeroBalanceCard
        balances={balances}
        primaryCurrency={primaryCurrency}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={setSelectedCurrency}
      />

      <div className="flex gap-3 enter-up" data-delay="2">
        <MetricCard label="Ingresos" value={m.income}  sym={sym} isIncome={true}  />
        <MetricCard label="Gastos"   value={m.expense} sym={sym} isIncome={false} />
      </div>

      {recent.length > 0 && (
        <section className="flex flex-col gap-3 enter-up" data-delay="3">
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Últimas transacciones
          </p>
          <div style={{
            borderRadius: 16, overflow: "hidden",
            border: "0.5px solid var(--glass-border)",
            background: "var(--base)", boxShadow: "var(--shadow-sm)",
          }}>
            {recent.map((t, i) => {
              const cat = t.categories as { name?: string; icon?: string; color?: string } | null;
              const isIncome  = t.type === "income";
              const isInstall = t.type === "installment-payment";
              const amtColor  = isIncome ? "var(--positive)" : isInstall ? "var(--warning)" : "var(--negative)";
              const catColor  = cat?.color;
              const iconBg    = catColor ? `${catColor}22` : "var(--raised)";
              const iconColor = catColor ?? "var(--ink-muted)";
              return (
                <div key={`${t.description}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i < recent.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: iconBg, color: iconColor,
                  }}>
                    <CategoryIcon name={cat?.name} icon={cat?.icon} color={cat?.color} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
                      {cat?.name ?? "Sin categoría"} · {t.date}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: amtColor,
                    fontVariantNumeric: "tabular-nums", flexShrink: 0,
                    fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
                  }}>
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="enter-up" data-delay="4">
        <SpendingChart data={chartMonths} currencySymbol={sym} />
      </div>
    </div>
  );
}
