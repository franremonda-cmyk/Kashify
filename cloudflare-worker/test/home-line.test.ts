// Lo que Neo dice en Inicio: prioridad y voz.
// Correr: npx tsx cloudflare-worker/test/home-line.test.ts
import { buildHomeLines, moodForTone } from "../../src/lib/neo/home-line.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

const base = { income: 0, expense: 0, dayOfMonth: 15, daysInMonth: 30, sym: "$" };

// ── Prioridad: lo que puede pasarte va antes que el contexto ──
const riesgo = buildHomeLines({ ...base, income: 100_000, expense: 80_000 });
ok(riesgo[0].id === "pace_over_income", "proyección por encima del ingreso va primero");
ok(riesgo[0].tone === "warn", "esa línea avisa (warn)");

const conCuotas = buildHomeLines({ ...base, income: 500_000, expense: 100_000, upcoming: { total: 45_000, count: 3 } });
ok(conCuotas[0].id === "upcoming", "sin riesgo de ritmo, mandan las cuotas (tienen vencimiento)");
ok(/vencen 3 cuotas/.test(conCuotas[0].text), "plural correcto con 3 cuotas");
ok(/vence 1 cuota/.test(buildHomeLines({ ...base, upcoming: { total: 1, count: 1 } })[0].text), "singular con 1 cuota");

// ── Ahorro: ratio, no pesos (regla de inflación) ──
const ahorro = buildHomeLines({ ...base, income: 100_000, expense: 40_000 });
ok(ahorro.some(l => l.id === "savings_good"), "ahorro ≥10% se celebra");
ok(/60%/.test(ahorro.find(l => l.id === "savings_good")!.text), "dice el porcentaje concreto");
ok(buildHomeLines({ ...base, income: 100_000, expense: 96_000 }).some(l => l.id === "savings_thin"),
   "ahorro <10% se dice sin festejar");

// ── Sin culpa: mes en rojo se enuncia como dato, no como reto ──
const rojo = buildHomeLines({ ...base, income: 50_000, expense: 90_000 }).find(l => l.id === "savings_negative")!;
ok(!!rojo, "mes en rojo tiene su línea");
ok(!/gastaste|mal|demasiado|cuidado/i.test(rojo.text), "no culpa al usuario");
ok(/40\.000/.test(rojo.text), "da el número concreto");

// ── Voz: 1 emoji como máximo por línea ──
for (const l of [...riesgo, ...conCuotas, ...ahorro]) {
  const emojis = [...l.text].filter(c => /\p{Extended_Pictographic}/u.test(c));
  ok(emojis.length <= 1, `"${l.text.slice(0, 40)}…" usa ${emojis.length} emojis (máx 1)`);
  ok(!/\btú\b|usted|saldo disponible|insights/i.test(l.text), "voseo, sin jerga bancaria");
}

// ── Bordes: sin datos no inventa nada ──
ok(buildHomeLines(base).length === 0, "mes vacío: Neo no dice nada");
ok(buildHomeLines({ ...base, dayOfMonth: 1, expense: 5_000 }).length === 0,
   "día 1: no proyecta el mes con un solo día de datos");
ok(buildHomeLines({ ...base, dayOfMonth: 30, expense: 5_000 }).length === 0,
   "último día: ya no es proyección");
ok(buildHomeLines({ ...base, expense: 30_000 })[0].id === "pace",
   "gastos sin ingresos registrados: informa el ritmo, no divide por cero");

// ── Fijos ──
const fijos = buildHomeLines({ ...base, recurringTotal: 25_000, recurringCount: 4 });
ok(fijos.some(l => l.id === "recurring"), "los gastos fijos aparecen");
ok(!buildHomeLines({ ...base, recurringTotal: 0, recurringCount: 0 }).some(l => l.id === "recurring"),
   "sin fijos, sin línea de fijos");

// ── Cada tono tiene una cara ──
for (const t of ["good", "warn", "neutral"] as const) ok(!!moodForTone[t], `tono ${t} mapea a un humor de Neo`);

console.log(`✓ línea de Neo en Inicio: ${pass} asserts OK`);
