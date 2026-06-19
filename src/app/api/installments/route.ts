import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateFrenchInstallment,
  calculateNoInterest,
  generatePaymentDates,
} from "@/lib/installments/calculator";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("installment_plans")
    .select("*, installment_payments(*), categories(name, color, icon)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, total_amount, currency_code, n_installments, interest_type, tna,
    card_name, category_id, first_payment_date, installment_amount: provided_amount } = body;

  const calc = interest_type === "french" && tna
    ? calculateFrenchInstallment(total_amount, tna, n_installments)
    : calculateNoInterest(total_amount, n_installments);

  const installment_amount = provided_amount ?? calc.installment_amount;

  const { data: plan, error: planError } = await supabase
    .from("installment_plans")
    .insert({
      user_id: user.id,
      name, total_amount, currency_code, n_installments,
      installment_amount, tna: tna ?? null,
      interest_type: interest_type ?? "none",
      card_name: card_name ?? null,
      category_id: category_id || null,
      first_payment_date,
      status: "active",
    })
    .select()
    .single();

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  // Generar pagos individuales
  const dates = generatePaymentDates(new Date(first_payment_date), n_installments);
  const payments = dates.map((date, i) => ({
    plan_id: plan.id,
    user_id: user.id,
    payment_number: i + 1,
    amount: installment_amount,
    due_date: date.toISOString().split("T")[0],
    status: "pending",
  }));

  await supabase.from("installment_payments").insert(payments);

  return NextResponse.json({ plan, calculation: calc }, { status: 201 });
}
