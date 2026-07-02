import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { promoteGlobalRules } from "@/lib/neo/learning";

// Cron: promueve a la capa global las reglas que ≥N usuarios distintos enseñaron.
// Umbral 2 durante el beta (pocos usuarios) — subir cuando crezca la base.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createServiceClient();
  const promoted = await promoteGlobalRules(supabase, 2);
  return NextResponse.json({ promoted });
}
