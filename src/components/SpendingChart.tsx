"use client";
import { useState, useId } from "react";

export interface ChartMonth {
  label: string;   // "Ene", "Feb", …
  income: number;
  expense: number;
}

interface Props {
  data: ChartMonth[];
  currencySymbol?: string;
}

const PERIODS = ["1M", "3M", "6M", "1A"] as const;
type Period = typeof PERIODS[number];

function periodSlice(data: ChartMonth[], period: Period): ChartMonth[] {
  const n = period === "1M" ? 1 : period === "3M" ? 3 : period === "6M" ? 6 : 12;
  return data.slice(-n);
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

export default function SpendingChart({ data, currencySymbol = "$" }: Props) {
  const [period, setPeriod] = useState<Period>("6M");
  const uid = useId().replace(/:/g, "");

  const slice = periodSlice(data, period);
  if (slice.length === 0) {
    return (
      <div className="glass" style={{ borderRadius: 16, padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>Sin datos para este período</p>
      </div>
    );
  }

  const W = 340, H = 160;
  const PAD = { top: 16, right: 12, bottom: 28, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = slice.flatMap((d) => [d.income, d.expense]).filter((v) => v > 0);
  const maxVal = allVals.length ? Math.max(...allVals) * 1.12 : 1;

  const xOf = (i: number) => PAD.left + (slice.length === 1 ? chartW / 2 : (i / (slice.length - 1)) * chartW);
  const yOf = (v: number) => PAD.top + (1 - v / maxVal) * chartH;

  const incomePoints = slice.map((d, i) => [xOf(i), yOf(d.income)] as [number, number]);
  const expensePoints = slice.map((d, i) => [xOf(i), yOf(d.expense)] as [number, number]);

  const incomePath  = bezierPath(incomePoints);
  const expensePath = bezierPath(expensePoints);

  const areaClose = (pts: [number, number][]) =>
    `${bezierPath(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  // Y gridlines
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);

  // Show subset of x labels
  const step = Math.max(1, Math.ceil(slice.length / 4));

  return (
    <div className="glass" style={{ borderRadius: 16, padding: "16px 16px 12px" }}>
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
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: period === p ? "rgba(0,230,118,0.18)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--ink-dim)",
                border: period === p ? "0.5px solid rgba(0,230,118,0.30)" : "none",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 16, height: 2, borderRadius: 1, background: "var(--positive)" }} />
          <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>Ingresos</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 16, height: 2, borderRadius: 1, background: "var(--negative)" }} />
          <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>Gastos</span>
        </div>
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
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
            x={PAD.left - 2}
            y={yOf(v) + 3}
            fontSize={7}
            fill="rgba(235,235,245,0.25)"
            textAnchor="end"
          >
            {currencySymbol}{compact(v)}
          </text>
        ))}

        {/* Area fills */}
        <path d={areaClose(incomePoints)}  fill={`url(#ig-${uid})`} clipPath={`url(#clip-${uid})`} />
        <path d={areaClose(expensePoints)} fill={`url(#eg-${uid})`} clipPath={`url(#clip-${uid})`} />

        {/* Lines */}
        <path d={incomePath}  fill="none" stroke="#30D158" strokeWidth={1.8} strokeLinecap="round" />
        <path d={expensePath} fill="none" stroke="#FF453A" strokeWidth={1.8} strokeLinecap="round" />

        {/* Dots on last point */}
        {incomePoints.length > 0 && (
          <circle cx={incomePoints[incomePoints.length - 1][0]}
                  cy={incomePoints[incomePoints.length - 1][1]}
                  r={3} fill="#30D158" />
        )}
        {expensePoints.length > 0 && (
          <circle cx={expensePoints[expensePoints.length - 1][0]}
                  cy={expensePoints[expensePoints.length - 1][1]}
                  r={3} fill="#FF453A" />
        )}

        {/* X-axis labels */}
        {slice.map((d, i) => i % step === 0 && (
          <text
            key={i}
            x={xOf(i)}
            y={H - 4}
            fontSize={8}
            fill="rgba(235,235,245,0.30)"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
