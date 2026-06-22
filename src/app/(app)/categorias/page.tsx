"use client";
import { useState, useEffect } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryModal from "@/components/CategoryModal";
import { useIconStyle } from "@/context/IconStyleContext";
import { BackButton } from "@/components/ui/BackButton";

interface Budget { monthly_limit: number; currency_code: string; period_type?: PeriodType; applies_months?: number[] | null }
interface Category {
  id: string; name: string; icon: string; color: string; is_default: boolean;
  category_budgets?: Budget[];
}

type PeriodType = "always" | "specific_months";
const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP"];
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function MonthGrid({ selected, onToggle }: { selected: number[]; onToggle: (m: number) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
      {MONTHS.map((m, i) => {
        const month = i + 1;
        const on = selected.includes(month);
        return (
          <button key={m} type="button" onClick={() => onToggle(month)}
            style={{ padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: on ? "var(--accent-soft)" : "var(--base)", border: on ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: on ? "var(--accent)" : "var(--ink-dim)" }}>
            {m}
          </button>
        );
      })}
    </div>
  );
}

function PeriodToggle({ value, onChange }: { value: PeriodType; onChange: (p: PeriodType) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {(["always", "specific_months"] as const).map((pt) => (
        <button key={pt} type="button" onClick={() => onChange(pt)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: value === pt ? "var(--accent-soft)" : "var(--base)", border: value === pt ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: value === pt ? "var(--accent)" : "var(--ink-muted)" }}>
          {pt === "always" ? "Siempre" : "Mes específico"}
        </button>
      ))}
    </div>
  );
}

const inp: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 12,
  padding: "11px 14px",
  color: "var(--ink)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

