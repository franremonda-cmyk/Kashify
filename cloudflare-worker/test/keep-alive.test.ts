// Self-check del re-registro automático del número. Stubea fetch: no toca Meta.
// Correr: npx tsx cloudflare-worker/test/keep-alive.test.ts
import { keepNumberAlive } from "../src/keep-alive.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

const env = { WHATSAPP_PHONE_NUMBER_ID: "111", WHATSAPP_ACCESS_TOKEN: "tok", WHATSAPP_TWO_STEP_PIN: "123456" };
const photo = new Uint8Array([1, 2, 3]).buffer;

function stub(status: string, failRegister = false) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s });
    if (url.includes("?fields=status")) return json({ status });
    if (url.endsWith("/register")) return failRegister ? json({ error: "x" }, 400) : json({ success: true });
    if (url.includes("/uploads")) return json({ id: "upload:abc" });
    if (url.endsWith("/upload:abc")) return json({ h: "HANDLE" });
    if (url.endsWith("/whatsapp_business_profile")) return json({ success: true });
    throw new Error(`url inesperada: ${url}`);
  }) as typeof fetch;
  return calls;
}

async function main() {
// ── conectado: solo mira, no toca nada ──
let calls = stub("CONNECTED");
ok((await keepNumberAlive(env, photo)) === "ok (CONNECTED)", "CONNECTED → no hace nada");
ok(calls.length === 1 && calls[0].method === "GET", "CONNECTED → una sola consulta");

// ── caído: registra con el PIN y repone la foto con el handle ──
calls = stub("PENDING");
ok((await keepNumberAlive(env, photo)) === "re-registrado y foto repuesta", "PENDING → re-registra");
ok(JSON.parse(calls[1].body as string).pin === "123456", "register lleva el PIN");
ok(calls[2].url.includes("file_length=3"), "sesión de subida con el largo real de la foto");
ok(calls[3].body === photo, "sube los bytes de la foto");
ok(JSON.parse(calls[4].body as string).profile_picture_handle === "HANDLE", "pega el handle en el perfil");

// ── registro rechazado: avisa y no intenta la foto ──
calls = stub("PENDING", true);
let threw = false;
try { await keepNumberAlive(env, photo); } catch (e) { threw = String(e).includes("register falló: 400"); }
ok(threw && calls.length === 2, "register falla → error y sin subir foto");

console.log(`✓ keep-alive: ${pass} asserts`);
}

main();
