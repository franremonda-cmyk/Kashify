import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { payDebt } from "@/lib/debts/pay";

// Wrapper fino: la lógica vive en @/lib/debts/pay porque el motor de Neo la
// comparte (escribe directo a Supabase, sin pasar por las rutas).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await request.json();
  const result = await payDebt(supabase, user.id, id, amount);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ debt: result.debt, transaction_id: result.transactionId });
}
