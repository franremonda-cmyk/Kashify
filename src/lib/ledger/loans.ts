import type { SupabaseClient } from "@supabase/supabase-js";

// Préstamos que HACÉS: movimientos enlazados (debt_id) a una deuda "me deben"
// → el egreso al prestar y los cobros cuando te devuelven.
//
// Dos preguntas, dos números:
//  • "¿Cuánta plata tengo?" (Balance total): los préstamos SÍ cuentan — la plata
//    salió y vuelve. No se filtran en balances.ts.
//  • "¿Cómo me fue este mes?" (Ingresos, Gastos, Balance del mes, límites,
//    avisos, "cuánto gasté"): NO cuentan — prestar no es gastar y que te
//    devuelvan no es ganar. Si no, un cobro dos meses después parece un ingreso.
// Lo que pagás de algo que DEBÉS ("debo") sí es gasto: es cuando ese consumo
// se registra (al anotar la deuda no se movió plata).

export async function loanDebtIds(supabase: SupabaseClient, userId?: string): Promise<Set<string>> {
  let q = supabase.from("debts").select("id").eq("direction", "me_deben");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  return new Set(error ? [] : ((data as { id: string }[] | null) ?? []).map((d) => d.id));
}

export function isLoan(t: { debt_id?: string | null }, ids: Set<string>): boolean {
  return !!t.debt_id && ids.has(t.debt_id);
}

export interface LoanFlow { currency_code: string; lent: number; returned: number }

// Lo prestado y lo devuelto por moneda (para la línea "Préstamos" del mes).
export function loanFlows(
  txs: { debt_id?: string | null; type: string; amount: number | string; currency_code: string }[],
  ids: Set<string>,
): LoanFlow[] {
  const by: Record<string, LoanFlow> = {};
  for (const t of txs) {
    if (!isLoan(t, ids)) continue;
    const f = (by[t.currency_code] ??= { currency_code: t.currency_code, lent: 0, returned: 0 });
    if (t.type === "income") f.returned += Number(t.amount);
    else f.lent += Number(t.amount);
  }
  return Object.values(by);
}
