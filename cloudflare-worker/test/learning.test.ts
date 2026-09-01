// Self-check del aprendizaje de Neo (Fase 1). No toca prod ni red.
// Correr: npx tsx cloudflare-worker/test/learning.test.ts
import { extractKeyword, promoteGlobalRules } from "../../src/lib/neo/learning.ts";
import { detectIntent } from "../../src/lib/neo/engine/intent.ts";
import { categoryForText, KEYWORD_TO_CATEGORY, CATEGORY_FALLBACK } from "../../src/lib/neo-keywords.ts";

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

// ── monto con símbolo $ pegado (la forma AR más común) ──
const amt = (i: ReturnType<typeof detectIntent>) => (i as { ctx?: { amount?: number } }).ctx?.amount;
const g1 = detectIntent("gaste $4000 gaseosa");
ok(g1.type === "flow" && amt(g1) === 4000, "‘gaste $4000 gaseosa’ → monto 4000 (no lo mete en la descripción)");
const g2 = detectIntent("compre cocacola $4000");
ok(g2.type === "flow" && amt(g2) === 4000, "‘compre cocacola $4000’ → monto 4000");
const g3 = detectIntent("gaste $4.500 en nafta");
ok(g3.type === "flow" && amt(g3) === 4500, "‘$4.500’ con miles → 4500");
const g4 = detectIntent("pague u$s500 hosting");
ok(g4.type === "flow" && amt(g4) === 500, "‘u$s500’ → monto 500 (moneda antes del número)");
const g5 = detectIntent("ingreso $45000");
ok(g5.type === "flow" && (g5 as { ctx?: { flow?: string } }).ctx?.flow === "income" && amt(g5) === 45000, "‘ingreso $45000’ → ingreso 45000");

// ── préstamos: "presté/fié" → deuda me_deben que además baja el neto (originExpense) ──
type DebtCtx = { ctx?: { flow?: string; direction?: string; originExpense?: boolean; description?: string } };
const p1 = detectIntent("presté 10000 a Juan");
ok(p1.type === "flow" && (p1 as DebtCtx).ctx?.flow === "debt" && (p1 as DebtCtx).ctx?.direction === "me_deben" && (p1 as DebtCtx).ctx?.originExpense === true, "‘presté 10000 a Juan’ → deuda me_deben con originExpense");
const p2 = detectIntent("le presté 5000 a Ana para la nafta");
ok(p2.type === "flow" && (p2 as DebtCtx).ctx?.description === "la nafta", "‘...para la nafta’ → motivo como descripción");
const p3 = detectIntent("fié 2000 a la vecina");
ok(p3.type === "flow" && (p3 as DebtCtx).ctx?.originExpense === true, "‘fié 2000 a la vecina’ → también baja el neto");
const p4 = detectIntent("le presté a Juan");
ok(p4.type === "flow" && (p4 as DebtCtx).ctx?.flow === "debt" && amt(p4) === undefined, "‘le presté a Juan’ sin monto → flujo pregunta cuánto");

// ── repago: dirección explícita según el verbo ──
type PayIntent = { type: string; direction?: string };
const pd1 = detectIntent("juan me devolvió 3000") as PayIntent;
ok(pd1.type === "pay_debt" && pd1.direction === "me_deben", "‘juan me devolvió 3000’ → pay_debt me_deben");
const pd2 = detectIntent("le pagué 3000 a juan") as PayIntent;
ok(pd2.type === "pay_debt" && pd2.direction === "debo", "‘le pagué 3000 a juan’ → pay_debt debo");
const pd3 = detectIntent("le devolví 3000 a juan") as PayIntent;
ok(pd3.type === "pay_debt" && pd3.direction === "debo", "‘le devolví 3000 a juan’ → pay_debt debo");
// regresión: "debo" sigue sin originExpense
const rd = detectIntent("debo 10000 a juan");
ok(rd.type === "flow" && !(rd as DebtCtx).ctx?.originExpense, "‘debo 10000 a juan’ NO prende originExpense");

