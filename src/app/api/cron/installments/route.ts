import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel Cron: corre diariamente a las 08:00 AR
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: duePayments } = await supabase
    .from("installment_payments")
    .select("*, installment_plans(name, currency_code, category_id, user_id)")
    .eq("status", "pending")
    .eq("due_date", today);

  if (!duePayments?.length) return NextResponse.json({ processed: 0 });

  let processed = 0;
  for (const payment of duePayments) {
    const plan = payment.installment_plans as {
      name: string; currency_code: string; category_id: string | null; user_id: string;
    };

    const { data: tx } = await supabase
      .from("transactions")
      .insert({
        user_id: plan.user_id,
        type: "installment-payment",
        amount: payment.amount,
        currency_code: plan.currency_code,
        description: `${plan.name} — cuota ${payment.payment_number}`,
        category_id: plan.category_id,
        date: today,
      })
      .select("id")
      .single();

    await supabase
      .from("installment_payments")
      .update({ status: "paid", transaction_id: tx?.id })
      .eq("id", payment.id);

    processed++;
  }

  return NextResponse.json({ processed });
}
