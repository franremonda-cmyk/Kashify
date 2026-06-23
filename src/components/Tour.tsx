"use client";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface Step {
  sel: string;        // data-tour value of the target element
  title: string;
  body: string;
  emoji: string;
}

const STEPS: Step[] = [
  { sel: "balance", emoji: "💚", title: "Acá está tu plata",
    body: "Tu balance, siempre a la vista. Tocá las monedas para cambiar entre pesos, dólares y más." },
  { sel: "metrics", emoji: "📊", title: "Lo que entra y lo que sale",
    body: "Ingresos y gastos del mes. Tocá cualquiera para ver el desglose en detalle." },
  { sel: "budgets", emoji: "🎯", title: "Ponéte límites",
    body: "Asigná un tope a cada categoría y mirá en tiempo real cuánto te queda." },
  { sel: "add", emoji: "✚", title: "Registrá en dos segundos",
    body: "Tocá el botón ✚ para anotar un gasto o ingreso al instante." },
  { sel: "neo", emoji: "🤖", title: "Neo, tu asistente",
    body: "Preguntale lo que quieras o cargá gastos hablándole, como a un amigo." },
  { sel: "perfil", emoji: "⚙️", title: "Todo a tu medida",
    body: "En tu Perfil ajustás metas, cuotas, categorías y el aspecto de la app. Pasá cuando quieras a personalizarla." },
];

const TOUR_KEY = "kashify-tour-done";

export default function Tour() {
  const [mounted, setMounted] = useState(false);
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setI(0), 650);
    return () => clearTimeout(t);
  }, []);

  const targetEl = useCallback(
    () => (i >= 0 ? (document.querySelector(`[data-tour="${STEPS[i].sel}"]`) as HTMLElement | null) : null),
    [i]
  );

  // Scroll the target into view, then measure
  useEffect(() => {
    if (i < 0) return;
    const el = targetEl();
    if (!el) { advance(); return; }   // target missing → skip ahead
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setRect(el.getBoundingClientRect()), 360);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Keep the spotlight glued on resize / scroll
  useEffect(() => {
    if (i < 0) return;
    const update = () => { const el = targetEl(); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [i, targetEl]);

  function finish() {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    setI(-1);
  }
  function advance() {
    setI((p) => {
      if (p >= STEPS.length - 1) { try { localStorage.setItem(TOUR_KEY, "1"); } catch {} return -1; }
      return p + 1;
    });
  }
  function nextStep() { if (i >= STEPS.length - 1) finish(); else setI(i + 1); }

  if (!mounted || i < 0) return null;

  const step = STEPS[i];
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spotlight box (fallback: centered if no rect yet)
  const box = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : { top: vh / 2 - 40, left: vw / 2 - 40, width: 80, height: 80 };

  // Tooltip placement: below the target if it fits, else above
  const TT_W = Math.min(340, vw - 32);
  const spaceBelow = vh - (box.top + box.height);
  const below = spaceBelow > 230;
  const ttTop = below ? box.top + box.height + 14 : Math.max(16, box.top - 14 - 210);
  let ttLeft = box.left + box.width / 2 - TT_W / 2;
  ttLeft = Math.max(16, Math.min(ttLeft, vw - TT_W - 16));

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      {/* Click catcher — blocks the app underneath */}
      <div style={{ position: "absolute", inset: 0, cursor: "default" }} onClick={nextStep} />

      {/* Spotlight (dim everything except the hole) */}
      <div
        style={{
          position: "absolute",
          top: box.top, left: box.left, width: box.width, height: box.height,
          borderRadius: 18,
          boxShadow: "0 0 0 9999px rgba(8,12,10,0.74), 0 0 0 2px var(--accent)",
          transition: "all 360ms cubic-bezier(0.22, 1, 0.36, 1)",
          pointerEvents: "none",
        }}
      />

      {/* Tooltip card */}
      <div
        className="glass-strong scale-up"
        style={{
          position: "absolute", top: ttTop, left: ttLeft, width: TT_W,
          padding: 18, zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }} aria-hidden>{step.emoji}</span>
          <p className="display" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {step.title}
          </p>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.5 }}>{step.body}</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map((_, k) => (
              <span key={k} style={{
                width: k === i ? 18 : 6, height: 6, borderRadius: 999,
                background: k === i ? "var(--accent)" : "var(--glass-border-hover)",
                transition: "all 280ms cubic-bezier(0.22,1,0.36,1)",
              }} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={finish} className="press" style={{
              padding: "8px 12px", fontSize: 13, fontWeight: 500, color: "var(--ink-dim)",
              background: "transparent", border: "none", cursor: "pointer",
            }}>
              Saltear
            </button>
            <button onClick={nextStep} className="btn-primary press" style={{ minHeight: 40, padding: "0 18px", fontSize: 14 }}>
              {i >= STEPS.length - 1 ? "¡Listo!" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
