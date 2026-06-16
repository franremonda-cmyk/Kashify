import type { SupabaseClient } from "@supabase/supabase-js";
import type { Balance } from "@/types";

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
