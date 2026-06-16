import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction, ParserRule } from "@/types";

const CONFIDENCE_THRESHOLD = 85;

export async function matchRule(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<ParsedTransaction | null> {
  const { data: rules } = await supabase
    .from("parser_rules")
    .select("*")
    .eq("user_id", userId)
    .gte("confidence", CONFIDENCE_THRESHOLD)
    .order("confidence", { ascending: false });

  if (!rules?.length) return null;

  const normalized = text.toLowerCase().trim();

  for (const rule of rules as ParserRule[]) {
    const match = tryMatchPattern(normalized, rule.pattern);
    if (!match) continue;

    return {
      type: rule.type,
      amount: match.amount,
      currency_code: rule.currency_code ?? inferCurrency(text),
      description: text,
      category_name: undefined,
      confidence: rule.confidence,
      needs_confirmation: false,
    };
  }
  return null;
}

function tryMatchPattern(text: string, pattern: string): { amount: number } | null {
  // Patrón simplificado: extrae monto y compara palabras clave
  const keywords = pattern.toLowerCase().split("|");
  const amountMatch = text.match(/[\d.,]+/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[0].replace(/\./g, "").replace(",", "."));
  if (isNaN(amount)) return null;
  const hasKeyword = keywords.some((kw) => text.includes(kw.trim()));
  return hasKeyword ? { amount } : null;
}

export function inferCurrency(text: string): string {
  const lower = text.toLowerCase();
  if (/\busd\b|dolar|dólar|\$u/.test(lower)) return "USD";
  if (/\beur\b|euro/.test(lower)) return "EUR";
  if (/\bchf\b|franco/.test(lower)) return "CHF";
  if (/\bbrl\b|real\b/.test(lower)) return "BRL";
  return "ARS";
}
