import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, target_amount, currency_code, target_date, color, icon, current_amount } = body;

  if (!name?.trim() || !target_amount || !currency_code) {
    return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name: name.trim(),
      target_amount,
      current_amount: current_amount ?? 0,
      currency_code,
      target_date: target_date ?? null,
      color: color ?? "#7B61FF",
      icon: icon ?? "piggy-bank",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
