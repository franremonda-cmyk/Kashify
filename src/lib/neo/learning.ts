import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTransaction } from "@/types";
import type { LearnedKeyword } from "./engine/types";
import { normalize } from "./engine/intent";

const CONFIDENCE_INCREMENT = 10;
const LEARN_THRESHOLD = 60; // a partir de acá la keyword se usa para detectar sin tokens

// Verbos/artículos/stopwords a ignorar al extraer la keyword significativa.
const SKIP = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","en","con","para","por",
  "que","y","o","a","al","lo","se","me","mi","su","tu","es","fue","son","esta","este",
  // verbos de transacción (no aportan: lo que importa es el sustantivo)
  "compre","compra","comprar","gaste","gasto","gastar","pague","pago","pagar","cobre",
  "cobro","cobrar","saque","sacar","puse","poner","fui","ir","registra","registrar",
  "anota","anotar","carga","cargar","sume","sumar","deposite","depositar","abone","abonar",
  "ingreso","ingreso","ingresaron","recibi","recibir","mande","mandar","tengo","tener",
]);

// Elige el sustantivo más significativo del mensaje (no el verbo). Normalizado
// (sin acentos, minúsculas) para que matchee con el mensaje normalizado en intent.
function extractKeyword(text: string): string | null {
  const words = normalize(text)
    .replace(/\d[\d.,]*/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !SKIP.has(w));
  if (!words.length) return null;
  // Heurística: la palabra de contenido suele ser la más larga/distintiva.
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

// Aprende de una resolución exitosa (Haiku o respuesta del usuario): asocia la
// keyword del mensaje → tipo + categoría. La próxima vez se resuelve sin tokens.
export async function learnFromConfirmation(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
  parsed: ParsedTransaction
): Promise<void> {
  const keyword = extractKeyword(rawText);
  if (!keyword) return;
  if (parsed.type !== "expense" && parsed.type !== "income") return;

  const pattern = `${keyword}|${parsed.type}|${parsed.currency_code}`;
  const categoryId = await resolveCategoryId(supabase, userId, parsed.category_name);

  const { data: existing } = await supabase
    .from("parser_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("pattern", pattern)
    .single();

  if (existing) {
    await supabase
      .from("parser_rules")
      .update({
        confidence: Math.min(100, existing.confidence + CONFIDENCE_INCREMENT),
        match_count: existing.match_count + 1,
        // si antes no teníamos categoría y ahora sí, la guardamos
        category_id: existing.category_id ?? categoryId,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("parser_rules").insert({
      user_id: userId,
      pattern,
      type: parsed.type,
      category_id: categoryId,
      currency_code: parsed.currency_code,
      confidence: LEARN_THRESHOLD,
      match_count: 1,
    });
  }
}

// Carga las keywords aprendidas (confianza suficiente) para detección en 0 tokens.
// Incluye la categoría aprendida (nombre) para no re-adivinarla.
export async function loadLearnedKeywords(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnedKeyword[]> {
  const { data } = await supabase
    .from("parser_rules")
    .select("pattern, type, currency_code, confidence, categories(name)")
    .eq("user_id", userId)
    .gte("confidence", LEARN_THRESHOLD);

  if (!data?.length) return [];

  const out: LearnedKeyword[] = [];
  for (const r of data as {
    pattern: string; type: string; currency_code: string | null;
    categories: { name: string } | { name: string }[] | null;
  }[]) {
    const keyword = r.pattern.split("|")[0]?.trim();
    if (!keyword) continue;
    if (r.type !== "expense" && r.type !== "income") continue;
    const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    out.push({ keyword, type: r.type, currency_code: r.currency_code, category: cat?.name ?? null });
  }
  return out;
}
