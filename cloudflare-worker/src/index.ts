export interface Env {
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_APP_SECRET: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL: string;
  // Secreto compartido con el backend para autorizar el disparo inmediato
  // del procesador. Debe coincidir con CRON_SECRET en Vercel.
  PROCESS_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return handleVerification(url, env);
    }

    if (request.method === "POST") {
      return handleIncomingMessage(request, env, ctx);
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

function handleVerification(url: URL, env: Env): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

async function handleIncomingMessage(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const body = await request.text();

  if (!(await verifySignature(body, signature, env.WHATSAPP_APP_SECRET))) {
    return new Response("Forbidden", { status: 403 });
  }

  const payload = JSON.parse(body);
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  // Solo procesar mensajes de texto
  if (!message || message.type !== "text") {
    return new Response("OK", { status: 200 });
  }

  const fromPhone = message.from;
  const messageId = message.id as string | undefined;

  // Encolar y disparar el procesamiento inmediato. Usamos ctx.waitUntil para
  // que el runtime no mate el trabajo async después de responder 200 a Meta.
  ctx.waitUntil(
    enqueueAndProcess(fromPhone, messageId, payload, env).catch((err) =>
      console.error("enqueueAndProcess failed", err)
    )
  );

  return new Response("OK", { status: 200 });
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = "sha256=" + Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

// AR mobiles: Meta manda 549..., pero el número pudo guardarse como 54... (sin 9).
// Devolvemos ambas variantes para que el lookup matchee sin importar cómo se guardó.
function phoneLookupVariants(from: string): string[] {
  const d = from.replace(/\D/g, "");
  const set = new Set<string>([d]);
  if (d.startsWith("549") && d.length === 13) set.add("54" + d.slice(3));
  else if (d.startsWith("54") && d.length === 12) set.add("549" + d.slice(2));
  return [...set];
}

// Extrae el texto del primer mensaje del payload de Meta (si es de texto).
function extractText(payload: unknown): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    return m?.type === "text" ? (m.text?.body ?? "") : "";
  } catch {
    return "";
  }
}

// Guarda/actualiza el número que escribió sin estar registrado, para vincularlo
// luego cuando cree su cuenta. Falla en silencio (no debe romper el flujo).
async function rememberContact(fromPhone: string, firstMessage: string, env: Env): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/pending_contacts?on_conflict=phone_number`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        phone_number: fromPhone.replace(/\D/g, ""),
        first_message: firstMessage.slice(0, 500),
        last_contact_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* no-op */
  }
}

async function enqueueAndProcess(fromPhone: string, messageId: string | undefined, payload: unknown, env: Env): Promise<void> {
  // Buscar user_id por número de teléfono (probando ambas variantes AR)
  const variants = phoneLookupVariants(fromPhone);
  const inList = variants.join(",");
  const lookupRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_phones?phone_number=in.(${inList})&verified=eq.true&select=user_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const phones = await lookupRes.json() as { user_id: string }[];
  const userId = phones[0]?.user_id ?? null;

  // Si el número no está registrado: bienvenida + link, y RECORDAR el número
  // (para vincularlo cuando se registre desde la web).
  if (!userId) {
    const firstText = extractText(payload);
    await rememberContact(fromPhone, firstText, env);
    await sendWhatsAppMessage(
      fromPhone,
      "¡Hola! 👋 Soy Neo, tu asistente de finanzas por WhatsApp.\n\n" +
      "Para empezar a registrar tus gastos hablándome, primero creá tu cuenta gratis acá:\n" +
      env.APP_URL + "\n\n" +
      "Cuando termines, volvé y escribime tu primer gasto (ej: \"almuerzo 850\") 💚",
      env
    );
    return;
  }

  // Reaccionar 👀 al instante para que el usuario vea que Neo recibió el mensaje.
  if (messageId) await reactToMessage(fromPhone, messageId, "👀", env);

  // Insertar en webhook_events
  await fetch(`${env.SUPABASE_URL}/rest/v1/webhook_events`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      raw_payload: payload,
      status: "pending",
    }),
  });

  // Disparar el procesamiento inmediato. El cron de Vercel queda como red de
  // seguridad por si esta llamada falla.
  await triggerProcessing(env);
}

async function triggerProcessing(env: Env): Promise<void> {
  const res = await fetch(`${env.APP_URL}/api/process-webhook`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PROCESS_WEBHOOK_SECRET}`,
    },
  });
  if (!res.ok) {
    console.error(`process-webhook trigger failed: ${res.status}`);
  }
}

// WhatsApp manda los celulares argentinos con "9" tras el código de país (549...),
// pero la Cloud API exige enviar SIN ese 9 (54...).
function normalizeRecipient(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length === 13) return "54" + digits.slice(3);
  return digits;
}

async function reactToMessage(to: string, messageId: string, emoji: string, env: Env): Promise<void> {
  await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeRecipient(to),
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    }),
  }).catch(() => {});
}

async function sendWhatsAppMessage(to: string, text: string, env: Env): Promise<void> {
  // Se usa solo para el mensaje de "no registrado".
  // Las alertas proactivas usan templates (send-template.ts en el backend).
  const res = await fetch(
    `https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeRecipient(to),
        type: "text",
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    console.error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
}
