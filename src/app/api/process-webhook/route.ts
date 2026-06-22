import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runNeo } from "@/lib/neo/engine";
import { sendTextMessage, sendReaction, sendTypingIndicator } from "@/lib/neo/send-template";
import type { NeoState } from "@/lib/neo/engine/types";

// Adaptador WhatsApp del motor unificado de Neo (mismo cerebro que la web).
// Se llama de dos formas:
//  1. Disparo inmediato desde el Cloudflare Worker al recibir un mensaje.
//  2. Vercel Cron como red de seguridad por si el disparo inmediato falla.
// Ambos se autorizan con CRON_SECRET. El estado de conversación se persiste
// server-side en neo_conversation_state (WhatsApp no tiene cliente que lo recuerde).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createServiceClient();

  const { data: events } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(10);

  if (!events?.length) return NextResponse.json({ processed: 0 });

  let processed = 0;

  for (const event of events) {
    try {
      await supabase.from("webhook_events").update({ status: "processing" }).eq("id", event.id);

      if (!event.user_id) {
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        continue;
      }

      const message = event.raw_payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const text: string = message?.text?.body ?? "";
      const fromPhone: string = message?.from ?? "";
      const messageId: string = message?.id ?? "";

      if (!text) {
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        continue;
      }

      // Mostrar "escribiendo…" mientras Neo piensa (marca leído + typing).
      if (messageId) await sendTypingIndicator(messageId);

      // Cargar estado de conversación vigente (si no expiró).
      const state = await loadState(supabase, event.user_id);

      const reply = await runNeo({
        supabase,
        userId: event.user_id,
        message: text,
        channel: "whatsapp",
        state,
      });

      // Persistir o limpiar el estado para el próximo turno.
      if (reply.state) {
        await saveState(supabase, event.user_id, reply.state);
      } else {
        await clearState(supabase, event.user_id);
      }

      await sendTextMessage(fromPhone, reply.text);
      if (messageId) await sendReaction(fromPhone, messageId, "✅");
      await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
      processed++;
    } catch (err) {
      await supabase
        .from("webhook_events")
        .update({ status: "failed", error: String(err) })
        .eq("id", event.id);
    }
  }

  return NextResponse.json({ processed });
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function loadState(supabase: ServiceClient, userId: string): Promise<NeoState | null> {
  const { data } = await supabase
    .from("neo_conversation_state")
    .select("state, expires_at")
    .eq("user_id", userId)
    .single();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await clearState(supabase, userId);
    return null;
  }
  return data.state as NeoState;
}

async function saveState(supabase: ServiceClient, userId: string, state: NeoState): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase
    .from("neo_conversation_state")
    .upsert({ user_id: userId, state, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

async function clearState(supabase: ServiceClient, userId: string): Promise<void> {
  await supabase.from("neo_conversation_state").delete().eq("user_id", userId);
}
