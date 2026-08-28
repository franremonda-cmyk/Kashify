import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Registra un pago (parcial o total) contra una deuda: crea la transacción
// correspondiente (egreso si "debo", ingreso si "me deben") y actualiza el
// saldo. Sin tabla hija de pagos — el detalle vive en transactions.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await request.json();

  const { data: debt } = await supabase
    .from("debts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!debt) return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });

  const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
  if (!(amount > 0) || amount > remaining + 0.005) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", "Deudas")
    .maybeSingle();

  const { data: tx } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      space_id: debt.space_id,
      type: debt.direction === "debo" ? "expense" : "income",
      amount,
      currency_code: debt.currency_code,
      description: `${debt.counterparty} — ${debt.direction === "debo" ? "pago de deuda" : "cobro de deuda"}`,
      category_id: category?.id ?? null,
      date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  const paid_amount = Number(debt.paid_amount) + amount;
  const status = paid_amount >= Number(debt.total_amount) - 0.005 ? "paid" : "active";

  const { data: updated, error } = await supabase
    .from("debts")
    .update({ paid_amount, status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ debt: updated, transaction_id: tx?.id ?? null });
}
