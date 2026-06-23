interface LogoProps {
  size?: number;       // mark size in px
  showWordmark?: boolean;
  className?: string;
}

/** Kashify logo — emerald mark (K with an upward/growth stroke) + wordmark. */
export default function Logo({ size = 40, showWordmark = true, className }: LogoProps) {
  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="display"
          style={{
            fontWeight: 700,
            fontSize: size * 0.72,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          Kashify
        </span>
      )}
    </div>
  );
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"
      style={{ display: "block", filter: "drop-shadow(0 4px 14px var(--shadow-accent))" }}>
      <defs>
        <linearGradient id="kashify-mark" x1="8" y1="6" x2="92" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34C58E" />
          <stop offset="0.58" stopColor="#1F9468" />
          <stop offset="1" stopColor="#157053" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="url(#kashify-mark)" />
      <g stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M37 25 V75" />
        <path d="M37 53 L65 25" />
        <path d="M45 48 L67 75" />
      </g>
    </svg>
  );
}
