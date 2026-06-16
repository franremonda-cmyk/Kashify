import Anthropic from "@anthropic-ai/sdk";
import type { ParsedTransaction } from "@/types";
import { inferCurrency } from "./rules-engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sos Neo, un asistente de finanzas personales para usuarios rioplatenses (Argentina/Uruguay).
Tu tarea es parsear mensajes de texto libre y extraer información de transacciones financieras.

Respondé SIEMPRE con un JSON válido con esta estructura:
{
  "type": "expense" | "income" | "conversion" | "balance-query" | "installment",
  "amount": number,
  "currency_code": "ARS" | "USD" | "EUR" | "CHF" | "BRL" | ...,
  "description": "descripción limpia",
  "category_name": "Comida" | "Transporte" | "Servicios" | "Ocio" | "Salud" | "Ahorro" | "Deudas" | "Ingresos" | "Otros" | null,
  "card_name": null | "string",
  "to_currency_code": null | "string",
  "to_amount": null | number,
  "exchange_rate": null | number,
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
- No incluyas texto fuera del JSON.`;

export async function parseWithHaiku(
  text: string,
  userCategories?: string[]
): Promise<ParsedTransaction> {
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
    const parsed = JSON.parse(raw);

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
      confidence: parsed.confidence ?? 50,
      needs_confirmation: parsed.needs_confirmation ?? true,
      question: parsed.question ?? undefined,
    };
  } catch {
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
