import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "@/types";
import type { LearnedKeyword } from "./engine/types";
import { normalize } from "./engine/intent";

const CONFIDENCE_INCREMENT = 10;
const LEARN_THRESHOLD = 60;      // a partir de acá la keyword se usa sin tokens
const CORRECTION_CONFIDENCE = 85; // una corrección del usuario = ground truth

// Verbos/artículos/stopwords a ignorar al extraer la keyword significativa.
const SKIP = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","en","con","para","por",
  "que","y","o","a","al","lo","se","me","mi","su","tu","es","fue","son","esta","este",
  "compre","compra","comprar","gaste","gasto","gastar","pague","pago","pagar","cobre",
  "cobro","cobrar","saque","sacar","puse","poner","fui","ir","registra","registrar",
  "anota","anotar","carga","cargar","sume","sumar","deposite","depositar","abone","abonar",
  "ingreso","ingreso","ingresaron","recibi","recibir","mande","mandar","tengo","tener",
]);

// Elige el sustantivo más significativo del mensaje (no el verbo). Normalizado.
export function extractKeyword(text: string): string | null {
  const words = normalize(text)
    .replace(/\d[\d.,]*/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !SKIP.has(w));
  if (!words.length) return null;
  return words.sort((a, b) => b.length - a.length)[0];
}

