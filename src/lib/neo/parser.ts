import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "@/types";
import { matchRule } from "./rules-engine";
import { parseWithHaiku } from "./haiku-client";

const CONFIDENCE_THRESHOLD = 85;

export async function parseMessage(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  userCategories?: string[]
): Promise<ParsedTransaction> {
  // 1. Intentar reglas locales
  const localResult = await matchRule(supabase, userId, text);
  if (localResult && localResult.confidence >= CONFIDENCE_THRESHOLD) {
    return localResult;
  }

  // 2. Fallback a Haiku
  try {
    const haikuResult = await parseWithHaiku(text, userCategories);
    return haikuResult;
  } catch {
    // 3. Si Haiku falla, retornar como pendiente
    return {
      type: "expense",
      amount: 0,
      currency_code: "ARS",
      description: text,
      confidence: 0,
      needs_confirmation: true,
      question: undefined,
    };
  }
}

export function isBalanceQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return /saldo|cuánto tengo|cuanto tengo|mis cuentas/.test(lower);
}

export function isInstallmentMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return /cuota|cuotas|en \d+/.test(lower);
}
