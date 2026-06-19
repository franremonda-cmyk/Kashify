import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { detectPurchaseIntent } from "@/lib/neo-keywords";

// ─── Types ─────────────────────────────────────────────────────────────────

type Intent =
  | { type: "greeting" }
  | { type: "help" }
  | { type: "cancel_pending" }
  | { type: "balance_query" }
  | { type: "spending_query"; category?: string; period: "month" | "week" | "today" }
  | { type: "income_query"; period: "month" | "week" | "today" }
  | { type: "summary_query" }
  | { type: "recent_tx_query" }
  | { type: "budget_query"; category?: string }
  | { type: "goals_query" }
  | { type: "installments_query" }
  | { type: "edit_budget"; category: string; amount: number }
  | { type: "delete_budget"; category: string }
  | { type: "delete_tx"; search: string }
  | { type: "register_tx"; txType: "income" | "expense"; amount: number; description: string; currency: string }
  | { type: "create_goal"; name: string; amount?: number }
  | { type: "delete_goal"; name: string }
  | { type: "rename_goal"; oldName: string; newName: string }
  | { type: "set_goal_target"; name: string; amount: number }
  | { type: "deposit_goal"; amount: number; goalName: string }
  | { type: "pay_installment"; name: string }
  | { type: "cancel_installment"; name: string }
  | { type: "create_installment_needs_info" }
  | { type: "create_installment"; name: string; installmentAmount: number; nInstallments: number }
  | { type: "natural_tx"; txType: "income" | "expense"; description: string; amount: number; suggestedCategory: string | null }
  | { type: "needs_amount"; txType: "income" | "expense"; description: string; suggestedCategory: string | null }
  | { type: "create_goal_needs_name" }
  | { type: "unknown" };

type PendingContext =
  | { type?: "needs_amount"; txType: "income" | "expense"; description: string; suggestedCategory: string | null }
  | { type: "create_goal_name" };

interface DeleteCandidate {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  date: string;
}

