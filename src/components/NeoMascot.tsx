"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NeoOrb from "./NeoOrb";
import { canSpeak, pickLine, type NeoLine, type NeoMood } from "@/lib/neo/mascot-bus";

// Cuando Fran suba el set de PNGs a /public/neo/ (neo-idle.png, neo-happy.png, …)
// poner esto en true. ponytail: un flag, no un loader de assets.
const NEO_ART = false;

const LAST_LINE_KEY = "neo_last_line_at";

/** Carita placeholder (ojos + boca) sobre el orbe. Pensada para orbes ~104px.
 *  Reutilizada por el hero del chat en mobile (donde la mascota fija se oculta). */
export function NeoFace() {
  return (
    <span className="neo-face" aria-hidden>
      <span className="neo-face__eye neo-face__eye--l" />
      <span className="neo-face__eye neo-face__eye--r" />
      <span className="neo-face__mouth" />
    </span>
  );
}

/**
 * Personaje Neo. Montado UNA vez en el layout. Fijo, decorativo salvo el
 * personaje (botón → /neo) y el globito. En ≥768 vive en el sidebar y vuela al
 * centro en /neo (posición por CSS). En <768 se oculta (CSS): la página de Neo
 * usa su propio hero y los avisos su mini-avatar.
 */
export default function NeoMascot() {
  const pathname = usePathname();
  const router = useRouter();
  const onNeo = pathname.startsWith("/neo");
  const [mood, setMood] = useState<NeoMood>("idle");
  const [line, setLine] = useState<NeoLine | null>(null);

  // Bus: otros componentes cambian el humor / hacen hablar a Neo.
  useEffect(() => {
    const onMood = (e: Event) => setMood((e as CustomEvent<NeoMood>).detail ?? "idle");
    const onSay = (e: Event) => {
      const l = (e as CustomEvent<NeoLine>).detail;
      if (l) { setLine(l); setMood(l.mood); }
    };
    window.addEventListener("neo:mood", onMood);
    window.addEventListener("neo:say", onSay);
    return () => {
      window.removeEventListener("neo:mood", onMood);
      window.removeEventListener("neo:say", onSay);
    };
  }, []);

  // Voz automática al cambiar de ruta (con cadencia). Señales baratas.
  useEffect(() => {
    setLine(null);
    setMood("idle");
    if (onNeo) return; // en /neo habla el chat, no el globito

    let cancelled = false;
    (async () => {
      const lastAt = Number(localStorage.getItem(LAST_LINE_KEY) || 0);
      if (!canSpeak(Date.now(), lastAt)) return;

      const supabase = createClient();
      const [pendingRes, notifRes] = await Promise.all([
        supabase.from("pending_transactions").select("*", { count: "exact", head: true }).eq("status", "waiting"),
        supabase.from("neo_notifications").select("message, type").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const picked = pickLine({
        pathname,
        hour: new Date().getHours(),
        pendingCount: pendingRes.count ?? 0,
        latestNotif: notifRes.data ?? null,
      });
      if (cancelled || !picked) return;
      setLine(picked);
      setMood(picked.mood);
      localStorage.setItem(LAST_LINE_KEY, String(Date.now()));
    })().catch(() => {});

    return () => { cancelled = true; };
  }, [pathname, onNeo]);

  return (
    <div className="neo-mascot" data-neo-dock={onNeo ? "hero" : "sidebar"} data-mood={mood}>
      <button
        type="button"
        className="neo-mascot__char"
        aria-label="Abrir Neo"
        onClick={() => router.push("/neo")}
      >
        <span className="neo-mascot__bob">
          {NEO_ART ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/neo/neo-${mood}.png`} alt="" width={104} height={104} draggable={false} />
          ) : (
            <>
              <NeoOrb size={104} alive />
              <NeoFace />
            </>
          )}
        </span>
      </button>

      {line && !onNeo && (
        <div className="neo-mascot__bubble" role="status" aria-live="polite">
          <p className="neo-mascot__bubble-text">{line.text}</p>
          {line.cta && (
            <a className="neo-mascot__bubble-cta" href={line.cta.href}>{line.cta.label} →</a>
          )}
          <button
            type="button"
            className="neo-mascot__bubble-close"
            aria-label="Cerrar mensaje de Neo"
            onClick={() => setLine(null)}
          >✕</button>
        </div>
      )}
    </div>
  );
}
