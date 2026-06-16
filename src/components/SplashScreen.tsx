"use client";
import { useState, useEffect } from "react";

export default function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"),  1300);
    const t3 = setTimeout(() => setPhase("done"),  1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        background: "#060C09",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 500ms cubic-bezier(0.4, 0, 1, 1)" : "none",
        pointerEvents: phase === "out" ? "none" : "auto",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,200,83,0.12) 0%, transparent 65%)",
          opacity: phase === "in" ? 0 : 1,
          transition: "opacity 500ms ease-out",
        }}
      />

      {/* K mark */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: "linear-gradient(135deg, #00C853, rgba(0,200,83,0.5))",
          transform: phase === "in" ? "scale(0.6)" : phase === "hold" ? "scale(1)" : "scale(1.06)",
          opacity: phase === "in" ? 0 : 1,
          transition: phase === "in"
            ? "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease-out"
            : phase === "out"
            ? "transform 300ms ease-in, opacity 200ms ease-in"
            : "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: phase === "hold"
            ? "0 0 0 12px rgba(0,200,83,0.06), 0 0 60px 20px rgba(0,200,83,0.18)"
            : "0 0 0 0 rgba(0,200,83,0)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
            fontSize: 40,
            fontWeight: 700,
            color: "#060C09",
            letterSpacing: "-0.02em",
            userSelect: "none",
          }}
        >
          K
        </span>
      </div>

      {/* App name — fades in after K */}
      <div
        className="absolute"
        style={{
          top: "calc(50% + 56px)",
          opacity: phase === "hold" ? 1 : 0,
          transform: phase === "hold" ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 300ms ease-out, transform 300ms ease-out",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(240,255,244,0.5)",
            letterSpacing: "0.08em",
            userSelect: "none",
          }}
        >
          KASHIFY
        </span>
      </div>
    </div>
  );
}
