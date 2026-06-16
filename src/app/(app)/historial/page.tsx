"use client";
import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; }

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN"];

function TransactionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    currency_code: "ARS",
    category_id: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.category_id) {
      setError("Completá todos los campos");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { onSaved(); onClose(); }
    else { setError("Error al guardar"); setSaving(false); }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "var(--text-primary)",
    borderRadius: "0.75rem",
    padding: "0.625rem 0.875rem",
    fontSize: "0.875rem",
    width: "100%",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">Nueva transacción</h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Tipo */}
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: form.type === t
                    ? t === "expense" ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"
                    : "rgba(255,255,255,0.06)",
                  border: form.type === t
                    ? t === "expense" ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(34,197,94,0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: form.type === t
                    ? t === "expense" ? "#f87171" : "#4ade80"
                    : "var(--text-secondary)",
                }}
              >
                {t === "expense" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          {/* Descripción */}
          <input
            style={inputStyle}
            placeholder="Descripción"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Monto + Moneda */}
          <div className="flex gap-2">
            <input
              style={{ ...inputStyle, width: "60%" }}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <select
              style={{ ...inputStyle, width: "40%" }}
              value={form.currency_code}
              onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Categoría */}
          <select
            style={inputStyle}
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
          >
            <option value="">Categoría...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>

          {/* Fecha */}
          <input
            style={inputStyle}
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />

          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "var(--accent-blue)", color: "white" }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function HistorialPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);

    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const typeLabels: Record<string, string> = {
    expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
  };
  const typeColors: Record<string, string> = {
    expense: "var(--accent-red)", income: "var(--accent-green)",
    conversion: "#6366f1", "installment-payment": "var(--accent-yellow)",
  };

  return (
    <div className="flex flex-col gap-4">
      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSaved={fetchTransactions}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Historial</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.open("/api/export?format=csv")}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            CSV
          </button>
          <button
            onClick={() => window.open("/api/export?format=xlsx")}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            Excel
          </button>
        </div>
      </div>

      <input
        className="w-full px-4 py-2.5 rounded-xl text-sm"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "var(--text-primary)",
        }}
        placeholder="Buscar transacciones..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      <div className="flex flex-col gap-2">
        {loading && <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>Cargando...</p>}

        {!loading && transactions.length === 0 && (
          <div className="glass p-6 text-center">
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin transacciones</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm font-medium"
              style={{ color: "var(--accent-blue)" }}
            >
              + Agregar la primera
            </button>
          </div>
        )}

        {transactions.map((t) => (
          <div key={t.id} className="glass p-3 flex items-center gap-3">
            <span className="text-xl">{t.category?.icon ?? "📦"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.description}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t.date} · {t.category?.name ?? "Sin categoría"}
                {t.card_name ? ` · ${t.card_name}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold" style={{ color: typeColors[t.type] }}>
                {t.type === "income" ? "+" : "-"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                {typeLabels[t.type]}
              </p>
            </div>
          </div>
        ))}
      </div>

      {total > 50 && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm px-4 py-2 rounded-xl disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            ← Anterior
          </button>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} de {total}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 50 >= total}
            className="text-sm px-4 py-2 rounded-xl disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light shadow-lg transition-all"
        style={{ background: "var(--accent-blue)", color: "white" }}
      >
        +
      </button>
    </div>
  );
}
