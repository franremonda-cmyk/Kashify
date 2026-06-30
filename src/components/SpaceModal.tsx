"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_COLORS } from "@/lib/iconList";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import type { Space } from "@/types";

// Paleta de emojis para el espacio: elegir tocando (más confiable que un input
// de texto con maxLength, que rompe con emojis de >1 unidad UTF-16).
const SPACE_EMOJIS = ["💼", "🏠", "💰", "🎨", "🚀", "🛒", "🏢", "💻", "📊", "🎮", "✈️", "🍔", "❤️", "🎓", "🏦", "💡"];

const CURRENCIES: { code: string; label: string }[] = [
  { code: "ARS", label: "Peso argentino ($)" },
  { code: "USD", label: "Dólar (US$)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "CHF", label: "Franco suizo (Fr)" },
  { code: "BRL", label: "Real (R$)" },
  { code: "GBP", label: "Libra (£)" },
  { code: "UYU", label: "Peso uruguayo ($U)" },
  { code: "CLP", label: "Peso chileno (CLP$)" },
  { code: "MXN", label: "Peso mexicano (MX$)" },
  { code: "COP", label: "Peso colombiano (COL$)" },
];

export interface SpaceFormData {
  name: string;
  primary_currency: string;
  include_in_total: boolean;
  is_default: boolean;
  color: string;
  icon: string;
}

interface Props {
  space?: Space;
  onSave: (data: SpaceFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const inp: React.CSSProperties = {
  background: "var(--raised)", border: "0.5px solid var(--glass-border)", borderRadius: 12,
  padding: "12px 14px", color: "var(--ink)", fontSize: 14, width: "100%", outline: "none",
};

const label: React.CSSProperties = { fontSize: 13, color: "var(--ink-muted)", marginBottom: 6 };

export default function SpaceModal({ space, onSave, onDelete, onClose }: Props) {
  const isNew = !space?.id;
  const [name, setName] = useState(space?.name ?? "");
  const [currency, setCurrency] = useState(space?.primary_currency ?? "ARS");
  const [includeInTotal, setIncludeInTotal] = useState(space?.include_in_total ?? true);
  const [isDefault, setIsDefault] = useState(space?.is_default ?? false);
  const [color, setColor] = useState(space?.color ?? "#46B58C");
  const [icon, setIcon] = useState(space?.icon ?? "💼");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), primary_currency: currency, include_in_total: includeInTotal, is_default: isDefault, color, icon: icon || "💼" });
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    await onDelete();
    setSaving(false);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", padding: "20px 16px", touchAction: "none" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong" style={{ width: "100%", maxWidth: 400, borderRadius: 20, maxHeight: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0", flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{isNew ? "Nuevo espacio" : "Editar espacio"}</p>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12 }}>✕</button>
        </div>

        <div ref={scrollRef} style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", touchAction: "pan-y" }}>
          {/* Ícono + color */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: color + "22", border: `1.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
              {icon || "💼"}
            </div>
            <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
                  style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--ink)" : "2px solid transparent", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
              ))}
            </div>
          </div>

          {/* Paleta de emojis (tocar para elegir) */}
          <div>
            <p style={label}>Ícono</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
              {SPACE_EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setIcon(e)} aria-label={`Ícono ${e}`} aria-pressed={icon === e}
                  style={{ aspectRatio: "1", borderRadius: 10, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                    background: icon === e ? "var(--accent-soft)" : "var(--raised)",
                    border: icon === e ? "1px solid var(--accent)" : "0.5px solid var(--glass-border)" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={label}>Nombre</p>
            <input style={inp} placeholder="Freelance, Sonic Art…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
          </div>

          <div>
            <p style={label}>Moneda principal</p>
            <select style={inp} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>

          <Toggle
            checked={includeInTotal}
            onChange={setIncludeInTotal}
            title="Sumar al total personal"
            subtitle="Si lo apagás, este espacio queda aislado y no afecta tu balance personal."
          />

          <Toggle
            checked={isDefault}
            onChange={setIsDefault}
            title="Espacio por defecto"
            subtitle="Donde caen los registros de WhatsApp si no elegís otro."
          />

          <button onClick={handleSave} disabled={!name.trim() || saving}
            style={{ padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: name.trim() ? "var(--accent)" : "var(--raised)", color: name.trim() ? "#FFFFFF" : "var(--ink-dim)" }}>
            {saving ? "Guardando..." : isNew ? "Crear espacio" : "Guardar cambios"}
          </button>

          {!isNew && onDelete && (
            confirmDel ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.25)" }}>Sí, eliminar</button>
                <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} style={{ padding: "10px", borderRadius: 12, fontSize: 12, color: "var(--negative)", background: "transparent", border: "0.5px solid var(--glass-border)" }}>Eliminar espacio</button>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Toggle({ checked, onChange, title, subtitle }: { checked: boolean; onChange: (v: boolean) => void; title: string; subtitle: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="press"
      style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "4px 0" }}>
      <div style={{ width: 44, height: 26, borderRadius: 999, flexShrink: 0, background: checked ? "var(--accent)" : "var(--raised)", border: "0.5px solid var(--glass-border)", position: "relative", transition: "background 160ms ease-out" }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 160ms ease-out" }} />
      </div>
      <div>
        <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{title}</p>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>{subtitle}</p>
      </div>
    </button>
  );
}
