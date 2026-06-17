"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "GBP", "CHF"];
const STEPS = 3;

const inp: React.CSSProperties = {
  background: "var(--raised)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 14,
  padding: "14px 16px",
  color: "var(--ink)",
  fontSize: 15,
  width: "100%",
  outline: "none",
};

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: STEPS }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 24 : 6, height: 6, borderRadius: 999,
          background: i === step ? "var(--accent)" : i < step ? "var(--ink-dim)" : "var(--glass-border)",
          transition: "all 280ms cubic-bezier(0.22,1,0.36,1)",
        }} />
      ))}
    </div>
  );
}

type Step = 0 | 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>(0);
  const [name, setName]         = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [phone, setPhone]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count ?? 0) > 0) { router.replace("/dashboard"); return; }

      const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
      if (googleName) setName(googleName);
      setChecking(false);
    }
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function finishOnboarding() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: name.trim(),
      primary_currency: currency,
    });

    if (phone.trim()) {
      await supabase.from("user_phones").insert({ phone_number: phone.trim(), verified: false });
    }

    router.push("/dashboard");
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1) as Step);
  const back = () => setStep((s) => Math.max(s - 1, 0) as Step);

  const STEP_CONTENT: Record<Step, React.ReactNode> = {
    /* ── Paso 1: nombre + moneda ────────────── */
    0: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <div style={{
            width: 52, height: 52, borderRadius: 16, marginBottom: 16,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px var(--accent-glow)",
          }}>
            <span className="display" style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>K</span>
          </div>
          <h1 className="display font-bold" style={{ fontSize: "1.75rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Bienvenido a Kashify
          </h1>
          <p style={{ fontSize: 14, marginTop: 8, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            Menos de un minuto para empezar.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            style={inp}
            placeholder="¿Cómo te llamás?"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
          />

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 8 }}>Moneda principal</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {CURRENCIES.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  style={{
                    padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: currency === c ? "var(--accent)" : "var(--raised)",
                    color: currency === c ? "#FFFFFF" : "var(--ink-muted)",
                    border: currency === c ? "none" : "0.5px solid var(--glass-border)",
                    transition: "all 180ms cubic-bezier(0.22,1,0.36,1)",
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    /* ── Paso 2: WhatsApp ────────────────────── */
    1: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <div style={{
            width: 48, height: 48, borderRadius: 14, marginBottom: 16,
            background: "rgba(37,211,102,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#25d366" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="display font-bold" style={{ fontSize: "1.45rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Conectá WhatsApp
          </h2>
          <p style={{ fontSize: 13, marginTop: 8, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            Mandále un mensaje a Neo y él registra el gasto automáticamente. Podés saltear esto.
          </p>
        </div>

        <input
          style={inp}
          placeholder="+54 9 11 1234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
        />

        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "var(--accent-soft)",
          border: "0.5px solid var(--accent-glow)",
        }}>
          <p style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono, monospace)" }}>
            "Almuerzo 1500"
          </p>
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>
            Así de fácil — Neo lo categoriza y registra solo.
          </p>
        </div>
      </div>
    ),

    /* ── Paso 3: todo listo ─────────────────── */
    2: (
      <div className="flex flex-col gap-6 items-center text-center scale-up">
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 48px var(--accent-glow)",
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <h2 className="display font-bold" style={{ fontSize: "1.6rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Todo listo{name ? `, ${name.split(" ")[0]}` : ""}
          </h2>
          <p style={{ fontSize: 13, marginTop: 8, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            {phone.trim()
              ? "Neo está esperando tu primer mensaje. Escribile por WhatsApp para empezar."
              : "Podés registrar gastos desde el ✚ o hablarle a Neo desde la app."}
          </p>
        </div>
        <div style={{
          width: "100%", padding: "14px 16px", borderRadius: 14,
          background: "var(--base)", border: "0.5px solid var(--glass-border)",
          boxShadow: "var(--shadow-sm)", textAlign: "left",
        }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 8 }}>Empezá con</p>
          {["Almuerzo 850", "Netflix 2990 ocio", "Sueldo 500000 ingreso"].map((msg) => (
            <div key={msg} style={{
              fontSize: 12, padding: "7px 12px", borderRadius: 10, marginBottom: 5,
              background: "var(--accent-soft)", color: "var(--accent)",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {msg}
            </div>
          ))}
        </div>
      </div>
    ),
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: "var(--accent)", color: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700,
          animation: "pageFade 600ms ease-in-out infinite alternate",
        }}>K</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#FFFFFF",
        }}>K</div>
        <span className="display font-semibold" style={{ fontSize: 14, color: "var(--ink)" }}>Kashify</span>
      </div>

      <ProgressDots step={step} />

      {STEP_CONTENT[step]}

      {/* Navegación */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={back}
            style={{
              flex: 1, padding: "13px", borderRadius: 14, fontSize: 13, fontWeight: 500,
              background: "var(--raised)", border: "0.5px solid var(--glass-border)",
              color: "var(--ink-muted)",
            }}>
            ← Atrás
          </button>
        )}

        {/* Paso 2 (WhatsApp): opción de saltear */}
        {step === 1 && (
          <button onClick={next}
            style={{
              padding: "13px 16px", borderRadius: 14, fontSize: 13, fontWeight: 500,
              background: "transparent", color: "var(--ink-dim)",
            }}>
            Saltear
          </button>
        )}

        {step < STEPS - 1 ? (
          <button onClick={next}
            disabled={step === 0 && !name.trim()}
            className="lift"
            style={{
              flex: 1, padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600,
              background: "var(--accent)", color: "#FFFFFF",
              opacity: step === 0 && !name.trim() ? 0.35 : 1,
            }}>
            Continuar →
          </button>
        ) : (
          <button onClick={finishOnboarding} disabled={saving}
            className="lift"
            style={{
              flex: 1, padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600,
              background: "var(--accent)", color: "#FFFFFF",
              boxShadow: "0 0 28px var(--accent-glow)",
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? "Entrando..." : "Ir al Dashboard →"}
          </button>
        )}
      </div>
    </div>
  );
}
