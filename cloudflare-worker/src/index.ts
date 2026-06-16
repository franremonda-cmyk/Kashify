export interface Env {
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_APP_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return handleVerification(url, env);
    }

    if (request.method === "POST") {
      return handleIncomingMessage(request, env);
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

async function handleIncomingMessage(request: Request, env: Env): Promise<Response> {
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

  // Encolar en Supabase sin esperar resultado (responde 200 a Meta inmediatamente)
  enqueueMessage(fromPhone, payload, env).catch(console.error);

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

async function enqueueMessage(fromPhone: string, payload: unknown, env: Env): Promise<void> {
  // Buscar user_id por número de teléfono
  const lookupRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_phones?phone_number=eq.${fromPhone}&verified=eq.true&select=user_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const phones = await lookupRes.json() as { user_id: string }[];
  const userId = phones[0]?.user_id ?? null;

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

  // Si el número no está registrado, notificar al usuario
  if (!userId) {
    await sendWhatsAppMessage(
      fromPhone,
      "Hola! Para usar Neo, primero necesitás registrarte en " + env.APP_URL,
      env
    );
  }
}

async function sendWhatsAppMessage(to: string, text: string, env: Env): Promise<void> {
  // Esta función se usa solo para el mensaje de "no registrado"
  // Las alertas proactivas usan templates (send-template.ts en el backend)
  const phoneNumberId = env.APP_URL; // se configura via variable
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}
