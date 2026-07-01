import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Registra el pago de la próxima cuota pendiente del plan.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: plan } = await supabase
    .from("installment_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });

  // Próxima cuota pendiente (menor payment_number)
  const { data: next } = await supabase
    .from("installment_payments")
    .select("*")
    .eq("plan_id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("payment_number", { ascending: true })
    .limit(1)
    .single();

  if (!next) return NextResponse.json({ error: "No hay cuotas pendientes" }, { status: 400 });

  // Crear la transacción de pago de cuota
  const { data: tx } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      space_id: plan.space_id,
      type: "installment-payment",
      amount: next.amount,
      currency_code: plan.currency_code,
      description: `${plan.name} — cuota ${next.payment_number}/${plan.n_installments}`,
      category_id: plan.category_id,
      card_name: plan.card_name,
      date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  await supabase
    .from("installment_payments")
    .update({ status: "paid", transaction_id: tx?.id ?? null })
    .eq("id", next.id)
    .eq("user_id", user.id);

  // ¿Quedan cuotas pendientes?
  const { count } = await supabase
    .from("installment_payments")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if ((count ?? 0) === 0) {
    await supabase.from("installment_plans").update({ status: "paid" }).eq("id", id).eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, paid_number: next.payment_number });
}
