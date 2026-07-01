"use client";
import { useSpaces } from "@/context/SpaceContext";
import CategoryIcon from "./CategoryIcon";

export interface SpaceCardData {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  currency: string;
  balance: number;
}

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/", PYG: "₲", BOB: "Bs",
};

// Cards por espacio en la vista Total: balance por espacio (las métricas de
// arriba ya dan ingresos/gastos del mes). Tap → cambia el espacio activo.
export default function SpacesOverview({ cards }: { cards: SpaceCardData[] }) {
  const { setActiveSpace } = useSpaces();
  if (cards.length <= 1) return null;

  return (
    <section className="enter-up" data-delay="1">
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2 className="section-title">Tus espacios</h2>
      </div>
      <div
        style={{
          display: "flex", gap: 10, overflowX: "auto",
          scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          scrollSnapType: "x proximity",
          // margen negativo para que el peek del borde no se sienta cortado
          margin: "0 -16px", padding: "0 16px 4px",
        }}
      >
        {cards.map((c) => {
          const sym = SYMBOLS[c.currency] ?? c.currency;
          const color = c.color ?? "#46B58C";
          return (
            <button
              key={c.id}
              onClick={() => setActiveSpace(c.id)}
              className="press glow-hover glass-card"
              aria-label={`Ver espacio ${c.name}`}
              style={{
                flex: "0 0 auto",
                width: "clamp(150px, 44vw, 186px)",
                scrollSnapAlign: "start",
                padding: "16px 18px", borderRadius: 18, textAlign: "left", cursor: "pointer",
                containerType: "inline-size", overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: color + "22", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                  <CategoryIcon icon={c.icon} name={c.name} color={color} size={16} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.name}</span>
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-muted)", marginBottom: 4 }}>Balance</p>
              {/* cqi: el monto escala con el ancho real de la card → nunca se sale */}
              <p className="mono" style={{ fontSize: "clamp(0.9rem, 12cqi, 1.5rem)", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip", maxWidth: "100%", lineHeight: 1.1 }}>
                {sym} {c.balance.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
