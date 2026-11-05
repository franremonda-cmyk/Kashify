import { CURRENCIES } from "@/lib/currencies";

// Cambio de moneda: un solo movimiento `conversion` que resta `amount` en
// `currency_code` y suma `to_amount` en `to_currency_code` (lib/ledger/balances).
// No es gasto ni ingreso: no entra en las métricas del mes ni en los límites.

export interface ConversionInput {
  amount?: number | string | null;
  currency_code?: string | null;
  to_amount?: number | string | null;
  to_currency_code?: string | null;
}

// null = válido. Si no, el motivo en castellano, listo para mostrar.
export function conversionError(c: ConversionInput): string | null {
  const from = Number(c.amount);
  const to = Number(c.to_amount);
  if (!(from > 0) || !(to > 0)) return "Poné cuánto salió y cuánto entró, los dos mayores a 0.";
  if (!c.currency_code || !c.to_currency_code) return "Elegí las dos monedas.";
  if (c.currency_code === c.to_currency_code) return "Un cambio es entre dos monedas distintas.";
  if (!CURRENCIES.includes(c.currency_code) || !CURRENCIES.includes(c.to_currency_code)) return "Esa moneda no está disponible.";
  return null;
}

// Cuánto vale 1 de la moneda que sale, en la que entra (1 EUR = 1,1 USD).
export function exchangeRate(amount: number, toAmount: number): number {
  return Math.round((toAmount / amount) * 1e6) / 1e6;
}

export function conversionDescription(from: string, to: string): string {
  return `Cambio ${from} → ${to}`;
}

export function fmtMoney(currency: string, amount: number | string, maxDecimals = 0): string {
  return `${currency} ${Number(amount).toLocaleString("es-AR", { maximumFractionDigits: maxDecimals })}`;
}

// "1 EUR = 1,1 USD", o "1 USD = 1.450 ARS". Con tasas chicas (ARS → USD) se da
// vuelta para que no diga "1 ARS = 0,0007 USD", que nadie lee así.
export function rateText(amount: number, currency: string, toAmount: number, toCurrency: string): string {
  const r = toAmount / amount;
  const [n, a, b] = r >= 1 ? [r, currency, toCurrency] : [1 / r, toCurrency, currency];
  return `1 ${a} = ${n.toLocaleString("es-AR", { maximumFractionDigits: n >= 100 ? 0 : 2 })} ${b}`;
}

interface TxLike {
  type: string;
  amount: number | string;
  currency_code: string;
  to_amount?: number | string | null;
  to_currency_code?: string | null;
}

// El monto como se lee en una lista. Un cambio muestra lo que entró; lo que
// salió va en la línea de abajo (`conversionFromText`), para que la columna de
// montos no se coma la descripción en un celular.
export function txAmountText(t: TxLike, maxDecimals = 0): string {
  if (t.type === "conversion") return `→ ${fmtMoney(t.to_currency_code ?? "", t.to_amount ?? 0, maxDecimals)}`;
  return `${t.type === "income" ? "+" : "−"}${fmtMoney(t.currency_code, t.amount, maxDecimals)}`;
}

export function conversionFromText(t: TxLike): string {
  return `Salió ${fmtMoney(t.currency_code, t.amount)}`;
}

export function txAmountColor(type: string): string {
  if (type === "income") return "var(--positive)";
  if (type === "installment-payment") return "var(--warning)";
  if (type === "conversion") return "var(--ink)";
  return "var(--negative)";
}
