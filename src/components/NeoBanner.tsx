"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function NeoBanner() {
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out" | "gone">("hidden");

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("neo-banner")) return;

    const t1 = setTimeout(() => setPhase("in"), 2000);
    const t2 = setTimeout(() => setPhase("visible"), 2400);
    const t3 = setTimeout(() => dismiss(), 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    setPhase("out");
    sessionStorage?.setItem("neo-banner", "1");
    setTimeout(() => setPhase("gone"), 450);
  }

  if (phase === "hidden" || phase === "gone") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 150,
        padding: "env(safe-area-inset-top, 12px) 16px 12px",
        transform: phase === "in" ? "translateY(-110%)" : phase === "out" ? "translateY(-110%)" : "translateY(0)",
        transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          margin: "0 auto",
          pointerEvents: "auto",
          borderRadius: 18,
          background: "rgba(7, 20, 11, 0.94)",
          backdropFilter: "blur(40px) saturate(240%)",
          WebkitBackdropFilter: "blur(40px) saturate(240%)",
          border: "0.5px solid rgba(0,200,83,0.32)",
          boxShadow: "0 6px 32px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(0,200,83,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px 12px 12px",
        }}
      >
        {/* Neo avatar */}
        <Link href="/neo" onClick={dismiss} style={{ flexShrink: 0, textDecoration: "none" }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "linear-gradient(135deg, #00C853, rgba(0,200,83,0.45))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(0,200,83,0.30)",
          }}>
            <span style={{
              fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: "#060C09",
            }}>N</span>
          </div>
        </Link>

        {/* Text */}
        <Link href="/neo" onClick={dismiss} style={{ flex: 1, textDecoration: "none" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
            Neo está activo
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
            Mandame un mensaje por WhatsApp para empezar
          </p>
        </Link>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.10)",
            color: "var(--ink-dim)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
