import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Types ─────────────────────────────────────────────────────────────────

type Intent =
  | { type: "balance_query" }
  | { type: "spending_query"; category?: string; period: "month" | "week" | "today" }
  | { type: "budget_query"; category?: string }
  | { type: "goals_query" }
  | { type: "installments_query" }
  | { type: "edit_budget"; category: string; amount: number }
  | { type: "delete_tx"; search: string }
  | { type: "unknown" };

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

  // Balance
  if (/saldo|cuanto tengo|mis cuentas|mis balances|cuanta plata|cuanto hay/.test(m))
    return { type: "balance_query" };

  // Spending query
  if (/cuanto gaste|cuanto he gastado|mis gastos|gaste esta|gaste hoy|gaste cuanto/.test(m)) {
    const catMatch = m.match(/en ([a-z\w]+)(?:\s|$)/);
    const period = /esta semana/.test(m) ? "week" : /hoy/.test(m) ? "today" : "month";
    return { type: "spending_query", category: catMatch?.[1], period };
  }

  // Budget / limits
  if (/mis limites|limite|cuanto me queda|cuanto tengo de|me queda en/.test(m))
    return { type: "budget_query", category: undefined };

  // Goals
  if (/mis metas|mis ahorros|como van mis metas|como van mis ahorros|ahorro/.test(m))
    return { type: "goals_query" };

  // Installments
  if (/mis cuotas|cuanto debo|mis deudas|cuotas activas/.test(m))
    return { type: "installments_query" };

  // Edit budget: "editá el límite de comida a 20000"
  const editMatch = m.match(/edit[ao]?r?\s+(?:el\s+)?l[ií]?mite\s+(?:de\s+)?(.+?)\s+a\s+(\d[\d.,]*)/);
  if (editMatch) {
    const amount = parseFloat(editMatch[2].replace(/\./g, "").replace(",", "."));
    if (!isNaN(amount)) return { type: "edit_budget", category: editMatch[1].trim(), amount };
  }

  // Delete: "eliminá el gasto de Netflix"
  const deleteMatch = m.match(/elimin[ao]r?\s+(?:el\s+(?:gasto|pago|ingreso)\s+de\s+)?(.+)/);
  if (deleteMatch) return { type: "delete_tx", search: deleteMatch[1].trim() };

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message: string = body.message ?? "";
  if (!message.trim()) return NextResponse.json({ text: "Escribime algo 😊" });

  const intent = detectIntent(message);

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

  // ── Unknown → helpful fallback (0 tokens) ────────────────────────────────
  const hints = [
    "¿Cuánto gasté este mes?",
    "¿Cuál es mi saldo?",
    "Mis límites",
    "Mis metas",
    "Mis cuotas",
    "Eliminá [descripción del gasto]",
    "Editá el límite de [categoría] a [monto]",
  ];
  return NextResponse.json({
    text: `No entendí bien. Podés preguntarme cosas como:\n${hints.map(h => `• ${h}`).join("\n")}`,
  });
}
