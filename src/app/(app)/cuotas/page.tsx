"use client";
import { useState, useEffect } from "react";
import InstallmentForm from "@/components/InstallmentForm";
import type { InstallmentPlan } from "@/types";

export default function CuotasPage() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/installments").then((r) => r.json()).then(setPlans);
  }, []);

  async function handleSubmit(data: Parameters<typeof InstallmentForm>[0]["onSubmit"] extends (d: infer D) => unknown ? D : never) {
    await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetch("/api/installments").then((r) => r.json()).then(setPlans);
  }

  async function handleCancel(id: string) {
    if (!confirm("¿Cancelar todas las cuotas pendientes?")) return;
    await fetch(`/api/installments/${id}/cancel`, { method: "POST" });
    fetch("/api/installments").then((r) => r.json()).then(setPlans);
  }

  const active = plans.filter((p) => p.status === "active");
  const paid = plans.filter((p) => p.status === "paid");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cuotas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm px-3 py-2 rounded-xl font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          + Nueva
        </button>
      </div>

      {showForm && (
        <InstallmentForm
          onSubmit={handleSubmit as Parameters<typeof InstallmentForm>[0]["onSubmit"]}
          onCancel={() => setShowForm(false)}
        />
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>ACTIVAS</h2>
          {active.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCancel={handleCancel} />
          ))}
        </section>
      )}

      {paid.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>SALDADAS</h2>
          {paid.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCancel={handleCancel} />
          ))}
        </section>
      )}

      {plans.length === 0 && !showForm && (
        <div className="glass p-6 text-center">
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            No tenés compras en cuotas registradas
          </p>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onCancel }: { plan: InstallmentPlan; onCancel: (id: string) => void }) {
  const paidCount = (plan as InstallmentPlan & { installment_payments?: { status: string }[] })
    .installment_payments?.filter((p) => p.status === "paid").length ?? 0;
  const pct = (paidCount / plan.n_installments) * 100;

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{plan.name}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {plan.card_name ? `${plan.card_name} · ` : ""}
            {plan.interest_type === "french" ? `TNA ${plan.tna}%` : "Sin interés"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">
            {plan.currency_code} {Number(plan.installment_amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            cuota {paidCount + 1}/{plan.n_installments}
          </p>
        </div>
      </div>

      <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: plan.status === "paid" ? "var(--accent-green)" : "var(--accent)" }}
        />
      </div>

      {plan.status === "active" && (
        <button
          onClick={() => onCancel(plan.id)}
          className="text-xs py-1.5 rounded-lg"
          style={{ background: "rgba(239,68,68,0.1)", color: "var(--accent-red)" }}
        >
          Cancelar deuda anticipada
        </button>
      )}
    </div>
  );
}
