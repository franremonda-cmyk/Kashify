import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 50;
  const offset = (page - 1) * limit;
  const category = searchParams.get("category");
  const currency = searchParams.get("currency");
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sort_by  = searchParams.get("sort_by")  ?? "date";
  const sort_dir = searchParams.get("sort_dir") ?? "desc";
  const ascending = sort_dir === "asc";

  const SORTABLE = ["date", "amount", "type", "created_at"] as const;
  type SortCol = (typeof SORTABLE)[number];
  const sortCol: SortCol = SORTABLE.includes(sort_by as SortCol) ? (sort_by as SortCol) : "date";

  let query = supabase
    .from("transactions")
    .select("*, categories(name, color, icon)", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order(sortCol, { ascending })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category_id", category);
  if (currency) query = query.eq("currency_code", currency);
  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("description", `%${search}%`);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, limit });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
