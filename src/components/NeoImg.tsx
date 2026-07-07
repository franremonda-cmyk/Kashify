"use client";
import { useState } from "react";
import type { NeoMood } from "@/lib/neo/mascot-bus";

// Imagen del arte de Neo con fallback: si el PNG no carga (red floja, etc.)
// renderiza `fallback` en su lugar — nunca el cuadrado roto del browser.
export default function NeoImg({ mood = "happy", size, fallback = null, className, style, alt = "" }: {
  mood?: NeoMood;
  size: number;
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/neo/neo-${mood}.png`}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      loading="eager"
      fetchPriority="high"
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
