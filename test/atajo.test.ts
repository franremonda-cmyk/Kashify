// Self-check del Atajo de iPhone. Stubea Supabase en memoria: no toca prod ni red.
// Correr: npx tsx cloudflare-worker/test/atajo.test.ts
import { responderAtajo, tokenValido } from "../src/lib/neo/atajo.ts";
import type { NeoState, NeoSupabase } from "../src/lib/neo/engine/types.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// Solo neo_conversation_state: lo único que tocan estos caminos del motor.
function stub(state: NeoState | null, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  const db = { row: state ? { state, expires_at: expiresAt } : null as { state: NeoState; expires_at: string } | null };
  const client = {
    from() {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: db.row }) }) }),
        delete: () => ({ eq: async () => { db.row = null; return {}; } }),
        upsert: async (r: { state: NeoState; expires_at: string }) => { db.row = r; return {}; },
      };
    },
  };
  return { db, supabase: client as unknown as NeoSupabase };
}

// La clave: sin token configurado nadie entra, ni siquiera con el header vacío.
ok(tokenValido("Bearer secreto", "secreto"), "token correcto entra");
ok(!tokenValido("Bearer otro", "secreto"), "token incorrecto no entra");
ok(!tokenValido("Bearer secret", "secreto"), "token más corto no entra");
ok(!tokenValido("secreto", "secreto"), "sin Bearer no entra");
ok(!tokenValido(null, "secreto"), "sin header no entra");
ok(!tokenValido("Bearer ", ""), "sin token configurado no entra");
ok(!tokenValido("Bearer undefined", undefined), "token sin definir no entra");

async function main() {
  // Sin el formato de WhatsApp: en el Atajo los asteriscos se verían tal cual.
  const hola = stub(null);
  const bienvenida = await responderAtajo(hola.supabase, "u1", "hola");
  ok(bienvenida.includes("Soy Neo"), "contesta y saca los asteriscos");
  ok(!/[*_]/.test(bienvenida), "sin marcas de formato");

  // Una repregunta sobrevive entre dos usos del Atajo: el motor recibe el estado guardado.
  const flow: NeoState = { kind: "flow", ctx: { flow: "expense", description: "café" } };
  const pendiente = stub(flow);
  const cancelado = await responderAtajo(pendiente.supabase, "u1", "cancela");
  ok(cancelado === "Dale, cancelado.", "usa el estado guardado");
  ok(pendiente.db.row === null, "y lo limpia al terminar");

  // Un estado vencido no se aplica: "hola" es un mensaje nuevo, no una respuesta.
  const viejo = stub(flow, new Date(Date.now() - 1000).toISOString());
  ok((await responderAtajo(viejo.supabase, "u1", "hola")).includes("Soy Neo"), "ignora el estado vencido");

  console.log(`✓ atajo: ${pass} asserts`);
}

main();
