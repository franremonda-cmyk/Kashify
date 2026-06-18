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
interface Category { id: string; name: string; icon?: string; color?: string }

interface Props {
  profile: Profile | null;
  phones: UserPhone[];
  email: string;
}

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP", "PYG", "PEN", "COP"];

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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", paddingLeft: 4 }}>{label}</p>
      <div className="glass p-4 flex flex-col gap-3" style={{ borderRadius: 16 }}>{children}</div>
    </div>
  );
}

function SaveButton({ onClick, saving, label = "Guardar" }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
      style={{ background: "var(--accent)", color: "#FFFFFF", flexShrink: 0 }}
    >
      {saving ? "..." : label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PerfilClient({ profile, phones, email }: Props) {
  const [displayName, setDisplayName]         = useState(profile?.display_name ?? "");
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primary_currency ?? "ARS");
  const [newPhone, setNewPhone]               = useState("");
  const [savingName, setSavingName]           = useState(false);
  const [savingCurrency, setSavingCurrency]   = useState(false);
  const [savedName, setSavedName]             = useState(false);
  const [savedCurrency, setSavedCurrency]     = useState(false);
  const [theme, setTheme] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("kashify-theme") ?? "arctic") : "arctic"
  );

  const { iconStyle, setIconStyle } = useIconStyle();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<Category | null | "new">(null);

  const supabase = createClient();

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
    setCatLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function applyTheme(t: string) {
    setTheme(t);
    localStorage.setItem("kashify-theme", t);
    if (t === "arctic") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
  }

  async function saveName() {
    if (!displayName.trim()) return;
    setSavingName(true);
    await supabase.from("profiles").update({ display_name: displayName.trim() })
      .eq("user_id", profile?.user_id ?? "");
    setSavingName(false);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  }

  async function saveCurrency() {
    setSavingCurrency(true);
    await supabase.from("profiles").update({ primary_currency: primaryCurrency })
      .eq("user_id", profile?.user_id ?? "");
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

  async function saveCategory(catId: string | null, patch: Partial<Category>) {
    if (catId) {
      await fetch(`/api/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } else {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }
    await fetchCategories();
  }

  async function deleteCategory(catId: string) {
    await fetch(`/api/categories/${catId}`, { method: "DELETE" });
    await fetchCategories();
  }

  const initials = (displayName || email || "K").slice(0, 1).toUpperCase();
  const existingColors = categories.map(c => c.color).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar + header */}
      <div className="flex items-center gap-4 enter-up">
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: "#FFFFFF",
          boxShadow: "0 4px 20px var(--accent-glow)",
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <h1 className="display font-semibold" style={{ fontSize: "1.2rem", color: "var(--ink)" }}>
            {displayName || "Sin nombre"}
          </h1>
          <p style={{ fontSize: 12, marginTop: 2, color: "var(--ink-dim)" }}>{email}</p>
        </div>
      </div>

      {/* Secciones / accesos rápidos */}
      <Section label="Secciones">
        {[
          { href: "/categorias", label: "Categorías", desc: "Editar y poner límites" },
          { href: "/cuotas",     label: "Cuotas",     desc: "Compras financiadas" },
          { href: "/metas",      label: "Metas de ahorro", desc: "Objetivos y progreso" },
        ].map((s) => (
          <Link key={s.href} href={s.href}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 12,
              background: "var(--raised)", border: "0.5px solid var(--glass-border)",
              textDecoration: "none",
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{s.label}</p>
              <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>{s.desc}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        ))}
      </Section>

      {/* Nombre */}
      <Section label="Nombre">
        <div className="flex gap-2">
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Tu nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
          />
          <SaveButton onClick={saveName} saving={savingName} label={savedName ? "Listo ✓" : "Guardar"} />
        </div>
      </Section>

      {/* Moneda principal */}
      <Section label="Moneda principal">
        <div className="flex gap-2">
          <select
            style={{ ...inp, flex: 1 }}
            value={primaryCurrency}
            onChange={(e) => setPrimaryCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <SaveButton onClick={saveCurrency} saving={savingCurrency} label={savedCurrency ? "Listo ✓" : "Guardar"} />
        </div>
      </Section>

      {/* Apariencia — tema + estilo de íconos */}
      <Section label="Apariencia">
        {/* Tema */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button key={t.id} onClick={() => applyTheme(t.id)}
                style={{
                  padding: "12px 14px", borderRadius: 12, textAlign: "left",
                  background: active ? "var(--accent-soft)" : "var(--raised)",
                  border: active ? `0.5px solid var(--accent-glow)` : "0.5px solid var(--glass-border)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
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

        {/* Divider */}
        <div style={{ height: "0.5px", background: "var(--glass-border)", margin: "2px 0" }} />

        {/* Estilo de íconos */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 8 }}>Estilo de íconos</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {ICON_STYLES.map((s) => {
              const active = iconStyle === s.id;
              return (
                <button key={s.id} onClick={() => setIconStyle(s.id)}
                  style={{
                    padding: "10px 12px", borderRadius: 12, textAlign: "left",
                    background: active ? "var(--accent-soft)" : "var(--raised)",
                    border: active ? `0.5px solid var(--accent-glow)` : "0.5px solid var(--glass-border)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--ink)" }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>{s.desc}</p>
                  </div>
                  {active && <div style={{ fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>✓</div>}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
          Los cambios se aplican al instante en toda la app.
        </p>
      </Section>

      {/* Mis categorías */}
      <Section label="Mis categorías">
        {catLoading ? (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "8px 0" }}>Cargando...</p>
        ) : categories.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Aún no tenés categorías personalizadas</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setEditingCat(cat)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 12,
                  background: "var(--raised)", border: "0.5px solid var(--glass-border)",
                  textAlign: "left", width: "100%",
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: (cat.color ?? "var(--accent)") + "22",
                  border: `1px solid ${cat.color ?? "var(--accent)"}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: cat.color ?? "var(--accent)",
                }}>
                  <CategoryIcon icon={cat.icon} name={cat.name} color={cat.color} size={18} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", flex: 1 }}>{cat.name}</span>
                {cat.color && <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setEditingCat("new")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: "var(--accent-soft)", border: "0.5px dashed var(--accent-glow)",
            color: "var(--accent)",
          }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nueva categoría
        </button>
      </Section>

      {/* WhatsApp vinculado */}
      <Section label="WhatsApp vinculado">
        {phones.length > 0 ? phones.map((p) => (
          <div key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: p.verified ? "var(--positive)" : "var(--warning)" }} />
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{p.phone_number}</span>
            </div>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
              background: p.verified ? "rgba(52,199,89,0.10)" : "rgba(255,149,0,0.10)",
              color: p.verified ? "var(--positive)" : "var(--warning)",
              border: `0.5px solid ${p.verified ? "rgba(52,199,89,0.25)" : "rgba(255,149,0,0.25)"}`,
            }}>
              {p.verified ? "verificado" : "pendiente"}
            </span>
          </div>
        )) : (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Ningún número vinculado</p>
        )}
        <div className="flex gap-2 pt-1" style={{ borderTop: "0.5px solid var(--glass-border-dim)" }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="+54 9 11 0000-0000"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            type="tel"
          />
          <button onClick={addPhone}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)", color: "var(--accent)", flexShrink: 0 }}>
            Agregar
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>
          Neo te enviará un código de verificación por WhatsApp.
        </p>
      </Section>

      {/* Cuenta */}
      <Section label="Cuenta">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>Email</p>
            <p style={{ fontSize: 13, marginTop: 2, color: "var(--ink)" }}>{email}</p>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--positive)", boxShadow: "0 0 6px rgba(52,199,89,0.35)" }} />
        </div>
      </Section>

      {/* Cerrar sesión */}
      <button onClick={signOut}
        style={{
          padding: "14px", borderRadius: 14, fontSize: 13, fontWeight: 600,
          background: "rgba(255,59,48,0.07)",
          color: "var(--negative)",
          border: "0.5px solid rgba(255,59,48,0.18)",
        }}>
        Cerrar sesión
      </button>

      {/* Category edit / create modal */}
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
            await deleteCategory(editingCat.id!);
          } : undefined}
          onClose={() => setEditingCat(null)}
        />
      )}
    </div>
  );
}
