import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("installment_payments")
    .delete()
    .eq("plan_id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  await supabase
    .from("installment_plans")
    .update({ status: "paid" })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
