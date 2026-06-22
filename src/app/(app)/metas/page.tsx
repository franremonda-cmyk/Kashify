"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import CategoryIcon from "@/components/CategoryIcon";
import { CATEGORY_COLORS } from "@/lib/iconList";
import { useIconStyle } from "@/context/IconStyleContext";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import { BackButton } from "@/components/ui/BackButton";
import type { SavingsGoal } from "@/types";

const IconPicker = dynamic(() => import("@/components/IconPicker"), { ssr: false });

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP", "PYG", "PEN", "COP"];

const inp: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 12,
  padding: "12px 14px",
  color: "var(--ink)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function MetasPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributing, setContributing] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/goals");
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setShowNew(true);
  }, []);

  async function contribute(id: string, sign: 1 | -1) {
    const value = parseFloat(addAmount);
    if (!value || value <= 0) return;
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: value * sign }),
    });
    setContributing(null);
    setAddAmount("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta meta?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between enter-up">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="page-title">Metas de ahorro</h1>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>Objetivos y tu progreso hacia ellos</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 12, background: "var(--accent)", color: "#FFFFFF", flexShrink: 0 }}
        >
          + Nueva
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "24px 0" }}>Cargando...</p>
      ) : goals.length === 0 ? (
        <div className="glass p-8 text-center enter-up" style={{ borderRadius: 20 }}>
          <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Sin metas todavía</p>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
            Creá una meta (un viaje, un fondo de emergencia) y seguí tu progreso.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            const reached = g.status === "reached" || g.current_amount >= g.target_amount;
            const isContributing = contributing === g.id;
            return (
              <div key={g.id} className="glass p-4 flex flex-col gap-3" style={{ borderRadius: 18 }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: g.color + "22", border: `1px solid ${g.color}33`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: g.color,
                  }}>
                    <CategoryIcon icon={g.icon} name={g.name} color={g.color} size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                      {reached && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(52,199,89,0.12)", color: "var(--positive)" }}>
                          ¡LOGRADA!
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 2 }}>
                      {fmt(g.current_amount, g.currency_code)} de {fmt(g.target_amount, g.currency_code)}
                      {g.target_date && ` · para ${new Date(g.target_date).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditingGoal(g)}
                      aria-label="Editar meta"
                      style={{ width: 28, height: 28, borderRadius: 8, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-dim)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✏️
                    </button>
                    <button onClick={() => remove(g.id)}
                      aria-label="Eliminar meta"
                      style={{ width: 28, height: 28, borderRadius: 8, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-dim)", fontSize: 14 }}>
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ width: "100%", height: 8, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: reached ? "var(--positive)" : g.color, transition: "width 300ms ease-out" }} />
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: reached ? "var(--positive)" : g.color }}>{pct.toFixed(0)}%</span>
                    <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                      {reached ? "Meta alcanzada" : `Faltan ${fmt(remaining, g.currency_code)}`}
                    </span>
                  </div>
                </div>

                {isContributing ? (
                  <div className="flex gap-2">
                    <input
                      style={{ ...inp, flex: 1 }}
                      type="number" inputMode="decimal"
                      placeholder="Monto"
                      value={addAmount}
                      autoFocus
                      onChange={(e) => setAddAmount(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && contribute(g.id, 1)}
                    />
                    <button onClick={() => contribute(g.id, -1)}
                      style={{ padding: "0 12px", borderRadius: 12, fontSize: 16, fontWeight: 600, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>−</button>
                    <button onClick={() => contribute(g.id, 1)}
                      style={{ padding: "0 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF" }}>Sumar</button>
                    <button onClick={() => { setContributing(null); setAddAmount(""); }}
                      style={{ padding: "0 10px", borderRadius: 12, fontSize: 13, background: "transparent", color: "var(--ink-dim)" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setContributing(g.id); setAddAmount(""); }}
                    style={{ padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)" }}>
                    Registrar aporte
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <GoalModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editingGoal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSaved={() => { setEditingGoal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Modal crear/editar meta ────────────────────────────────────────────────

function GoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal?: SavingsGoal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { iconStyle } = useIconStyle();
  const isEdit = !!goal;
  const [name, setName]     = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const [current, setCurrent] = useState(goal ? String(goal.current_amount) : "");
  const [currency, setCurrency] = useState(goal?.currency_code ?? "ARS");
  const [date, setDate]     = useState(goal?.target_date ? goal.target_date.split("T")[0] : "");
  const [color, setColor]   = useState(goal?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon]     = useState(goal?.icon ?? "piggy-bank");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

  async function save() {
    if (!name.trim() || !target || parseFloat(target) <= 0) return;
    setSaving(true);
    if (isEdit) {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target_amount: parseFloat(target),
          currency_code: currency,
          target_date: date || null,
          color,
          icon,
        }),
      });
    } else {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target_amount: parseFloat(target),
          current_amount: current ? parseFloat(current) : 0,
          currency_code: currency,
          target_date: date || null,
          color,
          icon,
        }),
      });
    }
    setSaving(false);
    onSaved();
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        ref={overlayRef}
        role="presentation"
        style={{
          position: "fixed", inset: 0, zIndex: 9100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.72)",
          padding: "20px 16px",
          touchAction: "none",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          role="dialog" aria-modal="true" aria-label={isEdit ? "Editar meta de ahorro" : "Nueva meta de ahorro"}
          style={{ width: "100%", maxWidth: 400, borderRadius: 20, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "0 24px 60px rgba(0,0,0,0.40)", maxHeight: "90dvh", display: "flex", flexDirection: "column" }}
        >
          <div className="flex items-center justify-between" style={{ padding: "16px 18px 0", flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{isEdit ? "Editar meta" : "Nueva meta"}</p>
            <button onClick={onClose} aria-label="Cerrar"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div ref={scrollRef} style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", touchAction: "pan-y" }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPicker(true)}
                style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: color + "22", border: `1.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                <CategoryIcon icon={icon} color={color} size={28} style={iconStyle} />
              </button>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 6 }}>Toca para cambiar el ícono</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--ink)" : "2px solid transparent", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
                  ))}
                </div>
              </div>
            </div>

            <input style={inp} placeholder="Nombre (ej. Viaje a Brasil)" value={name} onChange={(e) => setName(e.target.value)} />

            <div className="flex gap-2">
              <select style={{ ...inp, width: 90 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input style={{ ...inp, flex: 1 }} type="number" inputMode="decimal" placeholder="Monto objetivo" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>

            {!isEdit && (
              <input style={inp} type="number" inputMode="decimal" placeholder="Ya ahorrado (opcional)" value={current} onChange={(e) => setCurrent(e.target.value)} />
            )}

            <div>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 6 }}>Fecha objetivo (opcional)</p>
              <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <button onClick={save} disabled={!name.trim() || !target || saving}
              style={{ padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: name.trim() && target ? "var(--accent)" : "var(--raised)", color: name.trim() && target ? "#FFFFFF" : "var(--ink-dim)" }}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear meta"}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <IconPicker
          selectedIcon={icon}
          selectedColor={color}
          selectedStyle={iconStyle}
          onSelect={(newIcon, newColor) => { setIcon(newIcon); setColor(newColor); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>,
    document.body
  );
}
