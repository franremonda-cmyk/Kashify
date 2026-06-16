"use client";
import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types";

interface Category { id: string; name: string; icon: string; }

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN"];

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 12,
  padding: "11px 14px",
  color: "var(--ink)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

function TransactionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    type: "expense" as "expense" | "income",
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 scale-up"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong w-full max-w-sm p-5 flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>
            Registrar
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: "var(--glass-1)", color: "var(--ink-muted)" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: form.type === t
                    ? t === "expense" ? "rgba(255,83,112,0.20)" : "rgba(105,255,218,0.15)"
                    : "transparent",
                  color: form.type === t
                    ? t === "expense" ? "var(--negative)" : "var(--positive)"
                    : "var(--ink-muted)",
                  transition: "all 160ms ease-out",
                }}
              >
                {t === "expense" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          <input style={inp} placeholder="Descripción" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <div className="flex gap-2">
            <input style={{ ...inp, width: "58%" }} placeholder="0.00" type="number"
              step="0.01" min="0" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <select style={{ ...inp, width: "42%" }} value={form.currency_code}
              onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <select style={inp} value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
            <option value="">Categoría...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>

          <input style={inp} type="date" value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />

          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40 lift"
            style={{ background: "var(--accent)", color: "#060C09" }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  conversion: "Conversión",
  "installment-payment": "Cuota",
};

export default function HistorialPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (activeCat) params.set("category_id", activeCat);

    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }, [page, search, activeCat]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  function handleCatFilter(id: string) {
    setActiveCat((prev) => (prev === id ? null : id));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSaved={fetchTransactions}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <h1 className="display font-semibold" style={{ fontSize: "1.35rem", color: "var(--ink)" }}>
          Historial
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.open("/api/export?format=csv")}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            CSV
          </button>
          <button
            onClick={() => window.open("/api/export?format=xlsx")}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            Excel
          </button>
        </div>
      </div>

      {/* Buscador */}
      <input
        className="w-full enter-up"
        style={{ ...inp, borderRadius: 14 }}
        placeholder="Buscar transacciones..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        data-delay="1"
      />

      {/* Filtros por categoría */}
      {categories.length > 0 && (
        <div
          className="flex gap-2 -mx-4 px-4 pb-1 enter-up"
          style={{ overflowX: "auto", scrollbarWidth: "none" }}
          data-delay="2"
        >
          <button
            onClick={() => { setActiveCat(null); setPage(1); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
            style={{
              background: activeCat === null ? "var(--accent)" : "var(--glass-1)",
              color: activeCat === null ? "#060C09" : "var(--ink-muted)",
              border: activeCat === null ? "none" : "0.5px solid var(--glass-border)",
            }}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCatFilter(cat.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
              style={{
                background: activeCat === cat.id ? "rgba(0,200,83,0.15)" : "var(--glass-1)",
                color: activeCat === cat.id ? "var(--accent)" : "var(--ink-muted)",
                border: activeCat === cat.id ? "0.5px solid var(--glass-border-hover)" : "0.5px solid var(--glass-border)",
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col">
        {loading && (
          <div className="glass p-6 text-center">
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Cargando...</p>
          </div>
        )}

        {!loading && transactions.length === 0 && (
          <div className="glass p-8 text-center flex flex-col gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "var(--accent-soft)", border: "0.5px solid var(--glass-border-hover)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--accent)" }}>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {activeCat ? "Sin transacciones en esta categoría" : "Ninguna transacción todavía"}
              </p>
              {!activeCat && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-2 text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  + Agregar la primera
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="glass flex flex-col">
            {transactions.map((t, i) => {
              const isIncome = t.type === "income";
              const color = isIncome ? "var(--positive)" : t.type === "installment-payment" ? "var(--warning)" : "var(--negative)";
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < transactions.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isIncome ? "rgba(105,255,218,0.10)" : "rgba(255,255,255,0.06)" }}
                  >
                    {t.category?.icon ? (
                      <span className="text-base">{t.category.icon}</span>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ink-dim)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                      {t.description}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--ink-dim)" }}>
                      {t.date}
                      {t.category?.name ? ` · ${t.category.name}` : ""}
                      {t.card_name ? ` · ${t.card_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono text-sm font-medium" style={{ color }}>
                      {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--ink-dim)" }}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > 50 && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm px-4 py-2 rounded-xl disabled:opacity-30"
            style={{ background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            ← Anterior
          </button>
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
            {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} de {total}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 50 >= total}
            className="text-sm px-4 py-2 rounded-xl disabled:opacity-30"
            style={{ background: "var(--glass-1)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
