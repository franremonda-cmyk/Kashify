import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteSpaceGuarded } from "@/lib/spaces";

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

  // Las guardas (no borrar el default, ni el último, ni uno con movimientos)
  // viven en deleteSpaceGuarded porque el motor de Neo también borra espacios.
  const result = await deleteSpaceGuarded(supabase, user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(null, { status: 204 });
}
