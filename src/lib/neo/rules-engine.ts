// Inferencia de moneda a partir de texto libre (0 tokens). La usa el fallback
// de Haiku para completar la moneda cuando el modelo no la devuelve.
export function inferCurrency(text: string): string {
  const lower = text.toLowerCase();
  if (/\busd\b|dolar|dólar|\$u/.test(lower)) return "USD";
  if (/\beur\b|euro/.test(lower)) return "EUR";
  if (/\bchf\b|franco/.test(lower)) return "CHF";
  if (/\bbrl\b|real\b/.test(lower)) return "BRL";
  return "ARS";
}
