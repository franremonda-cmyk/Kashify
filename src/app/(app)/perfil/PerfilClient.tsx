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

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "GBP"];

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--ink)",
  fontSize: 14,
  width: "100%",
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>{label}</p>
      <div className="glass p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function PerfilClient({ profile, phones, email }: Props) {
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primary_currency ?? "ARS");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function saveCurrency() {
    setSaving(true);
    await supabase.from("profiles").update({ primary_currency: primaryCurrency }).eq("user_id", profile?.user_id ?? "");
    setSaving(false);
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Perfil</h1>

      <Section label="Cuenta">
        <p className="text-sm font-medium">{profile?.display_name}</p>
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{email}</p>
      </Section>

      <Section label="Moneda principal">
        <div className="flex gap-2">
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={primaryCurrency}
            onChange={(e) => setPrimaryCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={saveCurrency}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? "..." : "Guardar"}
          </button>
        </div>
      </Section>

      <Section label="WhatsApp vinculado">
        {phones.map((p) => (
          <div key={p.id} className="flex items-center justify-between">
            <span className="text-sm">{p.phone_number}</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: p.verified ? "oklch(0.70 0.14 155 / 0.15)" : "oklch(0.78 0.12 80 / 0.15)",
                color: p.verified ? "var(--accent-green)" : "var(--accent-yellow)",
              }}
            >
              {p.verified ? "verificado" : "pendiente"}
            </span>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="+54911..."
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <button
            onClick={addPhone}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            +
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          Neo te enviará un código de verificación por WhatsApp
        </p>
      </Section>

      <button
        onClick={signOut}
        className="py-3 rounded-lg text-sm font-medium"
        style={{
          background: "oklch(0.60 0.18 22 / 0.10)",
          color: "var(--accent-red)",
          border: "1px solid oklch(0.60 0.18 22 / 0.20)",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
