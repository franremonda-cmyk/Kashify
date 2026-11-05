import type { SupabaseClient } from "@supabase/supabase-js";
import type { Balance } from "@/types";

// Saldo por moneda computado desde los movimientos (no desde la tabla balances).
// Es la fuente de verdad para el balance por espacio: agnóstico de espacio (el
// caller filtra qué transacciones pasa) y correcto ante ediciones de monto.
// income suma; expense/installment-payment restan; conversion resta en la moneda
// origen y suma en la destino.
//
// Lo que prestás NO baja el balance (regla de Fran, 05/11/2026). El balance
// responde "¿cuánta plata tengo?", y la plata que presta alguien que arrancó a
// usar la app con dinero encima nunca se anotó como ingreso: descontarla dejaba
// el balance en negativo por el tamaño exacto del préstamo. El egreso se sigue
// guardando (es el registro de cuándo prestaste, y alimenta "Prestaste este
// mes"), solo no cuenta acá. El cobro SÍ suma: esa plata entró de verdad.
// Lo que te deben se ve aparte, en "Pendientes → Te deben".
export interface TxForBalance {
  amount: number | string;
  currency_code: string;
  type: string;
  to_currency_code?: string | null;
  to_amount?: number | string | null;
  debt_id?: string | null;
}

export function computeBalances(
  txs: TxForBalance[],
  loanDebtIds?: Set<string>,
): { currency_code: string; amount: number }[] {
  const by: Record<string, number> = {};
  for (const t of txs) {
    const amt = Number(t.amount);
    // Egreso de un préstamo que hiciste: plata que la app nunca vio entrar.
    if (t.type === "expense" && t.debt_id && loanDebtIds?.has(t.debt_id)) continue;
    if (t.type === "income") by[t.currency_code] = (by[t.currency_code] ?? 0) + amt;
    else if (t.type === "expense" || t.type === "installment-payment") by[t.currency_code] = (by[t.currency_code] ?? 0) - amt;
    else if (t.type === "conversion") {
      by[t.currency_code] = (by[t.currency_code] ?? 0) - amt;
      if (t.to_currency_code) by[t.to_currency_code] = (by[t.to_currency_code] ?? 0) + Number(t.to_amount ?? 0);
    }
  }
  return Object.entries(by).map(([currency_code, amount]) => ({ currency_code, amount }));
}

export async function getBalances(supabase: SupabaseClient, userId: string): Promise<Balance[]> {
  const { data, error } = await supabase
    .from("balances")
    .select("*")
    .eq("user_id", userId)
    .order("currency_code");
  if (error) throw error;
  return data ?? [];
}

export async function getBalance(
  supabase: SupabaseClient,
  userId: string,
  currencyCode: string
): Promise<number> {
  const { data } = await supabase
    .from("balances")
    .select("amount")
    .eq("user_id", userId)
    .eq("currency_code", currencyCode)
    .single();
  return data?.amount ?? 0;
}

export async function upsertBalance(
  supabase: SupabaseClient,
  userId: string,
  currencyCode: string,
  delta: number
): Promise<void> {
  const current = await getBalance(supabase, userId, currencyCode);
  const { error } = await supabase
    .from("balances")
    .upsert(
      { user_id: userId, currency_code: currencyCode, amount: current + delta, updated_at: new Date().toISOString() },
      { onConflict: "user_id,currency_code" }
    );
  if (error) throw error;
}

export async function formatBalancesMessage(balances: Balance[]): Promise<string> {
  if (balances.length === 0) return "No tenés saldos registrados aún.";
  const lines = balances.map((b) => `${b.currency_code}: ${formatAmount(b.amount, b.currency_code)}`);
  return "Tus saldos:\n" + lines.join("\n");
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
