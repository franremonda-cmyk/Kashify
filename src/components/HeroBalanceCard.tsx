"use client";
import { useState, useEffect, useRef } from "react";
import type { Balance } from "@/types";

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/", PYG: "₲",
};

const NAMES: Record<string, string> = {
  ARS: "pesos argentinos", USD: "dólares", EUR: "euros",
  CHF: "francos suizos", BRL: "reales", GBP: "libras",
  UYU: "pesos uruguayos", CLP: "pesos chilenos",
};

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000)       return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function useCounter(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(target * ease);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

interface Props {
  balances: Balance[];
  primaryCurrency: string;
  selectedCurrency?: string;
  onSelectCurrency?: (c: string) => void;
}

export default function HeroBalanceCard({ balances, primaryCurrency, selectedCurrency, onSelectCurrency }: Props) {
  const [internalSelected, setInternalSelected] = useState(primaryCurrency);
  const selected = selectedCurrency ?? internalSelected;
  const setSelected = onSelectCurrency ?? setInternalSelected;

  const current = balances.find((b) => b.currency_code === selected);
  const amount   = current?.amount ?? 0;
  const animated = useCounter(Math.abs(amount));
  const isNeg    = amount < 0;
  const symbol   = SYMBOLS[selected] ?? selected;

  const formatted = animated.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  return (
    <div
      className="enter-up"
      data-delay="1"
      style={{
        borderRadius: 24,
        background: "linear-gradient(160deg, rgba(0,230,118,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        backdropFilter: "blur(40px) saturate(220%)",
        WebkitBackdropFilter: "blur(40px) saturate(220%)",
        border: "0.5px solid rgba(0,230,118,0.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 40px rgba(0,0,0,0.55)",
        /* no overflow:hidden — shadows on currency buttons must breathe */
      }}
    >
      {/* Label */}
      <div style={{ padding: "18px 20px 0" }}>
        <p style={{
          fontSize: 9.5, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.10em", color: "var(--ink-dim)", marginBottom: 14,
        }}>
          Balance
        </p>

        {/* Currency mini-cards */}
        {balances.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-dim)", paddingBottom: 18 }}>
            Enviá tu primer mensaje a Neo para empezar
          </p>
        ) : (
          /* Scroll container — paddingBottom/Top leave room for shadows & elevation */
          <div style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 4,
            paddingBottom: 14,
          }}>
            {balances.map((b) => {
              const isActive = selected === b.currency_code;
              const sym      = SYMBOLS[b.currency_code] ?? b.currency_code;
              const isNegB   = b.amount < 0;
              return (
                <button
                  key={b.currency_code}
                  onClick={() => setSelected(b.currency_code)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 84,
                    padding: "10px 14px 11px",
                    borderRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    alignItems: "flex-start",
                    background: isActive
                      ? "linear-gradient(145deg, rgba(0,230,118,0.20) 0%, rgba(0,230,118,0.09) 100%)"
                      : "rgba(255,255,255,0.06)",
                    border: isActive
                      ? "0.5px solid rgba(0,230,118,0.42)"
                      : "0.5px solid rgba(255,255,255,0.10)",
                    boxShadow: isActive
                      ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 4px 18px rgba(0,230,118,0.22)"
                      : "inset 0 1px 0 rgba(255,255,255,0.06)",
                    transform: isActive ? "translateY(-3px)" : "translateY(0)",
                    transition: "all 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--accent)" : "var(--ink-dim)",
                    transition: "color 200ms ease-out",
                  }}>
                    {b.currency_code}
                  </span>
                  <span
                    className="display"
                    style={{
                      fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em",
                      color: isActive ? (isNegB ? "var(--negative)" : "var(--ink)") : "var(--ink-dim)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                      transition: "color 200ms ease-out",
                    }}
                  >
                    {isNegB ? "−" : ""}{sym}{compact(Math.abs(b.amount))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Separator */}
      {balances.length > 0 && (
        <div style={{
          height: "0.5px",
          background: "linear-gradient(90deg, transparent, rgba(0,230,118,0.14), transparent)",
          margin: "0 20px",
        }} />
      )}

      {/* Big number */}
      {balances.length > 0 && (
        <div style={{ padding: "14px 20px 20px" }}>
          <div
            className="display"
            style={{
              fontSize: "clamp(2.2rem, 9vw, 3.2rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: isNeg ? "var(--negative)" : "var(--ink)",
              fontVariantNumeric: "tabular-nums",
              textShadow: isNeg ? "none" : "0 0 80px rgba(0,230,118,0.18)",
              wordBreak: "keep-all",
            }}
          >
            {isNeg ? "−" : ""}{symbol} {formatted}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6, letterSpacing: "0.01em" }}>
            {NAMES[selected] ?? selected}
          </p>
        </div>
      )}
    </div>
  );
}
