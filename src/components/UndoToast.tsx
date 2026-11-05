"use client";
import { useEffect, useRef, useState } from "react";

interface DeletedTx { id: string }

/** Toast global "Movimiento eliminado · Deshacer". Escucha el evento `tx-deleted`
 *  (lo disparan TransactionSheet y el swipe de Actividad) y restaura la MISMA
 *  fila (PATCH restore: le saca el deleted_at). Antes la re-creaba con algunos
 *  campos y se perdían el enlace a la deuda, las notas y la otra punta de un
 *  cambio de moneda. */
export default function UndoToast() {
  const [tx, setTx] = useState<DeletedTx | null>(null);
  const [restoring, setRestoring] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDeleted = (e: Event) => {
      setTx((e as CustomEvent<DeletedTx>).detail);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTx(null), 6000);
    };
    window.addEventListener("tx-deleted", onDeleted);
    return () => {
      window.removeEventListener("tx-deleted", onDeleted);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function undo() {
    if (!tx || restoring) return;
    setRestoring(true);
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    }).catch(() => null);
    setRestoring(false);
    setTx(null);
    if (res?.ok) window.dispatchEvent(new Event("transaction-added"));
  }

  if (!tx) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9500, display: "flex", alignItems: "center", gap: 14,
        padding: "12px 18px", borderRadius: 14, whiteSpace: "nowrap",
        background: "var(--base)", border: "0.5px solid var(--glass-border)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink)" }}>Movimiento eliminado</span>
      <button
        onClick={undo}
        disabled={restoring}
        style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "6px 2px" }}
      >
        {restoring ? "Restaurando…" : "Deshacer"}
      </button>
    </div>
  );
}
