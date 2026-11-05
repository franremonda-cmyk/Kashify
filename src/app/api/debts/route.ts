import { NextResponse } from "next/server";
import { createDebt, fromBalanceIds } from "@/lib/debts/create";
import { createClient } from "@/lib/supabase/server";
import { resolveSpaceId, includedSpaceIds } from "@/lib/spaces";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const space = new URL(request.url).searchParams.get("space");

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .in("space_id", await includedSpaceIds(supabase, user.id, space))
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // from_balance: si la deuda bajó tu balance (tiene vivo su egreso de origen).
  // Lo necesita el formulario de Editar para mostrar «¿salió de tu plata?».
  const rows = (data ?? []) as { id: string; direction: string }[];
  const on = await fromBalanceIds(supabase, user.id, rows.filter((d) => d.direction === "me_deben").map((d) => d.id));
  return NextResponse.json(rows.map((d) => ({ ...d, from_balance: on.has(d.id) })));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { direction, counterparty, description, total_amount, currency_code, due_date } = body;

  if (direction !== "debo" && direction !== "me_deben") {
    return NextResponse.json({ error: "direction inválida" }, { status: 400 });
  }
  if (!counterparty?.trim() || !(total_amount > 0) || !currency_code) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const space_id = await resolveSpaceId(supabase, user.id, body.space_id);

  const { debt: data, error } = await createDebt(supabase, user.id, {
    spaceId: space_id, direction, counterparty: counterparty.trim(),
    description: description?.trim(), amount: total_amount,
    currency: currency_code, dueDate: due_date,
    // «¿Salió de tu plata ahora?»: sí salvo que digan explícitamente que no.
    fromBalance: body.from_balance !== false,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
