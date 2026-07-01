"use client";
import { useState, useEffect, useRef } from "react";
import type { BalanceView } from "@/types";

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

interface Props {
  balances: BalanceView[];
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
    <div className="enter-up hero-balance sheen" data-delay="1" data-tour="balance" style={{
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ padding: "18px 20px 0", position: "relative" }}>
        <p style={{
          fontSize: 12.5, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.16em", color: "var(--hero-ink-soft)", margin: 0, opacity: 0.85,
        }}>Balance</p>

        {balances.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--hero-ink-soft)", padding: "12px 0 20px" }}>
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
                  className="press"
                  style={{
                    flex: "0 0 auto", minWidth: 58, minHeight: 40,
                    padding: "8px 16px", borderRadius: 999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--hero-pill-bg-active)" : "var(--hero-pill-bg)",
                    border: isActive ? "none" : "1px solid rgba(255,255,255,0.16)",
                    transition: "all 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer", outline: "none",
                  }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: "0.04em",
                    color: isActive ? "var(--hero-pill-fg-active)" : "var(--hero-pill-fg)",
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
            color: isNeg ? "var(--negative)" : "var(--hero-ink)",
            fontVariantNumeric: "tabular-nums", wordBreak: "keep-all",
          }}>
            {isNeg ? "−" : ""}{symbol} {formatted}
          </div>
          <p style={{ fontSize: 13, color: "var(--hero-ink-soft)", marginTop: 8, fontWeight: 500 }}>
            {NAMES[selected] ?? selected}
          </p>
        </div>
      )}
    </div>
  );
}
