import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Aporte incremental: { add: number } suma al monto actual
  const patch: Record<string, unknown> = {};
  let justReached: string | null = null;
  if (typeof body.add === "number") {
    const { data: current } = await supabase
      .from("savings_goals")
      .select("current_amount, target_amount, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    const next = Math.max(0, Number(current.current_amount) + body.add);
    patch.current_amount = next;
    const wasReached = Number(current.current_amount) >= Number(current.target_amount);
    const nowReached = next >= Number(current.target_amount);
    patch.status = nowReached ? "reached" : "active";
    if (nowReached && !wasReached) justReached = current.name as string; // recién ahora la cumplió
  } else {
    for (const k of ["name", "target_amount", "current_amount", "currency_code", "target_date", "color", "icon", "status"]) {
      if (k in body) patch[k] = body[k];
    }
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Meta recién cumplida → Neo festeja (aviso in-app; la mascota lo levanta con
  // mood celebrating). Best-effort: no rompe el aporte si falla.
  if (justReached) {
    await supabase.from("neo_notifications").insert({
      user_id: user.id,
      message: `🎉 ¡Cumpliste tu meta "${justReached}"! Un golazo. ¿Vamos por la próxima?`,
      type: "goal_reached",
    }).then(undefined, () => {});
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
