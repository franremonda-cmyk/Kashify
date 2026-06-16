"use client";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <main
      className="min-h-dvh flex items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "var(--void)" }}
    >
      {/* Environmental glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 0%,   rgba(0,200,83,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 80% 100%, rgba(0,80,40,0.08)  0%, transparent 60%)
          `,
        }}
      />

      <div className="relative w-full max-w-xs flex flex-col gap-10 scale-up">
        {/* Wordmark */}
        <div className="flex flex-col gap-2">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, var(--accent), rgba(0,200,83,0.5))",
              color: "#060C09",
              boxShadow: "0 0 32px var(--accent-glow)",
            }}
          >
            K
          </div>
          <div>
            <h1
              className="display font-bold"
              style={{ fontSize: "1.75rem", color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              Kashify
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Tus finanzas, por WhatsApp
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div className="glass-strong p-6 flex flex-col gap-5">
          <div>
            <p className="font-medium" style={{ color: "var(--ink)" }}>Bienvenido</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Ingresá para ver tus finanzas
            </p>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-medium text-sm lift"
            style={{
              background: "var(--glass-2)",
              border: "0.5px solid var(--glass-border)",
              color: "var(--ink)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--glass-border-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--glass-border)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <p className="text-[11px] text-center" style={{ color: "var(--ink-dim)" }}>
            Al continuar, aceptás los términos de uso
          </p>
        </div>

        {/* Bottom accent */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
          <span className="text-[11px]" style={{ color: "var(--ink-dim)" }}>Neo te espera</span>
          <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
        </div>
      </div>
    </main>
  );
}
