import { learnFromConfirmation, loadLearnedKeywords } from "@/lib/neo/learning";
import { detectIntent, normalize } from "./intent";
import { fillSlot, interpretClarify, isCancelMsg } from "./flow";
import { domainHint, executeConfirm, executeIntent, respondFlow, loadUserSpaces, resolveSpaceReply, spaceQuestion } from "./actions";
import { llmFallback } from "./llm-fallback";
import type { ParsedTransaction } from "@/types";
import type { FlowContext, NeoChannel, NeoReply, NeoState, NeoSupabase, PendingConfirm } from "./types";

export type { NeoReply, NeoState, NeoChannel } from "./types";

interface RunNeoArgs {
  supabase: NeoSupabase;
  userId: string;
  message: string;
  channel: NeoChannel;
  state?: NeoState | null;
  // Espacio activo seleccionado en la web (uuid). Si está, los movimientos van
  // ahí sin preguntar. En WhatsApp o en vista "Total" va undefined → Neo pregunta.
  activeSpaceId?: string | null;
}

function isAffirmative(s: string): boolean {
  return /^(si|sí|s|dale|ok|oka|okey|obvio|confirmo|confirmar|eliminalo|borralo|saldalo|hacelo|claro|sip)\b/.test(normalize(s));
}

// Saludo / pedido de ayuda → bienvenida con el "cómo usarlo".
function isGreeting(norm: string): boolean {
  return /^(hola|holis|holaa|buenas|buen[oa]s? ?(dias|d[ií]as|tardes|noches)?|hey|hello|hi|empez[ao]r?|empecemos|ayuda|help|menu|men[uú]|info|que pod[eé]s hacer|qu[eé] pod[eé]s hacer|como funciona|c[oó]mo funciona|que sos|qu[eé] sos)\b/.test(norm.trim());
}

const WELCOME_TEXT =
  "¡Hola! 👋 Soy *Neo*, tu asistente de finanzas.\n\n" +
  "Contame tus gastos e ingresos como le hablarías a un amigo:\n" +
  "• _almuerzo 850_\n" +
  "• _uber 1200_\n" +
  "• _cobré 50000 de sueldo_\n\n" +
  "Y preguntame lo que quieras:\n" +
  "• _¿cuánto gasté este mes?_\n" +
  "• _¿cuál es mi saldo?_\n" +
  "• _¿cómo van mis metas?_\n\n" +
  "Probá mandándome tu primer gasto 💚";

// Punto de entrada único del motor de Neo. Agnóstico del canal.
export async function runNeo({ supabase, userId, message, channel, state, activeSpaceId }: RunNeoArgs): Promise<NeoReply> {
  if (!message.trim()) return { text: "Escribime algo 😊" };

  // ── Continuación: el usuario responde a una pregunta/confirmación previa ──
  if (state) {
    if (state.kind === "flow") {
      return continueFlow(supabase, userId, state.ctx, message, channel, activeSpaceId);
    }
    if (state.kind === "clarify_learn") {
      return continueClarifyLearn(supabase, userId, state.original, message, channel, activeSpaceId);
    }
    // Confirmaciones pendientes (WhatsApp): sí/no/número.
    return continueConfirm(supabase, userId, state, message);
  }

  // ── Saludo / ayuda (sin número) → bienvenida con el "cómo usarlo" ──
  if (isGreeting(normalize(message)) && !/\d/.test(message)) {
    return { text: WELCOME_TEXT };
  }

  // ── Mensaje nuevo: detección por reglas (0 tokens) ──
  const learnedKeywords = await loadLearnedKeywords(supabase, userId);
  const intent = detectIntent(message, learnedKeywords);

  if (intent.type === "flow") return respondFlow(supabase, userId, intent.ctx, channel, activeSpaceId);
  if (intent.type !== "unknown") return executeIntent(supabase, userId, intent, channel, activeSpaceId);

  // ── No se entendió → hint de dominio → fallback Haiku → clarify ──
  const hint = domainHint(message);
  if (hint) return { text: hint };

  const { data: categories } = await supabase.from("categories").select("name").eq("user_id", userId);
  const categoryNames = (categories as { name: string }[] | null)?.map((c) => c.name) ?? [];

  const fallback = await llmFallback(message, categoryNames);
  if (fallback) {
    const reply = await respondFlow(supabase, userId, fallback.ctx, channel, activeSpaceId);
    // Aprendizaje: si Haiku resolvió y se creó, guardamos la regla para no
    // volver a gastar tokens con este patrón.
    const created = reply.effects?.some((e) => e.type === "refresh");
    if (created) await learnFromConfirmation(supabase, userId, message, fallback.parsed);
    return reply;
  }

  // Reglas Y Haiku fallaron → preguntar de forma abierta y APRENDER de la respuesta.
  return {
    text: "Mmm, no te entendí del todo 🤔 ¿Me lo explicás con otras palabras?\n(ej: \"gasté 5000 en X\" o \"me ingresaron Y\")",
    state: { kind: "clarify_learn", original: message },
  };
}

