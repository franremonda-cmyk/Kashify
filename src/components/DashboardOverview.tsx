"use client";
import { useState } from "react";
import HeroBalanceCard from "./HeroBalanceCard";
import SpendingChart, { type ChartMonth } from "./SpendingChart";
import type { Balance } from "@/types";

interface CurrencyMetrics { currency_code: string; income: number; expense: number; }

interface Props {
  balances: Balance[];
  primaryCurrency: string;
  metrics: CurrencyMetrics[];
  chartData: Record<string, ChartMonth[]>;
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

export default function DashboardOverview({ balances, primaryCurrency, metrics, chartData }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState(primaryCurrency);

  const m = metrics.find((x) => x.currency_code === selectedCurrency)
    ?? { currency_code: selectedCurrency, income: 0, expense: 0 };

  const sym = SYMBOLS[selectedCurrency] ?? selectedCurrency;
  const chartMonths = chartData[selectedCurrency] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <HeroBalanceCard
        balances={balances}
        primaryCurrency={primaryCurrency}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={setSelectedCurrency}
      />

      {/* 2-metric strip — synced to selected currency */}
      <div className="flex gap-2 enter-up" data-delay="2">
        {/* Ingresos */}
        <div
          className="glass flex-1"
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(48,209,88,0.06)",
            border: "0.5px solid rgba(48,209,88,0.18)",
          }}
        >
          <p style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-dim)",
            marginBottom: 6,
          }}>
            Ingresos
          </p>
          <p
            className="display"
            style={{
              fontSize: "clamp(1.05rem, 3.5vw, 1.3rem)",
              fontWeight: 700,
              color: "var(--positive)",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {sym} {compact(m.income)}
          </p>
        </div>

        {/* Gastos */}
        <div
          className="glass flex-1"
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(255,69,58,0.06)",
            border: "0.5px solid rgba(255,69,58,0.18)",
          }}
        >
          <p style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-dim)",
            marginBottom: 6,
          }}>
            Gastos
          </p>
          <p
            className="display"
            style={{
              fontSize: "clamp(1.05rem, 3.5vw, 1.3rem)",
              fontWeight: 700,
              color: "var(--negative)",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {sym} {compact(m.expense)}
          </p>
        </div>
      </div>

      {/* Chart — synced to selected currency */}
      <div className="enter-up" data-delay="3">
        <SpendingChart data={chartMonths} currencySymbol={sym} />
      </div>
    </div>
  );
}
