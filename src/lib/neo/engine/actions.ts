import { generatePaymentDates } from "@/lib/installments/calculator";
import { categoryForText, CATEGORY_FALLBACK } from "@/lib/neo-keywords";
import { learnFromCorrection } from "@/lib/neo/learning";
import { payDebt } from "@/lib/debts/pay";
import { scopeForSpace } from "@/lib/space-scope";
import { deleteSpaceGuarded } from "@/lib/spaces";
import { NOTIF_FAMILIES, typesForFamily, type NotifFamily } from "@/lib/neo/insights";
import { normalize } from "./intent";
import { missingSlot, slotQuestion } from "./flow";
import type {
  DeleteCandidate,
  FlowContext,
  Intent,
  NeoChannel,
  NeoReply,
  NeoSupabase,
  PendingConfirm,
} from "./types";

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
  return { from: mon.toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
}

function todayRange() {
  const today = new Date().toISOString().split("T")[0];
  return { from: today, to: today };
}

function fmt(n: number, currency: string): string {
  return `${currency} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

// Resuelve el nombre sugerido por Neo a una categoría REAL del usuario. Orden:
// exacto → mejor-encaje (CATEGORY_FALLBACK, ej. Hogar→Servicios) → parcial → Otros.
// Así nada queda sin categorizar y la etiqueta refleja dónde entró de verdad.
async function resolveCategory(supabase: NeoSupabase, userId: string, categoryName: string): Promise<{ id: string; name: string } | null> {
  const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", userId);
  const list = (cats as { id: string; name: string }[] | null) ?? [];
  if (!list.length) return null;
  const lower = categoryName.toLowerCase();
  const exact = list.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;
  const fb = CATEGORY_FALLBACK[categoryName];
  if (fb) {
    const fbMatch = list.find((c) => c.name.toLowerCase() === fb.toLowerCase());
    if (fbMatch) return fbMatch;
  }
  const n = normalize(categoryName);
  const partial = list.find((c) => normalize(c.name).includes(n) || n.includes(normalize(c.name)));
  if (partial) return partial;
  return list.find((c) => c.name.toLowerCase() === "otros") ?? null;
}

async function findCategory(supabase: NeoSupabase, userId: string, name: string): Promise<{ id: string; name: string } | null> {
  const { data: cats } = await supabase.from("categories").select("id, name").eq("user_id", userId);
  const norm = normalize(name);
  return (cats as { id: string; name: string }[] | null)?.find(
    (c) => normalize(c.name).includes(norm) || norm.includes(normalize(c.name))
  ) ?? null;
}

async function primaryCurrency(supabase: NeoSupabase, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("primary_currency").eq("user_id", userId).single();
  return profile?.primary_currency ?? "ARS";
}

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Cómo el usuario nombra una familia de avisos → la familia real. Primero por
// nombre exacto/parcial, después por sinónimos de lo que dice la gente.
const FAMILY_SYNONYMS: Record<string, NotifFamily> = {
  presupuesto: "limites", presupuestos: "limites",
  pico: "gastos", picos: "gastos", gasto: "gastos",
  resumenes: "resumen", cierre: "resumen",
  meta: "metas", ahorro: "metas", ahorros: "metas",
  cuota: "cuotas", tarjeta: "cuotas",
  deuda: "deudas", prestamos: "deudas",
  repiten: "recurrentes", recurrente: "recurrentes", suscripciones: "recurrentes",
  espacio: "espacios",
  recordatorios: "registrar", inactividad: "registrar",
  felicitaciones: "logros", logro: "logros", aniversario: "logros",
};

function resolveNotifFamily(term: string): { family: NotifFamily; label: string } | null {
  const t = normalize(term).replace(/[.!?]+$/, "").trim();
  const exact = NOTIF_FAMILIES.find((f) => f.family === t || t.includes(f.family));
  if (exact) return exact;
  for (const [word, fam] of Object.entries(FAMILY_SYNONYMS)) {
    if (t.includes(word)) {
      const hit = NOTIF_FAMILIES.find((f) => f.family === fam);
      if (hit) return hit;
    }
  }
  return null;
}

// Deuda activa por contraparte (match laxo: "juan" encuentra "Juan Pérez").
async function findDebt(supabase: NeoSupabase, userId: string, counterparty: string, scope: string[]) {
  const { data } = await supabase.from("debts")
    .select("id, counterparty, direction, total_amount, paid_amount, currency_code")
    .eq("user_id", userId).eq("status", "active").in("space_id", scope);
  const norm = normalize(counterparty);
  return (data as { id: string; counterparty: string; direction: string; total_amount: number; paid_amount: number; currency_code: string }[] | null)
    ?.find((d) => normalize(d.counterparty).includes(norm) || norm.includes(normalize(d.counterparty))) ?? null;
}

// ─── Espacios ────────────────────────────────────────────────────────────────

export interface SpaceRow { id: string; name: string; is_default: boolean; include_in_total: boolean }

export async function loadUserSpaces(supabase: NeoSupabase, userId: string): Promise<SpaceRow[]> {
  const { data } = await supabase.from("spaces").select("id, name, is_default, include_in_total")
    .eq("user_id", userId).order("sort_order").order("created_at");
  return (data as SpaceRow[] | null) ?? [];
}

function defaultSpaceFrom(spaces: SpaceRow[]): string | undefined {
  return (spaces.find((s) => s.is_default) ?? spaces[0])?.id;
}

// Espacio destino para una escritura no-movimiento (meta/presupuesto/cuota):
// el espacio activo de la web si lo hay, sino el espacio por defecto del usuario.
async function getWriteSpaceId(supabase: NeoSupabase, userId: string, activeSpaceId?: string | null): Promise<string | undefined> {
  if (activeSpaceId) return activeSpaceId;
  return defaultSpaceFrom(await loadUserSpaces(supabase, userId));
}

export function spaceQuestion(spaces: SpaceRow[]): { text: string; options: string[] } {
  const list = spaces.map((s, i) => `${i + 1}) ${s.name}`).join("\n");
  return { text: `¿A qué espacio lo sumo?\n${list}`, options: spaces.map((s) => s.name) };
}

export function resolveSpaceReply(message: string, spaces: SpaceRow[]): SpaceRow | null {
  const m = normalize(message);
  const num = parseInt(m.match(/\d+/)?.[0] ?? "", 10);
  if (!isNaN(num) && num >= 1 && num <= spaces.length) return spaces[num - 1];
  return spaces.find((s) => normalize(s.name).includes(m) || m.includes(normalize(s.name))) ?? null;
}

// ─── Flow execution (slot-filling → action) ─────────────────────────────────

export async function respondFlow(
  supabase: NeoSupabase,
  userId: string,
  ctx: FlowContext,
  channel: NeoChannel,
  activeSpaceId?: string | null
): Promise<NeoReply> {
  // Cuotas: en web abren un formulario; en WhatsApp se completan por texto.
  if (ctx.flow === "installment" && channel === "web") {
    const ic = ctx as Extract<FlowContext, { flow: "installment" }>;
    return {
      text: "Completá los datos de la cuota:",
      effects: [{ type: "installment_form", prefill: { name: ic.name, nInstallments: ic.nInstallments, installmentAmount: ic.installmentAmount } }],
    };
  }

  const slot = missingSlot(ctx);
  if (slot) {
    const q = slotQuestion(ctx, slot);
    return { text: q.text, state: { kind: "flow", ctx }, ...(q.options ? { options: q.options } : {}) };
  }

  switch (ctx.flow) {
    case "expense":
    case "income": {
      // Movimientos: si hay >1 espacio y no se eligió uno, Neo pregunta a cuál.
      let spaceId = ctx.space_id ?? activeSpaceId ?? undefined;
      if (!spaceId) {
        const spaces = await loadUserSpaces(supabase, userId);
        if (spaces.length <= 1) spaceId = spaces[0]?.id;
        else {
          const q = spaceQuestion(spaces);
          return { text: q.text, options: q.options, state: { kind: "flow", ctx: { ...ctx, awaitingSpace: true } } };
        }
      }
      const currency = await primaryCurrency(supabase, userId);
      const catName = ctx.category ?? (ctx.description ? categoryForText(ctx.description) : null);
      const cat = catName ? await resolveCategory(supabase, userId, catName) : null;
      const desc = ctx.description || (ctx.flow === "income" ? "Ingreso" : "Gasto");
      const { error } = await supabase.from("transactions").insert({
        user_id: userId, space_id: spaceId, type: ctx.flow, amount: ctx.amount,
        currency_code: currency, description: desc,
        date: new Date().toISOString().split("T")[0], category_id: cat?.id ?? null,
      });
      if (error) return { text: "Uh, no pude guardarlo esta vez 😕. Probá de nuevo en un toque." };
      const catLabel = cat ? ` · ${cat.name}` : "";
      return { text: `Listo ✅ Anoté ${desc} — ${fmt(ctx.amount!, currency)}${catLabel}.`, effects: [{ type: "refresh" }] };
    }
    case "installment": {
      // WhatsApp: crear el plan directamente (sin formulario), con primer pago hoy.
      const ic = ctx as Extract<FlowContext, { flow: "installment" }>;
      const spaceId = await getWriteSpaceId(supabase, userId, ic.space_id ?? activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      const n = ic.nInstallments!;
      const each = ic.installmentAmount!;
      const total = n * each;
      const firstDate = new Date();
      const { data: plan, error } = await supabase.from("installment_plans").insert({
        user_id: userId, space_id: spaceId, name: ic.name, total_amount: total, currency_code: currency,
        n_installments: n, installment_amount: each, interest_type: "none",
        first_payment_date: firstDate.toISOString().split("T")[0], status: "active",
      }).select().single();
      if (error || !plan) return { text: "No pude crear la cuota. Intentá desde la app." };
      const dates = generatePaymentDates(firstDate, n);
      await supabase.from("installment_payments").insert(
        dates.map((date, i) => ({
          plan_id: plan.id, user_id: userId, payment_number: i + 1,
          amount: each, due_date: date.toISOString().split("T")[0], status: "pending",
        }))
      );
      return { text: `✅ Creé la cuota "${ic.name}": ${n} cuotas de ${fmt(each, currency)}.\nTotal: ${fmt(total, currency)}.`, effects: [{ type: "refresh" }] };
    }
    case "goal": {
      const spaceId = await getWriteSpaceId(supabase, userId, ctx.space_id ?? activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      const { error } = await supabase.from("savings_goals").insert({
        user_id: userId, space_id: spaceId, name: ctx.name, target_amount: ctx.target ?? 0,
        current_amount: 0, currency_code: currency, status: "active",
      });
      if (error) return { text: "No pude crear la meta. Intentá desde la sección Metas." };
      return { text: `✅ Creé la meta "${ctx.name}". Podés ponerle un objetivo desde Metas.`, effects: [{ type: "refresh" }] };
    }
    case "budget": {
      const match = await findCategory(supabase, userId, ctx.category!);
      if (!match) return { text: `No encontré la categoría "${ctx.category}". Revisá el nombre en Categorías.` };
      const spaceId = await getWriteSpaceId(supabase, userId, ctx.space_id ?? activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      const soloMeses = ctx.months?.length ? ctx.months : null;
      await supabase.from("category_budgets").upsert(
        {
          user_id: userId, space_id: spaceId, category_id: match.id,
          monthly_limit: ctx.amount, currency_code: currency,
          period_type: soloMeses ? "specific_months" : "always",
          applies_months: soloMeses,
        },
        { onConflict: "user_id,space_id,category_id" }
      );
      const cuando = soloMeses ? ` solo en ${soloMeses.map((n) => MESES_LARGOS[n - 1]).join(" y ")}` : " por mes";
      return { text: `✅ Puse un límite de ${fmt(ctx.amount!, currency)}${cuando} en ${match.name}.`, effects: [{ type: "refresh" }] };
    }
    case "debt": {
      const spaceId = await getWriteSpaceId(supabase, userId, ctx.space_id ?? activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      const { error } = await supabase.from("debts").insert({
        user_id: userId, space_id: spaceId, direction: ctx.direction,
        counterparty: ctx.counterparty, total_amount: ctx.amount, paid_amount: 0,
        currency_code: currency, status: "active",
      });
      if (error) return { text: "No pude anotar la deuda. Probá desde la sección Deudas." };
      const txt = ctx.direction === "debo"
        ? `✅ Anoté que le debés ${fmt(ctx.amount!, currency)} a ${ctx.counterparty}.`
        : `✅ Anoté que ${ctx.counterparty} te debe ${fmt(ctx.amount!, currency)}.`;
      return { text: txt, effects: [{ type: "refresh" }] };
    }
    case "clarify":
      return slotQuestion(ctx, "clarify");
  }
}

// ─── Ejecución de confirmaciones (WhatsApp ejecuta server-side) ──────────────

export async function executeConfirm(supabase: NeoSupabase, userId: string, confirm: PendingConfirm): Promise<NeoReply> {
  switch (confirm.kind) {
    case "confirm_delete_tx": {
      const c = confirm.candidates[0];
      const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", c.id).eq("user_id", userId);
      if (error) return { text: "No pude eliminar. Intentá desde la app." };
      return { text: `Eliminé "${c.description}".`, effects: [{ type: "refresh" }] };
    }
    case "confirm_delete_goal": {
      const { error } = await supabase.from("savings_goals").delete().eq("id", confirm.goalId).eq("user_id", userId);
      if (error) return { text: "No pude eliminar la meta." };
      return { text: `Eliminé la meta "${confirm.goalName}".`, effects: [{ type: "refresh" }] };
    }
    case "confirm_cancel_installment": {
      await supabase.from("installment_payments").delete().eq("plan_id", confirm.planId).eq("user_id", userId).eq("status", "pending");
      await supabase.from("installment_plans").update({ status: "paid" }).eq("id", confirm.planId).eq("user_id", userId);
      return { text: `Saldé el plan "${confirm.planName}".`, effects: [{ type: "refresh" }] };
    }
    case "confirm_delete_debt": {
      const { error } = await supabase.from("debts").delete().eq("id", confirm.debtId).eq("user_id", userId);
      if (error) return { text: "No pude borrar la deuda." };
      return { text: `Borré la deuda de ${confirm.debtLabel}.`, effects: [{ type: "refresh" }] };
    }
  }
}

// ─── Ejecución de intents (no-flow) ─────────────────────────────────────────

export async function executeIntent(
  supabase: NeoSupabase,
  userId: string,
  intent: Intent,
  channel: NeoChannel,
  activeSpaceId?: string | null
): Promise<NeoReply> {
  // Scope para las preguntas de plata: el espacio activo (web) o, por defecto,
  // los espacios con include_in_total (no contamina con espacios aislados).
  const scope = scopeForSpace(await loadUserSpaces(supabase, userId), activeSpaceId ?? "total");

  switch (intent.type) {
    case "greeting": {
      const opts = [
        "¡Hola! Acá estoy. ¿Anotamos algo o querés ver cómo venís este mes?",
        "¡Buenas! ¿En qué te doy una mano con tus números hoy?",
        "¡Hola! Contame qué necesitás — registrar un gasto, ver tu saldo, lo que sea.",
      ];
      return { text: opts[Math.floor(Math.random() * opts.length)] };
    }

    case "cancel_pending":
      return { text: "Dale, cancelado.", state: null, effects: [{ type: "cancel_pending" }] };

    case "help":
      return { text: `Soy Neo, tu asistente de finanzas. Esto es lo que puedo hacer por vos:\n• Registrar gastos: "compré nafta por 5000"\n• Registrar ingresos: "cobré el sueldo"\n• Ver saldo: "¿cuánto tengo?"\n• Ver gastos: "¿cuánto gasté este mes?"\n• Resumen del mes: "resumen"\n• Últimas transacciones: "mis últimas"\n\nMetas:\n• Ver: "mis metas"\n• Crear: "agrega una meta viaje"\n• Renombrar: "renombrá la meta viaje a vacaciones"\n• Cambiar objetivo: "cambiá el objetivo de viaje a 50000"\n• Depositar: "depositá 5000 en viaje"\n• Eliminar: "eliminá la meta viaje"\n\nCuotas (compras financiadas con tarjeta):\n• Ver: "mis cuotas"\n• Crear: "agrega cuota Netflix por 6 meses de 5000"\n• Pagar: "pagué la cuota de Netflix"\n• Saldar: "cancelá la cuota de iPhone"\n\nDeudas (plata entre personas):\n• Anotar: "debo 10000 a Juan" · "Ana me debe 5000"\n• Ver: "cuánto debo" · "quién me debe"\n• Pagar: "le pagué 3000 a Juan"\n• Saldar: "saldé la deuda de Juan"\n\nLímites:\n• Ver: "mis límites"\n• Poner: "poné un límite de 30000 en Comida"\n• Editar: "editá el límite de Comida a 30000"\n• Eliminar: "eliminá el límite de Comida"\n\nCorregir lo ya anotado:\n• Monto: "el último gasto eran 5000"\n• Categoría: "cambiá la categoría de netflix a Ocio"\n• Fecha: "cambiá la fecha del último a ayer"\n• Borrar: "borrá el gasto de netflix"\n\nEspacios y categorías:\n• Ver: "mis espacios" · "mis categorías"\n• Crear: "creá el espacio Freelance"\n• Mover: "pasá este gasto a Casa"\n\nOtros:\n• Dólar: "poné el dólar a 1450"\n• Avisos: "no me avises más de límites"\n• Exportar: "pasame mis datos en csv"` };

    case "balance_query": {
      const { data: balances } = await supabase.from("transactions")
        .select("amount, currency_code, type").eq("user_id", userId).is("deleted_at", null).in("space_id", scope)
        .in("type", ["income", "expense", "installment-payment"]);
      if (!balances?.length) return { text: "Todavía no tenés transacciones registradas." };
      const byCurrency: Record<string, number> = {};
      for (const t of balances) {
        const sign = t.type === "income" ? 1 : -1;
        byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + sign * Number(t.amount);
      }
      const lines = Object.entries(byCurrency)
        .map(([cur, bal]) => `${cur}: ${bal >= 0 ? "+" : ""}${bal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`).join("\n");
      return { text: `Tu balance acumulado:\n${lines}` };
    }

    case "spending_query": {
      const range = intent.period === "week" ? weekRange() : intent.period === "today" ? todayRange() : monthRange();
      let query = supabase.from("transactions")
        .select("amount, currency_code, categories(name)").eq("user_id", userId).is("deleted_at", null).in("space_id", scope)
        .in("type", ["expense", "installment-payment"]).gte("date", range.from).lte("date", range.to);
      if (intent.category) {
        const match = await findCategory(supabase, userId, intent.category);
        if (match) query = query.eq("category_id", match.id);
      }
      const { data: txs } = await query;
      const period = intent.period === "week" ? "esta semana" : intent.period === "today" ? "hoy" : "este mes";
      const cat = intent.category ? ` en ${intent.category}` : "";
      if (!txs?.length) return { text: `No encontré gastos${cat} ${period}.` };
      const byCurrency: Record<string, number> = {};
      for (const t of txs) byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + Number(t.amount);
      const lines = Object.entries(byCurrency).map(([cur, amt]) => fmt(amt, cur)).join(" · ");
      return { text: `Gastaste${cat} ${period}: ${lines} (${txs.length} transacciones).` };
    }

    case "income_query": {
      const range = intent.period === "week" ? weekRange() : intent.period === "today" ? todayRange() : monthRange();
      const periodLabel = intent.period === "week" ? "esta semana" : intent.period === "today" ? "hoy" : "este mes";
      const { data: txs } = await supabase.from("transactions")
        .select("amount, currency_code").eq("user_id", userId).is("deleted_at", null).in("space_id", scope)
        .eq("type", "income").gte("date", range.from).lte("date", range.to);
      if (!txs?.length) return { text: `No registraste ingresos ${periodLabel}.` };
      const byCurrency: Record<string, number> = {};
      for (const t of txs) byCurrency[t.currency_code] = (byCurrency[t.currency_code] ?? 0) + Number(t.amount);
      const lines = Object.entries(byCurrency).map(([cur, amt]) => fmt(amt, cur)).join(" · ");
      return { text: `Ingresaste ${periodLabel}: ${lines} (${txs.length} ${txs.length === 1 ? "ingreso" : "ingresos"}).` };
    }

    case "summary_query": {
      const { from, to } = monthRange();
      const { data: txs } = await supabase.from("transactions")
        .select("amount, currency_code, type").eq("user_id", userId).is("deleted_at", null).in("space_id", scope)
        .in("type", ["income", "expense", "installment-payment"]).gte("date", from).lte("date", to);
      if (!txs?.length) return { text: "No hay movimientos este mes todavía." };
      const inc: Record<string, number> = {}, exp: Record<string, number> = {};
      for (const t of txs) {
        const n = Number(t.amount);
        if (t.type === "income") inc[t.currency_code] = (inc[t.currency_code] ?? 0) + n;
        else exp[t.currency_code] = (exp[t.currency_code] ?? 0) + n;
      }
      const currencies = [...new Set([...Object.keys(inc), ...Object.keys(exp)])];
      const lines = currencies.map((cur) => {
        const i = inc[cur] ?? 0, e = exp[cur] ?? 0, net = i - e;
        return `${cur}:\n  Ingresos: ${fmt(i, cur)}\n  Gastos: ${fmt(e, cur)}\n  Neto: ${net >= 0 ? "+" : ""}${fmt(Math.abs(net), cur)}${net < 0 ? " 🔴" : " 🟢"}`;
      });
      return { text: `Resumen de este mes:\n${lines.join("\n\n")}` };
    }

    case "recent_tx_query": {
      const { data: txs } = await supabase.from("transactions")
        .select("amount, currency_code, type, description, date, categories(name)")
        .eq("user_id", userId).is("deleted_at", null).order("date", { ascending: false }).limit(7);
      if (!txs?.length) return { text: "No tenés transacciones registradas." };
      const lines = txs.map((t) => {
        const cat = t.categories as { name?: string } | null;
        const sign = t.type === "income" ? "+" : "-";
        const d = new Date(t.date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
        return `${d} · ${t.description || cat?.name || "Sin descripción"} ${sign}${fmt(Number(t.amount), t.currency_code)}`;
      });
      return { text: `Últimas transacciones:\n${lines.join("\n")}` };
    }

    case "budget_query": {
      const { from } = monthRange();
      const { data: budgets } = await supabase.from("category_budgets")
        .select("monthly_limit, currency_code, categories(id, name)").eq("user_id", userId);
      if (!budgets?.length) return { text: "No tenés límites configurados. Podés agregar uno en la sección Categorías." };
      const { data: txs } = await supabase.from("transactions")
        .select("amount, category_id, currency_code").eq("user_id", userId).is("deleted_at", null)
        .in("type", ["expense", "installment-payment"]).gte("date", from);
      const spentByCat: Record<string, number> = {};
      for (const t of txs ?? []) if (t.category_id) spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount);
      const lines = budgets.map((b) => {
        const cat = b.categories as unknown as { id: string; name: string } | null;
        if (!cat) return null;
        const spent = spentByCat[cat.id] ?? 0;
        const pct = Math.round((spent / b.monthly_limit) * 100);
        const bar = pct >= 100 ? "🔴" : pct >= 80 ? "🟡" : "🟢";
        return `${bar} ${cat.name}: ${fmt(spent, b.currency_code)} / ${fmt(b.monthly_limit, b.currency_code)} (${pct}%)`;
      }).filter(Boolean);
      return { text: `Tus límites este mes:\n${lines.join("\n")}` };
    }

    case "goals_query": {
      const { data: goals } = await supabase.from("savings_goals")
        .select("name, current_amount, target_amount, currency_code").eq("user_id", userId)
        .neq("status", "archived").order("created_at", { ascending: false });
      if (!goals?.length) return { text: "No tenés metas de ahorro configuradas. Podés crear una en la sección Metas." };
      const lines = goals.map((g) => {
        const pct = Math.round((g.current_amount / g.target_amount) * 100);
        const bar = pct >= 100 ? "✅" : pct >= 50 ? "🔵" : "⚪";
        return `${bar} ${g.name}: ${fmt(g.current_amount, g.currency_code)} / ${fmt(g.target_amount, g.currency_code)} (${pct}%)`;
      });
      return { text: `Tus metas de ahorro:\n${lines.join("\n")}` };
    }

    case "installments_query": {
      const { data: plans } = await supabase.from("installment_plans")
        .select("name, installment_amount, currency_code, n_installments, installment_payments(status)")
        .eq("user_id", userId).eq("status", "active");
      if (!plans?.length) return { text: "No tenés cuotas activas en este momento." };
      const lines = plans.map((p) => {
        const payments = (p.installment_payments ?? []) as { status: string }[];
        const paid = payments.filter((x) => x.status === "paid").length;
        return `• ${p.name}: cuota ${paid + 1}/${p.n_installments} — ${fmt(p.installment_amount, p.currency_code)} c/u`;
      });
      return { text: `Cuotas activas:\n${lines.join("\n")}` };
    }

    case "debts_query": {
      let q = supabase.from("debts")
        .select("direction, counterparty, description, total_amount, paid_amount, currency_code, due_date")
        .eq("user_id", userId).eq("status", "active").in("space_id", scope);
      if (intent.direction) q = q.eq("direction", intent.direction);
      const { data: debts } = await q;
      if (!debts?.length) {
        return { text: intent.direction === "me_deben" ? "Nadie te debe plata 👌"
          : intent.direction === "debo" ? "No tenés deudas anotadas 🎉"
          : "No tenés deudas anotadas 🎉" };
      }
      const line = (d: typeof debts[number]) => {
        const left = Number(d.total_amount) - Number(d.paid_amount);
        const venc = d.due_date ? ` (vence ${new Date(d.due_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })})` : "";
        return `• ${d.counterparty}: ${fmt(left, d.currency_code)}${venc}`;
      };
      const debo = debts.filter((d) => d.direction === "debo");
      const meDeben = debts.filter((d) => d.direction === "me_deben");
      const bloques: string[] = [];
      if (debo.length) bloques.push(`Le debés a:\n${debo.map(line).join("\n")}`);
      if (meDeben.length) bloques.push(`Te deben:\n${meDeben.map(line).join("\n")}`);
      return { text: bloques.join("\n\n") };
    }

    case "set_usd_rate": {
      await supabase.from("profiles").update({ usd_rate: intent.rate }).eq("user_id", userId);
      return { text: `✅ Anoté el dólar a ${intent.rate.toLocaleString("es-AR")}. Lo uso para mostrarte los totales convertidos.`, effects: [{ type: "refresh" }] };
    }

    case "usd_rate_query": {
      const { data: p } = await supabase.from("profiles").select("usd_rate").eq("user_id", userId).single();
      const rate = (p as { usd_rate?: number | null } | null)?.usd_rate;
      if (!rate) return { text: 'Todavía no me dijiste a cuánto está el dólar. Decime "poné el dólar a 1450".' };
      return { text: `Tenés el dólar en ${Number(rate).toLocaleString("es-AR")}.` };
    }

    case "export_query":
      // Neo no puede adjuntar archivos (ni en web ni en WhatsApp): lo honesto es
      // decir dónde está, no simular que lo manda.
      return { text: "Podés bajar todos tus movimientos en CSV o Excel desde Perfil → Exportar datos 📄" };

    case "edit_tx": {
      // Sin `search` = el último movimiento. Con `search`, el más reciente que coincida.
      const { data: txs } = await supabase.from("transactions")
        .select("id, description, amount, currency_code, date").eq("user_id", userId).is("deleted_at", null)
        .in("space_id", scope).order("date", { ascending: false }).limit(50);
      const list = ((txs ?? []) as DeleteCandidate[]);
      if (!list.length) return { text: "No encontré movimientos para editar." };
      const target = intent.search
        ? list.find((t) => normalize(t.description).includes(normalize(intent.search!)))
        : list[0];
      if (!target) return { text: `No encontré ningún movimiento que coincida con "${intent.search}".` };

      // Los valores previos se leen ANTES del update: después, la fila que
      // tenemos en mano ya no sirve para contar qué cambió.
      const antes = fmt(Number(target.amount), target.currency_code);
      const descAntes = target.description;

      const patch: Record<string, unknown> = {};
      if (intent.amount != null) patch.amount = intent.amount;
      if (intent.description) patch.description = intent.description;
      if (intent.date) patch.date = intent.date;
      const { error } = await supabase.from("transactions").update(patch).eq("id", target.id).eq("user_id", userId);
      if (error) return { text: "No pude actualizarlo." };
      if (intent.amount != null) return { text: `✅ Corregido: ${descAntes} pasó de ${antes} a ${fmt(intent.amount, target.currency_code)}.`, effects: [{ type: "refresh" }] };
      if (intent.description) return { text: `✅ Ahora "${descAntes}" se llama "${intent.description}".`, effects: [{ type: "refresh" }] };
      return { text: `✅ Cambié la fecha de ${descAntes} al ${intent.date!.slice(8, 10)}/${intent.date!.slice(5, 7)}.`, effects: [{ type: "refresh" }] };
    }

    case "categories_query": {
      const { data: cats } = await supabase.from("categories").select("name, icon").eq("user_id", userId).order("name");
      const list = (cats as { name: string; icon: string }[] | null) ?? [];
      if (!list.length) return { text: "Todavía no tenés categorías." };
      return { text: `Tus categorías:\n${list.map((c) => `${c.icon ?? "•"} ${c.name}`).join("\n")}` };
    }

    case "create_category": {
      const { data: cats } = await supabase.from("categories").select("name").eq("user_id", userId);
      if ((cats as { name: string }[] | null)?.some((c) => normalize(c.name) === normalize(intent.name))) {
        return { text: `Ya tenés una categoría "${intent.name}".` };
      }
      const { error } = await supabase.from("categories").insert({ user_id: userId, name: intent.name, is_default: false });
      if (error) return { text: "No pude crear la categoría." };
      return { text: `✅ Creé la categoría "${intent.name}".`, effects: [{ type: "refresh" }] };
    }

    case "rename_category": {
      const match = await findCategory(supabase, userId, intent.oldName);
      if (!match) return { text: `No encontré la categoría "${intent.oldName}".` };
      await supabase.from("categories").update({ name: intent.newName }).eq("id", match.id).eq("user_id", userId);
      return { text: `✅ Ahora "${match.name}" se llama "${intent.newName}".`, effects: [{ type: "refresh" }] };
    }

    case "delete_category": {
      const { data: cats } = await supabase.from("categories").select("id, name, is_default").eq("user_id", userId);
      const norm = normalize(intent.name);
      const match = (cats as { id: string; name: string; is_default: boolean }[] | null)
        ?.find((c) => normalize(c.name).includes(norm) || norm.includes(normalize(c.name)));
      if (!match) return { text: `No encontré la categoría "${intent.name}".` };
      // Las 9 por defecto sostienen la clasificación automática (el fallback cae
      // en "Otros"): si se borran, Neo se queda sin dónde poner los gastos.
      if (match.is_default) return { text: `"${match.name}" es una categoría base, mejor no borrarla. Podés renombrarla si querés.` };
      // transactions.category_id no tiene cascade: con movimientos, el borrado falla.
      const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("category_id", match.id).is("deleted_at", null);
      if ((count ?? 0) > 0) return { text: `"${match.name}" tiene ${count} movimiento(s). Movelos a otra categoría antes de borrarla.` };
      const { error } = await supabase.from("categories").delete().eq("id", match.id).eq("user_id", userId);
      if (error) return { text: "No pude borrar la categoría." };
      return { text: `✅ Borré la categoría "${match.name}".`, effects: [{ type: "refresh" }] };
    }

    case "mute_notifs": {
      const fam = resolveNotifFamily(intent.family);
      if (!fam) {
        const opciones = NOTIF_FAMILIES.map((f) => f.family).join(", ");
        return { text: `¿De qué avisos? Puedo silenciar: ${opciones}.` };
      }
      if (intent.enable) {
        await supabase.from("neo_notification_prefs").delete().eq("user_id", userId).eq("family", fam.family);
        return { text: `✅ Listo, reactivé "${fam.label}".`, effects: [{ type: "refresh" }] };
      }
      // Silenciar: marcar la familia y limpiar del feed los avisos ya escritos.
      await supabase.from("neo_notification_prefs").upsert(
        { user_id: userId, family: fam.family, muted_until: "9999-12-31T00:00:00Z", updated_at: new Date().toISOString() },
        { onConflict: "user_id,family" },
      );
      await supabase.from("neo_notifications").delete().eq("user_id", userId).in("type", typesForFamily(fam.family));
      return { text: `✅ Dale, silencié "${fam.label}". Si querés volver atrás, decime "volvé a avisarme de ${fam.family}" o cambialo en Perfil.`, effects: [{ type: "refresh" }] };
    }

    case "spaces_query": {
      const spaces = await loadUserSpaces(supabase, userId);
      if (!spaces.length) return { text: "Todavía no tenés espacios." };
      const lines = spaces.map((s) => `• ${s.name}${s.is_default ? " (principal)" : ""}${s.include_in_total ? "" : " — fuera del total"}`);
      return { text: `Tus espacios:\n${lines.join("\n")}` };
    }

    case "create_space": {
      const spaces = await loadUserSpaces(supabase, userId);
      if (spaces.some((s) => normalize(s.name) === normalize(intent.name))) {
        return { text: `Ya tenés un espacio "${intent.name}".` };
      }
      const currency = await primaryCurrency(supabase, userId);
      const { error } = await supabase.from("spaces").insert({
        user_id: userId, name: intent.name, primary_currency: currency,
        include_in_total: true, is_default: false, sort_order: spaces.length,
      });
      if (error) return { text: "No pude crear el espacio." };
      return { text: `✅ Creé el espacio "${intent.name}".`, effects: [{ type: "refresh" }] };
    }

    case "rename_space": {
      const spaces = await loadUserSpaces(supabase, userId);
      const target = resolveSpaceReply(intent.oldName, spaces);
      if (!target) return { text: `No encontré el espacio "${intent.oldName}".` };
      await supabase.from("spaces").update({ name: intent.newName }).eq("id", target.id).eq("user_id", userId);
      return { text: `✅ Ahora "${target.name}" se llama "${intent.newName}".`, effects: [{ type: "refresh" }] };
    }

    case "set_default_space": {
      const spaces = await loadUserSpaces(supabase, userId);
      const target = resolveSpaceReply(intent.name, spaces);
      if (!target) return { text: `No encontré el espacio "${intent.name}".` };
      // Un solo default por usuario: desmarcar el anterior antes de marcar este.
      await supabase.from("spaces").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
      await supabase.from("spaces").update({ is_default: true }).eq("id", target.id).eq("user_id", userId);
      return { text: `✅ "${target.name}" es tu espacio principal.`, effects: [{ type: "refresh" }] };
    }

    case "delete_space": {
      const spaces = await loadUserSpaces(supabase, userId);
      const target = resolveSpaceReply(intent.name, spaces);
      if (!target) return { text: `No encontré el espacio "${intent.name}".` };
      const res = await deleteSpaceGuarded(supabase, userId, target.id);
      if (!res.ok) return { text: res.error };
      return { text: `✅ Borré el espacio "${target.name}".`, effects: [{ type: "refresh" }] };
    }

    case "move_tx_space": {
      const spaces = await loadUserSpaces(supabase, userId);
      const target = resolveSpaceReply(intent.name, spaces);
      if (!target) return { text: `No encontré el espacio "${intent.name}".` };
      const { data: last } = await supabase.from("transactions")
        .select("id, description, amount, currency_code").eq("user_id", userId).is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(1);
      const tx = (last as { id: string; description: string; amount: number; currency_code: string }[] | null)?.[0];
      if (!tx) return { text: "No encontré ningún movimiento para mover." };
      await supabase.from("transactions").update({ space_id: target.id }).eq("id", tx.id).eq("user_id", userId);
      return { text: `✅ Moví "${tx.description}" (${fmt(Number(tx.amount), tx.currency_code)}) a ${target.name}.`, effects: [{ type: "refresh" }] };
    }

    case "pay_debt": {
      const debt = await findDebt(supabase, userId, intent.counterparty, scope);
      // VÁLVULA DE SEGURIDAD: si no hay deuda con esa contraparte, no es un
      // error — "le pagué 5000 a la panadería" es un gasto común y corriente.
      if (!debt) {
        return respondFlow(supabase, userId,
          { flow: "expense", description: intent.counterparty, amount: intent.amount, category: categoryForText(intent.counterparty) },
          channel, activeSpaceId);
      }
      const pending = Number(debt.total_amount) - Number(debt.paid_amount);
      const res = await payDebt(supabase, userId, debt.id, intent.amount);
      if (!res.ok) return { text: res.error === "Monto inválido" ? `Esa deuda tiene un saldo de ${fmt(pending, debt.currency_code)}. ¿Cuánto pagaste?` : "No pude registrar el pago." };
      // Se calcula con lo que ya teníamos, no con la fila que devuelve el update.
      const left = pending - intent.amount;
      const txt = left <= 0.005
        ? `✅ Registrado. Saldaste la deuda con ${debt.counterparty} 🎉`
        : `✅ Registrado. Queda ${fmt(left, debt.currency_code)} con ${debt.counterparty}.`;
      return { text: txt, effects: [{ type: "refresh" }] };
    }

    case "settle_debt": {
      const debt = await findDebt(supabase, userId, intent.counterparty, scope);
      if (!debt) return { text: `No encontré una deuda activa con "${intent.counterparty}".` };
      await supabase.from("debts")
        .update({ paid_amount: debt.total_amount, status: "paid" })
        .eq("id", debt.id).eq("user_id", userId);
      return { text: `✅ Saldada la deuda con ${debt.counterparty}.`, effects: [{ type: "refresh" }] };
    }

    case "delete_debt": {
      const debt = await findDebt(supabase, userId, intent.counterparty, scope);
      if (!debt) return { text: `No encontré una deuda activa con "${intent.counterparty}".` };
      const label = `${debt.counterparty} — ${fmt(Number(debt.total_amount), debt.currency_code)}`;
      // Confirmación por estado en los dos canales: la web la round-trippea
      // como pendingContext y muestra las options como botones.
      return {
        text: `¿Borro la deuda de ${label}?`,
        options: ["Sí", "No"],
        state: { kind: "confirm_delete_debt", debtId: debt.id, debtLabel: label },
      };
    }

    case "edit_budget": {
      const match = await findCategory(supabase, userId, intent.category);
      if (!match) return { text: `No encontré la categoría "${intent.category}". Revisá el nombre en la sección Categorías.` };
      const spaceId = await getWriteSpaceId(supabase, userId, activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      await supabase.from("category_budgets").upsert(
        { user_id: userId, space_id: spaceId, category_id: match.id, monthly_limit: intent.amount, currency_code: currency, period_type: "always" },
        { onConflict: "user_id,space_id,category_id" }
      );
      return { text: `✅ Listo. Actualicé el límite de ${match.name} a ${fmt(intent.amount, currency)} por mes.`, effects: [{ type: "refresh" }] };
    }

    case "delete_budget": {
      const match = await findCategory(supabase, userId, intent.category);
      if (!match) return { text: `No encontré la categoría "${intent.category}".` };
      const spaceId = await getWriteSpaceId(supabase, userId, activeSpaceId);
      let del = supabase.from("category_budgets").delete().eq("user_id", userId).eq("category_id", match.id);
      if (spaceId) del = del.eq("space_id", spaceId);
      const { error } = await del;
      if (error) return { text: "No pude eliminar el límite. Intentá desde Categorías." };
      return { text: `Eliminé el límite mensual de ${match.name}.`, effects: [{ type: "refresh" }] };
    }

    case "rename_goal": {
      const { data: goals } = await supabase.from("savings_goals").select("id, name").eq("user_id", userId).neq("status", "archived");
      const oldNorm = normalize(intent.oldName);
      const match = (goals as { id: string; name: string }[] | null)?.find((g) => normalize(g.name).includes(oldNorm) || oldNorm.includes(normalize(g.name)));
      if (!match) return { text: `No encontré una meta llamada "${intent.oldName}".` };
      await supabase.from("savings_goals").update({ name: intent.newName }).eq("id", match.id).eq("user_id", userId);
      return { text: `Renombré "${match.name}" a "${intent.newName}".`, effects: [{ type: "refresh" }] };
    }

    case "set_goal_target": {
      const { data: goals } = await supabase.from("savings_goals").select("id, name, currency_code").eq("user_id", userId).neq("status", "archived");
      const goalNorm = normalize(intent.name);
      const match = (goals as { id: string; name: string; currency_code: string }[] | null)?.find((g) => normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name)));
      if (!match) return { text: `No encontré una meta llamada "${intent.name}".` };
      await supabase.from("savings_goals").update({ target_amount: intent.amount }).eq("id", match.id).eq("user_id", userId);
      return { text: `Actualicé el objetivo de "${match.name}" a ${fmt(intent.amount, match.currency_code)}.`, effects: [{ type: "refresh" }] };
    }

    case "create_goal": {
      const spaceId = await getWriteSpaceId(supabase, userId, activeSpaceId);
      const currency = await primaryCurrency(supabase, userId);
      const { error } = await supabase.from("savings_goals").insert({
        user_id: userId, space_id: spaceId, name: intent.name, target_amount: intent.amount ?? 0,
        current_amount: 0, currency_code: currency, status: "active",
      });
      if (error) return { text: "No pude crear la meta. Intentá desde la sección Metas." };
      return {
        text: intent.amount ? `✅ Creé la meta "${intent.name}" con objetivo de ${fmt(intent.amount, currency)}.` : `✅ Creé la meta "${intent.name}". Podés agregarle un objetivo de ahorro desde Metas.`,
        effects: [{ type: "refresh" }],
      };
    }

    case "deposit_goal": {
      const { data: goals } = await supabase.from("savings_goals")
        .select("id, name, current_amount, target_amount, currency_code").eq("user_id", userId).neq("status", "archived");
      const goalNorm = normalize(intent.goalName);
      const match = (goals as { id: string; name: string; current_amount: number; target_amount: number; currency_code: string }[] | null)?.find((g) => normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name)));
      if (!match) return { text: `No encontré una meta llamada "${intent.goalName}". Revisá los nombres en Metas.` };
      const newTotal = Number(match.current_amount) + intent.amount;
      await supabase.from("savings_goals").update({ current_amount: newTotal }).eq("id", match.id);
      const pct = match.target_amount > 0 ? Math.round((newTotal / match.target_amount) * 100) : null;
      const icon = pct !== null ? (pct >= 100 ? "✅" : pct >= 75 ? "🔵" : pct >= 50 ? "⚪" : "🔘") : "💰";
      return { text: `${icon} Sumé ${fmt(intent.amount, match.currency_code)} a "${match.name}".\nTotal: ${fmt(newTotal, match.currency_code)}${pct !== null ? ` (${pct}%)` : ""}.`, effects: [{ type: "refresh" }] };
    }

    case "pay_installment": {
      const { data: plans } = await supabase.from("installment_plans").select("id, space_id, name, installment_amount, currency_code, n_installments").eq("user_id", userId).eq("status", "active");
      const nameNorm = normalize(intent.name);
      const match = (plans as { id: string; space_id: string; name: string; installment_amount: number; currency_code: string; n_installments: number }[] | null)?.find((p) => normalize(p.name).includes(nameNorm) || nameNorm.includes(normalize(p.name)));
      if (!match) return { text: `No encontré una cuota activa llamada "${intent.name}".` };
      const { data: next } = await supabase.from("installment_payments").select("id, payment_number, amount").eq("plan_id", match.id).eq("user_id", userId).eq("status", "pending").order("payment_number", { ascending: true }).limit(1).single();
      if (!next) return { text: `No hay cuotas pendientes para "${match.name}".` };
      const { data: tx } = await supabase.from("transactions").insert({
        user_id: userId, space_id: match.space_id, type: "installment-payment", amount: next.amount, currency_code: match.currency_code,
        description: `${match.name} — cuota ${next.payment_number}/${match.n_installments}`, date: new Date().toISOString().split("T")[0],
      }).select().single();
      await supabase.from("installment_payments").update({ status: "paid", transaction_id: tx?.id ?? null }).eq("id", next.id).eq("user_id", userId);
      const { count } = await supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("plan_id", match.id).eq("user_id", userId).eq("status", "pending");
      if ((count ?? 0) === 0) {
        await supabase.from("installment_plans").update({ status: "paid" }).eq("id", match.id).eq("user_id", userId);
        return { text: `Registré el último pago de "${match.name}". ¡Plan saldado!`, effects: [{ type: "refresh" }] };
      }
      return { text: `Registré la cuota ${next.payment_number}/${match.n_installments} de "${match.name}" — ${fmt(Number(next.amount), match.currency_code)}.`, effects: [{ type: "refresh" }] };
    }

    // ── Acciones destructivas: web usa botones (effects); WhatsApp pide sí/no (state) ──

    case "delete_tx": {
      const { from } = monthRange();
      const { data: txs } = await supabase.from("transactions")
        .select("id, description, amount, currency_code, date").eq("user_id", userId).is("deleted_at", null)
        .gte("date", from).order("date", { ascending: false }).limit(50);
      const searchNorm = normalize(intent.search);
      const candidates = ((txs ?? []) as DeleteCandidate[]).filter((t) =>
        normalize(t.description).includes(searchNorm) || searchNorm.includes(normalize(t.description).split(" ")[0])
      ).slice(0, 3);
      if (!candidates.length) return { text: `No encontré ningún gasto que coincida con "${intent.search}" este mes.` };
      if (channel === "web") {
        return {
          text: candidates.length === 1
            ? `Encontré esto: ${candidates[0].description} — ${fmt(candidates[0].amount, candidates[0].currency_code)}. ¿Lo elimino?`
            : `Encontré ${candidates.length} transacciones que podrían coincidir. ¿Cuál querés eliminar?`,
          effects: [{ type: "confirm_delete", candidates }],
        };
      }
      // WhatsApp
      if (candidates.length === 1) {
        return { text: `Encontré: ${candidates[0].description} — ${fmt(candidates[0].amount, candidates[0].currency_code)}.\n¿Lo elimino? (sí/no)`, state: { kind: "confirm_delete_tx", candidates } };
      }
      const list = candidates.map((c, i) => `${i + 1}) ${c.description} — ${fmt(c.amount, c.currency_code)}`).join("\n");
      return { text: `Encontré varias. ¿Cuál elimino? Respondé el número:\n${list}`, state: { kind: "confirm_delete_tx", candidates } };
    }

    case "delete_goal": {
      const { data: goals } = await supabase.from("savings_goals").select("id, name").eq("user_id", userId).neq("status", "archived");
      const goalNorm = normalize(intent.name);
      const match = (goals as { id: string; name: string }[] | null)?.find((g) => normalize(g.name).includes(goalNorm) || goalNorm.includes(normalize(g.name)));
      if (!match) return { text: `No encontré una meta llamada "${intent.name}". Revisá los nombres en Metas.` };
      if (channel === "web") {
        return { text: `¿Seguro que querés eliminar la meta "${match.name}"? Esta acción no se puede deshacer.`, effects: [{ type: "confirm_delete_goal", goalId: match.id, goalName: match.name }] };
      }
      return { text: `¿Seguro que querés eliminar la meta "${match.name}"? (sí/no)`, state: { kind: "confirm_delete_goal", goalId: match.id, goalName: match.name } };
    }

    case "cancel_installment": {
      const { data: plans } = await supabase.from("installment_plans").select("id, name").eq("user_id", userId).eq("status", "active");
      const nameNorm = normalize(intent.name);
      const match = (plans as { id: string; name: string }[] | null)?.find((p) => normalize(p.name).includes(nameNorm) || nameNorm.includes(normalize(p.name)));
      if (!match) return { text: `No encontré una cuota activa llamada "${intent.name}".` };
      if (channel === "web") {
        return { text: `¿Seguro que querés saldar el plan "${match.name}"? Se eliminarán los pagos pendientes.`, effects: [{ type: "confirm_cancel_installment", planId: match.id, planName: match.name }] };
      }
      return { text: `¿Seguro que querés saldar el plan "${match.name}"? (sí/no)`, state: { kind: "confirm_cancel_installment", planId: match.id, planName: match.name } };
    }

    case "correct_tx_category": {
      const cat = await findCategory(supabase, userId, intent.category);
      if (!cat) {
        const { data: cats } = await supabase.from("categories").select("name").eq("user_id", userId);
        const names = (cats as { name: string }[] | null)?.map((c) => c.name).join(", ") ?? "";
        return { text: `No encontré la categoría "${intent.category}". Tus categorías: ${names}.` };
      }
      const { data: txs } = await supabase.from("transactions")
        .select("id, description, type, currency_code")
        .eq("user_id", userId).is("deleted_at", null).in("space_id", scope)
        .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(15);
      const list = (txs ?? []) as { id: string; description: string; type: string; currency_code: string }[];
      let tx: { id: string; description: string; type: string; currency_code: string } | undefined = list[0];
      if (intent.search) {
        const s = normalize(intent.search);
        tx = list.find((t) => normalize(t.description ?? "").includes(s));
      }
      if (!tx) return { text: intent.search ? `No encontré un movimiento que coincida con "${intent.search}".` : "No encontré un movimiento reciente para corregir." };
      await supabase.from("transactions").update({ category_id: cat.id }).eq("id", tx.id).eq("user_id", userId);
      if (tx.type === "expense" || tx.type === "income") {
        await learnFromCorrection(supabase, userId, tx.description ?? "", tx.type, tx.currency_code, cat.id);
      }
      return { text: `Listo ✅ Moví "${tx.description}" a ${cat.name}. La próxima lo acomodo solo.`, effects: [{ type: "refresh" }] };
    }

    default:
      return { text: "No entendí 🤔 ¿Qué querés hacer?" };
  }
}

// Hints suaves para mensajes claramente malformados (0 tokens), antes de clarify.
export function domainHint(message: string): string | null {
  const mn = normalize(message);
  if (/meta|ahorro|objetivo/.test(mn)) return `Para metas puedo:\n• Crear: "agrega una meta viaje"\n• Ver: "mis metas"\n• Depositar: "depositá 5000 en viaje"\n• Renombrar: "renombrá la meta viaje a vacaciones"\n• Eliminar: "eliminá la meta viaje"`;
  // Deudas antes que cuotas: "deuda" salió de la línea de cuotas, son sectores distintos.
  if (/deuda|debo|me deben|prest/.test(mn)) return `Para deudas puedo:\n• Anotar: "debo 10000 a Juan" o "Ana me debe 5000"\n• Ver: "cuánto debo" · "quién me debe"\n• Registrar pago: "le pagué 3000 a Juan"\n• Saldar: "saldé la deuda de Juan"`;
  if (/cuota|mensualidad/.test(mn)) return `Para cuotas puedo:\n• Crear: "comprá la tele en 12 cuotas de 30000"\n• Ver: "mis cuotas"\n• Registrar pago: "pagué la cuota de Netflix"\n• Saldar: "cancelá la cuota de iPhone"`;
  if (/l[ií]mite|presupuesto/.test(mn)) return `Para límites puedo:\n• Poner: "poné un límite de 30000 en Comida"\n• Ver: "mis límites"\n• Editar: "editá el límite de Comida a 40000"\n• Eliminar: "eliminá el límite de Comida"`;
  if (/espacio/.test(mn)) return `Para espacios puedo:\n• Ver: "mis espacios"\n• Crear: "creá el espacio Freelance"\n• Renombrar: "renombrá el espacio Casa a Hogar"\n• Principal: "poné Freelance como principal"\n• Mover un gasto: "pasá este gasto a Casa"`;
  if (/categoria/.test(mn)) return `Para categorías puedo:\n• Ver: "mis categorías"\n• Crear: "creá la categoría Mascotas"\n• Renombrar: "renombrá la categoría Ocio a Diversión"\n• Corregir un movimiento: "cambiá la categoría de netflix a Ocio"`;
  if (/borr|elimin|sac[aá]|quit/.test(mn)) return `Para eliminar, decime qué:\n• Gasto: "borrá el gasto de Netflix"\n• Meta: "eliminá la meta viaje"\n• Cuota: "cancelá la cuota de iPhone"\n• Deuda: "borrá la deuda de Juan"\n• Límite: "eliminá el límite de Comida"`;
  return null;
}
