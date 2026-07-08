"use client";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import NeoOrb from "./NeoOrb";

const NAV = [
  { href: "/dashboard", label: "Inicio",    icon: HomeIcon },
  { href: "/historial", label: "Actividad", icon: ActivityIcon },
  { href: "/neo",       label: "Neo",       icon: NeoIcon },
  { href: "/espacios",  label: "Espacios",  icon: SpacesIcon },
  { href: "/perfil",    label: "Perfil",    icon: UserIcon },
];

const PERFIL_SUBS = [
  { id: "datos",      label: "Datos personales" },
  { id: "apariencia", label: "Apariencia" },
  { id: "avisos",     label: "Avisos de Neo" },
  { id: "categorias", label: "Categorías" },
  { id: "metas",      label: "Metas de ahorro" },
  { id: "cuotas",     label: "Cuotas" },
];

// Las páginas standalone de seguimiento pertenecen a Perfil en el árbol del
// sidebar — sin esto, en /metas /cuotas /categorias nada queda marcado activo.
const SUB_PATHS: Record<string, string> = {
  "/categorias": "categorias", "/metas": "metas", "/cuotas": "cuotas",
};

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subFromPath = SUB_PATHS[pathname];
  const onPerfil = pathname.startsWith("/perfil") || !!subFromPath;
  const activeSection = subFromPath ?? searchParams.get("section") ?? "datos";
  const [perfilOpen, setPerfilOpen] = useState(onPerfil);
  const [invited, setInvited] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // Publica el centro del dock a variables CSS para que la mascota se pare
  // exacto ahí, sin depender de la constante --neo-dock-bottom.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const publish = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return; // display:none en mobile → mantiene el fallback
      const root = document.documentElement.style;
      root.setProperty("--neo-dock-x", `${Math.round(r.left + r.width / 2)}px`);
      root.setProperty("--neo-dock-y", `${Math.round(r.top + r.height / 2)}px`);
    };
    publish();
    window.addEventListener("resize", publish);
    return () => window.removeEventListener("resize", publish);
  }, []);

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
          <span className="sidebar-label" style={{
            fontFamily: "var(--font-display, 'Space Grotesk'), sans-serif",
            fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em",
          }}>Kashify</span>
        </div>
      </div>

      {/* Registrar */}
      <div style={{ padding: "0 14px 22px" }}>
        <button onClick={openRegister} className="press" aria-label="Registrar movimiento"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "var(--accent)", color: "#04130D", fontWeight: 700, fontSize: 14,
            boxShadow: "0 4px 16px var(--shadow-accent)",
          }}>
          <span style={{ fontSize: 19, lineHeight: 1, marginTop: -1 }}>+</span>
          <span className="sidebar-label">Registrar</span>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 10px", flex: 1 }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          const rowStyle: React.CSSProperties = {
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10, textDecoration: "none",
            background: active ? "var(--accent-soft)" : "transparent",
            color: active ? "var(--accent)" : "var(--ink-muted)",
            transition: "all 130ms ease-out",
          };

          // Perfil: desplegable con sub-secciones (master-detail)
          if (item.href === "/perfil") {
            return (
              <div key="/perfil">
                <button
                  onClick={() => { if (onPerfil) setPerfilOpen(o => !o); else { setPerfilOpen(true); router.push("/perfil"); } }}
                  aria-label={item.label}
                  style={{ ...rowStyle, width: "100%", border: "none", cursor: "pointer" }}>
                  <item.icon active={active} />
                  <span className="nav-label" style={{ fontSize: 14, fontWeight: active ? 600 : 400, letterSpacing: "-0.01em" }}>{item.label}</span>
                  <svg className="sidebar-label" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    style={{ marginLeft: "auto", color: "var(--ink-dim)", transition: "transform 200ms", transform: perfilOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {perfilOpen && (
                  <div className="sidebar-subs" style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 18, marginTop: 2, marginBottom: 4 }}>
                    {PERFIL_SUBS.map((s) => {
                      const subActive = onPerfil && activeSection === s.id;
                      return (
                        <Link key={s.id} href={`/perfil?section=${s.id}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8,
                            textDecoration: "none", fontSize: 13, fontWeight: subActive ? 600 : 400,
                            background: subActive ? "var(--accent-soft)" : "transparent",
                            color: subActive ? "var(--accent)" : "var(--ink-muted)",
                          }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: subActive ? "var(--accent)" : "var(--glass-border-hover)", flexShrink: 0 }} />
                          {s.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              style={rowStyle}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--raised)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <item.icon active={active} />
              <span className="nav-label" style={{ fontSize: 14, fontWeight: active ? 600 : 400, letterSpacing: "-0.01em" }}>
                {item.label}
              </span>
              {active && (
                <div className="sidebar-label" style={{
                  marginLeft: "auto", width: 5, height: 5, borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 6px var(--accent-glow)",
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Dock de la mascota Neo — reserva aire para que flote acá sin pisar
          los botones de abajo. La mascota es fija (vive en NeoMascot). */}
      <div ref={dockRef} className="neo-dock-slot" aria-hidden />

      {/* Invitar amigo */}
      <div style={{ padding: "0 14px 16px" }}>
        <button onClick={inviteFriend} className="press" aria-label="Invitar amigo" title="Invitar amigo"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px", borderRadius: 12, cursor: "pointer",
            background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600, fontSize: 13,
            border: "0.5px solid var(--glass-border)",
          }}>
          {invited ? "✓" : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
              </svg>
              <span className="sidebar-label">Invitar amigo</span>
            </>
          )}
        </button>
      </div>

      <div className="sidebar-label" style={{ padding: "0 20px" }}>
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
function SpacesIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}
