"use client";
import { useState, useEffect, useRef } from "react";
import type { Balance } from "@/types";

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/", PYG: "₲",
};

const NAMES: Record<string, string> = {
  ARS: "pesos argentinos", USD: "dólares", EUR: "euros", CHF: "francos suizos",
  BRL: "reales", GBP: "libras", UYU: "pesos uruguayos", CLP: "pesos chilenos",
};

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function useCounter(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const prevTarget = useRef(target);

  useEffect(() => {
    startRef.current = null;
    const from = prevTarget.current === target ? 0 : value;
    const to = target;
    prevTarget.current = target;

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}

interface Props {
  balances: Balance[];
  primaryCurrency: string;
}

export default function HeroBalanceCard({ balances, primaryCurrency }: Props) {
  const [selected, setSelected] = useState(primaryCurrency);
  const current = balances.find((b) => b.currency_code === selected);
  const amount = current?.amount ?? 0;
  const animated = useCounter(Math.abs(amount));
  const isNeg = amount < 0;
  const symbol = SYMBOLS[selected] ?? selected;

  const formatted = Math.abs(amount) >= 10_000
    ? animated.toLocaleString("es-AR", { maximumFractionDigits: 0 })
    : animated.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="enter-up"
      style={{
        borderRadius: 24,
        background: "linear-gradient(145deg, rgba(0,200,83,0.09) 0%, rgba(255,255,255,0.055) 100%)",
        backdropFilter: "blur(36px) saturate(230%)",
        WebkitBackdropFilter: "blur(36px) saturate(230%)",
        border: "0.5px solid rgba(0,200,83,0.20)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 40px rgba(0,0,0,0.60)",
        overflow: "hidden",
      }}
      data-delay="1"
    >
      {/* Top section: label + amount */}
      <div style={{ padding: "22px 20px 18px" }}>
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: "var(--ink-dim)",
          marginBottom: 10,
        }}>
          Balance
        </p>

        <div
          className="display"
          style={{
            fontSize: "clamp(2.4rem, 10vw, 3.5rem)",
            fontWeight: 700,
            color: isNeg ? "var(--negative)" : "var(--ink)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            textShadow: isNeg ? "none" : "0 0 80px rgba(0,200,83,0.22)",
          }}
        >
          {isNeg ? "−" : ""}{symbol} {formatted}
        </div>

        <p style={{ marginTop: 6, fontSize: 11, color: "var(--ink-dim)" }}>
          {NAMES[selected] ?? selected}
        </p>
      </div>

      {/* Currency tab strip */}
      <div style={{
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.15)",
        padding: "10px 12px",
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
      }}>
        {balances.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--ink-dim)", padding: "4px 8px" }}>
            Sin saldos — enviá tu primer mensaje a Neo
          </p>
        ) : (
          balances.map((b) => {
            const isActive = selected === b.currency_code;
            return (
              <button
                key={b.currency_code}
                onClick={() => setSelected(b.currency_code)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px 5px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  background: isActive ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.05)",
                  color: isActive ? "var(--accent)" : "var(--ink-dim)",
                  border: isActive ? "0.5px solid rgba(0,200,83,0.30)" : "0.5px solid rgba(255,255,255,0.08)",
                  transition: "all 160ms ease-out",
                }}
              >
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isActive ? "var(--accent)" : "rgba(255,255,255,0.20)",
                  boxShadow: isActive ? "0 0 6px var(--accent-glow)" : "none",
                  flexShrink: 0,
                  transition: "all 200ms ease-out",
                }} />
                {b.currency_code}
                <span style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  opacity: 0.6,
                }}>
                  {compact(b.amount)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
