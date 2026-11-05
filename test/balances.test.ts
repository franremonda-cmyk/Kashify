import assert from "node:assert/strict";
import { computeBalances } from "../src/lib/ledger/balances.ts";

// El balance es la plata en la mano (regla de Fran, 05/11/2026): cuenta cada
// movimiento real, incluido el egreso de un préstamo. Una deuda vieja no tiene
// egreso (se anota con «no, ya me la debía»), así que no resta.
const get = (bs: { currency_code: string; amount: number }[], c: string) =>
  bs.find((b) => b.currency_code === c)?.amount ?? 0;

// La historia real de Fran:
// - Su papá le debía USD de antes de usar la app → deuda SIN egreso (no aparece acá).
// - Nico le debía EUR de antes → deuda sin egreso; le devolvió 1.000 EUR (cobro).
// - Cambió esos euros a dólares.
// - Hoy le dio 1.000 USD más a su papá → egreso de préstamo (salió de su mano).
const historia = [
  { type: "income",  amount: 6981, currency_code: "USD" },                // lo que tenía en dólares
  { type: "income",  amount: 1000, currency_code: "EUR", debt_id: "nico" }, // Nico devolvió
  { type: "conversion", amount: 1000, currency_code: "EUR", to_amount: 1100, to_currency_code: "USD" },
  { type: "expense", amount: 1100, currency_code: "USD" },                // (para que la cuenta dé 6.981 antes del préstamo)
  { type: "expense", amount: 1000, currency_code: "USD", debt_id: "papa-hoy" }, // le dio 1.000 a papá hoy
];
const b = computeBalances(historia);
assert.equal(get(b, "USD"), 5981, "lo que le dio hoy a su papá baja el balance");
assert.equal(get(b, "EUR"), 0, "los euros de Nico entraron y se cambiaron");

// Un cobro suma: esa plata entró de verdad.
assert.equal(get(computeBalances([{ type: "income", amount: 300, currency_code: "ARS", debt_id: "x" }]), "ARS"), 300);

// Gastos, cuotas y cambios de moneda.
const resto = computeBalances([
  { type: "income",  amount: 100, currency_code: "ARS" },
  { type: "expense", amount: 30,  currency_code: "ARS" },
  { type: "installment-payment", amount: 20, currency_code: "ARS" },
  { type: "conversion", amount: 50, currency_code: "ARS", to_currency_code: "USD", to_amount: 2 },
]);
assert.equal(get(resto, "ARS"), 0);
assert.equal(get(resto, "USD"), 2);

console.log("✓ computeBalances: 5 asserts OK");
