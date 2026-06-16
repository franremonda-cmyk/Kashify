"use client";
import { useState, useEffect } from "react";
import {
  calculateFrenchInstallment,
  calculateNoInterest,
  calculateImpliedTNA,
} from "@/lib/installments/calculator";

interface Props {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  initialData?: { name?: string; total_amount?: number };
}

interface FormData {
  name: string;
  total_amount: number;
  currency_code: string;
  category_id: string;
  card_name: string;
  n_installments: number;
  interest_type: "none" | "french";
  tna: number | null;
  known_installment: number | null;
  first_payment_date: string;
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36];

export default function InstallmentForm({ onSubmit, onCancel, initialData }: Props) {
  const [form, setForm] = useState<FormData>({
    name: initialData?.name ?? "",
    total_amount: initialData?.total_amount ?? 0,
    currency_code: "ARS",
    category_id: "",
    card_name: "",
    n_installments: 12,
    interest_type: "none",
    tna: null,
    known_installment: null,
    first_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0],
  });

  const [calc, setCalc] = useState({ installment_amount: 0, total_to_pay: 0, financing_cost: 0 });

  useEffect(() => {
    if (!form.total_amount || !form.n_installments) return;

    if (form.known_installment && form.known_installment > 0) {
      const implied_tna = calculateImpliedTNA(form.total_amount, form.known_installment, form.n_installments);
      setCalc({
        installment_amount: form.known_installment,
        total_to_pay: form.known_installment * form.n_installments,
        financing_cost: form.known_installment * form.n_installments - form.total_amount,
      });
      setForm((f) => ({ ...f, tna: implied_tna }));
      return;
    }

    const result = form.interest_type === "french" && form.tna
      ? calculateFrenchInstallment(form.total_amount, form.tna, form.n_installments)
      : calculateNoInterest(form.total_amount, form.n_installments);

    setCalc(result);
  }, [form.total_amount, form.n_installments, form.interest_type, form.tna, form.known_installment]);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === "number" ? parseFloat(e.target.value) || null : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--text-primary)",
    width: "100%",
    fontSize: 14,
  };

  return (
    <div className="glass-strong p-5 flex flex-col gap-4">
      <h2 className="text-base font-semibold">Nueva compra en cuotas</h2>

      <div className="flex flex-col gap-3">
        <input style={inputStyle} placeholder="¿Qué compraste?" value={form.name}
          onChange={set("name")} />

        <div className="flex gap-2">
          <input style={{ ...inputStyle, flex: 2 }} type="number" placeholder="Precio total"
            value={form.total_amount || ""} onChange={set("total_amount")} />
          <select style={{ ...inputStyle, flex: 1 }} value={form.currency_code} onChange={set("currency_code")}>
            {["ARS", "USD", "EUR", "CHF", "BRL", "UYU"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <input style={inputStyle} placeholder="Tarjeta / banco (ej: Galicia Visa)"
          value={form.card_name} onChange={set("card_name")} />

        <div className="flex gap-2">
          <select style={{ ...inputStyle, flex: 1 }} value={form.n_installments}
            onChange={(e) => setForm((f) => ({ ...f, n_installments: parseInt(e.target.value) }))}>
            {INSTALLMENT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} cuota{n > 1 ? "s" : ""}</option>
            ))}
          </select>

          <select style={{ ...inputStyle, flex: 1 }} value={form.interest_type}
            onChange={(e) => setForm((f) => ({ ...f, interest_type: e.target.value as "none" | "french" }))}>
            <option value="none">Sin interés</option>
            <option value="french">Con interés</option>
          </select>
        </div>

        {form.interest_type === "french" && (
          <div className="flex flex-col gap-2">
            <input style={inputStyle} type="number" placeholder="TNA % (ej: 94.9)"
              value={form.tna ?? ""} onChange={set("tna")} />
            <div className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
              — o si sabés el monto de cuota —
            </div>
            <input style={inputStyle} type="number" placeholder="Monto de cuota"
              value={form.known_installment ?? ""} onChange={set("known_installment")} />
          </div>
        )}

        <input style={inputStyle} type="date" value={form.first_payment_date}
          onChange={set("first_payment_date")} />
      </div>

      {calc.installment_amount > 0 && (
        <div
          className="rounded-xl p-3 flex flex-col gap-1.5"
          style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <Row label="Cuota mensual" value={`${form.currency_code} ${fmt(calc.installment_amount)}`} bold />
          <Row label="Total a pagar" value={`${form.currency_code} ${fmt(calc.total_to_pay)}`} />
          <Row label="Costo financiero" value={`${form.currency_code} ${fmt(calc.financing_cost)}`}
            color={calc.financing_cost > 0 ? "var(--accent-yellow)" : "var(--accent-green)"} />
          {form.tna && <Row label="TNA" value={`${form.tna.toFixed(1)}%`} />}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
          Cancelar
        </button>
        <button onClick={() => onSubmit({ ...form, tna: form.tna ?? null, known_installment: null })}
          className="flex-1 py-3 rounded-xl text-sm font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}>
          Registrar ✓
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm" style={{ fontWeight: bold ? 700 : 400, color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
