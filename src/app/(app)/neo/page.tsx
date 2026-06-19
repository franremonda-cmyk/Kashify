import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NeoChat from "@/components/NeoChat";
import type { PendingTransaction } from "@/types";

export default async function NeoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [pendingRes, notifRes, phonesRes] = await Promise.all([
    supabase
      .from("pending_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "waiting")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("neo_notifications")
      .select("id, message, type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("user_phones")
      .select("phone_number, verified")
      .eq("user_id", user.id),
  ]);

  const pending = (pendingRes.data ?? []) as PendingTransaction[];
  const notifications = notifRes.data ?? [];
  const phones = phonesRes.data ?? [];
  const hasPhone = phones.length > 0;
  const phoneNumber = phones[0]?.phone_number;

  return (
    <NeoChat
      notifications={notifications}
      pending={pending}
      hasPhone={hasPhone}
      phoneNumber={phoneNumber}
    />
  );
}
