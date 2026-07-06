"use client";
import { useState } from "react";
import { useSpaces } from "@/context/SpaceContext";
import SpaceModal, { type SpaceFormData } from "@/components/SpaceModal";
import { BackButton } from "@/components/ui/BackButton";
import type { Space } from "@/types";

export default function EspaciosPage() {
  const { spaces, reloadSpaces } = useSpaces();
  const [editing, setEditing] = useState<Space | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(data: SpaceFormData) {
    setError(null);
    const isNew = editing === "new";
    const url = isNew ? "/api/spaces" : `/api/spaces/${(editing as Space).id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? "No se pudo guardar"); return; }
    await reloadSpaces();
  }

  async function handleDelete() {
    if (editing === "new" || !editing) return;
    setError(null);
    const res = await fetch(`/api/spaces/${editing.id}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? "No se pudo eliminar"); return; }
    await reloadSpaces();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 enter-up">
        <BackButton />
        <h1 className="page-title">Espacios</h1>
      </div>

      <p className="text-sm enter-up" style={{ color: "var(--ink-muted)" }}>
        Separá tus finanzas en espacios (personal, freelance, un emprendimiento…). Los que
        “suman al total” se agregan a tu balance personal; los aislados quedan aparte.
      </p>

      {error && (
        <div className="enter-up" style={{ background: "rgba(255,59,48,0.10)", border: "0.5px solid rgba(255,59,48,0.25)", color: "var(--negative)", borderRadius: 12, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 enter-up">
        {spaces.map((s) => (
          <button key={s.id} onClick={() => { setError(null); setEditing(s); }} className="list-row press" style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: s.color + "22", border: `1px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {s.name}
                {s.is_default && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)" }}>default</span>}
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                {s.primary_currency} · {s.include_in_total ? "suma al total" : "aislado"}
              </p>
            </div>
            <span style={{ color: "var(--ink-dim)", fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>

      <button onClick={() => { setError(null); setEditing("new"); }} className="press"
        style={{ padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#fff" }}>
        + Nuevo espacio
      </button>

      {editing && (
        <SpaceModal
          space={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onDelete={editing === "new" ? undefined : handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
