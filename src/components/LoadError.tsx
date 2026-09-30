"use client";

// Falla de carga con salida: con la red floja, una lista vacía se lee como
// "perdí mis datos". Mismo diseño que el error de Actividad.
// `compact` = una línea dentro de una sección (Perfil).
export default function LoadError({ what, onRetry, compact = false }: { what: string; onRetry: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <p role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
        No pudimos cargar {what}.{" "}
        <button onClick={onRetry} style={{ color: "var(--accent)", fontWeight: 600, minHeight: 44, padding: "0 4px" }}>Reintentar</button>
      </p>
    );
  }
  return (
    <div role="alert" style={{ padding: 32, textAlign: "center", borderRadius: 16, background: "var(--base)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink)" }}>No pudimos cargar {what}.</p>
      <p style={{ fontSize: "var(--text-2xs)", color: "var(--ink-muted)" }}>Puede ser la conexión — tus datos están a salvo.</p>
      <button onClick={onRetry}
        style={{ padding: "10px 20px", minHeight: 44, borderRadius: 12, fontSize: "var(--text-xs)", fontWeight: 600, background: "var(--accent)", color: "var(--on-accent)" }}>
        Reintentar
      </button>
    </div>
  );
}
