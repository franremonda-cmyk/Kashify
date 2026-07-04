"use client";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

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
            radial-gradient(ellipse 70% 44% at 50% -6%, rgba(46,180,130,0.10) 0%, transparent 58%),
            radial-gradient(ellipse 50% 34% at 84% 104%, rgba(46,180,130,0.05) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative w-full max-w-sm flex flex-col items-center gap-9 scale-up">
        {/* Logo lockup */}
        <Logo size={56} className="enter-up" />

        {/* Neo da la bienvenida */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/neo/neo-happy.png"
          alt=""
          width={112}
          height={112}
          draggable={false}
          className="float-bob enter-up"
          style={{ marginBottom: -12 }}
        />

        {/* Headline */}
        <div className="text-center" style={{ padding: "0 8px" }}>
          <h1 className="display font-bold" style={{ fontSize: "2.1rem", color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Tus finanzas,<br/><span style={{ color: "var(--accent)" }}>claras y al día.</span>
          </h1>
          <p className="mt-3" style={{ fontSize: 15, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            Cargá gastos por WhatsApp y dejá que Neo, tu asistente, ordene todo por vos.
          </p>
        </div>

        {/* Card */}
        <div className="card-v2 w-full flex flex-col gap-4" style={{ padding: 20 }}>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 lift"
            style={{
              minHeight: 52, borderRadius: 16, fontWeight: 600, fontSize: 15,
              background: "var(--ink)", color: "var(--void)", border: "none", cursor: "pointer",
            }}
          >
            <span style={{ background: "#fff", borderRadius: 6, padding: 3, display: "inline-flex" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </span>
            Continuar con Google
          </button>

          <p className="text-center" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
            Al continuar, aceptás los términos de uso
          </p>
        </div>
      </div>
    </main>
  );
}
