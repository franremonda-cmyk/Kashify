import type { SupabaseClient } from "@supabase/supabase-js";
import type { Debt, DebtDirection } from "@/types";
import { localIso, userTimezone, wallToday } from "@/lib/dates";

// Alta de deuda compartida por la web (/api/debts) y Neo. Antes vivía solo en
// Neo: la misma deuda "me deben" cargada por la web no bajaba el neto y, al
// cobrarla, entraba un ingreso fantasma.
//
// Regla (Fran, 05/11/2026): el balance se mueve solo cuando la plata pasa por
// tu mano. "Me deben" con fromBalance (le diste la plata ahora) → además de la
// fila en `debts`, un egreso en "Deudas" que baja el balance. Sin fromBalance
// (te la debían de antes, o ya anotaste el gasto que la originó) → solo la
// deuda. "Debo" no mueve plata hasta que pagás.
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
    fromBalance?: boolean; // por defecto sí (la plata salió ahora)
  },
): Promise<{ debt: Debt | null; error: string | null }> {
  const { data: debt, error } = await supabase.from("debts").insert({
    user_id: userId, space_id: d.spaceId ?? null, direction: d.direction,
    counterparty: d.counterparty, description: d.description || null,
    total_amount: d.amount, paid_amount: 0, currency_code: d.currency,
    due_date: d.dueDate || null, status: "active",
  }).select().single();
  if (error || !debt) return { debt: null, error: error?.message ?? "No se pudo guardar" };

  if (d.direction === "me_deben" && d.fromBalance !== false) {
    await insertOriginExpense(supabase, userId, debt as Debt,
      localIso(wallToday(await userTimezone(supabase, userId))), d.description);
  }
  return { debt: debt as Debt, error: null };
}

// El egreso de cuando prestaste: la plata que salió de tu mano. Es el único
// movimiento de una deuda que no es un cobro ni un pago.
export async function insertOriginExpense(
  supabase: SupabaseClient,
  userId: string,
  debt: Pick<Debt, "id" | "space_id" | "total_amount" | "currency_code" | "counterparty">,
  date: string,
  description?: string | null,
): Promise<void> {
  const { data: cat } = await supabase.from("categories").select("id")
    .eq("user_id", userId).eq("name", "Deudas").maybeSingle();
  await insertDebtTx(supabase, {
    user_id: userId, space_id: debt.space_id ?? null, type: "expense", amount: debt.total_amount,
    currency_code: debt.currency_code, description: description || `Préstamo a ${debt.counterparty}`,
    date, category_id: (cat as { id: string } | null)?.id ?? null,
    debt_id: debt.id,
  });
}

// ¿Esta deuda «me deben» bajó tu balance? Sí si tiene vivo su egreso de origen.
export async function fromBalanceIds(supabase: SupabaseClient, userId: string, debtIds: string[]): Promise<Set<string>> {
  if (debtIds.length === 0) return new Set();
  const { data } = await supabase.from("transactions").select("debt_id")
    .eq("user_id", userId).eq("type", "expense").is("deleted_at", null).in("debt_id", debtIds);
  return new Set(((data as { debt_id: string }[] | null) ?? []).map((t) => t.debt_id));
}

// Cambiar de opinión sobre «¿salió de tu plata?» en una deuda ya anotada: se
// apaga el egreso (borrado recuperable) o se lo vuelve a prender / se lo crea.
export async function setFromBalance(
  supabase: SupabaseClient,
  userId: string,
  debt: Pick<Debt, "id" | "space_id" | "total_amount" | "currency_code" | "counterparty" | "created_at" | "description">,
  on: boolean,
): Promise<void> {
  if (!on) {
    await supabase.from("transactions").update({ deleted_at: new Date().toISOString() })
      .eq("debt_id", debt.id).eq("user_id", userId).eq("type", "expense").is("deleted_at", null);
    return;
  }
  if ((await fromBalanceIds(supabase, userId, [debt.id])).has(debt.id)) return;
  // Si alguna vez tuvo egreso, se recupera ese (con su fecha); si no, se crea
  // con la fecha en que se anotó la deuda, que es cuando salió la plata.
  const { data: old } = await supabase.from("transactions").select("id")
    .eq("debt_id", debt.id).eq("user_id", userId).eq("type", "expense")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (old) {
    await supabase.from("transactions")
      .update({ deleted_at: null, amount: debt.total_amount, currency_code: debt.currency_code })
      .eq("id", (old as { id: string }).id).eq("user_id", userId);
    return;
  }
  await insertOriginExpense(supabase, userId, debt, debt.created_at.slice(0, 10), debt.description);
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

// Borrado compartido web/Neo. Los movimientos enlazados se marcan borrados
// (deleted_at, como cualquier gasto borrado): salen del neto pero se pueden
// recuperar. Con la migración 017 la FK es "set null", así que borrar la deuda
// ya no los elimina de verdad. `orphans` = hay movimientos esperables que NO estaban
// enlazados (deuda anterior a la migración, o migración sin correr): quedan en
// Actividad y hay que avisarlo, nunca decir que se borraron.
export async function deleteDebt(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
): Promise<{ ok: boolean; orphans: boolean }> {
  const { data: debt } = await supabase.from("debts").select("direction, paid_amount")
    .eq("id", debtId).eq("user_id", userId).maybeSingle();
  if (!debt) return { ok: false, orphans: false };
  const d = debt as { direction: DebtDirection; paid_amount: number };
  // Solo los cobros/pagos son seguros: una «me deben» puede no tener egreso de
  // origen a propósito (te la debían de antes), y contarlo daba falsa alarma.
  const expected = Number(d.paid_amount) > 0 ? 1 : 0;
  const { count, error: countError } = await supabase.from("transactions")
    .select("id", { count: "exact", head: true }).eq("debt_id", debtId).eq("user_id", userId);
  const linked = countError ? 0 : (count ?? 0);
  if (!countError) {
    await supabase.from("transactions").update({ deleted_at: new Date().toISOString() })
      .eq("debt_id", debtId).eq("user_id", userId).is("deleted_at", null);
  }
  const { error } = await supabase.from("debts").delete().eq("id", debtId).eq("user_id", userId);
  if (error) return { ok: false, orphans: false };
  return { ok: true, orphans: linked < expected };
}
