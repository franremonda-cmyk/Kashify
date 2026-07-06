import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSpaceId, includedSpaceIds } from "@/lib/spaces";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  // limit configurable (antes estaba fijo en 50 e ignoraba el param: la tendencia
  // de 12 meses y los breakdowns pedían 1000/100 y recibían 50 en silencio).
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50") || 50, 1), 1000);
  const offset = (page - 1) * limit;
  const category = searchParams.get("category");
  const categories = searchParams.get("categories"); // CSV para multi-filtro
  const currency = searchParams.get("currency");
  const space = searchParams.get("space");
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
  if (categories) {
    const ids = categories.split(",").map(c => c.trim()).filter(Boolean);
    if (ids.length) query = query.in("category_id", ids);
  }
  if (currency) query = query.eq("currency_code", currency);
  query = query.in("space_id", await includedSpaceIds(supabase, user.id, space));
  if (type) {
    const types = type.split(",").map(t => t.trim()).filter(Boolean);
    if (types.length === 1) query = query.eq("type", types[0]);
    else if (types.length > 1) query = query.in("type", types);
  }
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
  const space_id = await resolveSpaceId(supabase, user.id, body.space_id);
  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: user.id, space_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
