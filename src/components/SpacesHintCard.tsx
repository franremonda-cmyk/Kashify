"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSpaces } from "@/context/SpaceContext";

const KEY = "kashify-spaces-hint-dismissed";

// Aviso único para descubrir "espacios": solo si el usuario tiene 1 solo espacio
// (con >1 ya conoce la feature; el switcher aparece). Descartable, persiste en localStorage.
export default function SpacesHintCard() {
  const { spaces } = useSpaces();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setShow(spaces.length === 1 && localStorage.getItem(KEY) !== "1");
    });
    return () => cancelAnimationFrame(id);
  }, [spaces.length]);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  return (
    <div className="enter-up" style={{ position: "relative", borderRadius: 16, padding: "16px 16px 16px 18px", background: "var(--accent-soft)", border: "0.5px solid var(--accent-glow)" }}>
      <button onClick={dismiss} aria-label="No mostrar de nuevo"
        style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--ink-muted)", fontSize: 13 }}>
        <span aria-hidden>✕</span>
      </button>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 26 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "#04130D", fontSize: 18, fontWeight: 700 }} aria-hidden>◎</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Separá tus finanzas en espacios</p>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 3, lineHeight: 1.45 }}>
            Personal, Freelance, un emprendimiento… cada espacio con su propio balance. El “Total” suma los que elijas.
          </p>
          <Link href="/espacios" onClick={dismiss}
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 10, padding: "0 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#04130D", textDecoration: "none" }}>
            Crear un espacio →
          </Link>
        </div>
      </div>
    </div>
  );
}
