import { parseWithHaiku } from "@/lib/neo/haiku-client";
import { categoryForText } from "@/lib/neo-keywords";
import type { ParsedTransaction } from "@/types";
import type { FlowContext } from "./types";

// El fallback a Claude está gobernado por NEO_LLM_FALLBACK. Si es "false",
// Neo nunca gasta tokens: cae a clarify. Por defecto está encendido.
export function llmFallbackEnabled(): boolean {
  return process.env.NEO_LLM_FALLBACK !== "false";
}

export interface FallbackResult {
  ctx: FlowContext;
  parsed: ParsedTransaction;
}

// Última instancia, SOLO cuando las reglas no entendieron. Convierte la salida
// de Haiku en un FlowContext de gasto/ingreso. Devuelve null si no aplica o
// si el fallback está desactivado.
export async function llmFallback(text: string, userCategories?: string[]): Promise<FallbackResult | null> {
  if (!llmFallbackEnabled()) return null;
  try {
    const parsed = await parseWithHaiku(text, userCategories);
    if (!parsed || !(parsed.amount > 0)) return null;
    if (parsed.type !== "expense" && parsed.type !== "income") return null;
    return {
      parsed,
      ctx: {
        flow: parsed.type,
        description: parsed.description || text,
        amount: parsed.amount,
        category: parsed.category_name ?? categoryForText(parsed.description || text),
      },
    };
  } catch {
    return null;
  }
}
