"use client";
import { useState, useEffect, useCallback } from "react";
import DebtForm from "@/components/DebtForm";
import type { DebtFormData } from "@/components/DebtForm";
import { BackButton } from "@/components/ui/BackButton";
import { useSpaces } from "@/context/SpaceContext";
import type { Debt, DebtDirection } from "@/types";

export default function DeudasPage() {
  const { activeId } = useSpaces();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/debts?space=${activeId}`).then((r) => r.json()).then(setDebts).catch(() => {});
  }, [activeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") { setShowForm(true); setEditingId(null); }
  }, []);

  async function handleCreate(data: DebtFormData) {
    setCreateError(null);
    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, space_id: activeId }),
    });
    if (res.ok) {
      setShowForm(false);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateError(err.error ?? "No se pudo guardar. Revisá los campos.");
    }
  }

  async function handleEdit(id: string, data: DebtFormData) {
    await fetch(`/api/debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterparty: data.counterparty,
        description: data.description || null,
        total_amount: data.total_amount,
        currency_code: data.currency_code,
        due_date: data.due_date || null,
      }),
    });
    setEditingId(null);
    load();
  }

  async function handlePay(id: string, amount: number) {
    const res = await fetch(`/api/debts/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      load();
    }
    return res.ok;
  }

  async function handleDelete(id: string) {
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId(null);
    load();
  }

  const groups: { key: DebtDirection; title: string }[] = [
    { key: "debo", title: "Debo" },
    { key: "me_deben", title: "Me deben" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between enter-up">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="page-title">Deudas</h1>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-dim)", marginTop: 2 }}>Lo que debés y lo que te deben</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          style={{ fontSize: "var(--text-xs)", fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 12, background: "var(--accent)", color: "var(--on-accent)", flexShrink: 0 }}
        >
          + Nueva
        </button>
      </div>

      {showForm && (
        <>
          {createError && (
            <p style={{ fontSize: "var(--text-2xs)", color: "var(--negative)", padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,0.08)", border: "0.5px solid rgba(255,59,48,0.25)" }}>
              {createError}
            </p>
          )}
          <DebtForm
            onSubmit={handleCreate}
            onCancel={() => { setShowForm(false); setCreateError(null); }}
          />
        </>
      )}

      {groups.map(({ key, title }) => {
        const items = debts.filter((d) => d.direction === key);
        const active = items.filter((d) => d.status === "active");
        const paid = items.filter((d) => d.status === "paid");
        if (items.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="section-title" style={{ paddingLeft: 4 }}>{title}</h2>
            {active.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onPay={handlePay}
                onDelete={handleDelete}
                isEditing={editingId === debt.id}
                onEditToggle={() => setEditingId((cur) => (cur === debt.id ? null : debt.id))}
                onSubmitEdit={(data) => handleEdit(debt.id, data)}
              />
            ))}
            {paid.length > 0 && (
              <>
                <h3 style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--ink-dim)", paddingLeft: 4, marginTop: 8 }}>Saldadas</h3>
                {paid.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onPay={handlePay}
                    onDelete={handleDelete}
                    isEditing={editingId === debt.id}
                    onEditToggle={() => setEditingId((cur) => (cur === debt.id ? null : debt.id))}
                    onSubmitEdit={(data) => handleEdit(debt.id, data)}
                  />
                ))}
              </>
            )}
          </section>
        );
      })}

      {debts.length === 0 && !showForm && (
        <div className="card-glass p-8 text-center enter-up">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink)", fontWeight: 500 }}>Sin deudas registradas</p>
          <p style={{ fontSize: "var(--text-2xs)", color: "var(--ink-dim)", marginTop: 4 }}>Registrá lo que debés o lo que te deben para hacerle seguimiento.</p>
        </div>
      )}
    </div>
  );
}

function DebtCard({ debt, onPay, onDelete, isEditing, onEditToggle, onSubmitEdit }: {
  debt: Debt;
  onPay: (id: string, amount: number) => Promise<boolean>;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onEditToggle: () => void;
  onSubmitEdit: (data: DebtFormData) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3500);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
  const pct = (Number(debt.paid_amount) / Number(debt.total_amount)) * 100;
  const isActive = debt.status === "active";

  function openPay() {
    setPayError(null);
    setPayAmount(remaining.toFixed(2));
    setPayOpen(true);
  }

  async function submitPay() {
    const amount = parseFloat(payAmount);
    if (!(amount > 0) || amount > remaining + 0.005) {
      setPayError("Monto inválido");
      return;
    }
    const ok = await onPay(debt.id, amount);
    if (ok) setPayOpen(false);
    else setPayError("No se pudo registrar el pago");
  }

  return (
    <div className="card-glass p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3" style={{ minWidth: 0, flex: 1 }}>
          <div className="list-row__icon" style={{ background: "#ef444422", border: "1px solid #ef444433", color: "#ef4444" }}>
            <span style={{ fontSize: 18 }}>{debt.direction === "debo" ? "📤" : "📥"}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)" }}>{debt.counterparty}</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-dim)", marginTop: 2 }}>
              {debt.description || (debt.direction === "debo" ? "Le debés" : "Te debe")}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono, monospace)" }}>
            {debt.currency_code} {remaining.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-dim)", marginTop: 2 }}>
            de {debt.currency_code} {Number(debt.total_amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div>
        <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
          <div style={{ width: "100%", transform: `scaleX(${pct / 100})`, transformOrigin: "left", height: "100%", borderRadius: 999, background: debt.status === "paid" ? "var(--positive)" : "var(--accent)", transition: "transform 300ms ease-out" }} />
        </div>
        {isActive && debt.due_date && (
          <p style={{ fontSize: "var(--text-2xs)", color: "var(--ink-dim)", marginTop: 6 }}>
            Vence: {new Date(debt.due_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {isEditing ? (
        <DebtForm
          editMode
          initialData={{
            direction: debt.direction,
            counterparty: debt.counterparty,
            description: debt.description ?? "",
            total_amount: debt.total_amount,
            currency_code: debt.currency_code,
            due_date: debt.due_date ?? "",
          }}
          onSubmit={onSubmitEdit}
          onCancel={onEditToggle}
        />
      ) : payOpen ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number" inputMode="decimal" autoFocus
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              style={{ flex: 1, background: "var(--raised)", border: "0.5px solid var(--glass-border)", borderRadius: 10, padding: "9px 12px", color: "var(--ink)", fontSize: "var(--text-sm)", outline: "none" }}
            />
          </div>
          {payError && <p style={{ fontSize: "var(--text-2xs)", color: "var(--negative)" }}>{payError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setPayOpen(false)} style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
              Cancelar
            </button>
            <button onClick={submitPay} style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)" }}>
              Confirmar pago
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {isActive && (
            <button
              onClick={openPay}
              style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)" }}
            >
              Registrar pago
            </button>
          )}
          <button
            onClick={onEditToggle}
            style={{ padding: "9px 12px", borderRadius: 10, fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            Editar
          </button>
          <button
            onClick={() => {
              if (!confirmingDelete) { setConfirmingDelete(true); return; }
              setConfirmingDelete(false);
              onDelete(debt.id);
            }}
            style={{ padding: "9px 12px", borderRadius: 10, fontSize: "var(--text-2xs)", fontWeight: confirmingDelete ? 700 : 600, background: confirmingDelete ? "rgba(255,59,48,0.16)" : "rgba(255,59,48,0.08)", color: "var(--negative)", border: confirmingDelete ? "0.5px solid rgba(255,59,48,0.45)" : "0.5px solid rgba(255,59,48,0.18)", transition: "all 150ms ease-out" }}
          >
            {confirmingDelete ? "¿Eliminar? Tocá de nuevo" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}
