// Insights deterministas de Neo (0 tokens). Lógica pura y testeable; el cron
// neo-insights la usa para escribir avisos en neo_notifications.
// Copy según referencia/neo-voz.md (cálido, sin culpa, 1 emoji, voseo).

import { normalizeDesc, type RecurringItem } from "../recurring";

// Un evento candidato a notificar. priority: 3 alerta/logro · 2 recordatorio · 1 resumen.
export interface Candidate {
  alertType: string; // clave de dedupe en notification_log (incluye el período)
  type: string;      // tipo de neo_notification → define el mood en el cliente
  priority: number;
  message: string;
}

export interface Spike { catId: string; now: number; avg: number; }

/**
 * Pico de gasto: la categoría cuyo gasto de ESTE mes supera más su propio promedio
 * de los meses previos. `priorByCat` = gasto por categoría sumado sobre `priorMonths`.
 * Devuelve la de mayor exceso, o null si ninguna supera el promedio por `factor`.
 */
export function detectSpike(
  nowByCat: Record<string, number>,
  priorByCat: Record<string, number>,
  priorMonths: number,
  factor = 1.4,
): Spike | null {
  if (priorMonths <= 0) return null;
  let best: Spike | null = null;
  for (const [catId, now] of Object.entries(nowByCat)) {
    const avg = (priorByCat[catId] ?? 0) / priorMonths;
    if (avg <= 0) continue;
    if (now < avg * factor) continue;
    if (!best || now - avg > best.now - best.avg) best = { catId, now, avg };
  }
  return best;
}

