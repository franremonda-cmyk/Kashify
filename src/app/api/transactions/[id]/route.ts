import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spaceBelongsTo } from "@/lib/spaces";
import { learnFromCorrection } from "@/lib/neo/learning";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["description", "amount", "currency_code", "date", "category_id", "notes", "type"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  // Reasignar a otro espacio: solo si el espacio pertenece al usuario.
  if (body.space_id && await spaceBelongsTo(supabase, user.id, body.space_id)) {
    patch.space_id = body.space_id;
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aprender de la corrección: si el usuario cambió la categoría (o el tipo) de un
  // gasto/ingreso, es ground truth → enseñar/sobrescribir la regla (best-effort).
  if (("category_id" in body || "type" in body) && (data.type === "expense" || data.type === "income")) {
    await learnFromCorrection(supabase, user.id, data.description ?? "", data.type, data.currency_code, data.category_id ?? null);
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
