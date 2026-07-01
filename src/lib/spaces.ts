import type { SupabaseClient } from "@supabase/supabase-js";

// Resuelve el espacio destino para una escritura: el pedido (si pertenece al
// usuario) o, si falta/es inválido/"total", el espacio por defecto del usuario.
// Devuelve null solo si el usuario no tiene ningún espacio (no debería pasar
// post-migración 010, que crea uno "Personal" por perfil).
export async function resolveSpaceId(
  supabase: SupabaseClient,
  userId: string,
  requested?: string | null
): Promise<string | null> {
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, is_default, created_at")
    .eq("user_id", userId)
    .order("created_at");
  if (!spaces?.length) return null;
  if (requested && requested !== "total" && spaces.some((s) => s.id === requested)) return requested;
  return (spaces.find((s) => s.is_default) ?? spaces[0]).id;
}

// uuid que no matchea nada — evita un `.in("space_id", [])` (Postgres lo rechaza).
const NONE = "00000000-0000-0000-0000-000000000000";

// Espejo server-side de scopeForSpace: los space_id que una LECTURA debe incluir.
//  - un uuid válido del usuario → [ese] (aunque sea aislado, si se pide explícito)
//  - "total"/ausente/inválido → los espacios con include_in_total
// Sin esto, `space=total` no filtraba nada y los espacios aislados se colaban en el Total.
export async function includedSpaceIds(
  supabase: SupabaseClient,
  userId: string,
  requested?: string | null
): Promise<string[]> {
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, include_in_total")
    .eq("user_id", userId);
  if (!spaces?.length) return [NONE];
  if (requested && requested !== "total" && spaces.some((s) => s.id === requested)) return [requested];
  const included = spaces.filter((s) => s.include_in_total).map((s) => s.id);
  return included.length ? included : [NONE];
}

// ¿El espacio pertenece al usuario? (para validar reasignaciones).
export async function spaceBelongsTo(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("spaces")
    .select("id")
    .eq("user_id", userId)
    .eq("id", spaceId)
    .maybeSingle();
  return !!data;
}
