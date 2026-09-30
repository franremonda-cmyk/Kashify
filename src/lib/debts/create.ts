import type { SupabaseClient } from "@supabase/supabase-js";
import type { Debt, DebtDirection } from "@/types";
import { localIso, userTimezone, wallToday } from "@/lib/dates";

// Alta de deuda compartida por la web (/api/debts) y Neo. Antes vivía solo en
// Neo: la misma deuda "me deben" cargada por la web no bajaba el neto y, al
// cobrarla, entraba un ingreso fantasma.
//
// Regla: si alguien te debe, esa plata ya salió de tu bolsillo → además de la
// fila en `debts`, un egreso en "Deudas". "Debo" no mueve plata hasta que pagás.
export async function createDebt(
  supabase: SupabaseClient,
  userId: string,
  d: {
    spaceId?: string | null;
    direction: DebtDirection;
    counterparty: string;
    description?: string | null;
    amount: number;
    currency: string;
    dueDate?: string | null;
  },
): Promise<{ debt: Debt | null; error: string | null }> {
  const { data: debt, error } = await supabase.from("debts").insert({
    user_id: userId, space_id: d.spaceId ?? null, direction: d.direction,
    counterparty: d.counterparty, description: d.description || null,
    total_amount: d.amount, paid_amount: 0, currency_code: d.currency,
    due_date: d.dueDate || null, status: "active",
  }).select().single();
  if (error || !debt) return { debt: null, error: error?.message ?? "No se pudo guardar" };

  if (d.direction === "me_deben") {
    const { data: cat } = await supabase.from("categories").select("id")
      .eq("user_id", userId).eq("name", "Deudas").maybeSingle();
    await insertDebtTx(supabase, {
      user_id: userId, space_id: d.spaceId ?? null, type: "expense", amount: d.amount,
      currency_code: d.currency, description: d.description || `Préstamo a ${d.counterparty}`,
      date: localIso(wallToday(await userTimezone(supabase, userId))),
      category_id: (cat as { id: string } | null)?.id ?? null,
      debt_id: (debt as Debt).id,
    });
  }
  return { debt: debt as Debt, error: null };
}

// Inserta un movimiento enlazado a su deuda (transactions.debt_id, migración
// 015): así borrar la deuda borra sus movimientos (on delete cascade) y editar
// el monto ajusta el egreso. Si la migración todavía no corrió, la columna no
// existe → se guarda sin el enlace (igual que antes), nunca se pierde el movimiento.
export async function insertDebtTx(
  supabase: SupabaseClient,
  row: Record<string, unknown> & { debt_id: string },
): Promise<{ id: string } | null> {
  const first = await supabase.from("transactions").insert(row).select("id").single();
  if (!first.error) return first.data as { id: string };
  if (!/debt_id/.test(first.error.message)) return null;
  const legacy: Record<string, unknown> = { ...row };
  delete legacy.debt_id;
  const retry = await supabase.from("transactions").insert(legacy).select("id").single();
  return (retry.data as { id: string } | null) ?? null;
}
