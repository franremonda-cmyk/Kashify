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

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
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
      <p className="text-xs font-medium px-1" style={{ color: "var(--ink-muted)" }}>{label}</p>
      <div className="glass p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function SaveButton({ onClick, saving, label = "Guardar" }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
      style={{ background: "var(--accent)", color: "#060C09", flexShrink: 0 }}
    >
      {saving ? "..." : label}
    </button>
  );
}

export default function PerfilClient({ profile, phones, email }: Props) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primary_currency ?? "ARS");
  const [newPhone, setNewPhone] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savedCurrency, setSavedCurrency] = useState(false);

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
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--accent), rgba(0,200,83,0.4))",
            color: "#060C09",
            boxShadow: "0 0 24px var(--accent-glow)",
          }}
        >
          {initials}
        </div>
        <div>
          <h1 className="display font-semibold" style={{ fontSize: "1.2rem", color: "var(--ink)" }}>
            {displayName || "Sin nombre"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{email}</p>
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
          <SaveButton
            onClick={saveName}
            saving={savingName}
            label={savedName ? "Listo" : "Guardar"}
          />
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
          <SaveButton
            onClick={saveCurrency}
            saving={savingCurrency}
            label={savedCurrency ? "Listo" : "Guardar"}
          />
        </div>
      </Section>

      {/* WhatsApp */}
      <Section label="WhatsApp vinculado">
        {phones.length > 0 ? phones.map((p) => (
          <div key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.verified ? "var(--accent)" : "var(--warning)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>{p.phone_number}</span>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: p.verified ? "rgba(0,200,83,0.12)" : "rgba(255,179,0,0.12)",
                color: p.verified ? "var(--accent)" : "var(--warning)",
              }}
            >
              {p.verified ? "verificado" : "pendiente"}
            </span>
          </div>
        )) : (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>Ningún número vinculado</p>
        )}
        <div className="flex gap-2 pt-1" style={{ borderTop: "0.5px solid var(--glass-border-dim)" }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="+54 9 11 0000-0000"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            type="tel"
          />
          <button
            onClick={addPhone}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--glass-2)", border: "0.5px solid var(--glass-border-hover)", color: "var(--accent)", flexShrink: 0 }}
          >
            Agregar
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          Neo te enviará un código de verificación por WhatsApp
        </p>
      </Section>

      {/* Sobre la cuenta */}
      <Section label="Cuenta">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Email</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink)" }}>{email}</p>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }}
          />
        </div>
      </Section>

      {/* Cerrar sesión */}
      <button
        onClick={signOut}
        className="py-3.5 rounded-xl text-sm font-medium"
        style={{
          background: "rgba(255,83,112,0.08)",
          color: "var(--negative)",
          border: "0.5px solid rgba(255,83,112,0.20)",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
