import { ImageResponse } from "next/og";

export const alt = "Kashify — Tus finanzas, por WhatsApp. Con Neo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "92px",
          background: "#121517",
          backgroundImage:
            "radial-gradient(ellipse 90% 60% at 18% -10%, rgba(46,180,130,0.22) 0%, transparent 55%)",
          color: "#EDF1EF",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 116,
              height: 116,
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(150deg, #34C58E 0%, #1F9468 60%, #157053 100%)",
            }}
          >
            <span style={{ fontSize: 76, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1 }}>K</span>
          </div>
          <span style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.04em" }}>Kashify</span>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Tus finanzas, claras y al día.
          </span>
          <span style={{ fontSize: 34, color: "rgba(237,241,239,0.62)", marginTop: 20 }}>
            Cargá gastos por WhatsApp. Neo, tu asistente, ordena todo.
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