export default function CategoriasPage() {
  const { iconStyle } = useIconStyle();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<Category | "new" | null>(null);
  // Límite: state del panel expandido por categoría
  const [editBudget, setEditBudget] = useState<{ id: string; limit: string; currency: string; period: PeriodType; months: number[] } | null>(null);
  // Nuevo límite: dropdown para elegir qué categoría
  const [showNewBudget, setShowNewBudget] = useState(false);
  const [newBudgetCatId, setNewBudgetCatId] = useState("");
  const [newBudgetLimit, setNewBudgetLimit] = useState("");
  const [newBudgetCurrency, setNewBudgetCurrency] = useState("ARS");
  const [newBudgetPeriod, setNewBudgetPeriod] = useState<PeriodType>("always");
  const [newBudgetMonths, setNewBudgetMonths] = useState<number[]>([]);
  const existingColors = categories.map(c => c.color).filter(Boolean);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleMonth(arr: number[], m: number) {
    return arr.includes(m) ? arr.filter(x => x !== m) : [...arr, m].sort((a, b) => a - b);
  }

  async function saveBudget(catId: string, b: { limit: string; currency: string; period: PeriodType; months: number[] }) {
    if (!b.limit || isNaN(parseFloat(b.limit))) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: catId, monthly_limit: parseFloat(b.limit), currency_code: b.currency,
        period_type: b.period, applies_months: b.period === "specific_months" ? b.months : null,
      }),
    });
    setEditBudget(null);
    load();
  }

  async function saveNewBudget() {
    if (!newBudgetCatId || !newBudgetLimit) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: newBudgetCatId, monthly_limit: parseFloat(newBudgetLimit), currency_code: newBudgetCurrency,
        period_type: newBudgetPeriod, applies_months: newBudgetPeriod === "specific_months" ? newBudgetMonths : null,
      }),
    });
    setShowNewBudget(false);
    setNewBudgetCatId("");
    setNewBudgetLimit("");
    setNewBudgetCurrency("ARS");
    setNewBudgetPeriod("always");
    setNewBudgetMonths([]);
    load();
  }

  // Categorías sin límite para el dropdown de "nuevo límite"
  const catsWithoutBudget = categories.filter(c => !c.category_budgets?.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between enter-up">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="page-title">Categorías</h1>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>Organizá y controlá tus gastos</p>
          </div>
        </div>
        <button onClick={() => setEditingCat("new")}
          style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 12, background: "var(--accent)", color: "#FFFFFF", flexShrink: 0 }}>
          + Nueva
        </button>
      </div>

      {/* Lista de categorías */}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "24px 0" }}>Cargando...</p>
      ) : (
        <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)" }}>
          {categories.map((cat, i) => {
            const budget = cat.category_budgets?.[0];
            const isEditing = editBudget?.id === cat.id;
            return (
              <div key={cat.id} style={{ borderBottom: i < categories.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                  {/* Ícono correcto */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: (cat.color ?? "var(--accent)") + "22", border: `1px solid ${cat.color ?? "var(--accent)"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color ?? "var(--accent)" }}>
                    <CategoryIcon icon={cat.icon} name={cat.name} color={cat.color} size={18} style={iconStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{cat.name}</span>
                      {cat.is_default && (
                        <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 999, background: "var(--raised)", color: "var(--ink-dim)", border: "0.5px solid var(--glass-border)" }}>default</span>
                      )}
                    </div>
                    {budget && (
                      <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>
                        Límite: {budget.currency_code} {Number(budget.monthly_limit).toLocaleString("es-AR")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditBudget(isEditing ? null : { id: cat.id, limit: String(budget?.monthly_limit ?? ""), currency: budget?.currency_code ?? "ARS", period: budget?.period_type ?? "always", months: budget?.applies_months ?? [] })}
                      style={{ fontSize: 13, padding: "5px 10px", borderRadius: 8, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: budget ? "var(--accent)" : "var(--ink-muted)", fontWeight: 600 }}>
                      {budget ? "Límite" : "+ Límite"}
                    </button>
                    <button onClick={() => setEditingCat(cat)}
                      style={{ fontSize: 13, padding: "5px 10px", borderRadius: 8, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontWeight: 600 }}>
                      Editar
                    </button>
                  </div>
                </div>

                {/* Inline budget editor */}
                {isEditing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 14px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select style={{ ...inp, width: 90 }} value={editBudget.currency}
                        onChange={(e) => setEditBudget(b => b ? { ...b, currency: e.target.value } : b)}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input style={{ ...inp, flex: 1 }} type="number" inputMode="decimal" placeholder="Límite mensual"
                        value={editBudget.limit}
                        onChange={(e) => setEditBudget(b => b ? { ...b, limit: e.target.value } : b)}
                      />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 6, fontWeight: 600 }}>¿Cuándo aplica?</p>
                      <PeriodToggle value={editBudget.period} onChange={(p) => setEditBudget(b => b ? { ...b, period: p } : b)} />
                    </div>
                    {editBudget.period === "specific_months" && (
                      <MonthGrid selected={editBudget.months} onToggle={(m) => setEditBudget(b => b ? { ...b, months: toggleMonth(b.months, m) } : b)} />
                    )}
                    <button onClick={() => editBudget && saveBudget(cat.id, editBudget)}
                      style={{ padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF" }}>Guardar límite</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Panel para agregar límite a una categoría sin límite */}
      {catsWithoutBudget.length > 0 && (
        <div style={{ borderRadius: 16, border: "0.5px solid var(--glass-border)", background: "var(--base)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <button onClick={() => setShowNewBudget(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "transparent" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Agregar límite mensual</p>
              <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>Asignale un techo de gasto a una categoría</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: "var(--ink-dim)", transition: "transform 200ms ease-out", transform: showNewBudget ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showNewBudget && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "0.5px solid var(--glass-border-dim)" }}>
              <div style={{ height: 4 }} />
              {/* Dropdown de categorías */}
              <select style={inp} value={newBudgetCatId} onChange={(e) => setNewBudgetCatId(e.target.value)}>
                <option value="">Elegir categoría...</option>
                {catsWithoutBudget.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {/* Opción: crear categoría nueva */}
              <button onClick={() => setEditingCat("new")}
                style={{ fontSize: 12, color: "var(--accent)", textAlign: "left", background: "transparent", paddingLeft: 4, fontWeight: 600 }}>
                + Crear nueva categoría
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <select style={{ ...inp, width: 90 }} value={newBudgetCurrency} onChange={(e) => setNewBudgetCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input style={{ ...inp, flex: 1 }} type="number" inputMode="decimal" placeholder="Monto mensual"
                  value={newBudgetLimit} onChange={(e) => setNewBudgetLimit(e.target.value)}
                />
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 6, fontWeight: 600 }}>¿Cuándo aplica?</p>
                <PeriodToggle value={newBudgetPeriod} onChange={setNewBudgetPeriod} />
              </div>
              {newBudgetPeriod === "specific_months" && (
                <MonthGrid selected={newBudgetMonths} onToggle={(m) => setNewBudgetMonths(arr => toggleMonth(arr, m))} />
              )}
              <button onClick={saveNewBudget} disabled={!newBudgetCatId || !newBudgetLimit}
                style={{ padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: newBudgetCatId && newBudgetLimit ? "var(--accent)" : "var(--raised)", color: newBudgetCatId && newBudgetLimit ? "#FFFFFF" : "var(--ink-dim)" }}>
                Guardar límite
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar categoría */}
      {editingCat !== null && (
        <CategoryModal
          cat={editingCat === "new" ? undefined : editingCat}
          existingColors={existingColors}
          currentStyle={iconStyle}
          onSave={async (patch) => {
            const catId = editingCat === "new" ? null : editingCat.id;
            if (catId) {
              await fetch(`/api/categories/${catId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
            } else {
              const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
              // Si había un límite pendiente, asignarlo a la nueva categoría
              if (newBudgetLimit && res.ok) {
                const newCat = await res.json();
                await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_id: newCat.id, monthly_limit: parseFloat(newBudgetLimit), currency_code: newBudgetCurrency }) });
                setShowNewBudget(false);
                setNewBudgetCatId("");
                setNewBudgetLimit("");
              }
            }
            setEditingCat(null);
            load();
          }}
          onDelete={editingCat !== "new" && !editingCat.is_default ? async () => {
            await fetch(`/api/categories/${editingCat.id}`, { method: "DELETE" });
            setEditingCat(null);
            load();
          } : undefined}
          onClose={() => setEditingCat(null)}
        />
      )}
    </div>
  );
}
