"use client";
import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types";

export default function HistorialPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

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
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin resultados</p>
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
    </div>
  );
}
