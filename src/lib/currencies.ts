// Las monedas que acepta la base: el catálogo `currencies` de la migración 001.
// transactions, debts, metas y perfiles las referencian con clave foránea, así
// que una moneda fuera de esta lista hace fallar el guardado. Todos los
// selectores salen de acá (antes había nueve listas y tres ofrecían PYG, PEN o
// BOB, que la base rechaza).
export const CURRENCIES: string[] = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "MXN", "COP", "GBP"];
