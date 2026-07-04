// Self-check de la voz del personaje Neo (pickLine + cadencia). No toca red.
// Correr: npx tsx cloudflare-worker/test/mascot.test.ts
import { pickLine, canSpeak, LINE_GAP_MS } from "../../src/lib/neo/mascot-bus.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// ── cadencia ──
ok(canSpeak(1_000_000, 0) === true, "sin última vez → puede hablar");
ok(canSpeak(LINE_GAP_MS + 10, 5) === true, "pasó el gap → puede hablar");
ok(canSpeak(1000, 900) === false, "dentro del gap → calla");

// ── prioridad: pendientes primero ──
const p = pickLine({ pathname: "/dashboard", hour: 9, pendingCount: 2, latestNotif: { message: "x", type: "budget_alert" } });
ok(p?.text.includes("2 registros") && p?.mood === "curious" && p?.cta?.href === "/neo", "pendientes ganan y llevan a /neo");

// ── un solo pendiente (singular) ──
ok(pickLine({ pathname: "/dashboard", hour: 9, pendingCount: 1, latestNotif: null })?.text === "Tenés 1 registro para confirmar 👀", "singular ok");

// ── aviso cuando no hay pendientes; mood según tipo ──
const n = pickLine({ pathname: "/historial", hour: 9, pendingCount: 0, latestNotif: { message: "Superaste el límite", type: "budget_alert" } });
ok(n?.text === "Superaste el límite" && n?.mood === "worried", "aviso budget → worried");
ok(pickLine({ pathname: "/x", hour: 9, pendingCount: 0, latestNotif: { message: "meta!", type: "goal_reached" } })?.mood === "celebrating", "goal_reached → celebrating");

// ── saludo solo en dashboard, por hora ──
ok(pickLine({ pathname: "/dashboard", hour: 8, pendingCount: 0, latestNotif: null })?.text.includes("Buen día"), "mañana → buen día");
ok(pickLine({ pathname: "/dashboard", hour: 21, pendingCount: 0, latestNotif: null })?.text.includes("Buenas noches"), "noche → buenas noches");
ok(pickLine({ pathname: "/dashboard", hour: 8, pendingCount: 0, latestNotif: null })?.mood === "happy", "saludo → happy");

// ── /neo calla siempre; otras rutas sin nada → null ──
ok(pickLine({ pathname: "/neo", hour: 9, pendingCount: 5, latestNotif: { message: "x", type: "x" } }) === null, "en /neo no habla");
ok(pickLine({ pathname: "/perfil", hour: 9, pendingCount: 0, latestNotif: null }) === null, "sin señales fuera de dashboard → null");

console.log(`✓ mascota Neo: ${pass} asserts OK`);
