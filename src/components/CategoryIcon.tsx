"use client";
import { useState, useEffect, type ComponentType } from "react";
import { useIconStyle } from "@/context/IconStyleContext";
import { ICON_MAP_META } from "@/lib/iconMeta";
import type { IconStyle } from "@/context/IconStyleContext";

interface Props {
  icon?: string;
  name?: string;
  color?: string;
  size?: number;
  style?: IconStyle;
}

function isEmoji(str: string) {
  return /^\p{Emoji}/u.test(str) && str.length <= 4;
}

// "fork-knife" → "ForkKnife"
function kebabToPascal(s: string) {
  return s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

interface PhosphorIconProps { size?: number; weight?: string; color?: string }

// Lazily loads a single Phosphor icon component by kebab-case id.
// Shows emoji fallback during load — no layout shift, no blank flash.
function PhosphorIcon({ iconId, size, weight, color, emoji }: {
  iconId: string; size: number; weight: string; color?: string; emoji: string;
}) {
  const [Comp, setComp] = useState<ComponentType<PhosphorIconProps> | null>(null);

  useEffect(() => {
    let active = true;
    const name = kebabToPascal(iconId);
    import("@phosphor-icons/react").then(mod => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (active) setComp(() => ((mod as any)[name] as ComponentType<PhosphorIconProps> | undefined) ?? null);
    });
    return () => { active = false; };
  }, [iconId]);

  if (!Comp) {
    return <span style={{ fontSize: size * 0.9, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>{emoji}</span>;
  }
  return <Comp size={size} weight={weight as "light" | "fill" | "duotone"} color={color} />;
}

export default function CategoryIcon({ icon, name, color = "var(--accent)", size = 16, style: styleProp }: Props) {
  const { iconStyle: ctxStyle } = useIconStyle();
  const style = styleProp ?? ctxStyle;

  // 1 — emoji stored directly → always render as emoji
  if (icon && isEmoji(icon)) {
    return <span style={{ fontSize: size * 0.95, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>{icon}</span>;
  }

  // 2 — known Phosphor icon id
  const meta = icon ? ICON_MAP_META.get(icon) : null;

  if (meta) {
    if (style === "emoji") {
      return <span style={{ fontSize: size * 0.95, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>{meta.emoji}</span>;
    }
    const weight = style === "solid" ? "fill" : style === "duotone" ? "duotone" : "light";
    const iconColor = style === "duotone" ? color : undefined;
    return <PhosphorIcon iconId={meta.id} size={size} weight={weight} color={iconColor} emoji={meta.emoji} />;
  }

  // 3 — legacy keyword fallback
  return <LegacyIcon name={name ?? icon ?? ""} size={size} />;
}

// ─── Legacy keyword icons (unchanged for backward compat) ────────────────────

function LegacyIcon({ name, size }: { name: string; size: number }) {
  const n = name.toLowerCase();
  const p: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, width: size, height: size,
  };

  if (n.includes("ingreso") || n.includes("sueldo") || n.includes("salario") || n.includes("cobro"))
    return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (n.includes("comida") || n.includes("restaur") || n.includes("café") || n.includes("cafe") || n.includes("food") || n.includes("kiosco") || n.includes("aliment"))
    return <svg {...p}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
  if (n.includes("supermercado") || n.includes("almacen") || n.includes("mercado") || n.includes("carrefour") || n.includes("coto") || n.includes("jumbo"))
    return <svg {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.98-1.68l1.62-9.7H6"/></svg>;
  if (n.includes("transport") || n.includes("uber") || n.includes("nafta") || n.includes("combusti") || n.includes("taxi") || n.includes("subte"))
    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l2 3v3h-5z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
  if (n.includes("salud") || n.includes("médic") || n.includes("medic") || n.includes("hospital") || n.includes("prepaga") || n.includes("dentista"))
    return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
  if (n.includes("farmacia") || n.includes("remedio") || n.includes("medicamento"))
    return <svg {...p}><rect x="2" y="8.5" width="20" height="7" rx="3.5"/><line x1="12" y1="8.5" x2="12" y2="15.5"/></svg>;
  if (n.includes("gimnasio") || n.includes("gym") || n.includes("deporte") || n.includes("fitness"))
    return <svg {...p}><line x1="6" y1="12" x2="18" y2="12"/><path d="M4 9v6M8 7v10M16 7v10M20 9v6"/></svg>;
  if (n.includes("hogar") || n.includes("casa") || n.includes("alquil") || n.includes("expensa"))
    return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (n.includes("educaci") || n.includes("curso") || n.includes("libro") || n.includes("escuela"))
    return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
  if (n.includes("ocio") || n.includes("entret") || n.includes("netflix") || n.includes("cine") || n.includes("spotify"))
    return <svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  if (n.includes("ropa") || n.includes("indument") || n.includes("zapatilla") || n.includes("shopping"))
    return <svg {...p}><path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46A2 2 0 002 5.24l1 6.46a2 2 0 001.93 1.69h14.14a2 2 0 001.93-1.69l1-6.46a2 2 0 00-1.62-1.78z"/></svg>;
  if (n.includes("suscripci") || n.includes("membres") || n.includes("abono"))
    return <svg {...p}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>;
  if (n.includes("trabajo") || n.includes("oficina") || n.includes("hosting") || n.includes("freelance"))
    return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
  if (n.includes("ahorro") || n.includes("inversion") || n.includes("banco") || n.includes("finanz"))
    return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (n.includes("viaje") || n.includes("hotel") || n.includes("vuelo") || n.includes("turismo"))
    return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
  if (n.includes("mascota") || n.includes("perro") || n.includes("gato") || n.includes("vet"))
    return <svg {...p}><path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 7.65l1.06 1.06L12 21.23l7.36-7.36 1.06-1.06a5.4 5.4 0 000-7.23z"/></svg>;
  if (n.includes("regalo") || n.includes("fiesta") || n.includes("cumple") || n.includes("celebra"))
    return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;

  return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
