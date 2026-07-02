"use client";
import { useState, useEffect } from "react";
import {
  calculateFrenchInstallment,
  calculateNoInterest,
  calculateImpliedTNA,
} from "@/lib/installments/calculator";

export interface InstallmentFormData {
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

interface Props {
  onSubmit: (data: InstallmentFormData) => void;
  onCancel: () => void;
  initialData?: Partial<InstallmentFormData>;
  editMode?: boolean;
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36];
const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU"];

const inp: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 10,
  padding: "11px 13px",
  color: "var(--ink)",
  fontSize: 16,
  width: "100%",
  outline: "none",
};

const section: React.CSSProperties = {
  border: "0.5px solid var(--glass-border)",
  borderRadius: 14,
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "var(--base)",
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--ink-muted)",
};

const required: React.CSSProperties = {
  color: "var(--accent)",
  marginLeft: 2,
};

export default function InstallmentForm({ onSubmit, onCancel, initialData, editMode = false }: Props) {
  const [form, setForm] = useState<InstallmentFormData>({
    name: initialData?.name ?? "",
    total_amount: initialData?.total_amount ?? 0,
    currency_code: initialData?.currency_code ?? "ARS",
    category_id: initialData?.category_id ?? "",
    card_name: initialData?.card_name ?? "",
    n_installments: initialData?.n_installments ?? 12,
    interest_type: initialData?.interest_type ?? "none",
    tna: initialData?.tna ?? null,
    known_installment: null,
    first_payment_date: initialData?.first_payment_date ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const [calc, setCalc] = useState({ installment_amount: 0, total_to_pay: 0, financing_cost: 0 });
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!form.total_amount || form.total_amount <= 0 || !form.n_installments) return;

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

  function setStr(key: keyof InstallmentFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  function setNum(key: keyof InstallmentFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setForm((f) => ({ ...f, [key]: isNaN(v) ? null : v }));
    };
  }

  const isValid = form.name.trim() !== "" && form.total_amount > 0 && form.first_payment_date !== "";

  function handleSubmit() {
    setAttempted(true);
    if (!isValid) return;
    onSubmit({ ...form, tna: form.tna ?? null, known_installment: null });
  }

  function fieldBorder(valid: boolean): React.CSSProperties {
    return attempted && !valid
      ? { ...inp, border: "0.5px solid rgba(255,59,48,0.6)", background: "rgba(255,59,48,0.04)" }
      : inp;
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ borderRadius: 18, border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
        {editMode ? "Editar cuota" : "Nueva compra en cuotas"}
      </h2>

      {/* ① Descripción */}
      <div style={section}>
        <p style={label}>¿Qué compraste? <span style={required}>*</span></p>
        <input
          style={fieldBorder(form.name.trim() !== "")}
          placeholder="Ej. TV Samsung, viaje a México…"
          value={form.name}
          onChange={setStr("name")}
        />
      </div>

      {/* ② Precio total */}
      <div style={section}>
        <p style={label}>Precio total <span style={required}>*</span></p>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...inp, width: 88, flexShrink: 0 }} value={form.currency_code} onChange={setStr("currency_code")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            style={fieldBorder(form.total_amount > 0)}
            type="number" inputMode="decimal"
            placeholder="0"
            value={form.total_amount || ""}
            onChange={(e) => setForm((f) => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      {/* ③ Tarjeta / banco */}
      <div style={section}>
        <p style={label}>Tarjeta / banco <span style={{ ...required, color: "var(--ink-dim)", fontSize: 12 }}>(opcional)</span></p>
        <input
          style={inp}
          placeholder="Ej. Galicia Visa, Mercado Pago…"
          value={form.card_name}
          onChange={setStr("card_name")}
        />
      </div>

      {/* ④ Cuotas e interés */}
      <div style={section}>
        <p style={label}>Cuotas e interés <span style={required}>*</span></p>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...inp, flex: 1 }} value={form.n_installments}
            onChange={(e) => setForm((f) => ({ ...f, n_installments: parseInt(e.target.value) }))}>
            {INSTALLMENT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} cuota{n > 1 ? "s" : ""}</option>
            ))}
          </select>
          <select style={{ ...inp, flex: 1 }} value={form.interest_type}
            onChange={(e) => setForm((f) => ({ ...f, interest_type: e.target.value as "none" | "french" }))}>
            <option value="none">Sin interés</option>
            <option value="french">Con interés</option>
          </select>
        </div>
        {form.interest_type === "french" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            <input style={inp} type="number" inputMode="decimal" placeholder="TNA % (ej: 94.9)"
              value={form.tna ?? ""} onChange={setNum("tna")} />
            <p style={{ fontSize: 12, color: "var(--ink-dim)", textAlign: "center" }}>— o si sabés el monto de cuota —</p>
            <input style={inp} type="number" inputMode="decimal" placeholder="Monto de cuota conocido"
              value={form.known_installment ?? ""} onChange={setNum("known_installment")} />
          </div>
        )}
      </div>

      {/* ⑤ Fecha primer vencimiento */}
      <div style={section}>
        <p style={label}>Primer vencimiento <span style={required}>*</span></p>
        <input style={fieldBorder(form.first_payment_date !== "")} type="date"
          value={form.first_payment_date} onChange={setStr("first_payment_date")} />
      </div>

      {/* Resumen de cálculo */}
      {calc.installment_amount > 0 && (
        <div style={{ borderRadius: 12, padding: "12px 14px", background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", display: "flex", flexDirection: "column", gap: 6 }}>
          <Row label="Cuota mensual" value={`${form.currency_code} ${fmt(calc.installment_amount)}`} bold />
          <Row label="Total a pagar" value={`${form.currency_code} ${fmt(calc.total_to_pay)}`} />
          <Row label="Costo financiero" value={`${form.currency_code} ${fmt(calc.financing_cost)}`}
            color={calc.financing_cost > 0 ? "var(--warning)" : "var(--positive)"} />
          {form.tna != null && form.tna > 0 && <Row label="TNA" value={`${form.tna.toFixed(1)}%`} />}
        </div>
      )}

      {attempted && !isValid && (
        <p style={{ fontSize: 13, color: "var(--negative)", textAlign: "center" }}>
          Completá los campos obligatorios (marcados con *)
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#04130D", opacity: attempted && !isValid ? 0.7 : 1 }}>
          {editMode ? "Guardar cambios" : "Registrar ✓"}
        </button>
      </div>
    </div>
  );
}

function Row({ label: l, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{l}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: color ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
