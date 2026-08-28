import { parseWithHaiku } from "@/lib/neo/haiku-client";
import { categoryForText } from "@/lib/neo-keywords";
import type { ParsedTransaction } from "@/types";
import type { FlowContext } from "./types";

// El fallback a Claude está gobernado por NEO_LLM_FALLBACK. Si es "false",
// Neo nunca gasta tokens: cae a clarify. Por defecto está encendido.
export function llmFallbackEnabled(): boolean {
  return process.env.NEO_LLM_FALLBACK !== "false";
}

// `parsed` solo viaja en el caso "tx": es lo que alimenta el aprendizaje, y
// las deudas quedan fuera de parser_rules a propósito (su enum no las conoce,
// y una deuda con contraparte y monto únicos no es un patrón repetible).
export type FallbackResult =
  | { kind: "tx"; ctx: FlowContext; parsed: ParsedTransaction }
  | { kind: "debt"; ctx: Extract<FlowContext, { flow: "debt" }> };

// Última instancia, SOLO cuando las reglas no entendieron. Devuelve null si no
// aplica o si el fallback está desactivado.
export async function llmFallback(text: string, userCategories?: string[]): Promise<FallbackResult | null> {
  if (!llmFallbackEnabled()) return null;
  try {
    const parsed = await parseWithHaiku(text, userCategories);
    if (!parsed || !(parsed.amount > 0)) return null;

    if (parsed.type === "debt" && parsed.debt_direction) {
      return {
        kind: "debt",
        ctx: {
          flow: "debt",
          direction: parsed.debt_direction,
          counterparty: parsed.counterparty || undefined,
          amount: parsed.amount,
        },
      };
    }

    if (parsed.type !== "expense" && parsed.type !== "income") return null;
    return {
      kind: "tx",
      parsed: parsed as ParsedTransaction,
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
