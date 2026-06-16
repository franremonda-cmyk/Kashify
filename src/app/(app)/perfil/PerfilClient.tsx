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

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--text-primary)",
    fontSize: 14,
    width: "100%",
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Perfil</h1>

      <div className="glass p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>CUENTA</p>
        <p className="text-sm">{profile?.display_name}</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{email}</p>
      </div>

      <div className="glass p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>MONEDA PRINCIPAL</p>
        <div className="flex gap-2">
          <select style={{ ...inputStyle, flex: 1 }} value={primaryCurrency}
            onChange={(e) => setPrimaryCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={saveCurrency}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? "..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="glass p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>WHATSAPP VINCULADO</p>
        {phones.map((p) => (
          <div key={p.id} className="flex items-center justify-between">
            <span className="text-sm">{p.phone_number}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: p.verified ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)",
                color: p.verified ? "var(--accent-green)" : "var(--accent-yellow)",
              }}>
              {p.verified ? "verificado" : "pendiente"}
            </span>
          </div>
        ))}
        <div className="flex gap-2">
          <input style={{ ...inputStyle, flex: 1 }} placeholder="+54911..." value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)} />
          <button onClick={addPhone} className="px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#fff" }}>+</button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Neo te enviará un código de verificación por WhatsApp
        </p>
      </div>

      <button onClick={signOut}
        className="py-3 rounded-xl text-sm font-medium"
        style={{ background: "rgba(239,68,68,0.1)", color: "var(--accent-red)" }}>
        Cerrar sesión
      </button>
    </div>
  );
}
