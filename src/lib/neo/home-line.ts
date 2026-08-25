// Lo que Neo dice en Inicio. Antes eran 4 cards fijas (ahorro, ritmo, cuotas,
// recurrentes) compitiendo con el mismo peso visual; ahora es UNA línea — la
// que hoy importa — y el resto queda a un toque.
//
// Puras funciones sobre datos que la página ya tiene: no consulta nada.
// Voz: referencia/neo-voz.md (cálido, tranquilo, voseo, sin culpa, 1 emoji).

export type HomeTone = "good" | "warn" | "neutral";

export interface HomeLine {
  id: string;
  text: string;
  tone: HomeTone;
  href?: string;
  cta?: string;
}

export interface HomeLineInput {
  income: number;
  expense: number;
  dayOfMonth: number;
  daysInMonth: number;
  sym: string;
  upcoming?: { total: number; count: number } | null;
  recurringTotal?: number;
  recurringCount?: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");

/**
 * Todas las líneas aplicables, ordenadas por lo que más le importa al usuario
 * hoy: primero lo que puede pasarle (proyección, vencimientos), después cómo
 * viene (ahorro), y al final el contexto (ritmo, fijos).
 */
export function buildHomeLines(i: HomeLineInput): HomeLine[] {
  const { income, expense, dayOfMonth, daysInMonth, sym } = i;
  const lines: HomeLine[] = [];

  const midMonth = dayOfMonth >= 5 && dayOfMonth < daysInMonth;
  const projected = midMonth && expense > 0 ? (expense / dayOfMonth) * daysInMonth : null;
  const saved = income - expense;

  // 1. El ritmo proyecta cerrar el mes por encima de lo que entró.
  //    Ratio, no pesos sueltos: con inflación "gastaste más" no dice nada.
  if (projected != null && income > 0 && projected > income) {
    lines.push({
      id: "pace_over_income",
      tone: "warn",
      text: `A este ritmo cerrás el mes en ~${sym} ${fmt(projected)} y este mes entraron ${sym} ${fmt(income)} 👀`,
      href: "/historial", cta: "Ver en qué se va",
    });
  }

  // 2. Cuotas con fecha: es lo único con vencimiento.
  if (i.upcoming && i.upcoming.count > 0) {
    const { count, total } = i.upcoming;
    lines.push({
      id: "upcoming",
      tone: "neutral",
      text: `Este mes te ${count === 1 ? "vence 1 cuota" : `vencen ${count} cuotas`} por ${sym} ${fmt(total)}.`,
      href: "/cuotas", cta: "Ver cuotas",
    });
  }

  // 3. Cómo viene el mes, en ratio.
  if (income > 0 && saved > 0) {
    const rate = Math.round((saved / income) * 100);
    lines.push(rate >= 10
      ? { id: "savings_good", tone: "good", text: `Vas guardando el ${rate}% de lo que entró este mes. Lo tuyo 💚` }
      : { id: "savings_thin", tone: "neutral", text: `Vas guardando el ${rate}% de lo que entró este mes.` });
  } else if (income > 0 && saved < 0) {
    lines.push({
      id: "savings_negative", tone: "warn",
      text: `Este mes salieron ${sym} ${fmt(-saved)} más de los que entraron.`,
      href: "/historial", cta: "Ver el detalle",
    });
  }

  // 4. Contexto: el ritmo, sin alarma (si no lo dijo ya la línea 1).
  if (projected != null && !lines.some((l) => l.id === "pace_over_income")) {
    lines.push({
      id: "pace", tone: "neutral",
      text: `Llevás ${sym} ${fmt(expense)} gastados. A este ritmo cerrás el mes en ~${sym} ${fmt(projected)}.`,
    });
  }

  // 5. Los fijos, como piso del mes.
  if ((i.recurringCount ?? 0) > 0 && (i.recurringTotal ?? 0) > 0) {
    lines.push({
      id: "recurring", tone: "neutral",
      text: `Tus gastos fijos suman ~${sym} ${fmt(i.recurringTotal!)} por mes.`,
    });
  }

  return lines;
}

export const moodForTone: Record<HomeTone, "happy" | "worried" | "curious"> = {
  good: "happy",
  warn: "worried",
  neutral: "curious",
};
