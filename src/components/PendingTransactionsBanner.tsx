"use client";
import type { PendingTransaction } from "@/types";

interface Props {
  pending: PendingTransaction[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function PendingTransactionsBanner({ pending, onConfirm, onDismiss }: Props) {
  if (!pending.length) return null;

  return (
    <div
      className="glass p-4 flex flex-col gap-3"
      style={{ border: "1px solid rgba(234, 179, 8, 0.3)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-yellow-400">⚠</span>
        <span className="text-sm font-medium">
          {pending.length} mensaje{pending.length > 1 ? "s" : ""} pendiente{pending.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{p.raw_text}&rdquo;
            </p>
            {p.neo_interpretation && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Neo interpretó: {p.neo_interpretation.description} — {p.neo_interpretation.amount} {p.neo_interpretation.currency_code}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(p.id)}
                className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: "rgba(16, 185, 129, 0.2)", color: "var(--accent-green)" }}
              >
                Confirmar
              </button>
              <button
                onClick={() => onDismiss(p.id)}
                className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
              >
                Descartar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
