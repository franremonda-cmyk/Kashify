"use client";
import { useState, useEffect, useCallback } from "react";
import InstallmentForm from "@/components/InstallmentForm";
import type { InstallmentFormData } from "@/components/InstallmentForm";
import { BackButton } from "@/components/ui/BackButton";
import CategoryIcon from "@/components/CategoryIcon";
import { useSpaces } from "@/context/SpaceContext";
import type { InstallmentPlan, InstallmentPayment } from "@/types";

type PlanWithPayments = InstallmentPlan & {
  installment_payments?: InstallmentPayment[];
  categories?: { name: string; color: string; icon: string } | null;
};

export default function CuotasPage() {
  const { activeId } = useSpaces();
  const [plans, setPlans] = useState<PlanWithPayments[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/installments?space=${activeId}`).then((r) => r.json()).then(setPlans).catch(() => {});
  }, [activeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") { setShowForm(true); setEditingId(null); }
  }, []);

  async function handleCreate(data: InstallmentFormData) {
    setCreateError(null);
    const res = await fetch("/api/installments", {
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

  async function handleEdit(id: string, data: InstallmentFormData) {
    await fetch(`/api/installments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        card_name: data.card_name,
        first_payment_date: data.first_payment_date,
        installment_amount: data.total_amount > 0 && data.n_installments > 0
          ? data.total_amount / data.n_installments
          : undefined,
      }),
    });
    setEditingId(null);
    load();
  }

  async function handleCancel(id: string) {
    await fetch(`/api/installments/${id}/cancel`, { method: "POST" });
    load();
  }

  async function handlePay(id: string) {
    await fetch(`/api/installments/${id}/pay`, { method: "POST" });
    window.dispatchEvent(new Event("transaction-added"));
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/installments/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId(null);
    load();
  }

  const active = plans.filter((p) => p.status === "active");
  const paid = plans.filter((p) => p.status === "paid");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between enter-up">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="page-title">Cuotas</h1>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>Tus compras financiadas y su progreso</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          style={{ fontSize: 13, fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 12, background: "var(--accent)", color: "#04130D", flexShrink: 0 }}
        >
          + Nueva
        </button>
      </div>

      {showForm && (
        <>
          {createError && (
            <p style={{ fontSize: 12, color: "var(--negative)", padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,0.08)", border: "0.5px solid rgba(255,59,48,0.25)" }}>
              {createError}
            </p>
          )}
          <InstallmentForm
            onSubmit={handleCreate}
            onCancel={() => { setShowForm(false); setCreateError(null); }}
          />
        </>
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title" style={{ paddingLeft: 4 }}>Activas</h2>
          {active.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onCancel={handleCancel}
              onPay={handlePay}
              onDelete={handleDelete}
              isEditing={editingId === plan.id}
              onEditToggle={() => setEditingId((cur) => (cur === plan.id ? null : plan.id))}
              onSubmitEdit={(data) => handleEdit(plan.id, data)}
            />
          ))}
        </section>
      )}

      {paid.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title" style={{ paddingLeft: 4 }}>Saldadas</h2>
          {paid.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onCancel={handleCancel}
              onPay={handlePay}
              onDelete={handleDelete}
              isEditing={editingId === plan.id}
              onEditToggle={() => setEditingId((cur) => (cur === plan.id ? null : plan.id))}
              onSubmitEdit={(data) => handleEdit(plan.id, data)}
            />
          ))}
        </section>
      )}

      {plans.length === 0 && !showForm && (
        <div className="card-glass p-8 text-center enter-up">
          <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Sin compras en cuotas</p>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>Registrá una compra financiada para seguir tus pagos.</p>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onCancel, onPay, onDelete, isEditing, onEditToggle, onSubmitEdit }: {
  plan: PlanWithPayments;
  onCancel: (id: string) => void;
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onEditToggle: () => void;
  onSubmitEdit: (data: InstallmentFormData) => void;
}) {
  // Confirmación inline de dos toques (reemplaza el window.confirm del navegador).
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!confirmingCancel) return;
    const t = setTimeout(() => setConfirmingCancel(false), 3500);
    return () => clearTimeout(t);
  }, [confirmingCancel]);
  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3500);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  const payments = plan.installment_payments ?? [];
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pct = (paidCount / plan.n_installments) * 100;
  const nextDue = payments
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.payment_number - b.payment_number)[0];
  const isActive = plan.status === "active";

  return (
    <div className="card-glass p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3" style={{ minWidth: 0, flex: 1 }}>
          <div className="list-row__icon" style={{ background: (plan.categories?.color ?? "#46B58C") + "22", border: `1px solid ${plan.categories?.color ?? "#46B58C"}33`, color: plan.categories?.color ?? "#46B58C" }}>
            <CategoryIcon icon={plan.categories?.icon ?? "💳"} name={plan.categories?.name ?? plan.name} color={plan.categories?.color} size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{plan.name}</p>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>
              {plan.card_name ? `${plan.card_name} · ` : ""}
              {plan.interest_type === "french" ? `TNA ${plan.tna}%` : "Sin interés"}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono, monospace)" }}>
            {plan.currency_code} {Number(plan.installment_amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>
            cuota {Math.min(paidCount + 1, plan.n_installments)}/{plan.n_installments}
          </p>
        </div>
      </div>

      <div>
        <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
          <div style={{ width: "100%", transform: `scaleX(${pct / 100})`, transformOrigin: "left", height: "100%", borderRadius: 999, background: plan.status === "paid" ? "var(--positive)" : "var(--accent)", transition: "transform 300ms ease-out" }} />
        </div>
        {isActive && nextDue && (
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6 }}>
            Próximo vencimiento: {new Date(nextDue.due_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {isEditing ? (
        <InstallmentForm
          editMode
          initialData={{
            name: plan.name,
            total_amount: plan.total_amount,
            currency_code: plan.currency_code,
            card_name: plan.card_name ?? "",
            n_installments: plan.n_installments,
            interest_type: plan.interest_type as "none" | "french",
            tna: plan.tna ?? null,
            first_payment_date: plan.first_payment_date ?? "",
          }}
          onSubmit={onSubmitEdit}
          onCancel={onEditToggle}
        />
      ) : (
        <div className="flex gap-2">
          {isActive && (
            <>
              <button
                onClick={() => onPay(plan.id)}
                style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)" }}
              >
                Registrar pago
              </button>
              <button
                onClick={() => {
                  if (!confirmingCancel) { setConfirmingCancel(true); return; }
                  setConfirmingCancel(false);
                  onCancel(plan.id);
                }}
                style={{ padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: confirmingCancel ? 700 : 600, background: confirmingCancel ? "rgba(255,59,48,0.16)" : "rgba(255,59,48,0.08)", color: "var(--negative)", border: confirmingCancel ? "0.5px solid rgba(255,59,48,0.45)" : "0.5px solid rgba(255,59,48,0.18)", transition: "all 150ms ease-out" }}
              >
                {confirmingCancel ? "¿Saldar todo? Tocá de nuevo" : "Saldar"}
              </button>
            </>
          )}
          <button
            onClick={onEditToggle}
            style={{ padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            Editar
          </button>
          <button
            onClick={() => {
              if (!confirmingDelete) { setConfirmingDelete(true); return; }
              setConfirmingDelete(false);
              onDelete(plan.id);
            }}
            style={{ padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: confirmingDelete ? 700 : 600, background: confirmingDelete ? "rgba(255,59,48,0.16)" : "rgba(255,59,48,0.08)", color: "var(--negative)", border: confirmingDelete ? "0.5px solid rgba(255,59,48,0.45)" : "0.5px solid rgba(255,59,48,0.18)", transition: "all 150ms ease-out" }}
          >
            {confirmingDelete ? "¿Eliminar? Tocá de nuevo" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}
