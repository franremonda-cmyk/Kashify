import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSpaceId } from "@/lib/spaces";

// Importaciones grandes: dar más tiempo a la función serverless.
export const maxDuration = 60;

interface ImportRow {
  description: string;
  amount: number;
  currency_code: string;
  date: string;
  type: "expense" | "income";
  category_name?: string;
  notes?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows, spaceId }: { rows: ImportRow[]; spaceId?: string } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  // Todas las filas importadas caen en el espacio elegido (o el por defecto).
  const space_id = await resolveSpaceId(supabase, user.id, spaceId);

  // Resolve category names → ids (create if missing)
  const { data: existingCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id);

  const catMap = new Map<string, string>(
    (existingCats ?? []).map(c => [c.name.toLowerCase(), c.id])
  );

  const categoryNamesToCreate = [
    ...new Set(
      rows
        .map(r => r.category_name?.trim())
        .filter((n): n is string => !!n && !catMap.has(n.toLowerCase()))
    ),
  ];

  if (categoryNamesToCreate.length > 0) {
    const { data: created } = await supabase
      .from("categories")
      .insert(categoryNamesToCreate.map(name => ({ name, user_id: user.id })))
      .select("id, name");
    (created ?? []).forEach(c => catMap.set(c.name.toLowerCase(), c.id));
  }

  // Fetch existing transactions for duplicate detection
  const { data: existingTxs } = await supabase
    .from("transactions")
    .select("date, amount, description")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const dupSet = new Set(
    (existingTxs ?? []).map(t => `${t.date}|${t.amount}|${t.description.toLowerCase()}`)
  );

  // Build insert rows
  const toInsert = [];
  const duplicates = [];

  for (const row of rows) {
    const key = `${row.date}|${row.amount}|${row.description.toLowerCase()}`;
    if (dupSet.has(key)) { duplicates.push(row); continue; }

    toInsert.push({
      user_id: user.id,
      space_id,
      description: row.description,
      amount: row.amount,
      currency_code: row.currency_code,
      date: row.date,
      type: row.type,
      category_id: row.category_name ? (catMap.get(row.category_name.toLowerCase()) ?? null) : null,
      notes: row.notes || null,
    });
  }

  let inserted = 0;
  let errors = 0;

  // Bulk insert en lotes de 200 (menos round-trips → más rápido y menos timeout)
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) errors += chunk.length;
    else inserted += chunk.length;
  }

  return NextResponse.json({ inserted, duplicates: duplicates.length, errors });
}
