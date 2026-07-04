import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  detectSpike, detectInactivity, avgGapDays,
  budgetThresholdHit, detectMonthComparison, detectOverspend,
  type Candidate,
} from "@/lib/neo/insights";

// Cron: escribe consejos in-app en `neo_notifications` (gratis, sin costo Meta).
// El personaje Neo los levanta en el feed y en su globito. Todo determinista
// (0 tokens). Motor: cada usuario junta candidatos → se filtran los ya enviados
// (notification_log) → se ordenan por prioridad → se emiten como máximo MAX_PER_RUN
// (freno anti-Clippy; el resto queda para la próxima corrida, sigue siendo cierto).
// Copy según referencia/neo-voz.md. ponytail: reglas fijas; Haiku (plantillas que
// aprenden) es el paso de co-diseño posterior.
const PRIOR_MONTHS = 3;
const MAX_PER_RUN = 2;

type Row = { user_id: string; amount: number; currency_code: string; category_id: string | null; date: string; type: string; space_id: string | null };
type Budget = { user_id: string; space_id: string; category_id: string; monthly_limit: number; currency_code: string };

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const priorStart = new Date(now.getFullYear(), now.getMonth() - PRIOR_MONTHS, 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayISO = now.toISOString().split("T")[0];
  const todayDay = Number(todayISO.slice(8, 10));
  const thisMonthKey = monthStart.toISOString().slice(0, 7);
  const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  const period = `${now.getFullYear()}_${now.getMonth()}`;

  // Movimientos desde priorStart de TODOS los usuarios en una query; agrego en JS.
  const { data: rows } = await supabase
    .from("transactions")
    .select("user_id, amount, currency_code, category_id, date, type, space_id")
    .is("deleted_at", null)
    .gte("date", priorStart.toISOString().split("T")[0])
    .in("type", ["expense", "installment-payment", "income"]);

  if (!rows?.length) return NextResponse.json({ insights: 0 });

  // Nombres de categoría + presupuestos por usuario (para pico y ritmo de límite).
  const [{ data: cats }, { data: budgetRows }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("category_budgets").select("user_id, space_id, category_id, monthly_limit, currency_code"),
  ]);
  const nameOf = new Map((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const budgetsByUser = new Map<string, Budget[]>();
  for (const b of (budgetRows ?? []) as Budget[]) {
    const arr = budgetsByUser.get(b.user_id) ?? [];
    arr.push(b);
    budgetsByUser.set(b.user_id, arr);
  }

  // Agregado por usuario.
  type Agg = {
    curTotals: Record<string, number>;      // gasto de este mes por moneda
    nowByCat: Record<string, number>;        // gasto de este mes por categoría (pico)
    priorByCat: Record<string, number>;      // gasto meses previos por categoría (pico)
    nowBySpaceCat: Record<string, number>;   // gasto de este mes por espacio|categoría (ritmo)
    incomeCur: Record<string, number>;       // ingreso de este mes por moneda
    lastToDate: Record<string, number>;      // gasto del mes pasado hasta hoy (comparativa)
    dates: string[];                          // fechas de actividad (inactividad)
  };
  const byUser = new Map<string, Agg>();
  for (const t of rows as Row[]) {
    const a = byUser.get(t.user_id) ?? { curTotals: {}, nowByCat: {}, priorByCat: {}, nowBySpaceCat: {}, incomeCur: {}, lastToDate: {}, dates: [] };
    const amt = Number(t.amount);
    const mk = t.date.slice(0, 7);
    const day = Number(t.date.slice(8, 10));
    a.dates.push(t.date);
    if (t.type === "income") {
      if (mk === thisMonthKey) a.incomeCur[t.currency_code] = (a.incomeCur[t.currency_code] ?? 0) + amt;
    } else if (mk === thisMonthKey) {
      a.curTotals[t.currency_code] = (a.curTotals[t.currency_code] ?? 0) + amt;
      if (t.category_id) a.nowByCat[t.category_id] = (a.nowByCat[t.category_id] ?? 0) + amt;
      if (t.category_id && t.space_id) {
        const k = `${t.space_id}|${t.category_id}`;
        a.nowBySpaceCat[k] = (a.nowBySpaceCat[k] ?? 0) + amt;
      }
    } else {
      if (t.category_id) a.priorByCat[t.category_id] = (a.priorByCat[t.category_id] ?? 0) + amt;
      if (day <= todayDay && mk === lastMonthKey) a.lastToDate[t.currency_code] = (a.lastToDate[t.currency_code] ?? 0) + amt;
    }
    byUser.set(t.user_id, a);
  }

  let insights = 0;
  for (const [userId, a] of byUser) {
    const candidates: Candidate[] = [];
    const curEntries = Object.entries(a.curTotals).sort((x, y) => y[1] - x[1]);
    const mainCur = curEntries[0]?.[0] ?? "ARS";
    const mainExpense = a.curTotals[mainCur] ?? 0;

    // Resumen mensual (prioridad baja).
    if (curEntries.length) {
      const fmt = curEntries[0][1].toLocaleString("es-AR", { maximumFractionDigits: 0 });
      candidates.push({
        alertType: `monthly_summary_${period}`, type: "monthly_summary", priority: 1,
        message: `📊 Este mes llevás gastado ${mainCur} ${fmt}. ¿Querés que revisemos dónde se fue?`,
      });
    }

    // Pico de gasto por categoría (alerta).
    const spike = detectSpike(a.nowByCat, a.priorByCat, PRIOR_MONTHS);
    if (spike) {
      const cat = nameOf.get(spike.catId) ?? "una categoría";
      candidates.push({
        alertType: `spend_spike_${spike.catId}_${period}`, type: "spend_spike", priority: 3,
        message: `👀 ${cat} vino cargada este mes. ¿La miramos?`,
      });
    }

    // Límite al 70% / 90% / 100% del gasto real (por espacio+categoría).
    for (const b of budgetsByUser.get(userId) ?? []) {
      const spent = a.nowBySpaceCat[`${b.space_id}|${b.category_id}`] ?? 0;
      const th = budgetThresholdHit(spent, Number(b.monthly_limit));
      if (th != null) {
        const cat = nameOf.get(b.category_id) ?? "un límite";
        candidates.push({
          alertType: `alert_budget_${b.space_id}_${b.category_id}_${th}_${period}`, type: "alert_budget", priority: 3,
          message: th >= 100
            ? `Te pasaste del límite de ${cat} este mes 👀 ¿lo revisamos?`
            : th >= 90
              ? `👀 Ojo, estás al ${th}% del límite de ${cat}. Queda poco.`
              : `👀 Ya usaste el ${th}% del límite de ${cat} este mes.`,
        });
      }
    }

    // Comparativa mes a mes (a la misma altura) + gastos > ingresos.
    const comp = detectMonthComparison(mainExpense, a.lastToDate[mainCur] ?? 0, period);
    if (comp) candidates.push(comp);
    const over = detectOverspend(mainExpense, a.incomeCur[mainCur] ?? 0, period);
    if (over) candidates.push(over);

    // Hace días que no registrás (recordatorio; se auto-suprime si loguea esporádico).
    const latest = a.dates.reduce((m, d) => (d > m ? d : m), a.dates[0]);
    const inact = detectInactivity(latest, avgGapDays(a.dates), todayISO);
    if (inact) candidates.push(inact);

    // Filtrar ya enviados (una query por usuario), ordenar por prioridad, emitir cap.
    const { data: sentRows } = await supabase.from("notification_log").select("alert_type").eq("user_id", userId);
    const sent = new Set((sentRows ?? []).map((r: { alert_type: string }) => r.alert_type));
    const fresh = candidates.filter((c) => !sent.has(c.alertType)).sort((x, y) => y.priority - x.priority);

    for (const c of fresh.slice(0, MAX_PER_RUN)) {
      await Promise.all([
        supabase.from("neo_notifications").insert({ user_id: userId, message: c.message, type: c.type }),
        supabase.from("notification_log").insert({ user_id: userId, alert_type: c.alertType }),
      ]);
      insights++;
    }
  }

  return NextResponse.json({ insights });
}
