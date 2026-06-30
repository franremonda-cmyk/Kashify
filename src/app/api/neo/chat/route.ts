import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runNeo } from "@/lib/neo/engine";
import type { NeoState } from "@/lib/neo/engine/types";

// Adaptador web del motor unificado de Neo. El motor vive en src/lib/neo/engine
// y lo comparte WhatsApp (ver src/app/api/process-webhook/route.ts).
// El estado de conversación viaja por el cliente (body.pendingContext).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message: string = body.message ?? "";
  const state: NeoState | null = body.pendingContext ?? null;
  // Espacio activo de la web. "total" o vacío = sin espacio concreto → Neo pregunta.
  const rawSpace: string | undefined = body.spaceId;
  const activeSpaceId = rawSpace && rawSpace !== "total" ? rawSpace : undefined;

  const reply = await runNeo({ supabase, userId: user.id, message, channel: "web", state, activeSpaceId });

  // Mapear el resultado canónico al contrato JSON que espera NeoChat.tsx:
  //   text, pending (estado a reenviar), options, action (primer efecto de UI).
  return NextResponse.json({
    text: reply.text,
    ...(reply.state !== undefined ? { pending: reply.state } : {}),
    ...(reply.options ? { options: reply.options } : {}),
    ...(reply.effects?.[0] ? { action: reply.effects[0] } : {}),
  });
}