// ─── Intent detection (0 tokens) ────────────────────────────────────────────

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function detectIntent(msg: string): Intent {
  const m = normalize(msg);

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (/^(hola|buen[ao]s?|hey|hi|buenas tardes|buenas noches|buen dia|buen día|que tal|como estas?|como andas?|ola|saludos|buenas)\b/.test(m))
    return { type: "greeting" };

  // ── Cancel / dismiss ──────────────────────────────────────────────────────
  if (/^(no|nada|olvida(lo)?|cancela(lo)?|deja(lo)?|no importa|igual|salir|stop|listo gracias|no gracias|dejame)\b/.test(m))
    return { type: "cancel_pending" };

  // ── Help ──────────────────────────────────────────────────────────────────
  if (/ayuda|help|que pod[eé]s hacer|que puedes hacer|como te uso|como funciona[s]?|comandos|que hac[eé]s|que se puede|instrucciones|para que sirv[eé]s/.test(m))
    return { type: "help" };

  // ── Balance ───────────────────────────────────────────────────────────────
  if (/saldo|cuanto tengo|mis cuentas|mis balances|cuanta plata|cuanto hay|mi balance|ver balance|como estoy financieramente|como ando|como voy de plata|situacion financiera|plata que tengo|cuanto dinero|cuanto efectivo|cuanto me queda en total/.test(m))
    return { type: "balance_query" };

  // ── Summary ───────────────────────────────────────────────────────────────
  if (/resumen del mes|resumen mensual|^resumen$|como voy este mes|como voy en el mes|situacion del mes|balance del mes/.test(m))
    return { type: "summary_query" };

  // ── Income query ──────────────────────────────────────────────────────────
  if (/cuanto cobr[eé]|mis ingresos|cuanto ingres[eé]|cuanto entro|cuanto entró|cuanto me entro|cuanto entre\b|ingresos del mes|ingresos de esta semana|ingresos de hoy|cuanto gane este mes|cuanto gané este mes/.test(m)) {
    const period = /esta semana|semana/.test(m) ? "week" : /hoy/.test(m) ? "today" : "month";
    return { type: "income_query", period };
  }

  // ── Spending query ────────────────────────────────────────────────────────
  if (/cuanto gaste|cuanto gasté|cuanto he gastado|mis gastos|gaste esta|gasté esta|gaste hoy|gasté hoy|en que gaste|en que gasté|en qué gasté|que gaste|qué gasté|cuanto se fue|cuanto se gastó|gastos del mes|gastos de hoy|gastos de esta semana|cuanto salio|cuanto salió|mis egresos|gastos totales|cuanto llevo gastado/.test(m)) {
    const catMatch = m.match(/en\s+([a-záéíóúñ\w]+)(?:\s|$)/);
    const period = /esta semana|semana/.test(m) ? "week" : /hoy/.test(m) ? "today" : "month";
    return { type: "spending_query", category: catMatch?.[1], period };
  }

  // ── Recent transactions ───────────────────────────────────────────────────
  if (/ultimas transacciones|últimas transacciones|mis ultimas|mis últimas|ver transacciones|que registre|qué registré|que anote|qué anoté|ultimos gastos|últimos gastos|que compre\b|qué compré|historial|mis movimientos|movimientos recientes|ver movimientos|que registré hoy|últimos registros/.test(m))
    return { type: "recent_tx_query" };

  // ── Budget / limits ───────────────────────────────────────────────────────
  if (/mis limites|mis límites|ver limites|ver límites|cuanto me queda|cuánto me queda|cuanto tengo de|cuánto tengo de|me queda en|cuanto puedo gastar|que puedo gastar|mis presupuestos/.test(m))
    return { type: "budget_query" };

  // ── Goals ─────────────────────────────────────────────────────────────────
  if (/mis metas|ver metas|como van mis metas|mis ahorros|como van mis ahorros|cuanto ahorr[eé]|cuánto ahorré|progreso de mis metas|metas de ahorro|cuanto llevo ahorrado|mis objetivos|ahorros/.test(m))
    return { type: "goals_query" };

  // ── Installments ──────────────────────────────────────────────────────────
  if (/mis cuotas|ver cuotas|cuanto debo|cuánto debo|mis deudas|cuotas activas|cuotas pendientes|cuantas cuotas|cuántas cuotas|que cuotas tengo|mis pagos en cuotas|mis creditos/.test(m))
    return { type: "installments_query" };

  // ── Edit budget ───────────────────────────────────────────────────────────
  const editMatch = m.match(/(?:edit[ao]?r?|cambia[r]?|modifica[r]?|actualiza[r]?|pon[eé]|poner|fija[r]?|subi[r]?|baja[r]?)\s+(?:el\s+)?l[ií]?mite\s+(?:de\s+)?(.+?)\s+a\s+(\d[\d.,]*)/);
  if (editMatch) {
    const amount = parseFloat(editMatch[2].replace(/\./g, "").replace(",", "."));
    if (!isNaN(amount)) return { type: "edit_budget", category: editMatch[1].trim(), amount };
  }

  // ── Delete goal ───────────────────────────────────────────────────────────
  const deleteGoalMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:la\s+)?(?:meta|objetivo|ahorro)\s+(?:de\s+|llamad[ao]\s+)?["']?(.+?)["']?$/);
  if (deleteGoalMatch) return { type: "delete_goal", name: deleteGoalMatch[1].trim() };

  // ── Rename goal ───────────────────────────────────────────────────────────
  const renameGoalMatch = m.match(/(?:renombr[ao]r?|cambi[ao]r?\s+(?:el\s+)?nombre\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?)\s*["']?(.+?)["']?\s+a\s+["']?(.+?)["']?$/);
  if (renameGoalMatch) return { type: "rename_goal", oldName: renameGoalMatch[1].trim(), newName: renameGoalMatch[2].trim() };

  // ── Set goal target amount ────────────────────────────────────────────────
  const setGoalTargetMatch = m.match(/(?:cambi[ao]r?|edit[ao]r?|modific[ao]r?|actualiz[ao]r?|pon[eé]|fij[ao]r?)\s+(?:el\s+)?(?:objetivo|monto|target|meta)\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?["']?(.+?)["']?\s+a\s+(\d[\d.,]*)/);
  if (setGoalTargetMatch) {
    const amount = parseFloat(setGoalTargetMatch[2].replace(/\./g, "").replace(",", "."));
    if (!isNaN(amount)) return { type: "set_goal_target", name: setGoalTargetMatch[1].trim(), amount };
  }

  // ── Pay installment ───────────────────────────────────────────────────────
  const payInstallMatch = m.match(/(?:pag[ueé]|pagué|registr[ao]r?\s+(?:el\s+)?pago\s+de|pago\s+la\s+cuota\s+de|pagué\s+(?:la\s+)?cuota\s+de|pago\s+cuota\s+de)\s+["']?(.+?)["']?$/);
  if (payInstallMatch) return { type: "pay_installment", name: payInstallMatch[1].trim() };

  // ── Cancel installment ────────────────────────────────────────────────────
  const cancelInstallMatch = m.match(/(?:cancel[ao]r?|salda[r]?|cerr[ao]r?|termina[r]?|cancel[ao])\s+(?:la\s+)?(?:cuota|plan|deuda)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (cancelInstallMatch) return { type: "cancel_installment", name: cancelInstallMatch[1].trim() };

  // ── Delete budget ─────────────────────────────────────────────────────────
  const deleteBudgetMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borra el|elimina el|saca el|quita el)\s+(?:el\s+)?(?:l[ií]?mite|presupuesto)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (deleteBudgetMatch) return { type: "delete_budget", category: deleteBudgetMatch[1].trim() };

  // ── Delete transaction ────────────────────────────────────────────────────
  const deleteMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:el\s+|la\s+)?(?:(?:gasto|pago|ingreso|compra|transaccion)\s+(?:de\s+)?)?(.+)/);
  if (deleteMatch) return { type: "delete_tx", search: deleteMatch[1].trim() };

  // ── Register transaction (explicit) ──────────────────────────────────────
  if (/registr[ao]r?|anot[ao]r?|guard[ao]r?|carg[ao]r?|apunt[ao]r?/.test(m)) {
    const amtMatch = m.match(/(\d[\d.,]+)/);
    if (amtMatch) {
      const amount = parseFloat(amtMatch[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        const txType: "income" | "expense" = /ingreso|sueldo|cobr[eé]/.test(m) ? "income" : "expense";
        const cur = /usd|dolar/.test(m) ? "USD" : /eur/.test(m) ? "EUR" : "ARS";
        const descMatch = m.match(/(?:en|de|para|por)\s+(?!ars|usd|eur|uyu|brl)(.+)$/);
        const description = descMatch?.[1]?.replace(/\d[\d.,]*/g, "").trim() ?? "";
        return { type: "register_tx", txType, amount, description, currency: cur };
      }
    }
  }

  // ── Create goal ───────────────────────────────────────────────────────────
  const goalCreateMatch = m.match(/(?:agrega[r]?|crea[r]?|nueva|nuevo)\s+(?:una?\s+)?(?:nueva?\s+)?(?:meta|objetivo|ahorro)\s+(?:(?:llamad[ao]|con\s+nombre)\s+)?["']?(.+?)["']?\s*(?:(?:de|con\s+objetivo)\s+(\d[\d.,]*))?$/);
  if (goalCreateMatch) {
    const name = goalCreateMatch[1].trim();
    const amount = goalCreateMatch[2] ? parseFloat(goalCreateMatch[2].replace(/\./g, "").replace(",", ".")) : undefined;
    if (name.length > 0) return { type: "create_goal", name, amount };
  }
  if (/(?:agrega[r]?|crea[r]?|nueva|nuevo)\s+(?:una?\s+)?(?:nueva?\s+)?(?:meta|objetivo)\b/.test(m))
    return { type: "create_goal_needs_name" };

  // ── Deposit to goal ───────────────────────────────────────────────────────
  const depositMatch = m.match(/(?:deposit[ao]r?|sum[ao]r?|sumal[eo]|agreg[ao]r?l?[eo]?|ponel[eo]|cargal[eo]|mandal[eo])\s+(\d[\d.,]+)\s*(?:pesos|ars|usd|eur|uyu)?\s*(?:a|en|para)\s+(?:(?:la\s+)?(?:meta|ahorro)\s+)?["']?(.+?)["']?$/);
  if (depositMatch) {
    const amount = parseFloat(depositMatch[1].replace(/\./g, "").replace(",", "."));
    if (!isNaN(amount) && amount > 0) return { type: "deposit_goal", amount, goalName: depositMatch[2].trim() };
  }

  // ── Create installment — without details (ask for info) ──────────────────
  if (/(?:nueva\s+cuota|cuota\s+nueva|quiero\s+(?:una?\s+)?cuota|agrega[r]?\s+(?:una?\s+)?cuota\s*$|nueva\s+cuota\s*$)/.test(m))
    return { type: "create_installment_needs_info" };

  // ── Create installment ────────────────────────────────────────────────────
  const cuotaMatch = m.match(/(?:agrega[r]?|crea[r]?|nueva)\s+(?:una\s+)?cuota\s+(?:de\s+|llamada\s+|para\s+)?(.+?)\s+(?:por\s+|de\s+|en\s+)(\d+)\s+(?:cuotas?|meses?|pagos?)\s+(?:de\s+|a\s+)?(\d[\d.,]*)/);
  if (cuotaMatch) {
    const installmentAmount = parseFloat(cuotaMatch[3].replace(/\./g, "").replace(",", "."));
    const nInstallments = parseInt(cuotaMatch[2]);
    if (!isNaN(installmentAmount) && !isNaN(nInstallments) && nInstallments > 0)
      return { type: "create_installment", name: cuotaMatch[1].trim(), installmentAmount, nInstallments };
  }

  // ── Natural language purchase/income (keyword library, 0 tokens) ──────────
  const purchase = detectPurchaseIntent(m);
  if (purchase.found) {
    if (purchase.amount !== null)
      return { type: "natural_tx", txType: purchase.txType, description: purchase.item, amount: purchase.amount, suggestedCategory: purchase.suggestedCategory };
    else
      return { type: "needs_amount", txType: purchase.txType, description: purchase.item, suggestedCategory: purchase.suggestedCategory };
  }

  return { type: "unknown" };
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function monthRange() {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth() + 1;
  const from = `${y}-${String(mo).padStart(2, "0")}-01`;
  const last = new Date(y, mo, 0).getDate();
  const to = `${y}-${String(mo).padStart(2, "0")}-${last}`;
  return { from, to };
}

function weekRange() {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
  const from = mon.toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];
  return { from, to };
}

function todayRange() {
  const today = new Date().toISOString().split("T")[0];
  return { from: today, to: today };
}

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
  categoryName: string
): Promise<string | null> {
  const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", userId);
  const match = cats?.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
  return match?.id ?? null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message: string = body.message ?? "";
  const pendingContext: PendingContext | undefined = body.pendingContext;
  if (!message.trim()) return NextResponse.json({ text: "Escribime algo 😊" });

  // If there's pending context from a previous Neo question
  if (pendingContext) {
    if (pendingContext.type === "create_goal_name") {
      // User replied with the goal name
      const name = message.trim();
      if (name.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
        const currency = profile?.primary_currency ?? "ARS";
        const { error } = await supabase.from("savings_goals").insert({
          user_id: user.id, name, currency_code: currency, target_amount: 0, current_amount: 0,
        });
        if (error) return NextResponse.json({ text: "No pude crear la meta. Intentá desde la sección Metas." });
        return NextResponse.json({ text: `✅ Meta "${name}" creada. ¡A ahorrar!`, action: { type: "refresh" } });
      }
    } else if (/^\d[\d.,]*$/.test(message.trim())) {
      // User replied with an amount (needs_amount flow)
      const amount = parseFloat(message.trim().replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
        const currency = profile?.primary_currency ?? "ARS";
        const catId = pendingContext.suggestedCategory ? await resolveCategoryId(supabase, user.id, pendingContext.suggestedCategory) : null;
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: pendingContext.txType,
          amount,
          currency_code: currency,
          description: pendingContext.description,
          date: new Date().toISOString().split("T")[0],
          category_id: catId,
        });
        if (error) return NextResponse.json({ text: "No pude registrarlo. Intentá desde el botón +." });
        const catLabel = pendingContext.suggestedCategory ? ` · ${pendingContext.suggestedCategory}` : "";
        return NextResponse.json({ text: `✅ Registré: ${pendingContext.description} — ${fmt(amount, currency)}${catLabel}.`, action: { type: "refresh" } });
      }
    }
  }

  const intent = detectIntent(message);

  // ── Greeting (0 tokens, 0 DB) ─────────────────────────────────────────────
  if (intent.type === "greeting") {
    const opts = [
      "¡Hola! ¿En qué te ayudo hoy?",
      "¡Hola! ¿Registramos algo o querés ver cómo van tus finanzas?",
      "¡Buenas! ¿Qué necesitás?",
    ];
    return NextResponse.json({ text: opts[Math.floor(Math.random() * opts.length)] });
  }

  // ── Cancel pending (0 tokens, 0 DB) ──────────────────────────────────────
  if (intent.type === "cancel_pending") {
    return NextResponse.json({ text: "Dale, cancelado.", action: { type: "cancel_pending" } });
  }

  // ── Help (0 tokens, 0 DB) ─────────────────────────────────────────────────
  if (intent.type === "help") {
    return NextResponse.json({
      text: `Puedo ayudarte con:\n• Registrar gastos: "compré nafta por 5000"\n• Registrar ingresos: "cobré el sueldo"\n• Ver saldo: "¿cuánto tengo?"\n• Ver gastos: "¿cuánto gasté este mes?"\n• Resumen del mes: "resumen"\n• Últimas transacciones: "mis últimas"\n\nMetas:\n• Ver: "mis metas"\n• Crear: "agrega una meta viaje"\n• Renombrar: "renombrá la meta viaje a vacaciones"\n• Cambiar objetivo: "cambiá el objetivo de viaje a 50000"\n• Depositar: "depositá 5000 en viaje"\n• Eliminar: "eliminá la meta viaje"\n\nCuotas:\n• Ver: "mis cuotas"\n• Crear: "agrega cuota Netflix por 6 meses de 5000"\n• Pagar: "pagué la cuota de Netflix"\n• Saldar: "cancelá la cuota de iPhone"\n\nLímites:\n• Ver: "mis límites"\n• Editar: "editá el límite de Comida a 30000"\n• Eliminar: "eliminá el límite de Comida"`,
    });
  }

  // ── Balance ──────────────────────────────────────────────────────────────
  if (intent.type === "balance_query") {
    const { data: balances } = await supabase
      .from("transactions")
      .select("amount, currency_code, type")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("type", ["income", "expense", "installment-payment"]);

    if (!balances?.length) return NextResponse.json({ text: "Todavía no tenés transacciones registradas." });

    const byCurrency: Record<string, number> = {};
    for (const t of balances) {
      const sign = t.type === "income" ? 1 : -1;
      byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + sign * Number(t.amount);
    }
    const lines = Object.entries(byCurrency)
      .map(([cur, bal]) => `${cur}: ${bal >= 0 ? "+" : ""}${bal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)
      .join("\n");
    return NextResponse.json({ text: `Tu balance acumulado:\n${lines}` });
  }

  // ── Spending query ────────────────────────────────────────────────────────
  if (intent.type === "spending_query") {
    const range = intent.period === "week" ? weekRange() : intent.period === "today" ? todayRange() : monthRange();
    let query = supabase
      .from("transactions")
      .select("amount, currency_code, categories(name)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("type", ["expense", "installment-payment"])
      .gte("date", range.from)
      .lte("date", range.to);

    if (intent.category) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", user.id);
      const catNorm = normalize(intent.category);
      const match = cats?.find(c => normalize(c.name).includes(catNorm) || catNorm.includes(normalize(c.name)));
      if (match) query = query.eq("category_id", match.id);
    }

    const { data: txs } = await query;
    if (!txs?.length) {
      const period = intent.period === "week" ? "esta semana" : intent.period === "today" ? "hoy" : "este mes";
      const cat = intent.category ? ` en ${intent.category}` : "";
      return NextResponse.json({ text: `No encontré gastos${cat} ${period}.` });
    }

    const byCurrency: Record<string, number> = {};
    for (const t of txs) byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + Number(t.amount);
    const period = intent.period === "week" ? "esta semana" : intent.period === "today" ? "hoy" : "este mes";
    const cat = intent.category ? ` en ${intent.category}` : "";
    const lines = Object.entries(byCurrency).map(([cur, amt]) => fmt(amt, cur)).join(" · ");
    return NextResponse.json({ text: `Gastaste${cat} ${period}: ${lines} (${txs.length} transacciones).` });
  }

  // ── Income query ──────────────────────────────────────────────────────────
  if (intent.type === "income_query") {
    const range = intent.period === "week" ? weekRange() : intent.period === "today" ? todayRange() : monthRange();
    const periodLabel = intent.period === "week" ? "esta semana" : intent.period === "today" ? "hoy" : "este mes";
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, currency_code")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("type", "income")
      .gte("date", range.from)
      .lte("date", range.to);
    if (!txs?.length) return NextResponse.json({ text: `No registraste ingresos ${periodLabel}.` });
    const byCurrency: Record<string, number> = {};
    for (const t of txs) byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + Number(t.amount);
    const lines = Object.entries(byCurrency).map(([cur, amt]) => fmt(amt, cur)).join(" · ");
    return NextResponse.json({ text: `Ingresaste ${periodLabel}: ${lines} (${txs.length} ${txs.length === 1 ? "ingreso" : "ingresos"}).` });
  }

  // ── Summary query ─────────────────────────────────────────────────────────
  if (intent.type === "summary_query") {
    const { from, to } = monthRange();
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, currency_code, type")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("type", ["income", "expense", "installment-payment"])
      .gte("date", from).lte("date", to);
    if (!txs?.length) return NextResponse.json({ text: "No hay movimientos este mes todavía." });
    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    for (const t of txs) {
      const n = Number(t.amount);
      if (t.type === "income") inc[t.currency_code] = (inc[t.currency_code] ?? 0) + n;
      else exp[t.currency_code] = (exp[t.currency_code] ?? 0) + n;
    }
    const currencies = [...new Set([...Object.keys(inc), ...Object.keys(exp)])];
    const lines = currencies.map(cur => {
      const i = inc[cur] ?? 0;
      const e = exp[cur] ?? 0;
      const net = i - e;
      return `${cur}:\n  Ingresos: ${fmt(i, cur)}\n  Gastos: ${fmt(e, cur)}\n  Neto: ${net >= 0 ? "+" : ""}${fmt(Math.abs(net), cur)}${net < 0 ? " 🔴" : " 🟢"}`;
    });
    return NextResponse.json({ text: `Resumen de este mes:\n${lines.join("\n\n")}` });
  }

  // ── Recent transactions ───────────────────────────────────────────────────
  if (intent.type === "recent_tx_query") {
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, currency_code, type, description, date, categories(name)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(7);
    if (!txs?.length) return NextResponse.json({ text: "No tenés transacciones registradas." });
    const lines = txs.map(t => {
      const cat = t.categories as { name?: string } | null;
      const sign = t.type === "income" ? "+" : "-";
      const d = new Date(t.date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
      return `${d} · ${t.description || cat?.name || "Sin descripción"} ${sign}${fmt(Number(t.amount), t.currency_code)}`;
    });
    return NextResponse.json({ text: `Últimas transacciones:\n${lines.join("\n")}` });
  }

  // ── Budget query ──────────────────────────────────────────────────────────
  if (intent.type === "budget_query") {
    const { from } = monthRange();
    const { data: budgets } = await supabase
      .from("category_budgets")
      .select("monthly_limit, currency_code, categories(id, name)")
      .eq("user_id", user.id);

    if (!budgets?.length) return NextResponse.json({ text: "No tenés límites configurados. Podés agregar uno en la sección Categorías." });

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, category_id, currency_code")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("type", ["expense", "installment-payment"])
      .gte("date", from);

    const spentByCat: Record<string, number> = {};
    for (const t of txs ?? []) {
      if (t.category_id) spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount);
    }

    const lines = budgets.map(b => {
      const cat = b.categories as unknown as { id: string; name: string } | null;
      if (!cat) return null;
      const spent = spentByCat[cat.id] ?? 0;
      const pct = Math.round((spent / b.monthly_limit) * 100);
      const bar = pct >= 100 ? "🔴" : pct >= 80 ? "🟡" : "🟢";
      return `${bar} ${cat.name}: ${fmt(spent, b.currency_code)} / ${fmt(b.monthly_limit, b.currency_code)} (${pct}%)`;
    }).filter(Boolean);

    return NextResponse.json({ text: `Tus límites este mes:\n${lines.join("\n")}` });
  }

  // ── Goals query ───────────────────────────────────────────────────────────
  if (intent.type === "goals_query") {
    const { data: goals } = await supabase
      .from("savings_goals")
      .select("name, current_amount, target_amount, currency_code")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (!goals?.length) return NextResponse.json({ text: "No tenés metas de ahorro configuradas. Podés crear una en la sección Metas." });

    const lines = goals.map(g => {
      const pct = Math.round((g.current_amount / g.target_amount) * 100);
      const bar = pct >= 100 ? "✅" : pct >= 50 ? "🔵" : "⚪";
      return `${bar} ${g.name}: ${fmt(g.current_amount, g.currency_code)} / ${fmt(g.target_amount, g.currency_code)} (${pct}%)`;
    });

    return NextResponse.json({ text: `Tus metas de ahorro:\n${lines.join("\n")}` });
  }

  // ── Installments query ────────────────────────────────────────────────────
  if (intent.type === "installments_query") {
    const { data: plans } = await supabase
      .from("installment_plans")
      .select("name, installment_amount, currency_code, n_installments, installment_payments(status)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (!plans?.length) return NextResponse.json({ text: "No tenés cuotas activas en este momento." });

    const lines = plans.map(p => {
      const payments = (p.installment_payments ?? []) as { status: string }[];
      const paid = payments.filter(x => x.status === "paid").length;
      return `• ${p.name}: cuota ${paid + 1}/${p.n_installments} — ${fmt(p.installment_amount, p.currency_code)} c/u`;
    });

    return NextResponse.json({ text: `Cuotas activas:\n${lines.join("\n")}` });
  }

  // ── Edit budget ───────────────────────────────────────────────────────────
  if (intent.type === "edit_budget") {
    const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", user.id);
    const catNorm = normalize(intent.category);
    const match = cats?.find(c => normalize(c.name).includes(catNorm) || catNorm.includes(normalize(c.name)));
    if (!match) return NextResponse.json({ text: `No encontré la categoría "${intent.category}". Revisá el nombre en la sección Categorías.` });

    const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
    await supabase.from("category_budgets").upsert(
      { user_id: user.id, category_id: match.id, monthly_limit: intent.amount, currency_code: profile?.primary_currency ?? "ARS", period_type: "always" },
      { onConflict: "user_id,category_id" }
    );

    return NextResponse.json({ text: `✅ Listo. Actualicé el límite de ${match.name} a ${fmt(intent.amount, profile?.primary_currency ?? "ARS")} por mes.` });
  }

  // ── Delete goal (ask confirmation) ───────────────────────────────────────
  if (intent.type === "delete_goal") {
    const { data: goals } = await supabase.from("savings_goals").select("id, name").eq("user_id", user.id).neq("status", "archived");
    const goalNorm = normalize(intent.name);
    const match = goals?.find(g => normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name)));
    if (!match) return NextResponse.json({ text: `No encontré una meta llamada "${intent.name}". Revisá los nombres en Metas.` });
    return NextResponse.json({
      text: `¿Seguro que querés eliminar la meta "${match.name}"? Esta acción no se puede deshacer.`,
      action: { type: "confirm_delete_goal", goalId: match.id, goalName: match.name },
    });
  }

  // ── Rename goal ───────────────────────────────────────────────────────────
  if (intent.type === "rename_goal") {
    const { data: goals } = await supabase.from("savings_goals").select("id, name").eq("user_id", user.id).neq("status", "archived");
    const oldNorm = normalize(intent.oldName);
    const match = goals?.find(g => normalize(g.name).includes(oldNorm) || oldNorm.includes(normalize(g.name)));
    if (!match) return NextResponse.json({ text: `No encontré una meta llamada "${intent.oldName}".` });
    await supabase.from("savings_goals").update({ name: intent.newName }).eq("id", match.id).eq("user_id", user.id);
    return NextResponse.json({ text: `Renombré "${match.name}" a "${intent.newName}".`, action: { type: "refresh" } });
  }

  // ── Set goal target ───────────────────────────────────────────────────────
  if (intent.type === "set_goal_target") {
    const { data: goals } = await supabase.from("savings_goals").select("id, name, currency_code").eq("user_id", user.id).neq("status", "archived");
    const goalNorm = normalize(intent.name);
    const match = goals?.find(g => normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name)));
    if (!match) return NextResponse.json({ text: `No encontré una meta llamada "${intent.name}".` });
    await supabase.from("savings_goals").update({ target_amount: intent.amount }).eq("id", match.id).eq("user_id", user.id);
    return NextResponse.json({ text: `Actualicé el objetivo de "${match.name}" a ${fmt(intent.amount, match.currency_code)}.`, action: { type: "refresh" } });
  }

  // ── Pay installment ───────────────────────────────────────────────────────
  if (intent.type === "pay_installment") {
    const { data: plans } = await supabase.from("installment_plans").select("id, name, installment_amount, currency_code, n_installments").eq("user_id", user.id).eq("status", "active");
    const nameNorm = normalize(intent.name);
    const match = plans?.find(p => normalize(p.name).includes(nameNorm) || nameNorm.includes(normalize(p.name)));
    if (!match) return NextResponse.json({ text: `No encontré una cuota activa llamada "${intent.name}".` });

    // Find next pending payment
    const { data: next } = await supabase.from("installment_payments").select("id, payment_number, amount").eq("plan_id", match.id).eq("user_id", user.id).eq("status", "pending").order("payment_number", { ascending: true }).limit(1).single();
    if (!next) return NextResponse.json({ text: `No hay cuotas pendientes para "${match.name}".` });

    // Create transaction
    const { data: tx } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "installment-payment",
      amount: next.amount,
      currency_code: match.currency_code,
      description: `${match.name} — cuota ${next.payment_number}/${match.n_installments}`,
      date: new Date().toISOString().split("T")[0],
    }).select().single();

    await supabase.from("installment_payments").update({ status: "paid", transaction_id: tx?.id ?? null }).eq("id", next.id).eq("user_id", user.id);

    // Check if all paid
    const { count } = await supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("plan_id", match.id).eq("user_id", user.id).eq("status", "pending");
    if ((count ?? 0) === 0) {
      await supabase.from("installment_plans").update({ status: "paid" }).eq("id", match.id).eq("user_id", user.id);
      return NextResponse.json({ text: `Registré el último pago de "${match.name}". ¡Plan saldado!`, action: { type: "refresh" } });
    }

    return NextResponse.json({ text: `Registré la cuota ${next.payment_number}/${match.n_installments} de "${match.name}" — ${fmt(Number(next.amount), match.currency_code)}.`, action: { type: "refresh" } });
  }

  // ── Cancel installment (ask confirmation) ─────────────────────────────────
  if (intent.type === "cancel_installment") {
    const { data: plans } = await supabase.from("installment_plans").select("id, name").eq("user_id", user.id).eq("status", "active");
    const nameNorm = normalize(intent.name);
    const match = plans?.find(p => normalize(p.name).includes(nameNorm) || nameNorm.includes(normalize(p.name)));
    if (!match) return NextResponse.json({ text: `No encontré una cuota activa llamada "${intent.name}".` });
    return NextResponse.json({
      text: `¿Seguro que querés saldar el plan "${match.name}"? Se eliminarán los pagos pendientes.`,
      action: { type: "confirm_cancel_installment", planId: match.id, planName: match.name },
    });
  }

  // ── Delete budget ─────────────────────────────────────────────────────────
  if (intent.type === "delete_budget") {
    const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", user.id);
    const catNorm = normalize(intent.category);
    const match = cats?.find(c => normalize(c.name).includes(catNorm) || catNorm.includes(normalize(c.name)));
    if (!match) return NextResponse.json({ text: `No encontré la categoría "${intent.category}".` });
    const { error } = await supabase.from("category_budgets").delete().eq("user_id", user.id).eq("category_id", match.id);
    if (error) return NextResponse.json({ text: "No pude eliminar el límite. Intentá desde Categorías." });
    return NextResponse.json({ text: `Eliminé el límite mensual de ${match.name}.`, action: { type: "refresh" } });
  }

  // ── Delete transaction ────────────────────────────────────────────────────
  if (intent.type === "delete_tx") {
    const { from } = monthRange();
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, description, amount, currency_code, date")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("date", from)
      .order("date", { ascending: false })
      .limit(50);

    const searchNorm = normalize(intent.search);
    const candidates = (txs ?? []).filter(t =>
      normalize(t.description).includes(searchNorm) || searchNorm.includes(normalize(t.description).split(" ")[0])
    ).slice(0, 3) as DeleteCandidate[];

    if (!candidates.length) return NextResponse.json({ text: `No encontré ningún gasto que coincida con "${intent.search}" este mes.` });

    return NextResponse.json({
      text: candidates.length === 1
        ? `Encontré esto: ${candidates[0].description} — ${fmt(candidates[0].amount, candidates[0].currency_code)}. ¿Lo elimino?`
        : `Encontré ${candidates.length} transacciones que podrían coincidir. ¿Cuál querés eliminar?`,
      action: { type: "confirm_delete", candidates },
    });
  }

  // ── Register transaction ──────────────────────────────────────────────────
  if (intent.type === "register_tx") {
    const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
    const currency = intent.currency !== "ARS" ? intent.currency : (profile?.primary_currency ?? "ARS");

    // Auto-categorize by matching description against category names
    let categoryId: string | null = null;
    if (intent.description) {
      const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", user.id);
      const descNorm = normalize(intent.description);
      const catMatch = cats?.find(c =>
        descNorm.includes(normalize(c.name)) ||
        normalize(c.name).split(" ").some((w: string) => w.length > 3 && descNorm.includes(w))
      );
      categoryId = catMatch?.id ?? null;
    }

    const desc = intent.description || (intent.txType === "expense" ? "Gasto" : "Ingreso");
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: intent.txType,
      amount: intent.amount,
      currency_code: currency,
      description: desc,
      date: new Date().toISOString().split("T")[0],
      category_id: categoryId,
    });

    if (error) return NextResponse.json({ text: "No pude registrar la transacción. Intentá desde el botón +." });
    return NextResponse.json({
      text: `✅ Registré: ${desc} — ${fmt(intent.amount, currency)}.`,
      action: { type: "refresh" },
    });
  }

  // ── Create goal ───────────────────────────────────────────────────────────
  if (intent.type === "create_goal") {
    const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
    const currency = profile?.primary_currency ?? "ARS";
    const { error } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: intent.name,
      target_amount: intent.amount ?? 0,
      current_amount: 0,
      currency_code: currency,
      status: "active",
    });
    if (error) return NextResponse.json({ text: "No pude crear la meta. Intentá desde la sección Metas." });
    return NextResponse.json({
      text: intent.amount
        ? `✅ Creé la meta "${intent.name}" con objetivo de ${fmt(intent.amount, currency)}.`
        : `✅ Creé la meta "${intent.name}". Podés agregarle un objetivo de ahorro desde Metas.`,
      action: { type: "refresh" },
    });
  }

  // ── Deposit to goal ───────────────────────────────────────────────────────
  if (intent.type === "deposit_goal") {
    const { data: goals } = await supabase.from("savings_goals")
      .select("id, name, current_amount, target_amount, currency_code")
      .eq("user_id", user.id).neq("status", "archived");
    const goalNorm = normalize(intent.goalName);
    const match = goals?.find(g =>
      normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name))
    );
    if (!match) return NextResponse.json({ text: `No encontré una meta llamada "${intent.goalName}". Revisá los nombres en Metas.` });

    const newTotal = Number(match.current_amount) + intent.amount;
    await supabase.from("savings_goals").update({ current_amount: newTotal }).eq("id", match.id);
    const pct = match.target_amount > 0 ? Math.round((newTotal / match.target_amount) * 100) : null;
    const icon = pct !== null ? (pct >= 100 ? "✅" : pct >= 75 ? "🔵" : pct >= 50 ? "⚪" : "🔘") : "💰";
    return NextResponse.json({
      text: `${icon} Sumé ${fmt(intent.amount, match.currency_code)} a "${match.name}".\nTotal: ${fmt(newTotal, match.currency_code)}${pct !== null ? ` (${pct}%)` : ""}.`,
      action: { type: "refresh" },
    });
  }

  // ── Create installment needs info ────────────────────────────────────────
  if (intent.type === "create_installment_needs_info") {
    return NextResponse.json({
      text: "Para crear la cuota necesito un poco más:\n• Nombre (ej: Netflix, iPhone 15)\n• Cuántas cuotas\n• Monto por cuota\n\nEjemplo: \"agrega cuota iPhone por 12 cuotas de 45000\"",
    });
  }

  // ── Create installment ────────────────────────────────────────────────────
  if (intent.type === "create_installment") {
    const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
    const currency = profile?.primary_currency ?? "ARS";
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("installment_plans").insert({
      user_id: user.id,
      name: intent.name,
      installment_amount: intent.installmentAmount,
      n_installments: intent.nInstallments,
      currency_code: currency,
      status: "active",
      start_date: today,
    });
    if (error) return NextResponse.json({ text: "No pude crear la cuota. Intentá desde la sección Cuotas." });
    return NextResponse.json({
      text: `✅ Creé la cuota "${intent.name}": ${intent.nInstallments} cuotas de ${fmt(intent.installmentAmount, currency)}.\nTotal: ${fmt(intent.installmentAmount * intent.nInstallments, currency)}.`,
      action: { type: "refresh" },
    });
  }

  // ── Natural language transaction (with amount) ────────────────────────────
  if (intent.type === "natural_tx") {
    const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
    const currency = profile?.primary_currency ?? "ARS";
    const catId = intent.suggestedCategory ? await resolveCategoryId(supabase, user.id, intent.suggestedCategory) : null;
    const desc = intent.description || (intent.txType === "income" ? "Ingreso" : "Gasto");
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: intent.txType,
      amount: intent.amount,
      currency_code: currency,
      description: desc,
      date: new Date().toISOString().split("T")[0],
      category_id: catId,
    });
    if (error) return NextResponse.json({ text: "No pude registrarlo. Intentá desde el botón +." });
    const catLabel = intent.suggestedCategory ? ` · ${intent.suggestedCategory}` : "";
    return NextResponse.json({
      text: `✅ Registré: ${desc} — ${fmt(intent.amount, currency)}${catLabel}.`,
      action: { type: "refresh" },
    });
  }

  // ── Create goal needs name — ask for it ──────────────────────────────────
  if (intent.type === "create_goal_needs_name") {
    return NextResponse.json({
      text: "¿Cómo querés llamarla?",
      action: { type: "needs_goal_name" },
    });
  }

  // ── Needs amount — ask follow-up (no DB write yet) ────────────────────────
  if (intent.type === "needs_amount") {
    const phrase = intent.txType === "income" ? "¿Cuánto cobraste?" : "¿Cuánto te salió?";
    return NextResponse.json({
      text: `Entendido, ${intent.description}. ${phrase}`,
      action: { type: "needs_amount", txType: intent.txType, description: intent.description, suggestedCategory: intent.suggestedCategory },
    });
  }

  // ── Unknown → Haiku fallback (if message is long enough to be parseable) ──
  if (message.trim().split(" ").length >= 4) {
    try {
      const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
      const currency = profile?.primary_currency ?? "ARS";
      const client = new Anthropic();
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `Sos un asistente de finanzas personales. Clasificá este mensaje en español como JSON (sin explicación):\n{"type":"expense"|"income"|"unknown","amount":number|null,"description":"string"}\n- "expense": gasto, compra, pago, salida de dinero\n- "income": cobro, ingreso, depósito, entrada de dinero\n- "unknown": no es claramente un gasto o ingreso\nMoneda: ${currency}\nMensaje: "${message.trim()}"`,
        }],
      });
      const raw = (resp.content[0] as { type: string; text: string }).text.trim();
      const parsed = JSON.parse(raw.replace(/```json?|```/g, "").trim());
      if (parsed.type !== "unknown" && parsed.amount && parsed.description) {
        const catId = null;
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: parsed.type,
          amount: parsed.amount,
          currency_code: currency,
          description: parsed.description,
          date: new Date().toISOString().split("T")[0],
          category_id: catId,
        });
        if (!error) return NextResponse.json({ text: `✅ Registré: ${parsed.description} — ${fmt(parsed.amount, currency)}.`, action: { type: "refresh" } });
      }
    } catch {
      // fallback to hint list below
    }
  }

  // ── Unknown → hint list ───────────────────────────────────────────────────
  const hints = [
    "¿Cuánto gasté este mes?",
    "¿Cuál es mi saldo?",
    "Mis límites · Mis metas · Mis cuotas",
    "Compré una milanesa por 1500",
    "Cobré el sueldo de 200000",
    "Agrega una meta llamada viaje",
    "Depositá 5000 en la meta viaje",
    "Pagué la cuota de Netflix",
    "Cancelá la cuota de iPhone",
    "Borrá el gasto de [descripción]",
    "Escribí 'ayuda' para ver todo lo que puedo hacer",
  ];
  return NextResponse.json({
    text: `No entendí bien. Podés pedirme:\n${hints.map(h => `• ${h}`).join("\n")}`,
  });
}
