"use client";
import { useState, useEffect } from "react";
import InstallmentForm from "@/components/InstallmentForm";
import type { InstallmentFormData } from "@/components/InstallmentForm";
import { BackButton } from "@/components/ui/BackButton";
import type { InstallmentPlan, InstallmentPayment } from "@/types";

type PlanWithPayments = InstallmentPlan & {
  installment_payments?: InstallmentPayment[];
  categories?: { name: string; color: string; icon: string } | null;
};

export default function CuotasPage() {
  const [plans, setPlans] = useState<PlanWithPayments[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanWithPayments | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  function load() {
    fetch("/api/installments").then((r) => r.json()).then(setPlans).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(data: InstallmentFormData) {
    setCreateError(null);
    const res = await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateError(err.error ?? "No se pudo guardar. Revisá los campos.");
    }
  }

  async function handleEdit(data: InstallmentFormData) {
    if (!editingPlan) return;
    await fetch(`/api/installments/${editingPlan.id}`, {
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
    setEditingPlan(null);
    load();
  }

  async function handleCancel(id: string) {
    if (!confirm("¿Cancelar todas las cuotas pendientes? El plan quedará saldado.")) return;
    await fetch(`/api/installments/${id}/cancel`, { method: "POST" });
    load();
  }

  async function handlePay(id: string) {
    await fetch(`/api/installments/${id}/pay`, { method: "POST" });
    window.dispatchEvent(new Event("transaction-added"));
    load();
  }

  const active = plans.filter((p) => p.status === "active");
  const paid = plans.filter((p) => p.status === "paid");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between enter-up">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="display font-semibold" style={{ fontSize: "1.25rem", color: "var(--ink)" }}>Cuotas</h1>
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>Tus compras financiadas y su progreso</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingPlan(null); }}
          style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 12, background: "var(--accent)", color: "#FFFFFF", flexShrink: 0 }}
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

      {editingPlan && (
        <InstallmentForm
          editMode
          initialData={{
            name: editingPlan.name,
            total_amount: editingPlan.total_amount,
            currency_code: editingPlan.currency_code,
            card_name: editingPlan.card_name ?? "",
            n_installments: editingPlan.n_installments,
            interest_type: editingPlan.interest_type as "none" | "french",
            tna: editingPlan.tna ?? null,
            first_payment_date: editingPlan.first_payment_date ?? "",
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditingPlan(null)}
        />
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", paddingLeft: 4 }}>Activas</p>
          {active.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCancel={handleCancel} onPay={handlePay} onEdit={setEditingPlan} />
          ))}
        </section>
      )}

      {paid.length > 0 && (
        <section className="flex flex-col gap-2">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", paddingLeft: 4 }}>Saldadas</p>
          {paid.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCancel={handleCancel} onPay={handlePay} onEdit={setEditingPlan} />
          ))}
        </section>
      )}

      {plans.length === 0 && !showForm && (
        <div className="glass p-8 text-center enter-up" style={{ borderRadius: 20 }}>
          <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Sin compras en cuotas</p>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>Registrá una compra financiada para seguir tus pagos.</p>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onCancel, onPay, onEdit }: {
  plan: PlanWithPayments;
  onCancel: (id: string) => void;
  onPay: (id: string) => void;
  onEdit: (plan: PlanWithPayments) => void;
}) {
  const payments = plan.installment_payments ?? [];
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pct = (paidCount / plan.n_installments) * 100;
  const nextDue = payments
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.payment_number - b.payment_number)[0];
  const isActive = plan.status === "active";

  return (
    <div className="glass p-4 flex flex-col gap-3" style={{ borderRadius: 16 }}>
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{plan.name}</p>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
            {plan.card_name ? `${plan.card_name} · ` : ""}
            {plan.interest_type === "french" ? `TNA ${plan.tna}%` : "Sin interés"}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono, monospace)" }}>
            {plan.currency_code} {Number(plan.installment_amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
            cuota {Math.min(paidCount + 1, plan.n_installments)}/{plan.n_installments}
          </p>
        </div>
      </div>

      <div>
        <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: plan.status === "paid" ? "var(--positive)" : "var(--accent)", transition: "width 300ms ease-out" }} />
        </div>
        {isActive && nextDue && (
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 6 }}>
            Próximo vencimiento: {new Date(nextDue.due_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

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
              onClick={() => onCancel(plan.id)}
              style={{ padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.08)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}
            >
              Saldar
            </button>
          </>
        )}
        <button
          onClick={() => onEdit(plan)}
          style={{ padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
        >
          Editar
        </button>
      </div>
    </div>
  );
}