// ── deudas en moneda extranjera ──
type CurCtx = { ctx?: { currency?: string; direction?: string; flow?: string } };
const c1 = detectIntent("nico me debe 1800 usd") as CurCtx & { type: string };
ok(c1.type === "flow" && c1.ctx?.flow === "debt" && c1.ctx?.direction === "me_deben" && c1.ctx?.currency === "USD", "‘nico me debe 1800 usd’ → deuda me_deben en USD");
const c2 = detectIntent("presté 100 eur a ana") as CurCtx;
ok(c2.ctx?.currency === "EUR" && (c2 as DebtCtx).ctx?.originExpense === true, "‘presté 100 eur a ana’ → EUR + originExpense");
const c3 = detectIntent("debo 500 usd a juan") as CurCtx;
ok(c3.ctx?.currency === "USD" && c3.ctx?.direction === "debo", "‘debo 500 usd a juan’ → debo en USD");
const c4 = detectIntent("nico debe 1800") as CurCtx & { type: string };
ok(c4.type === "flow" && c4.ctx?.flow === "debt" && c4.ctx?.direction === "me_deben", "‘nico debe 1800’ (sin ‘me’) → deuda me_deben");
const c5 = detectIntent("juan me devolvió 50 usd") as { type: string; direction?: string; currency?: string };
ok(c5.type === "pay_debt" && c5.direction === "me_deben" && c5.currency === "USD", "‘juan me devolvió 50 usd’ → pay_debt me_deben USD");
// regresión: sin mención de moneda → ctx.currency undefined (usa la principal)
const c6 = detectIntent("nico me debe 1800") as CurCtx;
ok(c6.ctx?.currency === undefined, "sin moneda explícita → ctx.currency undefined");

// ── diccionario global argentino + fallback de categorías ──
ok(categoryForText("quilmes") === "Comida", "quilmes → Comida");
ok(categoryForText("fravega") === "Hogar", "fravega → Hogar");
ok(categoryForText("uba") === "Educación", "uba → Educación");
ok(categoryForText("royal canin") === "Mascotas", "‘royal canin’ (bigrama) → Mascotas");
ok(categoryForText("gaste 5000 en fravega") === "Hogar", "reconoce la marca dentro de una frase");
// Invariante: toda categoría del diccionario que NO es default debe tener fallback
// a una categoría real, para que por WhatsApp nunca quede sin categorizar.
const DEFAULTS = new Set(["Comida","Transporte","Servicios","Ocio","Salud","Ahorro","Deudas","Ingresos","Otros"]);
const usadas = new Set(Object.values(KEYWORD_TO_CATEGORY));
for (const cat of usadas) {
  if (DEFAULTS.has(cat)) continue;
  ok(!!CATEGORY_FALLBACK[cat], `categoría rica "${cat}" tiene fallback`);
  ok(DEFAULTS.has(CATEGORY_FALLBACK[cat]), `fallback de "${cat}" (${CATEGORY_FALLBACK[cat]}) es una categoría real`);
}
// Invariante: toda clave debe estar ya normalizada (sin tildes/ñ), porque el
// lookup normaliza el texto del usuario — una clave con diacríticos jamás matchea.
// (Cicatriz 2026-07-09: pañales/cabaña/cumpleaños eran claves muertas.)
const normKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
for (const k of Object.keys(KEYWORD_TO_CATEGORY)) {
  ok(k === normKey(k), `clave "${k}" está normalizada (sin tildes/ñ)`);
}
ok(categoryForText("compre pañales") === "Salud", "pañales (con ñ del usuario) → Salud");
ok(categoryForText("gaste en la cabaña") === "Viajes", "cabaña (con ñ del usuario) → Viajes");
// Plural que no está cargado a mano cae al singular del diccionario.
ok(categoryForText("pastas la carmencita") === "Comida", "‘pastas’ (plural) → Comida vía singular");
ok(categoryForText("merienda") === "Comida", "merienda → Comida");
ok(categoryForText("gas") === "Hogar", "‘gas’ no se recorta a ‘ga’ (match exacto gana)");

// ── monto típico (Fase 3): keyword conocida sin monto → ask_amount ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lk: any = [{ keyword: "netflix", type: "expense", currency_code: "ARS", category: "Ocio", last_amount: 2000, weight: 100 }];
const ia = detectIntent("netflix", lk);
ok(ia.type === "ask_amount" && (ia as { lastAmount: number }).lastAmount === 2000, "keyword conocida sin monto → ask_amount ($2000)");
const ib = detectIntent("netflix 3500", lk);
ok(ib.type === "flow" && (ib as { ctx: { amount?: number } }).ctx.amount === 3500, "keyword con monto → registra directo");

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
