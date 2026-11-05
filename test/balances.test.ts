import assert from "node:assert/strict";
import { computeBalances } from "../src/lib/ledger/balances.ts";

// La historia real de Fran (05/11/2026), que es la razón de la regla:
// arrancó a usar la app con plata encima, le prestó euros a su hermano y
// dólares a su papá. El hermano le devolvió los euros y los cambió a dólares.
// El balance tiene que mostrar la plata que TIENE, nunca en negativo por un
// préstamo que la app nunca vio salir.
const PAPA = "deuda-papa";
const NICO = "deuda-nico";
const loans = new Set([PAPA, NICO]);
const get = (bs: { currency_code: string; amount: number }[], c: string) =>
  bs.find((b) => b.currency_code === c)?.amount ?? 0;

const historia = [
  { type: "expense", amount: 5000, currency_code: "USD", debt_id: PAPA }, // le prestó a papá
  { type: "expense", amount: 1000, currency_code: "EUR", debt_id: NICO }, // le prestó a Nico
  { type: "income",  amount: 1000, currency_code: "EUR", debt_id: NICO }, // Nico devolvió
  { type: "expense", amount: 1000, currency_code: "EUR" },                // el cambio, a mano
  { type: "income",  amount: 1100, currency_code: "USD" },
];
const b = computeBalances(historia, loans);
assert.equal(get(b, "USD"), 1100, "lo prestado a papá no puede restar del balance");
assert.equal(get(b, "EUR"), 0, "los euros se prestaron, volvieron y se cambiaron: cero");

// Sin la lista de préstamos se comporta como antes (callers que no la pasan).
const sinLista = computeBalances(historia);
assert.equal(get(sinLista, "USD"), -3900);

// El cobro sí suma: esa plata entró de verdad.
assert.equal(get(computeBalances([historia[0], historia[2]], loans), "EUR"), 1000);

// Lo que pagás de algo que DEBÉS sí resta (su id no está en la lista de préstamos).
assert.equal(get(computeBalances([{ type: "expense", amount: 300, currency_code: "ARS", debt_id: "deuda-que-debo" }], loans), "ARS"), -300);

// Gastos, cuotas y conversiones, sin tocar.
const resto = computeBalances([
  { type: "income",  amount: 100, currency_code: "ARS" },
  { type: "expense", amount: 30,  currency_code: "ARS" },
  { type: "installment-payment", amount: 20, currency_code: "ARS" },
  { type: "conversion", amount: 50, currency_code: "ARS", to_currency_code: "USD", to_amount: 2 },
], loans);
assert.equal(get(resto, "ARS"), 0);
assert.equal(get(resto, "USD"), 2);

console.log("✓ computeBalances: 7 asserts OK");
