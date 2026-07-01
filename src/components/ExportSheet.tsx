"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSpaces } from "@/context/SpaceContext";
import { useModalTouchLock } from "@/hooks/useModalTouchLock";

// fontSize 16 en inputs → evita el auto-zoom de iOS Safari.
const field: React.CSSProperties = {
  width: "100%", background: "var(--raised)", border: "0.5px solid var(--glass-border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--ink)", fontSize: 16, outline: "none",
};
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6, display: "block" };

export default function ExportSheet({ onClose }: { onClose: () => void }) {
  const { spaces, activeId } = useSpaces();
  const { mounted, overlayRef, scrollRef } = useModalTouchLock();
  const [format, setFormat]     = useState<"csv" | "xlsx">("csv");
  const [spaceId, setSpaceId]   = useState<string>(activeId || "total");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [category, setCategory] = useState("");
  const [cats, setCats]         = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((c: any[]) => setCats((c ?? []).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
  }, []);

  function doExport() {
    const p = new URLSearchParams({ format });
    if (spaceId) p.set("space", spaceId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (category) p.set("category", category);
    window.open(`/api/export?${p.toString()}`);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", padding: "20px 16px", touchAction: "none" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Exportar transacciones"
        className="w-full max-w-sm flex flex-col"
        style={{ borderRadius: 20, background: "var(--base)", border: "0.5px solid var(--glass-border)", boxShadow: "0 24px 60px rgba(0,0,0,0.30)", maxHeight: "85dvh", minHeight: 0 }}
      >
        <div style={{ flexShrink: 0, padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Exportar</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)", fontSize: 12 }}>✕</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, touchAction: "pan-y" }}>
          {/* Formato */}
          <div>
            <span style={label}>Formato</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["csv", "xlsx"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} style={{
                  flex: 1, minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: format === f ? "var(--accent-soft)" : "var(--raised)",
                  color: format === f ? "var(--accent)" : "var(--ink-muted)",
                  border: format === f ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
                }}>{f === "csv" ? "CSV" : "Excel (.xlsx)"}</button>
              ))}
            </div>
          </div>

          {/* Espacio (solo con >1 espacio) */}
          {spaces.length > 1 && (
            <div>
              <span style={label}>Espacio</span>
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Espacio a exportar" style={field}>
                <option value="total">Total (espacios incluidos)</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
          )}

          {/* Rango de fechas (opcional) */}
          <div>
            <span style={label}>Rango de fechas <span style={{ color: "var(--ink-dim)", fontWeight: 400 }}>(opcional)</span></span>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" style={field} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" style={field} />
            </div>
          </div>

          {/* Categoría (opcional) */}
          {cats.length > 0 && (
            <div>
              <span style={label}>Categoría <span style={{ color: "var(--ink-dim)", fontWeight: 400 }}>(opcional)</span></span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría a exportar" style={field}>
                <option value="">Todas</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: "12px 20px 16px", borderTop: "0.5px solid var(--glass-border-dim)" }}>
          <button onClick={doExport} style={{ width: "100%", minHeight: 46, borderRadius: 12, fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#04130D" }}>
            Descargar {format === "csv" ? "CSV" : "Excel"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
