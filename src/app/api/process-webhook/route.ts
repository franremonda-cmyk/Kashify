import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseMessage, isBalanceQuery, isInstallmentMessage } from "@/lib/neo/parser";
import { learnFromConfirmation } from "@/lib/neo/learning";
import { formatBalancesMessage, getBalances } from "@/lib/ledger/balances";
import { sendTextMessage } from "@/lib/neo/send-template";

// Este endpoint se llama periódicamente (Vercel Cron) para procesar webhooks pendientes
export async function POST() {
  const supabase = await createServiceClient();

  // Tomar hasta 10 eventos pendientes
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
      await supabase
        .from("webhook_events")
        .update({ status: "processing" })
        .eq("id", event.id);

      if (!event.user_id) {
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        continue;
      }

      const message = event.raw_payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const text: string = message?.text?.body ?? "";
      const fromPhone: string = message?.from ?? "";

      if (!text) {
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        continue;
      }

      // Consulta de saldo
      if (isBalanceQuery(text)) {
        const balances = await getBalances(supabase, event.user_id);
        const msg = await formatBalancesMessage(balances);
        await sendTextMessage(fromPhone, msg);
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        processed++;
        continue;
      }

      // Mensaje sobre cuotas — redirigir al dashboard
      if (isInstallmentMessage(text)) {
        await sendTextMessage(
          fromPhone,
          "Para registrar una compra en cuotas, abrí el dashboard en " +
            process.env.NEXT_PUBLIC_APP_URL + " y completá el formulario de cuotas."
        );
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
        processed++;
        continue;
      }

      // Obtener categorías del usuario para mejorar el parseo
      const { data: categories } = await supabase
        .from("categories")
        .select("name")
        .eq("user_id", event.user_id);
      const categoryNames = categories?.map((c: { name: string }) => c.name) ?? [];

      const parsed = await parseMessage(supabase, event.user_id, text, categoryNames);

      if (parsed.confidence >= 85 && !parsed.needs_confirmation) {
        // Crear transacción directamente
        await createTransaction(supabase, event.user_id, parsed, text);
        await learnFromConfirmation(supabase, event.user_id, text, parsed);

        const confirmMsg = buildConfirmationMessage(parsed);
        await sendTextMessage(fromPhone, confirmMsg);
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
      } else {
        // Guardar como pendiente y preguntar
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("pending_transactions").insert({
          user_id: event.user_id,
          raw_text: text,
          neo_interpretation: parsed,
          status: "waiting",
          expires_at: expiresAt,
        });

        const question = parsed.question ?? `¿Esto es ${parsed.type} de ${parsed.amount} ${parsed.currency_code}?`;
        await sendTextMessage(fromPhone, question);
        await supabase.from("webhook_events").update({ status: "done" }).eq("id", event.id);
      }

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

async function createTransaction(
  supabase: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  userId: string,
  parsed: Awaited<ReturnType<typeof parseMessage>>,
  rawText: string
) {
  const { data: category } = parsed.category_name
    ? await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", parsed.category_name)
        .single()
    : { data: null };

  await supabase.from("transactions").insert({
    user_id: userId,
    type: parsed.type,
    amount: parsed.amount,
    currency_code: parsed.currency_code,
    description: parsed.description || rawText,
    category_id: category?.id ?? null,
    card_name: parsed.card_name ?? null,
    to_currency_code: parsed.to_currency_code ?? null,
    to_amount: parsed.to_amount ?? null,
    exchange_rate: parsed.exchange_rate ?? null,
    date: new Date().toISOString().split("T")[0],
  });
}

function buildConfirmationMessage(parsed: Awaited<ReturnType<typeof parseMessage>>): string {
  const typeLabels: Record<string, string> = {
    expense: "Gasto",
    income: "Ingreso",
    conversion: "Conversión",
    "installment-payment": "Cuota",
  };
  const label = typeLabels[parsed.type] ?? parsed.type;
  return `Listo ✓ ${label}: ${parsed.description} — ${parsed.amount} ${parsed.currency_code}`;
}
