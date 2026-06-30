// Cookie que guarda el espacio activo ("total" o un uuid). La escribe el cliente
// (SpaceContext) y la leen los server components para scopear sus queries.
export const SPACE_COOKIE = "kashify-space";

// uuid que no matchea nada — evita un `.in("space_id", [])` (Postgres lo rechaza).
const NONE = "00000000-0000-0000-0000-000000000000";

// Devuelve los space_id a incluir en las lecturas:
//  - un uuid concreto y válido → solo ese espacio
//  - "total" (o inválido) → los espacios con include_in_total
export function scopeForSpace(spaces: { id: string; include_in_total: boolean }[], active: string): string[] {
  if (active && active !== "total" && spaces.some((s) => s.id === active)) return [active];
  const included = spaces.filter((s) => s.include_in_total).map((s) => s.id);
  return included.length ? included : [NONE];
}
