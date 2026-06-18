"use client";
import { useState, useEffect } from "react";
import type { PendingTransaction } from "@/types";

interface Category { id: string; name: string }

interface Props {
  pending: PendingTransaction[];
}

const TYPE_LABEL: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  conversion: "Conversión",
  "installment-payment": "Cuota",
};

export default function PendingList({ pending: initial }: Props) {
  const [pending, setPending] = useState(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Edición local por id
  const [draft, setDraft] = useState<Record<string, { amount: string; description: string; category_id: string }>>({});

  useEffect(() => {
    fetch("/api/categories").then((r) => (r.ok ? r.json() : [])).then(setCategories).catch(() => {});
  }, []);

  function startEdit(p: PendingTransaction) {
    setDraft((d) => ({
      ...d,
      [p.id]: {
        amount: String(p.neo_interpretation?.amount ?? ""),
        description: p.neo_interpretation?.description ?? p.raw_text,
        category_id: "",
      },
    }));
    setEditing(p.id);
  }

  async function confirm(p: PendingTransaction) {
    if (!p.neo_interpretation) return;
    setBusy(p.id);
    const d = draft[p.id];
    const interp = p.neo_interpretation;

    // Resolver categoría: la elegida manualmente o por nombre sugerido por Neo
    let categoryId: string | null = d?.category_id || null;
    if (!categoryId && interp.category_name) {
      const match = categories.find((c) => c.name.toLowerCase() === interp.category_name!.toLowerCase());
      categoryId = match?.id ?? null;
    }

    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: interp.type,
        amount: d ? parseFloat(d.amount) : interp.amount,
        currency_code: interp.currency_code,
        description: d?.description?.trim() || interp.description,
        category_id: categoryId,
        date: new Date().toISOString().split("T")[0],
      }),
    });

    await fetch(`/api/pending/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });

    window.dispatchEvent(new Event("transaction-added"));
    setPending((list) => list.filter((x) => x.id !== p.id));
    setEditing(null);
    setBusy(null);
  }

  async function dismiss(id: string) {
    setBusy(id);
    await fetch(`/api/pending/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setPending((list) => list.filter((x) => x.id !== id));
    setBusy(null);
  }

  if (pending.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", paddingLeft: 4 }}>
        Pendientes de confirmación — {pending.length}
      </p>
      <div className="flex flex-col gap-2">
        {pending.map((p) => {
          const interp = p.neo_interpretation;
          const isEditing = editing === p.id;
          const d = draft[p.id];
          const isBusy = busy === p.id;
          return (
            <div key={p.id} className="glass p-4 flex flex-col gap-3" style={{ borderRadius: 16 }}>
              <div className="flex items-start justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{p.raw_text}</p>
                  {interp ? (
                    <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3 }}>
                      Neo entendió: {TYPE_LABEL[interp.type] ?? interp.type} · {interp.currency_code} {Number(interp.amount).toLocaleString("es-AR")}
                      {interp.category_name ? ` · ${interp.category_name}` : ""}
                    </p>
                  ) : (
                    <p style={{ fontSize: 11, color: "var(--warning)", marginTop: 3 }}>Neo no pudo interpretarlo — editá los datos</p>
                  )}
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(255,149,0,0.10)", color: "var(--warning)", border: "0.5px solid rgba(255,149,0,0.25)", flexShrink: 0 }}>
                  EN ESPERA
                </span>
              </div>

              {isEditing && (
                <div className="flex flex-col gap-2">
                  <input
                    style={inpSm}
                    placeholder="Descripción"
                    value={d?.description ?? ""}
                    onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...x[p.id], description: e.target.value } }))}
                  />
                  <div className="flex gap-2">
                    <input
                      style={{ ...inpSm, flex: 1 }}
                      type="number"
                      inputMode="decimal"
                      placeholder="Monto"
                      value={d?.amount ?? ""}
                      onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...x[p.id], amount: e.target.value } }))}
                    />
                    <select
                      style={{ ...inpSm, flex: 1 }}
                      value={d?.category_id ?? ""}
                      onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...x[p.id], category_id: e.target.value } }))}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => confirm(p)} disabled={isBusy || (!interp && !d)}
                  style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: isBusy ? 0.5 : 1 }}>
                  {isBusy ? "..." : "Confirmar"}
                </button>
                <button onClick={() => (isEditing ? setEditing(null) : startEdit(p))} disabled={isBusy}
                  style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
                  {isEditing ? "Cerrar" : "Editar"}
                </button>
                <button onClick={() => dismiss(p.id)} disabled={isBusy}
                  style={{ padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.08)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}>
                  Descartar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const inpSm: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 10,
  padding: "9px 12px",
  color: "var(--ink)",
  fontSize: 13,
  width: "100%",
  outline: "none",
};
