// Self-check de includedSpaceIds (aislamiento de espacios en las lecturas).
// No toca prod ni red. Correr con: npx tsx cloudflare-worker/test/spaces.test.ts
import { includedSpaceIds } from "../../src/lib/spaces.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const NONE = "00000000-0000-0000-0000-000000000000";

// Fake mínimo: from().select().eq() → { data: spaces }
function fake(spaces: { id: string; include_in_total: boolean }[]): SupabaseClient {
  const chain = { select() { return this; }, eq() { return Promise.resolve({ data: spaces }); } };
  return { from() { return chain; } } as unknown as SupabaseClient;
}

let pass = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { console.error(`✗ ${msg}\n  esperado ${e}\n  obtenido ${a}`); process.exit(1); }
  pass++;
}

const P = "11111111-1111-1111-1111-111111111111"; // Personal, incluido
const F = "22222222-2222-2222-2222-222222222222"; // Freelance, incluido
const S = "33333333-3333-3333-3333-333333333333"; // Sonic Art, aislado
const spaces = [
  { id: P, include_in_total: true },
  { id: F, include_in_total: true },
  { id: S, include_in_total: false },
];

const uid = "user-1";

async function main() {
  eq(await includedSpaceIds(fake(spaces), uid, "total"), [P, F], "total → solo los incluidos (aislado excluido)");
  eq(await includedSpaceIds(fake(spaces), uid, undefined), [P, F], "sin pedido → incluidos");
  eq(await includedSpaceIds(fake(spaces), uid, "no-existe"), [P, F], "uuid ajeno/inválido → incluidos");
  eq(await includedSpaceIds(fake(spaces), uid, S), [S], "espacio aislado pedido explícito → solo ese");
  eq(await includedSpaceIds(fake(spaces), uid, F), [F], "espacio incluido pedido explícito → solo ese");
  eq(await includedSpaceIds(fake([]), uid, "total"), [NONE], "sin espacios → centinela (no rompe .in)");
  eq(await includedSpaceIds(fake([{ id: S, include_in_total: false }]), uid, "total"), [NONE], "todos aislados → centinela");
  console.log(`✓ includedSpaceIds: ${pass} asserts OK`);
}

main();
