import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "@/types";
import type { LearnedKeyword } from "./engine/types";

const CONFIDENCE_INCREMENT = 10;
const LEARN_THRESHOLD = 60; // a partir de acá la keyword se usa para detectar sin tokens

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
    await supabase
      .from("parser_rules")
      .update({ confidence: newConfidence, match_count: existing.match_count + 1 })
      .eq("id", existing.id);
  } else {
    await supabase.from("parser_rules").insert({
      user_id: userId,
      pattern,
      type: parsed.type,
      category_id: null,
      currency_code: parsed.currency_code,
      confidence: LEARN_THRESHOLD,
      match_count: 1,
    });
  }
}

// Carga las keywords aprendidas (confianza suficiente) para alimentar la
// detección de intent en 0 tokens. Solo gasto/ingreso son accionables como flow.
export async function loadLearnedKeywords(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnedKeyword[]> {
  const { data } = await supabase
    .from("parser_rules")
    .select("pattern, type, currency_code, confidence")
    .eq("user_id", userId)
    .gte("confidence", LEARN_THRESHOLD);

  if (!data?.length) return [];

  const out: LearnedKeyword[] = [];
  for (const r of data as { pattern: string; type: string; currency_code: string | null }[]) {
    const keyword = r.pattern.split("|")[0]?.trim();
    if (!keyword) continue;
    if (r.type !== "expense" && r.type !== "income") continue;
    out.push({ keyword, type: r.type, currency_code: r.currency_code });
  }
  return out;
}

function extractKeyword(text: string): string | null {
  const words = text.toLowerCase().replace(/\d+/g, "").trim().split(/\s+/);
  const meaningful = words.filter((w) => w.length > 2);
  return meaningful[0] ?? null;
}

function buildPattern(keyword: string, parsed: ParsedTransaction): string {
  return `${keyword}|${parsed.type}|${parsed.currency_code}`;
}
