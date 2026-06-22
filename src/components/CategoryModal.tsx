"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
const IconPicker = dynamic(() => import("@/components/IconPicker"), { ssr: false });
import CategoryIcon from "@/components/CategoryIcon";
import { suggestColor, CATEGORY_COLORS } from "@/lib/iconList";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";
import type { IconStyle } from "@/context/IconStyleContext";

export interface CategoryData {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
}

interface Props {
  cat?: CategoryData;
  existingColors: string[];
  currentStyle: IconStyle;
  onSave: (cat: Partial<CategoryData>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

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

export default function CategoryModal({ cat, existingColors, currentStyle, onSave, onDelete, onClose }: Props) {
  const isNew = !cat?.id;
  const [name, setName]             = useState(cat?.name ?? "");
  const [icon, setIcon]             = useState(cat?.icon ?? "");
  const [color, setColor]           = useState(cat?.color ?? suggestColor(existingColors));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), icon: icon || undefined, color: color || undefined });
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
    <>
      <div
        ref={overlayRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
          zIndex: 9100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.72)",
          padding: "20px 16px",
          touchAction: "none",
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{
            width: "100%", maxWidth: 400,
            borderRadius: 20,
            background: "var(--base)",
            border: "0.5px solid var(--glass-border)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.40)",
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0", flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              {isNew ? "Nueva categoría" : "Editar categoría"}
            </p>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", touchAction: "pan-y" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={() => setShowPicker(true)}
                style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: icon ? color + "22" : "var(--raised)", border: icon ? `1.5px solid ${color}` : "1.5px dashed var(--glass-border-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: icon ? color : "var(--ink-dim)", fontSize: 24 }}>
                {icon ? <CategoryIcon icon={icon} color={color} size={28} style={currentStyle} /> : <span style={{ fontSize: 22 }}>＋</span>}
              </button>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 4 }}>
                  {icon ? "Toca para cambiar el ícono" : "Toca para elegir un ícono"}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? `3px solid var(--ink)` : "2px solid transparent", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 1, transition: "all 100ms ease-out" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <input
              style={inp}
              placeholder="Nombre de la categoría"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />

            <button onClick={handleSave} disabled={!name.trim() || saving}
              style={{ padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: name.trim() ? "var(--accent)" : "var(--raised)", color: name.trim() ? "#FFFFFF" : "var(--ink-dim)", transition: "all 160ms ease-out" }}>
              {saving ? "Guardando..." : isNew ? "Crear categoría" : "Guardar cambios"}
            </button>

            {!isNew && onDelete && (
              confirmDel ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.25)" }}>Sí, eliminar</button>
                  <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} style={{ padding: "10px", borderRadius: 12, fontSize: 12, color: "var(--negative)", background: "transparent", border: "0.5px solid var(--glass-border)" }}>Eliminar categoría</button>
              )
            )}
          </div>
        </div>
      </div>

      {showPicker && (
        <IconPicker
          selectedIcon={icon}
          selectedColor={color}
          selectedStyle={currentStyle}
          existingColors={existingColors}
          onSelect={(newIcon, newColor) => { setIcon(newIcon); setColor(newColor); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>,
    document.body
  );
}
