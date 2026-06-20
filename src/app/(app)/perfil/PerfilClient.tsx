"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useIconStyle } from "@/context/IconStyleContext";
import type { IconStyle } from "@/context/IconStyleContext";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryModal from "@/components/CategoryModal";
import type { Profile } from "@/types";

interface UserPhone { id: string; phone_number: string; verified: boolean }
interface Category  { id: string; name: string; icon?: string; color?: string }
interface Budget    {
  id: string;
  category_id: string;
  monthly_limit: number;
  currency_code: string;
  period_type?: "always" | "specific_months";
  applies_months?: number[] | null;
  categories?: { name: string; color: string; icon: string } | null;
}

interface Props {
  profile: Profile | null;
  phones: UserPhone[];
  email: string;
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CURRENCIES = ["ARS","USD","EUR","CHF","BRL","UYU","CLP","GBP","PYG","PEN","COP"];
const THEMES = [
  { id: "arctic",   label: "Arctic",   desc: "Blanco + violeta",  preview: "#7B61FF" },
  { id: "midnight", label: "Midnight", desc: "Azul noche",        preview: "#0A84FF" },
  { id: "void",     label: "Void",     desc: "Negro total",       preview: "#30D158" },
  { id: "sand",     label: "Sand",     desc: "Cálido + tierra",   preview: "#C8820A" },
] as const;
const ICON_STYLES: { id: IconStyle; label: string; desc: string }[] = [
  { id: "line",    label: "Línea",   desc: "Trazo fino" },
  { id: "solid",   label: "Sólido",  desc: "Relleno" },
  { id: "duotone", label: "Duotone", desc: "Bicolor" },
  { id: "emoji",   label: "Emoji",   desc: "Clásico" },
];

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

function Accordion({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 16, border: "0.5px solid var(--glass-border)", background: "var(--base)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "transparent", textAlign: "left" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</p>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ color: "var(--ink-dim)", transition: "transform 200ms ease-out", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12, borderTop: "0.5px solid var(--glass-border-dim)" }}>
          <div style={{ height: 4 }} />
          {children}
        </div>
      )}
    </div>
  );
}

function SaveButton({ onClick, saving, label = "Guardar" }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", flexShrink: 0, opacity: saving ? 0.5 : 1 }}>
      {saving ? "..." : label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: "0.5px", background: "var(--glass-border-dim)", margin: "0 -4px" }} />;
}

