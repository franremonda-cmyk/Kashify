import assert from "node:assert/strict";
import { computeBalances } from "../src/lib/ledger/balances.ts";
import {
  conversionDescription, conversionError, exchangeRate, rateText, txAmountColor, txAmountText,
} from "../src/lib/ledger/conversion.ts";

// Válido: lo que hizo Fran el 05/11/2026 con los euros de su hermano.
assert.equal(conversionError({ amount: 1000, currency_code: "EUR", to_amount: 1100, to_currency_code: "USD" }), null);
// Llega como texto desde el formulario: también vale.
assert.equal(conversionError({ amount: "1000", currency_code: "EUR", to_amount: "1100", to_currency_code: "USD" }), null);

// Inválidos: cada uno con su motivo.
assert.match(conversionError({ amount: 0, currency_code: "EUR", to_amount: 1100, to_currency_code: "USD" })!, /mayores a 0/);
assert.match(conversionError({ amount: 1000, currency_code: "EUR", to_amount: "", to_currency_code: "USD" })!, /mayores a 0/);
assert.match(conversionError({ amount: "abc", currency_code: "EUR", to_amount: 5, to_currency_code: "USD" })!, /mayores a 0/);
assert.match(conversionError({ amount: 1000, currency_code: "USD", to_amount: 1000, to_currency_code: "USD" })!, /distintas/);
assert.match(conversionError({ amount: 1000, currency_code: "EUR", to_amount: 1100, to_currency_code: null })!, /dos monedas/);
// PYG no está en el catálogo de la base: la clave foránea lo rechazaría.
assert.match(conversionError({ amount: 1000, currency_code: "PYG", to_amount: 1, to_currency_code: "USD" })!, /no está disponible/);

assert.equal(exchangeRate(1000, 1100), 1.1);
assert.equal(exchangeRate(1450000, 1000), 0.00069);
assert.equal(conversionDescription("EUR", "USD"), "Cambio EUR → USD");

// La tasa se lee al derecho: nunca "1 ARS = 0,0007 USD".
assert.equal(rateText(1000, "EUR", 1100, "USD"), "1 EUR = 1,1 USD");
assert.equal(rateText(1450000, "ARS", 1000, "USD"), "1 USD = 1.450 ARS");

// Cómo se ve en la lista.
const cambio = { type: "conversion", amount: 1000, currency_code: "EUR", to_amount: 1100, to_currency_code: "USD" };
assert.equal(txAmountText(cambio), "→ USD 1.100");
assert.equal(txAmountText({ type: "income", amount: 500, currency_code: "ARS" }), "+ARS 500");
assert.equal(txAmountText({ type: "expense", amount: 500, currency_code: "ARS" }), "−ARS 500");
assert.equal(txAmountColor("conversion"), "var(--ink)"); // ni gasto (rojo) ni ingreso (verde)

// Y el balance lo toma bien: resta en una moneda, suma en la otra, en un solo movimiento.
const b = computeBalances([{ type: "income", amount: 1000, currency_code: "EUR" }, cambio]);
assert.equal(b.find((x) => x.currency_code === "EUR")?.amount, 0);
assert.equal(b.find((x) => x.currency_code === "USD")?.amount, 1100);

console.log("✓ cambio de moneda: 20 asserts OK");
