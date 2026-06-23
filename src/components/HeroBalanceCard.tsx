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

function useCounter(target: number, duration = 700) {
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

interface Props {
  balances: Balance[];
  primaryCurrency: string;
  selectedCurrency?: string;
  onSelectCurrency?: (c: string) => void;
}

export default function HeroBalanceCard({ balances, primaryCurrency, selectedCurrency, onSelectCurrency }: Props) {
  const [internalSelected, setInternalSelected] = useState(primaryCurrency);
  const selected    = selectedCurrency ?? internalSelected;
  const setSelected = onSelectCurrency ?? setInternalSelected;

  const current   = balances.find((b) => b.currency_code === selected);
  const amount    = current?.amount ?? 0;
  const animated  = useCounter(Math.abs(amount));
  const isNeg     = amount < 0;
  const symbol    = SYMBOLS[selected] ?? selected;
  const formatted = animated.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  return (
    <div className="enter-up glass-elevated" data-delay="1" style={{
      borderRadius: 26,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Emerald aurora glow behind the number */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 60% at 18% 120%, var(--accent-glow) 0%, transparent 60%)",
      }} />

      <div style={{ padding: "18px 20px 0", position: "relative" }}>
        <p style={{
          fontSize: 12.5, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.16em", color: "var(--ink-dim)", margin: 0,
        }}>Balance</p>

        {balances.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-muted)", padding: "12px 0 20px" }}>
            Enviá tu primer mensaje a Neo para empezar
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16 }}>
            {balances.map((b) => {
              const isActive = selected === b.currency_code;
              return (
                <button key={b.currency_code} onClick={() => setSelected(b.currency_code)}
                  aria-pressed={isActive}
                  aria-label={`Mostrar balance en ${NAMES[b.currency_code] ?? b.currency_code}`}
                  style={{
                    flex: "0 0 auto", minWidth: 58, minHeight: 40,
                    padding: "8px 16px", borderRadius: 999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--accent)" : "rgba(255,255,255,0.06)",
                    border: isActive ? "none" : "1px solid var(--glass-border)",
                    boxShadow: isActive ? "0 0 16px var(--shadow-accent)" : "none",
                    transition: "all 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer", outline: "none",
                  }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: "0.04em",
                    color: isActive ? "#04130D" : "var(--ink-muted)",
                  }}>{b.currency_code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {balances.length > 0 && (
        <div style={{ padding: "14px 20px 24px", position: "relative" }}>
          <div className="display mono" style={{
            fontSize: "clamp(2.4rem, 11vw, 3.4rem)",
            fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
            color: isNeg ? "var(--negative)" : "var(--ink)",
            fontVariantNumeric: "tabular-nums", wordBreak: "keep-all",
            textShadow: isNeg ? "none" : "0 0 30px var(--accent-glow)",
          }}>
            {isNeg ? "−" : ""}<span style={{ color: "var(--accent)" }}>{symbol}</span> {formatted}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, fontWeight: 500 }}>
            {NAMES[selected] ?? selected}
          </p>
        </div>
      )}
    </div>
  );
}
