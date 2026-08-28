import Anthropic from "@anthropic-ai/sdk";
import type { DebtDirection, ParsedTransaction } from "@/types";
import { inferCurrency } from "./rules-engine";

// Lo que devuelve Haiku: una transacción, o una deuda del sector /deudas.
// `type` se ensancha acá y no en ParsedTransaction porque esa se guarda en
// pending_transactions y alimenta parser_rules, cuyo enum no conoce "debt".
export type HaikuParse = Omit<ParsedTransaction, "type"> & {
  type: ParsedTransaction["type"] | "debt";
  debt_direction?: DebtDirection;
  counterparty?: string;
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku suele envolver el JSON en ```json … ``` o agregar texto alrededor.
// Extraemos el primer objeto {…} para que JSON.parse no reviente.
function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const obj = body.match(/\{[\s\S]*\}/);
  return obj ? obj[0] : body.trim();
}

const SYSTEM_PROMPT = `Sos Neo, un asistente de finanzas personales para usuarios rioplatenses (Argentina/Uruguay).
Tu tarea es parsear mensajes de texto libre y extraer información de transacciones financieras.

Respondé SIEMPRE con un JSON válido con esta estructura:
{
  "type": "expense" | "income" | "conversion" | "balance-query" | "installment" | "debt",
  "amount": number,
  "currency_code": "ARS" | "USD" | "EUR" | "CHF" | "BRL" | ...,
  "description": "descripción limpia",
  "category_name": "Comida" | "Transporte" | "Servicios" | "Ocio" | "Salud" | "Ahorro" | "Deudas" | "Ingresos" | "Otros" | null,
  "card_name": null | "string",
  "to_currency_code": null | "string",
  "to_amount": null | number,
  "exchange_rate": null | number,
  "debt_direction": null | "debo" | "me_deben",
  "counterparty": null | "nombre de la persona",
  "confidence": 0-100,
  "needs_confirmation": boolean,
  "question": null | "pregunta para el usuario si needs_confirmation=true"
}

Reglas:
- "expense": gasto normal. "income": ingreso/cobro. "conversion": cambio de moneda (incluye from y to). "balance-query": consulta de saldo. "installment": menciona cuotas.
- Si el monto o tipo no es claro, needs_confirmation=true y confidence<85.
- Para conversiones: amount y currency_code son la moneda origen; to_amount y to_currency_code son el destino.
- Si dice "cambié X usd a Y pesos", amount=X, currency_code=USD, to_amount=Y, to_currency_code=ARS, exchange_rate=Y/X.
- Moneda default: ARS si no se especifica.
- No incluyas texto fuera del JSON.

OJO con la palabra "deuda", que tiene TRES sentidos distintos:
1. type "debt" = plata prestada entre PERSONAS, que en algún momento se devuelve.
   Siempre con "debt_direction" y "counterparty".
   - "debo 10000 a juan", "me prestaron 5000" → debt_direction "debo".
   - "ana me debe 3000", "le presté 2000 a mi hermano" → debt_direction "me_deben".
   Anotar una deuda NO mueve plata: no es expense ni income.
2. type "installment" = compra financiada con TARJETA en cuotas. Solo si el
   mensaje habla de cuotas, plan o mensualidades.
3. category_name "Deudas" = la categoría de un gasto real que YA movió plata
   (ej: "pagué 5000 de la deuda con juan" es un expense en la categoría Deudas).`;

export async function parseWithHaiku(
  text: string,
  userCategories?: string[]
): Promise<HaikuParse> {
  try {
    const categoriesHint = userCategories?.length
      ? `\nCategorías disponibles del usuario: ${userCategories.join(", ")}`
      : "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT + categoriesHint,
      messages: [{ role: "user", content: text }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(extractJson(raw));

    return {
      type: parsed.type ?? "expense",
      amount: parsed.amount ?? 0,
      currency_code: parsed.currency_code ?? inferCurrency(text),
      description: parsed.description ?? text,
      category_name: parsed.category_name ?? undefined,
      card_name: parsed.card_name ?? undefined,
      to_currency_code: parsed.to_currency_code ?? undefined,
      to_amount: parsed.to_amount ?? undefined,
      exchange_rate: parsed.exchange_rate ?? undefined,
      debt_direction: parsed.debt_direction ?? undefined,
      counterparty: parsed.counterparty ?? undefined,
      confidence: parsed.confidence ?? 50,
      needs_confirmation: parsed.needs_confirmation ?? true,
      question: parsed.question ?? undefined,
    };
  } catch (err) {
    console.error("parseWithHaiku failed:", err);
    return {
      type: "expense",
      amount: 0,
      currency_code: inferCurrency(text),
      description: text,
      confidence: 0,
      needs_confirmation: true,
      question: undefined,
    };
  }
}
