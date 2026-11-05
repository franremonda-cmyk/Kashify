import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDebt, setFromBalance } from "@/lib/debts/create";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["counterparty", "description", "total_amount", "currency_code", "due_date"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  const toggle = typeof body.from_balance === "boolean";
  if (Object.keys(patch).length === 0 && !toggle) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const q = supabase.from("debts");
  const { data, error } = Object.keys(patch).length
    ? await q.update(patch).eq("id", id).eq("user_id", user.id).select().single()
    : await q.select().eq("id", id).eq("user_id", user.id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "Me deben" tiene un egreso de origen (createDebt): si cambia el monto o la
  // moneda, el egreso acompaña. Sin la migración 015 no hay debt_id → no-op.
  if (data?.direction === "me_deben" && ("total_amount" in patch || "currency_code" in patch)) {
    await supabase.from("transactions")
      .update({ amount: data.total_amount, currency_code: data.currency_code })
      .eq("debt_id", id).eq("user_id", user.id).eq("type", "expense");
  }
  // «¿Salió de tu plata?» cambiado al editar: prende o apaga el egreso de origen.
  if (toggle && data?.direction === "me_deben") {
    await setFromBalance(supabase, user.id, data, body.from_balance);
  }
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { ok, orphans } = await deleteDebt(supabase, user.id, id);
  if (!ok) return NextResponse.json({ error: "No se pudo borrar" }, { status: 500 });
  return NextResponse.json({ ok: true, orphans });
}
