import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardOverview from "@/components/DashboardOverview";
import DashboardClient from "./DashboardClient";
import type { ChartMonth } from "@/components/SpendingChart";

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split("T")[0];

  // 12-month window for chart data
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    .toISOString().split("T")[0];

  const [balancesRes, profileRes, pendingRes, txMonthRes, txHistoryRes] = await Promise.all([
    supabase.from("balances").select("*").eq("user_id", user.id).order("currency_code"),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("pending_transactions").select("*").eq("user_id", user.id).eq("status", "waiting")
      .gt("expires_at", new Date().toISOString()),
    // Current month for metrics + recent list
    supabase.from("transactions")
      .select("category_id, amount, currency_code, type, description, date, categories(name, icon)")
      .eq("user_id", user.id).is("deleted_at", null)
      .gte("date", monthStart)
      .order("created_at", { ascending: false })
      .limit(50),
    // 12 months for chart
    supabase.from("transactions")
      .select("amount, currency_code, type, date")
      .eq("user_id", user.id).is("deleted_at", null)
      .gte("date", yearAgo)
      .order("date", { ascending: true }),
  ]);

  const balances = balancesRes.data ?? [];
  const profile = profileRes.data;
  const pending = pendingRes.data ?? [];
  const txAll = txMonthRes.data ?? [];
  const txHistory = txHistoryRes.data ?? [];

  if (!profile?.display_name) redirect("/onboarding");

  const primaryCurrency = profile?.primary_currency ?? "ARS";
  const sortedBalances = [
    ...balances.filter((b) => b.currency_code === primaryCurrency),
    ...balances.filter((b) => b.currency_code !== primaryCurrency),
  ];

  // Per-currency monthly metrics
  const allCurrencies = [...new Set([
    ...txAll.map((t) => t.currency_code),
    ...balances.map((b) => b.currency_code),
  ])];

  const metrics = allCurrencies.map((currency) => ({
    currency_code: currency,
    income: txAll
      .filter((t) => t.type === "income" && t.currency_code === currency)
      .reduce((s, t) => s + Number(t.amount), 0),
    expense: txAll
      .filter((t) => ["expense", "installment-payment"].includes(t.type) && t.currency_code === currency)
      .reduce((s, t) => s + Number(t.amount), 0),
  }));

  // Build chart data: 12 months per currency
  const chartData: Record<string, ChartMonth[]> = {};
  for (const currency of allCurrencies) {
    const months: ChartMonth[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthTxs = txHistory.filter((t) => {
        const td = new Date(t.date);
        return t.currency_code === currency && td.getFullYear() === y && td.getMonth() === m;
      });
      months.push({
        label: MONTH_LABELS[m],
        income: monthTxs
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + Number(t.amount), 0),
        expense: monthTxs
          .filter((t) => ["expense", "installment-payment"].includes(t.type))
          .reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    chartData[currency] = months;
  }

  const recent = txAll.slice(0, 5);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            {now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
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
            background: "linear-gradient(135deg, var(--accent), rgba(0,230,118,0.4))",
            color: "#060C09",
          }}
        >
          {(firstName?.[0] ?? "K").toUpperCase()}
        </div>
      </div>

      {/* Pending Neo confirmations */}
      <DashboardClient pending={pending} userId={user.id} />

      {/* Balance + metrics + chart — currency-synced */}
      <DashboardOverview
        balances={sortedBalances}
        primaryCurrency={primaryCurrency}
        metrics={metrics}
        chartData={chartData}
      />

      {/* Recent transactions */}
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
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: isIncome ? "rgba(48,209,88,0.10)" : "rgba(255,255,255,0.06)" }}
                  >
                    {cat?.icon ? (
                      <span>{cat.icon}</span>
                    ) : (
                      <div className="w-3 h-3 rounded-full" style={{ background: isIncome ? "var(--positive)" : "var(--ink-dim)" }} />
                    )}
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
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--accent-soft)", border: "0.5px solid var(--glass-border-hover)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--accent)" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
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