async function resolveCategoryId(
  supabase: SupabaseClient,
  userId: string,
  categoryName: string | null | undefined
): Promise<string | null> {
  if (!categoryName?.trim()) return null;
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", categoryName.trim())
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// Aprende de una resolución exitosa (Haiku o confirmación): keyword → tipo +
// categoría + monto típico. La próxima vez se resuelve sin tokens.
// Best-effort: nunca rompe el flujo del usuario (si falta la columna last_amount
// porque la migración 011 aún no corrió, no-opea y ya).
export async function learnFromConfirmation(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
  parsed: ParsedTransaction
): Promise<void> {
  try {
    const keyword = extractKeyword(rawText);
    if (!keyword) return;
    if (parsed.type !== "expense" && parsed.type !== "income") return;

    const pattern = `${keyword}|${parsed.type}|${parsed.currency_code}`;
    const categoryId = await resolveCategoryId(supabase, userId, parsed.category_name);
    const lastAmount = parsed.amount > 0 ? parsed.amount : null;

    const { data: existing } = await supabase
      .from("parser_rules").select("*").eq("user_id", userId).eq("pattern", pattern).maybeSingle();

    if (existing) {
      await supabase.from("parser_rules").update({
        confidence: Math.min(100, Number(existing.confidence) + CONFIDENCE_INCREMENT),
        match_count: existing.match_count + 1,
        category_id: existing.category_id ?? categoryId,
        last_amount: lastAmount ?? existing.last_amount,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("parser_rules").insert({
        user_id: userId, pattern, type: parsed.type, category_id: categoryId,
        currency_code: parsed.currency_code, confidence: LEARN_THRESHOLD, match_count: 1,
        last_amount: lastAmount,
      });
    }
  } catch (e) {
    console.error("learnFromConfirmation:", e);
  }
}

// Corrección del usuario (editó la categoría en la app o por chat) = GROUND TRUTH.
// SOBREESCRIBE la categoría de la regla (no solo sube confianza) y la fija alta.
export async function learnFromCorrection(
  supabase: SupabaseClient,
  userId: string,
  description: string,
  type: string,
  currency: string,
  categoryId: string | null
): Promise<void> {
  try {
    if (type !== "expense" && type !== "income") return;
    const keyword = extractKeyword(description);
    if (!keyword) return;

    const pattern = `${keyword}|${type}|${currency}`;
    const { data: existing } = await supabase
      .from("parser_rules").select("*").eq("user_id", userId).eq("pattern", pattern).maybeSingle();

    if (existing) {
      await supabase.from("parser_rules").update({
        category_id: categoryId,   // sobrescribe: lo que dijo el usuario manda
        confidence: Math.min(100, Math.max(Number(existing.confidence), CORRECTION_CONFIDENCE)),
        corrected_count: (existing.corrected_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("parser_rules").insert({
        user_id: userId, pattern, type, category_id: categoryId,
        currency_code: currency, confidence: CORRECTION_CONFIDENCE, match_count: 1, corrected_count: 1,
      });
    }
  } catch (e) {
    console.error("learnFromCorrection:", e);
  }
}

// Carga las keywords para detección en 0 tokens en DOS CAPAS:
//  1) reglas PERSONALES del usuario (con categoría + monto típico) — PISAN.
//  2) reglas GLOBALES compartidas (`neo_global_rules`) — solo si el usuario no
//     tiene una propia para ese keyword+tipo. Así los usuarios nuevos arrancan
//     "inteligentes" sin haber enseñado nada.
export async function loadLearnedKeywords(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnedKeyword[]> {
  const out: LearnedKeyword[] = [];
  const seen = new Set<string>(); // keyword|type — la regla del usuario pisa la global

  // 1) Personales
  try {
    const { data } = await supabase
      .from("parser_rules")
      .select("pattern, type, currency_code, confidence, match_count, last_amount, categories(name)")
      .eq("user_id", userId)
      .gte("confidence", LEARN_THRESHOLD);
    for (const r of (data ?? []) as {
      pattern: string; type: string; currency_code: string | null;
      confidence: number; match_count: number; last_amount: number | null;
      categories: { name: string } | { name: string }[] | null;
    }[]) {
      const keyword = r.pattern.split("|")[0]?.trim();
      if (!keyword) continue;
      if (r.type !== "expense" && r.type !== "income") continue;
      const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
      out.push({
        keyword, type: r.type, currency_code: r.currency_code,
        category: cat?.name ?? null, last_amount: r.last_amount ?? null,
        weight: Number(r.confidence) * (r.match_count || 1),
      });
      seen.add(`${keyword}|${r.type}`);
    }
  } catch (e) {
    console.error("loadLearnedKeywords(personal):", e);
  }

  // 2) Globales (best-effort: si la tabla no existe todavía, se ignora)
  try {
    const { data: globals } = await supabase
      .from("neo_global_rules")
      .select("keyword, category_name, type, confidence");
    for (const g of (globals ?? []) as { keyword: string; category_name: string; type: string; confidence: number }[]) {
      if (g.type !== "expense" && g.type !== "income") continue;
      const key = `${g.keyword}|${g.type}`;
      if (seen.has(key)) continue;   // el usuario ya tiene la suya → no pisar
      out.push({
        keyword: g.keyword, type: g.type, currency_code: null,
        category: g.category_name, last_amount: null, weight: Number(g.confidence),
      });
    }
  } catch { /* tabla global aún no migrada */ }

  // más "fuertes" primero → el match gana por confianza×usos, no por orden
  return out.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
}

// Promoción a la capa GLOBAL (la corre el service-role desde el cron): cuenta
// usuarios distintos por (keyword, tipo, categoría) en parser_rules y, para cada
// keyword+tipo, promueve la categoría con MÁS usuarios si alcanza el umbral.
// Lo individual (1 solo usuario) nunca llega → nunca se globaliza.
export async function promoteGlobalRules(
  supabase: SupabaseClient,
  threshold = 2
): Promise<number> {
  const { data } = await supabase
    .from("parser_rules")
    .select("user_id, pattern, type, categories(name)")
    .not("category_id", "is", null)
    .gte("confidence", LEARN_THRESHOLD);
  if (!data?.length) return 0;

  // keyword|type → category_name → set(user_id)
  const byKt: Record<string, Record<string, Set<string>>> = {};
  for (const r of data as { user_id: string; pattern: string; type: string; categories: { name: string } | { name: string }[] | null }[]) {
    if (r.type !== "expense" && r.type !== "income") continue;
    const keyword = r.pattern.split("|")[0]?.trim();
    const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    if (!keyword || !cat?.name) continue;
    const kt = `${keyword}|${r.type}`;
    ((byKt[kt] ??= {})[cat.name] ??= new Set()).add(r.user_id);
  }

  let promoted = 0;
  for (const [kt, cats] of Object.entries(byKt)) {
    const [keyword, type] = kt.split("|");
    let best: string | null = null, bestN = 0;
    for (const [name, users] of Object.entries(cats)) {
      if (users.size > bestN) { bestN = users.size; best = name; }
    }
    if (!best || bestN < threshold) continue;
    const { error } = await supabase.from("neo_global_rules").upsert({
      keyword, category_name: best, type,
      taught_by: bestN, confidence: Math.min(100, 60 + bestN * 5),
      updated_at: new Date().toISOString(),
    }, { onConflict: "keyword,type" });
    if (!error) promoted++;
  }
  return promoted;
}
