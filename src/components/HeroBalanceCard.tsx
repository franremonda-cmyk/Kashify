"use client";
import { useState, useEffect, useRef } from "react";
import type { Balance } from "@/types";

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", MXN: "$", COP: "$",
};

function useCounter(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(target * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
  const amount = current?.amount ?? 0;
  const animated = useCounter(Math.abs(amount));
  const isNeg = amount < 0;
  const symbol = SYMBOLS[selected] ?? selected;

  const formatted = animated.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className="glass-elevated lift p-6 flex flex-col gap-4 enter-up"
      style={{
        background: `linear-gradient(135deg, rgba(0,200,83,0.08) 0%, rgba(255,255,255,0.06) 100%)`,
        backdropFilter: "blur(28px) saturate(200%)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
          Balance total
        </span>
        <div className="flex gap-1 flex-wrap justify-end">
          {balances.map((b) => (
            <button
              key={b.currency_code}
              onClick={() => setSelected(b.currency_code)}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: selected === b.currency_code ? "var(--accent)" : "var(--glass-1)",
                color: selected === b.currency_code ? "#060C09" : "var(--ink-muted)",
                border: selected === b.currency_code
                  ? "none"
                  : "0.5px solid var(--glass-border)",
              }}
            >
              {b.currency_code}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div
          className="display font-bold leading-none"
          style={{
            fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
            color: isNeg ? "var(--negative)" : "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          {isNeg ? "−" : ""}{symbol} {formatted}
        </div>
        {balances.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Mandá tu primer mensaje a Neo para empezar
          </p>
        )}
      </div>

      {/* Emerald glow line at bottom */}
      <div
        className="h-px rounded-full"
        style={{
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
          opacity: 0.4,
        }}
      />
    </div>
  );
}
