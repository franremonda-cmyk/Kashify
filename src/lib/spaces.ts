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

// Borra un espacio aplicando las guardas. El FK es ON DELETE CASCADE: borrar un
// espacio se llevaría puestos sus movimientos/metas/presupuestos, así que esto
// es lo único que puede borrar espacios (lo usan la API y el motor de Neo).
export async function deleteSpaceGuarded(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: space } = await supabase.from("spaces").select("is_default").eq("id", spaceId).eq("user_id", userId).single();
  if (!space) return { ok: false, error: "No existe", status: 404 };
  if (space.is_default) return { ok: false, error: "No podés borrar el espacio por defecto. Marcá otro como default primero.", status: 400 };

  const { count: total } = await supabase.from("spaces").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((total ?? 0) <= 1) return { ok: false, error: "Tenés que conservar al menos un espacio.", status: 400 };

  const { count: txCount } = await supabase.from("transactions").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("space_id", spaceId).is("deleted_at", null);
  if ((txCount ?? 0) > 0) return { ok: false, error: "Ese espacio tiene movimientos. Movélos o borralos antes de eliminarlo.", status: 400 };

  const { error } = await supabase.from("spaces").delete().eq("id", spaceId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
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
