"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import Logo, { LogoMark } from "@/components/Logo";
const ImportFlow = dynamic(() => import("@/components/ImportFlow"), { ssr: false });

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "GBP", "CHF"];
const STEPS = 4;

// Normaliza un teléfono al formato exacto que WhatsApp manda en `message.from`
// para celulares argentinos: 549 + área + número. El worker hace el lookup por
// ese valor, así que guardamos canónico para que coincida siempre.
// (App AR-only por ahora — el placeholder es +54 9 11…)
function toWhatsappFrom(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);        // prefijo internacional 00
  if (d.startsWith("0")) d = d.slice(1);         // trunk nacional AR (0)
  if (d.startsWith("549")) return d;             // ya canónico
  if (d.startsWith("54")) return "549" + d.slice(2);
  return "549" + d;                              // número local sin código de país
}

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

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]           = useState<Step>(0);
  const [name, setName]           = useState("");
  const [currency, setCurrency]   = useState("ARS");
  const [phone, setPhone]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [checking, setChecking]   = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

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

    const phoneDigits = toWhatsappFrom(phone);
    if (phoneDigits) {
      await supabase.from("user_phones").insert({
        user_id: user.id,
        phone_number: phoneDigits,
        verified: true,
      });
      // La bienvenida la inicia el usuario tocando "Activar Neo en WhatsApp"
      // (link wa.me) en el paso final → conversación gratis, sin template.
    }

    // Usuario nuevo: habilitar el tour guiado una sola vez en el dashboard
    try { localStorage.setItem("kashify-tour-pending", "1"); } catch {}

    router.push("/dashboard");
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1) as Step);
  const back = () => setStep((s) => Math.max(s - 1, 0) as Step);

  const STEP_CONTENT: Record<Step, React.ReactNode> = {
    /* ── Paso 0: nombre + moneda ────────────── */
    0: (
      <div className="flex flex-col gap-6 scale-up">
        <div>
          <div style={{ marginBottom: 16 }}><LogoMark size={52} /></div>
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
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 8 }}>Moneda principal</p>
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

    /* ── Paso 1: WhatsApp ────────────────────── */
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
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
            Así de fácil — Neo lo categoriza y registra solo.
          </p>
        </div>
      </div>
    ),

    /* ── Paso 2: Importar o empezar de cero ─── */
    2: (
      <div className="flex flex-col gap-5 scale-up">
        {showImport ? (
          <ImportFlow
            inline
            defaultCurrency={currency}
            onDone={(count) => {
              setImportedCount(count);
              setShowImport(false);
              next();
            }}
            onCancel={() => setShowImport(false)}
          />
        ) : (
          <>
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 14, marginBottom: 16,
                background: "var(--accent-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent)",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <h2 className="display font-bold" style={{ fontSize: "1.4rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
                ¿Tenés movimientos anteriores?
              </h2>
              <p style={{ fontSize: 13, marginTop: 8, color: "var(--ink-muted)", lineHeight: 1.5 }}>
                Podés importar tu historial desde Excel o CSV, o empezar de cero ahora mismo.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Import option */}
              <button
                onClick={() => setShowImport(true)}
                style={{
                  padding: "16px", borderRadius: 16, textAlign: "left",
                  background: "var(--raised)", border: "0.5px solid var(--glass-border)",
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "all 180ms ease-out",
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Importar archivo</p>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>Excel · CSV · Planilla de banco</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--ink-dim)", marginLeft: "auto", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {/* Start from scratch */}
              <button
                onClick={next}
                style={{
                  padding: "16px", borderRadius: 16, textAlign: "left",
                  background: "transparent", border: "0.5px solid var(--glass-border)",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--raised)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Empezar de cero</p>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>Neo registra todo desde hoy</p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    ),

    /* ── Paso 3: todo listo ─────────────────── */
    3: (
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
            {importedCount > 0
              ? `${importedCount} movimiento${importedCount !== 1 ? "s" : ""} importado${importedCount !== 1 ? "s" : ""}. Kashify ya tiene tu historial.`
              : phone.trim()
              ? "Neo está esperando tu primer mensaje. Escribile por WhatsApp para empezar."
              : "Podés registrar gastos desde el ✚ o hablarle a Neo desde la app."}
          </p>
        </div>
        {phone.trim() && (
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "15556597324"}?text=${encodeURIComponent("Hola Neo 👋")}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px", borderRadius: 14, textDecoration: "none",
              background: "#25D366", color: "#FFFFFF", fontWeight: 700, fontSize: 15,
              boxShadow: "0 6px 20px rgba(37,211,102,0.35)",
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.043zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            Activar Neo en WhatsApp
          </a>
        )}
        {importedCount === 0 && (
          <div style={{
            width: "100%", padding: "14px 16px", borderRadius: 14,
            background: "var(--base)", border: "0.5px solid var(--glass-border)",
            boxShadow: "var(--shadow-sm)", textAlign: "left",
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 8 }}>Empezá con</p>
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
        )}
      </div>
    ),
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: "var(--accent)", color: "#04130D",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700,
          animation: "pageFade 600ms ease-in-out infinite alternate",
        }}>K</div>
      </div>
    );
  }

  // In step 2 with import open, hide the outer nav buttons
  const hideNav = step === 2 && showImport;

  return (
    <div className="flex flex-col gap-8">
      <Logo size={26} />

      <ProgressDots step={step} />

      {STEP_CONTENT[step]}

      {!hideNav && (
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

          {/* Paso 1 (WhatsApp): opción de saltear */}
          {step === 1 && (
            <button onClick={next}
              style={{
                padding: "13px 16px", borderRadius: 14, fontSize: 13, fontWeight: 500,
                background: "transparent", color: "var(--ink-dim)",
              }}>
              Saltear
            </button>
          )}

          {/* Paso 2 (importar): no muestra botón "Continuar" ya que las opciones actúan de nav */}
          {step !== 2 && (
            step < STEPS - 1 ? (
              <button onClick={next}
                disabled={step === 0 && !name.trim()}
                className="lift"
                style={{
                  flex: 1, padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600,
                  background: "var(--accent)", color: "#04130D",
                  opacity: step === 0 && !name.trim() ? 0.35 : 1,
                }}>
                Continuar →
              </button>
            ) : (
              <button onClick={finishOnboarding} disabled={saving}
                className="lift"
                style={{
                  flex: 1, padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600,
                  background: "var(--accent)", color: "#04130D",
                  boxShadow: "0 0 28px var(--accent-glow)",
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? "Entrando..." : "Ir al Dashboard →"}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
