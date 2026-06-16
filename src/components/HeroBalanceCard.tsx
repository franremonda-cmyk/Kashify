"use client";
import { useState, useEffect, useRef } from "react";
import type { Balance } from "@/types";

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/", PYG: "₲",
};

const NAMES: Record<string, string> = {
  ARS: "pesos argentinos", USD: "dólares estadounidenses", EUR: "euros",
  CHF: "francos suizos", BRL: "reales", GBP: "libras esterlinas",
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
    const from = 0;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * ease);
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
}

export default function HeroBalanceCard({ balances, primaryCurrency }: Props) {
  const [selected, setSelected] = useState(primaryCurrency);

  const current = balances.find((b) => b.currency_code === selected);
  const amount  = current?.amount ?? 0;
  const animated = useCounter(Math.abs(amount));
  const isNeg  = amount < 0;
  const symbol = SYMBOLS[selected] ?? selected;

  const formatted = Math.abs(amount) >= 10_000
    ? animated.toLocaleString("es-AR", { maximumFractionDigits: 0 })
    : animated.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="enter-up"
      style={{
        borderRadius: 24,
        background: "linear-gradient(160deg, rgba(0,200,83,0.08) 0%, rgba(255,255,255,0.04) 100%)",
        backdropFilter: "blur(36px) saturate(230%)",
        WebkitBackdropFilter: "blur(36px) saturate(230%)",
        border: "0.5px solid rgba(0,200,83,0.18)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 40px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
      data-delay="1"
    >
      {/* ── Label ── */}
      <div style={{ padding: "20px 20px 14px" }}>
        <p style={{
          fontSize: 9.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: "var(--ink-dim)",
          marginBottom: 14,
        }}>
          Balance
        </p>

        {/* ── Currency mini-cards row ── */}
        {balances.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>
            Enviá tu primer mensaje a Neo para empezar
          </p>
        ) : (
          <div style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
            marginLeft: -4,
            paddingLeft: 4,
            paddingBottom: 2,
          }}>
            {balances.map((b) => {
              const isActive = selected === b.currency_code;
              const sym = SYMBOLS[b.currency_code] ?? b.currency_code;
              const isNegB = b.amount < 0;

              return (
                <button
                  key={b.currency_code}
                  onClick={() => setSelected(b.currency_code)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 80,
                    padding: "10px 14px 11px",
                    borderRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    alignItems: "flex-start",
                    background: isActive
                      ? "linear-gradient(145deg, rgba(0,200,83,0.18) 0%, rgba(0,200,83,0.08) 100%)"
                      : "rgba(255,255,255,0.045)",
                    border: isActive
                      ? "0.5px solid rgba(0,200,83,0.38)"
                      : "0.5px solid rgba(255,255,255,0.08)",
                    boxShadow: isActive
                      ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 16px rgba(0,200,83,0.18)"
                      : "inset 0 1px 0 rgba(255,255,255,0.06)",
                    transform: isActive ? "translateY(-2px)" : "translateY(0)",
                    transition: "all 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer",
                  }}
                >
                  {/* Currency code */}
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--accent)" : "var(--ink-dim)",
                    transition: "color 200ms ease-out",
                  }}>
                    {b.currency_code}
                  </span>

                  {/* Amount compact */}
                  <span
                    className="display"
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: isActive
                        ? (isNegB ? "var(--negative)" : "var(--ink)")
                        : "var(--ink-dim)",
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

      {/* ── Separator ── */}
      {balances.length > 0 && (
        <div style={{
          height: "0.5px",
          background: "linear-gradient(90deg, transparent, rgba(0,200,83,0.15), transparent)",
          margin: "0 20px",
        }} />
      )}

      {/* ── Big number for selected currency ── */}
      {balances.length > 0 && (
        <div style={{ padding: "16px 20px 20px" }}>
          <div
            className="display"
            style={{
              fontSize: "clamp(2.4rem, 10vw, 3.4rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: isNeg ? "var(--negative)" : "var(--ink)",
              fontVariantNumeric: "tabular-nums",
              textShadow: isNeg ? "none" : "0 0 80px rgba(0,200,83,0.20)",
            }}
          >
            {isNeg ? "−" : ""}{symbol} {formatted}
          </div>
          <p style={{
            fontSize: 11,
            color: "var(--ink-dim)",
            marginTop: 6,
            letterSpacing: "0.01em",
          }}>
            {NAMES[selected] ?? selected}
          </p>
        </div>
      )}
    </div>
  );
}
