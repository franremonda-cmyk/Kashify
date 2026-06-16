import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HeroBalanceCard from "@/components/HeroBalanceCard";
import MetricCard from "@/components/MetricCard";
import FolderCard from "@/components/FolderCard";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [balancesRes, profileRes, pendingRes, budgetsRes, txRes, categoriesRes] = await Promise.all([
    supabase.from("balances").select("*").eq("user_id", user.id).order("currency_code"),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("pending_transactions").select("*").eq("user_id", user.id).eq("status", "waiting")
      .gt("expires_at", new Date().toISOString()),
    supabase.from("category_budgets").select("*, categories(name, color, icon)").eq("user_id", user.id),
    supabase.from("transactions").select("category_id, amount, currency_code, type, description, date, categories(name, icon)")
      .eq("user_id", user.id).is("deleted_at", null)
      .gte("date", monthStart)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("categories").select("*, category_budgets(*)").eq("user_id", user.id).order("name"),
  ]);

  const balances = balancesRes.data ?? [];
  const profile = profileRes.data;
  const pending = pendingRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const txAll = txRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  const primaryCurrency = profile?.primary_currency ?? "ARS";
  const sortedBalances = [
    ...balances.filter((b) => b.currency_code === primaryCurrency),
    ...balances.filter((b) => b.currency_code !== primaryCurrency),
  ];

  // Métricas del mes (moneda principal)
  const monthlyIncome = txAll
    .filter((t) => t.type === "income" && t.currency_code === primaryCurrency)
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense = txAll
    .filter((t) => ["expense", "installment-payment"].includes(t.type) && t.currency_code === primaryCurrency)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Spent by category
  const spentByCat: Record<string, number> = {};
  for (const t of txAll) {
    if (!t.category_id || !["expense", "installment-payment"].includes(t.type)) continue;
    spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount);
  }

  // Recent transactions (last 5)
  const recent = txAll.slice(0, 5);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  // Check onboarding
  if (!profile?.display_name) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1
            className="display font-semibold"
            style={{ fontSize: "1.35rem", color: "var(--ink)" }}
          >
            Hola{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            background: "linear-gradient(135deg, var(--accent), rgba(0,200,83,0.4))",
            color: "#060C09",
          }}
        >
          {(firstName?.[0] ?? "K").toUpperCase()}
        </div>
      </div>

      {/* Pending banner */}
      <DashboardClient pending={pending} userId={user.id} />

      {/* Hero balance */}
      <HeroBalanceCard balances={sortedBalances} primaryCurrency={primaryCurrency} />

      {/* Métricas */}
      <div className="flex gap-2">
        <MetricCard label="Ingresos" value={monthlyIncome} currencyCode={primaryCurrency}
          variant="positive" delay="1" />
        <MetricCard label="Gastos" value={monthlyExpense} currencyCode={primaryCurrency}
          variant="negative" delay="2" />
        <MetricCard label="Neto" value={monthlyIncome - monthlyExpense} currencyCode={primaryCurrency}
          variant="neutral" delay="3" />
      </div>

      {/* Folders / categorías */}
      {categories.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium enter-up" style={{ color: "var(--ink-muted)" }}>
            Categorías
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
            style={{ scrollbarWidth: "none" }}>
            {categories.map((cat, i) => {
              const budget = (cat as { category_budgets?: { monthly_limit: number; currency_code: string }[] })
                .category_budgets?.[0];
              return (
                <FolderCard
                  key={cat.id}
                  name={cat.name}
                  icon={cat.icon}
                  color={cat.color}
                  spent={spentByCat[cat.id] ?? 0}
                  limit={budget?.monthly_limit}
                  currencyCode={budget?.currency_code ?? primaryCurrency}
                  delay={String(Math.min(i + 1, 6))}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Transacciones recientes */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3 enter-up" data-delay="4">
          <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            Últimas transacciones
          </p>
          <div className="glass flex flex-col">
            {recent.map((t, i) => {
              const cat = t.categories as unknown as { name?: string; icon?: string } | null;
              const isIncome = t.type === "income";
              return (
                <div
                  key={`${t.description}-${i}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < recent.length - 1 ? "0.5px solid var(--glass-border-dim)" : "none",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    {cat?.icon ?? "💸"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                      {t.description}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--ink-dim)" }}>
                      {cat?.name ?? "Sin categoría"} · {t.date}
                    </p>
                  </div>
                  <span
                    className="display font-semibold text-sm flex-shrink-0"
                    style={{ color: isIncome ? "var(--positive)" : "var(--negative)" }}
                  >
                    {isIncome ? "+" : "−"}{t.currency_code} {Number(t.amount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {recent.length === 0 && balances.length === 0 && (
        <div className="glass p-8 text-center flex flex-col gap-3 enter-up" data-delay="3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto"
            style={{ background: "var(--accent-soft)" }}
          >
            💬
          </div>
          <div>
            <p className="font-medium" style={{ color: "var(--ink)" }}>Neo te espera</p>
            <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              Escribile a Neo por WhatsApp o usá el <span style={{ color: "var(--accent)" }}>+</span> para empezar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
