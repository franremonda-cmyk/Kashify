// Self-check de los insights de Neo. No toca red. Correr: npx tsx cloudflare-worker/test/insights.test.ts
import {
  detectSpike, daysBetween, avgGapDays, detectInactivity,
  budgetThresholdHit, detectMonthComparison, detectOverspend,
  budgetPaceRatio, goalMilestone, goalBehindPts, savingsRateDelta,
  detectSpacePnl, planJustFinished, missingRecurring, newRecurring,
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

// ── ritmo de límite (proyección a fin de mes) ──
// día 10/30, gastó 5000 de 10000 → proyecta 15000 (1.5×) y está bajo el 70% → avisa
ok(budgetPaceRatio(5000, 10000, 10, 30) === 1.5, "ritmo alto y lejos del umbral → avisa");
ok(budgetPaceRatio(7500, 10000, 10, 30) === null, "ya en zona de umbrales (≥70%) → callado");
ok(budgetPaceRatio(3000, 10000, 5, 30) === null, "antes del día 7 → poca señal");
ok(budgetPaceRatio(2000, 10000, 10, 30) === null, "ritmo tranquilo → nada");
ok(budgetPaceRatio(500, 0, 10, 30) === null, "sin límite → null");

// ── hitos de meta ──
ok(goalMilestone(60, 100) === 50, "60% → hito 50");
ok(goalMilestone(80, 100) === 75, "80% → hito 75 (el más alto)");
ok(goalMilestone(30, 100) === null, "30% → todavía nada");
ok(goalMilestone(0, 100) === null, "sin avance → null");
ok(goalMilestone(50, 0) === null, "meta sin objetivo → null");

// ── meta en riesgo (tiempo vs avance) ──
// mitad del plazo (50%) con 10% ahorrado → 40 pts atrás → avisa
ok(goalBehindPts("2026-01-01", "2026-12-31", "2026-07-02", 10, 100) === 40, "50% del plazo, 10% ahorrado → 40 pts atrás");
ok(goalBehindPts("2026-01-01", "2026-12-31", "2026-07-02", 40, 100) === null, "10 pts atrás → tolerable, no molesta");
ok(goalBehindPts("2026-01-01", "2026-12-31", "2026-02-01", 0, 100) === null, "<25% del plazo → meta nueva, no cargosear");
ok(goalBehindPts("2026-01-01", "2026-06-01", "2026-07-02", 0, 100) === null, "meta vencida → no es este aviso");
ok(goalBehindPts("2026-01-01", "2026-12-31", "2026-07-02", 0, 0) === null, "sin objetivo → null");

// ── tasa de ahorro mes vs mes ──
ok(savingsRateDelta(1000, 500, 1000, 800) === 30, "50% vs 20% → +30 pts");
ok(savingsRateDelta(1000, 800, 1000, 500) === -30, "empeoró → delta negativo (el cron no lo usa)");
ok(savingsRateDelta(1000, 500, 0, 800) === null, "sin ingresos el mes pasado → null");
ok(savingsRateDelta(0, 500, 1000, 800) === null, "sin ingresos este mes → null");

// ── P&L por espacio ──
ok(detectSpacePnl("s1", "Freelance", 500, 300, "p")?.type === "alert_space_pnl", "gastó más de lo que facturó → alerta");
ok(detectSpacePnl("s1", "Freelance", 500, 300, "p")?.message.includes("Freelance"), "nombra el espacio");
ok(detectSpacePnl("s1", "Freelance", 200, 300, "p") === null, "en verde → nada");
ok(detectSpacePnl("s1", "Freelance", 500, 0, "p") === null, "espacio sin ingresos → null");

// ── ciclo de cuotas: plan recién terminado ──
ok(planJustFinished(["paid", "paid", "paid"], ["2026-05-10", "2026-06-10", "2026-07-10"], "2026-07"), "todas pagas, última este mes → logro");
ok(!planJustFinished(["paid", "paid", "pending"], ["2026-05-10", "2026-06-10", "2026-07-10"], "2026-07"), "queda una pendiente → no");
ok(!planJustFinished(["paid", "paid"], ["2026-04-10", "2026-05-10"], "2026-07"), "terminó hace meses → no repetir");
ok(!planJustFinished([], [], "2026-07"), "sin cuotas → no");

// ── recurrentes: faltante y nuevo ──
const netflix = { description: "Netflix", amount: 5000, currency_code: "ARS", months: 3 };
ok(missingRecurring([netflix], new Set(), 22).length === 1, "recurrente sin aparecer al día 22 → falta");
ok(missingRecurring([netflix], new Set(), 15).length === 0, "antes del día 20 → esperar");
ok(missingRecurring([netflix], new Set(["netflix"]), 22).length === 0, "ya apareció este mes → nada");
ok(newRecurring([netflix], new Set()).length === 1, "2ª aparición recién este mes → nuevo");
ok(newRecurring([netflix], new Set(["netflix"])).length === 0, "ya era recurrente → no es nuevo");

console.log(`✓ insights Neo: ${pass} asserts OK`);