// Días enteros entre dos fechas ISO (YYYY-MM-DD).
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.floor((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

// Promedio de días entre registros. <2 fechas → Infinity (lo tratamos como
// "loguea esporádico" para NO cargosearlo).
export function avgGapDays(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return Infinity;
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += daysBetween(sorted[i - 1], sorted[i]);
  return sum / (sorted.length - 1);
}

/**
 * "Hace días que no registrás". Solo si el usuario suele registrar seguido
 * (avgGap < minGap): a alguien que anota 1 vez por mes no tiene sentido retarlo.
 */
export function detectInactivity(
  latestTxDate: string | null,
  avgGap: number,
  todayISO: string,
  minGap = 4,
): Candidate | null {
  if (!latestTxDate) return null;
  if (avgGap >= minGap) return null;           // logueador esporádico → no molestar
  const days = daysBetween(latestTxDate, todayISO);
  if (days < minGap) return null;
  return {
    alertType: `inactivity_${todayISO}`,
    type: "reminder_inactivity",
    priority: 2,
    message: days >= 10
      ? `¡Te extrañé! Hace ${days} días que no anotamos nada 👀`
      : `Hace ${days} días que no anotás nada 👀 ¿ponemos al día?`,
  };
}

/**
 * Umbrales de límite: avisa cuando el gasto real cruza 70%, 90% y 100% del límite.
 * Devuelve el umbral MÁS ALTO alcanzado (o null). Con dedupe por umbral, cada uno
 * suena una vez; si saltás directo al 105%, suena solo el de 100 (no los tres).
 */
export function budgetThresholdHit(spent: number, limit: number, thresholds: number[] = [70, 90, 100]): number | null {
  if (limit <= 0 || spent <= 0) return null;
  const pct = (spent / limit) * 100;
  let hit: number | null = null;
  for (const th of thresholds) if (pct >= th) hit = th; // thresholds ascendentes → queda el más alto
  return hit;
}

/**
 * Comparativa vs el mes pasado a la MISMA altura del mes (justo). Inflación-aware:
 * si gastás más, no culpa ("puede estar todo más caro"); si gastás menos, festeja.
 */
export function detectMonthComparison(thisToDate: number, lastToDate: number, period: string): Candidate | null {
  if (lastToDate <= 0) return null;
  const pct = (thisToDate - lastToDate) / lastToDate;
  const abs = Math.round(Math.abs(pct) * 100);
  if (pct >= 0.15) return {
    alertType: `alert_month_up_${period}`, type: "alert_month_up", priority: 3,
    message: `👀 Vas gastando ${abs}% más que a esta altura del mes pasado. Puede ser que esté todo más caro.`,
  };
  if (pct <= -0.10) return {
    alertType: `achievement_month_down_${period}`, type: "achievement_month_down", priority: 3,
    message: `🎉 Vas ${abs}% menos que a esta altura del mes pasado. ¡Bien ahí!`,
  };
  return null;
}

/** Este mes los gastos superan a lo que entró (solo si trackea ingresos). */
export function detectOverspend(expense: number, income: number, period: string): Candidate | null {
  if (income <= 0 || expense <= income) return null;
  return {
    alertType: `alert_overspend_${period}`, type: "alert_overspend", priority: 3,
    message: `👀 Este mes gastaste más de lo que entró. ¿Lo miramos juntos?`,
  };
}

/**
 * Ritmo de límite: proyecta el gasto a fin de mes al ritmo actual. Aviso TEMPRANO:
 * solo corre si el gasto real todavía está bajo el 70% del límite (de ahí en más
 * hablan los umbrales de budgetThresholdHit, para no avisar dos veces lo mismo)
 * y recién desde el día 7 (antes hay poca señal). Devuelve proyección/límite o null.
 */
export function budgetPaceRatio(
  spent: number, limit: number, day: number, daysInMonth: number, factor = 1.1,
): number | null {
  if (limit <= 0 || spent <= 0 || day < 7) return null;
  if (spent / limit >= 0.7) return null; // ya es territorio de los umbrales
  const ratio = ((spent / day) * daysInMonth) / limit;
  return ratio >= factor ? ratio : null;
}

/** Hito de meta: 50% / 75% alcanzado (el más alto). El 100% ya lo festeja goal_reached. */
export function goalMilestone(current: number, target: number, thresholds: number[] = [50, 75]): number | null {
  if (target <= 0 || current <= 0) return null;
  const pct = (current / target) * 100;
  let hit: number | null = null;
  for (const th of thresholds) if (pct >= th) hit = th;
  return hit;
}

/**
 * Meta en riesgo: % del plazo transcurrido vs % ahorrado. Solo metas con fecha,
 * con ≥25% del plazo pasado (a una meta nueva no se la cargosea) y aún vigentes.
 * Devuelve cuántos puntos viene atrás (si son ≥ minBehind), o null.
 */
export function goalBehindPts(
  createdISO: string, targetISO: string, todayISO: string,
  current: number, target: number, minBehind = 25,
): number | null {
  if (target <= 0 || todayISO >= targetISO) return null;
  const total = daysBetween(createdISO, targetISO);
  const gone = daysBetween(createdISO, todayISO);
  if (total <= 0 || gone <= 0) return null;
  const elapsedPct = (gone / total) * 100;
  if (elapsedPct < 25) return null;
  const progressPct = Math.min((current / target) * 100, 100);
  const behind = elapsedPct - progressPct;
  return behind >= minBehind ? Math.round(behind) : null;
}

/**
 * Cambio en la tasa de ahorro vs el mes pasado a la MISMA altura, en puntos
 * porcentuales. Requiere ingresos en ambos meses. El cron solo festeja mejoras
 * (sin culpa: empeorar no genera aviso).
 */
export function savingsRateDelta(
  thisIncome: number, thisExpense: number, lastIncome: number, lastExpense: number,
): number | null {
  if (thisIncome <= 0 || lastIncome <= 0) return null;
  const delta = ((thisIncome - thisExpense) / thisIncome - (lastIncome - lastExpense) / lastIncome) * 100;
  return Math.round(delta);
}

/** P&L de un espacio: salió más de lo que entró (solo si ese espacio registra ingresos). */
export function detectSpacePnl(
  spaceId: string, spaceName: string, expense: number, income: number, period: string,
): Candidate | null {
  if (income <= 0 || expense <= income) return null;
  return {
    alertType: `space_pnl_${spaceId}_${period}`, type: "alert_space_pnl", priority: 3,
    message: `👀 En ${spaceName} este mes salió más de lo que entró. ¿Lo miramos?`,
  };
}

/** Plan de cuotas recién terminado: todas pagas y la última vencía este mes. */
export function planJustFinished(statuses: string[], dueDates: string[], thisMonthKey: string): boolean {
  if (!statuses.length || statuses.some((s) => s !== "paid")) return false;
  const last = dueDates.reduce((m, d) => (d > m ? d : m), dueDates[0]);
  return last.slice(0, 7) === thisMonthKey;
}

/**
 * Recurrentes de meses previos que este mes todavía no aparecieron. Recién desde
 * el día `minDay` (antes puede simplemente no haber vencido todavía).
 */
export function missingRecurring(
  prior: RecurringItem[], thisMonthNorms: Set<string>, day: number, minDay = 20,
): RecurringItem[] {
  if (day < minDay) return [];
  return prior.filter((r) => !thisMonthNorms.has(normalizeDesc(r.description)));
}

/** Recurrentes NUEVOS: recién este mes juntaron su 2ª aparición (no eran recurrentes antes). */
export function newRecurring(all: RecurringItem[], priorNorms: Set<string>): RecurringItem[] {
  return all.filter((r) => !priorNorms.has(normalizeDesc(r.description)));
}