// El usuario explica lo que no se entendió → reinterpretamos, registramos y
// APRENDEMOS la keyword del mensaje ORIGINAL para no volver a usar Haiku.
async function continueClarifyLearn(
  supabase: NeoSupabase,
  userId: string,
  original: string,
  message: string,
  channel: NeoChannel,
  activeSpaceId?: string | null
): Promise<NeoReply> {
  if (isCancelMsg(message)) return { text: "Dale, lo dejamos por ahora.", state: null };

  // 1) ¿La explicación ya es una transacción clara por reglas?
  const learned = await loadLearnedKeywords(supabase, userId);
  const intent = detectIntent(message, learned);
  if (intent.type === "flow" && (intent.ctx.flow === "expense" || intent.ctx.flow === "income") && intent.ctx.amount) {
    const reply = await respondFlow(supabase, userId, intent.ctx, channel, activeSpaceId);
    if (reply.effects?.some((e) => e.type === "refresh")) {
      const currency = await primaryCurrency(supabase, userId);
      await learnFromConfirmation(supabase, userId, original, {
        type: intent.ctx.flow, amount: intent.ctx.amount, currency_code: currency,
        description: intent.ctx.description ?? "", category_name: intent.ctx.category ?? undefined,
        confidence: 100, needs_confirmation: false,
      } as ParsedTransaction);
    }
    return { ...reply, state: reply.state ?? null };
  }

  // 2) Dejar que Haiku interprete la explicación (más clara que el original).
  const { data: cats } = await supabase.from("categories").select("name").eq("user_id", userId);
  const categoryNames = (cats as { name: string }[] | null)?.map((c) => c.name) ?? [];
  const fallback = await llmFallback(message, categoryNames);
  if (fallback) {
    const reply = await respondFlow(supabase, userId, fallback.ctx, channel, activeSpaceId);
    if (reply.effects?.some((e) => e.type === "refresh")) {
      // Aprende asociando la keyword del ORIGINAL al resultado.
      await learnFromConfirmation(supabase, userId, original, fallback.parsed);
    }
    return { ...reply, state: reply.state ?? null };
  }

  // 3) Sigo sin entender → soltar sin loop.
  return {
    text: "Perdón, sigo sin captarlo 😅. Probá registrándolo directo, ej: \"gasté 5000 en super\".",
    state: null,
  };
}

async function primaryCurrency(supabase: NeoSupabase, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("primary_currency").eq("user_id", userId).single();
  return (data as { primary_currency?: string } | null)?.primary_currency ?? "ARS";
}

// Continuación de un flujo de slot-filling.
async function continueFlow(
  supabase: NeoSupabase,
  userId: string,
  ctx: FlowContext,
  message: string,
  channel: NeoChannel,
  activeSpaceId?: string | null
): Promise<NeoReply> {
  if (isCancelMsg(message)) {
    return { text: "Dale, cancelado.", state: null, effects: [{ type: "cancel_pending" }] };
  }

  // Neo preguntó a qué espacio va el movimiento y el usuario respondió.
  if ((ctx.flow === "expense" || ctx.flow === "income") && ctx.awaitingSpace) {
    const spaces = await loadUserSpaces(supabase, userId);
    const chosen = resolveSpaceReply(message, spaces);
    if (!chosen) {
      const q = spaceQuestion(spaces);
      return { text: `No te entendí 🙂 ${q.text}`, options: q.options, state: { kind: "flow", ctx } };
    }
    return respondFlow(supabase, userId, { ...ctx, space_id: chosen.id, awaitingSpace: false }, channel, activeSpaceId);
  }

  if (ctx.flow === "clarify") {
    const switched = interpretClarify(message);
    if (switched) return respondFlow(supabase, userId, switched, channel, activeSpaceId);
    if (/consult|ver|saldo|cuanto|cuánto/.test(normalize(message)) && detectIntent(message).type === "unknown") {
      return { text: 'Decime qué querés consultar:\n• "mi saldo"\n• "cuánto gasté este mes"\n• "mis metas" / "mis cuotas" / "mis límites"' };
    }
    // No es una elección de clarify → procesar como mensaje nuevo.
    return runNeo({ supabase, userId, message, channel, state: null, activeSpaceId });
  }

  const filled = fillSlot(ctx, message);
  const changed = JSON.stringify(filled) !== JSON.stringify(ctx);
  // Si no se pudo llenar el slot, re-preguntar (no caer a detección nueva, que
  // secuestraría el flujo).
  return respondFlow(supabase, userId, changed ? filled : ctx, channel, activeSpaceId);
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
