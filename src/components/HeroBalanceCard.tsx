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
    <div className="enter-up" data-delay="1" style={{
      borderRadius: 24,
      background: "var(--base)",
      border: "0.5px solid var(--glass-border)",
      boxShadow: "var(--shadow-lg)",
      /* NO overflow:hidden — lets filter:drop-shadow escape */
    }}>
      <div style={{ padding: "18px 20px 0" }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.12em", color: "var(--ink-muted)", marginBottom: 16,
        }}>Balance</p>

        {balances.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", paddingBottom: 18 }}>
            Enviá tu primer mensaje a Neo para empezar
          </p>
        ) : (
          /*
            Shadow fix: scroll container uses overflow-x:auto which creates a
            new formatting context. Extra padding lets the drop-shadow render
            outside the container bounds before the parent clips it.
            The card itself has NO overflow:hidden so filter escapes freely.
          */
          <div style={{
            display: "flex", gap: 8,
            overflowX: "auto", overflowY: "visible",
            scrollbarWidth: "none",
            paddingBottom: 20, paddingTop: 4, marginBottom: -8,
          }}>
            {balances.map((b) => {
              const isActive = selected === b.currency_code;
              return (
                <button key={b.currency_code} onClick={() => setSelected(b.currency_code)}
                  style={{
                    flex: "0 0 auto", minWidth: 60,
                    padding: "9px 14px", borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--accent)" : "var(--raised)",
                    border: isActive ? "none" : "0.5px solid var(--glass-border)",
                    filter: isActive ? "drop-shadow(0 6px 14px rgba(123,97,255,0.45))" : "none",
                    transform: isActive ? "translateY(-2px)" : "translateY(0)",
                    transition: "all 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                    cursor: "pointer", outline: "none",
                  }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    color: isActive ? "#FFFFFF" : "var(--ink-muted)",
                    transition: "color 180ms ease-out",
                  }}>{b.currency_code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {balances.length > 0 && (
        <div style={{ height: "0.5px", background: "var(--glass-border)", margin: "8px 20px 0" }} />
      )}

      {balances.length > 0 && (
        <div style={{ padding: "16px 20px 22px" }}>
          <div className="display" style={{
            fontSize: "clamp(2rem, 9vw, 3rem)",
            fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
            color: isNeg ? "var(--negative)" : "var(--ink)",
            fontVariantNumeric: "tabular-nums", wordBreak: "keep-all",
          }}>
            {isNeg ? "−" : ""}{symbol} {formatted}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>
            {NAMES[selected] ?? selected}
          </p>
        </div>
      )}
    </div>
  );
}
