// Self-check de detectSpike. No toca red. Correr: npx tsx cloudflare-worker/test/insights.test.ts
import {
  detectSpike, daysBetween, avgGapDays, detectInactivity,
  budgetThresholdHit, detectMonthComparison, detectOverspend,
} from "../../src/lib/neo/insights.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// Comida: avg 100/mes (300/3), este mes 200 → 2x avg → pico.
// Transporte: avg 100/mes, este mes 110 → <1.4x → no.
const s = detectSpike(
  { comida: 200, transporte: 110 },
  { comida: 300, transporte: 300 },
  3,
);
ok(s?.catId === "comida" && s.now === 200 && Math.round(s.avg) === 100, "marca comida como pico");

// Sin historial de la categoría → no es pico.
ok(detectSpike({ nueva: 500 }, {}, 3) === null, "categoría sin historial → null");

// Elige el de MAYOR exceso (ocio +150) sobre comida (+100).
const s2 = detectSpike(
  { comida: 200, ocio: 250 },
  { comida: 300, ocio: 300 },
  3,
);
ok(s2?.catId === "ocio", "elige el de mayor exceso absoluto");

// priorMonths 0 → null (no dividir por cero).
ok(detectSpike({ comida: 200 }, { comida: 300 }, 0) === null, "sin meses previos → null");

// Nada supera el factor → null.
ok(detectSpike({ comida: 120 }, { comida: 300 }, 3) === null, "por debajo del factor → null");

// ── daysBetween / avgGapDays ──
ok(daysBetween("2026-06-01", "2026-06-05") === 4, "4 días entre fechas");
ok(avgGapDays(["2026-06-01", "2026-06-03", "2026-06-05"]) === 2, "gap promedio = 2 días");
ok(avgGapDays(["2026-06-01"]) === Infinity, "1 sola fecha → Infinity (esporádico)");

// ── detectInactivity ──
// logueador frecuente (gap 1) que hace 5 días no anota → avisa
const inact = detectInactivity("2026-06-25", 1, "2026-06-30");
ok(inact?.type === "reminder_inactivity" && inact.priority === 2, "5 días sin registrar → recordatorio");
// logueador esporádico (gap 10) → NO molestar aunque haga días
ok(detectInactivity("2026-06-25", 10, "2026-06-30") === null, "esporádico → no molesta");
// hace poco → null
ok(detectInactivity("2026-06-29", 1, "2026-06-30") === null, "1 día → no avisa");
// 12 días → mensaje 'te extrañé'
ok(detectInactivity("2026-06-18", 1, "2026-06-30")?.message.includes("extrañé"), "10+ días → te extrañé");

// ── umbrales de límite (70% / 90% / 100%) ──
ok(budgetThresholdHit(7500, 10000) === 70, "75% → umbral 70");
ok(budgetThresholdHit(9200, 10000) === 90, "92% → umbral 90");
ok(budgetThresholdHit(9900, 10000) === 90, "99% → umbral 90 (todavía no 100)");
ok(budgetThresholdHit(10000, 10000) === 100, "100% → umbral 100");
ok(budgetThresholdHit(13000, 10000) === 100, "130% → sigue siendo 100 (más alto alcanzado)");
ok(budgetThresholdHit(5000, 10000) === null, "50% → todavía nada");
ok(budgetThresholdHit(500, 0) === null, "sin límite → null");

// ── comparativa mes a mes ──
ok(detectMonthComparison(130, 100, "p")?.type === "alert_month_up", "+30% → alerta (sin culpa)");
ok(detectMonthComparison(130, 100, "p")?.message.includes("más caro"), "alerta menciona inflación");
ok(detectMonthComparison(80, 100, "p")?.type === "achievement_month_down", "-20% → logro");
ok(detectMonthComparison(105, 100, "p") === null, "+5% → nada (ruido)");
ok(detectMonthComparison(100, 0, "p") === null, "sin mes previo → null");

// ── gastos > ingresos ──
ok(detectOverspend(150, 100, "p")?.type === "alert_overspend", "gasto > ingreso → alerta");
ok(detectOverspend(80, 100, "p") === null, "gasto < ingreso → null");
ok(detectOverspend(150, 0, "p") === null, "sin ingresos trackeados → null");

console.log(`✓ insights Neo: ${pass} asserts OK`);
