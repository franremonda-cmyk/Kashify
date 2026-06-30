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
