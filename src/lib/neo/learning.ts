import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "@/types";

const MIN_CONFIRMATIONS_FOR_AUTO = 3;
const CONFIDENCE_INCREMENT = 10;

export async function learnFromConfirmation(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
  parsed: ParsedTransaction
): Promise<void> {
  const keyword = extractKeyword(rawText);
  if (!keyword) return;

  const pattern = buildPattern(keyword, parsed);

  const { data: existing } = await supabase
    .from("parser_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("pattern", pattern)
    .single();

  if (existing) {
    const newConfidence = Math.min(100, existing.confidence + CONFIDENCE_INCREMENT);
    const newCount = existing.match_count + 1;
    await supabase
      .from("parser_rules")
      .update({ confidence: newConfidence, match_count: newCount })
      .eq("id", existing.id);
  } else {
    await supabase.from("parser_rules").insert({
      user_id: userId,
      pattern,
      type: parsed.type,
      category_id: null,
      currency_code: parsed.currency_code,
      confidence: MIN_CONFIRMATIONS_FOR_AUTO < 3 ? 50 : 60,
      match_count: 1,
    });
  }
}

function extractKeyword(text: string): string | null {
  const words = text.toLowerCase().replace(/\d+/g, "").trim().split(/\s+/);
  const meaningful = words.filter((w) => w.length > 2);
  return meaningful[0] ?? null;
}

function buildPattern(keyword: string, parsed: ParsedTransaction): string {
  return `${keyword}|${parsed.type}|${parsed.currency_code}`;
}
