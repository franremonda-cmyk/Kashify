// Self-check del aprendizaje de Neo (Fase 1). No toca prod ni red.
// Correr: npx tsx cloudflare-worker/test/learning.test.ts
import { extractKeyword, promoteGlobalRules } from "../../src/lib/neo/learning.ts";
import { detectIntent } from "../../src/lib/neo/engine/intent.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// ── extractKeyword ──
ok(extractKeyword("compré netflix 2990") === "netflix", "extractKeyword saca el sustantivo");
ok(extractKeyword("pagué 500") === null, "sin sustantivo → null");

// ── detección de corrección por chat ──
const i1 = detectIntent("el último gasto ponelo en Transporte");
ok(i1.type === "correct_tx_category" && /transporte/.test((i1 as { category: string }).category), "‘el último ponelo en X’ → correct_tx_category (último)");

const i2 = detectIntent("cambiá la categoría de netflix a Ocio");
ok(i2.type === "correct_tx_category" && (i2 as { search?: string }).search === "netflix" && /ocio/.test((i2 as { category: string }).category), "‘cambiá la categoría de netflix a Ocio’ → search netflix");

const i3 = detectIntent("movelo a Comida");
ok(i3.type === "correct_tx_category" && !(i3 as { search?: string }).search && /comida/.test((i3 as { category: string }).category), "‘movelo a Comida’ → último implícito");

// no debe confundirse con un gasto normal
ok(detectIntent("almuerzo 850").type === "flow", "‘almuerzo 850’ sigue siendo un gasto, no corrección");

// ── promoteGlobalRules (fake Supabase) ──
type Row = { user_id: string; pattern: string; type: string; categories: { name: string } };
function fake(rows: Row[]) {
  const upserts: Record<string, unknown>[] = [];
  const chain = { select() { return chain; }, not() { return chain; }, gte() { return chain; },
    then(res: (v: { data: Row[] }) => unknown) { return Promise.resolve({ data: rows }).then(res); } };
  const client = {
    from(table: string) {
      if (table === "parser_rules") return chain;
      return { upsert(obj: Record<string, unknown>) { upserts.push(obj); return Promise.resolve({ error: null }); } };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, upserts };
}

async function main() {
  const rows: Row[] = [
    { user_id: "u1", pattern: "uber|expense|ARS", type: "expense", categories: { name: "Transporte" } },
    { user_id: "u2", pattern: "uber|expense|ARS", type: "expense", categories: { name: "Transporte" } },
    { user_id: "u1", pattern: "kiosco|expense|ARS", type: "expense", categories: { name: "Comida" } }, // 1 solo user → NO
    { user_id: "u1", pattern: "netflix|expense|ARS", type: "expense", categories: { name: "Ocio" } },
    { user_id: "u2", pattern: "netflix|expense|ARS", type: "expense", categories: { name: "Ocio" } },
    { user_id: "u3", pattern: "netflix|expense|ARS", type: "expense", categories: { name: "Servicios" } }, // minoría
  ];
  const { client, upserts } = fake(rows);
  const promoted = await promoteGlobalRules(client, 2);
  ok(promoted === 2, `promueve 2 reglas (uber, netflix), no kiosco — got ${promoted}`);
  const uber = upserts.find((u) => u.keyword === "uber");
  const netflix = upserts.find((u) => u.keyword === "netflix");
  ok(!!uber && uber.category_name === "Transporte", "uber → Transporte (2 users)");
  ok(!!netflix && netflix.category_name === "Ocio", "netflix → Ocio (mayoría 2 vs 1)");
  ok(!upserts.find((u) => u.keyword === "kiosco"), "kiosco (1 user) NO se promueve");

  console.log(`✓ aprendizaje Neo: ${pass} asserts OK`);
}

main();
