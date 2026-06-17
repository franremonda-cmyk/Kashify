"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

interface UserPhone { id: string; phone_number: string; verified: boolean }

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

export default function PerfilClient({ profile, phones, email }: Props) {
  const [displayName, setDisplayName]     = useState(profile?.display_name ?? "");
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primary_currency ?? "ARS");
  const [newPhone, setNewPhone]           = useState("");
  const [savingName, setSavingName]       = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savedName, setSavedName]         = useState(false);
  const [savedCurrency, setSavedCurrency] = useState(false);
  const [theme, setTheme] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("kashify-theme") ?? "arctic") : "arctic"
  );

  function applyTheme(t: string) {
    setTheme(t);
    localStorage.setItem("kashify-theme", t);
    if (t === "arctic") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
  }

  const supabase = createClient();

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

  const initials = (displayName || email || "K").slice(0, 1).toUpperCase();

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

      {/* Tema */}
      <Section label="Apariencia">
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
                {active && (
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--accent)" }}>✓</div>
                )}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
          El cambio se aplica al instante en toda la app.
        </p>
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
    </div>
  );
}
