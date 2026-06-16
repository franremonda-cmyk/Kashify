"use client";
import { useState, useEffect } from "react";

interface Category {
  id: string; name: string; icon: string; color: string; is_default: boolean;
  category_budgets?: { monthly_limit: number; currency_code: string }[];
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editBudget, setEditBudget] = useState<{ id: string; limit: string; currency: string } | null>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), icon: "📦", color: "#6366f1" }),
    });
    setNewName("");
    setShowNew(false);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }

  async function saveBudget() {
    if (!editBudget) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: editBudget.id,
        monthly_limit: parseFloat(editBudget.limit),
        currency_code: editBudget.currency,
      }),
    });
    setEditBudget(null);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "var(--text-primary)",
    fontSize: 14,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Categorías</h1>
        <button
          onClick={() => setShowNew(true)}
          className="text-sm px-3 py-2 rounded-xl font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          + Nueva
        </button>
      </div>

      {showNew && (
        <div className="glass p-4 flex gap-2">
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Nombre de categoría"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            autoFocus
          />
          <button onClick={addCategory} className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}>OK</button>
          <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>✕</button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {categories.map((cat) => {
          const budget = cat.category_budgets?.[0];
          const isEditing = editBudget?.id === cat.id;

          return (
            <div key={cat.id} className="glass p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.name}</span>
                  {cat.is_default && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      default
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditBudget(
                    isEditing ? null : { id: cat.id, limit: String(budget?.monthly_limit ?? ""), currency: budget?.currency_code ?? "ARS" }
                  )}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
                >
                  {budget ? `${budget.currency_code} ${Number(budget.monthly_limit).toLocaleString("es-AR")}` : "Agregar límite"}
                </button>
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <select style={{ ...inputStyle, width: 80 }} value={editBudget.currency}
                    onChange={(e) => setEditBudget((b) => b ? { ...b, currency: e.target.value } : b)}>
                    {["ARS", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="Límite mensual"
                    value={editBudget.limit}
                    onChange={(e) => setEditBudget((b) => b ? { ...b, limit: e.target.value } : b)} />
                  <button onClick={saveBudget} className="px-3 py-2 rounded-xl text-sm font-medium"
                    style={{ background: "var(--accent)", color: "#fff" }}>✓</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
