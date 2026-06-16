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

  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
          {today}
        </p>
      </div>

      <DashboardClient pending={pending} userId={user.id} />

      <section className="flex flex-col gap-3">
        <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>Saldos</p>
        <div className="grid grid-cols-2 gap-2">
          {sortedBalances.map((b) => (
            <BalanceCard key={b.id} balance={b} isPrimary={b.currency_code === primaryCurrency} />
          ))}
          {sortedBalances.length === 0 && (
            <div className="col-span-2 glass p-6 text-center">
              <p style={{ color: "var(--ink-muted)" }} className="text-sm">
                Mandá tu primer mensaje por WhatsApp a Neo para empezar
              </p>
            </div>
          )}
        </div>
      </section>

      {budgets.length > 0 && (
        <section className="flex flex-col">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--ink-muted)" }}>Este mes</p>
          <div
            className="glass px-4 py-1"
            style={{ paddingTop: "0.75rem" }}
          >
            {budgets.map((b: {
              id: string; category_id: string; monthly_limit: number; currency_code: string;
              categories: { name: string; color: string; icon: string } | null;
            }, i, arr) => (
              <div
                key={b.id}
                style={i === arr.length - 1 ? { borderBottom: "none" } : {}}
              >
                <BudgetProgress
                  categoryName={b.categories?.name ?? ""}
                  icon={b.categories?.icon ?? "📦"}
                  color={b.categories?.color ?? "var(--accent)"}
                  spent={spentByCategory[b.category_id] ?? 0}
                  limit={b.monthly_limit}
                  currencyCode={b.currency_code}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
