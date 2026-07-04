"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ICON_GROUPS, CATEGORY_COLORS, type IconDef } from "@/lib/iconList";
import type { IconStyle } from "@/context/IconStyleContext";

const STYLE_TABS: { id: IconStyle; label: string; desc: string }[] = [
  { id: "line",    label: "Línea",   desc: "Trazo fino" },
  { id: "solid",   label: "Sólido",  desc: "Relleno" },
  { id: "duotone", label: "Duotone", desc: "Bicolor" },
  { id: "emoji",   label: "Emoji",   desc: "Clásico" },
];

interface Props {
  selectedIcon?: string;
  selectedColor?: string;
  selectedStyle?: IconStyle;
  existingColors?: string[];
  zIndex?: number;
  onSelect: (icon: string, color: string, style: IconStyle) => void;
  onClose: () => void;
}

function PreviewIcon({ def, style, color, size = 22 }: { def: IconDef; style: IconStyle; color: string; size?: number }) {
  const { Component } = def;
  if (style === "emoji")   return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{def.emoji}</span>;
  if (style === "solid")   return <Component size={size} weight="fill" />;
  if (style === "duotone") return <Component size={size} weight="duotone" color={color} />;
  return <Component size={size} weight="light" />;
}

export default function IconPicker({ selectedIcon, selectedColor, selectedStyle = "line", existingColors = [], zIndex = 9200, onSelect, onClose }: Props) {
  const [style, setStyle]       = useState<IconStyle>(selectedStyle);
  const [search, setSearch]     = useState("");
  const [pickedIcon, setPickedIcon] = useState(selectedIcon ?? "");
  const [pickedColor, setPickedColor] = useState(() => {
    if (selectedColor) return selectedColor;
    const used = new Set(existingColors.map(c => c.toLowerCase()));
    return CATEGORY_COLORS.find(c => !used.has(c.toLowerCase())) ?? CATEGORY_COLORS[0];
  });
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      // Allow native scroll inside the icon grid
      if (scrollRef.current && e.target instanceof Node && scrollRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [mounted]);

  const query = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!query) return ICON_GROUPS;
    return ICON_GROUPS
      .map(g => ({ ...g, icons: g.icons.filter(i => i.label.toLowerCase().includes(query) || i.id.includes(query)) }))
      .filter(g => g.icons.length > 0);
  }, [query]);

  function confirmSelect() {
    if (!pickedIcon) return;
    onSelect(pickedIcon, pickedColor, style);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
        zIndex,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        padding: "20px 16px calc(88px + env(safe-area-inset-bottom, 0px))",
        touchAction: "none",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Elegir ícono"
        className="w-full max-w-sm flex flex-col"
        style={{
          borderRadius: 20,
          background: "var(--base)",
          border: "0.5px solid var(--glass-border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.40)",
          maxHeight: "100%",
          minHeight: 0,
        }}
      >
        {/* Fixed top area */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 4 }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 0" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Elegir ícono</p>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>

          {/* Style tabs */}
          <div style={{ display: "flex", gap: 6, padding: "12px 18px 0", overflowX: "auto", scrollbarWidth: "none" }}>
            {STYLE_TABS.map(t => (
              <button key={t.id} onClick={() => setStyle(t.id)}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: style === t.id ? "var(--accent)" : "var(--raised)", color: style === t.id ? "#04130D" : "var(--ink-muted)", border: style === t.id ? "none" : "0.5px solid var(--glass-border)", transition: "all 160ms ease-out" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: "10px 18px 0" }}>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-dim)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ícono…"
                type="search" aria-label="Buscar ícono" autoComplete="off"
                style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "var(--raised)", border: "0.5px solid var(--glass-border)", borderRadius: 12, fontSize: 13, color: "var(--ink)", outline: "none" }}
              />
            </div>
          </div>

          {/* Color palette */}
          <div style={{ padding: "10px 18px 0" }}>
            <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8 }}>Color</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORY_COLORS.map(c => (
                <button key={c} onClick={() => setPickedColor(c)}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: c, flexShrink: 0, border: pickedColor === c ? `3px solid var(--ink)` : "2px solid transparent", outline: pickedColor === c ? `2px solid ${c}` : "none", outlineOffset: 1, transition: "all 120ms ease-out" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable icon grid */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px 18px 0", touchAction: "pan-y" }}
        >
          {filteredGroups.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: "24px 0" }}>Sin resultados</p>
          )}
          {filteredGroups.map(g => (
            <div key={g.group} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8 }}>{g.group}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {g.icons.map(icon => {
                  const isSelected = pickedIcon === icon.id;
                  return (
                    <button key={icon.id} onClick={() => setPickedIcon(icon.id)} title={icon.label}
                      style={{ aspectRatio: "1", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: isSelected ? pickedColor + "22" : "var(--raised)", border: isSelected ? `1.5px solid ${pickedColor}` : "0.5px solid var(--glass-border)", color: isSelected ? pickedColor : "var(--ink-muted)", transition: "all 140ms ease-out" }}>
                      <PreviewIcon def={icon} style={style} color={pickedColor} size={20} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Confirm button */}
        <div style={{ flexShrink: 0, padding: "10px 18px 16px" }}>
          <button onClick={confirmSelect} disabled={!pickedIcon}
            style={{ width: "100%", padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: pickedIcon ? "var(--accent)" : "var(--raised)", color: pickedIcon ? "#04130D" : "var(--ink-dim)", transition: "all 160ms ease-out" }}>
            {pickedIcon ? "Confirmar ícono" : "Seleccioná un ícono"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
