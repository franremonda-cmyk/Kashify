"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "GBP", "CHF"];
const STEPS = 5;

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
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
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === step ? 24 : 6,
            height: 6,
            background: i === step
              ? "var(--accent)"
              : i < step
              ? "var(--ink-muted)"
              : "var(--glass-1)",
            border: "0.5px solid var(--glass-border)",
          }}
        />
      ))}
    </div>
  );
}

type Step = 0 | 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [extraCurrencies, setExtraCurrencies] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  // Pre-fill name from Google auth and skip if returning user
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      // Check if user already has transactions (returning user)
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count ?? 0) > 0) {
        router.replace("/dashboard");
        return;
      }

      // Pre-fill name from Google
      const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
      if (googleName) setName(googleName);

      setChecking(false);
    }
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCurrency(c: string) {
    if (c === currency) return;
    setExtraCurrencies((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

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
    0: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4"
            style={{
              background: "linear-gradient(135deg, var(--accent), rgba(0,200,83,0.4))",
              color: "#060C09",
              boxShadow: "0 0 40px var(--accent-glow)",
            }}
          >
            K
          </div>
          <h1 className="display font-bold text-2xl" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Bienvenido a Kashify
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            Tardás menos de 90 segundos. ¿Cómo te llamás?
          </p>
        </div>
        <input
          style={inp}
          placeholder="Tu nombre o apodo"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
        />
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--ink-muted)" }}>Moneda principal</p>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: currency === c ? "var(--accent)" : "var(--glass-1)",
                  color: currency === c ? "#060C09" : "var(--ink-muted)",
                  border: currency === c ? "none" : "0.5px solid var(--glass-border)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),

    1: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <h2 className="display font-bold text-xl" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            ¿Con qué monedas operás?
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            Kashify mantiene saldos independientes. Seleccioná las que usás.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.filter((c) => c !== currency).map((c) => (
            <button
              key={c}
              onClick={() => toggleCurrency(c)}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: extraCurrencies.includes(c) ? "rgba(0,200,83,0.15)" : "var(--glass-1)",
                color: extraCurrencies.includes(c) ? "var(--accent)" : "var(--ink-muted)",
                border: extraCurrencies.includes(c)
                  ? "0.5px solid var(--glass-border-hover)"
                  : "0.5px solid var(--glass-border)",
              }}
            >
              {extraCurrencies.includes(c) ? "✓ " : ""}{c}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          Tu moneda principal ({currency}) ya está activada.
        </p>
      </div>
    ),

    2: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <h2 className="display font-bold text-xl" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Categorías listas
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            Kashify te crea las categorías más comunes automáticamente. Podés editarlas después.
          </p>
        </div>
        <div className="glass p-4 flex flex-col gap-2">
          {["Comida", "Transporte", "Ocio", "Hogar", "Salud", "Educación", "Indumentaria", "Trabajo"].map((cat) => (
            <div key={cat} className="flex items-center gap-3 py-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent-soft)", border: "0.5px solid var(--glass-border)" }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
              </div>
              <span className="text-sm" style={{ color: "var(--ink)" }}>{cat}</span>
            </div>
          ))}
        </div>
      </div>
    ),

    3: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <h2 className="display font-bold text-xl" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Conectá WhatsApp
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            Neo va a recibir tus mensajes en este número. Podés agregarlo después desde Perfil.
          </p>
        </div>
        <div className="glass-elevated p-5 flex flex-col gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.15)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#25d366" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <input
            style={inp}
            placeholder="+54 9 11 1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
          <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
            Neo te va a confirmar la vinculación enviándote un mensaje.
          </p>
        </div>
        <button
          onClick={next}
          className="text-sm font-medium"
          style={{ color: "var(--ink-muted)" }}
        >
          Omitir por ahora →
        </button>
      </div>
    ),

    4: (
      <div className="flex flex-col gap-6 items-center text-center scale-up">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, var(--accent), rgba(0,200,83,0.3))",
            boxShadow: "0 0 60px var(--accent-glow)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#060C09" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <h2
            className="display font-bold text-2xl"
            style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}
          >
            Todo listo, {name.split(" ")[0]}
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            Neo está esperando tu primer mensaje.
            Escribile "hola" por WhatsApp para empezar.
          </p>
        </div>
        <div className="glass p-4 w-full text-left flex flex-col gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>Ejemplo rápido</p>
          {["Almuerzo 850", "Netflix 2990 ocio", "Sueldo 500000 ingreso"].map((msg) => (
            <div
              key={msg}
              className="text-sm px-3 py-2 rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
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
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold"
          style={{ background: "var(--accent)", color: "#060C09", animation: "pulse-glow 1.5s ease-in-out infinite" }}
        >
          K
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: "var(--accent)", color: "#060C09" }}
        >
          K
        </div>
        <span className="display font-semibold text-sm" style={{ color: "var(--ink)" }}>
          Kashify
        </span>
      </div>

      <ProgressDots step={step} />

      {/* Contenido del paso */}
      {STEP_CONTENT[step]}

      {/* Acciones */}
      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{
              background: "var(--glass-1)",
              border: "0.5px solid var(--glass-border)",
              color: "var(--ink-muted)",
            }}
          >
            ← Atrás
          </button>
        )}

        {step < STEPS - 1 ? (
          <button
            onClick={next}
            disabled={step === 0 && !name.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 lift"
            style={{ background: "var(--accent)", color: "#060C09" }}
          >
            Continuar →
          </button>
        ) : (
          <button
            onClick={finishOnboarding}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 lift"
            style={{
              background: "var(--accent)",
              color: "#060C09",
              boxShadow: "0 0 24px var(--accent-glow)",
            }}
          >
            {saving ? "Entrando..." : "Ir al Dashboard →"}
          </button>
        )}
      </div>
    </div>
  );
}
