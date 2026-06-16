const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€", CHF: "Fr", BRL: "R$", GBP: "£",
};

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

interface Props {
  income: number;
  expense: number;
  currencyCode: string;
}

export default function MetricStrip({ income, expense, currencyCode }: Props) {
  const net = income - expense;
  const sym = SYMBOLS[currencyCode] ?? currencyCode;

  const items = [
    { label: "Ingresos", value: income, color: "var(--positive)" },
    { label: "Gastos",   value: expense, color: "var(--negative)" },
    { label: "Neto",     value: net, color: net < 0 ? "var(--negative)" : "var(--ink)" },
  ];

  return (
    <div
      className="glass enter-up"
      style={{ padding: 0, overflow: "hidden", display: "flex" }}
      data-delay="2"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: 1,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: i === 0 ? "flex-start" : i === 2 ? "flex-end" : "center",
            borderLeft: i > 0 ? "0.5px solid var(--glass-border-dim)" : "none",
          }}
        >
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--ink-dim)",
          }}>
            {item.label}
          </span>
          <span
            className="display"
            style={{
              fontSize: "clamp(1rem, 3.8vw, 1.25rem)",
              fontWeight: 700,
              color: item.color,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {sym} {compact(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
