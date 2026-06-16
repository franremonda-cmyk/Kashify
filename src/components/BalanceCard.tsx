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
      className="glass p-4 flex flex-col gap-1"
      style={isPrimary ? { border: "1px solid rgba(99, 102, 241, 0.4)" } : {}}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {balance.currency_code}
          {isPrimary && (
            <span
              className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(99, 102, 241, 0.2)", color: "var(--accent)" }}
            >
              principal
            </span>
          )}
        </span>
      </div>
      <span
        className="text-2xl font-bold"
        style={{ color: isNegative ? "var(--accent-red)" : "var(--text-primary)" }}
      >
        {isNegative ? "-" : ""}{symbol} {formatted}
      </span>
    </div>
  );
}
