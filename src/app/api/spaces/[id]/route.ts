import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "primary_currency", "include_in_total", "color", "icon", "is_default"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (typeof patch.name === "string") patch.name = patch.name.trim();

  // Un solo espacio default por usuario: al marcar este, desmarcar el anterior.
  if (patch.is_default === true) {
    await supabase.from("spaces").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("spaces").update(patch).eq("id", id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Guardas: el FK es ON DELETE CASCADE → borrar un espacio borraría sus
  // movimientos/metas/presupuestos. No permitir borrar el default, el último,
  // ni uno con movimientos.
  const { data: space } = await supabase.from("spaces").select("is_default").eq("id", id).eq("user_id", user.id).single();
  if (!space) return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (space.is_default) return NextResponse.json({ error: "No podés borrar el espacio por defecto. Marcá otro como default primero." }, { status: 400 });

  const { count: total } = await supabase.from("spaces").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((total ?? 0) <= 1) return NextResponse.json({ error: "Tenés que conservar al menos un espacio." }, { status: 400 });

  const { count: txCount } = await supabase.from("transactions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("space_id", id).is("deleted_at", null);
  if ((txCount ?? 0) > 0) return NextResponse.json({ error: "Ese espacio tiene movimientos. Movélos o borralos antes de eliminarlo." }, { status: 400 });

  const { error } = await supabase.from("spaces").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
