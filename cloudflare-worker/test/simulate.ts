// Simulación offline del worker de WhatsApp.
// Corre el código REAL del worker en Node con fetch stubeado: no toca Meta ni Supabase.
//   Uso: npx tsx cloudflare-worker/test/simulate.ts
import worker from "../src/index.ts";

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-123",
  WHATSAPP_APP_SECRET: "app-secret-xyz",
  WHATSAPP_PHONE_NUMBER_ID: "111222333",
  WHATSAPP_ACCESS_TOKEN: "EAAtoken",
  SUPABASE_URL: "https://fake.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  APP_URL: "https://neo.example.app",
  PROCESS_WEBHOOK_SECRET: "shared-secret",
};

// --- Mock de ExecutionContext: ejecuta waitUntil y nos deja esperarlo ---
const pending: Promise<unknown>[] = [];
const ctx = {
  waitUntil: (p: Promise<unknown>) => pending.push(p),
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

// --- Stub de fetch: registra llamadas y devuelve respuestas canned ---
interface Call { url: string; method: string; body?: string; auth?: string }
let calls: Call[] = [];
let registeredUser: string | null = null; // user_id a devolver en el lookup

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);
  calls.push({
    url,
    method,
    body: typeof init?.body === "string" ? init.body : undefined,
    auth: headers.get("authorization") ?? undefined,
  });

  if (url.includes("/rest/v1/user_phones")) {
    const rows = registeredUser ? [{ user_id: registeredUser }] : [];
    return new Response(JSON.stringify(rows), { status: 200 });
  }
  // webhook_events insert, process-webhook trigger, graph.facebook send
  return new Response("OK", { status: 200 });
}) as typeof fetch;

// --- Helper: firma HMAC SHA-256 igual que Meta ---
async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function textPayload(from: string, text: string) {
  return JSON.stringify({
    entry: [{ changes: [{ value: { messages: [{ from, type: "text", text: { body: text } }] } }] }],
  });
}

async function drain() {
  await Promise.all(pending.splice(0));
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function run() {
  // 1) Verificación del webhook (GET)
  {
    const url = `https://w/?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=CHAL`;
    const res = await worker.fetch(new Request(url), env, ctx);
    check("GET verificación con token correcto → 200 + challenge",
      res.status === 200 && (await res.text()) === "CHAL");

    const bad = await worker.fetch(new Request(`https://w/?hub.mode=subscribe&hub.verify_token=mal`), env, ctx);
    check("GET verificación con token incorrecto → 403", bad.status === 403);
  }

  // 2) Firma inválida → 403, sin efectos
  {
    calls = [];
    const body = textPayload("5491100000000", "almuerzo 850");
    const res = await worker.fetch(new Request("https://w/", {
      method: "POST", headers: { "x-hub-signature-256": "sha256=deadbeef" }, body,
    }), env, ctx);
    await drain();
    check("POST con firma inválida → 403", res.status === 403);
    check("POST con firma inválida → 0 llamadas externas", calls.length === 0, `${calls.length} llamadas`);
  }

  // 3) Usuario REGISTRADO → encola + dispara process-webhook
  {
    calls = []; registeredUser = "user-abc";
    const body = textPayload("5491100000000", "almuerzo 850");
    const res = await worker.fetch(new Request("https://w/", {
      method: "POST", headers: { "x-hub-signature-256": await sign(body, env.WHATSAPP_APP_SECRET) }, body,
    }), env, ctx);
    check("Usuario registrado → responde 200 a Meta", res.status === 200);
    await drain();

    const lookup = calls.find((c) => c.url.includes("user_phones"));
    const enqueue = calls.find((c) => c.url.includes("webhook_events"));
    const trigger = calls.find((c) => c.url.endsWith("/api/process-webhook"));
    check("Usuario registrado → hace lookup del teléfono", !!lookup);
    check("Usuario registrado → encola en webhook_events", !!enqueue && enqueue.method === "POST");
    check("Usuario registrado → dispara process-webhook con Bearer secreto",
      !!trigger && trigger.auth === `Bearer ${env.PROCESS_WEBHOOK_SECRET}`);
    check("Usuario registrado → NO manda WhatsApp de 'registrate'",
      !calls.some((c) => c.url.includes("graph.facebook.com")));
  }

  // 4) Usuario NO registrado → manda WhatsApp 'registrate', no encola
  {
    calls = []; registeredUser = null;
    const body = textPayload("5499999999999", "hola");
    await worker.fetch(new Request("https://w/", {
      method: "POST", headers: { "x-hub-signature-256": await sign(body, env.WHATSAPP_APP_SECRET) }, body,
    }), env, ctx);
    await drain();

    const send = calls.find((c) => c.url.includes("graph.facebook.com"));
    check("No registrado → manda WhatsApp con token en Authorization",
      !!send && send.auth === `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`);
    check("No registrado → la URL usa el PHONE_NUMBER_ID (no el APP_URL)",
      !!send && send.url.includes(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`));
    check("No registrado → NO encola ni dispara procesamiento",
      !calls.some((c) => c.url.includes("webhook_events") || c.url.endsWith("/api/process-webhook")));
  }

  globalThis.fetch = realFetch;
  console.log(`\n${failures === 0 ? "✅ TODO OK" : `❌ ${failures} fallo(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
