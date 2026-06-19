import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendBudgetAlert } from "@/lib/neo/send-template";

// Vercel Cron: corre al crear una transacción significativa
// También puede correr periódicamente para verificar presupuestos
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: budgets } = await supabase
    .from("category_budgets")
    .select("*, categories(name, icon), profiles!inner(user_id), user_phones!inner(phone_number, verified)")
    .eq("user_phones.verified", true);

  if (!budgets?.length) return NextResponse.json({ alerts: 0 });

  let alerts = 0;

  for (const budget of budgets as Array<{
    user_id: string; category_id: string; monthly_limit: number; currency_code: string;
    categories: { name: string; icon: string } | null;
    user_phones: { phone_number: string } | { phone_number: string }[] | null;
  }>) {
    const phone = Array.isArray(budget.user_phones)
      ? budget.user_phones[0]?.phone_number
      : budget.user_phones?.phone_number;
    if (!phone) continue;

    const { data: spent } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", budget.user_id)
      .eq("category_id", budget.category_id)
      .is("deleted_at", null)
      .gte("date", monthStart)
      .in("type", ["expense", "installment-payment"]);

    const totalSpent = spent?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    const pct = (totalSpent / budget.monthly_limit) * 100;

    for (const threshold of [80, 100]) {
      if (pct < threshold) continue;

      const alertType = `budget_${budget.category_id}_${threshold}_${now.getFullYear()}_${now.getMonth()}`;
      const { data: existing } = await supabase
        .from("notification_log")
        .select("id")
        .eq("user_id", budget.user_id)
        .eq("alert_type", alertType)
        .single();

      if (existing) continue;

      try {
        const catName = budget.categories?.name ?? "esta categoría";
        const cur = budget.currency_code;
        const spentFmt = totalSpent.toLocaleString("es-AR", { maximumFractionDigits: 0 });
        const limitFmt = budget.monthly_limit.toLocaleString("es-AR", { maximumFractionDigits: 0 });
        const notifMsg = threshold >= 100
          ? `⚠️ Superaste el límite en ${catName}: gastaste ${cur} ${spentFmt} de ${cur} ${limitFmt}.`
          : `📊 Usaste el ${threshold}% de tu límite en ${catName}: ${cur} ${spentFmt} de ${cur} ${limitFmt}.`;

        await Promise.all([
          sendBudgetAlert(phone, catName, totalSpent, budget.monthly_limit, threshold).catch(() => {}),
          supabase.from("neo_notifications").insert({
            user_id: budget.user_id,
            message: notifMsg,
            type: "budget_alert",
          }),
          supabase.from("notification_log").insert({
            user_id: budget.user_id,
            alert_type: alertType,
            ref_id: budget.category_id,
          }),
        ]);
        alerts++;
      } catch (e) {
        console.error("Budget alert failed:", e);
      }
    }
  }

  return NextResponse.json({ alerts });
}