export default function PerfilClient({ profile, phones, email }: Props) {
  const [displayName, setDisplayName]       = useState(profile?.display_name ?? "");
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primary_currency ?? "ARS");
  const [newPhone, setNewPhone]             = useState("");
  const [savingName, setSavingName]         = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savedName, setSavedName]           = useState(false);
  const [savedCurrency, setSavedCurrency]   = useState(false);
  const [inviteCopied, setInviteCopied]     = useState(false);
  const [theme, setTheme] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("kashify-theme") ?? "arctic") : "arctic"
  );
  const { iconStyle, setIconStyle } = useIconStyle();

  // Categorías
  const [categories, setCategories]     = useState<Category[]>([]);
  const [catLoading, setCatLoading]     = useState(true);
  const [editingCat, setEditingCat]     = useState<Category | null | "new">(null);

  // Límites
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [budgetEdits, setBudgetEdits]   = useState<Record<string, { period_type: "always" | "specific_months"; applies_months: number[] }>>({});
  const [savingBudget, setSavingBudget] = useState<string | null>(null);

  // Sub-secciones del acordeón Categorías
  const [showMisCats, setShowMisCats]   = useState(false);
  const [showLimits, setShowLimits]     = useState(false);

  // Metas y cuotas (vista previa inline)
  const [goals, setGoals] = useState<import("@/types").SavingsGoal[]>([]);
  const [plans, setPlans] = useState<(import("@/types").InstallmentPlan & { installment_payments?: { status: string }[] })[]>([]);

  const supabase = createClient();

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
    setCatLoading(false);
  }, []);

  const fetchBudgets = useCallback(async () => {
    const res = await fetch("/api/budgets");
    if (res.ok) {
      const data: Budget[] = await res.json();
      setBudgets(data);
      const edits: Record<string, { period_type: "always" | "specific_months"; applies_months: number[] }> = {};
      for (const b of data) {
        edits[b.id] = { period_type: b.period_type ?? "always", applies_months: b.applies_months ?? [] };
      }
      setBudgetEdits(edits);
    }
  }, []);

  useEffect(() => { fetchCategories(); fetchBudgets(); }, [fetchCategories, fetchBudgets]);

  useEffect(() => {
    fetch("/api/goals").then(r => r.ok ? r.json() : []).then(d => setGoals(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/installments").then(r => r.ok ? r.json() : []).then(d => setPlans(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function applyTheme(t: string) {
    setTheme(t);
    localStorage.setItem("kashify-theme", t);
    if (t === "arctic") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  async function saveName() {
    if (!displayName.trim()) return;
    setSavingName(true);
    await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("user_id", profile?.user_id ?? "");
    setSavingName(false);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  }

  async function saveCurrency() {
    setSavingCurrency(true);
    await supabase.from("profiles").update({ primary_currency: primaryCurrency }).eq("user_id", profile?.user_id ?? "");
    setSavingCurrency(false);
    setSavedCurrency(true);
    setTimeout(() => setSavedCurrency(false), 2000);
  }

  async function addPhone() {
    if (!newPhone.trim()) return;
    await supabase.from("user_phones").insert({ phone_number: newPhone.trim(), verified: false });
    setNewPhone("");
    window.location.reload();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function inviteFriend() {
    const url = typeof window !== "undefined" ? window.location.origin : "https://kashify.vercel.app";
    const text = "Manejá tus finanzas por WhatsApp con Neo. Probá Kashify 👇";
    // Web Share API → menú nativo de compartir (WhatsApp, Mensajes, etc.) en mobile.
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Kashify", text, url }); } catch { /* usuario canceló */ }
      return;
    }
    // Fallback: copiar el link al portapapeles.
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch { /* sin clipboard disponible */ }
  }

  async function saveCategory(catId: string | null, patch: Partial<Category>) {
    if (catId) {
      await fetch(`/api/categories/${catId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } else {
      await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    }
    await fetchCategories();
  }

  async function deleteCategory(catId: string) {
    await fetch(`/api/categories/${catId}`, { method: "DELETE" });
    await fetchCategories();
  }

  async function saveBudgetPeriod(budget: Budget) {
    const edit = budgetEdits[budget.id];
    if (!edit) return;
    setSavingBudget(budget.id);
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: budget.category_id,
        monthly_limit: budget.monthly_limit,
        currency_code: budget.currency_code,
        period_type: edit.period_type,
        applies_months: edit.period_type === "specific_months" ? edit.applies_months : null,
      }),
    });
    setSavingBudget(null);
    fetchBudgets();
  }

  function toggleMonth(budgetId: string, month: number) {
    setBudgetEdits((prev) => {
      const curr = prev[budgetId] ?? { period_type: "specific_months", applies_months: [] };
      const months = curr.applies_months.includes(month)
        ? curr.applies_months.filter((m) => m !== month)
        : [...curr.applies_months, month];
      return { ...prev, [budgetId]: { ...curr, applies_months: months } };
    });
  }

  const initials = (displayName || email || "K").slice(0, 1).toUpperCase();
  const existingColors = categories.map(c => c.color).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar header */}
      <div className="flex items-center gap-4 enter-up">
        <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#FFFFFF", boxShadow: "0 4px 20px var(--accent-glow)", flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <h1 className="display font-semibold" style={{ fontSize: "1.2rem", color: "var(--ink)" }}>
            {displayName || "Sin nombre"}
          </h1>
          <p style={{ fontSize: 12, marginTop: 2, color: "var(--ink-dim)" }}>{email}</p>
        </div>
      </div>

      {/* ① Datos personales + Cuenta */}
      <Accordion label="Datos personales">
        {/* Nombre */}
        <div>
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 8 }}>Nombre y apellido</p>
          <div className="flex gap-2">
            <input style={{ ...inp, flex: 1 }} placeholder="Tu nombre"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()} />
            <SaveButton onClick={saveName} saving={savingName} label={savedName ? "✓" : "Guardar"} />
          </div>
        </div>

        <Divider />

        {/* Moneda */}
        <div>
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 8 }}>Moneda principal</p>
          <div className="flex gap-2">
            <select style={{ ...inp, flex: 1 }} value={primaryCurrency} onChange={(e) => setPrimaryCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <SaveButton onClick={saveCurrency} saving={savingCurrency} label={savedCurrency ? "✓" : "Guardar"} />
          </div>
        </div>

        <Divider />

        {/* WhatsApp */}
        <div>
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 8 }}>WhatsApp vinculado</p>
          {phones.length > 0 ? phones.map((p) => (
            <div key={p.id} className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: p.verified ? "var(--positive)" : "var(--warning)" }} />
                <span style={{ fontSize: 13, color: "var(--ink)" }}>{p.phone_number}</span>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600, background: p.verified ? "rgba(52,199,89,0.10)" : "rgba(255,149,0,0.10)", color: p.verified ? "var(--positive)" : "var(--warning)", border: `0.5px solid ${p.verified ? "rgba(52,199,89,0.25)" : "rgba(255,149,0,0.25)"}` }}>
                {p.verified ? "verificado" : "pendiente"}
              </span>
            </div>
          )) : <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>Ningún número vinculado</p>}
          <div className="flex gap-2">
            <input style={{ ...inp, flex: 1 }} placeholder="+54 9 11 0000-0000" value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)} type="tel" />
            <button onClick={addPhone}
              style={{ padding: "0 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)", flexShrink: 0 }}>
              Agregar
            </button>
          </div>
        </div>

        <Divider />

        {/* Cuenta (email + badge) */}
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>Cuenta</p>
            <p style={{ fontSize: 13, marginTop: 2, color: "var(--ink)" }}>{email}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--positive)", boxShadow: "0 0 6px rgba(52,199,89,0.35)" }} />
            <span style={{ fontSize: 10, color: "var(--positive)", fontWeight: 600 }}>activa</span>
          </div>
        </div>
      </Accordion>

      {/* ② Apariencia */}
      <Accordion label="Apariencia">
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)" }}>Tema</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button key={t.id} onClick={() => applyTheme(t.id)}
                style={{ padding: "12px 14px", borderRadius: 12, textAlign: "left", background: active ? "var(--accent-soft)" : "var(--raised)", border: active ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.preview, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--ink)" }}>{t.label}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>{t.desc}</p>
                </div>
                {active && <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--accent)" }}>✓</div>}
              </button>
            );
          })}
        </div>
        <Divider />
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)" }}>Estilo de íconos</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ICON_STYLES.map((s) => {
            const active = iconStyle === s.id;
            return (
              <button key={s.id} onClick={() => setIconStyle(s.id)}
                style={{ padding: "10px 12px", borderRadius: 12, textAlign: "left", background: active ? "var(--accent-soft)" : "var(--raised)", border: active ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--ink)" }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>{s.desc}</p>
                </div>
                {active && <div style={{ fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>✓</div>}
              </button>
            );
          })}
        </div>
      </Accordion>

      {/* ③ Categorías + Límites */}
      <Accordion label="Categorías">
        {/* Sub-botón: Mis categorías */}
        <div style={{ borderRadius: 12, border: "0.5px solid var(--glass-border)", overflow: "hidden" }}>
          <button
            onClick={() => setShowMisCats(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--raised)", textAlign: "left" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Mis categorías</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: "var(--ink-dim)", transition: "transform 200ms", transform: showMisCats ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showMisCats && (
            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, borderTop: "0.5px solid var(--glass-border-dim)" }}>
              {catLoading ? (
                <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "8px 0" }}>Cargando...</p>
              ) : categories.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Aún no tenés categorías</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setEditingCat(cat)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "var(--base)", border: "0.5px solid var(--glass-border)", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: (cat.color ?? "var(--accent)") + "22", border: `1px solid ${cat.color ?? "var(--accent)"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color ?? "var(--accent)" }}>
                        <CategoryIcon icon={cat.icon} name={cat.name} color={cat.color} size={15} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", flex: 1 }}>{cat.name}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setEditingCat("new")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px dashed var(--accent-glow)", color: "var(--accent)" }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nueva categoría
              </button>
            </div>
          )}
        </div>

        {/* Sub-botón: Configurar límite por categoría */}
        <div style={{ borderRadius: 12, border: "0.5px solid var(--glass-border)", overflow: "hidden" }}>
          <button
            onClick={() => setShowLimits(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--raised)", textAlign: "left" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Configurar límite por categoría</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: "var(--ink-dim)", transition: "transform 200ms", transform: showLimits ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showLimits && (
            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10, borderTop: "0.5px solid var(--glass-border-dim)" }}>
              {budgets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>No hay límites configurados</p>
                  <Link href="/categorias" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600, display: "inline-block", marginTop: 6 }}>
                    + Agregar límite →
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {budgets.map((b) => {
                    const edit = budgetEdits[b.id] ?? { period_type: "always", applies_months: [] };
                    return (
                      <div key={b.id} style={{ borderRadius: 12, border: "0.5px solid var(--glass-border)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, background: "var(--base)" }}>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: (b.categories?.color ?? "var(--accent)") + "22", border: `1px solid ${b.categories?.color ?? "var(--accent)"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: b.categories?.color ?? "var(--accent)" }}>
                            <CategoryIcon icon={b.categories?.icon} name={b.categories?.name ?? ""} color={b.categories?.color} size={15} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{b.categories?.name ?? "—"}</p>
                            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>{b.currency_code} {b.monthly_limit.toLocaleString("es-AR")}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(["always", "specific_months"] as const).map((pt) => (
                            <button key={pt}
                              onClick={() => setBudgetEdits((prev) => ({ ...prev, [b.id]: { ...edit, period_type: pt } }))}
                              style={{ flex: 1, padding: "7px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: edit.period_type === pt ? "var(--accent-soft)" : "var(--raised)", border: edit.period_type === pt ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: edit.period_type === pt ? "var(--accent)" : "var(--ink-muted)" }}>
                              {pt === "always" ? "Siempre" : "Meses específicos"}
                            </button>
                          ))}
                        </div>
                        {edit.period_type === "specific_months" && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                            {MONTHS.map((m, i) => {
                              const month = i + 1;
                              const selected = edit.applies_months.includes(month);
                              return (
                                <button key={m} onClick={() => toggleMonth(b.id, month)}
                                  style={{ padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 600, background: selected ? "var(--accent-soft)" : "var(--raised)", border: selected ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)", color: selected ? "var(--accent)" : "var(--ink-dim)" }}>
                                  {m}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button onClick={() => saveBudgetPeriod(b)} disabled={savingBudget === b.id}
                          style={{ padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: savingBudget === b.id ? 0.6 : 1 }}>
                          {savingBudget === b.id ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    );
                  })}
                  <Link href="/categorias"
                    style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", border: "0.5px dashed var(--accent-glow)", textDecoration: "none" }}>
                    + Agregar límite
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </Accordion>

      {/* ④ Metas de ahorro */}
      <Accordion label="Metas de ahorro">
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Seguí el progreso de tus objetivos de ahorro.</p>
        {goals.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
              const reached = g.status === "reached" || g.current_amount >= g.target_amount;
              return (
                <Link key={g.id} href="/metas"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "var(--raised)", border: "0.5px solid var(--glass-border)", textDecoration: "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: (g.color ?? "var(--accent)") + "22", border: `1px solid ${g.color ?? "var(--accent)"}33`, display: "flex", alignItems: "center", justifyContent: "center", color: g.color ?? "var(--accent)" }}>
                    <CategoryIcon icon={g.icon} name={g.name} color={g.color} size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{g.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: reached ? "var(--positive)" : "var(--ink-muted)", flexShrink: 0 }}>{reached ? "✓ Lograda" : `${pct.toFixed(0)}%`}</span>
                    </div>
                    <div style={{ width: "100%", height: 4, borderRadius: 999, background: "var(--base)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: reached ? "var(--positive)" : (g.color ?? "var(--accent)") }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Link href="/metas?new=1"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px dashed var(--accent-glow)", color: "var(--accent)", textDecoration: "none" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nueva meta
        </Link>
      </Accordion>

      {/* ⑤ Cuotas */}
      <Accordion label="Cuotas">
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Administrá tus compras en cuotas.</p>
        {plans.filter(p => p.status === "active").length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plans.filter(p => p.status === "active").map((plan) => {
              const payments = plan.installment_payments ?? [];
              const paidCount = payments.filter(p => p.status === "paid").length;
              const pct = plan.n_installments > 0 ? (paidCount / plan.n_installments) * 100 : 0;
              return (
                <Link key={plan.id} href="/cuotas"
                  style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: "var(--raised)", border: "0.5px solid var(--glass-border)", textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{plan.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>cuota {Math.min(paidCount + 1, plan.n_installments)}/{plan.n_installments}</span>
                  </div>
                  <div style={{ width: "100%", height: 4, borderRadius: 999, background: "var(--base)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--accent)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Link href="/cuotas?new=1"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent-soft)", border: "0.5px dashed var(--accent-glow)", color: "var(--accent)", textDecoration: "none" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nueva cuota
        </Link>
      </Accordion>

      {/* Invitar amigo — arriba de cerrar sesión */}
      <button
        onClick={inviteFriend}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent)", border: "0.5px solid var(--accent-glow)", marginTop: 4 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
        {inviteCopied ? "¡Link copiado!" : "Invitar amigo"}
      </button>

      {/* Botón cerrar sesión — fuera de acordeones */}
      <button
        onClick={signOut}
        style={{ padding: "14px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "rgba(255,59,48,0.07)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}>
        Cerrar sesión
      </button>

      {/* Category modal */}
      {editingCat !== null && (
        <CategoryModal
          cat={editingCat === "new" ? undefined : editingCat}
          existingColors={existingColors}
          currentStyle={iconStyle}
          onSave={async (patch) => {
            const catId = editingCat === "new" ? null : editingCat.id;
            await saveCategory(catId, patch as Partial<Category>);
          }}
          onDelete={editingCat !== "new" ? async () => {
            await deleteCategory((editingCat as Category).id!);
          } : undefined}
          onClose={() => setEditingCat(null)}
        />
      )}
    </div>
  );
}
