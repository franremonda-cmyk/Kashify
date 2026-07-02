// Self-check de detectRecurring. Correr: npx tsx cloudflare-worker/test/recurring.test.ts
import { detectRecurring, normalizeDesc, type RecTx } from "../../src/lib/recurring.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// normalizeDesc: minúsculas, sin acentos, sin números
ok(normalizeDesc("Netflix 2990") === "netflix", "normaliza y saca números");
ok(normalizeDesc("Almuerzó café") === "almuerzo cafe", "saca acentos");

const txs: RecTx[] = [
  // Netflix: 3 meses, monto estable → recurrente
  { description: "Netflix", amount: 2990, currency_code: "ARS", date: "2026-04-05", type: "expense" },
  { description: "netflix", amount: 2990, currency_code: "ARS", date: "2026-05-05", type: "expense" },
  { description: "Netflix", amount: 3290, currency_code: "ARS", date: "2026-06-05", type: "expense" },
  // Gym: 2 meses, estable → recurrente
  { description: "Gimnasio", amount: 8000, currency_code: "ARS", date: "2026-05-01", type: "expense" },
  { description: "Gimnasio", amount: 8000, currency_code: "ARS", date: "2026-06-01", type: "expense" },
  // Supermercado: 3 meses, monto MUY variable → NO recurrente
  { description: "Super", amount: 5000, currency_code: "ARS", date: "2026-04-10", type: "expense" },
  { description: "Super", amount: 14000, currency_code: "ARS", date: "2026-05-10", type: "expense" },
  { description: "Super", amount: 3000, currency_code: "ARS", date: "2026-06-10", type: "expense" },
  // Café: 1 sola vez → NO recurrente
  { description: "Cafe", amount: 900, currency_code: "ARS", date: "2026-06-11", type: "expense" },
  // Ingreso: ignorado
  { description: "Sueldo", amount: 500000, currency_code: "ARS", date: "2026-05-01", type: "income" },
  { description: "Sueldo", amount: 500000, currency_code: "ARS", date: "2026-06-01", type: "income" },
];

const rec = detectRecurring(txs);
const names = rec.map((r) => normalizeDesc(r.description));
ok(names.includes("netflix"), "Netflix es recurrente");
ok(names.includes("gimnasio"), "Gym es recurrente");
ok(!names.includes("super"), "Super (monto variable) NO es recurrente");
ok(!names.includes("cafe"), "Café (1 vez) NO es recurrente");
ok(!names.includes("sueldo"), "Ingreso ignorado");

// monto representativo = el más reciente (Netflix 3290, no 2990)
const nf = rec.find((r) => normalizeDesc(r.description) === "netflix")!;
ok(nf.amount === 3290 && nf.months === 3, "Netflix usa monto más reciente y cuenta 3 meses");

// orden por monto desc (gym 8000 > netflix 3290)
ok(rec[0].amount >= rec[rec.length - 1].amount, "ordenado por monto desc");

console.log(`✓ detectRecurring: ${pass} asserts OK`);
