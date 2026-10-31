import type { NeoState, NeoSupabase } from "@/lib/neo/engine/types";

// Estado de conversación en el servidor, para los canales sin cliente que lo
// recuerde: WhatsApp y el Atajo de iPhone. Vence a los 15 minutos.
export async function loadState(supabase: NeoSupabase, userId: string): Promise<NeoState | null> {
  const { data } = await supabase
    .from("neo_conversation_state")
    .select("state, expires_at")
    .eq("user_id", userId)
    .single();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await clearState(supabase, userId);
    return null;
  }
  return data.state as NeoState;
}

export async function saveState(supabase: NeoSupabase, userId: string, state: NeoState): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase
    .from("neo_conversation_state")
    .upsert({ user_id: userId, state, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

export async function clearState(supabase: NeoSupabase, userId: string): Promise<void> {
  await supabase.from("neo_conversation_state").delete().eq("user_id", userId);
}
