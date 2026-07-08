import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  detectSpike, detectInactivity, avgGapDays,
  budgetThresholdHit, detectMonthComparison, detectOverspend,
  budgetPaceRatio, goalMilestone, goalBehindPts, savingsRateDelta,
  detectSpacePnl, planJustFinished, missingRecurring, newRecurring,
  notifFamily, type Candidate, type NotifFamily,
} from "@/lib/neo/insights";
import { detectRecurring, normalizeDesc } from "@/lib/recurring";

// Cron: escribe consejos in-app en `neo_notifications` (gratis, sin costo Meta).
// El personaje Neo los levanta en el feed y en su globito. Todo determinista
// (0 tokens). Motor: cada usuario junta candidatos → se filtran los ya enviados
// (notification_log) → se ordenan por prioridad → se emiten como máximo MAX_PER_RUN
// (freno anti-Clippy; el resto queda para la próxima corrida, sigue siendo cierto).
// Copy según referencia/neo-voz.md. ponytail: reglas fijas; Haiku (plantillas que
// aprenden) es el paso de co-diseño posterior.
const PRIOR_MONTHS = 3;
const MAX_PER_RUN = 2;
// Back-off automático: si el usuario deja sin leer ≥ este número de avisos de una
// misma familia, Neo pausa esa familia por BACKOFF_DAYS (se auto-reactiva sola).
const BACKOFF_UNREAD = 3;
const BACKOFF_DAYS = 21;

type Row = { user_id: string; amount: number; currency_code: string; category_id: string | null; date: string; type: string; space_id: string | null; description: string | null };
type Budget = { user_id: string; space_id: string; category_id: string; monthly_limit: number; currency_code: string };
type Goal = { id: string; user_id: string; name: string; current_amount: number; target_amount: number; target_date: string | null; created_at: string };
type Payment = { id: string; plan_id: string; user_id: string; status: string; due_date: string; payment_number: number; amount: number; installment_plans: { name: string; currency_code: string } };

const fmtAmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

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
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const in3daysISO = new Date(now.getTime() + 3 * 86_400_000).toISOString().split("T")[0];

  // Movimientos desde priorStart de TODOS los usuarios en una query; agrego en JS.
  const { data: rows } = await supabase
    .from("transactions")
    .select("user_id, amount, currency_code, category_id, date, type, space_id, description")
    .is("deleted_at", null)
    .gte("date", priorStart.toISOString().split("T")[0])
    .in("type", ["expense", "installment-payment", "income"]);

  if (!rows?.length) return NextResponse.json({ insights: 0 });

  // Nombres de categoría, presupuestos, metas, espacios, cuotas, perfiles,
  // preferencias de aviso (silenciado/pausa) y avisos sin leer (para back-off).
  const [{ data: cats }, { data: budgetRows }, { data: goalRows }, { data: spaceRows }, { data: paymentRows }, { data: profileRows }, { data: prefRows }, { data: unreadRows }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("category_budgets").select("user_id, space_id, category_id, monthly_limit, currency_code"),
    supabase.from("savings_goals").select("id, user_id, name, current_amount, target_amount, target_date, created_at").eq("status", "active"),
    supabase.from("spaces").select("id, user_id, name"),
    supabase.from("installment_payments").select("id, plan_id, user_id, status, due_date, payment_number, amount, installment_plans(name, currency_code)"),
    supabase.from("profiles").select("user_id, created_at"),
    supabase.from("neo_notification_prefs").select("user_id, family, muted_until"),
    supabase.from("neo_notifications").select("user_id, type").is("read_at", null),
  ]);

  // Familias silenciadas/pausadas (muted_until en el futuro) por usuario.
  const nowMs = now.getTime();
  const mutedByUser = new Map<string, Set<string>>();
  for (const p of (prefRows ?? []) as { user_id: string; family: string; muted_until: string | null }[]) {
    if (p.muted_until && Date.parse(p.muted_until) > nowMs) {
      const set = mutedByUser.get(p.user_id) ?? new Set<string>();
      set.add(p.family);
      mutedByUser.set(p.user_id, set);
    }
  }
  // Avisos sin leer por usuario+familia → dispara el back-off automático.
  const unreadByUserFamily = new Map<string, Map<NotifFamily, number>>();
  for (const n of (unreadRows ?? []) as { user_id: string; type: string }[]) {
    const fam = notifFamily(n.type);
    const m = unreadByUserFamily.get(n.user_id) ?? new Map<NotifFamily, number>();
    m.set(fam, (m.get(fam) ?? 0) + 1);
    unreadByUserFamily.set(n.user_id, m);
  }
  const nameOf = new Map((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const budgetsByUser = new Map<string, Budget[]>();
  for (const b of (budgetRows ?? []) as Budget[]) {
    const arr = budgetsByUser.get(b.user_id) ?? [];
    arr.push(b);
    budgetsByUser.set(b.user_id, arr);
  }
  const goalsByUser = new Map<string, Goal[]>();
  for (const g of (goalRows ?? []) as Goal[]) {
    const arr = goalsByUser.get(g.user_id) ?? [];
    arr.push(g);
    goalsByUser.set(g.user_id, arr);
  }
  const spaceName = new Map((spaceRows ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const spaceCountByUser = new Map<string, number>();
  for (const s of (spaceRows ?? []) as { user_id: string }[]) {
    spaceCountByUser.set(s.user_id, (spaceCountByUser.get(s.user_id) ?? 0) + 1);
  }
  const createdAt = new Map((profileRows ?? []).map((p: { user_id: string; created_at: string }) => [p.user_id, p.created_at]));

  // Cuotas: candidatos por usuario (última cuota pagada = logro; próximas a vencer).
  const installmentCands = new Map<string, Candidate[]>();
  const pushCand = (userId: string, c: Candidate) => {
    const arr = installmentCands.get(userId) ?? [];
    arr.push(c);
    installmentCands.set(userId, arr);
  };
  const byPlan = new Map<string, Payment[]>();
  for (const p of (paymentRows ?? []) as unknown as Payment[]) {
    const arr = byPlan.get(p.plan_id) ?? [];
    arr.push(p);
    byPlan.set(p.plan_id, arr);
  }
  for (const [planId, ps] of byPlan) {
    const plan = ps[0].installment_plans;
    if (planJustFinished(ps.map((p) => p.status), ps.map((p) => p.due_date), thisMonthKey)) {
      pushCand(ps[0].user_id, {
        alertType: `installments_done_${planId}`, type: "achievement_installments_done", priority: 3,
        message: `🎉 ¡Pagaste la última cuota de ${plan.name}! Una deuda menos.`,
      });
    }
    for (const p of ps) {
      if (p.status !== "pending" || p.due_date <= todayISO || p.due_date > in3daysISO) continue;
      pushCand(p.user_id, {
        alertType: `installment_due_${p.id}`, type: "reminder_installment_due", priority: 2,
        message: `📅 El ${p.due_date.slice(8, 10)}/${p.due_date.slice(5, 7)} vence la cuota ${p.payment_number} de ${plan.name} (${plan.currency_code} ${fmtAmt(Number(p.amount))}).`,
      });
    }
  }

  // Agregado por usuario.
  type Agg = {
    curTotals: Record<string, number>;      // gasto de este mes por moneda
    nowByCat: Record<string, number>;        // gasto de este mes por categoría (pico)
    priorByCat: Record<string, number>;      // gasto meses previos por categoría (pico)
    nowBySpaceCat: Record<string, number>;   // gasto de este mes por espacio|categoría (límites)
    incomeCur: Record<string, number>;       // ingreso de este mes por moneda
    lastToDate: Record<string, number>;      // gasto del mes pasado hasta hoy (comparativa)
    lastIncomeToDate: Record<string, number>; // ingreso del mes pasado hasta hoy (ahorro)
    lastTotals: Record<string, number>;      // gasto del mes pasado COMPLETO (cierre día 1-3)
    expBySpace: Record<string, number>;      // gasto de este mes por espacio|moneda (P&L)
    incBySpace: Record<string, number>;      // ingreso de este mes por espacio|moneda (P&L)
    dates: string[];                          // fechas de actividad (inactividad)
    txs: Row[];                               // crudas, para recurrentes
  };
  const byUser = new Map<string, Agg>();
  for (const t of rows as Row[]) {
    const a = byUser.get(t.user_id) ?? {
      curTotals: {}, nowByCat: {}, priorByCat: {}, nowBySpaceCat: {}, incomeCur: {},
      lastToDate: {}, lastIncomeToDate: {}, lastTotals: {}, expBySpace: {}, incBySpace: {}, dates: [], txs: [],
    };
    const amt = Number(t.amount);
    const mk = t.date.slice(0, 7);
    const day = Number(t.date.slice(8, 10));
    a.dates.push(t.date);
    a.txs.push(t);
    if (t.type === "income") {
      if (mk === thisMonthKey) {
        a.incomeCur[t.currency_code] = (a.incomeCur[t.currency_code] ?? 0) + amt;
        if (t.space_id) {
          const k = `${t.space_id}|${t.currency_code}`;
          a.incBySpace[k] = (a.incBySpace[k] ?? 0) + amt;
        }
      } else if (mk === lastMonthKey && day <= todayDay) {
        a.lastIncomeToDate[t.currency_code] = (a.lastIncomeToDate[t.currency_code] ?? 0) + amt;
      }
    } else if (mk === thisMonthKey) {
      a.curTotals[t.currency_code] = (a.curTotals[t.currency_code] ?? 0) + amt;
      if (t.category_id) a.nowByCat[t.category_id] = (a.nowByCat[t.category_id] ?? 0) + amt;
      if (t.space_id) {
        const k = `${t.space_id}|${t.currency_code}`;
        a.expBySpace[k] = (a.expBySpace[k] ?? 0) + amt;
      }
      if (t.category_id && t.space_id) {
        const k = `${t.space_id}|${t.category_id}`;
        a.nowBySpaceCat[k] = (a.nowBySpaceCat[k] ?? 0) + amt;
      }
    } else {
      if (t.category_id) a.priorByCat[t.category_id] = (a.priorByCat[t.category_id] ?? 0) + amt;
      if (mk === lastMonthKey) {
        a.lastTotals[t.currency_code] = (a.lastTotals[t.currency_code] ?? 0) + amt;
        if (day <= todayDay) a.lastToDate[t.currency_code] = (a.lastToDate[t.currency_code] ?? 0) + amt;
      }
    }
    byUser.set(t.user_id, a);
  }

  let insights = 0;
  for (const [userId, a] of byUser) {
    const candidates: Candidate[] = [];
    const curEntries = Object.entries(a.curTotals).sort((x, y) => y[1] - x[1]);
    const mainCur = curEntries[0]?.[0] ?? "ARS";
    const mainExpense = a.curTotals[mainCur] ?? 0;

    // Resumen mensual (prioridad baja; desde el día 5, antes el número no dice nada).
    if (curEntries.length && todayDay >= 5) {
      candidates.push({
        alertType: `monthly_summary_${period}`, type: "monthly_summary", priority: 1,
        message: `📊 Este mes llevás gastado ${mainCur} ${fmtAmt(curEntries[0][1])}. ¿Querés que revisemos dónde se fue?`,
      });
    }

    // Cierre del mes anterior (días 1-3).
    if (todayDay <= 3) {
      const lastEntries = Object.entries(a.lastTotals).sort((x, y) => y[1] - x[1]);
      if (lastEntries.length) {
        const mes = lastMonth.toLocaleDateString("es-AR", { month: "long" });
        candidates.push({
          alertType: `monthly_close_${lastMonthKey}`, type: "monthly_close", priority: 1,
          message: `📊 Cerraste ${mes} con ${lastEntries[0][0]} ${fmtAmt(lastEntries[0][1])} en gastos. ¿Repasamos cómo fue?`,
        });
      }
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

    // Límites (por espacio+categoría): umbrales 70/90/100 del gasto real, y si todavía
    // está lejos de eso, el RITMO (proyección a fin de mes) como aviso temprano.
    for (const b of budgetsByUser.get(userId) ?? []) {
      const spent = a.nowBySpaceCat[`${b.space_id}|${b.category_id}`] ?? 0;
      const cat = nameOf.get(b.category_id) ?? "un límite";
      const th = budgetThresholdHit(spent, Number(b.monthly_limit));
      if (th != null) {
        candidates.push({
          alertType: `alert_budget_${b.space_id}_${b.category_id}_${th}_${period}`, type: "alert_budget", priority: 3,
          message: th >= 100
            ? `Te pasaste del límite de ${cat} este mes 👀 ¿lo revisamos?`
            : th >= 90
              ? `👀 Ojo, estás al ${th}% del límite de ${cat}. Queda poco.`
              : `👀 Ya usaste el ${th}% del límite de ${cat} este mes.`,
        });
      } else if (budgetPaceRatio(spent, Number(b.monthly_limit), todayDay, daysInMonth) != null) {
        candidates.push({
          alertType: `budget_pace_${b.space_id}_${b.category_id}_${period}`, type: "alert_budget_pace", priority: 3,
          message: `👀 Al ritmo que va ${cat}, este mes pasarías el límite. Todavía estás a tiempo.`,
        });
      }
    }

    // Metas: hitos 50/75% (una vez por meta) y metas con fecha que vienen atrás.
    for (const g of goalsByUser.get(userId) ?? []) {
      const cur = Number(g.current_amount), tgt = Number(g.target_amount);
      const th = goalMilestone(cur, tgt);
      if (th != null) {
        candidates.push({
          alertType: `goal_${th}_${g.id}`, type: `achievement_goal_${th}`, priority: 3,
          message: th >= 75
            ? `🚀 ¡Ya tenés el 75% de "${g.name}"! Falta poquito.`
            : `🎉 ¡Mitad de camino en "${g.name}"! Vas muy bien.`,
        });
      }
      if (g.target_date && goalBehindPts(g.created_at.slice(0, 10), g.target_date, todayISO, cur, tgt) != null) {
        candidates.push({
          alertType: `goal_risk_${g.id}_${period}`, type: "reminder_goal_risk", priority: 2,
          message: `👀 "${g.name}" viene un poco atrás para llegar a la fecha. ¿La repasamos?`,
        });
      }
    }

    // Comparativa mes a mes (a la misma altura) + gastos > ingresos.
    const comp = detectMonthComparison(mainExpense, a.lastToDate[mainCur] ?? 0, period);
    if (comp) candidates.push(comp);
    const over = detectOverspend(mainExpense, a.incomeCur[mainCur] ?? 0, period);
    if (over) candidates.push(over);

    // Tasa de ahorro mejoró ≥10 pts vs el mes pasado (desde el día 15: antes el
    // corrimiento de fechas de cobro mete ruido). Solo festeja, nunca reprocha.
    if (todayDay >= 15) {
      const sd = savingsRateDelta(a.incomeCur[mainCur] ?? 0, mainExpense, a.lastIncomeToDate[mainCur] ?? 0, a.lastToDate[mainCur] ?? 0);
      if (sd != null && sd >= 10) {
        candidates.push({
          alertType: `savings_up_${period}`, type: "achievement_savings_up", priority: 3,
          message: `💪 Este mes estás ahorrando más fuerte que el anterior. ¡Seguí así!`,
        });
      }
    }

    // P&L por espacio (solo multi-espacio: "en Freelance salió más de lo que entró").
    if ((spaceCountByUser.get(userId) ?? 0) >= 2) {
      for (const [key, exp] of Object.entries(a.expBySpace)) {
        const [spaceId] = key.split("|");
        const pnl = detectSpacePnl(spaceId, spaceName.get(spaceId) ?? "un espacio", exp, a.incBySpace[key] ?? 0, period);
        if (pnl) candidates.push(pnl);
      }
    }

    // Recurrentes: uno de meses previos que este mes falta, y uno nuevo detectado.
    const priorRec = detectRecurring(a.txs.filter((t) => t.date.slice(0, 7) !== thisMonthKey).map((t) => ({ ...t, description: t.description ?? "" })));
    const priorNorms = new Set(priorRec.map((r) => normalizeDesc(r.description)));
    const thisNorms = new Set(
      a.txs.filter((t) => t.date.slice(0, 7) === thisMonthKey).map((t) => normalizeDesc(t.description ?? "")).filter(Boolean),
    );
    for (const r of missingRecurring(priorRec, thisNorms, todayDay).slice(0, 1)) {
      candidates.push({
        alertType: `recurring_missing_${normalizeDesc(r.description).replace(/\s+/g, "-")}_${period}`,
        type: "reminder_recurring_missing", priority: 2,
        message: `👀 Este mes no veo ${r.description}, que venías pagando seguido. ¿Lo anotamos?`,
      });
    }
    const allRec = detectRecurring(a.txs.map((t) => ({ ...t, description: t.description ?? "" })));
    for (const r of newRecurring(allRec, priorNorms).slice(0, 1)) {
      candidates.push({
        alertType: `recurring_new_${normalizeDesc(r.description).replace(/\s+/g, "-")}`,
        type: "reminder_recurring_new", priority: 2,
        message: `🔁 Veo que ${r.description} se repite cada mes (~${r.currency_code} ${fmtAmt(r.amount)}). Lo tengo en el radar.`,
      });
    }

    // Fin de mes con sobrante y una meta abierta → sugerir apartar.
    if (todayDay >= 25) {
      const income = a.incomeCur[mainCur] ?? 0;
      const goal = (goalsByUser.get(userId) ?? []).find((g) => Number(g.current_amount) < Number(g.target_amount));
      if (goal && income > 0 && income - mainExpense >= income * 0.1) {
        candidates.push({
          alertType: `leftover_goal_${period}`, type: "reminder_leftover_goal", priority: 2,
          message: `💡 Este mes te está quedando un sobrante. ¿Apartamos algo para "${goal.name}"?`,
        });
      }
    }

    // Aniversario con la app (una vez por año).
    const created = createdAt.get(userId);
    if (created) {
      const years = now.getFullYear() - Number(created.slice(0, 4));
      if (years >= 1 && created.slice(5, 10) === todayISO.slice(5)) {
        candidates.push({
          alertType: `anniversary_${years}`, type: "achievement_anniversary", priority: 3,
          message: years === 1
            ? `🎂 ¡Hoy cumplimos un año juntos! Gracias por dejarme acompañarte.`
            : `🎂 ¡${years} años juntos! Qué lindo camino.`,
        });
      }
    }

    // Cuotas (última pagada = logro; próximas a vencer), precalculadas arriba.
    candidates.push(...(installmentCands.get(userId) ?? []));

    // Hace días que no registrás (recordatorio; se auto-suprime si loguea esporádico).
    const latest = a.dates.reduce((m, d) => (d > m ? d : m), a.dates[0]);
    const inact = detectInactivity(latest, avgGapDays(a.dates), todayISO);
    if (inact) candidates.push(inact);

    // Back-off automático: familias con ≥ BACKOFF_UNREAD avisos sin leer se
    // pausan solas (upsert muted_until) y no se emiten esta corrida.
    const muted = mutedByUser.get(userId) ?? new Set<string>();
    const unreadFam = unreadByUserFamily.get(userId);
    if (unreadFam) {
      const until = new Date(nowMs + BACKOFF_DAYS * 86_400_000).toISOString();
      for (const [fam, count] of unreadFam) {
        if (count >= BACKOFF_UNREAD && !muted.has(fam)) {
          muted.add(fam);
          await supabase.from("neo_notification_prefs")
            .upsert({ user_id: userId, family: fam, muted_until: until, updated_at: new Date().toISOString() }, { onConflict: "user_id,family" });
        }
      }
    }

    // Filtrar ya enviados (una query por usuario) y duplicados de esta corrida
    // (misma clave, ej. P&L de un espacio en dos monedas); silenciados/pausados;
    // prioridad; emitir cap.
    const { data: sentRows } = await supabase.from("notification_log").select("alert_type").eq("user_id", userId);
    const sent = new Set((sentRows ?? []).map((r: { alert_type: string }) => r.alert_type));
    const fresh = candidates
      .filter((c) => !muted.has(notifFamily(c.type)))
      .filter((c) => !sent.has(c.alertType) && sent.add(c.alertType))
      .sort((x, y) => y.priority - x.priority);

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
