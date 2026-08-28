"use client";
import { useState } from "react";
import type { DebtDirection } from "@/types";

export interface DebtFormData {
  direction: DebtDirection;
  counterparty: string;
  description: string;
  total_amount: number;
  currency_code: string;
  due_date: string;
}

interface Props {
  onSubmit: (data: DebtFormData) => void;
  onCancel: () => void;
  initialData?: Partial<DebtFormData>;
  editMode?: boolean;
}

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU"];

const inp: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 10,
  padding: "11px 13px",
  color: "var(--ink)",
  fontSize: "var(--text-base)",
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
  fontSize: "var(--text-2xs)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--ink-muted)",
};

const required: React.CSSProperties = {
  color: "var(--accent)",
  marginLeft: 2,
};

export default function DebtForm({ onSubmit, onCancel, initialData, editMode = false }: Props) {
  const [form, setForm] = useState<DebtFormData>({
    direction: initialData?.direction ?? "debo",
    counterparty: initialData?.counterparty ?? "",
    description: initialData?.description ?? "",
    total_amount: initialData?.total_amount ?? 0,
    currency_code: initialData?.currency_code ?? "ARS",
    due_date: initialData?.due_date ?? "",
  });
  const [attempted, setAttempted] = useState(false);

  function setStr(key: keyof DebtFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  const isValid = form.counterparty.trim() !== "" && form.total_amount > 0;

  function handleSubmit() {
    setAttempted(true);
    if (!isValid) return;
    onSubmit(form);
  }

  function fieldBorder(valid: boolean): React.CSSProperties {
    return attempted && !valid
      ? { ...inp, border: "0.5px solid rgba(255,59,48,0.6)", background: "rgba(255,59,48,0.04)" }
      : inp;
  }

  return (
    <div style={{ borderRadius: 18, border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: "var(--text-row)", fontWeight: 600, color: "var(--ink)" }}>
        {editMode ? "Editar deuda" : "Nueva deuda"}
      </h2>

      {/* ① Dirección */}
      {!editMode && (
        <div style={section}>
          <p style={label}>¿Quién le debe a quién? <span style={required}>*</span></p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["debo", "me_deben"] as DebtDirection[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm((f) => ({ ...f, direction: d }))}
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: "var(--text-xs)", fontWeight: 600,
                  background: form.direction === d ? "var(--accent)" : "var(--raised)",
                  color: form.direction === d ? "var(--on-accent)" : "var(--ink-muted)",
                  border: "0.5px solid var(--glass-border)",
                }}
              >
                {d === "debo" ? "Yo debo" : "Me deben"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ② A quién */}
      <div style={section}>
        <p style={label}>{form.direction === "debo" ? "¿A quién le debés?" : "¿Quién te debe?"} <span style={required}>*</span></p>
        <input
          style={fieldBorder(form.counterparty.trim() !== "")}
          placeholder="Ej. Juan, Banco Galicia…"
          value={form.counterparty}
          onChange={setStr("counterparty")}
        />
      </div>

      {/* ③ De qué es */}
      <div style={section}>
        <p style={label}>¿De qué es? <span style={{ ...required, color: "var(--ink-dim)", fontSize: "var(--text-2xs)" }}>(opcional)</span></p>
        <input
          style={inp}
          placeholder="Ej. Préstamo, alquiler de agosto…"
          value={form.description}
          onChange={setStr("description")}
        />
      </div>

      {/* ④ Monto */}
      <div style={section}>
        <p style={label}>Monto <span style={required}>*</span></p>
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

      {/* ⑤ Vencimiento */}
      <div style={section}>
        <p style={label}>Vencimiento <span style={{ ...required, color: "var(--ink-dim)", fontSize: "var(--text-2xs)" }}>(opcional)</span></p>
        <input style={inp} type="date" value={form.due_date} onChange={setStr("due_date")} />
      </div>

      {attempted && !isValid && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--negative)", textAlign: "center" }}>
          Completá los campos obligatorios (marcados con *)
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: "var(--text-xs)", fontWeight: 500, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: "var(--text-xs)", fontWeight: 600, background: "var(--accent)", color: "var(--on-accent)", opacity: attempted && !isValid ? 0.7 : 1 }}>
          {editMode ? "Guardar cambios" : "Registrar ✓"}
        </button>
      </div>
    </div>
  );
}
