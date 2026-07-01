import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSpaceId, includedSpaceIds } from "@/lib/spaces";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const space = new URL(request.url).searchParams.get("space");

  let query = supabase
    .from("category_budgets")
    .select("*, categories(name, color, icon)")
    .eq("user_id", user.id);
  query = query.in("space_id", await includedSpaceIds(supabase, user.id, space));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const space_id = await resolveSpaceId(supabase, user.id, body.space_id);
  const { data, error } = await supabase
    .from("category_budgets")
    .upsert({ ...body, user_id: user.id, space_id }, { onConflict: "user_id,space_id,category_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
