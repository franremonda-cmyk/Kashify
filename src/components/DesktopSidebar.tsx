"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import NeoOrb from "./NeoOrb";

const NAV = [
  { href: "/dashboard", label: "Inicio",    icon: HomeIcon },
  { href: "/historial", label: "Actividad", icon: ActivityIcon },
  { href: "/neo",       label: "Neo",       icon: NeoIcon },
  { href: "/perfil",    label: "Perfil",    icon: UserIcon },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const [invited, setInvited] = useState(false);

  function openRegister() {
    window.dispatchEvent(new CustomEvent("open-quick-add", { detail: { type: "expense" } }));
  }

  async function inviteFriend() {
    const url = "https://kashify.vercel.app";
    const text = `Te invito a Kashify, la app para llevar tus finanzas hablándole a Neo por WhatsApp 💚 ${url}`;
    try {
      if (navigator.share) { await navigator.share({ title: "Kashify", text, url }); return; }
      await navigator.clipboard.writeText(text);
      setInvited(true);
      setTimeout(() => setInvited(false), 2000);
    } catch { /* usuario canceló el share */ }
  }

  return (
    <aside
      className="app-sidebar"
      style={{
        display: "none",
        flexDirection: "column",
        background: "var(--base)",
        borderRight: "0.5px solid var(--glass-border)",
        padding: "28px 0 28px",
        height: "100dvh",
        overflowY: "auto",
        zIndex: 30,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px var(--accent-glow)",
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
              fontSize: 15, fontWeight: 700, color: "#FFFFFF",
            }}>K</span>
          </div>
          <span style={{
            fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
            fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em",
          }}>Kashify</span>
        </div>
      </div>

      {/* Registrar */}
      <div style={{ padding: "0 14px 22px" }}>
        <button onClick={openRegister} className="press"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "var(--accent)", color: "#04130D", fontWeight: 700, fontSize: 14,
            boxShadow: "0 4px 16px var(--shadow-accent)",
          }}>
          <span style={{ fontSize: 19, lineHeight: 1, marginTop: -1 }}>+</span> Registrar
        </button>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 10px", flex: 1 }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                textDecoration: "none",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--ink-muted)",
                transition: "all 130ms ease-out",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <item.icon active={active} />
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, letterSpacing: "-0.01em" }}>
                {item.label}
              </span>
              {active && (
                <div style={{
                  marginLeft: "auto", width: 5, height: 5, borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 6px var(--accent-glow)",
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Invitar amigo */}
      <div style={{ padding: "0 14px 16px" }}>
        <button onClick={inviteFriend} className="press"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px", borderRadius: 12, cursor: "pointer",
            background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600, fontSize: 13,
            border: "0.5px solid var(--glass-border)",
          }}>
          {invited ? "¡Copiado! ✓" : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
              </svg>
              Invitar amigo
            </>
          )}
        </button>
      </div>

      <div style={{ padding: "0 20px" }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", letterSpacing: "0.06em", fontWeight: 600 }}>
          KASHIFY · BETA
        </p>
      </div>
    </aside>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}
function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function NeoIcon({ active }: { active: boolean }) {
  return (
    <NeoOrb size={24} alive={active}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: "#04130D", lineHeight: 1,
        letterSpacing: "-0.5px", textShadow: "0 1px 1px rgba(255,255,255,0.3)",
      }}>N</span>
    </NeoOrb>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
