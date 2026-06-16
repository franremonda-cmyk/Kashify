"use client";
import type { Balance } from "@/types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "CLP$", MXN: "MX$", COP: "COL$",
};

interface Props {
  balance: Balance;
  isPrimary?: boolean;
}

export default function BalanceCard({ balance, isPrimary }: Props) {
  const symbol = CURRENCY_SYMBOLS[balance.currency_code] ?? balance.currency_code;
  const formatted = Math.abs(balance.amount).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const isNegative = balance.amount < 0;

  return (
    <div
      className="glass p-4 flex flex-col gap-2"
      style={isPrimary ? { borderColor: "var(--accent)" } : {}}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
          {balance.currency_code}
        </span>
        {isPrimary && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: "oklch(0.71 0.16 35 / 0.15)",
              color: "var(--accent)",
            }}
          >
            principal
          </span>
        )}
      </div>
      <span
        className="num text-2xl font-medium leading-none"
        style={{ color: isNegative ? "var(--accent-red)" : "var(--ink)" }}
      >
        {isNegative ? "−" : ""}{symbol} {formatted}
      </span>
    </div>
  );
}
