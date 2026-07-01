"use client";
import { useState, useId, useRef, useLayoutEffect } from "react";

export interface ChartMonth {
  label: string;   // "Ene", "Feb", …
  income: number;
  expense: number;
}

// Serie de gasto mensual de un espacio (alineada 1:1 con `data` por índice de mes).
export interface SpaceExpenseStack {
  name: string;
  color: string;
  expense: number[];
}

interface Props {
  data: ChartMonth[];
  currencySymbol?: string;
  spaceStacks?: SpaceExpenseStack[];
}

const PERIODS = ["1M", "3M", "6M", "1A"] as const;
type Period = typeof PERIODS[number];

function periodN(period: Period): number {
  return period === "1M" ? 1 : period === "3M" ? 3 : period === "6M" ? 6 : 12;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function bezierPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  return points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = points[i - 1];
    const cpx = ((px + x) / 2).toFixed(1);
    return `${acc} C ${cpx} ${py.toFixed(1)} ${cpx} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");
}

export default function SpendingChart({ data, currencySymbol = "$", spaceStacks = [] }: Props) {
  const [period, setPeriod] = useState<Period>("6M");
  const [mode, setMode] = useState<"total" | "space">("total");
  const uid = useId().replace(/:/g, "");

  const hasSpaceMode = spaceStacks.length >= 2;
  const activeMode = hasSpaceMode ? mode : "total";

  // Measure real pixel width so 1 SVG unit = 1px → text stays a constant
  // size regardless of how wide the card gets (mobile vs desktop).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = periodN(period);
  const slice = data.slice(-n);
  if (slice.length === 0) {
    return (
      <div className="glass" style={{ borderRadius: 16, padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>Sin datos para este período</p>
      </div>
    );
  }

  const H = W >= 680 ? 240 : 200;
  const PAD = { top: 18, right: 18, bottom: 30, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Stacked (por espacio): mismos meses que `slice`.
  const stackVals = activeMode === "space"
    ? spaceStacks.map((s) => ({ name: s.name, color: s.color, vals: s.expense.slice(-slice.length) }))
    : [];
  const monthTotals = slice.map((_, j) => stackVals.reduce((s, st) => s + (st.vals[j] ?? 0), 0));

  const lineVals = slice.flatMap((d) => [d.income, d.expense]).filter((v) => v > 0);
  const maxVal = activeMode === "space"
    ? Math.max(1, ...monthTotals) * 1.12
    : (lineVals.length ? Math.max(...lineVals) * 1.12 : 1);

  const xOf = (i: number) => PAD.left + (slice.length === 1 ? chartW / 2 : (i / (slice.length - 1)) * chartW);
  const yOf = (v: number) => PAD.top + (1 - v / maxVal) * chartH;

  const incomePoints = slice.map((d, i) => [xOf(i), yOf(d.income)] as [number, number]);
  const expensePoints = slice.map((d, i) => [xOf(i), yOf(d.expense)] as [number, number]);
  const incomePath  = bezierPath(incomePoints);
  const expensePath = bezierPath(expensePoints);

  const areaClose = (pts: [number, number][]) =>
    `${bezierPath(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  // Bandas apiladas (de abajo hacia arriba). Polígonos rectos = sin overshoot.
  // El "piso" de cada banda es la suma de las bandas anteriores en ese mes.
  const stackAreas = stackVals.map((st, k) => {
    const bottomAt = (j: number) => stackVals.slice(0, k).reduce((s, prev) => s + (prev.vals[j] ?? 0), 0);
    const topPts = st.vals.map((v, j) => `${xOf(j).toFixed(1)} ${yOf(bottomAt(j) + v).toFixed(1)}`);
    const botPts = st.vals.map((v, j) => `${xOf(j).toFixed(1)} ${yOf(bottomAt(j)).toFixed(1)}`).reverse();
    return { d: `M ${topPts.join(" L ")} L ${botPts.join(" L ")} Z`, color: st.color, name: st.name };
  });

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);
  const step = Math.max(1, Math.ceil(slice.length / 4));

  return (
    <div ref={wrapRef} className="glass" style={{ borderRadius: 16, padding: "16px 16px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>
          Evolución mensual
        </p>
        {/* Period selector */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: period === p ? "rgba(0,230,118,0.18)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--ink-muted)",
                border: period === p ? "0.5px solid rgba(0,230,118,0.30)" : "none",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle Total / Por espacio (solo en la vista Total con >1 espacio) */}
      {hasSpaceMode && (
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2, marginBottom: 10, width: "fit-content" }}>
          {(["total", "space"] as const).map((mo) => (
            <button
              key={mo}
              onClick={() => setMode(mo)}
              style={{
                minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: activeMode === mo ? "var(--base)" : "transparent",
                color: activeMode === mo ? "var(--accent)" : "var(--ink-muted)",
                boxShadow: activeMode === mo ? "var(--shadow-sm)" : "none",
              }}
            >
              {mo === "total" ? "Total" : "Por espacio"}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      {activeMode === "space" ? (
        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          {stackVals.map((st) => (
            <div key={st.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: st.color }} />
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{st.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 16, height: 2, borderRadius: 1, background: "var(--positive)" }} />
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Ingresos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 16, height: 2, borderRadius: 1, background: "var(--negative)" }} />
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Gastos</span>
          </div>
        </div>
      )}

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ width: "100%", height: H, display: "block" }}
      >
        <defs>
          <linearGradient id={`ig-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30D158" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#30D158" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`eg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF453A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FF453A" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {gridVals.slice(1).map((v, i) => (
          <line
            key={i}
            x1={PAD.left} y1={yOf(v)}
            x2={PAD.left + chartW} y2={yOf(v)}
            stroke="rgba(84,84,88,0.22)"
            strokeWidth={0.5}
            strokeDasharray="3 4"
          />
        ))}

        {/* Y labels */}
        {gridVals.slice(1, -1).map((v, i) => (
          <text
            key={i}
            x={PAD.left - 10}
            y={yOf(v) + 4}
            fontSize={12}
            fontWeight={500}
            fill="var(--ink-muted)"
            textAnchor="end"
          >
            {currencySymbol}{compact(v)}
          </text>
        ))}

        {activeMode === "space" ? (
          /* Bandas apiladas por espacio */
          stackAreas.map((a, i) => (
            <path key={i} d={a.d} fill={a.color} fillOpacity={0.85}
              stroke="var(--glass-border)" strokeWidth={0.75}
              clipPath={`url(#clip-${uid})`} />
          ))
        ) : (
          <>
            {/* Area fills */}
            <path d={areaClose(incomePoints)}  fill={`url(#ig-${uid})`} clipPath={`url(#clip-${uid})`} />
            <path d={areaClose(expensePoints)} fill={`url(#eg-${uid})`} clipPath={`url(#clip-${uid})`} />
            {/* Lines */}
            <path d={incomePath}  fill="none" stroke="#30D158" strokeWidth={2.4} strokeLinecap="round" />
            <path d={expensePath} fill="none" stroke="#FF453A" strokeWidth={2.4} strokeLinecap="round" />
            {/* Dots on last point */}
            {incomePoints.length > 0 && (
              <circle cx={incomePoints[incomePoints.length - 1][0]}
                      cy={incomePoints[incomePoints.length - 1][1]}
                      r={4.5} fill="#30D158" />
            )}
            {expensePoints.length > 0 && (
              <circle cx={expensePoints[expensePoints.length - 1][0]}
                      cy={expensePoints[expensePoints.length - 1][1]}
                      r={4.5} fill="#FF453A" />
            )}
          </>
        )}

        {/* X-axis labels */}
        {slice.map((d, i) => i % step === 0 && (
          <text
            key={i}
            x={xOf(i)}
            y={H - 8}
            fontSize={12}
            fontWeight={500}
            fill="var(--ink-muted)"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
