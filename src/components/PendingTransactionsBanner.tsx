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
      style={{ border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--warning)" }}>⚠</span>
        <span className="text-sm font-medium">
          {pending.length} mensaje{pending.length > 1 ? "s" : ""} pendiente{pending.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: "var(--raised)" }}
          >
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              &ldquo;{p.raw_text}&rdquo;
            </p>
            {p.neo_interpretation && (
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Neo interpretó: {p.neo_interpretation.description} — {p.neo_interpretation.amount} {p.neo_interpretation.currency_code}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(p.id)}
                className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: "color-mix(in srgb, var(--positive) 18%, transparent)", color: "var(--positive)" }}
              >
                Confirmar
              </button>
              <button
                onClick={() => onDismiss(p.id)}
                className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--raised)", color: "var(--ink-muted)" }}
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
