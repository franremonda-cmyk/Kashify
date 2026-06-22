import { learnFromConfirmation, loadLearnedKeywords } from "@/lib/neo/learning";
import { detectIntent, normalize } from "./intent";
import { fillSlot, interpretClarify, isCancelMsg } from "./flow";
import { domainHint, executeConfirm, executeIntent, respondFlow } from "./actions";
import { llmFallback } from "./llm-fallback";
import type { FlowContext, NeoChannel, NeoReply, NeoState, NeoSupabase, PendingConfirm } from "./types";

export type { NeoReply, NeoState, NeoChannel } from "./types";

interface RunNeoArgs {
  supabase: NeoSupabase;
  userId: string;
  message: string;
  channel: NeoChannel;
  state?: NeoState | null;
}

function isAffirmative(s: string): boolean {
  return /^(si|sí|s|dale|ok|oka|okey|obvio|confirmo|confirmar|eliminalo|borralo|saldalo|hacelo|claro|sip)\b/.test(normalize(s));
}

// Punto de entrada único del motor de Neo. Agnóstico del canal.
export async function runNeo({ supabase, userId, message, channel, state }: RunNeoArgs): Promise<NeoReply> {
  if (!message.trim()) return { text: "Escribime algo 😊" };

  // ── Continuación: el usuario responde a una pregunta/confirmación previa ──
  if (state) {
    if (state.kind === "flow") {
      return continueFlow(supabase, userId, state.ctx, message, channel);
    }
    // Confirmaciones pendientes (WhatsApp): sí/no/número.
    return continueConfirm(supabase, userId, state, message);
  }

  // ── Mensaje nuevo: detección por reglas (0 tokens) ──
  const learnedKeywords = await loadLearnedKeywords(supabase, userId);
  const intent = detectIntent(message, learnedKeywords);

  if (intent.type === "flow") return respondFlow(supabase, userId, intent.ctx, channel);
  if (intent.type !== "unknown") return executeIntent(supabase, userId, intent, channel);

  // ── No se entendió → hint de dominio → fallback Haiku → clarify ──
  const hint = domainHint(message);
  if (hint) return { text: hint };

  const { data: categories } = await supabase.from("categories").select("name").eq("user_id", userId);
  const categoryNames = (categories as { name: string }[] | null)?.map((c) => c.name) ?? [];

  const fallback = await llmFallback(message, categoryNames);
  if (fallback) {
    const reply = await respondFlow(supabase, userId, fallback.ctx, channel);
    // Aprendizaje: si Haiku resolvió y se creó, guardamos la regla para no
    // volver a gastar tokens con este patrón.
    const created = reply.effects?.some((e) => e.type === "refresh");
    if (created) await learnFromConfirmation(supabase, userId, message, fallback.parsed);
    return reply;
  }

  // Realmente desconocido → clarify (0 tokens).
  return respondFlow(supabase, userId, { flow: "clarify" }, channel);
}

// Continuación de un flujo de slot-filling.
async function continueFlow(
  supabase: NeoSupabase,
  userId: string,
  ctx: FlowContext,
  message: string,
  channel: NeoChannel
): Promise<NeoReply> {
  if (isCancelMsg(message)) {
    return { text: "Dale, cancelado.", state: null, effects: [{ type: "cancel_pending" }] };
  }

  if (ctx.flow === "clarify") {
    const switched = interpretClarify(message);
    if (switched) return respondFlow(supabase, userId, switched, channel);
    if (/consult|ver|saldo|cuanto|cuánto/.test(normalize(message)) && detectIntent(message).type === "unknown") {
      return { text: 'Decime qué querés consultar:\n• "mi saldo"\n• "cuánto gasté este mes"\n• "mis metas" / "mis cuotas" / "mis límites"' };
    }
    // No es una elección de clarify → procesar como mensaje nuevo.
    return runNeo({ supabase, userId, message, channel, state: null });
  }

  const filled = fillSlot(ctx, message);
  const changed = JSON.stringify(filled) !== JSON.stringify(ctx);
  // Si no se pudo llenar el slot, re-preguntar (no caer a detección nueva, que
  // secuestraría el flujo).
  return respondFlow(supabase, userId, changed ? filled : ctx, channel);
}

// Continuación de una confirmación pendiente (WhatsApp).
async function continueConfirm(
  supabase: NeoSupabase,
  userId: string,
  confirm: PendingConfirm,
  message: string
): Promise<NeoReply> {
  if (isCancelMsg(message) && !isAffirmative(message)) {
    return { text: "Dale, no toco nada.", state: null };
  }

  // Borrado de transacción con múltiples candidatos → el usuario responde el número.
  if (confirm.kind === "confirm_delete_tx" && confirm.candidates.length > 1) {
    const num = parseInt(normalize(message).match(/\d+/)?.[0] ?? "", 10);
    if (!isNaN(num) && num >= 1 && num <= confirm.candidates.length) {
      return executeConfirm(supabase, userId, { kind: "confirm_delete_tx", candidates: [confirm.candidates[num - 1]] });
    }
    return { text: "Respondé con el número de la que querés eliminar, o 'no' para cancelar.", state: confirm };
  }

  if (isAffirmative(message)) {
    return executeConfirm(supabase, userId, confirm);
  }

  return { text: "¿Confirmás? Respondé 'sí' o 'no'.", state: confirm };
}
