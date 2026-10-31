import { createHash, timingSafeEqual } from "node:crypto";
import { clearState, loadState, saveState } from "@/lib/neo/conversation-state";
import { runNeo } from "@/lib/neo/engine";
import type { NeoSupabase } from "@/lib/neo/engine/types";

const hash = (s: string) => createHash("sha256").update(s).digest();

// Sin token configurado no entra nadie. Se comparan los hashes porque
// timingSafeEqual exige dos buffers del mismo largo.
export function tokenValido(header: string | null, token: string | undefined): boolean {
  if (!token || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(hash(header.slice("Bearer ".length)), hash(token));
}

// Canal "whatsapp" a propósito: el Atajo tampoco tiene botones ni formularios, así
// que las confirmaciones van por texto y el estado queda en el servidor. Comparte
// ese estado con WhatsApp: una pregunta hecha por un canal se contesta por el otro.
export async function responderAtajo(supabase: NeoSupabase, userId: string, message: string): Promise<string> {
  const state = await loadState(supabase, userId);
  const reply = await runNeo({ supabase, userId, message, channel: "whatsapp", state });

  if (reply.state) await saveState(supabase, userId, reply.state);
  else await clearState(supabase, userId);

  return reply.text.replace(/[*_]/g, "");
}
