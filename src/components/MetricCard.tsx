interface Props {
  label: string;
  value: number;
  currencyCode: string;
  variant: "positive" | "negative" | "neutral";
  delay?: string;
}

const SYMBOLS: Record<string, string> = {
  ARS: "$", USD: "US$", EUR: "€",
};

export default function MetricCard({ label, value, currencyCode, variant, delay }: Props) {
  const color = variant === "positive"
    ? "var(--positive)"
    : variant === "negative"
    ? "var(--negative)"
    : "var(--ink)";

  const glow = variant === "positive"
    ? "rgba(105,255,218,0.08)"
    : variant === "negative"
    ? "rgba(255,83,112,0.08)"
    : "transparent";

  const symbol = SYMBOLS[currencyCode] ?? currencyCode;
  const formatted = Math.abs(value).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div
      className="glass lift flex-1 p-4 flex flex-col gap-2 enter-up"
      data-delay={delay}
      style={{ background: `linear-gradient(135deg, ${glow}, var(--glass-1))` }}
    >
      <span className="text-[11px] font-medium" style={{ color: "var(--ink-dim)" }}>
        {label}
      </span>
      <span
        className="display font-semibold leading-none"
        style={{
          fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
          color,
          letterSpacing: "-0.01em",
        }}
      >
        {symbol} {formatted}
      </span>
    </div>
  );
}
