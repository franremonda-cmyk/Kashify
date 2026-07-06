// Bus mínimo del personaje Neo. Sin librería de estado: reusa el patrón
// window.dispatchEvent que ya usa la app (open-quick-add, transaction-added).
// Otros componentes (NeoChat, dashboard) hablan por acá sin importar <NeoMascot/>.

export type NeoMood =
  | "idle" | "happy" | "celebrating" | "worried" | "curious" | "thinking" | "sleeping";

export interface NeoLine {
  text: string;
  mood: NeoMood;
  cta?: { label: string; href: string };
}

// Cadencia: como máximo una línea automática cada 3h (por navegador).
export const LINE_GAP_MS = 3 * 60 * 60 * 1000;

export function setNeoMood(mood: NeoMood) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NeoMood>("neo:mood", { detail: mood }));
}

export function sayNeo(line: NeoLine) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NeoLine>("neo:say", { detail: line }));
}

// ── Lógica pura (testeable, sin red ni React) ────────────────────────────────

export function canSpeak(now: number, lastAt: number, gapMs = LINE_GAP_MS): boolean {
  return !lastAt || now - lastAt >= gapMs;
}

function moodForNotifType(type: string): NeoMood {
  if (type === "budget_alert" || type.startsWith("alert_")) return "worried";
  if (type === "goal_reached" || type.startsWith("achievement_")) return "celebrating";
  if (type === "monthly_summary" || type === "monthly_close" || type === "spend_spike" || type.startsWith("reminder_")) return "curious";
  return "idle";
}

function greeting(hour: number): string {
  if (hour < 12) return "¡Buen día! 👋";
  if (hour < 20) return "¡Buenas tardes! 👋";
  return "¡Buenas noches! 👋";
}

export interface LineSignals {
  pathname: string;
  hour: number;                 // 0-23
  pendingCount: number;
  latestNotif: { message: string; type: string } | null;
}

/**
 * Elige QUÉ dice Neo a partir de señales baratas. Prioridad:
 * pendientes → último aviso → saludo en el inicio → nada.
 * En /neo no dice nada (el chat ya muestra su feed).
 */
export function pickLine(s: LineSignals): NeoLine | null {
  if (s.pathname.startsWith("/neo")) return null;

  if (s.pendingCount > 0) {
    return {
      text: s.pendingCount === 1
        ? "Tenés 1 registro para confirmar 👀"
        : `Tenés ${s.pendingCount} registros para confirmar 👀`,
      mood: "curious",
      cta: { label: "Ver", href: "/neo" },
    };
  }

  if (s.latestNotif) {
    return {
      text: s.latestNotif.message,
      mood: moodForNotifType(s.latestNotif.type),
      cta: { label: "Abrir Neo", href: "/neo" },
    };
  }

  if (s.pathname === "/dashboard") {
    return { text: greeting(s.hour), mood: "happy" };
  }

  return null;
}
