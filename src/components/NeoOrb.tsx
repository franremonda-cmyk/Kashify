"use client";
import type { CSSProperties, ReactNode } from "react";

interface Props {
  size?: number;
  /** adds the morphing/pulsing idle motion (chat idle, active nav) */
  alive?: boolean;
  /** optional overlay, e.g. the "N" mark in the nav */
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * Iridescent, green-dominant orb — Siri-adjacent without the rainbow.
 * Layered: swirling conic iridescence → glassy sphere body → drifting specular.
 * All the visual layers live in globals.css (.neo-orb*).
 */
export default function NeoOrb({ size = 104, alive = false, children, style, className }: Props) {
  return (
    <div
      className={`neo-orb${alive ? " neo-avatar-idle" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 0 1px rgba(120,230,190,0.16), var(--shadow-lg)",
        ...style,
      }}
    >
      <div className="neo-orb__iris" aria-hidden />
      <div className="neo-orb__iris2" aria-hidden />
      <div className="neo-orb__body" aria-hidden />
      <div className="neo-orb__spec" aria-hidden />
      {children != null && (
        <div style={{ position: "absolute", inset: 0, zIndex: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      )}
    </div>
  );
}
