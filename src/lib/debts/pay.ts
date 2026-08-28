import type { SupabaseClient } from "@supabase/supabase-js";
import type { Debt } from "@/types";

export type PayDebtResult =
  | { ok: true; debt: Debt; transactionId: string | null }
  | { ok: false; error: string; status: number };

// Registra un pago (parcial o total) contra una deuda: crea la transacción
// correspondiente (egreso si "debo", ingreso si "me deben") y actualiza el saldo.
// Sin tabla hija de pagos — el detalle vive en transactions.
//
// Vive acá y no en la ruta porque el motor de Neo escribe DIRECTO a Supabase
// (en WhatsApp no hay cookies para el cliente de las rutas), así que la API y
// el chat necesitan compartir esta lógica en vez de duplicarla.
export async function payDebt(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
  amount: number
): Promise<PayDebtResult> {
  const { data: debt } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debtId)
    .eq("user_id", userId)
    .single();
  if (!debt) return { ok: false, error: "Deuda no encontrada", status: 404 };

  const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
  if (!(amount > 0) || amount > remaining + 0.005) {
    return { ok: false, error: "Monto inválido", status: 400 };
  }

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Deudas")
    .maybeSingle();

  const { data: tx } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
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
    .eq("id", debtId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, debt: updated as Debt, transactionId: tx?.id ?? null };
}
