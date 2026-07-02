// Detección de gastos recurrentes / suscripciones.
// Heurística: mismo "comercio" (descripción normalizada) que aparece en ≥2 meses
// distintos con monto estable (±25%). Monto representativo = ocurrencia más reciente.

export interface RecTx {
  description: string;
  amount: number | string;
  currency_code: string;
  date: string;   // "YYYY-MM-DD"
  type: string;
}

export interface RecurringItem {
  description: string;
  amount: number;
  currency_code: string;
  months: number;   // en cuántos meses distintos apareció
}

// minúsculas, sin acentos, sin dígitos ni puntuación, espacios colapsados.
export function normalizeDesc(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[0-9]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectRecurring(txs: RecTx[]): RecurringItem[] {
  const groups: Record<string, { desc: string; currency: string; occ: { month: string; amount: number; date: string }[] }> = {};
  for (const t of txs) {
    if (t.type !== "expense" && t.type !== "installment-payment") continue;
    const norm = normalizeDesc(t.description);
    if (!norm) continue;
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = t.currency_code + "|" + norm;
    const month = String(t.date).slice(0, 7);
    (groups[key] ??= { desc: (t.description || "").trim(), currency: t.currency_code, occ: [] })
      .occ.push({ month, amount, date: String(t.date) });
  }

  const out: RecurringItem[] = [];
  for (const g of Object.values(groups)) {
    const months = new Set(g.occ.map((o) => o.month));
    if (months.size < 2) continue;                          // debe repetirse en ≥2 meses
    const amts = g.occ.map((o) => o.amount);
    const min = Math.min(...amts), max = Math.max(...amts);
    if (min <= 0 || max / min > 1.25) continue;             // monto estable (±25%)
    const latest = g.occ.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    out.push({ description: g.desc, amount: latest.amount, currency_code: g.currency, months: months.size });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
