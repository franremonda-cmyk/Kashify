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
  income: number;
  expense: number;
}

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$",
  GBP: "£", UYU: "$U", CLP: "$", COP: "$", PEN: "S/", PYG: "₲", BOB: "Bs",
};

// Compacto para los chips de ingreso/gasto (los balances van completos).
function fmtc(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString("es-AR");
}

// Cards por espacio en la vista Total. Tap → cambia el espacio activo.
export default function SpacesOverview({ cards }: { cards: SpaceCardData[] }) {
  const { setActiveSpace } = useSpaces();
  if (cards.length <= 1) return null;

  return (
    <section className="enter-up" data-delay="1">
      <div className="section-head" style={{ marginBottom: 8, alignItems: "baseline", gap: 8 }}>
        <p className="section-title">Tus espacios</p>
        <span style={{ fontSize: 12, color: "var(--ink-dim)", fontWeight: 500 }}>ingresos / gastos de este mes</span>
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
                width: "clamp(150px, 44vw, 188px)",
                scrollSnapAlign: "start",
                padding: 16, borderRadius: 18, textAlign: "left", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: color + "22", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                  <CategoryIcon icon={c.icon} name={c.name} color={color} size={16} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              </div>
              <p className="mono" style={{ fontSize: "clamp(1rem, 5.5vw, 1.35rem)", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", lineHeight: 1.05 }}>
                {sym} {c.balance.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--positive)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: "var(--ink-muted)", flex: 1 }}>Ingresos</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--positive)", fontVariantNumeric: "tabular-nums" }}>{sym} {fmtc(c.income)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--negative)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: "var(--ink-muted)", flex: 1 }}>Gastos</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--negative)", fontVariantNumeric: "tabular-nums" }}>{sym} {fmtc(c.expense)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
