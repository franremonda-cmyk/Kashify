"use client";
import { useSpaces } from "@/context/SpaceContext";

// Selector de espacio activo. Fila de pills: "Total" + cada espacio.
// Se oculta si el usuario tiene un solo espacio (no hay nada que elegir).
export default function SpaceSwitcher() {
  const { spaces, activeId, setActiveSpace } = useSpaces();
  if (spaces.length <= 1) return null;

  const options = [{ id: "total", name: "Total", icon: "◎" }, ...spaces];

  return (
    <div
      className="enter-up"
      style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}
    >
      {options.map((o) => {
        const active = o.id === activeId;
        return (
          <button
            key={o.id}
            onClick={() => setActiveSpace(o.id)}
            className="press"
            aria-pressed={active}
            style={{
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              minHeight: 44, padding: "0 16px", borderRadius: "var(--radius-pill)", fontSize: 13, fontWeight: 600,
              border: active ? "0.5px solid var(--accent)" : "0.5px solid var(--glass-border)",
              background: active ? "var(--accent-soft)" : "var(--raised)",
              color: active ? "var(--accent)" : "var(--ink-muted)",
              flexShrink: 0,
            }}
          >
            <span aria-hidden>{o.icon}</span>
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
