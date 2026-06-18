import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PendingList from "@/components/PendingList";
import type { PendingTransaction } from "@/types";

export default async function NeoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [pendingRes, recentRes, phonesRes] = await Promise.all([
    supabase.from("pending_transactions").select("*").eq("user_id", user.id)
      .eq("status", "waiting").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("transactions").select("description, amount, currency_code, type, date, categories(name, icon)")
      .eq("user_id", user.id).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("user_phones").select("*").eq("user_id", user.id),
  ]);

  const pending = pendingRes.data ?? [];
  const recent  = recentRes.data ?? [];
  const phones  = phonesRes.data ?? [];
  const hasPhone = phones.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 enter-up">
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px var(--accent-glow)",
          flexShrink: 0,
        }}>
          <span className="display" style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>N</span>
        </div>
        <div>
          <h1 className="display font-semibold" style={{ fontSize: "1.25rem", color: "var(--ink)" }}>
            Neo
          </h1>
          <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>
            Tu asistente financiero por WhatsApp
          </p>
        </div>
        <div className="ml-auto" style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 999,
          background: "var(--accent-soft)",
          border: "0.5px solid var(--accent-glow)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)" }}>Activo</span>
        </div>
      </div>

      {/* WhatsApp connect card */}
      {!hasPhone ? (
        <div className="glass-elevated p-5 flex flex-col gap-3 enter-up" data-delay="1">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(37,211,102,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#25d366" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Conectá WhatsApp</p>
              <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>Para que Neo reciba tus mensajes</p>
            </div>
          </div>
          <Link href="/perfil" style={{
            display: "block", textAlign: "center",
            padding: "10px", borderRadius: 12,
            background: "var(--accent)", color: "#FFFFFF",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>
            Agregar número →
          </Link>
        </div>
      ) : (
        <div className="glass p-4 flex items-center gap-3 enter-up" data-delay="1" style={{ borderRadius: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--positive)", boxShadow: "0 0 8px rgba(52,199,89,0.35)" }} />
          <div>
            <p style={{ fontSize: 12, color: "var(--ink)" }}>Conectado: {phones[0]?.phone_number}</p>
            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              {phones[0]?.verified ? "Verificado" : "Verificación pendiente"}
            </p>
          </div>
        </div>
      )}

      {/* Cómo hablarle a Neo */}
      <div className="glass p-4 flex flex-col gap-3 enter-up" data-delay="2" style={{ borderRadius: 18 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)" }}>
          Cómo hablarle a Neo
        </p>
        {[
          { msg: "Almuerzo 1500",             desc: "Registra un gasto" },
          { msg: "Netflix 2990 ocio",          desc: "Con categoría" },
          { msg: "Sueldo 800000 ingreso",      desc: "Registra un ingreso" },
          { msg: "Cuotas heladera 6x20000",    desc: "Cuotas en pesos" },
        ].map(({ msg, desc }) => (
          <div key={msg} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1, padding: "7px 12px", borderRadius: 10,
              background: "var(--accent-soft)", fontSize: 12,
              color: "var(--accent)", fontFamily: "var(--font-mono, monospace)",
            }}>
              {msg}
            </div>
            <p style={{ fontSize: 10, color: "var(--ink-dim)", width: 90, flexShrink: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Pendientes de confirmación */}
      {pending.length > 0 && (
        <div className="enter-up" data-delay="3">
          <PendingList pending={pending as unknown as PendingTransaction[]} />
        </div>
      )}

      {/* Últimos registros */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-2 enter-up" data-delay="4">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-dim)", paddingLeft: 4 }}>
            Últimos registros
          </p>
          <div className="glass flex flex-col" style={{ borderRadius: 18 }}>
            {recent.slice(0, 8).map((t, i) => {
              const isIncome = t.type === "income";
              return (
                <div key={i} style={{
                  padding: "11px 16px",
                  borderBottom: i < Math.min(recent.length, 8) - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: isIncome ? "var(--positive)" : "var(--negative)",
                  }} />
                  <p style={{ flex: 1, fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{t.description}</p>
                  <p style={{
                    fontSize: 12, fontWeight: 600,
                    color: isIncome ? "var(--positive)" : "var(--ink)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recent.length === 0 && pending.length === 0 && hasPhone && (
        <div className="glass p-8 text-center enter-up" data-delay="3" style={{ borderRadius: 20 }}>
          <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Todo tranquilo por acá</p>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
            Neo procesará tus mensajes en tiempo real
          </p>
        </div>
      )}
    </div>
  );
}
