import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { typesForFamily, type NotifFamily } from "@/lib/neo/insights";

const FAR_FUTURE = "9999-12-31T00:00:00Z"; // silenciado "para siempre" (reversible)

// GET → familias que el usuario tiene silenciadas/pausadas (muted_until futuro).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("neo_notification_prefs")
    .select("family, muted_until")
    .eq("user_id", user.id);

  const now = Date.now();
  const muted = (data ?? [])
    .filter((p) => p.muted_until && Date.parse(p.muted_until) > now)
    .map((p) => p.family);
  return NextResponse.json({ muted });
}

// POST { family, action: "silence" | "enable" }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { family, action } = await request.json() as { family: NotifFamily; action: "silence" | "enable" };
  if (!family) return NextResponse.json({ error: "family requerido" }, { status: 400 });

  if (action === "enable") {
    await supabase.from("neo_notification_prefs").delete().eq("user_id", user.id).eq("family", family);
    return NextResponse.json({ ok: true });
  }

  // Silenciar: marcar la familia y sacar del feed los avisos ya escritos de esa familia.
  await supabase.from("neo_notification_prefs").upsert(
    { user_id: user.id, family, muted_until: FAR_FUTURE, updated_at: new Date().toISOString() },
    { onConflict: "user_id,family" },
  );
  await supabase.from("neo_notifications").delete().eq("user_id", user.id).in("type", typesForFamily(family));
  return NextResponse.json({ ok: true });
}
