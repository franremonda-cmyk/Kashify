import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BalanceCard from "@/components/BalanceCard";
import BudgetProgress from "@/components/BudgetProgress";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balancesRes, profileRes, pendingRes, budgetsRes, spentRes] = await Promise.all([
    supabase.from("balances").select("*").eq("user_id", user.id).order("currency_code"),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("pending_transactions").select("*").eq("user_id", user.id).eq("status", "waiting")
      .gt("expires_at", new Date().toISOString()),
    supabase.from("category_budgets").select("*, categories(name, color, icon)")
      .eq("user_id", user.id),
    supabase.from("transactions")
      .select("category_id, amount, currency_code, type")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
      .in("type", ["expense", "installment-payment"]),
  ]);

  const balances = balancesRes.data ?? [];
  const profile = profileRes.data;
  const pending = pendingRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const monthlySpent = spentRes.data ?? [];

  const primaryCurrency = profile?.primary_currency ?? "ARS";
  const sortedBalances = [
    ...balances.filter((b) => b.currency_code === primaryCurrency),
    ...balances.filter((b) => b.currency_code !== primaryCurrency),
  ];

  const spentByCategory: Record<string, number> = {};
  for (const t of monthlySpent) {
    if (!t.category_id) continue;
    spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + Number(t.amount);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Hola {profile?.display_name?.split(" ")[0] ?? ""} 👋</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <DashboardClient pending={pending} userId={user.id} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>TUS SALDOS</h2>
        <div className="grid grid-cols-2 gap-2">
          {sortedBalances.map((b) => (
            <BalanceCard key={b.id} balance={b} isPrimary={b.currency_code === primaryCurrency} />
          ))}
          {sortedBalances.length === 0 && (
            <div className="col-span-2 glass p-6 text-center">
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">
                Mandá tu primer mensaje por WhatsApp para empezar
              </p>
            </div>
          )}
        </div>
      </section>

      {budgets.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>PRESUPUESTOS DEL MES</h2>
          <div className="flex flex-col gap-2">
            {budgets.map((b: {
              id: string; category_id: string; monthly_limit: number; currency_code: string;
              categories: { name: string; color: string; icon: string } | null;
            }) => (
              <BudgetProgress
                key={b.id}
                categoryName={b.categories?.name ?? ""}
                icon={b.categories?.icon ?? "📦"}
                color={b.categories?.color ?? "#6366f1"}
                spent={spentByCategory[b.category_id] ?? 0}
                limit={b.monthly_limit}
                currencyCode={b.currency_code}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
